package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
	"atena-label/internal/usecase"
)

// AppVersion はアプリのバージョン文字列。
const AppVersion = "1.0.0"

const (
	defaultBackupIntervalMinutes = 0
	defaultBackupMaxGenerations  = 20
)

type backupIndex struct {
	Generations []backupIndexEntry `json:"generations"`
}

type backupIndexEntry struct {
	ID           string    `json:"id"`
	CreatedAt    time.Time `json:"createdAt"`
	ContactCount int       `json:"contactCount"`
	Trigger      string    `json:"trigger"`
	FileName     string    `json:"fileName"`
}

// App struct
type App struct {
	ctx                 context.Context
	contactUseCase      *usecase.ContactUseCase
	contactYearStatusUC *usecase.ContactYearStatusUseCase
	addressNormUseCase  *usecase.AddressNormalizationUseCase
	csvUseCase          *usecase.CSVUseCase
	groupUseCase        *usecase.GroupUseCase
	watermarkUseCase    *usecase.WatermarkUseCase
	qrCodeUseCase       *usecase.QRCodeUseCase
	printUseCase        *usecase.PrintUseCase
	senderUseCase       *usecase.SenderUseCase
	postalRepo          repository.PostalRepository
	printHistoryUseCase *usecase.PrintHistoryUseCase
	db                  *sql.DB
	dbPath              string
	normMu              sync.Mutex
	lastNormBatch       *addressNormalizationRollbackBatch
	backupMu            sync.Mutex
	backupSettings      entity.BackupSettings
	backupSettingsPath  string
	backupIndexPath     string
	backupDir           string
	backupTickerStop    chan struct{}
	backupTickerDone    chan struct{}
}

type addressNormalizationRollbackBatch struct {
	BatchID  string
	Contacts []entity.Contact
}

