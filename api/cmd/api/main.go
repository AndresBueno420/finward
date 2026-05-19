package main

import (
	"context"
	"database/sql"
	"finward-backend/internal/handlers"
	"finward-backend/internal/middleware"
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

	aiURL := os.Getenv("AI_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8001"
	}

	userRepo := repository.NewUserRepository(dbPool)
	txRepo := repository.NewTransactionRepository(dbPool)
	subRepo := repository.NewSubscriptionRepository(dbPool)

	authHandler := handlers.NewAuthHandler(userRepo)
	dashboardHandler := handlers.NewDashboardHandler(txRepo)
	notificationHandler := handlers.NewNotificationHandler(txRepo, subRepo, aiURL)
	subscriptionHandler := handlers.NewSubscriptionHandler(subRepo)
	transactionHandler := handlers.NewTransactionHandler(txRepo)

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

	// Rutas públicas
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	r.GET("/health", func(c *gin.Context) {
		aiStatus, aiDetail := "unreachable", ""
		if resp, err := http.Get(aiURL + "/health"); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				aiStatus = "ok"
			} else {
				aiStatus = fmt.Sprintf("error_%d", resp.StatusCode)
			}
		} else {
			aiDetail = err.Error()
		}
		c.JSON(http.StatusOK, gin.H{
			"api": "ok",
			"ai":  gin.H{"status": aiStatus, "url": aiURL, "detail": aiDetail},
		})
	})

	r.POST("/login", authHandler.Login)

	// Rutas protegidas
	protected := r.Group("/")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/summary", dashboardHandler.GetSummary)
		protected.POST("/notifications/process", notificationHandler.Process)
		protected.GET("/subscriptions", subscriptionHandler.List)
		protected.PATCH("/subscriptions/:id", subscriptionHandler.Update)
		protected.DELETE("/subscriptions/:id", subscriptionHandler.Delete)
		protected.PATCH("/transactions/:id", transactionHandler.Update)
	}

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
