package usecase

import (
	"fmt"

	"github.com/google/uuid"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type ContactUseCase struct {
	repo repository.ContactRepository
}

func NewContactUseCase(repo repository.ContactRepository) *ContactUseCase {
	return &ContactUseCase{repo: repo}
}

func (uc *ContactUseCase) List(groupID string) ([]entity.Contact, error) {
	return uc.repo.FindAll(groupID)
}

func (uc *ContactUseCase) Get(id string) (*entity.Contact, error) {
	return uc.repo.FindByID(id)
}

func (uc *ContactUseCase) Save(c entity.Contact) (entity.Contact, error) {
	if c.ID == "" {
		c.ID = uuid.New().String()
		if err := uc.repo.Create(&c); err != nil {
			return entity.Contact{}, fmt.Errorf("create contact: %w", err)
		}
	} else {
		if err := uc.repo.Update(&c); err != nil {
			return entity.Contact{}, fmt.Errorf("update contact: %w", err)
		}
	}
	return c, nil
}

func (uc *ContactUseCase) Delete(id string) error {
	return uc.repo.Delete(id)
}

func (uc *ContactUseCase) Search(query string) ([]entity.Contact, error) {
	return uc.repo.Search(query)
}
