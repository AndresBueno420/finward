package domain

import "time"

type CategorySummary struct {
	Nombre     string  `json:"nombre"`
	Tipo       string  `json:"tipo"`
	Total      float64 `json:"total"`
	Count      int     `json:"count"`
	Porcentaje float64 `json:"porcentaje"`
}

type TransactionItem struct {
	ID        string    `json:"id"`
	Comercio  string    `json:"comercio"`
	Categoria string    `json:"categoria"`
	Tipo      string    `json:"tipo"`
	Monto     float64   `json:"monto"`
	Divisa    string    `json:"divisa"`
	Fecha     time.Time `json:"fecha"`
}

type SummaryResponse struct {
	Mes           string            `json:"mes"`
	TotalGastos   float64           `json:"total_gastos"`
	TotalIngresos float64           `json:"total_ingresos"`
	PorCategoria  []CategorySummary `json:"por_categoria"`
	Transacciones []TransactionItem `json:"transacciones"`
}
