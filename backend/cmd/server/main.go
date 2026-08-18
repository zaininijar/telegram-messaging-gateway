package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"telegram-messaging-backend/internal/api"
	"telegram-messaging-backend/internal/config"
	"telegram-messaging-backend/internal/telegram"
	"telegram-messaging-backend/internal/ws"
)

func main() {
	log.Println("🚀 Starting Telegram Messaging Gateway (Go Backend)...")

	// 1. Load configuration
	cfg := config.LoadConfig()

	// 2. Initialize WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// 3. Initialize Auto-Reply Manager
	autoReply := telegram.NewAutoReplyManager("auto_replies.json")

	// 4. Initialize Telegram Manager
	tgManager := telegram.NewManager(cfg, hub, autoReply)

	// Attempt starting Telegram client if configured
	if cfg.AppID != 0 && cfg.AppHash != "" {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := tgManager.StartClient(ctx); err != nil {
				log.Printf("⚠️ Note: Telegram client initial start: %v (You can connect via Web UI)", err)
			}
		}()
	} else {
		log.Println("ℹ️ No App ID/Hash found in env. You can configure them through the Web UI.")
	}

	// 5. Setup REST & WebSocket API Handler
	handler := api.NewAPIHandler(cfg, tgManager, hub, autoReply)
	router := api.SetupRouter(handler)

	// 6. Start HTTP Server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.ServerPort),
		Handler: router,
	}

	go func() {
		log.Printf("🌟 Server running on http://localhost:%s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited cleanly.")
}
