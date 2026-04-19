package usecase

import (
	"os"
	"path/filepath"
	"testing"

	"atena-label/internal/entity"
)

type mockCSVUseCaseRepo struct {
	findAllFn  func(groupID string) ([]entity.Contact, error)
	findByIDFn func(id string) (*entity.Contact, error)
	createFn   func(c *entity.Contact) error
	updateFn   func(c *entity.Contact) error
	deleteFn   func(id string) error
	searchFn   func(query string) ([]entity.Contact, error)
}

func (m *mockCSVUseCaseRepo) FindAll(groupID string) ([]entity.Contact, error) {
	if m.findAllFn != nil {
		return m.findAllFn(groupID)
	}
	return []entity.Contact{}, nil
}

func (m *mockCSVUseCaseRepo) FindByID(id string) (*entity.Contact, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(id)
	}
	return nil, nil
}

func (m *mockCSVUseCaseRepo) Create(c *entity.Contact) error {
	if m.createFn != nil {
		return m.createFn(c)
	}
	return nil
}

func (m *mockCSVUseCaseRepo) Update(c *entity.Contact) error {
	if m.updateFn != nil {
		return m.updateFn(c)
	}
	return nil
}

func (m *mockCSVUseCaseRepo) Delete(id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

func (m *mockCSVUseCaseRepo) Search(query string) ([]entity.Contact, error) {
	if m.searchFn != nil {
		return m.searchFn(query)
	}
	return []entity.Contact{}, nil
}

type noopCSVPort struct{}

func (p *noopCSVPort) Import(filePath string) ([]entity.Contact, []string)     { return nil, nil }
func (p *noopCSVPort) Export(contacts []entity.Contact, filePath string) error { return nil }

func TestCSVUseCase_ImportWithOptions_OverwritePreservesUnmappedFields(t *testing.T) {
	csvPath := writeCSVFixture(t,
		"姓,名,敬称,郵便番号\n"+
			"山田,太郎,殿,1234567\n",
	)

	existing := entity.Contact{
		ID:            "existing-1",
		FamilyName:    "山田",
		GivenName:     "太郎",
		Honorific:     "様",
		PostalCode:    "1234567",
		Company:       "旧会社",
		Department:    "旧部署",
		Building:      "旧ビル",
		Notes:         "旧メモ",
		IsPrintTarget: true,
	}

	var updated entity.Contact
	createCalls := 0
	updateCalls := 0

	uc := NewCSVUseCase(&mockCSVUseCaseRepo{
		findAllFn: func(groupID string) ([]entity.Contact, error) {
			return []entity.Contact{existing}, nil
		},
		createFn: func(c *entity.Contact) error {
			createCalls++
			return nil
		},
		updateFn: func(c *entity.Contact) error {
			updateCalls++
			updated = *c
			return nil
		},
	}, &noopCSVPort{})

	mapping := map[string]int{
		"familyName":     0,
		"givenName":      1,
		"honorific":      2,
		"postalCode":     3,
		"familyNameKana": -1,
		"givenNameKana":  -1,
		"prefecture":     -1,
		"city":           -1,
		"street":         -1,
		"building":       -1,
		"company":        -1,
		"department":     -1,
		"notes":          -1,
		"isPrintTarget":  -1,
	}

	result, err := uc.ImportWithOptions(csvPath, mapping, []entity.CSVDuplicateResolution{{
		RowNumber: 2,
		Action:    "overwrite",
	}})
	if err != nil {
		t.Fatalf("ImportWithOptions error: %v", err)
	}
	if createCalls != 0 {
		t.Fatalf("Create should not be called on overwrite, got %d", createCalls)
	}
	if updateCalls != 1 {
		t.Fatalf("Update should be called once, got %d", updateCalls)
	}
	if updated.ID != existing.ID {
		t.Fatalf("updated ID = %s, want %s", updated.ID, existing.ID)
	}
	if updated.Honorific != "殿" {
		t.Fatalf("Honorific = %q, want 殿", updated.Honorific)
	}
	if updated.Company != existing.Company || updated.Department != existing.Department || updated.Building != existing.Building || updated.Notes != existing.Notes {
		t.Fatalf("unmapped fields were changed unexpectedly: %+v", updated)
	}
	if result.Updated != 1 || result.Created != 0 || result.DuplicateResolved != 1 || result.TotalRows != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if len(result.Errors) != 0 {
		t.Fatalf("unexpected errors: %v", result.Errors)
	}
}

func TestCSVUseCase_ImportWithOptions_DuplicateByPostalHyphenNormalization(t *testing.T) {
	csvPath := writeCSVFixture(t,
		"姓,名,郵便番号\n"+
			"山田,太郎,1234567\n",
	)

	existing := entity.Contact{
		ID:         "existing-2",
		FamilyName: "山田",
		GivenName:  "太郎",
		PostalCode: "123-4567",
	}

	createCalls := 0
	updateCalls := 0

	uc := NewCSVUseCase(&mockCSVUseCaseRepo{
		findAllFn: func(groupID string) ([]entity.Contact, error) {
			return []entity.Contact{existing}, nil
		},
		createFn: func(c *entity.Contact) error {
			createCalls++
			return nil
		},
		updateFn: func(c *entity.Contact) error {
			updateCalls++
			return nil
		},
	}, &noopCSVPort{})

	mapping := map[string]int{
		"familyName":     0,
		"givenName":      1,
		"postalCode":     2,
		"familyNameKana": -1,
		"givenNameKana":  -1,
		"honorific":      -1,
		"prefecture":     -1,
		"city":           -1,
		"street":         -1,
		"building":       -1,
		"company":        -1,
		"department":     -1,
		"notes":          -1,
		"isPrintTarget":  -1,
	}

	result, err := uc.ImportWithOptions(csvPath, mapping, []entity.CSVDuplicateResolution{{
		RowNumber: 2,
		Action:    "overwrite",
	}})
	if err != nil {
		t.Fatalf("ImportWithOptions error: %v", err)
	}
	if createCalls != 0 {
		t.Fatalf("Create should not be called when duplicate matches, got %d", createCalls)
	}
	if updateCalls != 1 {
		t.Fatalf("Update should be called once, got %d", updateCalls)
	}
	if result.DuplicateResolved != 1 || result.Updated != 1 || result.Created != 0 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestCSVUseCase_ImportWithOptions_TotalRowsIncludesParseErrors(t *testing.T) {
	csvPath := writeCSVFixture(t,
		"姓,名,郵便番号\n"+
			"山田,太郎,1234567\n"+
			"佐藤,花子,12-3456\n",
	)

	createCalls := 0

	uc := NewCSVUseCase(&mockCSVUseCaseRepo{
		findAllFn: func(groupID string) ([]entity.Contact, error) {
			return []entity.Contact{}, nil
		},
		createFn: func(c *entity.Contact) error {
			createCalls++
			return nil
		},
	}, &noopCSVPort{})

	mapping := map[string]int{
		"familyName":     0,
		"givenName":      1,
		"postalCode":     2,
		"familyNameKana": -1,
		"givenNameKana":  -1,
		"honorific":      -1,
		"prefecture":     -1,
		"city":           -1,
		"street":         -1,
		"building":       -1,
		"company":        -1,
		"department":     -1,
		"notes":          -1,
		"isPrintTarget":  -1,
	}

	result, err := uc.ImportWithOptions(csvPath, mapping, nil)
	if err != nil {
		t.Fatalf("ImportWithOptions error: %v", err)
	}
	if createCalls != 1 {
		t.Fatalf("Create should be called once for valid row, got %d", createCalls)
	}
	if result.TotalRows != 2 {
		t.Fatalf("TotalRows = %d, want 2", result.TotalRows)
	}
	if result.Created != 1 {
		t.Fatalf("Created = %d, want 1", result.Created)
	}
	if len(result.Errors) != 1 {
		t.Fatalf("Errors len = %d, want 1", len(result.Errors))
	}
}

func writeCSVFixture(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "fixture.csv")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	return path
}