// NewApp creates a new App application struct
func NewApp(contactUC *usecase.ContactUseCase, contactYearStatusUC *usecase.ContactYearStatusUseCase, csvUC *usecase.CSVUseCase, groupUC *usecase.GroupUseCase, watermarkUC *usecase.WatermarkUseCase, qrCodeUC *usecase.QRCodeUseCase, printUC *usecase.PrintUseCase, senderUC *usecase.SenderUseCase, postalRepo repository.PostalRepository, printHistoryUC *usecase.PrintHistoryUseCase, db *sql.DB, dbPath string) *App {
	dataDir := filepath.Dir(dbPath)
	return &App{
		contactUseCase:      contactUC,
		contactYearStatusUC: contactYearStatusUC,
		addressNormUseCase:  usecase.NewAddressNormalizationUseCase(postalRepo),
		csvUseCase:          csvUC,
		groupUseCase:        groupUC,
		watermarkUseCase:    watermarkUC,
		qrCodeUseCase:       qrCodeUC,
		printUseCase:        printUC,
		senderUseCase:       senderUC,
		postalRepo:          postalRepo,
		printHistoryUseCase: printHistoryUC,
		db:                  db,
		dbPath:              dbPath,
		backupSettings:      defaultBackupSettings(),
		backupSettingsPath:  filepath.Join(dataDir, "backup_settings.json"),
		backupIndexPath:     filepath.Join(dataDir, "backup_index.json"),
		backupDir:           filepath.Join(dataDir, "backups"),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	if err := a.loadBackupSettings(); err != nil {
		log.Printf("backup settings load failed: %v", err)
	}
	if err := a.reconfigureBackupTicker(); err != nil {
		log.Printf("backup scheduler start failed: %v", err)
	}

	settings, err := a.GetBackupSettings()
	if err != nil {
		log.Printf("backup settings read failed: %v", err)
		return
	}
	if settings.Timing.OnStartup {
		if _, err := a.runManagedBackup("startup"); err != nil {
			log.Printf("startup backup failed: %v", err)
		}
	}
}

// shutdown is called right before the app terminates.
func (a *App) shutdown(ctx context.Context) {
	_ = ctx
	a.stopBackupTicker()

	settings, err := a.GetBackupSettings()
	if err != nil {
		log.Printf("backup settings read failed: %v", err)
		return
	}
	if settings.Timing.OnShutdown {
		if _, err := a.runManagedBackup("shutdown"); err != nil {
			log.Printf("shutdown backup failed: %v", err)
		}
	}
}

// GetContacts returns all contacts, optionally filtered by groupID.
func (a *App) GetContacts(groupID string) ([]entity.Contact, error) {
	contacts, err := a.contactUseCase.List(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetContacts: %w", err)
	}
	return contacts, nil
}

// GetContact returns a single contact by ID.
func (a *App) GetContact(id string) (*entity.Contact, error) {
	c, err := a.contactUseCase.Get(id)
	if err != nil {
		return nil, fmt.Errorf("GetContact: %w", err)
	}
	return c, nil
}

// SaveContact creates or updates a contact.
func (a *App) SaveContact(c entity.Contact) (entity.Contact, error) {
	saved, err := a.contactUseCase.Save(c)
	if err != nil {
		return entity.Contact{}, fmt.Errorf("SaveContact: %w", err)
	}
	return saved, nil
}

// DeleteContacts deletes multiple contacts by IDs.
func (a *App) DeleteContacts(ids []string) error {
	for _, id := range ids {
		if err := a.contactUseCase.Delete(id); err != nil {
			return fmt.Errorf("DeleteContacts: %w", err)
		}
	}
	return nil
}

// SearchContacts searches contacts by keyword.
func (a *App) SearchContacts(query string) ([]entity.Contact, error) {
	contacts, err := a.contactUseCase.Search(query)
	if err != nil {
		return nil, fmt.Errorf("SearchContacts: %w", err)
	}
	return contacts, nil
}

// GetAddressNormalizationPreview returns normalization candidates derived from postal code master data.
func (a *App) GetAddressNormalizationPreview() (entity.AddressNormalizationPreview, error) {
	contacts, err := a.contactUseCase.List("")
	if err != nil {
		return entity.AddressNormalizationPreview{}, fmt.Errorf("GetAddressNormalizationPreview: %w", err)
	}

	preview := a.addressNormUseCase.BuildPreview(contacts)
	a.normMu.Lock()
	if a.lastNormBatch != nil && len(a.lastNormBatch.Contacts) > 0 {
		preview.CanRollback = true
		preview.RollbackBatchID = a.lastNormBatch.BatchID
	}
	a.normMu.Unlock()

	return preview, nil
}

// ApplyAddressNormalization applies selected normalization candidates and records rollback data.
func (a *App) ApplyAddressNormalization(selections []entity.AddressNormalizationSelection) (entity.AddressNormalizationApplyResult, error) {
	contacts, err := a.contactUseCase.List("")
	if err != nil {
		return entity.AddressNormalizationApplyResult{}, fmt.Errorf("ApplyAddressNormalization list contacts: %w", err)
	}

	preview := a.addressNormUseCase.BuildPreview(contacts)
	result := entity.AddressNormalizationApplyResult{
		Errors: []string{},
	}
	if len(preview.Candidates) == 0 {
		return result, nil
	}

	selected := make(map[string]bool, len(selections))
	useSelection := len(selections) > 0
	for _, selection := range selections {
		selected[selection.ContactID] = selection.Apply
	}

	rollbackContacts := make([]entity.Contact, 0, len(preview.Candidates))
	for _, candidate := range preview.Candidates {
		if useSelection {
			apply, ok := selected[candidate.ContactID]
			if !ok || !apply {
				result.SkippedCount++
				continue
			}
		}

		current, getErr := a.contactUseCase.Get(candidate.ContactID)
		if getErr != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("%s: 取得失敗: %v", candidate.DisplayName, getErr))
			continue
		}
		if current == nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("contactId=%s: 連絡先が見つかりません", candidate.ContactID))
			continue
		}

		before := *current
		next := before
		next.Prefecture = candidate.After.Prefecture
		next.City = candidate.After.City
		next.Street = candidate.After.Street

		if before.Prefecture == next.Prefecture &&
			before.City == next.City &&
			before.Street == next.Street {
			result.SkippedCount++
			continue
		}

		if _, saveErr := a.contactUseCase.Save(next); saveErr != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("%s: 更新失敗: %v", candidate.DisplayName, saveErr))
			continue
		}

		result.AppliedCount++
		rollbackContacts = append(rollbackContacts, before)
	}

	if result.AppliedCount > 0 {
		batchID := fmt.Sprintf("addrnorm-%d", time.Now().UnixNano())
		result.BatchID = batchID
		result.CanRollback = true

		a.normMu.Lock()
		a.lastNormBatch = &addressNormalizationRollbackBatch{
			BatchID:  batchID,
			Contacts: rollbackContacts,
		}
		a.normMu.Unlock()
	}

	return result, nil
}

