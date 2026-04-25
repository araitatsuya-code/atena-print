package main

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
	"atena-label/internal/usecase"
)

// AppVersion はアプリのバージョン文字列。
const AppVersion = "1.0.0"

// App struct
type App struct {
	ctx                 context.Context
	contactUseCase      *usecase.ContactUseCase
	contactYearStatusUC *usecase.ContactYearStatusUseCase
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
}

// NewApp creates a new App application struct
func NewApp(contactUC *usecase.ContactUseCase, contactYearStatusUC *usecase.ContactYearStatusUseCase, csvUC *usecase.CSVUseCase, groupUC *usecase.GroupUseCase, watermarkUC *usecase.WatermarkUseCase, qrCodeUC *usecase.QRCodeUseCase, printUC *usecase.PrintUseCase, senderUC *usecase.SenderUseCase, postalRepo repository.PostalRepository, printHistoryUC *usecase.PrintHistoryUseCase, db *sql.DB, dbPath string) *App {
	return &App{
		contactUseCase:      contactUC,
		contactYearStatusUC: contactYearStatusUC,
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
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
