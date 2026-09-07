import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { formatRupiah, formatDate } from '../services/formatters.js';
import { PDFReportService } from '../services/pdfReportService.js';
import {
  BarChart3,
  TrendingUp,
  FileDown,
  Printer,
  Calendar,
  Layers,
  PieChart,
  Boxes,
  FileSpreadsheet,
  Eye
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();

  const [reportType, setReportType] = useState<'CUSTOM' | 'HPP' | 'STOCK'>('CUSTOM');

  // Custom date range
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);

  const [startDate, setStartDate] = useState<string>(firstDayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [customData, setCustomData] = useState<any>(null);
  const [hppData, setHppData] = useState<any>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchCustomReport = async () => {
    setLoading(true);
    try {
      const res = await api.reports.custom(startDate, endDate);
      setCustomData(res.report);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHppReport = async () => {
    setLoading(true);
    try {
      const res = await api.reports.profit(startDate, endDate);
      setHppData(res.report);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockReport = async () => {
    setLoading(true);
    try {
      const res = await api.reports.stock();
      setStockData(res.report || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportType === 'CUSTOM') fetchCustomReport();
    else if (reportType === 'HPP') fetchHppReport();
    else if (reportType === 'STOCK') fetchStockReport();
  }, [reportType, startDate, endDate]);

  const handleDownloadCustomPDF = () => {
    if (!customData) return;
    const { doc, filename } = PDFReportService.generateCustomReportPDF({
      startDate,
      endDate,
      summary: customData.summary,
      topProducts: customData.topProducts,
      cashierStats: customData.cashierStats
    });
    PDFReportService.downloadPDF(doc, filename);
    showToast(`Laporan custom berhasil diunduh: ${filename}`, 'success');
  };

  const handleExportCSV = () => {
    if (reportType === 'CUSTOM' && customData?.topProducts) {
      let csvContent = 'data:text/csv;charset=utf-8,Produk,Kuantitas,Unit,Total Omset\n';
      customData.topProducts.forEach((p: any) => {
        csvContent += `"${p.product_name}","${p.total_qty}","${p.unit}","${p.total_revenue}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Laporan_Produk_${startDate}_sd_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Export CSV berhasil diunduh', 'success');
    } else if (reportType === 'STOCK') {
      let csvContent = 'data:text/csv;charset=utf-8,Kode,Nama Bahan,Satuan,Stok,Min Stok,HPP Satuan,Total Valuasi\n';
      stockData.forEach((s: any) => {
        csvContent += `"${s.code}","${s.name}","${s.unit}","${s.stock}","${s.minimumStock}","${s.costPrice}","${s.valuation}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Laporan_Stok_Bahan_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Export CSV stok berhasil diunduh', 'success');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-600" />
            <span>Laporan Bisnis & Keuangan (Owner / Admin)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Analisis lengkap omset penjualan, evaluasi HPP dan laba kotor bahan, serta valuasi stok gudang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reportType === 'CUSTOM' && (
            <button
              onClick={handleDownloadCustomPDF}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-sky-600" />
              <span>Download PDF Custom</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setReportType('CUSTOM')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'CUSTOM' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Laporan Penjualan Periode
        </button>
        <button
          onClick={() => setReportType('HPP')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'HPP' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Analisis HPP & Margin Laba
        </button>
        <button
          onClick={() => setReportType('STOCK')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'STOCK' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Valuasi & Status Stok Gudang
        </button>
      </div>

      {/* Filter Range for CUSTOM & HPP */}
      {reportType !== 'STOCK' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase">Dari Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase">Sampai Tanggal:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
            />
          </div>
        </div>
      )}

      {/* TAB 1: CUSTOM SALES REPORT */}
      {reportType === 'CUSTOM' && customData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Transaksi</span>
              <div className="text-xl font-black text-slate-900 mt-1">{customData.summary.total_count || 0} Trx</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Penjualan Bersih (Net)</span>
              <div className="text-xl font-black text-sky-700 mt-1">{formatRupiah(customData.summary.net_sales || 0)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pembayaran Cash</span>
              <div className="text-xl font-black text-emerald-700 mt-1">{formatRupiah(customData.summary.cash_total || 0)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pembayaran Transfer</span>
              <div className="text-xl font-black text-indigo-700 mt-1">{formatRupiah(customData.summary.transfer_total || 0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Produk Terlaris (Top Selling)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="pb-2">Produk</th>
                      <th className="pb-2 text-center">Jumlah</th>
                      <th className="pb-2 text-right">Omset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {(customData.topProducts || []).map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 font-bold text-slate-900">{p.product_name}</td>
                        <td className="py-2 text-center">{p.total_qty} {p.unit}</td>
                        <td className="py-2 text-right font-black text-slate-900">{formatRupiah(p.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sales by Cashier */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Performa Penjualan Kasir
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="pb-2">Nama Kasir</th>
                      <th className="pb-2 text-center">Transaksi</th>
                      <th className="pb-2 text-right">Total Penjualan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {(customData.cashierStats || []).map((cs: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 font-bold text-slate-900">{cs.cashier_name}</td>
                        <td className="py-2 text-center">{cs.transaction_count} Trx</td>
                        <td className="py-2 text-right font-black text-slate-900">{formatRupiah(cs.total_sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HPP & PROFIT REPORT */}
      {reportType === 'HPP' && hppData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Omset Bersih (Revenue)</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{formatRupiah(hppData.netRevenue)}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Pendapatan bersih periode ini</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Biaya Material (HPP Bahan)</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{formatRupiah(hppData.totalMaterialCost)}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Biaya pemakaian bahan produksi</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Laba Kotor (Gross Profit)</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{formatRupiah(hppData.grossProfit)}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Revenue dikurangi HPP bahan</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Margin</span>
              <div className="text-2xl font-black text-sky-700 mt-1">{hppData.grossMargin}%</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Efisiensi margin laba kotor</p>
            </div>
          </div>

          {/* Material Usage Detail Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800">
              Rincian Konsumsi Bahan Baku & Biaya Pokok (HPP)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Nama Material</th>
                    <th className="py-2.5 px-4 text-center">Kuantitas Terpakai</th>
                    <th className="py-2.5 px-4 text-right">HPP Standar</th>
                    <th className="py-2.5 px-4 text-right">Total Biaya Bahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {hppData.materialDetails.map((mat: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{mat.material_name}</td>
                      <td className="py-2.5 px-4 text-center">{mat.total_used} {mat.unit}</td>
                      <td className="py-2.5 px-4 text-right">{formatRupiah(mat.cost_price)}/{mat.unit}</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatRupiah(mat.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK VALUATION REPORT */}
      {reportType === 'STOCK' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800">Laporan Valuasi & Kesehatan Stok Bahan</span>
            <span className="text-xs font-black text-sky-700">
              Total Valuasi: {formatRupiah(stockData.reduce((acc, it) => acc + it.valuation, 0))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Bahan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Stok Fisik</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">HPP Satuan</th>
                  <th className="py-3 px-4 text-right">Nilai Aset Stok (Valuasi)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {stockData.map(stk => (
                  <tr key={stk.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{stk.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{stk.name}</td>
                    <td className="py-3 px-4 text-slate-600">{stk.category}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">{stk.stock} {stk.unit}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stk.status === 'HABIS'
                          ? 'bg-rose-50 text-rose-700'
                          : stk.status === 'LOW_STOCK'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {stk.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{formatRupiah(stk.costPrice)}/{stk.unit}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">{formatRupiah(stk.valuation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
