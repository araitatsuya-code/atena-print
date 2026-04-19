package repository

import "atena-label/internal/entity"

// ContactYearStatusRepository は連絡先の年次ステータスを永続化する。
type ContactYearStatusRepository interface {
	FindByYear(year int) ([]entity.ContactYearStatus, error)
	Upsert(status *entity.ContactYearStatus) error
	MarkSent(contactIDs []string, year int) error
}
