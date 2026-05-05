package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"finward-backend/internal/repository" // Recuerda cambiar "tu-modulo"
	"finward-backend/pkg/utils"           // Recuerda cambiar "tu-modulo"
)

// LoginRequest define lo que esperamos recibir en el JSON del móvil
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthHandler agrupa los endpoints relacionados con autenticación
type AuthHandler struct {
	repo repository.UserRepository
}

// NewAuthHandler es el constructor
func NewAuthHandler(repo repository.UserRepository) *AuthHandler {
	return &AuthHandler{repo: repo}
}

// Login es la función que se ejecuta cuando hacen POST /login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest

	// 1. Validar el JSON de entrada (Gin hace esto por nosotros con 'binding')
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos o correo incorrecto"})
		return
	}

	// 2. Buscar al usuario en la base de datos
	user, err := h.repo.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		// Por seguridad, no decimos si el error fue que el correo no existe
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	// 3. Verificar la contraseña usando nuestra función bcrypt
	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	// 4. Generar el JWT
	token, err := utils.GenerateJWT(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generando token de acceso"})
		return
	}

	// 5. Responder con éxito
	c.JSON(http.StatusOK, gin.H{
		"message": "Login exitoso",
		"token":   token,
		"user": gin.H{
			"id":                 user.ID,
			"email":              user.Email,
			"preferred_currency": user.PreferredCurrency,
		},
	})
}