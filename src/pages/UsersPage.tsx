import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/Toast.js';
import { User } from '../types/index.js';
import { formatDateTime } from '../services/formatters.js';
import {
  UserCog,
  Plus,
  Edit2,
  KeyRound,
  Shield,
  UserCheck,
  UserX,
  ShieldCheck
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add/Edit User Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<'ADMIN' | 'KASIR'>('KASIR');

  // Reset Password Modal
  const [isResetOpen, setIsResetOpen] = useState<boolean>(false);
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.users.list();
      setUsers(res.users || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setPassword('');
    setRoleId('KASIR');
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setUsername(u.username);
    setPassword('');
    setRoleId(u.role);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      showToast('Nama dan username wajib diisi', 'error');
      return;
    }

    try {
      if (editingUser) {
        await api.users.update(editingUser.id, { name, roleId });
        showToast('Data user berhasil diperbarui', 'success');
      } else {
        if (!password || password.length < 5) {
          showToast('Password minimal 5 karakter', 'error');
          return;
        }
        await api.users.create({ name, username, password, roleId });
        showToast('User baru berhasil ditambahkan', 'success');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword || newPassword.length < 5) {
      showToast('Password baru minimal 5 karakter', 'error');
      return;
    }

    try {
      await api.users.resetPassword(resetTargetUser.id, newPassword);
      showToast(`Password untuk @${resetTargetUser.username} berhasil di-reset`, 'success');
      setIsResetOpen(false);
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      showToast('Anda tidak dapat menonaktifkan akun Anda sendiri', 'error');
      return;
    }

    const action = targetUser.status === 'ACTIVE' ? 'menonaktifkan' : 'mengaktifkan kembali';
    if (!window.confirm(`Apakah Anda yakin ingin ${action} akun @${targetUser.username}?`)) return;

    try {
      const res = await api.users.toggleStatus(targetUser.id);
      showToast(res.message, 'success');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="w-6 h-6 text-sky-600" />
            <span>Manajemen Pengguna & Hak Akses (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola akun Admin dan Kasir. Kasir strictly dibatasi hanya untuk 4 menu operasional (Dashboard, POS, Transaksi, Produksi).
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kasir / User Baru</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Hak Akses (Role)</th>
                <th className="py-3 px-4">Status Akun</th>
                <th className="py-3 px-4 text-center">Total Transaksi</th>
                <th className="py-3 px-4">Terdaftar</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">Memuat daftar pengguna...</td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">@{u.username}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                        u.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}>
                        {u.role === 'ADMIN' ? 'Admin / Owner' : 'Kasir'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {u.status === 'ACTIVE' ? 'Aktif' : 'Dinonaktifkan'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
                        {u.transactionCount || 0} order
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setResetTargetUser(u);
                            setIsResetOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              u.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.status === 'ACTIVE' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                          >
                            {u.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD / EDIT USER ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">{editingUser ? 'Edit Pengguna' : 'Tambah Kasir / Pengguna'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Andi Kasir"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Contoh: kasir2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Password Awal *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimal 5 karakter"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Role / Hak Akses</label>
                <select
                  value={roleId}
                  onChange={e => setRoleId(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="KASIR">Kasir (Dashboard, POS, Transaksi, Produksi)</option>
                  <option value="ADMIN">Admin / Owner (Akses Penuh)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD ================= */}
      {isResetOpen && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Reset Password: @{resetTargetUser.username}</h3>
              <button onClick={() => setIsResetOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-3">
              <p className="text-xs text-slate-600">
                Masukkan password baru untuk pengguna <strong>{resetTargetUser.name}</strong>. Password akan di-hash secara aman.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Password Baru *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimal 5 karakter"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
