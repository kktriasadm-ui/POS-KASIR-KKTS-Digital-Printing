import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { StockEngine } from '../engines/StockEngine.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /: List materials with stock status and category
 */
router.get('/', (req, res) => {
  const materials = db.query<any>(
    `SELECT m.*, c.name AS category_name, s.name AS supplier_name
     FROM materials m
     LEFT JOIN categories c ON m.category_id = c.id
     LEFT JOIN suppliers s ON m.supplier_id = s.id
     WHERE m.status != 'ARCHIVED'
     ORDER BY m.name ASC`
  );

  for (const m of materials) {
    m.stockStatus = StockEngine.getStockStatus(m.stock, m.minimum_stock);

    const usageRow = db.queryOne<any>(
      'SELECT COUNT(id) AS usage_count FROM stock_movements WHERE material_id = ?',
      [m.id]
    );
    m.usageCount = usageRow?.usage_count || 0;
  }

  const categories = db.query<any>("SELECT * FROM categories WHERE type = 'MATERIAL' AND status = 'ACTIVE' ORDER BY name ASC");
  const suppliers = db.query<any>("SELECT * FROM suppliers WHERE status = 'ACTIVE' ORDER BY name ASC");

  return res.json({ materials, categories, suppliers });
});

/**
 * POST /: Create material
 */
