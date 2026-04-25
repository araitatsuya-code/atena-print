package entity

// UnsupportedCharacterWarning represents unsupported glyphs detected before printing.
type UnsupportedCharacterWarning struct {
	ContactID   string   `json:"contactId"`
	ContactName string   `json:"contactName"`
	Characters  []string `json:"characters"`
}
