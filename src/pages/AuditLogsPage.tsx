import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { formatDateTime } from '../services/formatters.js';
import { ShieldAlert, Search } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.audit.list(150);
      setLogs(res.logs || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l =>
    (l.action && l.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.entity && l.entity.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.user_name && l.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5 select-none">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-sky-600" />
          <span>Audit Log Sistem & Jejak Aktivitas</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Rekaman historis seluruh perubahan penting pada produk, harga, stok, customer, user, pembatalan (void), dan reprint.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan tindakan (action), entitas, atau nama user..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Tindakan (Action)</th>
                <th className="py-3 px-4">Entitas</th>
                <th className="py-3 px-4">Sebelum (Before)</th>
                <th className="py-3 px-4">Sesudah (After)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">Memuat log audit...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">Belum ada aktivitas tercatat.</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{log.user_name || log.username || '-'}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold font-mono text-sky-800">{log.action}</td>
                    <td className="py-2.5 px-4 text-slate-600">{log.entity}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px] max-w-xs truncate">
                      {log.before_value || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 font-mono text-[10px] max-w-xs truncate">
                      {log.after_value || '-'}
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
