# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FinWard is a financial management & transaction tracking app in early development. The backend is a Go/Gin REST API with PostgreSQL. The mobile app is React Native + Expo. Features currently implemented: JWT authentication, Android notification listener. Features planned but not yet built: transaction storage, subscription detection, and AI-powered transaction categorization (Python service).

## Architecture

```
finward-migration/
├── api/                 # Go REST API (Gin framework)
│   ├── cmd/
│   │   ├── api/         # Main API server entry point
│   │   └── seeder/      # Database seeding utility
│   ├── internal/
│   │   ├── domain/      # Domain entities (User, etc.)
│   │   ├── handlers/    # HTTP handlers (AuthHandler)
│   │   └── repository/  # Data access layer (interfaces + PG implementations)
│   ├── migrations/      # Goose SQL migration files
│   └── pkg/utils/       # Shared utilities (JWT, bcrypt hashing)
├── mobile/              # React Native + Expo app
│   ├── src/
│   │   ├── navigation/  # AppNavigator.tsx (stack navigator)
│   │   └── screens/     # LoginScreen.tsx, DashboardScreen.tsx
│   ├── modules/
│   │   └── notification-listener/  # Native Android module
│   └── App.tsx
├── ai/                  # Python AI service (planned — not yet created)
├── infra/
│   └── docker-compose.yaml  # Local dev infrastructure
├── design/              # Claude Design handoff mockups
└── docs/                # User stories and technical docs
```

**Design patterns:** Repository pattern with interfaces, handler-based routing, dependency injection (db pool passed to handlers/repos), soft deletes via `deleted_at`.

**Infrastructure (Docker):**
- PostgreSQL 15 on port **5433**
- RabbitMQ on ports 5672 / 15672 (admin UI)
- PgAdmin on port **5050**

RabbitMQ is provisioned but not yet integrated in application code. Planned use: async channel between `api` (Go) and `ai` (Python) services.

## Development Commands

### Start infrastructure
```bash
docker-compose -f infra/docker-compose.yaml up -d
```

### Run the API server
```bash
cd api && go run ./cmd/api/main.go
```
Migrations run automatically on startup via Goose.

### Run the database seeder
```bash
cd api && go run ./cmd/seeder/main.go
```
Creates test user `test@finward.com` / `Finward2024!` (idempotent).

### Run tests
```bash
cd api && go test ./...
# Single package:
cd api && go test ./pkg/utils/...
```

### Manage dependencies
```bash
cd api && go mod tidy
```

### Mobile dev (Expo)
```bash
cd mobile && npm install   # first time only
cd mobile && npm start     # Expo dev server
cd mobile && npm run android
```

## Environment Variables

Loaded from `api/.env` (not committed). Required variables:

| Variable     | Description                          | Dev default                                                         |
|--------------|--------------------------------------|---------------------------------------------------------------------|
| `PORT`       | API server port                      | `8080`                                                              |
| `DB_URL`     | PostgreSQL connection string         | `postgres://finward_admin:finward_secret_password@localhost:5433/finward_db?sslmode=disable` |
| `JWT_SECRET` | JWT signing key                      | `super_secret_key_for_development_only`                             |

## Database & Migrations

- **Tool:** [Goose](https://github.com/pressly/goose) — SQL-based migrations in `api/migrations/`
- **Trigger:** Automatic on API startup (`runMigrations()` in `main.go`)
- **New migration format:** SQL file with `-- +goose Up` / `-- +goose Down` sections, named `NN_description.sql`

**Schema tables:** `users`, `transactions`, `merchants`, `categories`, `subscriptions`, `ai_corrections`

## Key Routing

Defined in `api/cmd/api/main.go`:
- `GET /ping` — health check
- `POST /login` — returns JWT (24h, HS256); handler in `api/internal/handlers/auth.go`

## Mobile Stack

React Native 0.81 + Expo 54 + TypeScript. Runs on Android (physical device or emulator).

**Auth flow:** `POST /login` → JWT stored in `AsyncStorage` under key `token` → navigate to Dashboard. `AppNavigator` manages the Login → Dashboard stack.

**Notification listener:** Native Android module at `mobile/modules/notification-listener/` — captures bank push notifications to detect transactions.

**Design tokens** (shared across screens, defined inline per screen — extract to `mobile/src/theme.ts` when adding a third screen):
- Primary: `#4A6FA5` | Light: `#EEF2F9` | BG: `#F5F7FA` | Text: `#1A1D23`

## Go Module

Module name: `finward-backend`, Go 1.25. Key dependencies:
- `github.com/gin-gonic/gin` — web framework
- `github.com/jackc/pgx/v5` — PostgreSQL driver
- `github.com/pressly/goose/v3` — migrations
- `github.com/golang-jwt/jwt/v5` — JWT
- `github.com/joho/godotenv` — .env loading
