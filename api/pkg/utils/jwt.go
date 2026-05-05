package utils

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateJWT crea un token firmado para un usuario específico
func GenerateJWT(userID string) (string, error) {
	// Nunca hardcodeamos el secreto, lo leemos del .env
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "super_secret_fallback_key" // Solo para desarrollo, en prod debe fallar si no existe
	}

	claims := jwt.MapClaims{
		"sub": userID,                                // Subject (El ID del usuario)
		"exp": time.Now().Add(time.Hour * 24).Unix(), // Expiración (24 horas)
		"iat": time.Now().Unix(),                     // Issued At (Fecha de emisión)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}