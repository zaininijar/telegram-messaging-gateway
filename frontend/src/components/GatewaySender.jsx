import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  SendHorizontal, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  FileText,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export default function GatewaySender() {
  const [activeMode, setActiveMode] = useState('single');

  // Single Sender State
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleLogs, setSingleLogs] = useState([]);

  // Broadcast Sender State
  const [recipientsText, setRecipientsText] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const templates = [
    {
      title: 'Kode OTP / Verifikasi',
      text: '🔒 [Aplikasi Anda] Kode OTP verifikasi Anda adalah: 829104. Berlaku selama 5 menit. Jangan bagikan kepada siapapun.',
    },
    {
      title: 'Konfirmasi Pesanan',
      text: '📦 Halo kak! Pesanan #ORD-9821 telah berhasil dikonfirmasi dan sedang diproses tim logistik. Terima kasih!',
    },
    {
      title: 'Reminder Jadwal',
      text: '⏰ Pengingat: Jadwal meeting Anda akan dimulai dalam 15 menit. Link Zoom: https://zoom.us/j/12345678',
    },
  ];

  const handleSingleSend = async (e) => {
    e.preventDefault();
    if (!recipient.trim() || !message.trim()) return;

    setSingleLoading(true);
    const timestamp = new Date().toLocaleTimeString();
    try {
      const res = await api.sendMessage(recipient.trim(), message.trim());
      setSingleLogs((prev) => [
        {
          id: Date.now(),
          time: timestamp,
          success: true,
          to: recipient,
          text: message,
          info: res.message || 'Terkirim',
        },
        ...prev,
      ]);
      setMessage('');
    } catch (err) {
      setSingleLogs((prev) => [
        {
          id: Date.now(),
          time: timestamp,
          success: false,
          to: recipient,
          text: message,
          info: err.response?.data?.error || err.message,
        },
        ...prev,
      ]);
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const list = recipientsText
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);

    if (list.length === 0 || !broadcastMessage.trim()) return;

    setBroadcasting(true);
    setProgress({ current: 0, total: list.length });
    setBroadcastLogs([]);

    for (let i = 0; i < list.length; i++) {
      const target = list[i];
      const timestamp = new Date().toLocaleTimeString();
      try {
        const res = await api.sendMessage(target, broadcastMessage.trim());
        setBroadcastLogs((prev) => [
          {
            id: Date.now() + i,
            time: timestamp,
            success: true,
            to: target,
            info: res.message || 'Sukses',
          },
          ...prev,
        ]);
      } catch (err) {
        setBroadcastLogs((prev) => [
          {
            id: Date.now() + i,
            time: timestamp,
            success: false,
            to: target,
            info: err.response?.data?.error || err.message,
          },
          ...prev,
        ]);
      }
      setProgress({ current: i + 1, total: list.length });

      if (i < list.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    setBroadcasting(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">Direct Gateway (REST Sender)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kirim pesan langsung ke username (@username), nomor HP (+62...), atau User ID melalui REST Gateway.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <Tabs value={activeMode} onValueChange={setActiveMode} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="single" className="text-xs space-x-1.5 h-6 px-3">
              <SendHorizontal className="w-3.5 h-3.5" />
              <span>Single Direct</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="text-xs space-x-1.5 h-6 px-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Bulk Broadcast</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-4">
          {activeMode === 'single' ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Kirim Pesan Satuan</CardTitle>
                <CardDescription>Endpoint REST API: <code>POST /api/send-message</code></CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSingleSend} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Penerima (@username, Nomor HP, atau ID)
                    </label>
                    <Input
                      type="text"
                      placeholder="Contoh: @username_tujuan atau +6281234567890"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="font-mono text-xs"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-foreground">Isi Pesan</label>
                      <span className="text-[11px] text-muted-foreground font-mono">{message.length} karakter</span>
                    </div>
                    <Textarea
                      rows={5}
                      placeholder="Tuliskan isi pesan yang ingin dikirim..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>

                  {/* Quick Templates */}
                  <div>
                    <div className="text-[11px] text-muted-foreground font-medium mb-1.5 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Template Cepat:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {templates.map((tpl, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMessage(tpl.text)}
                          className="h-7 text-[11px] px-2.5 rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          {tpl.title}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={singleLoading || !recipient || !message}
                    className="w-full space-x-2 rounded-xl"
                  >
                    {singleLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="w-4 h-4" />
                    )}
                    <span>Kirim Pesan Sekarang (POST /api/send-message)</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Kirim Pesan Massal (Broadcast)</CardTitle>
                <CardDescription>Kirim pesan beruntun dengan proteksi jeda anti-spam.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBroadcast} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-foreground">
                        Daftar Target Penerima (1 baris per target)
                      </label>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {recipientsText.split('\n').filter(Boolean).length} kontak
                      </Badge>
                    </div>
                    <Textarea
                      rows={4}
                      placeholder={`@user_satu\n+6281234567890\n@user_dua`}
                      value={recipientsText}
                      onChange={(e) => setRecipientsText(e.target.value)}
                      className="font-mono text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Isi Pesan Broadcast</label>
                    <Textarea
                      rows={4}
                      placeholder="Tuliskan pesan broadcast..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      required
                    />
                  </div>

                  <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-foreground">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>Jeda Anti-Spam (Delay)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="2"
                        max="15"
                        value={delaySeconds}
                        onChange={(e) => setDelaySeconds(parseInt(e.target.value))}
                        className="w-24 accent-primary"
                      />
                      <span className="text-xs font-mono font-bold text-primary w-8 text-right">
                        {delaySeconds}s
                      </span>
                    </div>
                  </div>

                  {broadcasting && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Proses Pengiriman...</span>
                        <span>
                          {progress.current} / {progress.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${(progress.current / (progress.total || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={broadcasting || !recipientsText || !broadcastMessage}
                    className="w-full space-x-2 rounded-xl"
                  >
                    {broadcasting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Layers className="w-4 h-4" />
                    )}
                    <span>Mulai Kirim Broadcast ({delaySeconds}s interval)</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dispatch Log Column */}
        <div className="lg:col-span-5">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span>Log Pengiriman API</span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-[450px]">
              {((activeMode === 'single' ? singleLogs : broadcastLogs).length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs py-16">
                  <FileText className="w-8 h-8 opacity-30 mb-2" />
                  <p>Belum ada log pengiriman</p>
                </div>
              ) : (
                (activeMode === 'single' ? singleLogs : broadcastLogs).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start space-x-3 text-xs">
                    {log.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-foreground font-medium truncate">{log.to}</span>
                        <span className="text-[10px] text-muted-foreground">{log.time}</span>
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          log.success ? 'text-emerald-400' : 'text-destructive'
                        }`}
                      >
                        {log.info}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
