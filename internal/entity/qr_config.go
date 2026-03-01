package entity

type QRConfig struct {
	Enabled  bool   `json:"enabled"`
	Content  string `json:"content"`  // URL or text
	Size     int    `json:"size"`     // px (20-80)
	Position string `json:"position"` // "top-left", "top-right", "bottom-left", "bottom-right"
}
