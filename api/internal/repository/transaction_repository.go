package repository

import (
	"context"
	"time"

	"finward-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TransactionRepository interface {
	GetMonthlySummary(ctx context.Context, userID string, month time.Time) (*domain.SummaryResponse, error)
}

type postgresTransactionRepository struct {
	db *pgxpool.Pool
}

func NewTransactionRepository(db *pgxpool.Pool) TransactionRepository {
	return &postgresTransactionRepository{db: db}
}

func (r *postgresTransactionRepository) GetMonthlySummary(ctx context.Context, userID string, month time.Time) (*domain.SummaryResponse, error) {
	categoryQuery := `
		SELECT c.name, c.type, COUNT(t.id), COALESCE(SUM(t.amount), 0)
		FROM transactions t
		JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
		  AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', $2::timestamptz)
		  AND t.deleted_at IS NULL
		  AND t.status = 'processed'
		GROUP BY c.name, c.type
		ORDER BY SUM(t.amount) DESC
	`

	rows, err := r.db.Query(ctx, categoryQuery, userID, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var totalGastos, totalIngresos float64
	var categories []domain.CategorySummary

	for rows.Next() {
		var cat domain.CategorySummary
		if err := rows.Scan(&cat.Nombre, &cat.Tipo, &cat.Count, &cat.Total); err != nil {
			return nil, err
		}
		if cat.Tipo == "ingreso" {
			totalIngresos += cat.Total
		} else {
			totalGastos += cat.Total
		}
		categories = append(categories, cat)
	}

	for i := range categories {
		base := totalGastos
		if categories[i].Tipo == "ingreso" {
			base = totalIngresos
		}
		if base > 0 {
			categories[i].Porcentaje = categories[i].Total / base * 100
		}
	}

	txQuery := `
		SELECT
			t.id, t.amount, t.currency, t.date,
			COALESCE(m.clean_name, m.raw_name, 'Desconocido') AS comercio,
			COALESCE(c.name, 'Otros')  AS categoria,
			COALESCE(c.type, 'gasto')  AS tipo
		FROM transactions t
		LEFT JOIN merchants m  ON t.merchant_id  = m.id
		LEFT JOIN categories c ON t.category_id  = c.id
		WHERE t.user_id = $1
		  AND t.deleted_at IS NULL
		  AND t.status = 'processed'
		ORDER BY t.date DESC
		LIMIT 20
	`

	txRows, err := r.db.Query(ctx, txQuery, userID)
	if err != nil {
		return nil, err
	}
	defer txRows.Close()

	var transactions []domain.TransactionItem
	for txRows.Next() {
		var tx domain.TransactionItem
		if err := txRows.Scan(&tx.ID, &tx.Monto, &tx.Divisa, &tx.Fecha, &tx.Comercio, &tx.Categoria, &tx.Tipo); err != nil {
			return nil, err
		}
		transactions = append(transactions, tx)
	}

	if categories == nil {
		categories = []domain.CategorySummary{}
	}
	if transactions == nil {
		transactions = []domain.TransactionItem{}
	}

	return &domain.SummaryResponse{
		TotalGastos:   totalGastos,
		TotalIngresos: totalIngresos,
		PorCategoria:  categories,
		Transacciones: transactions,
	}, nil
}
