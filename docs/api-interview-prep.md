# FinWard API — Guía de Preparación para Entrevista

## ¿Qué construí?

Una **REST API de autenticación** para una app de finanzas personales, usando Go con el framework Gin y PostgreSQL como base de datos. El backend maneja registro/login de usuarios con JWT, y está diseñado con una arquitectura limpia para escalar hacia módulos de transacciones, suscripciones y categorización con IA.

---

## Stack tecnológico

| Tecnología | Rol |
|---|---|
| **Go 1.25** | Lenguaje del backend |
| **Gin** | Framework HTTP (routing, middleware, binding) |
| **PostgreSQL 15** | Base de datos relacional |
| **pgx/pgxpool** | Driver de PostgreSQL con pool de conexiones |
| **Goose** | Migraciones de base de datos versionadas |
| **JWT (HS256)** | Autenticación stateless |
| **bcrypt** | Hashing seguro de contraseñas |
| **godotenv** | Carga de variables de entorno desde `.env` |
| **Docker Compose** | Infraestructura local (Postgres, RabbitMQ, PgAdmin) |

---

## Arquitectura y estructura de carpetas

```
api/
├── cmd/
│   ├── api/main.go        # Entry point: carga env, migraciones, DB, rutas
│   └── seeder/main.go     # Utilidad para sembrar datos de prueba
├── internal/
│   ├── domain/
│   │   └── user.go        # Struct User — modelo central de negocio
│   ├── handlers/
│   │   └── auth.go        # HTTP handler: recibe request, llama repo, devuelve response
│   └── repository/
│       ├── user_repository.go   # Interfaz UserRepository
│       └── postgres_user_repository.go  # Implementación con pgx
├── migrations/
│   └── 01_init_schema.sql # Schema completo con Goose
└── pkg/utils/
    ├── hash.go            # bcrypt: HashPassword, CheckPasswordHash
    ├── hash_test.go       # Tests unitarios de hashing
    └── jwt.go             # GenerateJWT con claims estándar
```

### ¿Por qué esta estructura?

Separa **qué hace el sistema** (domain) de **cómo lo persiste** (repository) y **cómo lo expone** (handlers). Si mañana cambio de PostgreSQL a MongoDB, solo toco el repository — handlers y domain no se tocan.

---

## Patrón Repository

Este es el patrón más importante que apliqué. El handler no habla directo con la base de datos; habla con una **interfaz**:

```go
// Contrato — lo que cualquier implementación debe cumplir
type UserRepository interface {
    GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
}

// Implementación concreta con PostgreSQL
type postgresUserRepository struct {
    pool *pgxpool.Pool
}
```

El `AuthHandler` recibe un `UserRepository` (la interfaz), no la implementación concreta. Esto permite:
- **Testing**: puedo inyectar un mock sin tocar la DB real
- **Flexibilidad**: cambiar de PostgreSQL a cualquier otra DB sin tocar el handler
- **Separación de responsabilidades**: la lógica HTTP no conoce SQL

---

## Flujo completo de autenticación (`POST /login`)

```
Request JSON  →  Gin binding & validación
                      ↓
              AuthHandler.Login()
                      ↓
         repo.GetUserByEmail(email)  →  SELECT en PostgreSQL (filtra soft-deleted)
                      ↓
         utils.CheckPasswordHash(password, hash)  →  bcrypt.CompareHashAndPassword
                      ↓
         utils.GenerateJWT(userID)  →  token HS256, exp 24h
                      ↓
         Response JSON: { token, id, email, preferred_currency }
```

**Decisiones de seguridad:**
- El error devuelto en login fallido siempre es "Credenciales inválidas" — no se distingue si el email no existe o la contraseña es incorrecta (evita enumeration attacks)
- `PasswordHash` tiene tag `json:"-"` en el struct — nunca se serializa en respuestas
- bcrypt con `DefaultCost` (10 rondas) — suficientemente lento para dificultar brute force

---

## Schema de base de datos

Diseñado para todo el roadmap del producto, no solo para lo implementado:

```sql
users            -- autenticación, moneda, timezone, soft delete
transactions     -- núcleo del negocio: monto, merchant, categoría, notif original
merchants        -- nombre raw del banco + nombre limpio normalizado
categories       -- tipo de gasto (food, transport, subscription...)
subscriptions    -- detección de cobros recurrentes
ai_corrections   -- feedback loop: correcciones manuales del usuario al modelo de IA
```

Los campos `prompt_used` y `llm_response` en `ai_corrections` son **JSONB** — almacenan el payload completo del LLM sin esquema fijo, permitiendo evolucionar el modelo sin migraciones.

---

## Migraciones con Goose

```sql
-- +goose Up
CREATE TABLE users (...);

-- +goose Down
DROP TABLE users;
```

Las migraciones corren **automáticamente al iniciar el servidor** (`runMigrations()` en main.go). Goose guarda en `goose_db_version` qué versiones ya se aplicaron — idempotente y seguro para CI/CD.

---

## Inyección de dependencias

El patrón de DI es manual (sin framework). El `main.go` construye todo:

```go
pool := connectDB()             // capa de infraestructura
repo := repository.NewPostgresUserRepository(pool)  // capa de datos
authHandler := handlers.NewAuthHandler(repo)        // capa HTTP
router.POST("/login", authHandler.Login)
```

El handler solo conoce la interfaz, no sabe nada de pgx ni de PostgreSQL.

---

## Virtudes de Go y cómo las usé

### 1. **Rendimiento y concurrencia nativa**
Go compila a binario nativo — no hay VM, no hay GC stops frecuentes. `pgxpool` maneja un pool de conexiones concurrentes de forma eficiente con goroutines. Cada request de Gin corre en su propia goroutine sin overhead de threads del OS.

