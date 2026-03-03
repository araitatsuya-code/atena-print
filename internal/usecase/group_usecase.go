package usecase

import (
	"fmt"

	"github.com/google/uuid"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type GroupUseCase struct {
	repo repository.GroupRepository
}

func NewGroupUseCase(repo repository.GroupRepository) *GroupUseCase {
	return &GroupUseCase{repo: repo}
}

func (uc *GroupUseCase) List() ([]entity.Group, error) {
	return uc.repo.FindAll()
}

func (uc *GroupUseCase) Save(g entity.Group) (entity.Group, error) {
	if g.ID == "" {
		g.ID = uuid.New().String()
		if err := uc.repo.Create(&g); err != nil {
			return entity.Group{}, fmt.Errorf("create group: %w", err)
		}
	} else {
		if err := uc.repo.Update(&g); err != nil {
			return entity.Group{}, fmt.Errorf("update group: %w", err)
		}
	}
	return g, nil
}

func (uc *GroupUseCase) Delete(id string) error {
	return uc.repo.Delete(id)
}

func (uc *GroupUseCase) GetContactGroups(contactID string) ([]entity.Group, error) {
	return uc.repo.FindByContactID(contactID)
}

func (uc *GroupUseCase) AddContactToGroup(contactID, groupID string) error {
	return uc.repo.AddContact(contactID, groupID)
}

func (uc *GroupUseCase) RemoveContactFromGroup(contactID, groupID string) error {
	return uc.repo.RemoveContact(contactID, groupID)
}
