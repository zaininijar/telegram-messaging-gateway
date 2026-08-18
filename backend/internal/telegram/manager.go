package telegram

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"telegram-messaging-backend/internal/config"
	"telegram-messaging-backend/internal/ws"

	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/telegram/auth/qrlogin"
	"github.com/gotd/td/telegram/message"
	"github.com/gotd/td/telegram/message/peer"
	"github.com/gotd/td/tg"
)

type Manager struct {
	cfg          *config.Config
	hub          *ws.Hub
	autoReply    *AutoReplyManager
	client       *telegram.Client
	api          *tg.Client
	sender       *message.Sender
	peerResolver peer.Resolver
	qrLoggedIn   qrlogin.LoggedIn
	qrCodeURL    string

	ctx        context.Context
	cancel     context.CancelFunc
	clientDone chan struct{}

	mu            sync.RWMutex
	state         AuthState
	statusMsg     string
	phone         string
	phoneCodeHash string
	user          *UserProfile

	// History buffer of recent incoming/outgoing messages
	recentMessages []MessageItem
}

func NewManager(cfg *config.Config, hub *ws.Hub, autoReply *AutoReplyManager) *Manager {
	return &Manager{
		cfg:            cfg,
		hub:            hub,
		autoReply:      autoReply,
		state:          StateDisconnected,
		statusMsg:      "Not connected",
		recentMessages: make([]MessageItem, 0),
	}
}

func (m *Manager) GetStatus() ClientStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return ClientStatus{
		State:       m.state,
		Message:     m.statusMsg,
		AppID:       m.cfg.AppID,
		PhoneNumber: m.phone,
		QRCodeURL:   m.qrCodeURL,
		User:        m.user,
	}
}

func (m *Manager) UpdateConfig(appID int, appHash string) {
	m.mu.Lock()
	m.cfg.AppID = appID
	m.cfg.AppHash = appHash
	_ = m.cfg.Save()
	m.mu.Unlock()
}

func (m *Manager) setState(state AuthState, msg string) {
	m.mu.Lock()
	m.state = state
	m.statusMsg = msg
	status := ClientStatus{
		State:       m.state,
		Message:     m.statusMsg,
		AppID:       m.cfg.AppID,
		PhoneNumber: m.phone,
		QRCodeURL:   m.qrCodeURL,
		User:        m.user,
	}
	m.mu.Unlock()

	m.hub.BroadcastEvent("status_change", status)
}

func (m *Manager) StartClient(ctx context.Context) error {
	m.mu.Lock()
	if m.cancel != nil {
		m.cancel()
	}
	m.ctx, m.cancel = context.WithCancel(context.Background())
	m.clientDone = make(chan struct{})

	appID := m.cfg.AppID
	appHash := m.cfg.AppHash
	sessionPath := m.cfg.SessionPath
	m.mu.Unlock()

	if appID == 0 || appHash == "" {
		m.setState(StateDisconnected, "API ID / Hash not configured. Please set them first.")
		return fmt.Errorf("app_id and app_hash must be set")
	}

	m.setState(StateConnecting, "Connecting to Telegram MTProto...")

	dispatcher := tg.NewUpdateDispatcher()

	// Register QR Login token handler
	qrLoggedIn := qrlogin.OnLoginToken(dispatcher)

	// Register message updates
	dispatcher.OnNewMessage(func(ctx context.Context, e tg.Entities, u *tg.UpdateNewMessage) error {
		return m.handleIncomingMessage(ctx, e, u.Message)
	})
	dispatcher.OnNewChannelMessage(func(ctx context.Context, e tg.Entities, u *tg.UpdateNewChannelMessage) error {
		return m.handleIncomingMessage(ctx, e, u.Message)
	})

	sessionStorage := &telegram.FileSessionStorage{
		Path: sessionPath,
	}

	client := telegram.NewClient(appID, appHash, telegram.Options{
		SessionStorage: sessionStorage,
		UpdateHandler:  dispatcher,
		NoUpdates:      false,
	})

	m.mu.Lock()
	m.client = client
	m.api = client.API()
	m.sender = message.NewSender(client.API())
	m.peerResolver = peer.DefaultResolver(client.API())
	m.qrLoggedIn = qrLoggedIn
	m.mu.Unlock()

	readyCh := make(chan error, 1)

	go func() {
		defer close(m.clientDone)
		err := client.Run(m.ctx, func(runCtx context.Context) error {
			// Check current authorization status
			authStatus, err := client.Auth().Status(runCtx)
			if err != nil {
				readyCh <- err
				return err
			}

			if authStatus.Authorized {
				self, err := client.Self(runCtx)
				if err != nil {
					readyCh <- err
					return err
				}

				m.mu.Lock()
				m.user = &UserProfile{
					ID:        self.ID,
					FirstName: self.FirstName,
					LastName:  self.LastName,
					Username:  self.Username,
					Phone:     self.Phone,
					IsBot:     self.Bot,
				}
				m.phone = self.Phone
				m.mu.Unlock()

				m.setState(StateReady, fmt.Sprintf("Logged in as %s (@%s)", self.FirstName, self.Username))
				readyCh <- nil
			} else {
				m.setState(StateDisconnected, "Ready for authentication. Please request OTP.")
				readyCh <- nil
			}

			<-runCtx.Done()
			return runCtx.Err()
		})

		if err != nil && !errors.Is(err, context.Canceled) {
			log.Printf("Telegram client stopped with error: %v", err)
			m.setState(StateError, fmt.Sprintf("Telegram client error: %v", err))
		} else {
			m.setState(StateDisconnected, "Telegram client disconnected")
		}
	}()

	select {
	case err := <-readyCh:
		return err
	case <-time.After(10 * time.Second):
		return fmt.Errorf("timeout waiting for Telegram client initialization")
	}
}

