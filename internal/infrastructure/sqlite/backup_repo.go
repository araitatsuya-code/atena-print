package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type backupIndex struct {
	Generations []entity.BackupGenerationRecord `json:"generations"`
}

type BackupRepo struct {
	db            *sql.DB
	settingsPath  string
	indexPath     string
	backupDir     string
	pendingDir    string
	pendingMarker string
}

func NewBackupRepo(db *sql.DB, dataDir string) repository.BackupRepository {
	return &BackupRepo{
		db:            db,
		settingsPath:  filepath.Join(dataDir, "backup_settings.json"),
		indexPath:     filepath.Join(dataDir, "backup_index.json"),
		backupDir:     filepath.Join(dataDir, "backups"),
		pendingDir:    filepath.Join(dataDir, "pending_restore"),
		pendingMarker: filepath.Join(dataDir, "pending_restore.json"),
	}
}

func (r *BackupRepo) LoadSettings() (entity.BackupSettings, error) {
	var settings entity.BackupSettings
	body, err := os.ReadFile(r.settingsPath)
	if err != nil {
		return entity.BackupSettings{}, err
	}
	if err := json.Unmarshal(body, &settings); err != nil {
		return entity.BackupSettings{}, err
	}
	return settings, nil
}

func (r *BackupRepo) SaveSettings(settings entity.BackupSettings) error {
	return writeJSONAtomic(r.settingsPath, settings)
}

func (r *BackupRepo) LoadGenerationRecords() ([]entity.BackupGenerationRecord, error) {
	body, err := os.ReadFile(r.indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []entity.BackupGenerationRecord{}, nil
		}
		return nil, err
	}
	var idx backupIndex
	if err := json.Unmarshal(body, &idx); err != nil {
		return nil, err
	}
	if idx.Generations == nil {
		return []entity.BackupGenerationRecord{}, nil
	}
	return idx.Generations, nil
}

func (r *BackupRepo) SaveGenerationRecords(records []entity.BackupGenerationRecord) error {
	if records == nil {
		records = []entity.BackupGenerationRecord{}
	}
	return writeJSONAtomic(r.indexPath, backupIndex{Generations: records})
}

func (r *BackupRepo) CreateSnapshot(ctx context.Context, destPath string) error {
	_ = os.Remove(destPath)
	if _, err := r.db.ExecContext(ctx, "VACUUM INTO ?", destPath); err != nil {
		return err
	}
	return nil
}

func (r *BackupRepo) CountContacts(ctx context.Context) (int, error) {
	var count int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM contacts").Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *BackupRepo) BackupFilePath(fileName string) string {
	return filepath.Join(r.backupDir, fileName)
}

func (r *BackupRepo) BackupFileExists(fileName string) (bool, error) {
	_, err := os.Stat(r.BackupFilePath(fileName))
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (r *BackupRepo) RemoveBackupFile(fileName string) error {
	err := os.Remove(r.BackupFilePath(fileName))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (r *BackupRepo) StagePendingRestore(fileName string, backupID string) (entity.PendingRestore, error) {
	src := r.BackupFilePath(fileName)
	if _, err := os.Stat(src); err != nil {
		return entity.PendingRestore{}, err
	}
	if err := os.MkdirAll(r.pendingDir, 0755); err != nil {
		return entity.PendingRestore{}, err
	}

	staged := filepath.Join(r.pendingDir, fmt.Sprintf("restore-%d.db", time.Now().UnixNano()))
	if err := copyFile(src, staged); err != nil {
		return entity.PendingRestore{}, err
	}
	pending := entity.PendingRestore{
		BackupID:    backupID,
		SourcePath:  staged,
		RequestedAt: time.Now(),
	}
	if err := writeJSONAtomic(r.pendingMarker, pending); err != nil {
		_ = os.Remove(staged)
		return entity.PendingRestore{}, err
	}
	return pending, nil
}

func PendingRestoreMarkerPath(dataDir string) string {
	return filepath.Join(dataDir, "pending_restore.json")
}

func ApplyPendingRestore(dataDir string, dbPath string) error {
	markerPath := PendingRestoreMarkerPath(dataDir)
	body, err := os.ReadFile(markerPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var pending entity.PendingRestore
	if err := json.Unmarshal(body, &pending); err != nil {
		return err
	}
	if pending.SourcePath == "" {
		return nil
	}

	tmp := dbPath + ".pending-restore.tmp"
	if err := copyFile(pending.SourcePath, tmp); err != nil {
		return err
	}
	if err := os.Rename(tmp, dbPath); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	_ = os.Remove(pending.SourcePath)
	_ = os.Remove(markerPath)
	return nil
}

func writeJSONAtomic(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	body, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, body, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
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
