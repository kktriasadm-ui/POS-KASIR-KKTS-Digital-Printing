import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/Toast.js';
import { formatRupiah, formatDateTime } from '../services/formatters.js';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  PackageCheck,
  AlertTriangle,
  Clock,
  Hammer,
  CheckCircle,
  ShoppingBag,
  ArrowUpRight
} from 'lucide-react';

export const DashboardPage: React.FC<{ onNavigateToPOS?: () => void }> = ({ onNavigateToPOS }) => {
  const { user, isAdmin, isKasir } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    api.dashboard.get()
      .then(res => setData(res))
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-xs font-bold text-slate-400">
        Memuat data dashboard...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-sky-900/10 flex items-center justify-between">
        <div>
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white/20 uppercase tracking-wider">
            {isAdmin ? 'Owner / Admin Dashboard' : 'Kasir Operasional Dashboard'}
          </span>
          <h2 className="text-2xl font-black mt-2 tracking-tight">
            Selamat Datang, {user?.name}!
          </h2>
          <p className="text-xs text-sky-200 mt-1">
            {isAdmin
              ? 'Pantau ringkasan omset penjualan, pergerakan stok, dan seluruh antrian produksi hari ini.'
              : 'Pantau transaksi penjualan kasir dan perkembangan antrian pekerjaan produksi hari ini.'}
          </p>
        </div>
        {onNavigateToPOS && (
          <button
            onClick={onNavigateToPOS}
            className="px-5 py-2.5 bg-white text-sky-700 hover:bg-sky-50 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <span>Buka POS Kasir</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Penjualan Hari Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Penjualan Hari Ini</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900">{formatRupiah(data.todaySales)}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Total omset tercatat hari ini</p>
          </div>
        </div>

        {/* Transaksi Hari Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transaksi Hari Ini</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingBag className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900">{data.todayTrxCount}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Pesanan berhasil diproses</p>
          </div>
        </div>

        {/* Produk Terjual */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produk / Lembar Terjual</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <PackageCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900">{data.productsSold}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Total item/pcs/m2 produk</p>
          </div>
        </div>

        {/* Low Stock & Out of Stock */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peringatan Stok Bahan</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div>
              <div className="text-xl font-black text-amber-600">{data.lowStockCount ?? data.stockInfo?.lowStock ?? 0}</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Sisa Sedikit</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xl font-black text-rose-600">{data.outOfStockCount ?? data.stockInfo?.outOfStock ?? 0}</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Stok Habis</div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Status Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Hammer className="w-4 h-4 text-sky-600" />
          <span>Status Antrian Produksi</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Menunggu</span>
            <div className="text-xl font-black text-slate-800 mt-1">{data.production.menunggu}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase">Diproses</span>
            <div className="text-xl font-black text-amber-700 mt-1">{data.production.diproses}</div>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-bold text-sky-700 uppercase">Selesai</span>
            <div className="text-xl font-black text-sky-700 mt-1">{data.production.selesai}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Diambil Customer</span>
            <div className="text-xl font-black text-emerald-700 mt-1">{data.production.diambil}</div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Cash vs Transfer + Recent Transactions + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Summary */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Ringkasan Metode Pembayaran
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Banknote className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900">TUNAI (CASH)</div>
                  <div className="text-[10px] text-slate-500">Uang tunai kasir</div>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">{formatRupiah(data.cashSales)}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-sky-100 text-sky-700">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900">TRANSFER / QRIS</div>
                  <div className="text-[10px] text-slate-500">Bank & E-Wallet</div>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">{formatRupiah(data.transferSales)}</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Transaksi Terbaru
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">6 Transaksi Terakhir</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="pb-2">No. Transaksi</th>
                  <th className="pb-2">Waktu</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Metode</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {data.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Belum ada transaksi tercatat hari ini.
                    </td>
                  </tr>
                ) : (
                  data.recentTransactions.map((trx: any) => (
                    <tr key={trx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 font-bold font-mono text-slate-900">{trx.transaction_number}</td>
                      <td className="py-2.5 text-slate-500">{formatDateTime(trx.created_at)}</td>
                      <td className="py-2.5 font-semibold text-slate-800">{trx.customer_name || 'Umum'}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trx.payment_method === 'CASH' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                        }`}>
                          {trx.payment_method}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-black text-slate-900">{formatRupiah(trx.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
