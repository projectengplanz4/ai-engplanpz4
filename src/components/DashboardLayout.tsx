import { type ReactNode, useEffect, useState } from 'react';
import {
  Brain,
  LayoutDashboard,
  MessageSquare,
  Database,
  FileText,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkOllama } from '../lib/ollama';

export type View = 'dashboard' | 'chat' | 'data' | 'documents' | 'admin';

interface DashboardLayoutProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
  isAdmin?: boolean;
}

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat AI', icon: MessageSquare },
  { id: 'data', label: 'Manajemen Data', icon: Database },
  { id: 'documents', label: 'Dokumen', icon: FileText },
];

const adminNavItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'admin', label: 'Manajemen User', icon: Shield },
];

export function DashboardLayout({ currentView, onNavigate, children, isAdmin }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const ok = await checkOllama();
      if (active) setOllamaOnline(ok);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleNav = (view: View) => {
    onNavigate(view);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-slate-900 border-r border-slate-800">
        <SidebarContent
          currentView={currentView}
          onNavigate={handleNav}
          user={user?.email ?? ''}
          onSignOut={signOut}
          ollamaOnline={ollamaOnline}
          isAdmin={isAdmin}
        />
      </aside>

      {/* Sidebar - mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-slate-900 animate-slide-in">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent
              currentView={currentView}
              onNavigate={handleNav}
              user={user?.email ?? ''}
              onSignOut={signOut}
              ollamaOnline={ollamaOnline}
              isAdmin={isAdmin}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-teal-600" />
            <span className="font-semibold text-slate-900">AI Office</span>
          </div>
          <ConnectionBadge online={ollamaOnline} />
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  currentView,
  onNavigate,
  user,
  onSignOut,
  ollamaOnline,
  isAdmin,
}: {
  currentView: View;
  onNavigate: (v: View) => void;
  user: string;
  onSignOut: () => void;
  ollamaOnline: boolean | null;
  isAdmin?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/30">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">AI Office</p>
          <p className="text-slate-500 text-xs">Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="px-3 pb-2">
          <p className="px-3 text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Admin</p>
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="px-3 py-3 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50">
          {ollamaOnline === null ? (
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          ) : ollamaOnline ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-rose-400" />
          )}
          <span className="text-xs text-slate-400">
            {ollamaOnline === null
              ? 'Memeriksa Ollama...'
              : ollamaOnline
                ? 'Ollama terhubung'
                : 'Ollama tidak tersedia'}
          </span>
        </div>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white uppercase">
            {user.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300 truncate">{user}</p>
          </div>
          <button
            onClick={onSignOut}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function ConnectionBadge({ online }: { online: boolean | null }) {
  return (
    <div className="flex items-center gap-1.5">
      {online === null ? (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      ) : online ? (
        <Wifi className="w-4 h-4 text-emerald-500" />
      ) : (
        <WifiOff className="w-4 h-4 text-rose-500" />
      )}
    </div>
  );
}
