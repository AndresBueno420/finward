package main

import (
	"context"
	"database/sql"
	"finward-backend/internal/handlers"
	"finward-backend/internal/repository"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
)

func runMigrations(dbUrl string) {
	// Goose usa la librería estándar database/sql
	db, err := sql.Open("pgx", dbUrl)
	if err != nil {
		log.Fatalf("Error abriendo conexión para migraciones: %v", err)
	}
	defer db.Close()
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("Error ejecutando migraciones Goose: %v", err)
	}
	log.Println("Migraciones validadas/ejecutadas correctamente por Goose.")
}

func main() {
	// 1. Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("Advertencia: No se encontró archivo .env, usando variables del sistema")
	}

	// 2. Conectar a PostgreSQL
	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		log.Fatal("DB_URL no está definida en las variables de entorno")
	}

	runMigrations(dbUrl)

	// Creamos un Pool de conexiones para manejar múltiples peticiones concurrentes
	dbPool, err := pgxpool.New(context.Background(), dbUrl)
	if err != nil {
		log.Fatalf("No se pudo conectar a la base de datos: %v", err)
	}
	defer dbPool.Close()

	// Verificamos que la conexión esté viva
	if err := dbPool.Ping(context.Background()); err != nil {
		log.Fatalf("La base de datos no responde (Ping fallido): %v", err)
	}
	fmt.Println("Conexión exitosa a PostgreSQL")

	userRepo := repository.NewUserRepository(dbPool)
	authHandler := handlers.NewAuthHandler(userRepo)

	// 3. Configurar el servidor HTTP con Gin
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Endpoint de prueba (Healthcheck)
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
			"status":  "API de FinWard funcionando correctamente",
		})
	})

	r.POST("/login", authHandler.Login)

	// 4. Arrancar el servidor
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Servidor corriendo en el puerto %s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Error al arrancar el servidor: %v", err)
	}
}
