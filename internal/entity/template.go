package entity

type Template struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Orientation string        `json:"orientation"` // "vertical" | "horizontal"
	LabelWidth  float64       `json:"labelWidth"`  // mm
	LabelHeight float64       `json:"labelHeight"` // mm
	PostalCode  *PostalConfig `json:"postalCode,omitempty"`
	Recipient   TextConfig    `json:"recipient"`
	Sender      TextConfig    `json:"sender"`
}

type PostalConfig struct {
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	DigitSpacing float64 `json:"digitSpacing"`
	FontSize     float64 `json:"fontSize"`
	FontFamily   string  `json:"fontFamily,omitempty"` // "serif" | "sans-serif"
	Bold         bool    `json:"bold,omitempty"`
}

type TextConfig struct {
	NameX             float64 `json:"nameX"`
	NameY             float64 `json:"nameY"`
	NameFont          float64 `json:"nameFont"`
	NameFontFamily    string  `json:"nameFontFamily,omitempty"` // "serif" | "sans-serif"
	NameBold          bool    `json:"nameBold,omitempty"`
	AddressX          float64 `json:"addressX"`
	AddressY          float64 `json:"addressY"`
	AddressFont       float64 `json:"addressFont"`
	AddressFontFamily string  `json:"addressFontFamily,omitempty"` // "serif" | "sans-serif"
	AddressBold       bool    `json:"addressBold,omitempty"`
}
