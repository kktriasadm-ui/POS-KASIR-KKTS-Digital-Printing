-- KKTS DIGITAL PRINTING
-- Relational SQLite Database Schema
-- Strict ID foreign keys, historical snapshot support, soft delete/archive flags

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISABLED
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  disabled_at TEXT,
  disabled_by TEXT,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'PRODUCT', -- PRODUCT, MATERIAL
  status TEXT NOT NULL DEFAULT 'ACTIVE' -- ACTIVE, ARCHIVED
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT,
  unit TEXT NOT NULL DEFAULT 'METER', -- METER, M2, PCS, ROLL, LITER
  stock REAL NOT NULL DEFAULT 0.0,
  minimum_stock REAL NOT NULL DEFAULT 20.0,
  cost_price REAL NOT NULL DEFAULT 0.0,
  supplier_id TEXT,
  conversion_rule TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'PCS', -- PCS, METER, M2, FIXED, CUSTOM
  base_price REAL NOT NULL DEFAULT 0.0,
  unit TEXT NOT NULL DEFAULT 'PCS',
  m2_rounding_rule TEXT NOT NULL DEFAULT 'ACTUAL', -- ACTUAL, ROUND_UP, ROUND_UP_HALF
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  additional_price REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Bill of Materials (BOM)
CREATE TABLE IF NOT EXISTS product_materials (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  material_id TEXT NOT NULL,
  calculation_type TEXT NOT NULL DEFAULT 'PER_M2', -- PER_M2, PER_METER, PER_PCS, FIXED
  quantity_required REAL NOT NULL DEFAULT 1.0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL UNIQUE, -- TRX-YYYYMMDD-XXXX
  customer_id TEXT,
  cashier_id TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0.0,
  discount REAL NOT NULL DEFAULT 0.0,
  total REAL NOT NULL DEFAULT 0.0,
  payment_method TEXT NOT NULL DEFAULT 'CASH', -- CASH, TRANSFER
  payment_amount REAL NOT NULL DEFAULT 0.0,
  change_amount REAL NOT NULL DEFAULT 0.0,
  payment_status TEXT NOT NULL DEFAULT 'PAID', -- PAID, CANCELLED
  production_status TEXT NOT NULL DEFAULT 'MENUNGGU', -- MENUNGGU, DIPROSES, SELESAI, DIAMBIL, DIBATALKAN
  note TEXT,
  transfer_bank TEXT,
  transfer_ref TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT,
  finishing_snapshot TEXT,
  width REAL,
  height REAL,
  calculated_area REAL,
  unit TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1.0,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  material_snapshot TEXT,
  formula_snapshot TEXT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  movement_type TEXT NOT NULL, -- SALE, STOCK_IN, ADJUSTMENT, VOID_REVERSAL
  quantity REAL NOT NULL, -- can be negative or positive
  stock_before REAL NOT NULL,
  stock_after REAL NOT NULL,
  reference_type TEXT, -- TRANSACTION, STOCK_IN, ADJUSTMENT, VOID
  reference_id TEXT,
  user_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS production_jobs (
  id TEXT PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE, -- JOB-YYYYMMDD-XXXX
  transaction_id TEXT NOT NULL,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU', -- MENUNGGU, DIPROSES, SELESAI, DIAMBIL, DIBATALKAN
  notes TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  picked_up_at TEXT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS production_status_logs (
  id TEXT PRIMARY KEY,
  production_job_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (production_job_id) REFERENCES production_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS print_logs (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  print_type TEXT NOT NULL, -- PAYMENT_RECEIPT, PRODUCTION_RECEIPT
  printed_by TEXT NOT NULL,
  printer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  printed_at TEXT NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (printed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Essential Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_transaction_items_trx ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_mat ON stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_production_jobs_status ON production_jobs(status);
CREATE INDEX IF NOT EXISTS idx_production_jobs_trx ON production_jobs(transaction_id);
