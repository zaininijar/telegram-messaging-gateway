package telegram

import "time"

type AuthState string

const (
	StateDisconnected   AuthState = "disconnected"
	StateConnecting     AuthState = "connecting"
	StateNeedsCode      AuthState = "needs_code"
	StateNeedsPassword  AuthState = "needs_password"
	StateReady          AuthState = "ready"
	StateError          AuthState = "error"
)

type UserProfile struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	Phone     string `json:"phone"`
	IsBot     bool   `json:"is_bot"`
	PhotoURL  string `json:"photo_url,omitempty"`
}

type ClientStatus struct {
	State       AuthState    `json:"state"`
	Message     string       `json:"message"`
	AppID       int          `json:"app_id"`
	PhoneNumber string       `json:"phone_number,omitempty"`
	QRCodeURL   string       `json:"qr_code_url,omitempty"`
	User        *UserProfile `json:"user,omitempty"`
}

type MessageItem struct {
	ID             int       `json:"id"`
	ChatID         int64     `json:"chat_id"`
	ChatTitle      string    `json:"chat_title"`
	SenderID       int64     `json:"sender_id"`
	SenderName     string    `json:"sender_name"`
	SenderUsername string    `json:"sender_username"`
	Text           string    `json:"text"`
	Date           time.Time `json:"date"`
	IsOut          bool      `json:"is_out"`
	ChatType       string    `json:"chat_type"` // "user", "group", "channel"
}

type DialogItem struct {
	ID              int64     `json:"id"`
	Title           string    `json:"title"`
	Username        string    `json:"username,omitempty"`
	Type            string    `json:"type"` // "user", "chat", "channel"
	LastMessage     string    `json:"last_message"`
	LastMessageDate time.Time `json:"last_message_date"`
	UnreadCount     int       `json:"unread_count"`
}

type SendMessageRequest struct {
	To      string `json:"to" binding:"required"` // @username, phone number, or chat ID
	Message string `json:"message" binding:"required"`
}

type SendMessageResponse struct {
	Success bool   `json:"success"`
	ID      int    `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type SendCodeRequest struct {
	Phone   string `json:"phone" binding:"required"`
	AppID   int    `json:"app_id"`
	AppHash string `json:"app_hash"`
}

type SignInRequest struct {
	Code string `json:"code" binding:"required"`
}

type PasswordRequest struct {
	Password string `json:"password" binding:"required"`
}

type AutoReplyRule struct {
	ID        string    `json:"id"`
	Keyword   string    `json:"keyword"`
	Response  string    `json:"response"`
	MatchType string    `json:"match_type"` // "exact", "contains", "starts_with"
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}
