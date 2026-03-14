package usecase

import (
	"time"

	"github.com/google/uuid"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

// PrintHistoryUseCase は印刷ログの記録と取得を担う。
type PrintHistoryUseCase struct {
	repo repository.PrintHistoryRepository
}

func NewPrintHistoryUseCase(repo repository.PrintHistoryRepository) *PrintHistoryUseCase {
	return &PrintHistoryUseCase{repo: repo}
}

// Record は印刷ログを保存する。
func (uc *PrintHistoryUseCase) Record(contactCount int, templateID, watermarkID string, qrEnabled bool) error {
	h := entity.PrintHistory{
		ID:           uuid.NewString(),
		PrintedAt:    time.Now(),
		ContactCount: contactCount,
		TemplateID:   templateID,
		WatermarkID:  watermarkID,
		QREnabled:    qrEnabled,
	}
	return uc.repo.Save(h)
}

// GetRecent は最新 N 件の印刷ログを返す。
func (uc *PrintHistoryUseCase) GetRecent(limit int) ([]entity.PrintHistory, error) {
	return uc.repo.FindRecent(limit)
}