// RollbackAddressNormalization restores the latest applied normalization batch.
func (a *App) RollbackAddressNormalization(batchID string) (entity.AddressNormalizationRollbackResult, error) {
	result := entity.AddressNormalizationRollbackResult{
		Errors: []string{},
	}

	a.normMu.Lock()
	batch := a.lastNormBatch
	a.normMu.Unlock()

	if batch == nil || len(batch.Contacts) == 0 {
		return result, fmt.Errorf("RollbackAddressNormalization: ロールバック可能な履歴がありません")
	}
	if batchID != "" && batch.BatchID != batchID {
		return result, fmt.Errorf("RollbackAddressNormalization: 指定バッチが見つかりません")
	}

	result.BatchID = batch.BatchID
	for _, snapshot := range batch.Contacts {
		if _, err := a.contactUseCase.Save(snapshot); err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("contactId=%s: 復元失敗: %v", snapshot.ID, err))
			continue
		}
		result.RestoredCount++
	}

	if result.FailedCount == 0 {
		a.normMu.Lock()
		if a.lastNormBatch != nil && a.lastNormBatch.BatchID == batch.BatchID {
			a.lastNormBatch = nil
		}
		a.normMu.Unlock()
	}

	return result, nil
}

// GetContactYearStatuses returns all yearly statuses in the specified year.
func (a *App) GetContactYearStatuses(year int) ([]entity.ContactYearStatus, error) {
	list, err := a.contactYearStatusUC.ListByYear(year)
	if err != nil {
		return nil, fmt.Errorf("GetContactYearStatuses: %w", err)
	}
	if list == nil {
		list = []entity.ContactYearStatus{}
	}
	return list, nil
}

// SaveContactYearStatus creates or updates one yearly status for a contact.
func (a *App) SaveContactYearStatus(status entity.ContactYearStatus) (entity.ContactYearStatus, error) {
	saved, err := a.contactYearStatusUC.Save(status)
	if err != nil {
		return entity.ContactYearStatus{}, fmt.Errorf("SaveContactYearStatus: %w", err)
	}
	return saved, nil
}

// MarkContactsSentForYear marks contacts as sent for the specified year.
func (a *App) MarkContactsSentForYear(contactIDs []string, year int) error {
	if err := a.contactYearStatusUC.MarkSent(contactIDs, year); err != nil {
		return fmt.Errorf("MarkContactsSentForYear: %w", err)
	}
	return nil
}

// LookupPostal returns address information for the given postal code (7 digits, hyphens allowed).
func (a *App) LookupPostal(postalCode string) (*entity.Address, error) {
	addr, err := a.postalRepo.Lookup(postalCode)
	if err != nil {
		return nil, fmt.Errorf("LookupPostal: %w", err)
	}
	return addr, nil
}

// ImportCSV imports contacts from the given CSV file path.
func (a *App) ImportCSV(filePath string) (entity.ImportResult, error) {
	result, err := a.csvUseCase.Import(filePath)
	if err != nil {
		return result, fmt.Errorf("ImportCSV: %w", err)
	}
	return result, nil
}

// GetCSVImportPlan returns headers, sample rows and suggested mapping for CSV import wizard.
func (a *App) GetCSVImportPlan(filePath string) (entity.CSVImportPlan, error) {
	plan, err := a.csvUseCase.CreateImportPlan(filePath)
	if err != nil {
		return entity.CSVImportPlan{}, fmt.Errorf("GetCSVImportPlan: %w", err)
	}
	return plan, nil
}

// AnalyzeCSVImport evaluates parse errors and duplicate candidates for CSV import wizard.
func (a *App) AnalyzeCSVImport(filePath string, mapping map[string]int) (entity.CSVImportAnalysis, error) {
	analysis, err := a.csvUseCase.AnalyzeImport(filePath, mapping)
	if err != nil {
		return entity.CSVImportAnalysis{}, fmt.Errorf("AnalyzeCSVImport: %w", err)
	}
	return analysis, nil
}

