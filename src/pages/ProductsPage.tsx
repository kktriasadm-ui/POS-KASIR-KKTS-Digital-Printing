import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { Product, Category, Material } from '../types/index.js';
import { formatRupiah } from '../services/formatters.js';
import { CurrencyInput } from '../components/CurrencyInput.js';
import {
  Package,
  Plus,
  Edit2,
  Archive,
  Search,
  Layers,
  Boxes,
  Trash2,
  Check
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pricingType, setPricingType] = useState<'PCS' | 'METER' | 'M2' | 'FIXED' | 'CUSTOM'>('M2');
  const [basePrice, setBasePrice] = useState<number>(0);
  const [unit, setUnit] = useState('M2');
  const [m2RoundingRule, setM2RoundingRule] = useState<'ACTUAL' | 'ROUND_UP' | 'ROUND_UP_HALF'>('ACTUAL');

  // Variants in form
  const [variants, setVariants] = useState<Array<{ id?: string; name: string; additionalPrice: number }>>([]);

  // BOM in form
  const [bom, setBom] = useState<Array<{
    id?: string;
    materialId: string;
    variantId?: string | null;
    calculationType: 'PER_M2' | 'PER_METER' | 'PER_PCS' | 'FIXED';
    quantityRequired: number;
  }>>([]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.products.list();
      setProducts(res.products || []);
      setCategories(res.categories || []);
      setMaterials(res.materials || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku(`PRD-${Date.now().toString().slice(-4)}`);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setPricingType('M2');
    setBasePrice(30000);
    setUnit('M2');
    setM2RoundingRule('ACTUAL');
    setVariants([{ name: 'Tanpa Finishing', additionalPrice: 0 }]);
    setBom([]);
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setSku(prod.sku);
    setName(prod.name);
    setCategoryId(prod.category_id || '');
    setPricingType(prod.pricing_type);
    setBasePrice(prod.base_price);
    setUnit(prod.unit);
    setM2RoundingRule(prod.m2_rounding_rule);
    setVariants((prod.variants || []).map(v => ({ id: v.id, name: v.name, additionalPrice: v.additional_price })));
    setBom((prod.bom || []).map(b => ({
      id: b.id,
      materialId: b.material_id,
      variantId: b.variant_id,
      calculationType: b.calculation_type,
      quantityRequired: b.quantity_required
    })));
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name) {
      showToast('SKU dan Nama produk wajib diisi', 'error');
      return;
    }

    const payload = {
      sku,
      name,
      categoryId,
      pricingType,
      basePrice,
      unit,
      m2RoundingRule,
      variants,
      bom
    };

    try {
      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
        showToast('Produk berhasil diperbarui', 'success');
      } else {
        await api.products.create(payload);
        showToast('Produk berhasil ditambahkan', 'success');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleArchiveProduct = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin mengarsipkan produk "${name}"?`)) return;

    try {
      const res = await api.products.archive(id);
      showToast(res.message, 'success');
      fetchProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const addVariantRow = () => {
    setVariants(prev => [...prev, { name: '', additionalPrice: 0 }]);
  };

  const removeVariantRow = (idx: number) => {
    setVariants(prev => prev.filter((_, i) => i !== idx));
  };

  const addBomRow = () => {
    if (materials.length === 0) {
      showToast('Belum ada material terdaftar untuk BOM', 'error');
      return;
    }
    setBom(prev => [
      ...prev,
      {
        materialId: materials[0].id,
        variantId: null,
        calculationType: pricingType === 'M2' ? 'PER_M2' : pricingType === 'METER' ? 'PER_METER' : 'PER_PCS',
        quantityRequired: 1
      }
    ]);
  };

  const removeBomRow = (idx: number) => {
    setBom(prev => prev.filter((_, i) => i !== idx));
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-sky-600" />
            <span>Manajemen Produk & Bill of Materials (BOM)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur katalog produk jual, varian finishing, dan komposisi material (BOM). Perubahan harga tidak akan merusak histori transaksi lama.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari produk berdasarkan nama atau SKU..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU / Kode</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Pricing Type</th>
                <th className="py-3 px-4">Harga Dasar</th>
                <th className="py-3 px-4">Varian / Finishing</th>
                <th className="py-3 px-4">BOM Material</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">Memuat produk...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">Belum ada produk terdaftar.</td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.sku}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-slate-600">{p.category_name || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {p.pricing_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatRupiah(p.base_price)}/{p.unit}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {(p.variants || []).map(v => (
                          <span key={v.id} className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                            {v.name} {v.additional_price > 0 ? `(+${formatRupiah(v.additional_price)})` : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(p.bom || []).map(b => (
                          <span key={b.id} className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded font-mono">
                            {b.material_name} ({b.quantity_required})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Produk"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchiveProduct(p.id, p.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Arsipkan Produk"
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

      {/* ================= MODAL: ADD / EDIT PRODUCT ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">SKU / Kode Produk *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nama Produk *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Contoh: Banner Outdoor 280"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pricing Type</label>
                  <select
                    value={pricingType}
                    onChange={e => {
                      const nextType = e.target.value as any;
                      setPricingType(nextType);
                      if (nextType === 'M2') setUnit('M2');
                      else if (nextType === 'METER') setUnit('METER');
                      else if (nextType === 'PCS') setUnit('PCS');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="M2">M² (Meter Persegi)</option>
                    <option value="METER">METER (Panjang)</option>
                    <option value="PCS">PCS (Satuan / Box)</option>
                    <option value="FIXED">FIXED (Paket Standar)</option>
                    <option value="CUSTOM">CUSTOM (Ukuran Bebas)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Satuan (Unit)</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Harga Dasar Jual *</label>
                  <CurrencyInput
                    value={basePrice}
                    onChange={setBasePrice}
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">M² Rounding Rule</label>
                  <select
                    value={m2RoundingRule}
                    onChange={e => setM2RoundingRule(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="ACTUAL">ACTUAL (5.25 M² tetap 5.25)</option>
                    <option value="ROUND_UP">ROUND UP (5.25 M² jadi 6.0)</option>
                    <option value="ROUND_UP_HALF">ROUND UP 0.5 (5.25 M² jadi 5.5)</option>
                  </select>
                </div>
              </div>

              {/* Variants Section */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Varian / Finishing Produk</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-xs text-sky-600 font-bold hover:underline cursor-pointer"
                  >
                    + Tambah Varian
                  </button>
                </div>
                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nama varian (cth: Mata Ayam)"
                        value={v.name}
                        onChange={e => {
                          const val = e.target.value;
                          setVariants(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                        }}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                      <div className="w-36">
                        <CurrencyInput
                          value={v.additionalPrice}
                          onChange={val => {
                            setVariants(prev => prev.map((item, i) => i === idx ? { ...item, additionalPrice: val } : item));
                          }}
                          placeholder="+Rp 0"
                          className="w-full py-1.5 px-2 text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVariantRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill of Materials (BOM) Section */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase">Bill of Materials (BOM)</span>
                    <p className="text-[10px] text-slate-400">Tentukan bahan yang dikonsumsi produk ini dari stok material.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addBomRow}
                    className="text-xs text-sky-600 font-bold hover:underline cursor-pointer"
                  >
                    + Tambah Material BOM
                  </button>
                </div>

                <div className="space-y-2">
                  {bom.map((b, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                      <select
                        value={b.materialId}
                        onChange={e => {
                          const val = e.target.value;
                          setBom(prev => prev.map((item, i) => i === idx ? { ...item, materialId: val } : item));
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                      >
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.code} - Stok: {m.stock} {m.unit})</option>
                        ))}
                      </select>

                      <select
                        value={b.calculationType}
                        onChange={e => {
                          const val = e.target.value as any;
                          setBom(prev => prev.map((item, i) => i === idx ? { ...item, calculationType: val } : item));
                        }}
                        className="w-32 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="PER_M2">Per M²</option>
                        <option value="PER_METER">Per Meter</option>
                        <option value="PER_PCS">Per Pcs</option>
                        <option value="FIXED">Tetap (Fixed)</option>
                      </select>

                      <input
                        type="number"
                        step="any"
                        value={b.quantityRequired}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 1;
                          setBom(prev => prev.map((item, i) => i === idx ? { ...item, quantityRequired: val } : item));
                        }}
                        placeholder="Qty"
                        className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                      />

                      <button
                        type="button"
                        onClick={() => removeBomRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md shadow-sky-600/20"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
