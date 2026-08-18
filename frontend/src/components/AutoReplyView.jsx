import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Bot, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from './ui/dialog';

export default function AutoReplyView() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [response, setResponse] = useState('');
  const [matchType, setMatchType] = useState('contains');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.getAutoReplies();
      if (res.data) setRules(res.data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggle = async (id) => {
    try {
      const res = await api.toggleAutoReply(id);
      setRules((prev) => prev.map((r) => (r.id === id ? res.data : r)));
    } catch (err) {
      alert('Gagal mengubah status rule');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus rule auto-reply ini?')) return;
    try {
      await api.deleteAutoReply(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert('Gagal menghapus rule');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!keyword.trim() || !response.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createAutoReply({
        keyword: keyword.trim(),
        response: response.trim(),
        match_type: matchType,
        is_active: true,
      });
      setRules((prev) => [...prev, res.data]);
      setKeyword('');
      setResponse('');
      setShowAddModal(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Gagal menambahkan rule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-foreground tracking-tight">Auto-Reply Engine</h2>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {rules.filter((r) => r.is_active).length} Aktif
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Balas pesan masuk dari pengguna lain secara otomatis berdasarkan pencocokan kata kunci.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="space-x-1.5 rounded-xl h-8 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Rule</span>
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex items-start space-x-3 text-xs">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">Cara Kerja Auto-Reply</p>
            <p className="text-muted-foreground leading-relaxed">
              Ketika ada pesan masuk dari pengguna lain yang cocok dengan keyword di bawah, backend Go akan membalas otomatis secara instan.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <Card
            key={rule.id}
            className={`transition-all ${
              rule.is_active ? 'bg-card border-border' : 'bg-card/40 border-border/40 opacity-60'
            }`}
          >
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {rule.keyword}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {rule.match_type}
                </Badge>
              </div>

              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggle(rule.id)}
                  className="h-7 w-7"
                  title={rule.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                >
                  {rule.is_active ? (
                    <ToggleRight className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(rule.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2">
              <span className="text-[10px] font-medium text-muted-foreground block mb-1">
                Teks Balasan Otomatis:
              </span>
              <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-xl border border-border/60 leading-relaxed font-sans">
                {rule.response}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Rule Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Rule Auto-Reply</DialogTitle>
            <DialogDescription>
              Tentukan kata kunci dan teks balasan yang akan dikirim secara otomatis.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-xl text-destructive-foreground text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-3.5 mt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Kata Kunci (Keyword)</label>
              <Input
                type="text"
                placeholder="Misal: ping, harga, halo"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Tipe Pencocokan</label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-background/50 px-3 py-1 text-xs text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value="contains">Contains (Mengandung kata)</option>
                <option value="exact">Exact (Sama persis)</option>
                <option value="starts_with">Starts With (Diawali kata)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Teks Balasan Otomatis</label>
              <Textarea
                rows={3}
                placeholder="Tulis pesan balasan otomatis di sini..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl space-x-1.5"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Simpan Rule</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
