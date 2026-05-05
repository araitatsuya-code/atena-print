package usecase

import (
	"strings"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type AddressNormalizationUseCase struct {
	postalRepo repository.PostalRepository
}

func NewAddressNormalizationUseCase(postalRepo repository.PostalRepository) *AddressNormalizationUseCase {
	return &AddressNormalizationUseCase{postalRepo: postalRepo}
}

func (uc *AddressNormalizationUseCase) BuildPreview(contacts []entity.Contact) entity.AddressNormalizationPreview {
	candidates := make([]entity.AddressNormalizationCandidate, 0)
	for _, contact := range contacts {
		candidate, ok := uc.buildCandidate(contact)
		if !ok {
			continue
		}
		candidates = append(candidates, candidate)
	}

	return entity.AddressNormalizationPreview{
		TotalContacts:    len(contacts),
		ConvertibleCount: len(candidates),
		Candidates:       candidates,
	}
}

func (uc *AddressNormalizationUseCase) buildCandidate(contact entity.Contact) (entity.AddressNormalizationCandidate, bool) {
	postal := strings.TrimSpace(contact.PostalCode)
	if postal == "" {
		return entity.AddressNormalizationCandidate{}, false
	}

	lookup, err := uc.postalRepo.Lookup(postal)
	if err != nil || lookup == nil {
		return entity.AddressNormalizationCandidate{}, false
	}

	before := entity.AddressNormalizationAddress{
		Prefecture: strings.TrimSpace(contact.Prefecture),
		City:       strings.TrimSpace(contact.City),
		Street:     strings.TrimSpace(contact.Street),
	}
	after := before

	if prefecture := strings.TrimSpace(lookup.Prefecture); prefecture != "" {
		after.Prefecture = prefecture
	}
	if city := strings.TrimSpace(lookup.City); city != "" {
		after.City = city
	}

	diffs := make([]entity.AddressNormalizationDiff, 0, 2)
	if before.Prefecture != after.Prefecture {
		diffs = append(diffs, entity.AddressNormalizationDiff{
			Field:  "prefecture",
			Before: before.Prefecture,
			After:  after.Prefecture,
		})
	}
	if before.City != after.City {
		diffs = append(diffs, entity.AddressNormalizationDiff{
			Field:  "city",
			Before: before.City,
			After:  after.City,
		})
	}

	if len(diffs) == 0 {
		return entity.AddressNormalizationCandidate{}, false
	}

	return entity.AddressNormalizationCandidate{
		ContactID:   contact.ID,
		DisplayName: buildDisplayName(contact),
		PostalCode:  postal,
		Before:      before,
		After:       after,
		Diffs:       diffs,
	}, true
}

func buildDisplayName(contact entity.Contact) string {
	fullName := strings.TrimSpace(strings.TrimSpace(contact.FamilyName) + " " + strings.TrimSpace(contact.GivenName))
	if fullName != "" {
		return fullName
	}
	return strings.TrimSpace(contact.Company)
}
