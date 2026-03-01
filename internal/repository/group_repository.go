package repository

import "atena-label/internal/entity"

type GroupRepository interface {
	FindAll() ([]entity.Group, error)
	FindByID(id string) (*entity.Group, error)
	Create(g *entity.Group) error
	Update(g *entity.Group) error
	Delete(id string) error
	AddContact(contactID, groupID string) error
	RemoveContact(contactID, groupID string) error
}