router.post('/', (req, res) => {
  const {
    code,
    name,
    categoryId,
    unit = 'METER',
    initialStock = 0,
    minimumStock = 20,
    costPrice = 0,
    supplierId,
    conversionRule
  } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Kode dan Nama material wajib diisi' });
  }

  const existing = db.queryOne<any>('SELECT id FROM materials WHERE code = ?', [code]);
  if (existing) {
    return res.status(400).json({ error: `Kode material '${code}' sudah ada` });
  }

  const materialId = `MAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  try {
    db.transaction(() => {
      db.run(
        `INSERT INTO materials (id, code, name, category_id, unit, stock, minimum_stock, cost_price, supplier_id, conversion_rule, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [materialId, code, name, categoryId || null, unit, Number(initialStock), Number(minimumStock), Number(costPrice), supplierId || null, conversionRule || null, now, now]
      );

      if (Number(initialStock) > 0) {
        db.run(
          `INSERT INTO stock_movements (id, material_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, note, created_at)
           VALUES (?, ?, 'STOCK_IN', ?, 0, ?, 'INITIAL', 'MANUAL_INIT', ?, 'Saldo Awal', ?)`,
          [`MOV-INIT-${Date.now()}`, materialId, Number(initialStock), Number(initialStock), req.user!.id, now]
        );
      }

      AuditService.log({
        userId: req.user!.id,
        role: req.user!.role,
        action: 'CREATE_MATERIAL',
        entity: 'MATERIALS',
        entityId: materialId,
        afterValue: { code, name, stock: initialStock, costPrice }
      });
    });

    return res.json({ success: true, message: 'Material berhasil ditambahkan', materialId });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal menambahkan material: ${err.message}` });
  }
});

/**
 * PUT /:id: Edit material
 */
router.put('/:id', (req, res) => {
  const { code, name, categoryId, unit, minimumStock, costPrice, supplierId, conversionRule } = req.body;

  const current = db.queryOne<any>('SELECT * FROM materials WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Material tidak ditemukan' });
  }

  const now = new Date().toISOString();

  db.run(
    `UPDATE materials
     SET code = ?, name = ?, category_id = ?, unit = ?, minimum_stock = ?,
         cost_price = ?, supplier_id = ?, conversion_rule = ?, updated_at = ?
     WHERE id = ?`,
    [
      code || current.code,
      name || current.name,
      categoryId !== undefined ? categoryId : current.category_id,
      unit || current.unit,
      minimumStock !== undefined ? Number(minimumStock) : current.minimum_stock,
      costPrice !== undefined ? Number(costPrice) : current.cost_price,
      supplierId !== undefined ? supplierId : current.supplier_id,
      conversionRule !== undefined ? conversionRule : current.conversion_rule,
      now,
      req.params.id
    ]
  );

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'EDIT_MATERIAL',
    entity: 'MATERIALS',
    entityId: req.params.id,
    beforeValue: { code: current.code, name: current.name, costPrice: current.cost_price },
    afterValue: { code, name, costPrice }
  });

  return res.json({ success: true, message: 'Material berhasil diperbarui' });
});

/**
 * DELETE /:id: Archive or Delete Material
 */
router.delete('/:id', (req, res) => {
  const current = db.queryOne<any>('SELECT * FROM materials WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Material tidak ditemukan' });
  }

  const usage = db.queryOne<any>(
    'SELECT COUNT(id) AS usage_count FROM stock_movements WHERE material_id = ?',
    [req.params.id]
  );

  const now = new Date().toISOString();

  if (usage && usage.usage_count > 0) {
    db.run(
      "UPDATE materials SET status = 'ARCHIVED', archived_at = ?, updated_at = ? WHERE id = ?",
      [now, now, req.params.id]
    );

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'ARCHIVE_MATERIAL',
      entity: 'MATERIALS',
      entityId: req.params.id,
      beforeValue: { status: current.status },
      afterValue: { status: 'ARCHIVED' }
    });

    return res.json({ success: true, message: 'Material diarsipkan karena memiliki riwayat stok.' });
  } else {
    db.run('DELETE FROM materials WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Material berhasil dihapus' });
  }
});

/**
 * POST /stock-in: Stock In
 */
router.post('/stock-in', (req, res) => {
  const { materialId, quantity, costPrice, supplierId, invoiceNumber, note } = req.body;

  if (!materialId || !quantity || Number(quantity) <= 0) {
    return res.status(400).json({ error: 'Material dan jumlah stock (quantity) wajib diisi valid' });
  }

  try {
    const result = StockEngine.addStock({
      materialId,
      quantity: Number(quantity),
      costPrice: costPrice ? Number(costPrice) : undefined,
      supplierId,
      invoiceNumber,
      note,
      userId: req.user!.id
    });

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'STOCK_IN',
      entity: 'MATERIALS',
      entityId: materialId,
      afterValue: { qty: quantity, ...result, invoice: invoiceNumber }
    });

    return res.json({ success: true, message: 'Stock berhasil ditambahkan', ...result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /stock-adjust: Stock Opname Adjustment
 */
router.post('/stock-adjust', (req, res) => {
  const { materialId, actualStock, reason } = req.body;

  if (!materialId || actualStock === undefined || !reason || reason.trim() === '') {
    return res.status(400).json({ error: 'Material, stok fisik aktual, dan alasan penyesuaian wajib diisi' });
  }

  try {
    const result = StockEngine.adjustStock({
      materialId,
      actualStock: Number(actualStock),
      reason,
      userId: req.user!.id
    });

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'STOCK_ADJUSTMENT',
      entity: 'MATERIALS',
      entityId: materialId,
      beforeValue: { stock: result.stockBefore },
      afterValue: { stock: result.stockAfter, diff: result.diff, reason }
    });

    return res.json({ success: true, message: 'Penyesuaian stock berhasil disimpan', ...result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /movements: Stock Movement History
 */
router.get('/movements', (req, res) => {
  const { materialId, limit = 50 } = req.query;

  let sql = `
    SELECT sm.*, m.name AS material_name, m.code AS material_code, m.unit, u.name AS user_name
    FROM stock_movements sm
    JOIN materials m ON sm.material_id = m.id
    JOIN users u ON sm.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (materialId) {
    sql += ' AND sm.material_id = ?';
    params.push(materialId);
  }

  sql += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const movements = db.query<any>(sql, params);
  return res.json({ movements });
});

export default router;