// ImportCSVWithOptions imports CSV with explicit duplicate resolutions.
func (a *App) ImportCSVWithOptions(filePath string, mapping map[string]int, resolutions []entity.CSVDuplicateResolution) (entity.CSVImportExecutionResult, error) {
	result, err := a.csvUseCase.ImportWithOptions(filePath, mapping, resolutions)
	if err != nil {
		return entity.CSVImportExecutionResult{}, fmt.Errorf("ImportCSVWithOptions: %w", err)
	}
	return result, nil
}

// ExportCSV exports the given contacts (or all if ids is empty) to a CSV file.
func (a *App) ExportCSV(ids []string, filePath string) error {
	if err := a.csvUseCase.Export(ids, filePath); err != nil {
		return fmt.Errorf("ExportCSV: %w", err)
	}
	return nil
}

// OpenCSVFileDialog opens a native file picker filtered to CSV files.
func (a *App) OpenCSVFileDialog() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "CSVファイルを選択",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSVファイル (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("OpenCSVFileDialog: %w", err)
	}
	return path, nil
}

// SaveCSVFileDialog opens a native save dialog for CSV output.
func (a *App) SaveCSVFileDialog(defaultFilename string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "CSVファイルを保存",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "CSVファイル (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("SaveCSVFileDialog: %w", err)
	}
	return path, nil
}

// GetGroups returns all groups.
func (a *App) GetGroups() ([]entity.Group, error) {
	groups, err := a.groupUseCase.List()
	if err != nil {
		return nil, fmt.Errorf("GetGroups: %w", err)
	}
	return groups, nil
}

// SaveGroup creates or updates a group.
func (a *App) SaveGroup(g entity.Group) (entity.Group, error) {
	saved, err := a.groupUseCase.Save(g)
	if err != nil {
		return entity.Group{}, fmt.Errorf("SaveGroup: %w", err)
	}
	return saved, nil
}

// DeleteGroup deletes a group by ID.
func (a *App) DeleteGroup(id string) error {
	if err := a.groupUseCase.Delete(id); err != nil {
		return fmt.Errorf("DeleteGroup: %w", err)
	}
	return nil
}

// GetContactGroups returns all groups that a contact belongs to.
func (a *App) GetContactGroups(contactID string) ([]entity.Group, error) {
	groups, err := a.groupUseCase.GetContactGroups(contactID)
	if err != nil {
		return nil, fmt.Errorf("GetContactGroups: %w", err)
	}
	return groups, nil
}

// AddContactToGroup adds a contact to a group.
func (a *App) AddContactToGroup(contactID string, groupID string) error {
	if err := a.groupUseCase.AddContactToGroup(contactID, groupID); err != nil {
		return fmt.Errorf("AddContactToGroup: %w", err)
	}
	return nil
}

// RemoveContactFromGroup removes a contact from a group.
func (a *App) RemoveContactFromGroup(contactID string, groupID string) error {
	if err := a.groupUseCase.RemoveContactFromGroup(contactID, groupID); err != nil {
		return fmt.Errorf("RemoveContactFromGroup: %w", err)
	}
	return nil
}

// SetContactGroups atomically replaces all group memberships for a contact.
func (a *App) SetContactGroups(contactID string, groupIDs []string) error {
	if err := a.groupUseCase.SetContactGroups(contactID, groupIDs); err != nil {
		return fmt.Errorf("SetContactGroups: %w", err)
	}
	return nil
}

// GetWatermarkPresets returns all watermark options (presets + custom uploads).
func (a *App) GetWatermarkPresets() ([]entity.Watermark, error) {
	list, err := a.watermarkUseCase.GetPresets()
	if err != nil {
		return nil, fmt.Errorf("GetWatermarkPresets: %w", err)
	}
	return list, nil
}

// UploadWatermark copies a custom watermark image to storage and returns the saved entity.
func (a *App) UploadWatermark(filePath string) (entity.Watermark, error) {
	w, err := a.watermarkUseCase.Upload(filePath)
	if err != nil {
		return entity.Watermark{}, fmt.Errorf("UploadWatermark: %w", err)
	}
	return w, nil
}

// DeleteWatermark removes a custom watermark by ID.
func (a *App) DeleteWatermark(id string) error {
	if err := a.watermarkUseCase.Delete(id); err != nil {
		return fmt.Errorf("DeleteWatermark: %w", err)
	}
	return nil
}

