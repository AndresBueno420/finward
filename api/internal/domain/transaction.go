package domain

import "time"

type ProcessNotificationRequest struct {
	Title       string `json:"title"`
	Text        string `json:"text"`
	PackageName string `json:"package_name"`
	Timestamp   int64  `json:"timestamp"`
}

type NewTransaction struct {
	UserID              string
	MerchantRaw         string
	MerchantClean       string
	CategoryName        string
	Amount              float64
	Currency            string
	Date                time.Time
	RawNotificationText string
	IsSubscription      bool
}
