package api

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(handler *APIHandler) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS configuration
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "telegram-messaging-gateway"})
	})

	// API routes
	apiGroup := r.Group("/api")
	{
		// Status & Config
		apiGroup.GET("/status", handler.GetStatus)
		apiGroup.POST("/config", handler.UpdateConfig)

		// Auth
		authGroup := apiGroup.Group("/auth")
		{
			authGroup.POST("/qr", handler.StartQR)
			authGroup.POST("/send-code", handler.SendCode)
			authGroup.POST("/sign-in", handler.SignIn)
			authGroup.POST("/password", handler.SubmitPassword)
			authGroup.POST("/logout", handler.Logout)
		}

		// Messaging & Dialogs
		apiGroup.POST("/send-message", handler.SendMessage)
		apiGroup.GET("/dialogs", handler.GetDialogs)
		apiGroup.GET("/messages", handler.GetChatHistory)
		apiGroup.GET("/messages/recent", handler.GetRecentMessages)

		// Auto-Reply Rules
		autoGroup := apiGroup.Group("/auto-replies")
		{
			autoGroup.GET("", handler.GetAutoReplies)
			autoGroup.POST("", handler.CreateAutoReply)
			autoGroup.PUT("/:id/toggle", handler.ToggleAutoReply)
			autoGroup.DELETE("/:id", handler.DeleteAutoReply)
		}

		// WebSocket
		apiGroup.GET("/ws", handler.WebSocket)
	}

	return r
}