### 2. **Tipado estático + interfaces implícitas**
Las interfaces en Go son implícitas — si un tipo implementa los métodos, satisface la interfaz sin declararlo. Esto hace el patrón Repository natural:
```go
// postgresUserRepository satisface UserRepository automáticamente
// porque implementa GetUserByEmail — sin "implements" explícito
```

### 3. **Error handling explícito**
Go no usa excepciones. Cada función devuelve `(value, error)`. Esto fuerza a manejar todos los casos de error en el punto donde ocurren:
```go
user, err := h.repo.GetUserByEmail(ctx, req.Email)
if err != nil {
    c.JSON(401, gin.H{"error": "Credenciales inválidas"})
    return
}
```
Hace el flujo de errores visible y predecible.

### 4. **Compilación rápida + binario único**
`go build` produce un binario estático. El deploy es copiar un archivo — no hay dependencias de runtime, no hay node_modules, no hay JVM.

### 5. **Context para cancelación y timeouts**
Toda llamada a la DB recibe un `context.Context`. Si el cliente cancela la request, el contexto se cancela y la query se interrumpe — sin recursos desperdiciados.

### 6. **Testing integrado**
`go test ./...` sin configuración adicional. El archivo `hash_test.go` prueba las funciones de seguridad con la librería estándar de testing.

---

## Endpoints actuales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/ping` | Health check |
| `POST` | `/login` | Autenticación, devuelve JWT |

---

## Cómo mejorar y escalar

### Corto plazo (siguientes features)

**1. Middleware de autenticación JWT**
Actualmente el JWT se genera pero no hay middleware que lo valide en rutas protegidas. El siguiente paso es:
```go
func AuthMiddleware() gin.HandlerFunc {
    // Leer Authorization: Bearer <token>
    // Validar firma y expiración
    // Inyectar userID en el contexto de Gin
}
```

**2. Transacciones HTTP → base de datos**
El schema ya tiene la tabla `transactions`. Implementar `POST /transactions` para recibir las notificaciones del módulo nativo Android.

**3. Validación más rica**
Actualmente usa los tags de Gin (`binding:"required,email"`). Añadir un validador custom para reglas de negocio específicas.

### Mediano plazo (escalabilidad)

**4. Refresh tokens**
El JWT actual expira en 24h y no es revocable. Implementar refresh tokens almacenados en DB con posibilidad de invalidar sesiones.

**5. Rate limiting**
Añadir middleware de rate limiting en `/login` para proteger contra brute force. Gin tiene paquetes para esto (`gin-contrib/ratelimiter`).

**6. Structured logging**
Reemplazar `fmt.Printf` por un logger estructurado como `slog` (stdlib de Go) o `zap`. Cada log con campos: `user_id`, `method`, `path`, `duration`, `status`.

**7. Separar handlers en paquetes de feature**
Cuando haya más handlers (transactions, subscriptions), agrupar por dominio en lugar de un solo paquete `handlers/`.

### Largo plazo (sistema distribuido)

**8. RabbitMQ ya está provisionado**
El `docker-compose.yaml` ya tiene RabbitMQ. La arquitectura planificada es:
```
Go API  →  RabbitMQ queue  →  Python AI service
                                    ↓
                          categorización automática
                                    ↓
                          UPDATE transaction SET category_id = ...
```

**9. Separar el servicio de autenticación**
Si la app crece, `auth` puede convertirse en un microservicio independiente con su propia DB de usuarios, y el API principal valida tokens contra él.

**10. Connection pooling tuning**
`pgxpool` tiene parámetros configurables: `MaxConns`, `MinConns`, `MaxConnLifetime`. Con carga real, ajustar según métricas de latencia de DB.

**11. Graceful shutdown**
El servidor actual no maneja señales OS. Añadir:
```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit
// Cerrar pool de DB, esperar requests en curso
```

---

## Preguntas de entrevista frecuentes y respuestas

**¿Por qué Go y no Node o Python?**
> Performance y simplicidad de deploy. Un binario compilado, concurrencia nativa con goroutines, y tipado estático que atrapa errores en compile time. Para una API financiera donde la confiabilidad importa, el tipado estricto de Go reduce bugs.

**¿Qué es el patrón Repository?**
> Abstrae la capa de persistencia detrás de una interfaz. El handler no sabe si los datos vienen de PostgreSQL, Redis o un mock — solo llama métodos de la interfaz. Permite testing sin DB y cambio de motor de BD sin tocar lógica de negocio.

**¿Por qué usar bcrypt para contraseñas y no SHA256?**
> bcrypt es un algoritmo diseñado para ser lento (configurable con cost factor) y tiene salt integrado. SHA256 es rápido — ideal para checksums, pero eso lo hace vulnerable a brute force y rainbow tables en contraseñas.

**¿Qué información va en el JWT?**
> Solo el `user_id` en el claim `sub`, más `iat` (issued at) y `exp` (expiration). No se incluye email ni roles en el token para minimizar exposición de datos si el token se compromete.

**¿Cómo evitas SQL injection?**
> pgx usa **queries parametrizadas** automáticamente. Nunca se concatena input del usuario en el string SQL — se pasan como argumentos separados que pgx escapa internamente.

**¿Cómo manejarías autenticación en rutas protegidas?**
> Middleware JWT en Gin que lee el header `Authorization: Bearer <token>`, valida la firma con `JWT_SECRET`, verifica expiración, y si es válido inyecta el `userID` en `c.Set("userID", claims.Subject)` para que el handler lo consuma.
