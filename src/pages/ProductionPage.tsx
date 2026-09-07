import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/Toast.js';
import { ProductionJob, ReceiptData } from '../types/index.js';
import { formatDateTime } from '../services/formatters.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import {
  Hammer,
  Search,
  Printer,
  Clock,
  CheckCircle2,
  PackageCheck,
  Ban,
  ArrowRight,
  FileEdit,
  History,
  AlertCircle
} from 'lucide-react';

export const ProductionPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Selected job for detail / status log modal
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Notes edit modal
  const [editingNotesJob, setEditingNotesJob] = useState<ProductionJob | null>(null);
  const [notesText, setNotesText] = useState<string>('');

  // Receipt modal state
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.production.getJobs({
        status: filterStatus,
        search: searchTerm
      });
      setJobs(res.jobs || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [filterStatus, searchTerm]);

  // Update Status: MENUNGGU -> DIPROSES -> SELESAI -> DIAMBIL
  const handleUpdateStatus = async (jobId: string, newStatus: string, notes?: string) => {
    try {
      await api.production.updateStatus(jobId, newStatus, notes);
      showToast(`Status pekerjaan diubah ke ${newStatus}`, 'success');
      fetchJobs();
      if (selectedJob && selectedJob.id === jobId) {
        setIsDetailOpen(false);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Save updated notes
  const handleSaveNotes = async () => {
    if (!editingNotesJob) return;
    try {
      await api.production.updateNotes(editingNotesJob.id, notesText);
      showToast('Catatan operasional berhasil disimpan', 'success');
      setEditingNotesJob(null);
      fetchJobs();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Print Struk Produksi
  const handlePrintReceipt = async (jobId: string) => {
    try {
      const res = await api.production.getReceipt(jobId);
      setActiveReceipt(res.receipt);
      setIsReceiptOpen(true);
      showToast('Struk produksi siap dicetak', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MENUNGGU':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'DIPROSES':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'SELESAI':
        return 'bg-sky-50 text-sky-700 border-sky-300';
      case 'DIAMBIL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'DIBATALKAN':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Hammer className="w-6 h-6 text-sky-600" />
            <span>Antrian & Manajemen Produksi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola jalannya produksi cetak, perbarui tahapan pesanan, dan cetak struk produksi teknis (58mm ESC/POS).
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'ALL', label: 'Semua Job' },
            { id: 'MENUNGGU', label: 'Menunggu' },
            { id: 'DIPROSES', label: 'Diproses' },
            { id: 'SELESAI', label: 'Selesai' },
            { id: 'DIAMBIL', label: 'Diambil' },
            { id: 'DIBATALKAN', label: 'Dibatalkan' }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                filterStatus === st.id
                  ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari no. job, transaksi, atau customer..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
          />
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-52 text-xs font-bold text-slate-400">
          Memuat antrian produksi...
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Hammer className="w-12 h-12 stroke-[1.5] text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Belum ada production job</p>
          <p className="text-xs text-slate-400">Semua pesanan cetak yang selesai checkout akan otomatis muncul di sini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map(job => (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-slate-900">{job.job_number}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{job.transaction_number}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${getStatusBadge(job.status)}`}>
                    {job.status}
                  </span>
                </div>

                {/* Customer & Timestamp */}
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div className="font-bold text-slate-900">{job.customer_name || 'Customer Umum'}</div>
                  <div className="text-[11px] text-slate-400">{formatDateTime(job.created_at)}</div>
                </div>

                {/* Items preview */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
                  {(job.items || []).map((it: any) => (
                    <div key={it.id} className="space-y-0.5">
                      <div className="font-bold text-slate-900 leading-tight">
                        {it.product_name_snapshot}
                        {it.variant_name_snapshot && it.variant_name_snapshot !== 'Standard' && (
                          <span className="text-[10px] font-semibold text-sky-700 ml-1">({it.variant_name_snapshot})</span>
                        )}
                      </div>
                      {it.width && it.height && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Ukuran: {it.width} × {it.height} m ({it.calculated_area || (it.width * it.height).toFixed(2)} M²)
                        </div>
                      )}
                      <div className="text-[10px] text-slate-600 font-semibold">
                        Kuantitas: {it.quantity} {it.unit}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {job.notes && (
                  <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 flex items-start gap-1.5">
                    <span className="font-bold shrink-0">Catatan:</span>
                    <span>{job.notes}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Status Progression & Print Struk */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setIsDetailOpen(true);
                    }}
                    title="Riwayat Status"
                    className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingNotesJob(job);
                      setNotesText(job.notes || '');
                    }}
                    title="Edit Catatan Operasional"
                    className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <FileEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePrintReceipt(job.id)}
                    title="Cetak Struk Produksi"
                    className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Advancement Quick Buttons */}
                <div>
                  {job.status === 'MENUNGGU' && (
                    <button
                      onClick={() => handleUpdateStatus(job.id, 'DIPROSES')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Mulai Proses</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {job.status === 'DIPROSES' && (
                    <button
                      onClick={() => handleUpdateStatus(job.id, 'SELESAI')}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Set Selesai</span>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {job.status === 'SELESAI' && (
                    <button
                      onClick={() => handleUpdateStatus(job.id, 'DIAMBIL')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Diambil Cust</span>
                      <PackageCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {job.status === 'DIAMBIL' && (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Selesai & Diambil</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= MODAL: STATUS LOGS & DETAIL ================= */}
      {isDetailOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 uppercase">RIWAYAT STATUS PRODUKSI</span>
                <h3 className="font-bold text-base mt-1">{selectedJob.job_number}</h3>
                <p className="text-xs text-sky-200">{selectedJob.transaction_number}</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-white/80 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tahapan Status</span>
                <div className="border border-slate-200 rounded-xl p-4 divide-y divide-slate-100 text-xs">
                  {(selectedJob.status_logs || []).map((log: any, idx: number) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-2 first:pt-0 last:pb-0">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className={`px-2 py-0.2 rounded text-[10px] ${getStatusBadge(log.new_status)}`}>
                            {log.new_status}
                          </span>
                          {log.notes && <span className="text-slate-500 font-normal">({log.notes})</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Oleh: <strong>{log.user_name}</strong>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT OPERATIONAL NOTES ================= */}
      {editingNotesJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-black text-slate-900 text-sm">
              Perbarui Catatan Produksi: {editingNotesJob.job_number}
            </h3>
            <textarea
              rows={3}
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Contoh: Cetak urgent, file revisi siap cetak..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingNotesJob(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: STRUK PRODUKSI (58mm ESC/POS) ================= */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={activeReceipt}
        title="Struk Produksi (58mm ESC/POS)"
      />
    </div>
  );
};