// GenerateQRPreview generates a QR code PNG for the given config and returns the raw bytes.
func (a *App) GenerateQRPreview(config entity.QRConfig) ([]byte, error) {
	png, err := a.qrCodeUseCase.GeneratePreview(config)
	if err != nil {
		return nil, fmt.Errorf("GenerateQRPreview: %w", err)
	}
	return png, nil
}

// GenerateLabelPDF generates a label PDF from the given print job and saves it to outPath.
// Returns the output file path.
func (a *App) GenerateLabelPDF(job entity.PrintJob, outPath string) (string, error) {
	path, err := a.printUseCase.GenerateLabelPDF(job, outPath)
	if err != nil {
		return "", fmt.Errorf("GenerateLabelPDF: %w", err)
	}
	// 印刷ログを記録 (失敗してもPDF生成結果は返す)
	watermarkID := ""
	if job.Watermark != nil {
		watermarkID = job.Watermark.ID
	}
	qrEnabled := job.QRConfig != nil && job.QRConfig.Enabled
	if herr := a.printHistoryUseCase.Record(len(job.ContactIDs), job.Template.ID, watermarkID, qrEnabled); herr != nil {
		log.Printf("GenerateLabelPDF: 印刷履歴の保存に失敗しました: %v", herr)
	}
	return path, nil
}

// CheckUnsupportedCharacters returns unsupported glyph warnings grouped by contact.
func (a *App) CheckUnsupportedCharacters(job entity.PrintJob) ([]entity.UnsupportedCharacterWarning, error) {
	warnings, err := a.printUseCase.CheckUnsupportedCharacters(job)
	if err != nil {
		return nil, fmt.Errorf("CheckUnsupportedCharacters: %w", err)
	}
	if warnings == nil {
		warnings = []entity.UnsupportedCharacterWarning{}
	}
	return warnings, nil
}

// PrintPDF opens the given PDF file in the OS default viewer/printer.
func (a *App) PrintPDF(pdfPath string) error {
	if err := a.printUseCase.Print(pdfPath); err != nil {
		return fmt.Errorf("PrintPDF: %w", err)
	}
	return nil
}

// GetSenders returns all senders.
func (a *App) GetSenders() ([]entity.Sender, error) {
	senders, err := a.senderUseCase.List()
	if err != nil {
		return nil, fmt.Errorf("GetSenders: %w", err)
	}
	return senders, nil
}

// SaveSender creates or updates a sender.
func (a *App) SaveSender(s entity.Sender) (entity.Sender, error) {
	saved, err := a.senderUseCase.Save(s)
	if err != nil {
		return entity.Sender{}, fmt.Errorf("SaveSender: %w", err)
	}
	return saved, nil
}

// DeleteSender deletes a sender by ID.
func (a *App) DeleteSender(id string) error {
	if err := a.senderUseCase.Delete(id); err != nil {
		return fmt.Errorf("DeleteSender: %w", err)
	}
	return nil
}

// SetDefaultSender sets the given sender as the default.
func (a *App) SetDefaultSender(id string) error {
	if err := a.senderUseCase.SetDefault(id); err != nil {
		return fmt.Errorf("SetDefaultSender: %w", err)
	}
	return nil
}

// GetTempPDFPath returns a platform-safe temporary file path for PDF generation.
func (a *App) GetTempPDFPath() string {
	return filepath.Join(os.TempDir(), fmt.Sprintf("atena-label-%d.pdf", time.Now().UnixMilli()))
}

// SavePDFFileDialog opens a native save dialog filtered to PDF files.
func (a *App) SavePDFFileDialog(defaultFilename string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "PDFファイルを保存",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "PDFファイル (*.pdf)", Pattern: "*.pdf"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("SavePDFFileDialog: %w", err)
	}
	return path, nil
}

// GetPrintHistory returns the most recent print history entries.
func (a *App) GetPrintHistory(limit int) ([]entity.PrintHistory, error) {
	list, err := a.printHistoryUseCase.GetRecent(limit)
	if err != nil {
		return nil, fmt.Errorf("GetPrintHistory: %w", err)
	}
	if list == nil {
		list = []entity.PrintHistory{}
	}
	return list, nil
}

