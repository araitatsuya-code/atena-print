package entity

type Watermark struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Type     string  `json:"type"`    // "preset" | "custom"
	FilePath string  `json:"filePath"`
	Opacity  float64 `json:"opacity"` // 0.0 - 1.0
}
