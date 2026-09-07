import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

// Apply auth & admin requirement to all product management endpoints
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /: List all products with variants, categories, and BOM
 */
router.get('/', (req, res) => {
  const products = db.query<any>(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.status != 'ARCHIVED'
     ORDER BY p.name ASC`
  );

  for (const prod of products) {
    prod.variants = db.query<any>(
      "SELECT * FROM product_variants WHERE product_id = ? AND status = 'ACTIVE'",
      [prod.id]
    );
    prod.bom = db.query<any>(
      `SELECT pm.*, m.name AS material_name, m.code AS material_code, m.unit AS material_unit, m.stock AS material_stock
       FROM product_materials pm
       JOIN materials m ON pm.material_id = m.id
       WHERE pm.product_id = ?`,
      [prod.id]
    );

    const usageRow = db.queryOne<any>(
      'SELECT COUNT(id) AS usage_count FROM transaction_items WHERE product_id = ?',
      [prod.id]
    );
    prod.usageCount = usageRow?.usage_count || 0;
  }

  const categories = db.query<any>("SELECT * FROM categories WHERE type = 'PRODUCT' AND status = 'ACTIVE' ORDER BY name ASC");
  const materials = db.query<any>("SELECT id, code, name, unit, stock, cost_price FROM materials WHERE status = 'ACTIVE' ORDER BY name ASC");

  return res.json({ products, categories, materials });
});

/**
 * POST /: Create product with variants and BOM
 */
router.post('/', (req, res) => {
  const {
    sku,
    name,
    categoryId,
    pricingType = 'PCS',
    basePrice = 0,
    unit = 'PCS',
    m2RoundingRule = 'ACTUAL',
    variants = [],
    bom = []
  } = req.body;

  if (!sku || !name) {
    return res.status(400).json({ error: 'SKU dan Nama produk wajib diisi' });
  }

  const existing = db.queryOne<any>('SELECT id FROM products WHERE sku = ?', [sku]);
  if (existing) {
    return res.status(400).json({ error: `SKU '${sku}' sudah digunakan` });
  }

  const productId = `PRD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  try {
    db.transaction(() => {
      db.run(
        `INSERT INTO products (id, sku, name, category_id, pricing_type, base_price, unit, m2_rounding_rule, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [productId, sku, name, categoryId || null, pricingType, Number(basePrice), unit, m2RoundingRule, now, now]
      );

      // Insert variants
      for (const v of variants) {
        if (v.name && v.name.trim() !== '') {
          const variantId = `VAR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          db.run(
            'INSERT INTO product_variants (id, product_id, name, additional_price, status) VALUES (?, ?, ?, ?, ?)',
            [variantId, productId, v.name, Number(v.additionalPrice || 0), 'ACTIVE']
          );
        }
      }

      // Insert BOM
      for (const b of bom) {
        if (b.materialId) {
          const bomId = `BOM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          db.run(
            `INSERT INTO product_materials (id, product_id, variant_id, material_id, calculation_type, quantity_required)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [bomId, productId, b.variantId || null, b.materialId, b.calculationType || 'PER_PCS', Number(b.quantityRequired || 1)]
          );
        }
      }

      AuditService.log({
        userId: req.user!.id,
        role: req.user!.role,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCTS',
        entityId: productId,
        afterValue: { sku, name, basePrice, pricingType }
      });
    });

    return res.json({ success: true, message: 'Produk berhasil dibuat', productId });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal membuat produk: ${err.message}` });
  }
});

/**
 * PUT /:id: Update product (Price changes do not alter past transactions!)
 */
router.put('/:id', (req, res) => {
  const {
    sku,
    name,
    categoryId,
    pricingType,
    basePrice,
    unit,
    m2RoundingRule,
    variants,
    bom
  } = req.body;

  const current = db.queryOne<any>('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }

  const now = new Date().toISOString();

  try {
    db.transaction(() => {
      db.run(
        `UPDATE products
         SET sku = ?, name = ?, category_id = ?, pricing_type = ?, base_price = ?,
             unit = ?, m2_rounding_rule = ?, updated_at = ?
         WHERE id = ?`,
        [
          sku || current.sku,
          name || current.name,
          categoryId !== undefined ? categoryId : current.category_id,
          pricingType || current.pricing_type,
          basePrice !== undefined ? Number(basePrice) : current.base_price,
          unit || current.unit,
          m2RoundingRule || current.m2_rounding_rule,
          now,
          req.params.id
        ]
      );

      // Refresh variants if provided
      if (Array.isArray(variants)) {
        db.run("DELETE FROM product_variants WHERE product_id = ?", [req.params.id]);
        for (const v of variants) {
          if (v.name && v.name.trim() !== '') {
            const variantId = v.id || `VAR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            db.run(
              'INSERT INTO product_variants (id, product_id, name, additional_price, status) VALUES (?, ?, ?, ?, ?)',
              [variantId, req.params.id, v.name, Number(v.additionalPrice || 0), 'ACTIVE']
            );
          }
        }
      }

      // Refresh BOM if provided
      if (Array.isArray(bom)) {
        db.run('DELETE FROM product_materials WHERE product_id = ?', [req.params.id]);
        for (const b of bom) {
          if (b.materialId) {
            const bomId = b.id || `BOM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            db.run(
              `INSERT INTO product_materials (id, product_id, variant_id, material_id, calculation_type, quantity_required)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [bomId, req.params.id, b.variantId || null, b.materialId, b.calculationType || 'PER_PCS', Number(b.quantityRequired || 1)]
            );
          }
        }
      }

      AuditService.log({
        userId: req.user!.id,
        role: req.user!.role,
        action: 'EDIT_PRODUCT',
        entity: 'PRODUCTS',
        entityId: req.params.id,
        beforeValue: { sku: current.sku, name: current.name, basePrice: current.base_price },
        afterValue: { sku, name, basePrice }
      });
    });

    return res.json({ success: true, message: 'Produk berhasil diperbarui' });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal memperbarui produk: ${err.message}` });
  }
});

/**
 * DELETE /:id: Soft delete / archive product
 */
router.delete('/:id', (req, res) => {
  const current = db.queryOne<any>('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }

  // Check if used in transactions
  const usage = db.queryOne<any>(
    'SELECT COUNT(id) AS usage_count FROM transaction_items WHERE product_id = ?',
    [req.params.id]
  );

  const now = new Date().toISOString();

  if (usage && usage.usage_count > 0) {
    // Soft delete / archive
    db.run(
      "UPDATE products SET status = 'ARCHIVED', archived_at = ?, updated_at = ? WHERE id = ?",
      [now, now, req.params.id]
    );

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'ARCHIVE_PRODUCT',
      entity: 'PRODUCTS',
      entityId: req.params.id,
      beforeValue: { status: current.status },
      afterValue: { status: 'ARCHIVED' }
    });

    return res.json({
      success: true,
      message: 'Produk diarsipkan karena telah digunakan dalam transaksi sebelumnya.'
    });
  } else {
    // Hard delete allowed if never used
    db.run('DELETE FROM products WHERE id = ?', [req.params.id]);

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'DELETE_PRODUCT',
      entity: 'PRODUCTS',
      entityId: req.params.id,
      beforeValue: { name: current.name }
    });

    return res.json({ success: true, message: 'Produk berhasil dihapus permanen' });
  }
});

export default router;
