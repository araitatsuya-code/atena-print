package entity

type PrintJob struct {
	ContactIDs  []string    `json:"contactIds"`
	Template    Template    `json:"template"`
	SenderID    string      `json:"senderId"`
	LabelLayout LabelLayout `json:"labelLayout"`
	Watermark   *Watermark  `json:"watermark,omitempty"`
	QRConfig    *QRConfig   `json:"qrConfig,omitempty"`
	ShowBorder  bool        `json:"showBorder"` // ラベル枠線を描画するか
}