func (m *Manager) ensureClientRunning(ctx context.Context) error {
	m.mu.RLock()
	client := m.client
	running := m.ctx != nil && m.ctx.Err() == nil
	m.mu.RUnlock()

	if client != nil && running {
		return nil
	}

	initCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return m.StartClient(initCtx)
}

func (m *Manager) StartQRAuth(ctx context.Context) error {
	if err := m.ensureClientRunning(ctx); err != nil {
		return fmt.Errorf("failed to initialize telegram client: %w", err)
	}

	m.mu.RLock()
	client := m.client
	qrLoggedIn := m.qrLoggedIn
	state := m.state
	m.mu.RUnlock()

	if client == nil {
		return fmt.Errorf("telegram client is not initialized")
	}

	if state == StateReady {
		return nil
	}

	go func() {
		qrCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		show := func(showCtx context.Context, token qrlogin.Token) error {
			m.mu.Lock()
			m.qrCodeURL = token.URL()
			m.mu.Unlock()

			m.hub.BroadcastEvent("qr_code", map[string]interface{}{
				"url":     token.URL(),
				"expires": token.Expires(),
			})
			return nil
		}

		_, err := client.QR().Auth(qrCtx, qrLoggedIn, show)
		if err != nil {
			if errors.Is(err, auth.ErrPasswordAuthNeeded) || strings.Contains(err.Error(), "SESSION_PASSWORD_NEEDED") {
				m.setState(StateNeedsPassword, "QR code berhasil di-scan! Masukkan password Two-Factor Authentication (2FA).")
				return
			}
			if !errors.Is(err, context.Canceled) {
				log.Printf("QR Auth error: %v", err)
			}
			return
		}

		self, err := client.Self(qrCtx)
		if err != nil {
			log.Printf("Failed to get profile after QR login: %v", err)
			return
		}

		m.mu.Lock()
		m.user = &UserProfile{
			ID:        self.ID,
			FirstName: self.FirstName,
			LastName:  self.LastName,
			Username:  self.Username,
			Phone:     self.Phone,
			IsBot:     self.Bot,
		}
		m.phone = self.Phone
		m.qrCodeURL = ""
		m.mu.Unlock()

		m.setState(StateReady, fmt.Sprintf("Berhasil login via QR Code sebagai %s (@%s)", self.FirstName, self.Username))
	}()

	return nil
}

