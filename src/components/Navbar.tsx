import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, Clock, Calendar, Sparkles } from 'lucide-react';
import { formatDate } from '../services/formatters.js';

interface NavbarProps {
  onShortcutPOS?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hh}:${mm}:${ss}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = formatDate(new Date().toISOString());

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs shrink-0 z-10 select-none">
      {/* Shortcut Badges */}
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 text-sky-700 font-semibold border border-sky-200">
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-sky-300 rounded shadow-2xs font-mono font-bold">F1</kbd>
          <span>POS</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-300 rounded shadow-2xs font-mono font-bold">F2</kbd>
          <span>Cari Produk</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-300 rounded shadow-2xs font-mono font-bold">F4</kbd>
          <span>Checkout</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-300 rounded shadow-2xs font-mono font-bold">ESC</kbd>
          <span>Tutup Modal</span>
        </span>
      </div>

      {/* Right side: Live Date & Time + User & Logout */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>{todayStr}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            <span>{currentTime}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-bold text-slate-900">{user?.name}</span>
              <Sparkles className="w-3 h-3 text-sky-500" />
            </div>
            <p className="text-[10px] text-slate-500 font-medium">@{user?.username} ({user?.role})</p>
          </div>

          <button
            onClick={logout}
            title="Keluar dari sistem"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
