package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"finward-backend/internal/domain"
	"finward-backend/internal/repository"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	txRepo  repository.TransactionRepository
	subRepo repository.SubscriptionRepository
	aiURL   string
}

func NewNotificationHandler(txRepo repository.TransactionRepository, subRepo repository.SubscriptionRepository, aiURL string) *NotificationHandler {
	return &NotificationHandler{txRepo: txRepo, subRepo: subRepo, aiURL: aiURL}
}

type aiTransaccion struct {
	Comercio   string  `json:"comercio"`
	Monto      float64 `json:"monto"`
	Divisa     string  `json:"divisa"`
	Fecha      *string `json:"fecha"`
	Banco      string  `json:"banco"`
	Tipo       string  `json:"tipo"`
	Categoria  string  `json:"categoria"`
	Confidence float64 `json:"confidence"`
}

type aiResponse struct {
	Transaccion       aiTransaccion `json:"transaccion"`
	FallbackCategoria bool          `json:"fallback_categoria"`
}

func (h *NotificationHandler) Process(c *gin.Context) {
	userID := c.GetString("userID")

	var req domain.ProcessNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	aiResp, err := h.callAI(req)
	if err != nil {
		msg := err.Error()
		status := http.StatusBadGateway
		if strings.Contains(msg, "503") || strings.Contains(msg, "quota") || strings.Contains(msg, "rate") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}

	txDate := time.UnixMilli(req.Timestamp)
	if aiResp.Transaccion.Fecha != nil && *aiResp.Transaccion.Fecha != "" {
		if parsed, err := time.Parse(time.RFC3339, *aiResp.Transaccion.Fecha); err == nil {
			txDate = parsed
		}
	}

	newTx := domain.NewTransaction{
		UserID:              userID,
		MerchantRaw:         aiResp.Transaccion.Comercio,
		MerchantClean:       aiResp.Transaccion.Comercio,
		CategoryName:        aiResp.Transaccion.Categoria,
		Amount:              aiResp.Transaccion.Monto,
		Currency:            aiResp.Transaccion.Divisa,
		Date:                txDate,
		RawNotificationText: req.Title + " " + req.Text,
		IsSubscription:      aiResp.Transaccion.Categoria == "Suscripciones",
		PaymentMethod:       aiResp.Transaccion.Banco,
		Bank:                aiResp.Transaccion.Banco,
	}

	if err := h.txRepo.SaveTransaction(context.Background(), newTx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save transaction"})
		return
	}

	if newTx.IsSubscription {
		_ = h.subRepo.UpsertForMerchant(
			context.Background(),
			userID, newTx.MerchantRaw, newTx.PaymentMethod,
			newTx.Amount, newTx.Currency, txDate,
		)
	}

	c.JSON(http.StatusCreated, gin.H{
		"category":           aiResp.Transaccion.Categoria,
		"amount":             aiResp.Transaccion.Monto,
		"merchant":           aiResp.Transaccion.Comercio,
		"fallback_categoria": aiResp.FallbackCategoria,
	})
}

func (h *NotificationHandler) callAI(req domain.ProcessNotificationRequest) (*aiResponse, error) {
	payload := map[string]any{
		"texto":     req.Title + " " + req.Text,
		"timestamp": req.Timestamp,
		"paquete":   req.PackageName,
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(h.aiURL+"/internal/process", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[AI] connection error to %s: %v", h.aiURL, err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[AI] error %d: %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("ai service returned %d: %s", resp.StatusCode, string(body))
	}

	var result aiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
