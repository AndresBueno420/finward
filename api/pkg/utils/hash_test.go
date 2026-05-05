package utils

import (
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "Finward2024!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Errorf("Error inesperado al hashear la contraseña: %v", err)
	}

	if password == hash {
		t.Errorf("El hash no debería ser igual a la contraseña en texto plano")
	}

	// Verificar que el hash funcione con la función de chequeo
	match := CheckPasswordHash(password, hash)
	if !match {
		t.Errorf("El hash generado no coincide con la contraseña original")
	}
}

func TestCheckPasswordHash_WrongPassword(t *testing.T) {
	hash, _ := HashPassword("Finward2024!")

	match := CheckPasswordHash("PasswordIncorrecta!", hash)
	if match {
		t.Errorf("La validación debería fallar con una contraseña incorrecta")
	}
}
