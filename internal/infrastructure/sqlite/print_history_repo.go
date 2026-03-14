package sqlite

import (
	"database/sql"
	"fmt"
	"time"

	"atena-label/internal/entity"
)

type PrintHistoryRepo struct {
	db *sql.DB
}

func NewPrintHistoryRepo(db *sql.DB) *PrintHistoryRepo {
	return &PrintHistoryRepo{db: db}
}

func (r *PrintHistoryRepo) Save(h entity.PrintHistory) error {
	_, err := r.db.Exec(
		`INSERT INTO print_history (id, printed_at, contact_count, template_id, watermark_id, qr_enabled)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		h.ID, h.PrintedAt.UTC().Format(time.RFC3339), h.ContactCount, h.TemplateID, h.WatermarkID, h.QREnabled,
	)
	if err != nil {
		return fmt.Errorf("PrintHistoryRepo.Save: %w", err)
	}
	return nil
}

func (r *PrintHistoryRepo) FindRecent(limit int) ([]entity.PrintHistory, error) {
	rows, err := r.db.Query(
		`SELECT id, printed_at, contact_count, COALESCE(template_id,''), COALESCE(watermark_id,''), qr_enabled
		 FROM print_history ORDER BY printed_at DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("PrintHistoryRepo.FindRecent: %w", err)
	}
	defer rows.Close()

	var list []entity.PrintHistory
	for rows.Next() {
		var h entity.PrintHistory
		var printedAt string
		if err := rows.Scan(&h.ID, &printedAt, &h.ContactCount, &h.TemplateID, &h.WatermarkID, &h.QREnabled); err != nil {
			return nil, fmt.Errorf("PrintHistoryRepo.FindRecent scan: %w", err)
		}
		t, err := time.Parse(time.RFC3339, printedAt)
		if err != nil {
			// CURRENT_TIMESTAMP は "2006-01-02 15:04:05" 形式
			t, _ = time.Parse("2006-01-02 15:04:05", printedAt)
		}
		h.PrintedAt = t
		list = append(list, h)
	}
	return list, rows.Err()
}
