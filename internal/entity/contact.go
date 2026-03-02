package entity

import "time"

type Contact struct {
	ID             string    `json:"id"`
	FamilyName     string    `json:"familyName"`
	GivenName      string    `json:"givenName"`
	FamilyNameKana string    `json:"familyNameKana"`
	GivenNameKana  string    `json:"givenNameKana"`
	Honorific      string    `json:"honorific"`
	PostalCode     string    `json:"postalCode"`
	Prefecture     string    `json:"prefecture"`
	City           string    `json:"city"`
	Street         string    `json:"street"`
	Building       string    `json:"building"`
	Company        string    `json:"company"`
	Department     string    `json:"department"`
	Notes          string    `json:"notes"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
