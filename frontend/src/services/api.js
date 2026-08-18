import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Status & Config
  getStatus: () => client.get('/api/status').then(res => res.data),
  updateConfig: (appId, appHash) => client.post('/api/config', { app_id: parseInt(appId), app_hash: appHash }).then(res => res.data),

  // Auth Flow
  startQR: (appId, appHash) => client.post('/api/auth/qr', {
    app_id: appId ? parseInt(appId) : undefined,
    app_hash: appHash || undefined,
  }).then(res => res.data),
  sendCode: (phone, appId, appHash) => client.post('/api/auth/send-code', {
    phone,
    app_id: appId ? parseInt(appId) : undefined,
    app_hash: appHash || undefined,
  }).then(res => res.data),
  signIn: (code) => client.post('/api/auth/sign-in', { code }).then(res => res.data),
  submitPassword: (password) => client.post('/api/auth/password', { password }).then(res => res.data),
  logout: () => client.post('/api/auth/logout').then(res => res.data),

  // Messaging & Dialogs
  sendMessage: (to, message) => client.post('/api/send-message', { to, message }).then(res => res.data),
  getDialogs: (limit = 30) => client.get(`/api/dialogs?limit=${limit}`).then(res => res.data),
  getChatHistory: (chatId, limit = 50) => client.get(`/api/messages?chat_id=${encodeURIComponent(chatId)}&limit=${limit}`).then(res => res.data),
  getRecentMessages: () => client.get('/api/messages/recent').then(res => res.data),

  // Auto-Reply Rules
  getAutoReplies: () => client.get('/api/auto-replies').then(res => res.data),
  createAutoReply: (data) => client.post('/api/auto-replies', data).then(res => res.data),
  toggleAutoReply: (id) => client.put(`/api/auto-replies/${id}/toggle`).then(res => res.data),
  deleteAutoReply: (id) => client.delete(`/api/auto-replies/${id}`).then(res => res.data),
};

export function createWebSocketConnection(onMessage, onStatusChange) {
  const wsUrl = API_BASE.replace(/^http/, 'ws') + '/api/ws';
  let socket = null;
  let retryTimeout = null;

  function connect() {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('⚡ Connected to Telegram Gateway WebSocket');
      if (onStatusChange) onStatusChange('connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    socket.onclose = () => {
      console.log('WS Connection closed, reconnecting in 3s...');
      if (onStatusChange) onStatusChange('disconnected');
      retryTimeout = setTimeout(connect, 3000);
    };

    socket.onerror = (err) => {
      console.error('WS Error:', err);
      socket.close();
    };
  }

  connect();

  return () => {
    if (retryTimeout) clearTimeout(retryTimeout);
    if (socket) socket.close();
  };
}
