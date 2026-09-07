import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/Toast.js';
import { Product, Category, Customer, CartItem, ProductVariant, ReceiptData } from '../types/index.js';
import { formatRupiah } from '../services/formatters.js';
import { CurrencyInput } from '../components/CurrencyInput.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  FileText,
  Printer,
  CreditCard,
  Banknote,
  RotateCcw
} from 'lucide-react';

export const POSPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Master data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('CUS-UMUM');
  const [discount, setDiscount] = useState<number>(0);
  const [transactionNote, setTransactionNote] = useState<string>('');

  // Selected item modal for dimension / variant input
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalVariant, setModalVariant] = useState<ProductVariant | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalWidth, setModalWidth] = useState<string>('1');
  const [modalHeight, setModalHeight] = useState<string>('1');
  const [modalDimensionUnit, setModalDimensionUnit] = useState<'m' | 'cm'>('m');
  const [calcPreview, setCalcPreview] = useState<any>(null);

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [transferBank, setTransferBank] = useState<string>('BCA');
  const [transferRef, setTransferRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Stock blocker modal state
  const [stockBlocker, setStockBlocker] = useState<any>(null);

  // Completed transaction & Receipt modal
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [completedTrx, setCompletedTrx] = useState<any>(null);

  // Quick customer modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load catalog data
  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await api.pos.getCatalog();
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setCustomers(data.customers || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && !isCheckoutOpen) {
          openCheckout();
        }
      } else if (e.key === 'Escape') {
        if (stockBlocker) setStockBlocker(null);
        else if (modalProduct) setModalProduct(null);
        else if (isAddCustomerOpen) setIsAddCustomerOpen(false);
        else if (isReceiptOpen) setIsReceiptOpen(false);
        else if (isCheckoutOpen) setIsCheckoutOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutOpen, modalProduct, isReceiptOpen, stockBlocker, isAddCustomerOpen]);

  // Dynamic recalculation when modal inputs change
  useEffect(() => {
    if (!modalProduct) return;

    const basePrice = modalProduct.base_price + (modalVariant?.additional_price || 0);
    const w = parseFloat(modalWidth) || 0;
    const h = parseFloat(modalHeight) || 0;

    api.pos.calculate({
      pricingType: modalProduct.pricing_type,
      unitPrice: basePrice,
      quantity: modalQty,
      width: w,
      height: h,
      dimensionUnit: modalDimensionUnit,
      unit: modalProduct.unit,
      roundingRule: modalProduct.m2_rounding_rule
    }).then(res => {
      setCalcPreview(res);
    }).catch(() => {});
  }, [modalProduct, modalVariant, modalQty, modalWidth, modalHeight, modalDimensionUnit]);

  // Open modal for selected product
  const handleProductClick = (prod: Product) => {
    setModalProduct(prod);
    setModalVariant(prod.variants && prod.variants.length > 0 ? prod.variants[0] : null);
    setModalQty(1);
    setModalWidth(prod.pricing_type === 'M2' || prod.pricing_type === 'CUSTOM' ? '1' : '');
    setModalHeight(prod.pricing_type === 'M2' || prod.pricing_type === 'CUSTOM' ? '1' : '');
    setModalDimensionUnit('m');
  };

  // Add calculated item into cart
  const handleAddToCart = () => {
    if (!modalProduct || !calcPreview) return;

    const newCartItem: CartItem = {
      cartItemId: `CART-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: modalProduct.id,
      productName: modalProduct.name,
      sku: modalProduct.sku,
      pricingType: modalProduct.pricing_type,
      variantId: modalVariant?.id || null,
      variantName: modalVariant?.name || 'Standard',
      finishing: modalVariant?.name || 'Standard',
      width: calcPreview.width,
      height: calcPreview.height,
      dimensionUnit: modalDimensionUnit,
      calculatedArea: calcPreview.roundedArea || calcPreview.calculatedArea,
      unit: calcPreview.unit,
      quantity: calcPreview.quantity,
      unitPrice: calcPreview.unitPrice,
      subtotal: calcPreview.subtotal,
      formulaDescription: calcPreview.formulaDescription
    };

    setCart(prev => [...prev, newCartItem]);
    showToast(`${modalProduct.name} ditambahkan ke keranjang`, 'success');
    setModalProduct(null);
  };

  // Update cart item quantity
  const handleUpdateQty = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const nextQty = Math.max(1, item.quantity + delta);
        let nextSubtotal = 0;
        if (item.pricingType === 'M2' && item.calculatedArea) {
          nextSubtotal = Math.round(item.calculatedArea * nextQty * item.unitPrice);
        } else {
          nextSubtotal = Math.round(nextQty * item.unitPrice);
        }
        return {
          ...item,
          quantity: nextQty,
          subtotal: nextSubtotal
        };
      }
      return item;
    }));
  };

  // Remove item from cart
  const handleRemoveItem = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  // Cart calculations
  const cartSubtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
  const cartTotal = Math.max(0, cartSubtotal - discount);

  // Open checkout modal
  const openCheckout = () => {
    setPaymentAmount(cartTotal);
    setPaymentMethod('CASH');
    setIdempotencyKey(`IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    setIsCheckoutOpen(true);
  };

  // Process checkout with atomic database transaction
  const handleProcessCheckout = async () => {
    if (isSubmitting) return;

    if (paymentMethod === 'CASH' && paymentAmount < cartTotal) {
      showToast(`Pembayaran kurang Rp ${(cartTotal - paymentAmount).toLocaleString('id-ID')}`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer,
        items: cart.map(it => ({
          productId: it.productId,
          productName: it.productName,
          variantId: it.variantId,
          variantName: it.variantName,
          finishing: it.finishing,
          width: it.width,
          height: it.height,
          calculatedArea: it.calculatedArea,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          formulaDescription: it.formulaDescription
        })),
        discount,
        paymentMethod,
        paymentAmount: paymentMethod === 'CASH' ? paymentAmount : cartTotal,
        note: transactionNote,
        transferBank: paymentMethod === 'TRANSFER' ? transferBank : undefined,
        transferRef: paymentMethod === 'TRANSFER' ? transferRef : undefined,
        idempotencyKey
      };

      const result = await api.pos.checkout(payload);

      // Reset cart
      setCart([]);
      setDiscount(0);
      setTransactionNote('');
      setIsCheckoutOpen(false);

      // Show receipt modal
      setCompletedTrx(result.transaction);
      setActiveReceipt(result.paymentReceipt);
      setIsReceiptOpen(true);

      showToast(`Transaksi ${result.transaction.transactionNumber} berhasil!`, 'success');

      // Refresh catalog stock
      loadCatalog();
    } catch (err: any) {
      if (err.message && err.message.includes('tersedia')) {
        // Stock insufficiency blocker
        setStockBlocker(err.message);
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add new customer quick modal
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName) return;

    try {
      const res = await api.customers.create({ name: newCustName, phone: newCustPhone });
      setCustomers(prev => [...prev, res.customer]);
      setSelectedCustomer(res.customer.id);
      setIsAddCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      showToast('Customer berhasil ditambahkan', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    const matchesSearch = searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100">
      {/* ================= PANEL KIRI: CATALOG & SEARCH ================= */}
      <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden bg-white">
        {/* Search & Category Tabs */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari produk berdasarkan nama atau SKU... (F2)"
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-2xs"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Semua Produk
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-xs font-bold text-slate-400">
              Memuat katalog produk...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <ShoppingCart className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Belum ada produk yang cocok</p>
              <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau kategori</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => {
                return (
                  <div
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    className="group bg-white border border-slate-200 hover:border-sky-400 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div>
                      {/* Pricing Type Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                          {product.pricing_type}
                        </span>
                        {product.hasStockIssue ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            Stok Kurang
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Stok Aman
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition-colors line-clamp-2 leading-snug">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-slate-900">
                          {formatRupiah(product.base_price)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">/{product.unit}</span>
                      </div>
                      <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-all shadow-2xs">
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= PANEL KANAN: CART & CHECKOUT ================= */}
      <div className="w-96 flex flex-col bg-white shrink-0 shadow-lg select-none">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-sm text-slate-900">Keranjang Belanja</h3>
          </div>
          <span className="px-2 py-0.5 text-xs font-bold bg-sky-100 text-sky-800 rounded-full">
            {cart.length} item
          </span>
        </div>

        {/* Customer Selector */}
        <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Customer / Pemesan
            </label>
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone && c.phone !== '-' ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            title="Tambah Customer Baru"
            className="mt-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-slate-400 text-center p-4">
              <ShoppingCart className="w-10 h-10 stroke-[1.5] text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">Keranjang masih kosong</p>
              <p className="text-[11px] text-slate-400">Pilih produk di sebelah kiri untuk menambahkan pesanan</p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.cartItemId}
                className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col gap-2 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">{item.productName}</h5>
                    {item.variantName && item.variantName !== 'Standard' && (
                      <span className="inline-block text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 mt-0.5">
                        {item.variantName}
                      </span>
                    )}
                    {item.pricingType === 'M2' && item.width && item.height && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.width} × {item.height} m ({item.calculatedArea} M²)
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.cartItemId)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      onClick={() => handleUpdateQty(item.cartItemId, -1)}
                      className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-slate-900 w-6 text-center font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(item.cartItemId, 1)}
                      className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Totals & Checkout Trigger */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold">{formatRupiah(cartSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Diskon</span>
              <div className="w-32">
                <CurrencyInput
                  value={discount}
                  onChange={setDiscount}
                  placeholder="Rp 0"
                  className="py-1 px-2 text-xs text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-sm font-bold text-slate-900">Total Bayar</span>
              <span className="text-lg font-black text-sky-700">{formatRupiah(cartTotal)}</span>
            </div>
          </div>

          <button
            onClick={openCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 hover:from-sky-700 hover:to-indigo-900 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>CHECKOUT / BAYAR (F4)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= MODAL 1: SIZE / VARIANT CALCULATOR ================= */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 uppercase tracking-wider">
                    {modalProduct.pricing_type} CALCULATION
                  </span>
                  <h3 className="font-bold text-lg mt-1">{modalProduct.name}</h3>
                  <p className="text-xs text-sky-100">{modalProduct.sku} | Base: {formatRupiah(modalProduct.base_price)}/{modalProduct.unit}</p>
                </div>
                <button
                  onClick={() => setModalProduct(null)}
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Variant / Finishing Selection */}
              {modalProduct.variants && modalProduct.variants.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Pilih Variant / Finishing
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {modalProduct.variants.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setModalVariant(v)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                          modalVariant?.id === v.id
                            ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold">{v.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {v.additional_price > 0 ? `+${formatRupiah(v.additional_price)}` : 'Standard'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dimensions Input (For M2 & Custom) */}
              {(modalProduct.pricing_type === 'M2' || modalProduct.pricing_type === 'CUSTOM') && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Ukuran Custom
                    </label>
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setModalDimensionUnit('m')}
                        className={`px-2 py-1 rounded-md transition-all ${
                          modalDimensionUnit === 'm' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Meter (m)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalDimensionUnit('cm')}
                        className={`px-2 py-1 rounded-md transition-all ${
                          modalDimensionUnit === 'cm' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Centimeter (cm)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Lebar ({modalDimensionUnit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={modalWidth}
                        onChange={e => setModalWidth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-500"
                        placeholder="Contoh: 3.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Tinggi ({modalDimensionUnit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={modalHeight}
                        onChange={e => setModalHeight(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-500"
                        placeholder="Contoh: 1.5"
                      />
                    </div>
                  </div>

                  {modalProduct.m2_rounding_rule !== 'ACTUAL' && (
                    <div className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Rule Pembulatan Produk: <strong>{modalProduct.m2_rounding_rule}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {modalProduct.pricing_type === 'METER' ? 'Panjang (Meter)' : 'Jumlah (Quantity / Pcs)'}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setModalQty(q => Math.max(1, q - 1))}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={modalQty}
                      onChange={e => setModalQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-center font-bold text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setModalQty(q => q + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase">{modalProduct.unit}</span>
                </div>
              </div>

              {/* Calculation Breakdown Preview */}
              {calcPreview && (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs space-y-1.5">
                  <div className="text-slate-500 font-medium">Formula Perhitungan:</div>
                  <div className="font-mono text-sky-900 font-semibold text-[11px] leading-relaxed">
                    {calcPreview.formulaDescription}
                  </div>
                  <div className="pt-2 border-t border-sky-200 flex items-center justify-between font-bold">
                    <span className="text-slate-700">Estimasi Subtotal:</span>
                    <span className="text-base text-sky-700 font-black">{formatRupiah(calcPreview.subtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddToCart}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20"
              >
                + Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CHECKOUT & PAYMENT ================= */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Checkout & Pembayaran</h3>
                <p className="text-xs text-sky-200">KKTS DIGITAL PRINTING | Kasir: {user?.name}</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Checkout Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Grand Total Display */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">TOTAL TAGIHAN</span>
                  <div className="text-2xl font-black text-sky-400">{formatRupiah(cartTotal)}</div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>Subtotal: {formatRupiah(cartSubtotal)}</div>
                  {discount > 0 && <div className="text-rose-400">Diskon: -{formatRupiah(discount)}</div>}
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setPaymentAmount(cartTotal);
                    }}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>TUNAI (CASH)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('TRANSFER');
                      setPaymentAmount(cartTotal);
                    }}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'TRANSFER'
                        ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>TRANSFER / QRIS</span>
                  </button>
                </div>
              </div>

              {/* CASH Payment Input & Quick Chips */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Jumlah Pembayaran Tunai
                  </label>
                  <CurrencyInput
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    className="w-full text-lg py-2.5"
                    autoFocus
                  />

                  {/* Quick Denominations */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(cartTotal)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 hover:bg-sky-50 hover:text-sky-700 text-slate-700 shadow-2xs"
                    >
                      Uang Pas
                    </button>
                    {[50000, 100000, 200000, 500000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPaymentAmount(amt)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 hover:bg-sky-50 hover:text-sky-700 text-slate-700 shadow-2xs"
                      >
                        {formatRupiah(amt)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian / Underpaid indicator */}
                  {paymentAmount >= cartTotal ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span>KEMBALIAN:</span>
                      <span className="text-base font-black text-emerald-700">
                        {formatRupiah(paymentAmount - cartTotal)}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Pembayaran kurang {formatRupiah(cartTotal - paymentAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TRANSFER Bank & Ref */}
              {paymentMethod === 'TRANSFER' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pilih Bank / QRIS
                    </label>
                    <select
                      value={transferBank}
                      onChange={e => setTransferBank(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="BCA">BCA (Bank Central Asia)</option>
                      <option value="Mandiri">Bank Mandiri</option>
                      <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                      <option value="BNI">BNI</option>
                      <option value="QRIS">QRIS Standar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nomor Referensi / Approval Code
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={e => setTransferRef(e.target.value)}
                      placeholder="Contoh: REF-987654"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Transaction Note for Production */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan Transaksi / Produksi (Opsional)
                </label>
                <textarea
                  value={transactionNote}
                  onChange={e => setTransactionNote(e.target.value)}
                  placeholder="Contoh: Cetak urgent, file dari WA, warna dominan biru..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleProcessCheckout}
                disabled={isSubmitting || (paymentMethod === 'CASH' && paymentAmount < cartTotal)}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>Memproses...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>KONFIRMASI BAYAR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: STOCK INSUFFICIENT BLOCKER ================= */}
      {stockBlocker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">STOCK TIDAK MENCUKUPI</h3>
            <p className="text-xs text-slate-600 bg-rose-50 border border-rose-200 p-3 rounded-xl leading-relaxed text-left">
              {stockBlocker}
            </p>
            <p className="text-[11px] text-slate-500">
              Transaksi diblokir karena kebijakan sistem tidak mengizinkan stok negatif. Silakan kurangi kuantitas pesanan atau hubungi Admin untuk Stock In bahan.
            </p>
            <button
              onClick={() => setStockBlocker(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Mengerti & Periksa Kembali
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: QUICK ADD CUSTOMER ================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Tambah Customer Baru</h3>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Customer *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="Contoh: Percetakan Maju"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nomor WhatsApp / HP</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 text-white font-bold text-xs rounded-lg hover:bg-sky-700"
                >
                  Simpan Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: RECEIPT MODAL (58mm ESC/POS) ================= */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={activeReceipt}
        title={activeReceipt?.type === 'PRODUCTION_RECEIPT' ? 'Struk Produksi (58mm ESC/POS)' : 'Struk Kasir (58mm ESC/POS)'}
      />
    </div>
  );
};
