package entity

// ImportResult holds the result of a CSV import operation.
type ImportResult struct {
	Total    int      `json:"total"`
	Imported int      `json:"imported"`
	Errors   []string `json:"errors"`
}
