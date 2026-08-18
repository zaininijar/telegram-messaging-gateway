import React, { useState, useEffect } from 'react';
import { api, createWebSocketConnection } from './services/api';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import GatewaySender from './components/GatewaySender';
import AutoReplyView from './components/AutoReplyView';
import ApiDocsView from './components/ApiDocsView';
import SettingsView from './components/SettingsView';
import LoginModal from './components/LoginModal';

export default function App() {
  const [status, setStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('chats');
  const [recentMessages, setRecentMessages] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await api.getStatus();
      if (res.data) {
        setStatus(res.data);
        if (res.data.state !== 'ready') {
          setShowLoginModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentMessages = async () => {
    try {
      const res = await api.getRecentMessages();
      if (res.data) {
        setRecentMessages(res.data);
      }
    } catch (err) {
      console.error('Failed to load recent messages:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRecentMessages();

    // Setup WebSocket connection
    const cleanupWs = createWebSocketConnection(
      (event) => {
        if (event.type === 'status_change') {
          setStatus(event.payload);
          if (event.payload?.state === 'ready') {
            setShowLoginModal(false);
          }
        } else if (event.type === 'qr_code') {
          setStatus((prev) => ({
            ...prev,
            qr_code_url: event.payload?.url,
          }));
        } else if (event.type === 'new_message') {
          setRecentMessages((prev) => [...prev, event.payload]);
        }
      },
      (state) => {
        setWsStatus(state);
      }
    );

    return () => {
      cleanupWs();
    };
  }, []);

  const handleLogout = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan akun Telegram ini?')) return;
    try {
      await api.logout();
      setStatus({ state: 'disconnected' });
      setShowLoginModal(true);
    } catch (err) {
      alert('Gagal logout: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center text-muted-foreground space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Memuat Telegram Gateway...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden select-none font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        status={status}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onOpenLogin={() => setShowLoginModal(true)}
        wsStatus={wsStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'chats' && (
          <ChatView
            status={status}
            recentMessages={recentMessages}
            onSendMessage={fetchRecentMessages}
          />
        )}
        {activeTab === 'gateway' && <GatewaySender />}
        {activeTab === 'autoreply' && <AutoReplyView />}
        {activeTab === 'docs' && <ApiDocsView />}
        {activeTab === 'settings' && (
          <SettingsView status={status} onConfigUpdated={fetchStatus} />
        )}
      </main>

      {/* Login / Auth Modal */}
      {(showLoginModal || (status && status.state !== 'ready')) && (
        <LoginModal
          status={status}
          onLoginSuccess={() => {
            setShowLoginModal(false);
            fetchStatus();
          }}
        />
      )}
    </div>
  );
}
