package usecase

import (
	"context"
	"fmt"
	"log"
	"os"
	"sort"
	"sync"
	"time"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

const (
	defaultBackupIntervalMinutes = 0
	defaultBackupMaxGenerations  = 20
)

type BackupUseCase struct {
	repo repository.BackupRepository

	mu       sync.Mutex
	settings entity.BackupSettings
	stopCh   chan struct{}
	doneCh   chan struct{}
}

func NewBackupUseCase(repo repository.BackupRepository) *BackupUseCase {
	return &BackupUseCase{
		repo:     repo,
		settings: defaultBackupSettings(),
	}
}

func (uc *BackupUseCase) Startup(ctx context.Context) error {
	if err := uc.loadSettings(); err != nil {
		return fmt.Errorf("load settings: %w", err)
	}
	if err := uc.reconfigureTicker(); err != nil {
		return fmt.Errorf("start ticker: %w", err)
	}
	settings, err := uc.GetSettings()
	if err != nil {
		return fmt.Errorf("read settings: %w", err)
	}
	if settings.Timing.OnStartup {
		if _, err := uc.runManagedBackup(ctx, "startup"); err != nil {
			return fmt.Errorf("startup backup: %w", err)
		}
	}
	return nil
}

func (uc *BackupUseCase) Shutdown(ctx context.Context) error {
	uc.stopTicker()
	settings, err := uc.GetSettings()
	if err != nil {
		return fmt.Errorf("read settings: %w", err)
	}
	if settings.Timing.OnShutdown {
		if _, err := uc.runManagedBackup(ctx, "shutdown"); err != nil {
			return fmt.Errorf("shutdown backup: %w", err)
		}
	}
	return nil
}

func (uc *BackupUseCase) GetSettings() (entity.BackupSettings, error) {
	uc.mu.Lock()
	defer uc.mu.Unlock()
	return normalizeBackupSettings(uc.settings), nil
}

func (uc *BackupUseCase) SaveSettings(settings entity.BackupSettings) (entity.BackupSettings, error) {
	normalized := normalizeBackupSettings(settings)

	uc.mu.Lock()
	uc.settings = normalized
	uc.mu.Unlock()

	if err := uc.repo.SaveSettings(normalized); err != nil {
		return entity.BackupSettings{}, fmt.Errorf("save settings: %w", err)
	}
	if err := uc.reconfigureTicker(); err != nil {
		return entity.BackupSettings{}, fmt.Errorf("reconfigure ticker: %w", err)
	}
	return normalized, nil
}

func (uc *BackupUseCase) ListGenerations() ([]entity.BackupGeneration, error) {
	records, err := uc.repo.LoadGenerationRecords()
	if err != nil {
		return nil, fmt.Errorf("load generations: %w", err)
	}
	filtered := make([]entity.BackupGenerationRecord, 0, len(records))
	changed := false
	for _, record := range records {
		if record.FileName == "" {
			changed = true
			continue
		}
		exists, err := uc.repo.BackupFileExists(record.FileName)
		if err != nil {
			return nil, fmt.Errorf("check backup file %s: %w", record.FileName, err)
		}
		if !exists {
			changed = true
			continue
		}
		filtered = append(filtered, record)
	}
	if changed {
		if err := uc.repo.SaveGenerationRecords(filtered); err != nil {
			return nil, fmt.Errorf("save cleaned generations: %w", err)
		}
	}
	out := make([]entity.BackupGeneration, 0, len(filtered))
	for _, record := range filtered {
		out = append(out, entity.BackupGeneration{
			ID:           record.ID,
			CreatedAt:    record.CreatedAt,
			ContactCount: record.ContactCount,
			Trigger:      record.Trigger,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (uc *BackupUseCase) RestoreGeneration(ctx context.Context, backupID string) (entity.RestoreBackupResult, error) {
	if backupID == "" {
		return entity.RestoreBackupResult{}, fmt.Errorf("backupID is required")
	}
	preserved, err := uc.runManagedBackup(ctx, "before_restore")
	if err != nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("preserve current data: %w", err)
	}

	records, err := uc.repo.LoadGenerationRecords()
	if err != nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("load generations: %w", err)
	}
	var target *entity.BackupGenerationRecord
	for i := range records {
		if records[i].ID == backupID {
			target = &records[i]
			break
		}
	}
	if target == nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("指定した世代が見つかりません")
	}

	if _, err := uc.repo.StagePendingRestore(target.FileName, backupID); err != nil {
		return entity.RestoreBackupResult{}, fmt.Errorf("stage pending restore: %w", err)
	}
	return entity.RestoreBackupResult{
		Restored:          true,
		BackupID:          backupID,
		PreservedBackupID: preserved.ID,
		RestartRequired:   true,
	}, nil
}

func (uc *BackupUseCase) loadSettings() error {
	settings, err := uc.repo.LoadSettings()
	if err != nil {
		if os.IsNotExist(err) {
			defaults := defaultBackupSettings()
			if saveErr := uc.repo.SaveSettings(defaults); saveErr != nil {
				return saveErr
			}
			uc.mu.Lock()
			uc.settings = defaults
			uc.mu.Unlock()
			return nil
		}
		return err
	}
	uc.mu.Lock()
	uc.settings = normalizeBackupSettings(settings)
	uc.mu.Unlock()
	return nil
}

func (uc *BackupUseCase) runManagedBackup(ctx context.Context, trigger string) (entity.BackupGeneration, error) {
	uc.mu.Lock()
	settings := normalizeBackupSettings(uc.settings)
	uc.mu.Unlock()

	now := time.Now()
	backupID := fmt.Sprintf("bkp-%d", now.UnixNano())
	fileName := fmt.Sprintf("atena-backup-%s-%s.db", now.Format("20060102-150405"), backupID)
	destPath := uc.repo.BackupFilePath(fileName)

	if err := uc.repo.CreateSnapshot(ctx, destPath); err != nil {
		return entity.BackupGeneration{}, err
	}
	contactCount, err := uc.repo.CountContacts(ctx)
	if err != nil {
		contactCount = 0
	}

	records, err := uc.repo.LoadGenerationRecords()
	if err != nil {
		return entity.BackupGeneration{}, err
	}
	records = append(records, entity.BackupGenerationRecord{
		ID:           backupID,
		CreatedAt:    now,
		ContactCount: contactCount,
		Trigger:      trigger,
		FileName:     fileName,
	})
	sort.Slice(records, func(i, j int) bool {
		return records[i].CreatedAt.After(records[j].CreatedAt)
	})
	if len(records) > settings.MaxGenerations {
		for _, old := range records[settings.MaxGenerations:] {
			_ = uc.repo.RemoveBackupFile(old.FileName)
		}
		records = records[:settings.MaxGenerations]
	}
	if err := uc.repo.SaveGenerationRecords(records); err != nil {
		return entity.BackupGeneration{}, err
	}
	return entity.BackupGeneration{
		ID:           backupID,
		CreatedAt:    now,
		ContactCount: contactCount,
		Trigger:      trigger,
	}, nil
}

func (uc *BackupUseCase) reconfigureTicker() error {
	uc.mu.Lock()
	settings := normalizeBackupSettings(uc.settings)
	oldStop := uc.stopCh
	oldDone := uc.doneCh
	uc.stopCh = nil
	uc.doneCh = nil

	interval := settings.Timing.IntervalMinutes
	var newStop chan struct{}
	var newDone chan struct{}
	if interval > 0 {
		newStop = make(chan struct{})
		newDone = make(chan struct{})
		uc.stopCh = newStop
		uc.doneCh = newDone
	}
	uc.mu.Unlock()

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
				if _, err := uc.runManagedBackup(context.Background(), "interval"); err != nil {
					log.Printf("periodic backup failed: %v", err)
				}
			case <-stop:
				return
			}
		}
	}(interval, newStop, newDone)
	return nil
}

func (uc *BackupUseCase) stopTicker() {
	uc.mu.Lock()
	stop := uc.stopCh
	done := uc.doneCh
	uc.stopCh = nil
	uc.doneCh = nil
	uc.mu.Unlock()

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
