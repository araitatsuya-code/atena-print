package usecase

import (
	"fmt"

	"github.com/google/uuid"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type SenderUseCase struct {
	repo repository.SenderRepository
}

func NewSenderUseCase(repo repository.SenderRepository) *SenderUseCase {
	return &SenderUseCase{repo: repo}
}

func (uc *SenderUseCase) List() ([]entity.Sender, error) {
	return uc.repo.FindAll()
}

func (uc *SenderUseCase) Save(s entity.Sender) (entity.Sender, error) {
	if s.ID == "" {
		s.ID = uuid.New().String()
		if err := uc.repo.Create(&s); err != nil {
			return entity.Sender{}, fmt.Errorf("create sender: %w", err)
		}
	} else {
		if err := uc.repo.Update(&s); err != nil {
			return entity.Sender{}, fmt.Errorf("update sender: %w", err)
		}
	}
	return s, nil
}

func (uc *SenderUseCase) Delete(id string) error {
	if id == "" {
		return fmt.Errorf("差出人IDは必須です")
	}
	return uc.repo.Delete(id)
}

func (uc *SenderUseCase) SetDefault(id string) error {
	s, err := uc.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("find sender: %w", err)
	}
	if s == nil {
		return fmt.Errorf("sender %s: not found", id)
	}
	s.IsDefault = true
	return uc.repo.Update(s)
}
