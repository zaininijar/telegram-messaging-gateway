# telegram-messaging-gateway

Gateway akun Telegram pribadi (MTProto user client) + dashboard web.

Bisa kirim pesan lewat REST, auto-reply keyword, broadcast, dan stream pesan masuk via WebSocket.

## stack

- Backend: Go (`gotd/td`, Gin, WebSocket)
- Frontend: React + Vite + Tailwind

## credential

Ambil `API_ID` / `API_HASH` dari [my.telegram.org](https://my.telegram.org) → API development tools.

Bisa diisi di `.env` atau lewat UI login pertama.

## jalanin

Sekaligus:

```bash
./start.sh
```

Atau terpisah:

```bash
# backend
cd backend && air   # atau: go run ./cmd/server
# http://localhost:8080

# frontend
cd frontend && npm run dev
# http://localhost:5173
```

Login di UI: API_ID/HASH → nomor → OTP → 2FA (kalau ada). Session tersimpan di `backend/session.json`.

## API singkat

```bash
curl -X POST http://localhost:8080/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"to":"@username","message":"halo"}'
```

- `GET /api/status`
- `GET /api/dialogs?limit=30`
- `ws://localhost:8080/api/ws`

## catatan

Jeda broadcast (mis. 3–5 detik). Jangan spam link ke kontak baru — mudah kena limit Telegram.
