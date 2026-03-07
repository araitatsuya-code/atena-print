package repository

import "atena-label/internal/entity"

type WatermarkRepository interface {
	FindCustomAll() ([]entity.Watermark, error)
	Create(w *entity.Watermark) error
	Delete(id string) error
}
