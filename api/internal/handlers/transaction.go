package handlers

import (
	"context"
	"finward-backend/internal/domain"
	"finward-backend/internal/repository"
	"net/http"

	"github.com/gin-gonic/gin"
)

type TransactionHandler struct {
	txRepo repository.TransactionRepository
}

func NewTransactionHandler(txRepo repository.TransactionRepository) *TransactionHandler {
	return &TransactionHandler{txRepo: txRepo}
}

func (h *TransactionHandler) Update(c *gin.Context) {
	userID := c.GetString("userID")
	txID := c.Param("id")

	var update domain.TransactionUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if update.CategoryName == nil && update.MerchantClean == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to update"})
		return
	}

	if err := h.txRepo.UpdateTransaction(context.Background(), txID, userID, update); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
