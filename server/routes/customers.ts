import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

router.use(authMiddleware);

/**
 * GET /: List customers
 */
router.get('/', (req, res) => {
  const { search } = req.query;
  let sql = "SELECT * FROM customers WHERE status = 'ACTIVE'";
  const params: any[] = [];

  if (search && String(search).trim() !== '') {
    sql += ' AND (name LIKE ? OR phone LIKE ?)';
    const term = `%${String(search).trim()}%`;
    params.push(term, term);
  }

  sql += ' ORDER BY name ASC';
  const customers = db.query<any>(sql, params);

  for (const c of customers) {
    const usageRow = db.queryOne<any>(
      'SELECT COUNT(id) AS usage_count FROM transactions WHERE customer_id = ?',
      [c.id]
    );
    c.usageCount = usageRow?.usage_count || 0;
  }

  return res.json({ customers });
});

/**
 * POST /: Add Customer
 */
router.post('/', (req, res) => {
  const { name, phone, address, notes } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nama customer wajib diisi' });
  }

  const customerId = `CUS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO customers (id, name, phone, address, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [customerId, name.trim(), phone || '-', address || '-', notes || '-', now, now]
  );

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'CREATE_CUSTOMER',
    entity: 'CUSTOMERS',
    entityId: customerId,
    afterValue: { name, phone }
  });

  return res.json({
    success: true,
    message: 'Customer berhasil ditambahkan',
    customer: { id: customerId, name, phone, address, notes }
  });
});

/**
 * PUT /:id: Edit Customer (Admin Only)
 */
router.put('/:id', requireAdmin, (req, res) => {
  const { name, phone, address, notes } = req.body;
  const current = db.queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Customer tidak ditemukan' });
  }

  const now = new Date().toISOString();
  db.run(
    `UPDATE customers
     SET name = ?, phone = ?, address = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [name || current.name, phone || current.phone, address || current.address, notes || current.notes, now, req.params.id]
  );

  AuditService.log({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'EDIT_CUSTOMER',
    entity: 'CUSTOMERS',
    entityId: req.params.id,
    beforeValue: { name: current.name, phone: current.phone },
    afterValue: { name, phone }
  });

  return res.json({ success: true, message: 'Customer berhasil diperbarui' });
});

/**
 * DELETE /:id: Archive Customer (Admin Only)
 */
router.delete('/:id', requireAdmin, (req, res) => {
  const current = db.queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Customer tidak ditemukan' });
  }

  const usage = db.queryOne<any>('SELECT COUNT(id) AS usage_count FROM transactions WHERE customer_id = ?', [req.params.id]);
  const now = new Date().toISOString();

  if (usage && usage.usage_count > 0) {
    db.run(
      "UPDATE customers SET status = 'ARCHIVED', archived_at = ?, updated_at = ? WHERE id = ?",
      [now, now, req.params.id]
    );

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'ARCHIVE_CUSTOMER',
      entity: 'CUSTOMERS',
      entityId: req.params.id,
      beforeValue: { status: current.status },
      afterValue: { status: 'ARCHIVED' }
    });

    return res.json({ success: true, message: 'Customer diarsipkan karena memiliki riwayat transaksi.' });
  } else {
    db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Customer berhasil dihapus permanen' });
  }
});

export default router;
