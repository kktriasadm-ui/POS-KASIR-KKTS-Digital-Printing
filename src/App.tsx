import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { Layout } from './components/Layout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { POSPage } from './pages/POSPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { ProductionPage } from './pages/ProductionPage.js';
import { ProductsPage } from './pages/ProductsPage.js';
import { MaterialsPage } from './pages/MaterialsPage.js';
import { CustomersPage } from './pages/CustomersPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { BackupPage } from './pages/BackupPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';

export const App: React.FC = () => {
  const { user, isLoading, isKasir } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('pos'); // Default to POS Kasir!

  // Kasir navigation guard: strictly restricted to 4 menus!
  useEffect(() => {
    if (isKasir) {
      const allowedKasirTabs = ['dashboard', 'pos', 'transactions', 'production'];
      if (!allowedKasirTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    }
  }, [isKasir, activeTab]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-black text-2xl shadow-lg animate-pulse">
          K
        </div>
        <div className="text-sm font-bold tracking-tight">KKTS DIGITAL PRINTING</div>
        <div className="text-xs text-sky-400 font-medium">Memuat sistem...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout activeTab={activeTab} onSelectTab={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardPage onNavigateToPOS={() => setActiveTab('pos')} />}
      {activeTab === 'pos' && <POSPage />}
      {activeTab === 'transactions' && <TransactionsPage />}
      {activeTab === 'production' && <ProductionPage />}
      {activeTab === 'products' && !isKasir && <ProductsPage />}
      {activeTab === 'materials' && !isKasir && <MaterialsPage />}
      {activeTab === 'customers' && !isKasir && <CustomersPage />}
      {activeTab === 'users' && !isKasir && <UsersPage />}
      {activeTab === 'reports' && !isKasir && <ReportsPage />}
      {activeTab === 'settings' && !isKasir && <SettingsPage />}
      {activeTab === 'backup' && !isKasir && <BackupPage />}
      {activeTab === 'audit' && !isKasir && <AuditLogsPage />}
    </Layout>
  );
};

export default App;
