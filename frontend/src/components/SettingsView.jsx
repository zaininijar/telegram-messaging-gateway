import React, { useState } from 'react';
import { api } from '../services/api';
import { Shield, KeyRound, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function SettingsView({ status, onConfigUpdated }) {
  const [appId, setAppId] = useState(status?.app_id || '');
  const [appHash, setAppHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!appId || !appHash) return;
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      await api.updateConfig(appId, appHash);
      setMsg('Konfigurasi API berhasil diperbarui!');
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground tracking-tight">Pengaturan & Kredensial</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kelola kredensial API Telegram resmi (MTProto) dan informasi status runtime gateway.
        </p>
      </div>

      {msg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-destructive/15 border border-destructive/30 rounded-xl flex items-center space-x-2 text-destructive-foreground text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* API Config Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-primary" />
            <CardTitle>Telegram App API Credentials</CardTitle>
          </div>
          <CardDescription>
            Kredensial dari portal developer Telegram (my.telegram.org) untuk autentikasi MTProto client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Telegram App API ID</label>
              <Input
                type="number"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Contoh: 31930628"
                className="font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Telegram App API Hash</label>
              <Input
                type="password"
                value={appHash}
                onChange={(e) => setAppHash(e.target.value)}
                placeholder="Masukkan API Hash baru..."
                className="font-mono text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="space-x-2 rounded-xl"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>Simpan Perubahan Kredensial</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* System info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Status Lingkungan Sistem</CardTitle>
          <CardDescription>Informasi runtime backend dan koneksi MTProto.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground block">Backend Server</span>
              <span className="font-semibold text-emerald-400 mt-1 block font-mono">Golang 1.24/1.25</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground block">Protocol Engine</span>
              <span className="font-semibold text-primary mt-1 block font-mono">gotd/td (MTProto)</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground block">Frontend Stack</span>
              <span className="font-semibold text-foreground mt-1 block font-mono">shadcn/ui + React</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground block">Live Streaming</span>
              <span className="font-semibold text-amber-400 mt-1 block font-mono">WebSocket Hub</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
