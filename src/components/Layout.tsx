import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar.js';
import { Navbar } from './Navbar.js';
import { useAuth } from '../context/AuthContext.js';

interface LayoutProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, onSelectTab, children }) => {
  const { isKasir } = useAuth();

  // Global Keyboard Shortcuts (F1, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Go to POS Kasir
      if (e.key === 'F1') {
        e.preventDefault();
        onSelectTab('pos');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTab]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Dynamic Sidebar with RBAC enforcement */}
      <Sidebar activeTab={activeTab} onSelectTab={onSelectTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onShortcutPOS={() => onSelectTab('pos')} />
        <main className="flex-1 flex overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
