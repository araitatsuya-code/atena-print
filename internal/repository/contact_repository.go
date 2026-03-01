package repository

import "atena-label/internal/entity"

type ContactRepository interface {
	FindAll(groupID string) ([]entity.Contact, error)
	FindByID(id string) (*entity.Contact, error)
	Create(c *entity.Contact) error
	Update(c *entity.Contact) error
	Delete(id string) error
	Search(query string) ([]entity.Contact, error)
}
