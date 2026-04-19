package sqlite

import (
	"database/sql"
	"fmt"
	"time"

	"atena-label/internal/entity"
)

type ContactYearStatusRepo struct {
	db *sql.DB
}

func NewContactYearStatusRepo(db *sql.DB) *ContactYearStatusRepo {
	return &ContactYearStatusRepo{db: db}
}

func (r *ContactYearStatusRepo) FindByYear(year int) ([]entity.ContactYearStatus, error) {
	rows, err := r.db.Query(
		`SELECT contact_id, year, sent, received, mourning, created_at, updated_at
		 FROM contact_year_statuses
		 WHERE year = ?
		 ORDER BY contact_id`, year,
	)
	if err != nil {
		return nil, fmt.Errorf("ContactYearStatusRepo.FindByYear: %w", err)
	}
	defer rows.Close()

	list := []entity.ContactYearStatus{}
	for rows.Next() {
		var (
			item         entity.ContactYearStatus
			createdAtRaw string
			updatedAtRaw string
		)
		if err := rows.Scan(
			&item.ContactID, &item.Year, &item.Sent, &item.Received, &item.Mourning, &createdAtRaw, &updatedAtRaw,
		); err != nil {
			return nil, fmt.Errorf("ContactYearStatusRepo.FindByYear scan: %w", err)
		}
		item.CreatedAt = parseSQLiteTime(createdAtRaw)
		item.UpdatedAt = parseSQLiteTime(updatedAtRaw)
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *ContactYearStatusRepo) Upsert(status *entity.ContactYearStatus) error {
	now := time.Now()
	if status.CreatedAt.IsZero() {
		status.CreatedAt = now
	}
	status.UpdatedAt = now

	_, err := r.db.Exec(
		`INSERT INTO contact_year_statuses
			(contact_id, year, sent, received, mourning, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(contact_id, year) DO UPDATE SET
			sent = excluded.sent,
			received = excluded.received,
			mourning = excluded.mourning,
			updated_at = excluded.updated_at`,
		status.ContactID,
		status.Year,
		status.Sent,
		status.Received,
		status.Mourning,
		status.CreatedAt.UTC().Format(time.RFC3339),
		status.UpdatedAt.UTC().Format(time.RFC3339),
	)
	if err != nil {
		return fmt.Errorf("ContactYearStatusRepo.Upsert: %w", err)
	}
	return nil
}

func (r *ContactYearStatusRepo) MarkSent(contactIDs []string, year int) error {
	if len(contactIDs) == 0 {
		return nil
	}
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("ContactYearStatusRepo.MarkSent begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	for _, contactID := range contactIDs {
		if _, err = tx.Exec(
			`INSERT INTO contact_year_statuses
				(contact_id, year, sent, received, mourning, created_at, updated_at)
			 VALUES (?, ?, 1, 0, 0, ?, ?)
			 ON CONFLICT(contact_id, year) DO UPDATE SET
				sent = 1,
				updated_at = excluded.updated_at`,
			contactID, year, now, now,
		); err != nil {
			return fmt.Errorf("ContactYearStatusRepo.MarkSent exec: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("ContactYearStatusRepo.MarkSent commit: %w", err)
	}
	return nil
}

func parseSQLiteTime(raw string) time.Time {
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02 15:04:05", raw); err == nil {
		return t
	}
	return time.Time{}
}