func (m *Manager) SendCode(ctx context.Context, phone string) error {
	if err := m.ensureClientRunning(ctx); err != nil {
		return fmt.Errorf("failed to initialize telegram client: %w", err)
	}

	m.mu.Lock()
	client := m.client
	m.phone = phone
	m.mu.Unlock()

	if client == nil {
		return fmt.Errorf("client not initialized")
	}

	sentCode, err := client.Auth().SendCode(ctx, phone, auth.SendCodeOptions{})
	if err != nil {
		m.setState(StateError, fmt.Sprintf("Failed to send OTP: %v", err))
		return err
	}

	var phoneCodeHash string
	switch s := sentCode.(type) {
	case *tg.AuthSentCode:
		phoneCodeHash = s.PhoneCodeHash
	case *tg.AuthSentCodeSuccess:
		if authObj, ok := s.Authorization.(*tg.AuthAuthorization); ok {
			if u, ok := authObj.User.(*tg.User); ok {
				m.mu.Lock()
				m.user = &UserProfile{
					ID:        u.ID,
					FirstName: u.FirstName,
					LastName:  u.LastName,
					Username:  u.Username,
					Phone:     u.Phone,
					IsBot:     u.Bot,
				}
				m.mu.Unlock()
				m.setState(StateReady, fmt.Sprintf("Logged in as %s (@%s)", u.FirstName, u.Username))
				return nil
			}
		}
	default:
		return fmt.Errorf("unexpected sentCode type: %T", sentCode)
	}

	m.mu.Lock()
	m.phoneCodeHash = phoneCodeHash
	m.mu.Unlock()

	m.setState(StateNeedsCode, fmt.Sprintf("OTP sent to %s. Please submit the code.", phone))
	return nil
}

func (m *Manager) SignIn(ctx context.Context, code string) error {
	m.mu.RLock()
	client := m.client
	phone := m.phone
	hash := m.phoneCodeHash
	m.mu.RUnlock()

	if client == nil || hash == "" {
		return fmt.Errorf("please send OTP code first")
	}

	_, err := client.Auth().SignIn(ctx, phone, code, hash)
	if err != nil {
		if errors.Is(err, auth.ErrPasswordAuthNeeded) || strings.Contains(err.Error(), "SESSION_PASSWORD_NEEDED") {
			m.setState(StateNeedsPassword, "Two-factor authentication password required.")
			return nil
		}
		m.setState(StateError, fmt.Sprintf("Sign-in failed: %v", err))
		return err
	}

	self, err := client.Self(ctx)
	if err != nil {
		return err
	}

	m.mu.Lock()
	m.user = &UserProfile{
		ID:        self.ID,
		FirstName: self.FirstName,
		LastName:  self.LastName,
		Username:  self.Username,
		Phone:     self.Phone,
		IsBot:     self.Bot,
	}
	m.mu.Unlock()

	m.setState(StateReady, fmt.Sprintf("Logged in successfully as %s (@%s)", self.FirstName, self.Username))
	return nil
}

func (m *Manager) SubmitPassword(ctx context.Context, password string) error {
	m.mu.RLock()
	client := m.client
	m.mu.RUnlock()

	if client == nil {
		return fmt.Errorf("client not initialized")
	}

	_, err := client.Auth().Password(ctx, password)
	if err != nil {
		m.setState(StateError, fmt.Sprintf("2FA password verification failed: %v", err))
		return err
	}

	self, err := client.Self(ctx)
	if err != nil {
		return err
	}

	m.mu.Lock()
	m.user = &UserProfile{
		ID:        self.ID,
		FirstName: self.FirstName,
		LastName:  self.LastName,
		Username:  self.Username,
		Phone:     self.Phone,
		IsBot:     self.Bot,
	}
	m.mu.Unlock()

	m.setState(StateReady, fmt.Sprintf("Logged in successfully as %s (@%s)", self.FirstName, self.Username))
	return nil
}

