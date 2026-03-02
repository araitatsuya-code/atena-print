package repository

import "atena-label/internal/entity"

type SenderRepository interface {
	FindAll() ([]entity.Sender, error)
	FindByID(id string) (*entity.Sender, error)
	Create(s *entity.Sender) error
	Update(s *entity.Sender) error
	Delete(id string) error
}
