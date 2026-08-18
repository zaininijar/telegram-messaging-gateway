import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Phone, 
  KeyRound, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from './ui/dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export default function LoginModal({ status, onLoginSuccess }) {
  const [authMethod, setAuthMethod] = useState('qr');
  const [step, setStep] = useState(
    status?.state === 'needs_password' ? 'password' :
    status?.state === 'needs_code' ? 'code' :
    (status?.app_id && status.app_id > 0) ? 'main' : 'config'
  );

  const [appId, setAppId] = useState(status?.app_id || '');
  const [appHash, setAppHash] = useState('');
  const [phone, setPhone] = useState(status?.phone_number || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [qrUrl, setQrUrl] = useState(status?.qr_code_url || '');
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const startQRFlow = async () => {
    setQrLoading(true);
    setError(null);
    try {
      const res = await api.startQR(appId || undefined, appHash || undefined);
      if (res.data?.qr_code_url) {
        setQrUrl(res.data.qr_code_url);
      }
    } catch (err) {
      console.error('QR start error:', err);
      setError(err.response?.data?.error || err.message || 'Gagal memulai QR login');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (status?.qr_code_url) {
      setQrUrl(status.qr_code_url);
    }
    if (status?.state === 'needs_password') {
      setStep('password');
      setInfo('QR Scanned / OTP verified! Masukkan password 2FA Anda.');
    }
  }, [status]);

  useEffect(() => {
    if (step === 'main' && authMethod === 'qr' && !qrUrl) {
      startQRFlow();
    }
  }, [step, authMethod, qrUrl]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      await api.sendCode(phone, appId, appHash);
      setInfo(`Kode OTP telah dikirimkan ke Telegram ${phone}`);
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Gagal mengirim OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.signIn(code);
      if (res.data?.state === 'needs_password') {
        setStep('password');
        setInfo('Akun Anda diproteksi Two-Step Verification (2FA). Silakan masukkan password.');
      } else {
        setInfo('Berhasil Login!');
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Kode OTP salah');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await api.submitPassword(password);
      setInfo('Berhasil Login!');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Password 2FA salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Hubungkan Akun Telegram</DialogTitle>
              <DialogDescription>
                Autentikasi resmi MTProto Client (Scan QR Code atau OTP)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-xl flex items-start space-x-2.5 text-destructive-foreground text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {info && !error && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start space-x-2.5 text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {/* STEP: API Configuration */}
        {step === 'config' && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border leading-relaxed">
              💡 Dapatkan <strong>App API ID</strong> & <strong>API Hash</strong> secara gratis di{' '}
              <a
                href="https://my.telegram.org"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium"
              >
                my.telegram.org
              </a>{' '}
              (Menu <em>API development tools</em>).
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Telegram API ID</label>
              <Input
                type="number"
                placeholder="Contoh: 31930628"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Telegram API Hash</label>
              <Input
                type="text"
                placeholder="Contoh: e7a12b489c0..."
                value={appHash}
                onChange={(e) => setAppHash(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            <Button
              type="button"
              onClick={() => {
                if (!appId || !appHash) {
                  setError('Harap isi API ID dan API Hash');
                  return;
                }
                setError(null);
                setStep('main');
                startQRFlow();
              }}
              className="w-full space-x-2 rounded-xl mt-2"
            >
              <span>Lanjut ke Autentikasi</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* STEP: Main Authentication (QR Code or Phone) */}
        {step === 'main' && (
          <div className="space-y-4">
            <Tabs value={authMethod} onValueChange={setAuthMethod} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="qr" className="space-x-1.5 text-xs">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR Code</span>
                </TabsTrigger>
                <TabsTrigger value="phone" className="space-x-1.5 text-xs">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Nomor HP & OTP</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* QR Code Screen */}
            {authMethod === 'qr' && (
              <div className="flex flex-col items-center space-y-4 py-1">
                <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center min-h-[190px] min-w-[190px]">
                  {qrUrl ? (
                    <QRCodeSVG
                      value={qrUrl}
                      size={175}
                      level="M"
                      includeMargin={false}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-800 space-y-2">
                      <RefreshCw className="w-7 h-7 animate-spin text-primary" />
                      <span className="text-[11px] font-mono text-slate-500">Membuat QR Code...</span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-muted/40 border border-border rounded-xl p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center space-x-2 font-semibold text-foreground">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span>Cara Scan dari HP Anda:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-muted-foreground pl-1 leading-relaxed">
                    <li>Buka aplikasi <strong>Telegram</strong> di HP</li>
                    <li>Buka <strong>Pengaturan &gt; Perangkat</strong></li>
                    <li>Pilih <strong>Hubungkan Perangkat Desktop</strong></li>
                    <li>Arahkan kamera ke QR Code di atas</li>
                  </ol>
                </div>

                <div className="flex items-center justify-between w-full pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('config')}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Ubah API Credentials
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startQRFlow}
                    disabled={qrLoading}
                    className="h-7 text-xs text-primary hover:text-primary space-x-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh QR</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Phone OTP Screen */}
            {authMethod === 'phone' && (
              <form onSubmit={handleSendCode} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Nomor HP Telegram (Format Internasional)
                  </label>
                  <Input
                    type="text"
                    placeholder="+6281234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="font-mono"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Pastikan diawali kode negara seperti +62</p>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('config')}
                    className="rounded-xl"
                  >
                    Kembali
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !phone}
                    className="flex-1 rounded-xl space-x-1.5"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    <span>Kirim Kode OTP</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP: OTP Code */}
        {step === 'code' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Kode Verifikasi (OTP)</label>
              <Input
                type="text"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-center tracking-widest text-sm"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Cek pesan masuk di aplikasi Telegram resmi di HP atau Desktop Anda.
              </p>
            </div>

            <div className="flex space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('main')}
                className="rounded-xl"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                disabled={loading || !code}
                className="flex-1 rounded-xl space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Verifikasi & Masuk</span>
              </Button>
            </div>
          </form>
        )}

        {/* STEP: 2FA Password */}
        {step === 'password' && (
          <form onSubmit={handleSubmitPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Password Two-Step Verification (2FA)
              </label>
              <Input
                type="password"
                placeholder="Masukkan password 2FA akun Telegram Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Konfirmasi Password</span>
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
