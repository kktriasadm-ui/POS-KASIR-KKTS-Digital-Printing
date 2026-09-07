import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { formatDateTime } from '../services/formatters.js';
import {
  Database,
  Download,
  RotateCcw,
  Plus,
  ShieldCheck,
  AlertTriangle,
  HardDrive
} from 'lucide-react';

export const BackupPage: React.FC = () => {
  const { showToast } = useToast();

  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await api.backup.list();
      setBackups(res.backups || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await api.backup.create();
      showToast(`Backup berhasil dibuat: ${res.backup.filename}`, 'success');
      fetchBackups();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`PERINGATAN: Apakah Anda yakin ingin memulihkan (restore) database dari "${filename}"? Tindakan ini akan menggantikan data database saat ini.`)) {
      return;
    }

    try {
      await api.backup.restore(filename);
      showToast('Database berhasil dipulihkan dari backup', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-sky-600" />
            <span>Backup & Restore Database SQLite</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadangkan basis data relasional SQLite secara lokal atau pulihkan data dari arsip backup sebelumnya.
          </p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={isCreating}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreating ? 'Membuat Backup...' : 'Backup Database Sekarang'}</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-sky-600 text-white shrink-0">
          <HardDrive className="w-5 h-5" />
        </div>
        <div className="text-xs text-sky-900 space-y-1">
          <h4 className="font-bold">Keamanan & Keandalan Offline-First SQLite</h4>
          <p className="text-slate-600 leading-relaxed">
            Seluruh data transaksi, stok bahan, histori pesanan, dan konfigurasi master tersimpan secara lokal dalam satu file database SQLite ACID-compliant. Tidak bergantung pada koneksi internet. Buat backup secara berkala untuk menjaga data tetap aman.
          </p>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800">
          Daftar Arsip File Backup Database
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Nama File Backup</th>
                <th className="py-3 px-4">Ukuran File</th>
                <th className="py-3 px-4">Tanggal Dibuat</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                    Memuat daftar backup...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                    Belum ada file backup. Klik tombol "Backup Database Sekarang" di atas untuk membuat cadangan pertama.
                  </td>
                </tr>
              ) : (
                backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.filename}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{formatFileSize(b.size)}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateTime(b.createdAt)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={api.backup.downloadUrl(b.filename)}
                          download={b.filename}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-600" />
                          <span>Unduh</span>
                        </a>
                        <button
                          onClick={() => handleRestore(b.filename)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
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
  );
};
