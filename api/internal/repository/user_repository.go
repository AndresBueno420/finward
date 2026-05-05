package repository

import (
	"context"

	"finward-backend/internal/domain" // IMPORTANTE: Cambia "tu-modulo" por el nombre de tu proyecto en el archivo go.mod

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository define los métodos que cualquier base de datos debe cumplir para manejar usuarios.
type UserRepository interface {
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
}

// postgresUserRepository es la implementación específica para PostgreSQL usando pgxpool.
type postgresUserRepository struct {
	db *pgxpool.Pool
}

// NewUserRepository crea una nueva instancia del repositorio.
func NewUserRepository(db *pgxpool.Pool) UserRepository {
	return &postgresUserRepository{db: db}
}

// GetUserByEmail busca un usuario por su correo electrónico.
func (r *postgresUserRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, email, password_hash, preferred_currency, timezone, created_at, updated_at
		FROM users
		WHERE email = $1 AND deleted_at IS NULL
	`

	var user domain.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.PreferredCurrency,
		&user.Timezone,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err // Puede ser un error de "no rows" (no encontrado) u otro error de conexión
	}

	return &user, nil
}
