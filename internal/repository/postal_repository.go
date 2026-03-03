package repository

import "atena-label/internal/entity"

type PostalRepository interface {
	Lookup(postalCode string) (*entity.Address, error)
}
