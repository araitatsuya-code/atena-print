package sqlite

import (
	"database/sql"
	"fmt"

	"atena-label/internal/entity"
)

type WatermarkRepo struct {
	db *sql.DB
}

func NewWatermarkRepo(db *sql.DB) *WatermarkRepo {
	return &WatermarkRepo{db: db}
}

func (r *WatermarkRepo) FindCustomAll() ([]entity.Watermark, error) {
	rows, err := r.db.Query(`SELECT id, name, file_path FROM custom_watermarks ORDER BY created_at`)
	if err != nil {
		return nil, fmt.Errorf("FindCustomAll: %w", err)
	}
	defer rows.Close()

	var watermarks []entity.Watermark
	for rows.Next() {
		var w entity.Watermark
		if err := rows.Scan(&w.ID, &w.Name, &w.FilePath); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		w.Type = "custom"
		w.Opacity = 1.0
		watermarks = append(watermarks, w)
	}
	return watermarks, rows.Err()
}

func (r *WatermarkRepo) Create(w *entity.Watermark) error {
	_, err := r.db.Exec(
		`INSERT INTO custom_watermarks (id, name, file_path) VALUES (?, ?, ?)`,
		w.ID, w.Name, w.FilePath,
	)
	if err != nil {
		return fmt.Errorf("Create: %w", err)
	}
	return nil
}

func (r *WatermarkRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM custom_watermarks WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("Delete: %w", err)
	}
	return nil
}
