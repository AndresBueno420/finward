package domain

type Subscription struct {
	ID          string  `json:"id"`
	Servicio    string  `json:"servicio"`
	MetodoPago  string  `json:"metodo_pago"`
	Monto       float64 `json:"monto"`
	Divisa      string  `json:"divisa"`
	Frecuencia  string  `json:"frecuencia"`
	FechaInicio string  `json:"fecha_inicio"` // YYYY-MM-DD
	FechaFin    *string `json:"fecha_fin"`    // nullable
	ProximoPago string  `json:"proximo_pago"` // YYYY-MM-DD
}

type SubscriptionUpdate struct {
	EndDate *string  `json:"end_date"` // YYYY-MM-DD or ""
	Amount  *float64 `json:"amount"`
}
