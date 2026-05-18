# FinWard

Financial management and transaction tracking application. Detects bank transactions from push notifications, categorizes them automatically, and tracks subscriptions.

**Status:** Early development. JWT authentication and the Android notification listener are fully implemented. Transaction storage, subscription detection, and AI categorization are planned but not yet built.

---

## Architecture

```
finward-migration/
├── api/                 # Go REST API (Gin + PostgreSQL)
│   ├── cmd/
│   │   ├── api/         # Server entry point
│   │   └── seeder/      # Test data seeder
│   ├── internal/
│   │   ├── domain/      # Domain entities
│   │   ├── handlers/    # HTTP handlers
│   │   └── repository/  # Data access layer
│   ├── migrations/      # Goose SQL migrations
│   └── pkg/utils/       # JWT and bcrypt utilities
├── mobile/              # React Native + Expo (Android)
│   ├── src/
│   │   ├── navigation/  # Stack navigator
│   │   └── screens/     # LoginScreen, DashboardScreen
│   └── modules/
│       └── notification-listener/  # Native Android module
├── ai/                  # Python AI service (planned)
├── infra/
│   └── docker-compose.yaml
├── design/              # UI mockups (HTML handoff)
└── docs/                # Technical specs and user stories
```

### Design patterns

- Repository pattern with interfaces, implemented against PostgreSQL
- Dependency injection: db pool passed to handlers and repositories
- Soft deletes via `deleted_at` column
- Handler-based routing

---

## Stack

| Layer | Technology |
|---|---|
| API | Go 1.25, Gin, pgx v5, Goose, golang-jwt |
| Mobile | React Native 0.81, Expo 54, TypeScript |
| Database | PostgreSQL 15 |
| Messaging | RabbitMQ 4.3 (provisioned, not yet integrated) |
| Native module | Kotlin (Expo Modules API) |

---

## Local Infrastructure

Start all services with Docker:

```bash
docker-compose -f infra/docker-compose.yaml up -d
```

| Service | Port | Credentials |
|---|---|---|
| PostgreSQL | 5433 | `finward_admin` / `finward_secret_password` |
| RabbitMQ | 5672, 15672 | `finward_rmq` / `finward_rmq_pass` |
| PgAdmin | 5050 | `admin@finward.com` / `admin` |

---

## API

### Environment variables

Create `api/.env` with the following:

```
PORT=8080
DB_URL=postgres://finward_admin:finward_secret_password@localhost:5433/finward_db?sslmode=disable
JWT_SECRET=super_secret_key_for_development_only
```

### Run

```bash
cd api && go run ./cmd/api/main.go
```

Migrations run automatically on startup via Goose.

### Seed test data

```bash
cd api && go run ./cmd/seeder/main.go
```

Creates `test@finward.com` / `Finward2024!` (idempotent).

### Run tests

```bash
cd api && go test ./...
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/ping` | Health check |
| `POST` | `/login` | Returns a 24h JWT (HS256) |

### Database schema

Tables defined in `api/migrations/01_init_schema.up.sql`:

- `users` — account credentials and preferences
- `categories` — transaction category labels
- `merchants` — raw and normalized merchant names
- `transactions` — individual transactions linked to users and merchants
- `subscriptions` — recurring charges per user
- `ai_corrections` — feedback loop for AI categorization (JSONB fields for prompt and response)

---

## Mobile

The app targets Android. The auth flow is: login via `POST /login`, store the JWT in AsyncStorage, navigate to Dashboard.

### First-time setup

```bash
cd mobile && npm install
npx expo prebuild --platform android --clean
```

### Run

```bash
cd mobile && npm start         # Expo dev server
cd mobile && npm run android   # Build and deploy to device/emulator
```

### Screens

**LoginScreen** — Email and password form. Calls the API, stores the token, and navigates to Dashboard on success.

**DashboardScreen** — Displays bank notifications captured by the native module. Handles three states: checking permissions, permission denied (with a link to Android Settings), and active listening (scrollable notification list).

### Notification listener module

Located at `mobile/modules/notification-listener/`. A native Android module built with the Expo Modules API.

It provides three functions to JavaScript:

- `isNotificationServiceEnabled()` — checks if the listener service is active in Android Settings
- `openNotificationSettings()` — opens the Android notification access settings screen
- `addNotificationListener(callback)` — subscribes to incoming notifications; returns a removable subscription

The Kotlin service (`FinwardNotificationListenerService`) extends `NotificationListenerService`, intercepts system notifications, and forwards title, text, and package name to the JavaScript side via Expo's event emitter. The `BIND_NOTIFICATION_LISTENER_SERVICE` permission requires manual user activation in Settings and cannot be granted programmatically.

### Design tokens

Defined inline per screen. Extract to `mobile/src/theme.ts` when adding a third screen.

| Token | Value |
|---|---|
| Primary | `#4A6FA5` |
| Primary light | `#EEF2F9` |
| Background | `#F5F7FA` |
| Text | `#1A1D23` |
| Error | `#D94F4F` |

---

## Planned features

- Transaction storage: persist captured notifications as structured transactions
- Subscription detection: identify recurring charges from transaction history
- AI categorization: Python service consuming transactions from RabbitMQ, classifying merchants using an LLM, with a correction feedback loop stored in `ai_corrections`
