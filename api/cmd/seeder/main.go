package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// 1. Cargar variables de entorno (Asumiendo que ejecutas desde la raíz del backend)
	if err := godotenv.Load(".env"); err != nil {
		log.Println("Advertencia: No se encontró archivo .env, usando variables del sistema")
	}

	// 2. Conectar a PostgreSQL con pgxpool
	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		log.Fatal("DB_URL no está definida en las variables de entorno")
	}

	// 3. Ejecutar migraciones con Goose (igual que el servidor API)
	migrationsDB, err := sql.Open("pgx", dbUrl)
	if err != nil {
		log.Fatalf("Error abriendo conexión para migraciones: %v", err)
	}
	if err := goose.Up(migrationsDB, "migrations"); err != nil {
		log.Fatalf("Error ejecutando migraciones Goose: %v", err)
	}
	migrationsDB.Close()
	fmt.Println("Estructura de tablas creada/verificada correctamente.")

	dbPool, err := pgxpool.New(context.Background(), dbUrl)
	if err != nil {
		log.Fatalf("No se pudo conectar a la base de datos: %v", err)
	}
	defer dbPool.Close()

	// 4. Datos del usuario quemado (Seeding)
	email := "test@finward.com"
	plainPassword := "Finward2024!"

	// Verificar si el usuario ya existe
	var exists bool
	err = dbPool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", email).Scan(&exists)
	if err != nil {
		log.Fatalf("Error al verificar usuario existente: %v", err)
	}

	if exists {
		fmt.Printf("El usuario %s ya existe. Seeding omitido.\n", email)
		return
	}

	// 5. Encriptar e Insertar
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Error al encriptar la contraseña: %v", err)
	}

	// Nota: El ID se genera automáticamente gracias a uuid_generate_v4() en tu SQL
	_, err = dbPool.Exec(context.Background(),
		"INSERT INTO users (email, password_hash) VALUES ($1, $2)",
		email, string(hashedBytes),
	)
	if err != nil {
		log.Fatalf("Error al insertar el usuario: %v", err)
	}

	fmt.Println("=====================================================")
	fmt.Println("Seeding exitoso.")
	fmt.Printf("Email: %s\nHash en BD: %s\n", email, string(hashedBytes))
	fmt.Println("=====================================================")
}
