package entity

import "time"

// BackupTimingSettings defines automatic backup triggers.
type BackupTimingSettings struct {
	OnStartup       bool `json:"onStartup"`
	OnShutdown      bool `json:"onShutdown"`
	IntervalMinutes int  `json:"intervalMinutes"`
}

// BackupSettings defines configurable backup behavior.
type BackupSettings struct {
	Timing         BackupTimingSettings `json:"timing"`
	MaxGenerations int                  `json:"maxGenerations"`
}

// BackupGeneration is one restorable backup snapshot.
type BackupGeneration struct {
	ID           string    `json:"id"`
	CreatedAt    time.Time `json:"createdAt"`
	ContactCount int       `json:"contactCount"`
	Trigger      string    `json:"trigger"`
}

// RestoreBackupResult summarizes restore execution.
type RestoreBackupResult struct {
	Restored          bool   `json:"restored"`
	BackupID          string `json:"backupId"`
	PreservedBackupID string `json:"preservedBackupId"`
	RestartRequired   bool   `json:"restartRequired"`
}
