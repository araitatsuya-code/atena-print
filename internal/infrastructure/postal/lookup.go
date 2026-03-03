// Package postal provides postal code lookup backed by embedded JSON data.
package postal

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sync"

	"atena-label/internal/entity"
)

//go:embed postal.json
var postalJSON []byte

var (
	once       sync.Once
	db         map[string][3]string
	dbErr      error
	nonDigitRe = regexp.MustCompile(`\D`)
)

// Repo implements repository.PostalRepository using embedded JSON data.
type Repo struct{}

// NewRepo returns a new Repo.
func NewRepo() *Repo { return &Repo{} }

// Lookup returns the address for a 7-digit postal code (hyphens ignored).
// Returns an error if the code is not found or has an invalid format.
func (r *Repo) Lookup(postalCode string) (*entity.Address, error) {
	once.Do(func() {
		dbErr = json.Unmarshal(postalJSON, &db)
		if dbErr != nil {
			log.Printf("postal: failed to initialize postal data: %v", dbErr)
		}
	})
	if dbErr != nil {
		return nil, fmt.Errorf("postal: failed to load data: %w", dbErr)
	}

	code := nonDigitRe.ReplaceAllString(postalCode, "")
	if len(code) != 7 {
		return nil, fmt.Errorf("postal: invalid postal code %q (must be 7 digits)", postalCode)
	}

	entry, ok := db[code]
	if !ok {
		return nil, fmt.Errorf("postal: %q not found", code)
	}

	return &entity.Address{
		Prefecture: entry[0],
		City:       entry[1],
		Town:       entry[2],
	}, nil
}
