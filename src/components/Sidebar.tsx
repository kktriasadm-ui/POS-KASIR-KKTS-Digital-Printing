import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  Hammer,
  Package,
  Boxes,
  Users,
  UserCog,
  BarChart3,
  Settings,
  Database,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { user, isKasir } = useAuth();

  // Kasir menu strictly only 4 items as per prompt specifications!
  const kasirMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS Kasir', icon: ShoppingCart },
    { id: 'transactions', label: 'Transaksi', icon: ReceiptText },
    { id: 'production', label: 'Produksi', icon: Hammer }
  ];

  // Admin / Owner full menu items
  const adminMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS Kasir', icon: ShoppingCart },
    { id: 'transactions', label: 'Transaksi', icon: ReceiptText },
    { id: 'production', label: 'Produksi', icon: Hammer },
    { id: 'products', label: 'Produk & BOM', icon: Package },
    { id: 'materials', label: 'Material & Stock', icon: Boxes },
    { id: 'customers', label: 'Customer', icon: Users },
    { id: 'users', label: 'User & Hak Akses', icon: UserCog },
    { id: 'reports', label: 'Laporan Lengkap', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan & Printer', icon: Settings },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'audit', label: 'Audit Log', icon: ShieldAlert }
  ];

  const menuItems = isKasir ? kasirMenuItems : adminMenuItems;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-sky-500/20">
            K
          </div>
          <div>
            <h1 className="font-extrabold text-white text-base tracking-tight leading-tight">KKTS</h1>
            <p className="text-[10px] font-semibold text-sky-400 tracking-wider uppercase">Digital Printing</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isKasir ? 'Menu Kasir (Terbatas)' : 'Menu Utama & Manajemen'}
        </div>

        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Role Badge Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800/50">
          <div>
            <p className="text-xs font-bold text-white truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 font-medium">{user?.role === 'ADMIN' ? 'Owner / Administrator' : 'Kasir Operasional'}</p>
          </div>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
            user?.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
          }`}>
            {user?.role}
          </span>
        </div>
      </div>
    </aside>
  );
};
