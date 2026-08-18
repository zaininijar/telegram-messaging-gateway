import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

export default function ApiDocsView() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeLang, setActiveLang] = useState('curl');

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const curlExample = `curl -X POST http://localhost:8080/api/send-message \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "@username_or_phone",
    "message": "Halo! Pesanan Anda telah dikirim."
  }'`;

  const nodeExample = `import axios from 'axios';

async function sendTelegramMessage() {
  try {
    const response = await axios.post('http://localhost:8080/api/send-message', {
      to: '@username_or_phone',
      message: 'Halo dari Node.js backend!'
    });
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendTelegramMessage();`;

  const pythonExample = `import requests

url = "http://localhost:8080/api/send-message"
payload = {
    "to": "@username_or_phone",
    "message": "Halo dari Python backend!"
}

response = requests.post(url, json=payload)
print(response.json())`;

  const goExample = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	body, _ := json.Marshal(map[string]string{
		"to":      "@username_or_phone",
		"message": "Halo dari Golang microservice!",
	})

	resp, err := http.Post("http://localhost:8080/api/send-message", "application/json", bytes.NewBuffer(body))
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	fmt.Println("Status:", resp.Status)
}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground tracking-tight">REST API Integration Guide</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gunakan Go backend ini sebagai gateway personal untuk mengirim pesan Telegram dari aplikasi lain (CRM, Webhook, Laravel, Node.js, Python).
        </p>
      </div>

      {/* Endpoints Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Daftar Endpoint REST API</CardTitle>
          <CardDescription>Endpoint yang dapat diakses secara langsung dari backend atau service Anda.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground bg-muted/30">
                  <th className="py-2.5 px-5 font-medium">Method</th>
                  <th className="py-2.5 px-5 font-medium">Endpoint</th>
                  <th className="py-2.5 px-5 font-medium">Deskripsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                <tr className="hover:bg-muted/20">
                  <td className="py-3 px-5">
                    <Badge variant="success" className="font-mono font-bold">POST</Badge>
                  </td>
                  <td className="py-3 px-5 font-mono text-primary font-medium">/api/send-message</td>
                  <td className="py-3 px-5 text-muted-foreground">Kirim pesan ke @username, nomor HP (+62...), atau User ID</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="py-3 px-5">
                    <Badge variant="info" className="font-mono font-bold">GET</Badge>
                  </td>
                  <td className="py-3 px-5 font-mono text-foreground">/api/messages?chat_id=...</td>
                  <td className="py-3 px-5 text-muted-foreground">Ambil riwayat obrolan (chat history) pesan masa lalu</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="py-3 px-5">
                    <Badge variant="info" className="font-mono font-bold">GET</Badge>
                  </td>
                  <td className="py-3 px-5 font-mono text-foreground">/api/dialogs</td>
                  <td className="py-3 px-5 text-muted-foreground">Ambil daftar kontak dan obrolan terakhir</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="py-3 px-5">
                    <Badge variant="info" className="font-mono font-bold">GET</Badge>
                  </td>
                  <td className="py-3 px-5 font-mono text-foreground">/api/status</td>
                  <td className="py-3 px-5 text-muted-foreground">Cek status koneksi dan profil akun Telegram aktif</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="py-3 px-5">
                    <Badge variant="secondary" className="font-mono font-bold text-sky-400">WS</Badge>
                  </td>
                  <td className="py-3 px-5 font-mono text-foreground">/api/ws</td>
                  <td className="py-3 px-5 text-muted-foreground">WebSocket event stream untuk pesan masuk secara real-time</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Code Snippets Card */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-primary" />
              <CardTitle>Contoh Pemanggilan (POST /api/send-message)</CardTitle>
            </div>
            <CardDescription>Pilih bahasa pemrograman favorit Anda untuk melihat contoh kodenya.</CardDescription>
          </div>

          <Tabs value={activeLang} onValueChange={setActiveLang} className="w-auto">
            <TabsList className="h-8">
              {['curl', 'node', 'python', 'go'].map((lang) => (
                <TabsTrigger key={lang} value={lang} className="text-xs uppercase h-6 px-3">
                  {lang}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const code =
                  activeLang === 'curl'
                    ? curlExample
                    : activeLang === 'node'
                    ? nodeExample
                    : activeLang === 'python'
                    ? pythonExample
                    : goExample;
                copyToClipboard(code, activeLang);
              }}
              className="absolute right-3 top-3 h-7 text-xs space-x-1 rounded-lg bg-background/80 backdrop-blur-sm"
            >
              {copiedKey === activeLang ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-medium">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Salin</span>
                </>
              )}
            </Button>

            <pre className="p-4 bg-muted/40 rounded-xl border border-border text-foreground font-mono text-xs overflow-x-auto leading-relaxed">
              {activeLang === 'curl' && curlExample}
              {activeLang === 'node' && nodeExample}
              {activeLang === 'python' && pythonExample}
              {activeLang === 'go' && goExample}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
