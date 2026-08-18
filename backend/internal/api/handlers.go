package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"telegram-messaging-backend/internal/config"
	"telegram-messaging-backend/internal/telegram"
	"telegram-messaging-backend/internal/ws"

	"github.com/gin-gonic/gin"
)

type APIHandler struct {
	cfg       *config.Config
	tgManager *telegram.Manager
	hub       *ws.Hub
	autoReply *telegram.AutoReplyManager
}

func NewAPIHandler(cfg *config.Config, tgManager *telegram.Manager, hub *ws.Hub, autoReply *telegram.AutoReplyManager) *APIHandler {
	return &APIHandler{
		cfg:       cfg,
		tgManager: tgManager,
		hub:       hub,
		autoReply: autoReply,
	}
}

// GetStatus returns current connection and auth status
func (h *APIHandler) GetStatus(c *gin.Context) {
	status := h.tgManager.GetStatus()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// UpdateConfig updates App ID and App Hash
func (h *APIHandler) UpdateConfig(c *gin.Context) {
	var req struct {
		AppID   int    `json:"app_id" binding:"required"`
		AppHash string `json:"app_hash" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	h.tgManager.UpdateConfig(req.AppID, req.AppHash)

	// Start or restart client with new config
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_ = h.tgManager.StartClient(ctx)
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Configuration updated and client initializing",
		"data": gin.H{
			"app_id": req.AppID,
		},
	})
}

// StartQR starts the QR code login flow
func (h *APIHandler) StartQR(c *gin.Context) {
	var req struct {
		AppID   int    `json:"app_id"`
		AppHash string `json:"app_hash"`
	}
	_ = c.ShouldBindJSON(&req)

	if req.AppID != 0 && req.AppHash != "" {
		h.tgManager.UpdateConfig(req.AppID, req.AppHash)
		initCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_ = h.tgManager.StartClient(initCtx)
		cancel()
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := h.tgManager.StartQRAuth(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	status := h.tgManager.GetStatus()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "QR login flow started",
		"data":    status,
	})
}

// SendCode requests OTP for phone number
func (h *APIHandler) SendCode(c *gin.Context) {
	var req telegram.SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.AppID != 0 && req.AppHash != "" {
		h.tgManager.UpdateConfig(req.AppID, req.AppHash)
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := h.tgManager.SendCode(ctx, req.Phone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "OTP verification code sent to " + req.Phone,
	})
}

// SignIn verifies OTP code
func (h *APIHandler) SignIn(c *gin.Context) {
	var req telegram.SignInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := h.tgManager.SignIn(ctx, req.Code); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Sign-in successful",
		"data":    h.tgManager.GetStatus(),
	})
}

// SubmitPassword handles 2FA password
func (h *APIHandler) SubmitPassword(c *gin.Context) {
	var req telegram.PasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := h.tgManager.SubmitPassword(ctx, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "2FA password verified successfully",
		"data":    h.tgManager.GetStatus(),
	})
}

// Logout disconnects and clears session
func (h *APIHandler) Logout(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := h.tgManager.Logout(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Logged out successfully",
	})
}

// SendMessage handles sending a message to a recipient
func (h *APIHandler) SendMessage(c *gin.Context) {
	var req telegram.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	res, err := h.tgManager.SendMessage(ctx, req.To, req.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

// GetChatHistory returns message history for a chat
func (h *APIHandler) GetChatHistory(c *gin.Context) {
	chatID := c.Query("chat_id")
	if chatID == "" {
		chatID = c.Query("peer")
	}
	if chatID == "" {
		chatID = c.Query("to")
	}
	if chatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "chat_id or peer is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	history, err := h.tgManager.GetChatHistory(ctx, chatID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    history,
	})
}

// GetDialogs returns recent chats/dialogs
func (h *APIHandler) GetDialogs(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "30")
	limit, _ := strconv.Atoi(limitStr)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	dialogs, err := h.tgManager.GetDialogs(ctx, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    dialogs,
	})
}

// GetRecentMessages returns buffered recent messages
func (h *APIHandler) GetRecentMessages(c *gin.Context) {
	messages := h.tgManager.GetRecentMessages()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    messages,
	})
}

// GetAutoReplies returns all auto-reply rules
func (h *APIHandler) GetAutoReplies(c *gin.Context) {
	rules := h.autoReply.GetRules()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rules,
	})
}

// CreateAutoReply adds a new auto-reply rule
func (h *APIHandler) CreateAutoReply(c *gin.Context) {
	var req struct {
		Keyword   string `json:"keyword" binding:"required"`
		Response  string `json:"response" binding:"required"`
		MatchType string `json:"match_type"`
		IsActive  bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.MatchType == "" {
		req.MatchType = "contains"
	}

	rule := h.autoReply.AddRule(req.Keyword, req.Response, req.MatchType, req.IsActive)
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    rule,
	})
}

// ToggleAutoReply toggles active state of a rule
func (h *APIHandler) ToggleAutoReply(c *gin.Context) {
	id := c.Param("id")
	rule, err := h.autoReply.ToggleRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rule,
	})
}

// DeleteAutoReply deletes a rule
func (h *APIHandler) DeleteAutoReply(c *gin.Context) {
	id := c.Param("id")
	if err := h.autoReply.DeleteRule(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Rule deleted",
	})
}

// WebSocket handles WS connections
func (h *APIHandler) WebSocket(c *gin.Context) {
	h.hub.HandleWebSocket(c.Writer, c.Request)
}
