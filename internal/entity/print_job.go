package entity

type PrintJob struct {
	ContactIDs  []string    `json:"contactIds"`
	TemplateID  string      `json:"templateId"`
	SenderID    string      `json:"senderId"`
	LabelLayout LabelLayout `json:"labelLayout"`
	Watermark   *Watermark  `json:"watermark,omitempty"`
	QRConfig    *QRConfig   `json:"qrConfig,omitempty"`
}
