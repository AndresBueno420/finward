package domain

import (
	"time"
)

type User struct {
	ID                string    `json:"id"`
	Email             string    `json:"email"`
	PasswordHash      string    `json:"-"` // El "-" evita que el hash se envíe accidentalmente en un JSON
	PreferredCurrency string    `json:"preferred_currency"`
	Timezone          string    `json:"timezone"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
