package entity

import "time"

// PrintHistory は印刷ログ1件を表す。
type PrintHistory struct {
	ID           string    `json:"id"`
	PrintedAt    time.Time `json:"printedAt"`
	ContactCount int       `json:"contactCount"`
	TemplateID   string    `json:"templateId"`
	WatermarkID  string    `json:"watermarkId"`
	QREnabled    bool      `json:"qrEnabled"`
}

// DashboardStats はダッシュボード表示用の集計値。
type DashboardStats struct {
	ContactCount int `json:"contactCount"`
	GroupCount   int `json:"groupCount"`
}
