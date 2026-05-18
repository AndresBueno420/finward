package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
)

type seedTx struct {
	merchantRaw    string
	merchantClean  string
	categoryName   string
	amount         float64
	notifText      string
	bank           string
	daysAgo        int
	isSubscription bool
}

var testData = []seedTx{
	// Alimentación
	{
		merchantRaw: "EXITO KENEDDY", merchantClean: "Éxito",
		categoryName: "Alimentación", amount: 87500, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $87,500 en EXITO KENEDDY. Disponible $1,234,567",
		daysAgo: 2,
	},
	{
		merchantRaw: "RAPPI COLOMBIA", merchantClean: "Rappi Food",
		categoryName: "Alimentación", amount: 32000, bank: "Nu",
		notifText: "Nu: Compraste $32,000 en RAPPI COLOMBIA.",
		daysAgo: 5,
	},
	{
		merchantRaw: "MCDONALDS BOGOTA", merchantClean: "McDonald's",
		categoryName: "Alimentación", amount: 28500, bank: "Davivienda",
		notifText: "Davivienda: Compra de $28,500 en MCDONALDS BOGOTA. Saldo $567,890",
		daysAgo: 8,
	},
	{
		merchantRaw: "DOMINOS PIZZA", merchantClean: "Domino's Pizza",
		categoryName: "Alimentación", amount: 45000, bank: "Nequi",
		notifText: "Nequi: Pagaste $45,000 a DOMINOS PIZZA.",
		daysAgo: 12,
	},
	// Transporte
	{
		merchantRaw: "INDRIVER COL", merchantClean: "InDriver",
		categoryName: "Transporte", amount: 12500, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $12,500 en INDRIVER COL. Disponible $1,100,000",
		daysAgo: 1,
	},
	{
		merchantRaw: "UBER COLOMBIA", merchantClean: "Uber",
		categoryName: "Transporte", amount: 18700, bank: "Nu",
		notifText: "Nu: Compraste $18,700 en UBER COLOMBIA.",
		daysAgo: 4,
	},
	{
		merchantRaw: "TERPEL GDS CLLE26", merchantClean: "Terpel",
		categoryName: "Transporte", amount: 95000, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $95,000 en TERPEL GDS CLLE26. Disponible $900,000",
		daysAgo: 9,
	},
	// Entretenimiento
	{
		merchantRaw: "CINE COLOMBIA BOG", merchantClean: "Cine Colombia",
		categoryName: "Entretenimiento", amount: 26000, bank: "Davivienda",
		notifText: "Davivienda: Compra de $26,000 en CINE COLOMBIA BOG. Saldo $400,000",
		daysAgo: 6,
	},
	{
		merchantRaw: "STEAM GAMES", merchantClean: "Steam",
		categoryName: "Entretenimiento", amount: 79000, bank: "Nu",
		notifText: "Nu: Compraste $79,000 en STEAM GAMES.",
		daysAgo: 14,
	},
	// Suscripciones
	{
		merchantRaw: "NETFLIX.COM", merchantClean: "Netflix",
		categoryName: "Suscripciones", amount: 22900, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $22,900 en NETFLIX.COM. Disponible $800,000",
		daysAgo: 3, isSubscription: true,
	},
	{
		merchantRaw: "SPOTIFY AB", merchantClean: "Spotify",
		categoryName: "Suscripciones", amount: 16900, bank: "Nu",
		notifText: "Nu: Compraste $16,900 en SPOTIFY AB.",
		daysAgo: 3, isSubscription: true,
	},
	{
		merchantRaw: "APPLE.COM/BILL", merchantClean: "iCloud",
		categoryName: "Suscripciones", amount: 3900, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $3,900 en APPLE.COM/BILL. Disponible $760,000",
		daysAgo: 3, isSubscription: true,
	},
	// Salud
	{
		merchantRaw: "CRUZ VERDE 042", merchantClean: "Cruz Verde",
		categoryName: "Salud", amount: 35600, bank: "Davivienda",
		notifText: "Davivienda: Compra de $35,600 en CRUZ VERDE 042. Saldo $350,000",
		daysAgo: 7,
	},
	{
		merchantRaw: "FARMATODO COL", merchantClean: "Farmatodo",
		categoryName: "Salud", amount: 18200, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $18,200 en FARMATODO COL. Disponible $700,000",
		daysAgo: 11,
	},
	// Otros
	{
		merchantRaw: "MERCADO LIBRE COL", merchantClean: "Mercado Libre",
		categoryName: "Otros", amount: 54000, bank: "Nequi",
		notifText: "Nequi: Pagaste $54,000 a MERCADO LIBRE COL.",
		daysAgo: 10,
	},
	{
		merchantRaw: "FERRELECTRICOS LA 13", merchantClean: "Ferrelectricos La 13",
		categoryName: "Otros", amount: 67800, bank: "Bancolombia",
		notifText: "Bancolombia: Compra aprobada por $67,800 en FERRELECTRICOS LA 13. Disponible $600,000",
		daysAgo: 15,
	},
	// Ingresos
	{
		merchantRaw: "EMPRESA DEMO SAS", merchantClean: "Empresa Demo",
		categoryName: "Ingreso", amount: 2500000, bank: "Bancolombia",
		notifText: "Bancolombia: Recibiste $2,500,000 de EMPRESA DEMO SAS. Disponible $3,000,000",
		daysAgo: 1,
	},
	{
		merchantRaw: "NEQUI ENVIO AMIGO", merchantClean: "Nequi",
		categoryName: "Ingreso", amount: 150000, bank: "Nequi",
		notifText: "Nequi: Te enviaron $150,000. Tu saldo es $850,000",
		daysAgo: 5,
	},
	{
		merchantRaw: "DAVIPLATA INGRESO", merchantClean: "DaviPlata",
		categoryName: "Ingreso", amount: 80000, bank: "Daviplata",
		notifText: "Daviplata: Recibiste $80,000 de JUAN PEREZ. Saldo: $430,000",
		daysAgo: 10,
	},
}