func (m *Manager) Logout(ctx context.Context) error {
	m.mu.Lock()
	sessionPath := m.cfg.SessionPath
	m.user = nil
	m.phone = ""
	m.phoneCodeHash = ""
	m.qrCodeURL = ""
	m.mu.Unlock()

	if m.api != nil {
		_, _ = m.api.AuthLogOut(ctx)
	}

	_ = os.Remove(sessionPath)

	if m.cancel != nil {
		m.cancel()
	}

	m.setState(StateDisconnected, "Logged out successfully")

	// Restart client loop in background so QR code works immediately
	go func() {
		time.Sleep(300 * time.Millisecond)
		startCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = m.StartClient(startCtx)
	}()

	return nil
}

func (m *Manager) SendMessage(ctx context.Context, target string, text string) (*SendMessageResponse, error) {
	m.mu.RLock()
	api := m.api
	client := m.client
	state := m.state
	m.mu.RUnlock()

	if state != StateReady || api == nil {
		return nil, fmt.Errorf("telegram client is not logged in")
	}

	cleanTarget := strings.TrimSpace(target)
	senderAPI := message.NewSender(api)

	var err error
	var updates tg.UpdatesClass

	if strings.HasPrefix(cleanTarget, "@") || (!strings.HasPrefix(cleanTarget, "+") && !isNumeric(cleanTarget)) {
		username := strings.TrimPrefix(cleanTarget, "@")
		updates, err = senderAPI.Resolve(username).Text(ctx, text)
	} else if strings.HasPrefix(cleanTarget, "+") {
		contact, errImport := m.importSingleContact(ctx, cleanTarget)
		if errImport == nil && contact != nil {
			updates, err = senderAPI.To(&tg.InputPeerUser{
				UserID:     contact.ID,
				AccessHash: contact.AccessHash,
			}).Text(ctx, text)
		} else {
			updates, err = senderAPI.Resolve(cleanTarget).Text(ctx, text)
		}
	} else {
		idInt, parseErr := strconv.ParseInt(cleanTarget, 10, 64)
		if parseErr != nil {
			return nil, fmt.Errorf("format target tidak valid: %s", target)
		}
		peerObj, peerErr := m.findInputPeer(ctx, idInt)
		if peerErr != nil {
			return &SendMessageResponse{
				Success: false,
				Error:   peerErr.Error(),
			}, peerErr
		}
		updates, err = senderAPI.To(peerObj).Text(ctx, text)
	}
	if err != nil {
		return &SendMessageResponse{
			Success: false,
			Error:   err.Error(),
		}, err
	}

	// Broadcast outgoing message to WS
	msgItem := MessageItem{
		ChatTitle: target,
		Text:      text,
		Date:      time.Now(),
		IsOut:     true,
		ChatType:  "user",
	}

	m.mu.Lock()
	m.recentMessages = append(m.recentMessages, msgItem)
	if len(m.recentMessages) > 100 {
		m.recentMessages = m.recentMessages[len(m.recentMessages)-100:]
	}
	m.mu.Unlock()

	m.hub.BroadcastEvent("new_message", msgItem)

	_ = client
	_ = updates

	return &SendMessageResponse{
		Success: true,
		Message: "Message sent successfully",
	}, nil
}

func (m *Manager) importSingleContact(ctx context.Context, phone string) (*tg.User, error) {
	res, err := m.api.ContactsImportContacts(ctx, []tg.InputPhoneContact{
		{
			ClientID:  1,
			Phone:     phone,
			FirstName: "Contact",
			LastName:  phone,
		},
	})
	if err != nil {
		return nil, err
	}

	if len(res.Users) > 0 {
		if u, ok := res.Users[0].(*tg.User); ok {
			return u, nil
		}
	}
	return nil, fmt.Errorf("user not found for phone %s", phone)
}

