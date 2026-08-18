#!/bin/bash

# Script untuk menjalankan Go Backend (dengan Air Live-Reload) & React Frontend

echo "🚀 Starting Telegram Messaging Gateway..."

# Kill previous background jobs on exit
trap "kill 0" EXIT

# Check if air is available
if command -v air >/dev/null 2>&1; then
  echo "⚡ Starting Go Backend with Air (Live-Reload) on http://localhost:8080..."
  (cd backend && air) &
else
  echo "📦 Starting Go Backend on http://localhost:8080..."
  (cd backend && go run ./cmd/server) &
fi

# Start React Frontend (Vite)
echo "💻 Starting React Frontend on http://localhost:5173..."
(cd frontend && npm run dev) &

wait
