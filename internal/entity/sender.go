package entity

type Sender struct {
	ID         string `json:"id"`
	FamilyName string `json:"familyName"`
	GivenName  string `json:"givenName"`
	PostalCode string `json:"postalCode"`
	Prefecture string `json:"prefecture"`
	City       string `json:"city"`
	Street     string `json:"street"`
	Building   string `json:"building"`
	Company    string `json:"company"`
	IsDefault  bool   `json:"isDefault"`
}