func (m *Manager) findInputPeer(ctx context.Context, id int64) (tg.InputPeerClass, error) {
	if m.api == nil {
		return nil, fmt.Errorf("api client is nil")
	}

	// 1. Search in Dialogs
	res, err := m.api.MessagesGetDialogs(ctx, &tg.MessagesGetDialogsRequest{
		OffsetPeer: &tg.InputPeerEmpty{},
		Limit:      100,
	})
	if err == nil {
		switch d := res.(type) {
		case *tg.MessagesDialogs:
			for _, u := range d.Users {
				if user, ok := u.(*tg.User); ok && user.ID == id {
					return &tg.InputPeerUser{
						UserID:     user.ID,
						AccessHash: user.AccessHash,
					}, nil
				}
			}
			for _, c := range d.Chats {
				if chat, ok := c.(*tg.Chat); ok && chat.ID == id {
					return &tg.InputPeerChat{ChatID: chat.ID}, nil
				}
				if ch, ok := c.(*tg.Channel); ok && ch.ID == id {
					return &tg.InputPeerChannel{ChannelID: ch.ID, AccessHash: ch.AccessHash}, nil
				}
			}
		case *tg.MessagesDialogsSlice:
			for _, u := range d.Users {
				if user, ok := u.(*tg.User); ok && user.ID == id {
					return &tg.InputPeerUser{
						UserID:     user.ID,
						AccessHash: user.AccessHash,
					}, nil
				}
			}
			for _, c := range d.Chats {
				if chat, ok := c.(*tg.Chat); ok && chat.ID == id {
					return &tg.InputPeerChat{ChatID: chat.ID}, nil
				}
				if ch, ok := c.(*tg.Channel); ok && ch.ID == id {
					return &tg.InputPeerChannel{ChannelID: ch.ID, AccessHash: ch.AccessHash}, nil
				}
			}
		}
	}

	// 2. Search in Contacts
	contacts, err := m.api.ContactsGetContacts(ctx, 0)
	if err == nil {
		if cList, ok := contacts.(*tg.ContactsContacts); ok {
			for _, u := range cList.Users {
				if user, ok := u.(*tg.User); ok && user.ID == id {
					return &tg.InputPeerUser{
						UserID:     user.ID,
						AccessHash: user.AccessHash,
					}, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("user ID %d belum pernah berinteraksi/tidak ada di kontak/dialog. Di Telegram MTProto, untuk orang baru wajib gunakan @username atau nomor HP (+62...)", id)
}

func (m *Manager) GetRecentMessages() []MessageItem {
	m.mu.RLock()
	defer m.mu.RUnlock()

	copied := make([]MessageItem, len(m.recentMessages))
	copy(copied, m.recentMessages)
	return copied
}

func (m *Manager) GetChatHistory(ctx context.Context, target string, limit int) ([]MessageItem, error) {
	m.mu.RLock()
	api := m.api
	state := m.state
	m.mu.RUnlock()

	if state != StateReady || api == nil {
		return nil, fmt.Errorf("client not connected")
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	cleanTarget := strings.TrimSpace(target)
	var inputPeer tg.InputPeerClass
	var err error

	if strings.HasPrefix(cleanTarget, "@") || (!strings.HasPrefix(cleanTarget, "+") && !isNumeric(cleanTarget)) {
		username := strings.TrimPrefix(cleanTarget, "@")
		resolved, errRes := api.ContactsResolveUsername(ctx, &tg.ContactsResolveUsernameRequest{Username: username})
		if errRes != nil {
			return nil, fmt.Errorf("failed to resolve username %s: %w", username, errRes)
		}
		if len(resolved.Users) > 0 {
			if u, ok := resolved.Users[0].(*tg.User); ok {
				inputPeer = &tg.InputPeerUser{UserID: u.ID, AccessHash: u.AccessHash}
			}
		} else if len(resolved.Chats) > 0 {
			if ch, ok := resolved.Chats[0].(*tg.Channel); ok {
				inputPeer = &tg.InputPeerChannel{ChannelID: ch.ID, AccessHash: ch.AccessHash}
			} else if chat, ok := resolved.Chats[0].(*tg.Chat); ok {
				inputPeer = &tg.InputPeerChat{ChatID: chat.ID}
			}
		}
	} else if strings.HasPrefix(cleanTarget, "+") {
		contact, errImport := m.importSingleContact(ctx, cleanTarget)
		if errImport != nil {
			return nil, errImport
		}
		inputPeer = &tg.InputPeerUser{UserID: contact.ID, AccessHash: contact.AccessHash}
	} else {
		idInt, parseErr := strconv.ParseInt(cleanTarget, 10, 64)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid chat ID: %s", target)
		}
		inputPeer, err = m.findInputPeer(ctx, idInt)
		if err != nil {
			return nil, err
		}
	}

	if inputPeer == nil {
		return nil, fmt.Errorf("unable to resolve peer for %s", target)
	}

	res, err := api.MessagesGetHistory(ctx, &tg.MessagesGetHistoryRequest{
		Peer:  inputPeer,
		Limit: limit,
	})
	if err != nil {
		return nil, err
	}

	var msgsList []tg.MessageClass
	var usersMap = make(map[int64]*tg.User)

	switch d := res.(type) {
	case *tg.MessagesMessages:
		msgsList = d.Messages
		for _, u := range d.Users {
			if user, ok := u.(*tg.User); ok {
				usersMap[user.ID] = user
			}
		}
	case *tg.MessagesMessagesSlice:
		msgsList = d.Messages
		for _, u := range d.Users {
			if user, ok := u.(*tg.User); ok {
				usersMap[user.ID] = user
			}
		}
	case *tg.MessagesChannelMessages:
		msgsList = d.Messages
		for _, u := range d.Users {
			if user, ok := u.(*tg.User); ok {
				usersMap[user.ID] = user
			}
		}
	}

	result := make([]MessageItem, 0, len(msgsList))
	for _, mClass := range msgsList {
		msg, ok := mClass.(*tg.Message)
		if !ok {
			continue
		}

		senderName := "Unknown"
		senderUsername := ""
		var senderID int64 = 0

		if msg.FromID != nil {
			if peerUser, ok := msg.FromID.(*tg.PeerUser); ok {
				senderID = peerUser.UserID
				if u, ok := usersMap[senderID]; ok {
					senderName = strings.TrimSpace(fmt.Sprintf("%s %s", u.FirstName, u.LastName))
					senderUsername = u.Username
				}
			}
		}

		item := MessageItem{
			ID:             msg.ID,
			SenderID:       senderID,
			SenderName:     senderName,
			SenderUsername: senderUsername,
			Text:           msg.Message,
			Date:           time.Unix(int64(msg.Date), 0),
			IsOut:          msg.Out,
		}
		result = append(result, item)
	}

	// Reverse so oldest is first for natural chat chronological order
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result, nil
}

func (m *Manager) GetDialogs(ctx context.Context, limit int) ([]DialogItem, error) {
	m.mu.RLock()
	api := m.api
	state := m.state
	m.mu.RUnlock()

	if state != StateReady || api == nil {
		return nil, fmt.Errorf("client not connected")
	}

	if limit <= 0 || limit > 100 {
		limit = 30
	}

	res, err := api.MessagesGetDialogs(ctx, &tg.MessagesGetDialogsRequest{
		OffsetPeer: &tg.InputPeerEmpty{},
		Limit:      limit,
	})
	if err != nil {
		return nil, err
	}

	var dialogsList []tg.DialogClass
	var usersMap = make(map[int64]*tg.User)
	var chatsMap = make(map[int64]tg.ChatClass)
	var messagesMap = make(map[int]tg.MessageClass)

	switch d := res.(type) {
	case *tg.MessagesDialogs:
		dialogsList = d.Dialogs
		for _, u := range d.Users {
			if user, ok := u.(*tg.User); ok {
				usersMap[user.ID] = user
			}
		}
		for _, c := range d.Chats {
			chatsMap[c.GetID()] = c
		}
		for _, msg := range d.Messages {
			messagesMap[msg.GetID()] = msg
		}
	case *tg.MessagesDialogsSlice:
		dialogsList = d.Dialogs
		for _, u := range d.Users {
			if user, ok := u.(*tg.User); ok {
				usersMap[user.ID] = user
			}
		}
		for _, c := range d.Chats {
			chatsMap[c.GetID()] = c
		}
		for _, msg := range d.Messages {
			messagesMap[msg.GetID()] = msg
		}
	}

	result := make([]DialogItem, 0, len(dialogsList))
	for _, dlgClass := range dialogsList {
		dlg, ok := dlgClass.(*tg.Dialog)
		if !ok {
			continue
		}

		item := DialogItem{
			UnreadCount: dlg.UnreadCount,
		}

		// Find last message text and date
		if topMsg, ok := messagesMap[dlg.TopMessage]; ok {
			if mFull, ok := topMsg.(*tg.Message); ok {
				item.LastMessage = mFull.Message
				item.LastMessageDate = time.Unix(int64(mFull.Date), 0)
			}
		}

		switch peer := dlg.Peer.(type) {
		case *tg.PeerUser:
			item.ID = peer.UserID
			item.Type = "user"
			if u, exists := usersMap[peer.UserID]; exists {
				item.Title = fmt.Sprintf("%s %s", u.FirstName, u.LastName)
				item.Title = strings.TrimSpace(item.Title)
				if item.Title == "" {
					item.Title = "Unknown User"
				}
				item.Username = u.Username
			}
		case *tg.PeerChat:
			item.ID = peer.ChatID
			item.Type = "chat"
			if c, exists := chatsMap[peer.ChatID]; exists {
				if chat, ok := c.(*tg.Chat); ok {
					item.Title = chat.Title
				}
			}
		case *tg.PeerChannel:
			item.ID = peer.ChannelID
			item.Type = "channel"
			if c, exists := chatsMap[peer.ChannelID]; exists {
				if ch, ok := c.(*tg.Channel); ok {
					item.Title = ch.Title
					item.Username = ch.Username
				}
			}
		}

		result = append(result, item)
	}

	return result, nil
}

func (m *Manager) handleIncomingMessage(ctx context.Context, e tg.Entities, msgClass tg.MessageClass) error {
	msg, ok := msgClass.(*tg.Message)
	if !ok {
		return nil
	}

	senderName := "Unknown"
	senderUsername := ""
	var senderID int64 = 0

	if msg.FromID != nil {
		if peerUser, ok := msg.FromID.(*tg.PeerUser); ok {
			senderID = peerUser.UserID
			if u, ok := e.Users[senderID]; ok {
				senderName = strings.TrimSpace(fmt.Sprintf("%s %s", u.FirstName, u.LastName))
				senderUsername = u.Username
			}
		}
	}

	chatTitle := senderName
	chatType := "user"
	var chatID int64 = senderID

	if msg.PeerID != nil {
		switch p := msg.PeerID.(type) {
		case *tg.PeerUser:
			chatID = p.UserID
		case *tg.PeerChat:
			chatID = p.ChatID
			chatType = "group"
			if c, ok := e.Chats[chatID]; ok && c != nil {
				chatTitle = c.Title
			}
		case *tg.PeerChannel:
			chatID = p.ChannelID
			chatType = "channel"
			if c, ok := e.Channels[chatID]; ok && c != nil {
				chatTitle = c.Title
			}
		}
	}

	msgItem := MessageItem{
		ID:             msg.ID,
		ChatID:         chatID,
		ChatTitle:      chatTitle,
		SenderID:       senderID,
		SenderName:     senderName,
		SenderUsername: senderUsername,
		Text:           msg.Message,
		Date:           time.Unix(int64(msg.Date), 0),
		IsOut:          msg.Out,
		ChatType:       chatType,
	}

	m.mu.Lock()
	m.recentMessages = append(m.recentMessages, msgItem)
	if len(m.recentMessages) > 100 {
		m.recentMessages = m.recentMessages[len(m.recentMessages)-100:]
	}
	m.mu.Unlock()

	// Broadcast via WebSocket
	m.hub.BroadcastEvent("new_message", msgItem)

	// Check Auto-Reply if message is incoming from another user (not self and not outgoing)
	if !msg.Out && msg.Message != "" {
		if replyText, matched := m.autoReply.CheckMatch(msg.Message); matched {
			log.Printf("[AutoReply] Matched incoming message '%s', sending reply: '%s'", msg.Message, replyText)
			go func() {
				time.Sleep(500 * time.Millisecond) // realistic slight delay
				replyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				senderAPI := message.NewSender(m.api)
				_, err := senderAPI.Reply(e, &tg.UpdateNewMessage{Message: msg}).Text(replyCtx, replyText)
				if err != nil {
					log.Printf("[AutoReply] Failed to send reply: %v", err)
				}
			}()
		}
	}

	return nil
}

func isNumeric(s string) bool {
	_, err := strconv.ParseInt(s, 10, 64)
	return err == nil
}
