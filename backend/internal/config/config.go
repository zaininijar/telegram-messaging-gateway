package config

import (
	"encoding/json"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppID       int    `json:"app_id"`
	AppHash     string `json:"app_hash"`
	ServerPort  string `json:"server_port"`
	SessionPath string `json:"session_path"`
}

func LoadConfig() *Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	appID, _ := strconv.Atoi(os.Getenv("TELEGRAM_APP_ID"))
	appHash := os.Getenv("TELEGRAM_APP_HASH")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	sessionPath := os.Getenv("SESSION_PATH")
	if sessionPath == "" {
		sessionPath = "session.json"
	}

	cfg := &Config{
		AppID:       appID,
		AppHash:     appHash,
		ServerPort:  port,
		SessionPath: sessionPath,
	}

	// Try reading config.json if not in env
	if cfg.AppID == 0 || cfg.AppHash == "" {
		if data, err := os.ReadFile("config.json"); err == nil {
			var saved Config
			if json.Unmarshal(data, &saved) == nil {
				if saved.AppID != 0 {
					cfg.AppID = saved.AppID
				}
				if saved.AppHash != "" {
					cfg.AppHash = saved.AppHash
				}
			}
		}
	}

	return cfg
}

func (c *Config) Save() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile("config.json", data, 0644)
}
