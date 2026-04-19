package usecase

import (
	"fmt"
	"time"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type ContactYearStatusUseCase struct {
	repo repository.ContactYearStatusRepository
}

func NewContactYearStatusUseCase(repo repository.ContactYearStatusRepository) *ContactYearStatusUseCase {
	return &ContactYearStatusUseCase{repo: repo}
}

func (uc *ContactYearStatusUseCase) ListByYear(year int) ([]entity.ContactYearStatus, error) {
	validYear, err := normalizeYear(year)
	if err != nil {
		return nil, err
	}
	return uc.repo.FindByYear(validYear)
}

func (uc *ContactYearStatusUseCase) Save(status entity.ContactYearStatus) (entity.ContactYearStatus, error) {
	validYear, err := normalizeYear(status.Year)
	if err != nil {
		return entity.ContactYearStatus{}, err
	}
	if status.ContactID == "" {
		return entity.ContactYearStatus{}, fmt.Errorf("contactId is required")
	}
	status.Year = validYear
	if err := uc.repo.Upsert(&status); err != nil {
		return entity.ContactYearStatus{}, fmt.Errorf("save contact year status: %w", err)
	}
	return status, nil
}

func (uc *ContactYearStatusUseCase) MarkSent(contactIDs []string, year int) error {
	validYear, err := normalizeYear(year)
	if err != nil {
		return err
	}
	if err := uc.repo.MarkSent(contactIDs, validYear); err != nil {
		return fmt.Errorf("mark sent: %w", err)
	}
	return nil
}

func normalizeYear(year int) (int, error) {
	if year == 0 {
		return time.Now().Year(), nil
	}
	if year < 1900 || year > 3000 {
		return 0, fmt.Errorf("year out of range: %d", year)
	}
	return year, nil
}
