import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/Toast.js';
import { Transaction, ReceiptData } from '../types/index.js';
import { formatRupiah, formatDate, formatDateTime, getIndonesianMonth } from '../services/formatters.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import { PDFReportService } from '../services/pdfReportService.js';
import {
  Search,
  Printer,
  Ban,
  Calendar,
  Eye,
  FileDown,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'LIST' | 'DAILY' | 'MONTHLY'>('LIST');

  // Transaction List State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Detail Modal State
  const [selectedTrx, setSelectedTrx] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Void Modal State
  const [isVoidOpen, setIsVoidOpen] = useState<boolean>(false);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidTrxId, setVoidTrxId] = useState<string>('');

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  // Daily Report State (Kasir & Admin)
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [dailyReportData, setDailyReportData] = useState<any>(null);
  const [loadingDaily, setLoadingDaily] = useState<boolean>(false);

  // Monthly Report State (Kasir & Admin)
  const now = new Date();
  const [monthlyYear, setMonthlyYear] = useState<number>(now.getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState<number>(now.getMonth() + 1);
  const [monthlyReportData, setMonthlyReportData] = useState<any>(null);
  const [loadingMonthly, setLoadingMonthly] = useState<boolean>(false);

  // Fetch transaction list
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.transactions.list({
        search: searchTerm,
        date: dateFilter,
        status: statusFilter
      });
      setTransactions(res.transactions || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LIST') {
      fetchTransactions();
    }
  }, [searchTerm, dateFilter, statusFilter, activeTab]);

  // Fetch daily report data
  const fetchDailyReport = async () => {
    setLoadingDaily(true);
    try {
      const res = await api.reports.daily(dailyDate);
      setDailyReportData(res.report);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DAILY') {
      fetchDailyReport();
    }
  }, [dailyDate, activeTab]);

  // Fetch monthly report data
  const fetchMonthlyReport = async () => {
    setLoadingMonthly(true);
    try {
      const res = await api.reports.monthly(monthlyYear, monthlyMonth);
      setMonthlyReportData(res.report);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'MONTHLY') {
      fetchMonthlyReport();
    }
  }, [monthlyYear, monthlyMonth, activeTab]);

  // Open Transaction Detail
  const handleOpenDetail = async (id: string) => {
    try {
      const trx = await api.transactions.get(id);
      setSelectedTrx(trx);
      setIsDetailOpen(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Reprint Payment Receipt (Acceptance Test 54 & 104)
  const handleReprintPayment = async (id: string) => {
    try {
      const res = await api.transactions.reprintPayment(id);
      setActiveReceipt(res.receipt);
      setIsReceiptOpen(true);
      showToast('Struk pembayaran siap dicetak ulang', 'success');
      if (selectedTrx && selectedTrx.id === id) {
        handleOpenDetail(id); // refresh print logs
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Reprint Production Receipt
  const handleReprintProduction = async (id: string) => {
    try {
      const res = await api.transactions.reprintProduction(id);
      setActiveReceipt(res.receipt);
      setIsReceiptOpen(true);
      showToast('Struk produksi siap dicetak ulang', 'success');
      if (selectedTrx && selectedTrx.id === id) {
        handleOpenDetail(id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Void Transaction (Admin Only)
  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      showToast('Alasan pembatalan wajib diisi', 'error');
      return;
    }

    try {
      await api.transactions.void(voidTrxId, voidReason);
      showToast('Transaksi berhasil dibatalkan dan stok dikembalikan', 'success');
      setIsVoidOpen(false);
      setVoidReason('');
      setIsDetailOpen(false);
      fetchTransactions();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Generate Daily PDF (Acceptance Test 101: Laporan_Transaksi_Harian_07-09-2026.pdf)
  const handleGenerateDailyPDF = (mode: 'view' | 'download' | 'print') => {
    if (!dailyReportData) return;

    const { doc, filename } = PDFReportService.generateDailyReportPDF({
      date: dailyDate,
      cashierName: user?.name,
      summary: {
        totalTransactions: dailyReportData.totalTransactions,
        grossSales: dailyReportData.grossSales,
        totalDiscount: dailyReportData.totalDiscount,
        netSales: dailyReportData.netSales,
        cashTotal: dailyReportData.cashTotal,
        transferTotal: dailyReportData.transferTotal,
        totalPcs: dailyReportData.totalPcs,
        totalMeter: dailyReportData.totalMeter,
        totalM2: dailyReportData.totalM2
      },
      transactions: dailyReportData.transactions
    });

    if (mode === 'download') {
      PDFReportService.downloadPDF(doc, filename);
      showToast(`PDF berhasil diunduh: ${filename}`, 'success');
    } else if (mode === 'print') {
      PDFReportService.printPDF(doc);
    } else {
      PDFReportService.viewPDF(doc);
    }
  };

  // Generate Monthly PDF (Acceptance Test 102: Laporan_Transaksi_Bulanan_09-2026.pdf)
  const handleGenerateMonthlyPDF = (mode: 'view' | 'download' | 'print') => {
    if (!monthlyReportData) return;

    const { doc, filename } = PDFReportService.generateMonthlyReportPDF({
      year: monthlyYear,
      month: monthlyMonth,
      cashierName: user?.name,
      summary: {
        totalTransactions: monthlyReportData.totalTransactions,
        grossSales: monthlyReportData.grossSales,
        totalDiscount: monthlyReportData.totalDiscount,
        netSales: monthlyReportData.netSales,
        cashTotal: monthlyReportData.cashTotal,
        transferTotal: monthlyReportData.transferTotal,
        totalPcs: monthlyReportData.totalPcs,
        totalMeter: monthlyReportData.totalMeter,
        totalM2: monthlyReportData.totalM2
      },
      dailyRecap: monthlyReportData.dailyRecap,
      transactions: monthlyReportData.transactions
    });

    if (mode === 'download') {
      PDFReportService.downloadPDF(doc, filename);
      showToast(`PDF berhasil diunduh: ${filename}`, 'success');
    } else if (mode === 'print') {
      PDFReportService.printPDF(doc);
    } else {
      PDFReportService.viewPDF(doc);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col select-none">
      {/* Tab Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4 pb-0 shrink-0">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Manajemen Transaksi & Laporan Kasir</h2>
            <p className="text-xs text-slate-500">Lihat riwayat pesanan, cetak ulang struk, dan generate laporan PDF harian/bulanan.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'LIST'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Daftar Transaksi
          </button>
          <button
            onClick={() => setActiveTab('DAILY')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'DAILY'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Laporan Transaksi Harian (PDF)
          </button>
          <button
            onClick={() => setActiveTab('MONTHLY')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'MONTHLY'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Laporan Transaksi Bulanan (PDF)
          </button>
        </div>
      </div>

      {/* ================= TAB 1: DAFTAR TRANSAKSI ================= */}
      {activeTab === 'LIST' && (
        <div className="p-6 space-y-4 flex-1">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari no. transaksi atau nama customer..."
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              />

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="">Semua Status</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              {(searchTerm || dateFilter || statusFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setDateFilter('');
                    setStatusFilter('');
                  }}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">No. Transaksi</th>
                    <th className="py-3 px-4">Tanggal & Waktu</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Kasir</th>
                    <th className="py-3 px-4">Metode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                        Memuat data transaksi...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                        Belum ada transaksi ditemukan.
                      </td>
                    </tr>
                  ) : (
                    transactions.map(trx => (
                      <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold font-mono text-slate-900">
                          {trx.transaction_number}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {formatDateTime(trx.created_at)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {trx.customer_name || 'Umum'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {trx.cashier_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trx.payment_method === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                            {trx.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trx.payment_status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {trx.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {formatRupiah(trx.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenDetail(trx.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                            <button
                              onClick={() => handleReprintPayment(trx.id)}
                              title="Cetak Ulang Struk Kasir"
                              className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: LAPORAN HARIAN (PDF) ================= */}
      {activeTab === 'DAILY' && (
        <div className="p-6 space-y-6 flex-1">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pilih Tanggal:
              </label>
              <input
                type="date"
                value={dailyDate}
                onChange={e => setDailyDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>

            {/* Action Buttons: View, Download, Print PDF */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleGenerateDailyPDF('view')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Preview PDF</span>
              </button>
              <button
                onClick={() => handleGenerateDailyPDF('print')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print PDF</span>
              </button>
              <button
                onClick={() => handleGenerateDailyPDF('download')}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF Harian</span>
              </button>
            </div>
          </div>

          {/* Daily Report Summary Cards */}
          {dailyReportData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Transaksi</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{dailyReportData.totalTransactions} Transaksi</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Penjualan (Net)</span>
                  <div className="text-xl font-black text-sky-700 mt-1">{formatRupiah(dailyReportData.netSales)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tunai (Cash)</span>
                  <div className="text-xl font-black text-emerald-700 mt-1">{formatRupiah(dailyReportData.cashTotal)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Transfer</span>
                  <div className="text-xl font-black text-indigo-700 mt-1">{formatRupiah(dailyReportData.transferTotal)}</div>
                </div>
              </div>

              {/* Units Recap (PCS, Meter, M2) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rekap Cetak PCS</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{dailyReportData.totalPcs} PCS</div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rekap Cetak METER</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{dailyReportData.totalMeter} Meter</div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rekap Cetak M² (Luas)</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{dailyReportData.totalM2} M²</div>
                </div>
              </div>

              {/* Detail Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800">
                  Rincian Transaksi Tanggal {formatDate(dailyDate)}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">No. Transaksi</th>
                        <th className="py-2.5 px-4">Jam</th>
                        <th className="py-2.5 px-4">Customer</th>
                        <th className="py-2.5 px-4">Metode</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {dailyReportData.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                            Tidak ada transaksi pada tanggal ini.
                          </td>
                        </tr>
                      ) : (
                        dailyReportData.transactions.map((trx: any) => (
                          <tr key={trx.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold font-mono text-slate-900">{trx.transaction_number}</td>
                            <td className="py-2.5 px-4 text-slate-500">{trx.created_at?.substring(11, 16)}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{trx.customer_name || 'Umum'}</td>
                            <td className="py-2.5 px-4 font-bold">{trx.payment_method}</td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatRupiah(trx.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: LAPORAN BULANAN (PDF) ================= */}
      {activeTab === 'MONTHLY' && (
        <div className="p-6 space-y-6 flex-1">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pilih Periode Bulan & Tahun:
              </label>
              <select
                value={monthlyMonth}
                onChange={e => setMonthlyMonth(parseInt(e.target.value, 10))}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={m}>{getIndonesianMonth(m)}</option>
                ))}
              </select>
              <select
                value={monthlyYear}
                onChange={e => setMonthlyYear(parseInt(e.target.value, 10))}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Action Buttons: View, Download, Print PDF */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleGenerateMonthlyPDF('view')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Preview PDF</span>
              </button>
              <button
                onClick={() => handleGenerateMonthlyPDF('print')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print PDF</span>
              </button>
              <button
                onClick={() => handleGenerateMonthlyPDF('download')}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF Bulanan</span>
              </button>
            </div>
          </div>

          {/* Monthly Summary Cards */}
          {monthlyReportData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Transaksi Bulan Ini</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{monthlyReportData.totalTransactions} Transaksi</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Omset Bulan Ini</span>
                  <div className="text-xl font-black text-sky-700 mt-1">{formatRupiah(monthlyReportData.netSales)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Cash</span>
                  <div className="text-xl font-black text-emerald-700 mt-1">{formatRupiah(monthlyReportData.cashTotal)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Transfer</span>
                  <div className="text-xl font-black text-indigo-700 mt-1">{formatRupiah(monthlyReportData.transferTotal)}</div>
                </div>
              </div>

              {/* Rekapitulasi Harian Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800">
                  Tabel Rekapitulasi Penjualan Harian ({monthlyReportData.periodLabel})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Tanggal</th>
                        <th className="py-2.5 px-4 text-center">Jumlah Transaksi</th>
                        <th className="py-2.5 px-4 text-right">Cash</th>
                        <th className="py-2.5 px-4 text-right">Transfer</th>
                        <th className="py-2.5 px-4 text-right">Total Harian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {monthlyReportData.dailyRecap.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                            Belum ada transaksi pada bulan ini.
                          </td>
                        </tr>
                      ) : (
                        monthlyReportData.dailyRecap.map((r: any) => (
                          <tr key={r.date} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-slate-900">{r.formattedDate}</td>
                            <td className="py-2.5 px-4 text-center">{r.transactionCount}</td>
                            <td className="py-2.5 px-4 text-right font-medium">{formatRupiah(r.cashTotal)}</td>
                            <td className="py-2.5 px-4 text-right font-medium">{formatRupiah(r.transferTotal)}</td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatRupiah(r.totalAmount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: TRANSACTION DETAIL ================= */}
      {isDetailOpen && selectedTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 uppercase">DETAIL TRANSAKSI</span>
                <h3 className="font-bold text-lg mt-1">{selectedTrx.transaction_number}</h3>
                <p className="text-xs text-sky-200">{formatDateTime(selectedTrx.created_at)} | Kasir: {selectedTrx.cashier_name}</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-white/80 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Customer & Job Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Customer:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedTrx.customer_name || 'Umum'}</div>
                  <div className="text-slate-500">{selectedTrx.customer_phone || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Produksi / Job:</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{selectedTrx.job_number || '-'}</div>
                  <div className="font-semibold text-sky-700">{selectedTrx.job_status || selectedTrx.production_status}</div>
                </div>
              </div>

              {/* Items Snapshots */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Item Transaksi (Snapshot Historis)</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {(selectedTrx.items || []).map((it: any) => (
                    <div key={it.id} className="p-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{it.product_name_snapshot}</div>
                        {it.variant_name_snapshot && it.variant_name_snapshot !== 'Standard' && (
                          <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 inline-block mt-0.5">
                            {it.variant_name_snapshot}
                          </span>
                        )}
                        {it.formula_snapshot && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{it.formula_snapshot}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-slate-900">{formatRupiah(it.subtotal)}</div>
                        <div className="text-[10px] text-slate-500">{it.quantity} {it.unit} @ {formatRupiah(it.unit_price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(selectedTrx.subtotal)}</span>
                </div>
                {selectedTrx.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(selectedTrx.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                  <span>Total Tagihan:</span>
                  <span className="text-sky-700 font-black">{formatRupiah(selectedTrx.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>Bayar ({selectedTrx.payment_method}):</span>
                  <span>{formatRupiah(selectedTrx.payment_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Kembali:</span>
                  <span>{formatRupiah(selectedTrx.change_amount)}</span>
                </div>
              </div>

              {/* Print History Logs (Requirement 55) */}
              {selectedTrx.printLogs && selectedTrx.printLogs.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Riwayat Cetak / Reprint</h4>
                  <div className="space-y-1">
                    {selectedTrx.printLogs.map((pl: any) => (
                      <div key={pl.id} className="text-[10px] text-slate-500 bg-slate-100 p-2 rounded-lg flex items-center justify-between">
                        <span>{pl.print_type === 'PAYMENT_RECEIPT' ? 'Struk Kasir' : 'Struk Produksi'} oleh {pl.printed_by_name}</span>
                        <span>{formatDateTime(pl.printed_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div>
                {isAdmin && selectedTrx.payment_status !== 'CANCELLED' && (
                  <button
                    onClick={() => {
                      setVoidTrxId(selectedTrx.id);
                      setIsVoidOpen(true);
                    }}
                    className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Batalkan Transaksi (Void)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReprintProduction(selectedTrx.id)}
                  className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Struk Produksi</span>
                </button>
                <button
                  onClick={() => handleReprintPayment(selectedTrx.id)}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Ulang Struk Kasir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VOID CONFIRMATION (ADMIN) ================= */}
      {isVoidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Ban className="w-6 h-6" />
              <h3 className="text-base font-black text-slate-900">Batalkan Transaksi (VOID)</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan membatalkan status transaksi dan <strong>secara otomatis mengembalikan stok material</strong> yang telah terpakai ke sistem.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Alasan Pembatalan (Wajib diisi) *
              </label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Contoh: Customer salah pesan ukuran, file tidak sesuai resolusi..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsVoidOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20"
              >
                Konfirmasi Batal (VOID)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECEIPT MODAL (58mm ESC/POS) ================= */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={activeReceipt}
        title={activeReceipt?.type === 'PRODUCTION_RECEIPT' ? 'Cetak Ulang Struk Produksi (58mm)' : 'Cetak Ulang Struk Pembayaran (58mm)'}
      />
    </div>
  );
};
