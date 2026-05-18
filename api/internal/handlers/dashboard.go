package handlers

import (
	"net/http"
	"strconv"
	"time"

	"finward-backend/internal/repository"

	"github.com/gin-gonic/gin"
)

var meses = map[string]string{
	"January": "Enero", "February": "Febrero", "March": "Marzo",
	"April": "Abril", "May": "Mayo", "June": "Junio",
	"July": "Julio", "August": "Agosto", "September": "Septiembre",
	"October": "Octubre", "November": "Noviembre", "December": "Diciembre",
}

type DashboardHandler struct {
	txRepo repository.TransactionRepository
}

func NewDashboardHandler(txRepo repository.TransactionRepository) *DashboardHandler {
	return &DashboardHandler{txRepo: txRepo}
}

func (h *DashboardHandler) GetSummary(c *gin.Context) {
	userID := c.GetString("userID")

	month := time.Now().UTC()

	if m := c.Query("month"); m != "" {
		if y := c.Query("year"); y != "" {
			mo, err1 := strconv.Atoi(m)
			yr, err2 := strconv.Atoi(y)
			if err1 == nil && err2 == nil && mo >= 1 && mo <= 12 {
				month = time.Date(yr, time.Month(mo), 1, 0, 0, 0, 0, time.UTC)
			}
		}
	}

	summary, err := h.txRepo.GetMonthlySummary(c.Request.Context(), userID, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error consultando resumen"})
		return
	}

	summary.Mes = meses[month.Format("January")] + " " + month.Format("2006")
	c.JSON(http.StatusOK, summary)
}
