package usecase

import (
	"fmt"
	"strings"

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
	if strings.TrimSpace(g.Name) == "" {
		return entity.Group{}, fmt.Errorf("グループ名は必須です")
	}
	g.Name = strings.TrimSpace(g.Name)

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
	if id == "" {
		return fmt.Errorf("グループIDは必須です")
	}
	if err := uc.repo.Delete(id); err != nil {
		return fmt.Errorf("delete group: %w", err)
	}
	return nil
}

func (uc *GroupUseCase) GetContactGroups(contactID string) ([]entity.Group, error) {
	if contactID == "" {
		return nil, fmt.Errorf("連絡先IDは必須です")
	}
	groups, err := uc.repo.FindByContactID(contactID)
	if err != nil {
		return nil, fmt.Errorf("find groups for contact: %w", err)
	}
	return groups, nil
}

func (uc *GroupUseCase) SetContactGroups(contactID string, groupIDs []string) error {
	if contactID == "" {
		return fmt.Errorf("連絡先IDは必須です")
	}
	if err := uc.repo.SetContactGroups(contactID, groupIDs); err != nil {
		return fmt.Errorf("set contact groups: %w", err)
	}
	return nil
}

func (uc *GroupUseCase) AddContactToGroup(contactID, groupID string) error {
	if contactID == "" || groupID == "" {
		return fmt.Errorf("連絡先IDとグループIDは必須です")
	}
	if err := uc.repo.AddContact(contactID, groupID); err != nil {
		return fmt.Errorf("add contact to group: %w", err)
	}
	return nil
}

func (uc *GroupUseCase) RemoveContactFromGroup(contactID, groupID string) error {
	if contactID == "" || groupID == "" {
		return fmt.Errorf("連絡先IDとグループIDは必須です")
	}
	if err := uc.repo.RemoveContact(contactID, groupID); err != nil {
		return fmt.Errorf("remove contact from group: %w", err)
	}
	return nil
}