func main() {
	if err := godotenv.Load(".env"); err != nil {
		log.Println("Advertencia: No se encontró archivo .env, usando variables del sistema")
	}

	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		log.Fatal("DB_URL no está definida en las variables de entorno")
	}

	migrationsDB, err := sql.Open("pgx", dbUrl)
	if err != nil {
		log.Fatalf("Error abriendo conexión para migraciones: %v", err)
	}
	if err := goose.Up(migrationsDB, "migrations"); err != nil {
		log.Fatalf("Error ejecutando migraciones Goose: %v", err)
	}
	migrationsDB.Close()

	ctx := context.Background()

	dbPool, err := pgxpool.New(ctx, dbUrl)
	if err != nil {
		log.Fatalf("No se pudo conectar a la base de datos: %v", err)
	}
	defer dbPool.Close()

	var userID string
	err = dbPool.QueryRow(ctx,
		"SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
		"test@finward.com",
	).Scan(&userID)
	if err != nil {
		log.Fatalf("No se encontró el usuario test@finward.com. Ejecuta primero el seeder de usuarios: %v", err)
	}
	fmt.Printf("Usuario encontrado: %s\n", userID)

	// Reset: delete transactions and subscriptions for this user
	tag, _ := dbPool.Exec(ctx, "DELETE FROM transactions WHERE user_id = $1", userID)
	fmt.Printf("Eliminadas %d transacciones anteriores.\n", tag.RowsAffected())

	tagS, _ := dbPool.Exec(ctx, "DELETE FROM subscriptions WHERE user_id = $1", userID)
	fmt.Printf("Eliminadas %d suscripciones anteriores.\n", tagS.RowsAffected())

	rows, err := dbPool.Query(ctx, "SELECT id, name FROM categories")
	if err != nil {
		log.Fatalf("Error cargando categorías: %v", err)
	}
	categoryIDs := map[string]string{}
	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		categoryIDs[name] = id
	}
	rows.Close()

	if len(categoryIDs) == 0 {
		log.Fatal("No hay categorías en la base de datos.")
	}
	fmt.Printf("Categorías cargadas: %d\n", len(categoryIDs))

	now := time.Now()
	insertedTx := 0
	insertedSub := 0

	for _, tx := range testData {
		catID, ok := categoryIDs[tx.categoryName]
		if !ok {
			log.Printf("Advertencia: categoría '%s' no encontrada, omitiendo.", tx.categoryName)
			continue
		}

		var merchantID string
		err = dbPool.QueryRow(ctx,
			"SELECT id FROM merchants WHERE raw_name = $1",
			tx.merchantRaw,
		).Scan(&merchantID)
		if err != nil {
			err2 := dbPool.QueryRow(ctx,
				"INSERT INTO merchants (raw_name, clean_name) VALUES ($1, $2) RETURNING id",
				tx.merchantRaw, tx.merchantClean,
			).Scan(&merchantID)
			if err2 != nil {
				log.Printf("Advertencia: no se pudo crear merchant '%s': %v", tx.merchantRaw, err2)
				continue
			}
		}

		txDate := now.AddDate(0, 0, -tx.daysAgo)

		_, err = dbPool.Exec(ctx,
			`INSERT INTO transactions
			   (user_id, merchant_id, category_id, amount, currency, date,
			    raw_notification_text, status, is_subscription, bank)
			 VALUES ($1, $2, $3, $4, 'COP', $5, $6, 'processed', $7, $8)`,
			userID, merchantID, catID, tx.amount, txDate,
			tx.notifText, tx.isSubscription, tx.bank,
		)
		if err != nil {
			log.Printf("Error insertando transacción '%s': %v", tx.merchantRaw, err)
			continue
		}
		insertedTx++

		if tx.isSubscription {
			nextBilling := txDate.AddDate(0, 1, 0)
			_, err = dbPool.Exec(ctx,
				`INSERT INTO subscriptions
				   (user_id, merchant_id, estimated_amount, currency, frequency,
				    start_date, next_billing_date, payment_method, is_active)
				 VALUES ($1, $2, $3, 'COP', 'monthly', $4, $5, $6, TRUE)`,
				userID, merchantID, tx.amount, txDate, nextBilling, tx.bank,
			)
			if err != nil {
				log.Printf("Error insertando suscripción '%s': %v", tx.merchantRaw, err)
			} else {
				insertedSub++
			}
		}
	}

	fmt.Println("=====================================================")
	fmt.Printf("Seeding exitoso: %d transacciones, %d suscripciones → test@finward.com\n", insertedTx, insertedSub)
	fmt.Println("=====================================================")
}
