package repository

import "atena-label/internal/entity"

// PrintHistoryRepository は印刷ログの永続化インターフェース。
type PrintHistoryRepository interface {
	Save(h entity.PrintHistory) error
	FindRecent(limit int) ([]entity.PrintHistory, error)
}