// GetDashboardStats returns summary counts for the dashboard.
func (a *App) GetDashboardStats() (entity.DashboardStats, error) {
	contacts, err := a.contactUseCase.List("")
	if err != nil {
		return entity.DashboardStats{}, fmt.Errorf("GetDashboardStats contacts: %w", err)
	}
	groups, err := a.groupUseCase.List()
	if err != nil {
		return entity.DashboardStats{}, fmt.Errorf("GetDashboardStats groups: %w", err)
	}
	return entity.DashboardStats{
		ContactCount: len(contacts),
		GroupCount:   len(groups),
	}, nil
}

// GetAppVersion returns the application version string.
func (a *App) GetAppVersion() string {
	return AppVersion
}

// ExportDB opens a save dialog and exports the database using SQLite's VACUUM INTO
// for a consistent online snapshot without interrupting the live connection.
func (a *App) ExportDB() (string, error) {
	dest, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "データをバックアップ",
		DefaultFilename: "atena-backup.db",
		Filters: []runtime.FileFilter{
			{DisplayName: "SQLiteデータベース (*.db)", Pattern: "*.db"},
		},
	})
	if err != nil || dest == "" {
		return "", nil
	}
	// 既存ファイルを一旦削除しないと VACUUM INTO が失敗する
	_ = os.Remove(dest)
	if _, err := a.db.ExecContext(a.ctx, "VACUUM INTO ?", dest); err != nil {
		return "", fmt.Errorf("ExportDB: %w", err)
	}
	return dest, nil
}

// ImportDB opens a file dialog and atomically replaces the database file.
// Returns true if the import was performed, false if the user cancelled.
// The application must be restarted for the new DB to take effect.
func (a *App) ImportDB() (bool, error) {
	src, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "バックアップから復元",
		Filters: []runtime.FileFilter{
			{DisplayName: "SQLiteデータベース (*.db)", Pattern: "*.db"},
		},
	})
	if err != nil || src == "" {
		return false, nil
	}
	// 一時ファイルに書き出してからアトミックにリネーム (src == dbPath でも安全)
	tmp := a.dbPath + ".import.tmp"
	if err := copyFile(src, tmp); err != nil {
		return false, fmt.Errorf("ImportDB コピー失敗: %w", err)
	}
	if err := os.Rename(tmp, a.dbPath); err != nil {
		_ = os.Remove(tmp)
		return false, fmt.Errorf("ImportDB 配置失敗: %w", err)
	}
	return true, nil
}

// GetBackupSettings returns current automatic backup settings.
func (a *App) GetBackupSettings() (entity.BackupSettings, error) {
	a.backupMu.Lock()
	defer a.backupMu.Unlock()
	return normalizeBackupSettings(a.backupSettings), nil
}

// SaveBackupSettings updates automatic backup settings and restarts scheduler.
func (a *App) SaveBackupSettings(settings entity.BackupSettings) (entity.BackupSettings, error) {
	normalized := normalizeBackupSettings(settings)

	a.backupMu.Lock()
	a.backupSettings = normalized
	if err := a.persistBackupSettingsLocked(); err != nil {
		a.backupMu.Unlock()
		return entity.BackupSettings{}, fmt.Errorf("SaveBackupSettings: %w", err)
	}
	a.backupMu.Unlock()

	if err := a.reconfigureBackupTicker(); err != nil {
		return entity.BackupSettings{}, fmt.Errorf("SaveBackupSettings scheduler: %w", err)
	}
	return normalized, nil
}

// ListBackupGenerations returns restorable backup generations.
func (a *App) ListBackupGenerations() ([]entity.BackupGeneration, error) {
	a.backupMu.Lock()
	index, err := a.loadBackupIndexLocked()
	if err != nil {
		a.backupMu.Unlock()
		return nil, fmt.Errorf("ListBackupGenerations: %w", err)
	}
	filtered := make([]backupIndexEntry, 0, len(index.Generations))
	changed := false
	for _, entry := range index.Generations {
		if entry.FileName == "" {
			changed = true
			continue
		}
		fullPath := filepath.Join(a.backupDir, entry.FileName)
		if _, statErr := os.Stat(fullPath); statErr != nil {
			if os.IsNotExist(statErr) {
				changed = true
				continue
			}
			a.backupMu.Unlock()
			return nil, fmt.Errorf("ListBackupGenerations stat %s: %w", entry.FileName, statErr)
		}
		filtered = append(filtered, entry)
	}
	if changed {
		index.Generations = filtered
		if err := a.saveBackupIndexLocked(index); err != nil {
			a.backupMu.Unlock()
			return nil, fmt.Errorf("ListBackupGenerations cleanup index: %w", err)
		}
	}

	list := make([]entity.BackupGeneration, 0, len(index.Generations))
	for _, entry := range index.Generations {
		list = append(list, entity.BackupGeneration{
			ID:           entry.ID,
			CreatedAt:    entry.CreatedAt,
			ContactCount: entry.ContactCount,
			Trigger:      entry.Trigger,
		})
	}
	a.backupMu.Unlock()

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})
	return list, nil
}

