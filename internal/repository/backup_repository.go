package repository

import (
	"context"

	"atena-label/internal/entity"
)

type BackupRepository interface {
	LoadSettings() (entity.BackupSettings, error)
	SaveSettings(settings entity.BackupSettings) error

	LoadGenerationRecords() ([]entity.BackupGenerationRecord, error)
	SaveGenerationRecords(records []entity.BackupGenerationRecord) error

	CreateSnapshot(ctx context.Context, destPath string) error
	CountContacts(ctx context.Context) (int, error)

	BackupFilePath(fileName string) string
	BackupFileExists(fileName string) (bool, error)
	RemoveBackupFile(fileName string) error

	StagePendingRestore(fileName string, backupID string) (entity.PendingRestore, error)
}
