# 🚀 Telegram Messaging Gateway (Go + React)

Aplikasi **Telegram Personal Client Gateway** (mirip konsep *WhatsApp Unofficial Gateway*), di mana Anda dapat mengotomatisasi akun Telegram pribadi (User Account) untuk:
- Mengirim pesan langsung via REST API (ke username `@...`, nomor HP `+62...`, atau User ID).
- Auto-Reply Bot berdasarkan kata kunci (Keyword Matcher).
- Broadcast / Bulk sender dengan jeda aman anti-spam.
- Membaca obrolan dan pesan masuk secara real-time via WebSocket.
- Web Dashboard modern berbasis React.js (Vite + Tailwind CSS).

---

## 🏗️ Arsitektur & Teknologi

- **Backend**: [Golang](https://go.dev)
  - `github.com/gotd/td`: MTProto 2.0 Native Client resmi Telegram (Userbot).
  - `github.com/gin-gonic/gin`: REST API framework.
  - `github.com/gorilla/websocket`: Real-time bidirectional update stream.
  - Session file persistence (`session.json`).
- **Frontend**: [React.js](https://react.dev) + [Vite](https://vitejs.dev) + [Tailwind CSS](https://tailwindcss.com) + [Lucide Icons](https://lucide.dev).

---

## 🔑 1. Persiapan Kredensial Telegram (my.telegram.org)

Sebelum memulai, Anda membutuhkan **`API_ID`** dan **`API_HASH`**:
1. Buka [my.telegram.org](https://my.telegram.org) dan login dengan nomor HP Telegram Anda.
2. Klik menu **API development tools**.
3. Buat aplikasi baru (beri nama bebas, misal: `MyGatewayApp`).
4. Catat **`App api_id`** (angka) dan **`App api_hash`** (string).

*(Kredensial ini bisa diisi di file `.env` atau langsung diinput lewat Web UI saat login pertama kali)*.

---

## ⚡ 2. Cara Menjalankan

### Opsi A: Jalankan Sekaligus (Rekomendasi)
```bash
./start.sh
```

### Opsi B: Jalankan Terpisah

**1. Backend (Go - dengan Air Live Reload)**
```bash
cd backend
air
# Atau jika tanpa air: go run ./cmd/server
# Server berjalan di http://localhost:8080
```

**2. Frontend (React)**
```bash
cd frontend
npm run dev
# Dashboard berjalan di http://localhost:5173
```

---

## 📱 3. Alur Login di Web UI

1. Buka browser di **`http://localhost:5173`**.
2. Masukkan `API_ID` dan `API_HASH` Telegram Anda.
3. Masukkan nomor HP (format internasional, contoh: `+6281234567890`).
4. Masukkan kode OTP 5-digit yang masuk ke aplikasi Telegram Anda.
5. Masukkan password 2FA (jika akun mengaktifkan Two-Step Verification).
6. Selesai! Sesi Anda tersimpan di `backend/session.json` dan tidak perlu login ulang saat restart.

---

## 📡 4. Dokumentasi REST API (Untuk Integrasi Eksternal)

Anda dapat menghubungkan backend Go ini ke aplikasi backend Anda yang lain (Laravel, Node.js, Python, CRM, dsb):

### **Kirim Pesan (Send Message)**
```http
POST /api/send-message
Content-Type: application/json
```
**Request Body:**
```json
{
  "to": "@username_tujuan",
  "message": "Halo! Pesanan #1234 telah kami kirimkan."
}
```
*Target `to` bisa berupa `@username`, nomor telepon `+62812...`, atau User ID.*

#### Contoh cURL:
```bash
curl -X POST http://localhost:8080/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"to": "@target_user", "message": "Pesan otomatis dari API"}'
```

### **Cek Status Akun**
```http
GET /api/status
```

### **Daftar Dialog / Obrolan Terakhir**
```http
GET /api/dialogs?limit=30
```

### **WebSocket Real-time Events**
```
ws://localhost:8080/api/ws
```
*Menerima event `new_message` dan `status_change` secara real-time.*

---

## 🛡️ Tips Anti-Spam / Anti-Banned Telegram

1. **Jeda Waktu**: Gunakan delay minimal 3-5 detik antar pesan saat broadcast ke orang yang belum menyimpan kontak Anda.
2. **SpamBot Protection**: Hindari mengirim link mencurigakan secara massal ke akun baru.
