package repository

import (
	"context"
	"time"

	"finward-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TransactionRepository interface {
	GetMonthlySummary(ctx context.Context, userID string, month time.Time) (*domain.SummaryResponse, error)
	SaveTransaction(ctx context.Context, tx domain.NewTransaction) error
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
			COALESCE(c.type, 'gasto')  AS tipo,
			COALESCE(t.bank, '')       AS banco
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
		if err := txRows.Scan(&tx.ID, &tx.Monto, &tx.Divisa, &tx.Fecha, &tx.Comercio, &tx.Categoria, &tx.Tipo, &tx.Banco); err != nil {
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

func (r *postgresTransactionRepository) SaveTransaction(ctx context.Context, tx domain.NewTransaction) error {
	var merchantID *string
	var mid string
	err := r.db.QueryRow(ctx,
		`SELECT id FROM merchants WHERE raw_name = $1 LIMIT 1`,
		tx.MerchantRaw,
	).Scan(&mid)
	if err != nil {
		if err := r.db.QueryRow(ctx,
			`INSERT INTO merchants (raw_name, clean_name) VALUES ($1, $2) RETURNING id`,
			tx.MerchantRaw, tx.MerchantClean,
		).Scan(&mid); err != nil {
			return err
		}
	}
	merchantID = &mid

	var categoryID *string
	var cid string
	if err := r.db.QueryRow(ctx,
		`SELECT id FROM categories WHERE name = $1 LIMIT 1`,
		tx.CategoryName,
	).Scan(&cid); err == nil {
		categoryID = &cid
	}

	_, err = r.db.Exec(ctx,
		`INSERT INTO transactions
			(user_id, merchant_id, category_id, amount, currency, date, raw_notification_text, status, is_subscription, bank)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'processed', $8, $9)`,
		tx.UserID, merchantID, categoryID,
		tx.Amount, tx.Currency, tx.Date,
		tx.RawNotificationText, tx.IsSubscription, tx.Bank,
	)
	return err
}
