import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { Material, Category } from '../types/index.js';
import { formatRupiah, formatDateTime } from '../services/formatters.js';
import { CurrencyInput } from '../components/CurrencyInput.js';
import {
  Boxes,
  Plus,
  Edit2,
  Archive,
  Search,
  ArrowDownToLine,
  SlidersHorizontal,
  History,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';

export const MaterialsPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'MATERIALS' | 'MOVEMENTS'>('MATERIALS');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Material Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('METER');
  const [initialStock, setInitialStock] = useState<number>(0);
  const [minimumStock, setMinimumStock] = useState<number>(20);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplierId, setSupplierId] = useState('');
  const [conversionRule, setConversionRule] = useState('');

  // Stock In Modal
  const [isStockInOpen, setIsStockInOpen] = useState<boolean>(false);
  const [selectedMatId, setSelectedMatId] = useState('');
  const [inQty, setInQty] = useState<number>(10);
  const [inCost, setInCost] = useState<number>(0);
  const [inSupplierId, setInSupplierId] = useState('');
  const [inInvoice, setInInvoice] = useState('');
  const [inNote, setInNote] = useState('');

  // Stock Adjustment (Opname) Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState<boolean>(false);
  const [adjustMat, setAdjustMat] = useState<Material | null>(null);
  const [actualStock, setActualStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Stock Opname Bulanan');

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await api.materials.list();
      setMaterials(res.materials || []);
      setCategories(res.categories || []);
      setSuppliers(res.suppliers || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await api.materials.movements({ limit: 100 });
      setMovements(res.movements || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchMovements();
  }, []);

  const openCreateModal = () => {
    setEditingMaterial(null);
    setCode(`MAT-${Date.now().toString().slice(-4)}`);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setUnit('METER');
    setInitialStock(100);
    setMinimumStock(20);
    setCostPrice(15000);
    setSupplierId(suppliers[0]?.id || '');
    setConversionRule('Standard usage');
    setIsModalOpen(true);
  };

  const openEditModal = (mat: Material) => {
    setEditingMaterial(mat);
    setCode(mat.code);
    setName(mat.name);
    setCategoryId(mat.category_id || '');
    setUnit(mat.unit);
    setMinimumStock(mat.minimum_stock);
    setCostPrice(mat.cost_price);
    setSupplierId(mat.supplier_id || '');
    setConversionRule(mat.conversion_rule || '');
    setIsModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      showToast('Kode dan Nama material wajib diisi', 'error');
      return;
    }

    try {
      if (editingMaterial) {
        await api.materials.update(editingMaterial.id, {
          code,
          name,
          categoryId,
          unit,
          minimumStock,
          costPrice,
          supplierId,
          conversionRule
        });
        showToast('Material berhasil diperbarui', 'success');
      } else {
        await api.materials.create({
          code,
          name,
          categoryId,
          unit,
          initialStock,
          minimumStock,
          costPrice,
          supplierId,
          conversionRule
        });
        showToast('Material berhasil ditambahkan', 'success');
      }
      setIsModalOpen(false);
      fetchMaterials();
      fetchMovements();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatId || inQty <= 0) {
      showToast('Pilih material dan jumlah kuantitas valid', 'error');
      return;
    }

    try {
      await api.materials.stockIn({
        materialId: selectedMatId,
        quantity: inQty,
        costPrice: inCost,
        supplierId: inSupplierId,
        invoiceNumber: inInvoice,
        note: inNote
      });
      showToast('Stok berhasil ditambahkan (Stock In)', 'success');
      setIsStockInOpen(false);
      fetchMaterials();
      fetchMovements();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustMat || !adjustReason) {
      showToast('Pilih material dan isi alasan penyesuaian', 'error');
      return;
    }

    try {
      const res = await api.materials.stockAdjust({
        materialId: adjustMat.id,
        actualStock,
        reason: adjustReason
      });
      showToast(`Penyesuaian stok berhasil disimpan (Selisih: ${res.diff})`, 'success');
      setIsAdjustOpen(false);
      fetchMaterials();
      fetchMovements();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin mengarsipkan material "${name}"?`)) return;

    try {
      const res = await api.materials.archive(id);
      showToast(res.message, 'success');
      fetchMaterials();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-sky-600" />
            <span>Manajemen Material & Stok Real-Time</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stok hanya dikelola pada level Material/Bahan (Shared Material didukung). Catat Stock In, Stock Opname, dan pantau riwayat movement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedMatId(materials[0]?.id || '');
              setInCost(materials[0]?.cost_price || 0);
              setIsStockInOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>+ Tambah Stock (Stock In)</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan Baru</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('MATERIALS')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'MATERIALS' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Daftar Stok Bahan
        </button>
        <button
          onClick={() => {
            setActiveTab('MOVEMENTS');
            fetchMovements();
          }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'MOVEMENTS' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Riwayat Pergerakan Stok (Stock Movements)
        </button>
      </div>

      {/* TAB 1: DAFTAR MATERIAL */}
      {activeTab === 'MATERIALS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari material berdasarkan nama atau kode..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Kode</th>
                    <th className="py-3 px-4">Nama Bahan / Material</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-right">Stok Saat Ini</th>
                    <th className="py-3 px-4 text-right">Min. Stok</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">HPP (Cost Price)</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">Memuat stok bahan...</td>
                    </tr>
                  ) : filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">Belum ada material terdaftar.</td>
                    </tr>
                  ) : (
                    filteredMaterials.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{m.code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{m.name}</td>
                        <td className="py-3 px-4 text-slate-600">{m.category_name || '-'}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {m.stock} <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-semibold">
                          {m.minimum_stock} {m.unit}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.stockStatus === 'HABIS'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : m.stockStatus === 'LOW_STOCK'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {m.stockStatus === 'HABIS' ? 'HABIS' : m.stockStatus === 'LOW_STOCK' ? 'SISA SEDIKIT' : 'AMAN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {formatRupiah(m.cost_price)}/{m.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setAdjustMat(m);
                                setActualStock(m.stock);
                                setIsAdjustOpen(true);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                              title="Stock Opname Adjustment"
                            >
                              Opname
                            </button>
                            <button
                              onClick={() => openEditModal(m)}
                              className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Material"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(m.id, m.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Arsipkan Material"
                            >
                              <Archive className="w-3.5 h-3.5" />
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

      {/* TAB 2: RIWAYAT MOVEMENT */}
      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4">Tipe Movement</th>
                  <th className="py-3 px-4 text-right">Perubahan Qty</th>
                  <th className="py-3 px-4 text-right">Stok Sebelum</th>
                  <th className="py-3 px-4 text-right">Stok Sesudah</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Keterangan / Referensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {movements.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-slate-500">{formatDateTime(mov.created_at)}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{mov.material_name}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mov.movement_type === 'STOCK_IN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : mov.movement_type === 'SALE'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : mov.movement_type === 'VOID_REVERSAL'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {mov.movement_type}
                      </span>
                    </td>
                    <td className={`py-2.5 px-4 text-right font-black ${mov.quantity > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} {mov.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{mov.stock_before}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">{mov.stock_after}</td>
                    <td className="py-2.5 px-4 text-slate-600">{mov.user_name}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">{mov.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT MATERIAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">{editingMaterial ? 'Edit Material' : 'Tambah Material Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveMaterial} className="p-6 space-y-3 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Kode Material *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nama Material *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Contoh: Flexi 280 gsm"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Kategori</label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Satuan (Unit)</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="METER">METER</option>
                    <option value="M2">M2</option>
                    <option value="PCS">PCS</option>
                    <option value="ROLL">ROLL</option>
                    <option value="LITER">LITER</option>
                  </select>
                </div>
              </div>

              {!editingMaterial && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Saldo Stok Awal</label>
                  <input
                    type="number"
                    step="any"
                    value={initialStock}
                    onChange={e => setInitialStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Batas Minimum Stok</label>
                  <input
                    type="number"
                    step="any"
                    value={minimumStock}
                    onChange={e => setMinimumStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Biaya Pokok (HPP) / Unit</label>
                  <CurrencyInput
                    value={costPrice}
                    onChange={setCostPrice}
                    className="w-full text-xs"
                  />
                </div>
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
                  Simpan Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: STOCK IN ================= */}
      {isStockInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">+ TAMBAH STOCK (STOCK IN)</h3>
              <button onClick={() => setIsStockInOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleStockInSubmit} className="p-6 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Material *</label>
                <select
                  value={selectedMatId}
                  onChange={e => {
                    setSelectedMatId(e.target.value);
                    const found = materials.find(m => m.id === e.target.value);
                    if (found) setInCost(found.cost_price);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code}) - Stok: {m.stock} {m.unit}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Jumlah Masuk *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={inQty}
                    onChange={e => setInQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Harga Beli Baru</label>
                  <CurrencyInput
                    value={inCost}
                    onChange={setInCost}
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">No. Faktur / Invoice</label>
                <input
                  type="text"
                  value={inInvoice}
                  onChange={e => setInInvoice(e.target.value)}
                  placeholder="Contoh: INV-SUP-2026-001"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Catatan</label>
                <input
                  type="text"
                  value={inNote}
                  onChange={e => setInNote(e.target.value)}
                  placeholder="Contoh: Pembelian restock bahan bulanan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStockInOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20"
                >
                  Simpan Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: STOCK ADJUSTMENT (OPNAME) ================= */}
      {isAdjustOpen && adjustMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-slate-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">STOCK ADJUSTMENT / OPNAME</h3>
              <button onClick={() => setIsAdjustOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Material:</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{adjustMat.name} ({adjustMat.code})</div>
                <div className="text-slate-600 mt-1">
                  Stok Sistem Saat Ini: <strong>{adjustMat.stock} {adjustMat.unit}</strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Stok Fisik Aktual (Hasil Hitung Fisik) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={actualStock}
                  onChange={e => setActualStock(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-black text-slate-900"
                />
              </div>

              <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs flex justify-between">
                <span className="text-slate-600 font-medium">Selisih Penyesuaian:</span>
                <span className={`font-black ${(actualStock - adjustMat.stock) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {(actualStock - adjustMat.stock) > 0 ? `+${(actualStock - adjustMat.stock).toFixed(2)}` : (actualStock - adjustMat.stock).toFixed(2)} {adjustMat.unit}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Alasan Penyesuaian (Wajib diisi) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Contoh: Stock Opname bulanan, bahan cacat terpotong..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
