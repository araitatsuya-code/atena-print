package entity

// AddressNormalizationAddress is a compact address view for before/after comparison.
type AddressNormalizationAddress struct {
	Prefecture string `json:"prefecture"`
	City       string `json:"city"`
	Street     string `json:"street"`
}

// AddressNormalizationDiff represents one changed field in normalization preview.
type AddressNormalizationDiff struct {
	Field  string `json:"field"`
	Before string `json:"before"`
	After  string `json:"after"`
}

// AddressNormalizationCandidate is one contact that can be normalized.
type AddressNormalizationCandidate struct {
	ContactID   string                      `json:"contactId"`
	DisplayName string                      `json:"displayName"`
	PostalCode  string                      `json:"postalCode"`
	Before      AddressNormalizationAddress `json:"before"`
	After       AddressNormalizationAddress `json:"after"`
	Diffs       []AddressNormalizationDiff  `json:"diffs"`
}

// AddressNormalizationPreview contains candidates and rollback status.
type AddressNormalizationPreview struct {
	TotalContacts    int                             `json:"totalContacts"`
	ConvertibleCount int                             `json:"convertibleCount"`
	Candidates       []AddressNormalizationCandidate `json:"candidates"`
	CanRollback      bool                            `json:"canRollback"`
	RollbackBatchID  string                          `json:"rollbackBatchId,omitempty"`
}

// AddressNormalizationSelection stores whether each candidate should be applied.
type AddressNormalizationSelection struct {
	ContactID string `json:"contactId"`
	Apply     bool   `json:"apply"`
}

// AddressNormalizationApplyResult is the summary of normalization execution.
type AddressNormalizationApplyResult struct {
	BatchID      string   `json:"batchId,omitempty"`
	AppliedCount int      `json:"appliedCount"`
	SkippedCount int      `json:"skippedCount"`
	FailedCount  int      `json:"failedCount"`
	Errors       []string `json:"errors"`
	CanRollback  bool     `json:"canRollback"`
}

// AddressNormalizationRollbackResult is the summary of rollback execution.
type AddressNormalizationRollbackResult struct {
	BatchID       string   `json:"batchId,omitempty"`
	RestoredCount int      `json:"restoredCount"`
	FailedCount   int      `json:"failedCount"`
	Errors        []string `json:"errors"`
}
