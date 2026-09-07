export type UserRole = 'ADMIN' | 'KASIR';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  roleName?: string;
  permissions?: string[];
  status?: string;
  transactionCount?: number;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'PRODUCT' | 'MATERIAL';
  status: string;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
  name: string;
  additional_price: number;
  status?: string;
}

export interface ProductBOMItem {
  id?: string;
  product_id?: string;
  variant_id?: string | null;
  material_id: string;
  material_name?: string;
  material_code?: string;
  material_unit?: string;
  current_stock?: number;
  calculation_type: 'PER_M2' | 'PER_METER' | 'PER_PCS' | 'FIXED';
  quantity_required: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id?: string;
  category_name?: string;
  pricing_type: 'PCS' | 'METER' | 'M2' | 'FIXED' | 'CUSTOM';
  base_price: number;
  unit: string;
  m2_rounding_rule: 'ACTUAL' | 'ROUND_UP' | 'ROUND_UP_HALF';
  status: string;
  variants: ProductVariant[];
  bom: ProductBOMItem[];
  hasStockIssue?: boolean;
  minMaterialStock?: number;
  usageCount?: number;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  category_id?: string;
  category_name?: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  cost_price: number;
  supplier_id?: string;
  supplier_name?: string;
  conversion_rule?: string;
  status: string;
  stockStatus?: 'AMAN' | 'LOW_STOCK' | 'HABIS';
  usageCount?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  usageCount?: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  productName: string;
  sku: string;
  pricingType: 'PCS' | 'METER' | 'M2' | 'FIXED' | 'CUSTOM';
  variantId?: string | null;
  variantName?: string;
  finishing?: string;
  width?: number;
  height?: number;
  dimensionUnit?: 'm' | 'cm';
  calculatedArea?: number;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  formulaDescription: string;
  materialSnapshot?: string;
}

export interface Transaction {
  id: string;
  transaction_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  cashier_id: string;
  cashier_name: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: 'CASH' | 'TRANSFER';
  payment_amount: number;
  change_amount: number;
  payment_status: 'PAID' | 'CANCELLED';
  production_status: string;
  note?: string;
  transfer_bank?: string;
  transfer_ref?: string;
  created_at: string;
  job_number?: string;
  job_status?: string;
  items?: any[];
  itemCount?: number;
  printLogs?: any[];
}

export interface ProductionJob {
  id: string;
  job_number: string;
  transaction_id: string;
  transaction_number: string;
  transaction_time: string;
  customer_name?: string;
  customer_phone?: string;
  cashier_name: string;
  status: 'MENUNGGU' | 'DIPROSES' | 'SELESAI' | 'DIAMBIL' | 'DIBATALKAN';
  notes?: string;
  created_at: string;
  completed_at?: string;
  picked_up_at?: string;
  items?: any[];
  status_logs?: any[];
}

export interface ReceiptData {
  rawEscPos: string;
  plainText: string;
  lines: string[];
  type: 'PAYMENT_RECEIPT' | 'PRODUCTION_RECEIPT';
  transactionNumber: string;
  jobNumber?: string;
}
