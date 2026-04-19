package entity

// CSVImportField describes one internal contact field that can be mapped from CSV columns.
type CSVImportField struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Required bool   `json:"required"`
}

// CSVImportPlan is the first-step payload for the CSV import wizard.
type CSVImportPlan struct {
	Headers          []string         `json:"headers"`
	SampleRows       [][]string       `json:"sampleRows"`
	SuggestedMapping map[string]int   `json:"suggestedMapping"`
	FieldDefinitions []CSVImportField `json:"fieldDefinitions"`
	RowCount         int              `json:"rowCount"`
	DuplicateRule    string           `json:"duplicateRule"`
}

// CSVContactSnapshot is a compact view used in duplicate resolution screens.
type CSVContactSnapshot struct {
	ID          string `json:"id,omitempty"`
	DisplayName string `json:"displayName"`
	PostalCode  string `json:"postalCode"`
	Prefecture  string `json:"prefecture"`
	City        string `json:"city"`
	Street      string `json:"street"`
	Company     string `json:"company"`
}

// CSVDuplicateCandidate represents one incoming row that matches an existing contact.
type CSVDuplicateCandidate struct {
	RowNumber       int                `json:"rowNumber"`
	Incoming        CSVContactSnapshot `json:"incoming"`
	Existing        CSVContactSnapshot `json:"existing"`
	SuggestedAction string             `json:"suggestedAction"`
}

// CSVImportAnalysis is the second-step payload for duplicate review.
type CSVImportAnalysis struct {
	DuplicateRule string                  `json:"duplicateRule"`
	ValidRowCount int                     `json:"validRowCount"`
	Errors        []string                `json:"errors"`
	Duplicates    []CSVDuplicateCandidate `json:"duplicates"`
}

// CSVDuplicateResolution stores user's action for one duplicate row.
type CSVDuplicateResolution struct {
	RowNumber int    `json:"rowNumber"`
	Action    string `json:"action"`
}

// CSVImportExecutionResult is the final summary returned after import execution.
type CSVImportExecutionResult struct {
	TotalRows         int      `json:"totalRows"`
	Created           int      `json:"created"`
	Updated           int      `json:"updated"`
	Skipped           int      `json:"skipped"`
	DuplicateResolved int      `json:"duplicateResolved"`
	Errors            []string `json:"errors"`
}
