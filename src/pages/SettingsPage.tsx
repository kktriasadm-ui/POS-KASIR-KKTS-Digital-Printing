import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import { ReceiptData } from '../types/index.js';
import {
  Settings,
  Printer,
  Shield,
  Store,
  Save,
  Play
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [storeName, setStoreName] = useState('KKTS DIGITAL PRINTING');
  const [storeAddress, setStoreAddress] = useState('Jl. Grafika Percetakan Digital No. 88');
  const [storePhone, setStorePhone] = useState('0812-3456-7890');
  const [cashierReportScope, setCashierReportScope] = useState<'OWN_TRANSACTIONS' | 'ALL_STORE_TRANSACTIONS'>('OWN_TRANSACTIONS');
  const [allowNegativeStock, setAllowNegativeStock] = useState<string>('false');

  // Printer settings
  const [printerName, setPrinterName] = useState('IWARE C58AC');
  const [paperWidth, setPaperWidth] = useState('58mm');
  const [receiptFooter, setReceiptFooter] = useState('TERIMA KASIH ATAS KUNJUNGAN ANDA');

  // Test print receipt modal
  const [testReceipt, setTestReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.settings.get(),
      api.printer.getSettings()
    ]).then(([sRes, pRes]) => {
      const s = sRes.settings || {};
      if (s.store_name) setStoreName(s.store_name);
      if (s.store_address) setStoreAddress(s.store_address);
      if (s.store_phone) setStorePhone(s.store_phone);
      if (s.cashier_report_scope) setCashierReportScope(s.cashier_report_scope);
      if (s.allow_negative_stock) setAllowNegativeStock(s.allow_negative_stock);

      if (pRes.printerName) setPrinterName(pRes.printerName);
      if (pRes.paperWidth) setPaperWidth(pRes.paperWidth);
      if (pRes.receiptFooter) setReceiptFooter(pRes.receiptFooter);
    }).catch(err => {
      showToast(err.message, 'error');
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.settings.update({
        store_name: storeName,
        store_address: storeAddress,
        store_phone: storePhone,
        cashier_report_scope: cashierReportScope,
        allow_negative_stock: allowNegativeStock
      });

      await api.printer.updateSettings({
        printerName,
        paperWidth,
        receiptFooter
      });

      showToast('Pengaturan sistem dan printer berhasil disimpan', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleTestPrint = async () => {
    try {
      const res = await api.printer.test();
      setTestReceipt(res.receipt);
      setIsReceiptOpen(true);
      showToast('Perintah test print berhasil digenerate', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-sky-600" />
            <span>Pengaturan Sistem & Konfigurasi Printer</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfigurasikan profil toko, cakupan laporan kasir, kebijakan stok negatif, dan printer thermal 58mm (IWARE C58AC).
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
        {/* Section 1: Profil Toko */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Profil Toko Digital Printing</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nama Toko *</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">No. WhatsApp / Telepon *</label>
              <input
                type="text"
                required
                value={storePhone}
                onChange={e => setStorePhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Alamat Toko (Dicetak pada Header Struk & Laporan)</label>
            <input
              type="text"
              value={storeAddress}
              onChange={e => setStoreAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
            />
          </div>
        </div>

        {/* Section 2: Kebijakan Operasional & Laporan Kasir */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Kebijakan Hak Akses & Operasional</h3>
          </div>

          {/* Cashier Report Scope (Requirement 66) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Cakupan Laporan Transaksi Kasir (Cashier Report Scope)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Tentukan apakah Kasir hanya dapat melihat riwayat transaksi miliknya sendiri, atau seluruh transaksi toko.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                cashierReportScope === 'OWN_TRANSACTIONS' ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-900' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  value="OWN_TRANSACTIONS"
                  checked={cashierReportScope === 'OWN_TRANSACTIONS'}
                  onChange={() => setCashierReportScope('OWN_TRANSACTIONS')}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <div className="text-xs font-bold">OWN TRANSACTIONS (Default)</div>
                  <div className="text-[10px] text-slate-500">Kasir hanya melihat transaksi buatannya sendiri</div>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                cashierReportScope === 'ALL_STORE_TRANSACTIONS' ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-900' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  value="ALL_STORE_TRANSACTIONS"
                  checked={cashierReportScope === 'ALL_STORE_TRANSACTIONS'}
                  onChange={() => setCashierReportScope('ALL_STORE_TRANSACTIONS')}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <div className="text-xs font-bold">ALL STORE TRANSACTIONS</div>
                  <div className="text-[10px] text-slate-500">Kasir dapat melihat seluruh transaksi toko</div>
                </div>
              </label>
            </div>
          </div>

          {/* Allow Negative Stock Toggle (Requirement 27) */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Kebijakan Stok Negatif (Allow Negative Stock)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="negStock"
                  value="false"
                  checked={allowNegativeStock === 'false'}
                  onChange={() => setAllowNegativeStock('false')}
                />
                <span>Tolak Transaksi Jika Stok Tidak Cukup (Disarankan: False)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="negStock"
                  value="true"
                  checked={allowNegativeStock === 'true'}
                  onChange={() => setAllowNegativeStock('true')}
                />
                <span>Izinkan Stok Negatif (True)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Konfigurasi Printer Thermal (IWARE C58AC) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Konfigurasi Printer Thermal (ESC/POS)</h3>
            </div>
            <button
              type="button"
              onClick={handleTestPrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-sky-600" />
              <span>Test Print (58mm)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Target Printer Model</label>
              <input
                type="text"
                value={printerName}
                onChange={e => setPrinterName(e.target.value)}
                placeholder="Contoh: IWARE C58AC"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Ukuran Kertas Thermal</label>
              <select
                value={paperWidth}
                onChange={e => setPaperWidth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="58mm">58mm (32 Karakter per baris - IWARE C58AC)</option>
                <option value="80mm">80mm (48 Karakter per baris)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Catatan Footer Struk Kasir</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={e => setReceiptFooter(e.target.value)}
              placeholder="Contoh: TERIMA KASIH ATAS KUNJUNGAN ANDA"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Semua Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Test Print Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={testReceipt}
        title="Hasil Test Print ESC/POS 58mm (IWARE C58AC)"
      />
    </div>
  );
};
