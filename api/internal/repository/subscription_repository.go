package repository

import (
	"context"
	"time"

	"finward-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SubscriptionRepository interface {
	GetByUser(ctx context.Context, userID string) ([]domain.Subscription, error)
	UpsertForMerchant(ctx context.Context, userID, merchantRaw, paymentMethod string, amount float64, currency string, txDate time.Time) error
	Update(ctx context.Context, id, userID string, upd domain.SubscriptionUpdate) error
	Delete(ctx context.Context, id, userID string) error
}

type postgresSubscriptionRepository struct {
	db *pgxpool.Pool
}

func NewSubscriptionRepository(db *pgxpool.Pool) SubscriptionRepository {
	return &postgresSubscriptionRepository{db: db}
}

func (r *postgresSubscriptionRepository) GetByUser(ctx context.Context, userID string) ([]domain.Subscription, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			s.id,
			COALESCE(m.clean_name, m.raw_name) AS servicio,
			COALESCE(s.payment_method, '')      AS metodo_pago,
			s.estimated_amount,
			s.currency,
			s.frequency,
			s.start_date,
			s.end_date,
			s.next_billing_date
		FROM subscriptions s
		JOIN merchants m ON s.merchant_id = m.id
		WHERE s.user_id = $1
		  AND s.is_active = TRUE
		  AND s.deleted_at IS NULL
		ORDER BY s.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	const dateFmt = "2006-01-02"
	var result []domain.Subscription
	for rows.Next() {
		var sub domain.Subscription
		var startDate, nextPago *time.Time
		var endDate *time.Time

		if err := rows.Scan(
			&sub.ID, &sub.Servicio, &sub.MetodoPago,
			&sub.Monto, &sub.Divisa, &sub.Frecuencia,
			&startDate, &endDate, &nextPago,
		); err != nil {
			return nil, err
		}

		if startDate != nil {
			sub.FechaInicio = startDate.Format(dateFmt)
		}
		if endDate != nil {
			s := endDate.Format(dateFmt)
			sub.FechaFin = &s
		}
		if nextPago != nil {
			sub.ProximoPago = nextPago.Format(dateFmt)
		}

		result = append(result, sub)
	}
	if result == nil {
		result = []domain.Subscription{}
	}
	return result, nil
}

func (r *postgresSubscriptionRepository) UpsertForMerchant(ctx context.Context, userID, merchantRaw, paymentMethod string, amount float64, currency string, txDate time.Time) error {
	var merchantID string
	err := r.db.QueryRow(ctx,
		`SELECT id FROM merchants WHERE raw_name = $1 LIMIT 1`,
		merchantRaw,
	).Scan(&merchantID)
	if err != nil {
		return nil // merchant not in DB yet, skip
	}

	var existingID string
	err = r.db.QueryRow(ctx,
		`SELECT id FROM subscriptions WHERE user_id = $1 AND merchant_id = $2 AND deleted_at IS NULL LIMIT 1`,
		userID, merchantID,
	).Scan(&existingID)

	if err != nil {
		// Not found — create new subscription
		nextBilling := txDate.AddDate(0, 1, 0)
		_, err = r.db.Exec(ctx, `
			INSERT INTO subscriptions
				(user_id, merchant_id, estimated_amount, currency, frequency,
				 start_date, next_billing_date, payment_method, is_active)
			VALUES ($1, $2, $3, $4, 'monthly', $5, $6, $7, TRUE)`,
			userID, merchantID, amount, currency, txDate.UTC(), nextBilling.UTC(), paymentMethod,
		)
		return err
	}

	// Already exists — update amount and payment method
	_, err = r.db.Exec(ctx,
		`UPDATE subscriptions SET estimated_amount = $1, payment_method = $2, updated_at = NOW() WHERE id = $3`,
		amount, paymentMethod, existingID,
	)
	return err
}

func (r *postgresSubscriptionRepository) Update(ctx context.Context, id, userID string, upd domain.SubscriptionUpdate) error {
	if upd.EndDate != nil && *upd.EndDate != "" {
		_, err := r.db.Exec(ctx,
			`UPDATE subscriptions SET end_date = $1::date, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
			*upd.EndDate, id, userID,
		)
		if err != nil {
			return err
		}
	} else if upd.EndDate != nil && *upd.EndDate == "" {
		_, err := r.db.Exec(ctx,
			`UPDATE subscriptions SET end_date = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
			id, userID,
		)
		if err != nil {
			return err
		}
	}

	if upd.Amount != nil {
		_, err := r.db.Exec(ctx,
			`UPDATE subscriptions SET estimated_amount = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
			*upd.Amount, id, userID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresSubscriptionRepository) Delete(ctx context.Context, id, userID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE subscriptions SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}
