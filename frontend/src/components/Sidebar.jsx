import React from 'react';
import { 
  MessageSquare, 
  SendHorizontal, 
  Bot, 
  Code2, 
  Settings, 
  LogOut, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

export default function Sidebar({ 
  status, 
  activeTab, 
  setActiveTab, 
  onLogout, 
  onOpenLogin,
  wsStatus 
}) {
  const isReady = status?.state === 'ready';
  const user = status?.user;

  const navItems = [
    { id: 'chats', label: 'Live Chats', icon: MessageSquare, badge: null },
    { id: 'gateway', label: 'Direct Gateway', icon: SendHorizontal, badge: 'REST' },
    { id: 'autoreply', label: 'Auto-Reply Rules', icon: Bot, badge: null },
    { id: 'docs', label: 'API Docs & cURL', icon: Code2, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 bg-card/60 border-r border-border flex flex-col flex-shrink-0 select-none backdrop-blur-xl">
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20 text-xs">
            TG
          </div>
          <div>
            <h1 className="text-xs font-bold text-foreground tracking-tight">Telegram Gateway</h1>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
              <span className="text-[10px] text-muted-foreground font-medium">
                {wsStatus === 'connected' ? 'WS Live' : 'WS Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Account Info Card */}
      <div className="p-3">
        {isReady && user ? (
          <div className="p-2.5 bg-muted/40 rounded-xl border border-border/70 flex items-center space-x-3">
            <Avatar className="w-9 h-9 border border-primary/30">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate flex items-center space-x-1">
                <span>{user.first_name} {user.last_name || ''}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              </div>
              <div className="text-[11px] text-muted-foreground truncate font-mono">
                {user.username ? `@${user.username}` : user.phone || 'Connected'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Belum Terhubung</span>
            </div>
            <Button
              size="sm"
              onClick={onOpenLogin}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs h-7 rounded-lg"
            >
              Login Akun Telegram
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Navigation Menu */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className="text-[10px] h-4 px-1.5 py-0"
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      {isReady && (
        <>
          <Separator />
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="w-full justify-center space-x-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8 rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Putuskan Akun (Logout)</span>
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
