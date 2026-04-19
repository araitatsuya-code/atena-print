package entity

import "time"

// ContactYearStatus は連絡先ごとの年次ステータスを表す。
type ContactYearStatus struct {
	ContactID string    `json:"contactId"`
	Year      int       `json:"year"`
	Sent      bool      `json:"sent"`
	Received  bool      `json:"received"`
	Mourning  bool      `json:"mourning"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
