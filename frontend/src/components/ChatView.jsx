import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Search, 
  Send, 
  User, 
  Users, 
  Radio, 
  RefreshCw, 
  MessageSquare,
  CheckCheck
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export default function ChatView({ recentMessages, onSendMessage, status }) {
  const [dialogs, setDialogs] = useState([]);
  const [filteredDialogs, setFilteredDialogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const loadDialogs = async () => {
    if (status && status.state !== 'ready') return;
    setLoading(true);
    try {
      const res = await api.getDialogs(50);
      if (res.data) {
        setDialogs(res.data);
        setFilteredDialogs(res.data);
        if (!selectedChat && res.data.length > 0) {
          setSelectedChat(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load dialogs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async (chat) => {
    if (!chat) return;
    const target = chat.username ? `@${chat.username}` : `${chat.id}`;
    setHistoryLoading(true);
    try {
      const res = await api.getChatHistory(target, 50);
      if (res.data) {
        setChatHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadDialogs();
  }, [status?.state]);

  useEffect(() => {
    if (selectedChat) {
      loadChatHistory(selectedChat);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDialogs(dialogs);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredDialogs(
        dialogs.filter(
          (d) =>
            d.title?.toLowerCase().includes(q) ||
            d.username?.toLowerCase().includes(q) ||
            d.last_message?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, dialogs]);

  // Combine fetched chat history and live incoming/outgoing WebSocket messages
  const displayedMessages = useMemo(() => {
    const map = new Map();

    chatHistory.forEach((m) => {
      const key = m.id ? `id-${m.id}` : `key-${m.date}-${m.text}`;
      map.set(key, m);
    });

    if (selectedChat) {
      recentMessages.forEach((m) => {
        const isMatch =
          m.chat_id === selectedChat.id ||
          m.chat_title === selectedChat.title ||
          (selectedChat.username && m.sender_username === selectedChat.username) ||
          m.chat_title === selectedChat.username ||
          m.chat_title === `@${selectedChat.username}`;
        if (isMatch) {
          const key = m.id ? `id-${m.id}` : `key-${m.date}-${m.text}`;
          map.set(key, m);
        }
      });
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [chatHistory, recentMessages, selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages, historyLoading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    const target = selectedChat.username
      ? `@${selectedChat.username}`
      : `${selectedChat.id}`;

    setSending(true);
    try {
      await api.sendMessage(target, messageText.trim());
      setMessageText('');
      if (onSendMessage) onSendMessage();
      setTimeout(() => loadChatHistory(selectedChat), 600);
    } catch (err) {
      alert('Gagal mengirim pesan: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-background">
      {/* Dialogs List Sidebar */}
      <div className="w-80 bg-card/40 border-r border-border flex flex-col flex-shrink-0">
        {/* Search & Refresh */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Obrolan & Kontak
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadDialogs}
              disabled={loading}
              className="h-7 w-7 rounded-lg"
              title="Refresh Chat"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Cari obrolan / username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 rounded-lg bg-muted/40"
            />
          </div>
        </div>

        <Separator />

        {/* Dialogs Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredDialogs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs">
              {loading ? 'Memuat riwayat chat...' : 'Tidak ada chat ditemukan'}
            </div>
          ) : (
            filteredDialogs.map((dialog) => {
              const isSelected = selectedChat?.id === dialog.id;
              return (
                <div
                  key={dialog.id}
                  onClick={() => setSelectedChat(dialog)}
                  className={`p-3 cursor-pointer transition-all flex items-start space-x-3 ${
                    isSelected
                      ? 'bg-accent/60 border-l-2 border-primary'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <Avatar className="w-9 h-9 border border-border/80">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                      {dialog.type === 'channel' ? (
                        <Radio className="w-3.5 h-3.5 text-sky-400" />
                      ) : dialog.type === 'chat' ? (
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        dialog.title ? dialog.title[0].toUpperCase() : <User className="w-3.5 h-3.5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground truncate">
                        {dialog.title || 'Chat'}
                      </h4>
                      {dialog.unread_count > 0 && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0 font-bold">
                          {dialog.unread_count}
                        </Badge>
                      )}
                    </div>
                    {dialog.username && (
                      <p className="text-[11px] text-primary truncate font-mono">@{dialog.username}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {dialog.last_message || 'Tidak ada pesan'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Conversation Feed */}
      <div className="flex-1 flex flex-col h-full bg-background/50">
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="px-6 py-3 bg-card/60 border-b border-border flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center space-x-3">
                <Avatar className="w-9 h-9 border border-primary/30">
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                    {selectedChat.title ? selectedChat.title[0].toUpperCase() : 'C'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">{selectedChat.title}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {selectedChat.username ? `@${selectedChat.username}` : `ID: ${selectedChat.id}`} • {selectedChat.type}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadChatHistory(selectedChat)}
                disabled={historyLoading}
                className="h-8 space-x-1.5 rounded-lg text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                <span>Refresh History</span>
              </Button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {historyLoading && displayedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <p>Mengambil riwayat pesan dari Telegram...</p>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
                  <MessageSquare className="w-8 h-8 opacity-40" />
                  <p>Belum ada riwayat pesan dalam obrolan ini.</p>
                  <p className="text-[11px] text-muted-foreground/60">Ketik pesan di bawah untuk memulai obrolan.</p>
                </div>
              ) : (
                displayedMessages.map((msg, idx) => {
                  const isOut = msg.is_out;
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                          isOut
                            ? 'bg-primary text-primary-foreground rounded-tr-xs shadow-sm font-normal'
                            : 'bg-muted/80 text-foreground rounded-tl-xs border border-border/80'
                        }`}
                      >
                        {!isOut && msg.sender_name && (
                          <div className="font-semibold text-[11px] text-primary mb-0.5">
                            {msg.sender_name}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                        <div
                          className={`text-[10px] mt-1 flex items-center justify-end space-x-1 ${
                            isOut ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          <span>
                            {new Date(msg.date).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isOut && <CheckCheck className="w-3 h-3 text-primary-foreground/80" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <Separator />

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 bg-card/40 flex items-center space-x-2">
              <Input
                type="text"
                placeholder={`Tulis pesan untuk ${selectedChat.title}...`}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="flex-1 h-9 rounded-xl"
              />
              <Button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="h-9 px-4 rounded-xl space-x-1.5 font-medium"
              >
                {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Kirim</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p>Pilih chat dari daftar di sebelah kiri untuk melihat pesan</p>
          </div>
        )}
      </div>
    </div>
  );
}
