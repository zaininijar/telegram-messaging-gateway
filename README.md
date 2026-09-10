# telegram-messaging-gateway

Personal Telegram account gateway (MTProto user client) with a web dashboard.

Send messages over REST, keyword auto-replies, broadcasts, and live inbound events over WebSocket.

## Stack

- Backend: Go (`gotd/td`, Gin, WebSocket)
- Frontend: React + Vite + Tailwind

## Credentials

Get `API_ID` / `API_HASH` from [my.telegram.org](https://my.telegram.org) → API development tools.

You can put them in `.env` or enter them in the UI on first login.

## Run

All-in-one:

```bash
./start.sh
```

Or separately:

```bash
# backend
cd backend && air   # or: go run ./cmd/server
# http://localhost:8080

# frontend
cd frontend && npm run dev
# http://localhost:5173
```

UI login flow: API_ID/HASH → phone → OTP → 2FA (if enabled). Session is stored in `backend/session.json`.

## API quick reference

```bash
curl -X POST http://localhost:8080/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"to":"@username","message":"hello"}'
```

- `GET /api/status`
- `GET /api/dialogs?limit=30`
- `ws://localhost:8080/api/ws`

## Notes

Add delays between broadcast messages (e.g. 3–5 seconds). Avoid mass-sending links to new contacts — Telegram rate-limits aggressively.
