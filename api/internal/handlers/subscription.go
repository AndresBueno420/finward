package handlers

import (
	"context"
	"finward-backend/internal/domain"
	"finward-backend/internal/repository"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SubscriptionHandler struct {
	subRepo repository.SubscriptionRepository
}

func NewSubscriptionHandler(subRepo repository.SubscriptionRepository) *SubscriptionHandler {
	return &SubscriptionHandler{subRepo: subRepo}
}

func (h *SubscriptionHandler) List(c *gin.Context) {
	userID := c.GetString("userID")
	subs, err := h.subRepo.GetByUser(context.Background(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch subscriptions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"suscripciones": subs})
}

func (h *SubscriptionHandler) Update(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var body domain.SubscriptionUpdate
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := h.subRepo.Update(context.Background(), id, userID, body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update subscription"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *SubscriptionHandler) Delete(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	if err := h.subRepo.Delete(context.Background(), id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete subscription"})
		return
	}
	c.Status(http.StatusNoContent)
}
