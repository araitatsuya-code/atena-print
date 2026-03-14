package entity

type LabelLayout struct {
	PaperWidth  float64 `json:"paperWidth"`  // mm (A4: 210)
	PaperHeight float64 `json:"paperHeight"` // mm (A4: 297)
	LabelWidth  float64 `json:"labelWidth"`  // mm
	LabelHeight float64 `json:"labelHeight"` // mm
	Columns     int     `json:"columns"`
	Rows        int     `json:"rows"`
	MarginTop   float64 `json:"marginTop"`  // mm
	MarginLeft  float64 `json:"marginLeft"` // mm
	GapX        float64 `json:"gapX"`       // mm
	GapY        float64 `json:"gapY"`       // mm
	OffsetX     float64 `json:"offsetX"`    // mm 印刷位置補正
	OffsetY     float64 `json:"offsetY"`    // mm 印刷位置補正
}
