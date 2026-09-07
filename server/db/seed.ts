import bcrypt from 'bcryptjs';
import { db } from './database.js';

export function seedDatabase() {
  console.log('Seeding KKTS Digital Printing database...');

  // 1. Roles
  const existingRole = db.queryOne('SELECT id FROM roles WHERE id = ?', ['ADMIN']);
  if (!existingRole) {
    db.run('INSERT INTO roles (id, name) VALUES (?, ?)', ['ADMIN', 'Admin / Owner']);
    db.run('INSERT INTO roles (id, name) VALUES (?, ?)', ['KASIR', 'Kasir']);

    // Permissions
    const permissions = [
      'dashboard:view',
      'pos:create',
      'transactions:view',
      'transactions:void',
      'transactions:reprint',
      'production:view',
      'production:update',
      'products:manage',
      'materials:manage',
      'stock:manage',
      'customers:manage',
      'users:manage',
      'reports:full',
      'reports:cashier_daily',
      'reports:cashier_monthly',
      'settings:manage',
      'backup:manage'
    ];

    for (const perm of permissions) {
      db.run('INSERT OR IGNORE INTO permissions (id, name) VALUES (?, ?)', [perm, perm]);
      // Admin gets all
      db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', ['ADMIN', perm]);
    }

    // Kasir gets limited permissions
    const kasirPerms = [
      'dashboard:view',
      'pos:create',
      'transactions:view',
      'transactions:reprint',
      'production:view',
      'production:update',
      'reports:cashier_daily',
      'reports:cashier_monthly'
    ];
    for (const perm of kasirPerms) {
      db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', ['KASIR', perm]);
    }
  }

  // 2. Default Users
  const now = new Date().toISOString();
  const adminUser = db.queryOne('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.run(
      `INSERT INTO users (id, name, username, password_hash, role_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['USR-ADMIN', 'Owner / Administrator', 'admin', adminHash, 'ADMIN', 'ACTIVE', now, now]
    );
  }

  const kasirUser = db.queryOne('SELECT id FROM users WHERE username = ?', ['kasir1']);
  if (!kasirUser) {
    const kasirHash = bcrypt.hashSync('kasir123', 10);
    db.run(
      `INSERT INTO users (id, name, username, password_hash, role_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['USR-KASIR1', 'Andi Kasir', 'kasir1', kasirHash, 'KASIR', 'ACTIVE', now, now]
    );
  }

  // 3. Settings
  const defaultSettings = [
    { key: 'store_name', value: 'KKTS DIGITAL PRINTING' },
    { key: 'store_address', value: 'Jl. Grafika Percetakan Digital No. 88' },
    { key: 'store_phone', value: '0812-3456-7890' },
    { key: 'cashier_report_scope', value: 'OWN_TRANSACTIONS' }, // OWN_TRANSACTIONS or ALL_STORE_TRANSACTIONS
    { key: 'allow_negative_stock', value: 'false' },
    { key: 'printer_name', value: 'IWARE C58AC' },
    { key: 'printer_paper_width', value: '58mm' },
    { key: 'receipt_footer_note', value: 'TERIMA KASIH ATAS KUNJUNGAN ANDA' }
  ];

  for (const s of defaultSettings) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
  }

  // 4. Categories
  const categories = [
    { id: 'CAT-BANNER', name: 'Banner & Spanduk', type: 'PRODUCT' },
    { id: 'CAT-STIKER', name: 'Stiker & Label', type: 'PRODUCT' },
    { id: 'CAT-OFFSET', name: 'Digital Offset', type: 'PRODUCT' },
    { id: 'CAT-DISPLAY', name: 'Display & Promosi', type: 'PRODUCT' },
    { id: 'CAT-MAT-FLEXI', name: 'Bahan Flexi', type: 'MATERIAL' },
    { id: 'CAT-MAT-VINYL', name: 'Bahan Vinyl & Stiker', type: 'MATERIAL' },
    { id: 'CAT-MAT-PAPER', name: 'Bahan Kertas', type: 'MATERIAL' },
    { id: 'CAT-MAT-ACC', name: 'Aksesoris & Finishing', type: 'MATERIAL' }
  ];

  for (const cat of categories) {
    db.run('INSERT OR IGNORE INTO categories (id, name, type, status) VALUES (?, ?, ?, ?)', [cat.id, cat.name, cat.type, 'ACTIVE']);
  }

  // 5. Suppliers
  const suppliers = [
    { id: 'SUP-001', name: 'PT. Graha Digital Grafika', phone: '081122334455', address: 'Kawasan Industri Grafika Blok A', notes: 'Supplier Flexi & Vinyl' },
    { id: 'SUP-002', name: 'CV. Sumber Kertas Indah', phone: '082233445566', address: 'Sentra Kertas No. 12', notes: 'Supplier Art Paper & Aksesoris' }
  ];

  for (const sup of suppliers) {
    db.run('INSERT OR IGNORE INTO suppliers (id, name, phone, address, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sup.id, sup.name, sup.phone, sup.address, sup.notes, 'ACTIVE', now]
    );
  }

  // 6. Materials (Shared material support)
  const materials = [
    {
      id: 'MAT-FLX-280',
      code: 'FLX-280',
      name: 'Flexi 280 gsm',
      category_id: 'CAT-MAT-FLEXI',
      unit: 'M2',
      stock: 150.0,
      minimum_stock: 20.0,
      cost_price: 15000.0,
      supplier_id: 'SUP-001',
      conversion_rule: 'Width(m) x Height(m)'
    },
    {
      id: 'MAT-FLX-340',
      code: 'FLX-340',
      name: 'Flexi 340 gsm',
      category_id: 'CAT-MAT-FLEXI',
      unit: 'M2',
      stock: 80.0,
      minimum_stock: 20.0,
      cost_price: 19000.0,
      supplier_id: 'SUP-001',
      conversion_rule: 'Width(m) x Height(m)'
    },
    {
      id: 'MAT-STK-CAM',
      code: 'STK-CAMEL',
      name: 'Stiker Camel Vinyl',
      category_id: 'CAT-MAT-VINYL',
      unit: 'METER',
      stock: 100.0, // Initial stock 100 meter as in prompt!
      minimum_stock: 15.0,
      cost_price: 18000.0,
      supplier_id: 'SUP-001',
      conversion_rule: 'Length in meter'
    },
    {
      id: 'MAT-ALB-180',
      code: 'ALB-180',
      name: 'Albatros 180 gsm',
      category_id: 'CAT-MAT-VINYL',
      unit: 'M2',
      stock: 50.0,
      minimum_stock: 10.0,
      cost_price: 28000.0,
      supplier_id: 'SUP-001',
      conversion_rule: 'Area in M2'
    },
    {
      id: 'MAT-ART-260',
      code: 'ART-260',
      name: 'Art Paper 260 gsm',
      category_id: 'CAT-MAT-PAPER',
      unit: 'PCS',
      stock: 500.0,
      minimum_stock: 50.0,
      cost_price: 1000.0,
      supplier_id: 'SUP-002',
      conversion_rule: 'PCS sheets'
    },
    {
      id: 'MAT-MATA-AYAM',
      code: 'ACC-MATA-AYAM',
      name: 'Mata Ayam / Ring Keling',
      category_id: 'CAT-MAT-ACC',
      unit: 'PCS',
      stock: 1000.0,
      minimum_stock: 100.0,
      cost_price: 250.0,
      supplier_id: 'SUP-002',
      conversion_rule: 'Pieces used'
    },
    {
      id: 'MAT-STAND-XB',
      code: 'DIS-XBAN-60',
      name: 'Rangka X-Banner 60x160',
      category_id: 'CAT-MAT-ACC',
      unit: 'PCS',
      stock: 30.0,
      minimum_stock: 5.0,
      cost_price: 35000.0,
      supplier_id: 'SUP-002',
      conversion_rule: 'Set unit'
    }
  ];

  for (const mat of materials) {
    const exists = db.queryOne('SELECT id FROM materials WHERE id = ?', [mat.id]);
    if (!exists) {
      db.run(
        `INSERT INTO materials (id, code, name, category_id, unit, stock, minimum_stock, cost_price, supplier_id, conversion_rule, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [mat.id, mat.code, mat.name, mat.category_id, mat.unit, mat.stock, mat.minimum_stock, mat.cost_price, mat.supplier_id, mat.conversion_rule, now, now]
      );

      // Record initial stock movement
      db.run(
        `INSERT INTO stock_movements (id, material_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, note, created_at)
         VALUES (?, ?, 'STOCK_IN', ?, 0, ?, 'INITIAL_SEED', 'INIT', 'USR-ADMIN', 'Saldo Awal Sistem', ?)`,
        [`MOV-${Date.now()}-${mat.code}`, mat.id, mat.stock, mat.stock, now]
      );
    }
  }

  // 7. Customers
  const customers = [
    { id: 'CUS-UMUM', name: 'Customer Umum', phone: '-', address: '-', notes: 'Pelanggan Langsung (Walk-in)' },
    { id: 'CUS-001', name: 'Percetakan Abadi', phone: '081234567890', address: 'Jl. Merdeka No. 10', notes: 'Pelanggan Tetap Reseller' },
    { id: 'CUS-002', name: 'Toko Berkah Mandiri', phone: '085678901234', address: 'Pasar Baru Blok C-4', notes: 'Langganan Banner & Stiker' }
  ];

  for (const c of customers) {
    db.run(
      `INSERT OR IGNORE INTO customers (id, name, phone, address, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [c.id, c.name, c.phone, c.address, c.notes, now, now]
    );
  }

  // 8. Products, Variants, and BOM
  const products = [
    {
      id: 'PRD-BNR-OUT',
      sku: 'BNR-OUT-280',
      name: 'Banner Outdoor',
      category_id: 'CAT-BANNER',
      pricing_type: 'M2',
      base_price: 30000.0,
      unit: 'M2',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-BNR-TF', name: 'Tanpa Finishing', price: 0 },
        { id: 'VAR-BNR-MA', name: 'Mata Ayam', price: 0 },
        { id: 'VAR-BNR-JK', name: 'Jahit Keliling', price: 2000 },
        { id: 'VAR-BNR-SL', name: 'Selongsong', price: 3000 }
      ],
      bom: [
        { material_id: 'MAT-FLX-280', calc_type: 'PER_M2', qty: 1.0, variant_id: null },
        { material_id: 'MAT-MATA-AYAM', calc_type: 'FIXED', qty: 4.0, variant_id: 'VAR-BNR-MA' }
      ]
    },
    {
      id: 'PRD-BNR-IN',
      sku: 'BNR-IN-340',
      name: 'Banner Indoor Hi-Res',
      category_id: 'CAT-BANNER',
      pricing_type: 'M2',
      base_price: 45000.0,
      unit: 'M2',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-BNRI-TF', name: 'Tanpa Finishing', price: 0 },
        { id: 'VAR-BNRI-MA', name: 'Mata Ayam', price: 0 }
      ],
      bom: [
        { material_id: 'MAT-FLX-340', calc_type: 'PER_M2', qty: 1.0, variant_id: null },
        { material_id: 'MAT-MATA-AYAM', calc_type: 'FIXED', qty: 4.0, variant_id: 'VAR-BNRI-MA' }
      ]
    },
    {
      id: 'PRD-STK-KC',
      sku: 'STK-CAM-KC',
      name: 'Stiker Camel Vinyl - Kisscut',
      category_id: 'CAT-STIKER',
      pricing_type: 'METER',
      base_price: 35000.0,
      unit: 'METER',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-STK-KC', name: 'Kisscut', price: 0 }
      ],
      bom: [
        { material_id: 'MAT-STK-CAM', calc_type: 'PER_METER', qty: 1.0, variant_id: null }
      ]
    },
    {
      id: 'PRD-STK-NKC',
      sku: 'STK-CAM-NKC',
      name: 'Stiker Camel Vinyl - Tanpa Kisscut',
      category_id: 'CAT-STIKER',
      pricing_type: 'METER',
      base_price: 25000.0,
      unit: 'METER',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-STK-NKC', name: 'Tanpa Kisscut', price: 0 }
      ],
      bom: [
        // SHARED MATERIAL: Uses the exact same MAT-STK-CAM as Kisscut!
        { material_id: 'MAT-STK-CAM', calc_type: 'PER_METER', qty: 1.0, variant_id: null }
      ]
    },
    {
      id: 'PRD-KN-260',
      sku: 'KN-AP-260',
      name: 'Kartu Nama 1 Box (100 pcs)',
      category_id: 'CAT-OFFSET',
      pricing_type: 'PCS',
      base_price: 40000.0,
      unit: 'BOX',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-KN-STD', name: 'Standard (Tanpa Laminasi)', price: 0 },
        { id: 'VAR-KN-DOFF', name: 'Laminasi Doff 2 Sisi', price: 15000 },
        { id: 'VAR-KN-GLOSS', name: 'Laminasi Glossy 2 Sisi', price: 15000 }
      ],
      bom: [
        { material_id: 'MAT-ART-260', calc_type: 'PER_PCS', qty: 10.0, variant_id: null } // 10 sheets A3+ per box
      ]
    },
    {
      id: 'PRD-XB-STD',
      sku: 'XB-ALB-60',
      name: 'X-Banner Standar 60x160 cm',
      category_id: 'CAT-DISPLAY',
      pricing_type: 'FIXED',
      base_price: 85000.0,
      unit: 'SET',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-XB-ALB', name: 'Bahan Albatros + Rangka', price: 0 }
      ],
      bom: [
        { material_id: 'MAT-ALB-180', calc_type: 'FIXED', qty: 1.0, variant_id: null },
        { material_id: 'MAT-STAND-XB', calc_type: 'FIXED', qty: 1.0, variant_id: null },
        { material_id: 'MAT-MATA-AYAM', calc_type: 'FIXED', qty: 4.0, variant_id: null }
      ]
    },
    {
      id: 'PRD-PST-A3',
      sku: 'PST-AP-A3',
      name: 'Poster A3+ Art Paper 260',
      category_id: 'CAT-OFFSET',
      pricing_type: 'PCS',
      base_price: 5000.0,
      unit: 'LEMBAR',
      m2_rounding_rule: 'ACTUAL',
      variants: [
        { id: 'VAR-PST-STD', name: 'Tanpa Laminasi', price: 0 },
        { id: 'VAR-PST-LAM', name: 'Laminasi Panas', price: 2500 }
      ],
      bom: [
        { material_id: 'MAT-ART-260', calc_type: 'PER_PCS', qty: 1.0, variant_id: null }
      ]
    }
  ];

  for (const prod of products) {
    const exists = db.queryOne('SELECT id FROM products WHERE id = ?', [prod.id]);
    if (!exists) {
      db.run(
        `INSERT INTO products (id, sku, name, category_id, pricing_type, base_price, unit, m2_rounding_rule, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [prod.id, prod.sku, prod.name, prod.category_id, prod.pricing_type, prod.base_price, prod.unit, prod.m2_rounding_rule, now, now]
      );

      for (const v of prod.variants) {
        db.run(
          `INSERT OR IGNORE INTO product_variants (id, product_id, name, additional_price, status)
           VALUES (?, ?, ?, ?, 'ACTIVE')`,
          [v.id, prod.id, v.name, v.price]
        );
      }

      for (const b of prod.bom) {
        db.run(
          `INSERT OR IGNORE INTO product_materials (id, product_id, variant_id, material_id, calculation_type, quantity_required)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`BOM-${prod.id}-${b.material_id}-${b.variant_id || 'ALL'}`, prod.id, b.variant_id, b.material_id, b.calc_type, b.qty]
        );
      }
    }
  }

  console.log('Database seeding complete successfully!');
}

if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seedDatabase();
}