// RestoreBackupGeneration restores one backup generation.
// The restored data is reflected after app restart.
func (a *App) RestoreBackupGeneration(backupID string) (entity.RestoreBackupResult, error) {
	if backupID == "" {
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration: backupID is required")
	}

	a.backupMu.Lock()
	index, err := a.loadBackupIndexLocked()
	if err != nil {
		a.backupMu.Unlock()
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration load index: %w", err)
	}
	var target *backupIndexEntry
	for i := range index.Generations {
		if index.Generations[i].ID == backupID {
			target = &index.Generations[i]
			break
		}
	}
	if target == nil {
		a.backupMu.Unlock()
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration: 指定した世代が見つかりません")
	}
	src := filepath.Join(a.backupDir, target.FileName)
	a.backupMu.Unlock()

	restoreSourceTmp := a.dbPath + ".restore-source.tmp"
	if err := copyFile(src, restoreSourceTmp); err != nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration cache source: %w", err)
	}
	defer os.Remove(restoreSourceTmp)

	preserved, err := a.runManagedBackup("before_restore")
	if err != nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration preserve current data: %w", err)
	}

	tmp := a.dbPath + ".restore.tmp"
	if err := copyFile(restoreSourceTmp, tmp); err != nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration copy: %w", err)
	}
	_ = os.Remove(a.dbPath)
	if err := os.Rename(tmp, a.dbPath); err != nil {
		_ = os.Remove(tmp)
		return entity.RestoreBackupResult{}, fmt.Errorf("RestoreBackupGeneration replace: %w", err)
	}

	return entity.RestoreBackupResult{
		Restored:          true,
		BackupID:          backupID,
		PreservedBackupID: preserved.ID,
		RestartRequired:   true,
	}, nil
}

func (a *App) loadBackupSettings() error {
	a.backupMu.Lock()
	defer a.backupMu.Unlock()

	data, err := os.ReadFile(a.backupSettingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			a.backupSettings = defaultBackupSettings()
			return a.persistBackupSettingsLocked()
		}
		return err
	}

	var settings entity.BackupSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return err
	}
	a.backupSettings = normalizeBackupSettings(settings)
	return nil
}

func (a *App) persistBackupSettingsLocked() error {
	if err := os.MkdirAll(filepath.Dir(a.backupSettingsPath), 0755); err != nil {
		return err
	}
	body, err := json.MarshalIndent(a.backupSettings, "", "  ")
	if err != nil {
		return err
	}
	tmp := a.backupSettingsPath + ".tmp"
	if err := os.WriteFile(tmp, body, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, a.backupSettingsPath)
}

