package usecase

import (
	"fmt"

	"atena-label/internal/entity"
	csvinfra "atena-label/internal/infrastructure/csv"
	"atena-label/internal/repository"
)

type CSVUseCase struct {
	repo repository.ContactRepository
}

func NewCSVUseCase(repo repository.ContactRepository) *CSVUseCase {
	return &CSVUseCase{repo: repo}
}

// Import reads a CSV file and saves each row as a new contact.
func (uc *CSVUseCase) Import(filePath string) (entity.ImportResult, error) {
	contacts, rowErrors := csvinfra.Import(filePath)

	result := entity.ImportResult{
		Total:  len(contacts) + len(rowErrors),
		Errors: rowErrors,
	}

	if len(rowErrors) > 0 && len(contacts) == 0 {
		return result, fmt.Errorf("CSVのインポートに失敗しました")
	}

	for i := range contacts {
		if err := uc.repo.Create(&contacts[i]); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("保存に失敗しました: %v", err))
			continue
		}
		result.Imported++
	}

	return result, nil
}

// Export writes the given contacts (or all if ids is empty) to a CSV file.
func (uc *CSVUseCase) Export(ids []string, filePath string) error {
	var contacts []entity.Contact

	if len(ids) == 0 {
		cs, err := uc.repo.FindAll("")
		if err != nil {
			return fmt.Errorf("連絡先の取得に失敗しました: %w", err)
		}
		contacts = cs
	} else {
		for _, id := range ids {
			c, err := uc.repo.FindByID(id)
			if err != nil {
				return fmt.Errorf("連絡先の取得に失敗しました (id=%s): %w", id, err)
			}
			if c != nil {
				contacts = append(contacts, *c)
			}
		}
	}

	return csvinfra.Export(contacts, filePath)
}
