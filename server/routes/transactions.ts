import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { PrinterService } from '../services/PrinterService.js';
import { StockEngine } from '../engines/StockEngine.js';
import { AuditService } from '../services/AuditService.js';

const router = Router();

/**
 * GET /: Transaction listing with filters
 */
router.get('/', authMiddleware, (req, res) => {
  const { search, date, status, paymentMethod, page = 1, limit = 20 } = req.query;

  // Check cashier report scope
  const scopeSetting = db.queryOne<any>("SELECT value FROM settings WHERE key = 'cashier_report_scope'");
  const cashierScope = scopeSetting?.value || 'OWN_TRANSACTIONS';

  let sql = `
    SELECT t.*, u.name AS cashier_name, c.name AS customer_name, c.phone AS customer_phone,
           pj.job_number, pj.status AS job_status
    FROM transactions t
    JOIN users u ON t.cashier_id = u.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN production_jobs pj ON t.id = pj.transaction_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Restrict if Kasir and scope is OWN_TRANSACTIONS
  if (req.user!.role === 'KASIR' && cashierScope === 'OWN_TRANSACTIONS') {
    sql += ' AND t.cashier_id = ?';
    params.push(req.user!.id);
  }

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    sql += ' AND (t.transaction_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
    params.push(term, term, term);
  }

  if (date) {
    sql += ' AND t.created_at LIKE ?';
    params.push(`${date}%`);
  }

  if (status) {
    sql += ' AND t.payment_status = ?';
    params.push(status);
  }

  if (paymentMethod) {
    sql += ' AND t.payment_method = ?';
    params.push(paymentMethod);
  }

  sql += ' ORDER BY t.created_at DESC';

  const offset = (Number(page) - 1) * Number(limit);
  sql += ` LIMIT ${Number(limit)} OFFSET ${offset}`;

  const transactions = db.query<any>(sql, params);

  // Attach item count to each transaction
  for (const trx of transactions) {
    const countRow = db.queryOne<any>(
      'SELECT COUNT(id) as item_count FROM transaction_items WHERE transaction_id = ?',
      [trx.id]
    );
    trx.itemCount = countRow?.item_count || 0;
  }

  return res.json({ transactions });
});

/**
 * GET /:id: Transaction detail with items
 */
router.get('/:id', authMiddleware, (req, res) => {
  const trx = db.queryOne<any>(
    `SELECT t.*, u.name AS cashier_name, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
            pj.id AS job_id, pj.job_number, pj.status AS job_status, pj.notes AS job_notes
     FROM transactions t
     JOIN users u ON t.cashier_id = u.id
     LEFT JOIN customers c ON t.customer_id = c.id
     LEFT JOIN production_jobs pj ON t.id = pj.transaction_id
     WHERE t.id = ?`,
    [req.params.id]
  );

  if (!trx) {
    return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  }

  trx.items = db.query<any>(
    'SELECT * FROM transaction_items WHERE transaction_id = ?',
    [trx.id]
  );

  trx.printLogs = db.query<any>(
    `SELECT pl.*, u.name AS printed_by_name
     FROM print_logs pl
     JOIN users u ON pl.printed_by = u.id
     WHERE pl.transaction_id = ?
     ORDER BY pl.printed_at DESC`,
    [trx.id]
  );

  return res.json(trx);
});

/**
 * POST /:id/void: Cancel / Void Transaction (Admin Only)
 */
router.post('/:id/void', authMiddleware, requireAdmin, (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim() === '') {
    return res.status(400).json({ error: 'Alasan pembatalan (void) wajib diisi' });
  }

  const trx = db.queryOne<any>('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
  if (!trx) {
    return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  }

  if (trx.payment_status === 'CANCELLED') {
    return res.status(400).json({ error: 'Transaksi sudah berstatus batal (CANCELLED)' });
  }

  const now = new Date().toISOString();

  try {
    db.transaction(() => {
      // 1. Mark transaction cancelled
      db.run(
        `UPDATE transactions
         SET payment_status = 'CANCELLED',
             production_status = 'DIBATALKAN',
             cancelled_at = ?,
             cancelled_by = ?,
             cancellation_reason = ?
         WHERE id = ?`,
        [now, req.user!.id, reason, req.params.id]
      );

      // 2. Mark production job cancelled
      db.run(
        "UPDATE production_jobs SET status = 'DIBATALKAN' WHERE transaction_id = ?",
        [req.params.id]
      );

      // 3. Reverse stock movements
      StockEngine.reverseStockForTransaction(req.params.id, req.user!.id, reason);

      // 4. Record audit log
      AuditService.log({
        userId: req.user!.id,
        role: req.user!.role,
        action: 'VOID_TRANSACTION',
        entity: 'TRANSACTIONS',
        entityId: req.params.id,
        beforeValue: { status: trx.payment_status, total: trx.total },
        afterValue: { status: 'CANCELLED', reason }
      });
    });

    return res.json({ message: 'Transaksi berhasil dibatalkan dan stock telah dikembalikan' });
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal membatalkan transaksi: ${err.message}` });
  }
});

/**
 * POST /:id/reprint-payment: Reprint Payment Receipt
 */
router.post('/:id/reprint-payment', authMiddleware, (req, res) => {
  try {
    const receipt = PrinterService.generatePaymentReceipt(req.params.id);
    PrinterService.logPrint({
      transactionId: req.params.id,
      printType: 'PAYMENT_RECEIPT',
      printedBy: req.user!.id
    });

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'REPRINT_PAYMENT_RECEIPT',
      entity: 'TRANSACTIONS',
      entityId: req.params.id
    });

    return res.json({ success: true, receipt });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /:id/reprint-production: Reprint Production Receipt
 */
router.post('/:id/reprint-production', authMiddleware, (req, res) => {
  try {
    const receipt = PrinterService.generateProductionReceipt(req.params.id);
    PrinterService.logPrint({
      transactionId: req.params.id,
      printType: 'PRODUCTION_RECEIPT',
      printedBy: req.user!.id
    });

    AuditService.log({
      userId: req.user!.id,
      role: req.user!.role,
      action: 'REPRINT_PRODUCTION_RECEIPT',
      entity: 'TRANSACTIONS',
      entityId: req.params.id
    });

    return res.json({ success: true, receipt });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