func (a *App) runManagedBackup(trigger string) (entity.BackupGeneration, error) {
	a.backupMu.Lock()
	backupDir := a.backupDir
	maxGenerations := normalizeBackupSettings(a.backupSettings).MaxGenerations
	a.backupMu.Unlock()

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return entity.BackupGeneration{}, err
	}

	now := time.Now()
	backupID := fmt.Sprintf("bkp-%d", now.UnixNano())
	fileName := fmt.Sprintf("atena-backup-%s-%s.db", now.Format("20060102-150405"), backupID)
	dest := filepath.Join(backupDir, fileName)

	_ = os.Remove(dest)
	if _, err := a.db.ExecContext(a.ctx, "VACUUM INTO ?", dest); err != nil {
		return entity.BackupGeneration{}, err
	}

	contactCount := 0
	if err := a.db.QueryRowContext(a.ctx, "SELECT COUNT(*) FROM contacts").Scan(&contactCount); err != nil {
		contactCount = 0
	}

	a.backupMu.Lock()
	defer a.backupMu.Unlock()
	index, err := a.loadBackupIndexLocked()
	if err != nil {
		return entity.BackupGeneration{}, err
	}
	index.Generations = append(index.Generations, backupIndexEntry{
		ID:           backupID,
		CreatedAt:    now,
		ContactCount: contactCount,
		Trigger:      trigger,
		FileName:     fileName,
	})
	sort.Slice(index.Generations, func(i, j int) bool {
		return index.Generations[i].CreatedAt.After(index.Generations[j].CreatedAt)
	})
	if len(index.Generations) > maxGenerations {
		for _, old := range index.Generations[maxGenerations:] {
			_ = os.Remove(filepath.Join(backupDir, old.FileName))
		}
		index.Generations = index.Generations[:maxGenerations]
	}
	if err := a.saveBackupIndexLocked(index); err != nil {
		return entity.BackupGeneration{}, err
	}

	return entity.BackupGeneration{
		ID:           backupID,
		CreatedAt:    now,
		ContactCount: contactCount,
		Trigger:      trigger,
	}, nil
}

func (a *App) loadBackupIndexLocked() (backupIndex, error) {
	var idx backupIndex

	data, err := os.ReadFile(a.backupIndexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return backupIndex{Generations: []backupIndexEntry{}}, nil
		}
		return backupIndex{}, err
	}
	if err := json.Unmarshal(data, &idx); err != nil {
		return backupIndex{}, err
	}
	if idx.Generations == nil {
		idx.Generations = []backupIndexEntry{}
	}
	return idx, nil
}

func (a *App) saveBackupIndexLocked(idx backupIndex) error {
	if err := os.MkdirAll(filepath.Dir(a.backupIndexPath), 0755); err != nil {
		return err
	}
	body, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return err
	}
	tmp := a.backupIndexPath + ".tmp"
	if err := os.WriteFile(tmp, body, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, a.backupIndexPath)
}

func (a *App) reconfigureBackupTicker() error {
	a.backupMu.Lock()
	settings := normalizeBackupSettings(a.backupSettings)
	oldStop := a.backupTickerStop
	oldDone := a.backupTickerDone
	a.backupTickerStop = nil
	a.backupTickerDone = nil

	interval := settings.Timing.IntervalMinutes
	var newStop chan struct{}
	var newDone chan struct{}
	if interval > 0 {
		newStop = make(chan struct{})
		newDone = make(chan struct{})
		a.backupTickerStop = newStop
		a.backupTickerDone = newDone
	}
	a.backupMu.Unlock()

	if oldStop != nil {
		close(oldStop)
		if oldDone != nil {
			<-oldDone
		}
	}

	if interval <= 0 {
		return nil
	}

	go func(intervalMinutes int, stop <-chan struct{}, done chan<- struct{}) {
		ticker := time.NewTicker(time.Duration(intervalMinutes) * time.Minute)
		defer ticker.Stop()
		defer close(done)

		for {
			select {
			case <-ticker.C:
				if _, err := a.runManagedBackup("interval"); err != nil {
					log.Printf("periodic backup failed: %v", err)
				}
			case <-stop:
				return
			}
		}
	}(interval, newStop, newDone)

	return nil
}

func (a *App) stopBackupTicker() {
	a.backupMu.Lock()
	stop := a.backupTickerStop
	done := a.backupTickerDone
	a.backupTickerStop = nil
	a.backupTickerDone = nil
	a.backupMu.Unlock()

	if stop != nil {
		close(stop)
	}
	if done != nil {
		<-done
	}
}

func defaultBackupSettings() entity.BackupSettings {
	return entity.BackupSettings{
		Timing: entity.BackupTimingSettings{
			OnStartup:       true,
			OnShutdown:      true,
			IntervalMinutes: defaultBackupIntervalMinutes,
		},
		MaxGenerations: defaultBackupMaxGenerations,
	}
}

func normalizeBackupSettings(settings entity.BackupSettings) entity.BackupSettings {
	normalized := settings
	if normalized.MaxGenerations <= 0 {
		normalized.MaxGenerations = defaultBackupMaxGenerations
	}
	if normalized.Timing.IntervalMinutes < 0 {
		normalized.Timing.IntervalMinutes = defaultBackupIntervalMinutes
	}
	return normalized
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
