import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { PrinterService } from '../services/PrinterService.js';

const router = Router();
router.use(authMiddleware);

/**
 * POST /test: Generate test print receipt for 58mm ESC/POS
 */
router.post('/test', (req, res) => {
  const receipt = PrinterService.generateTestReceipt();
  return res.json({ success: true, receipt });
});

/**
 * GET /settings: Get current printer configuration
 */
router.get('/settings', (req, res) => {
  const printerName = db.queryOne<any>("SELECT value FROM settings WHERE key = 'printer_name'")?.value || 'IWARE C58AC';
  const paperWidth = db.queryOne<any>("SELECT value FROM settings WHERE key = 'printer_paper_width'")?.value || '58mm';
  const receiptFooter = db.queryOne<any>("SELECT value FROM settings WHERE key = 'receipt_footer_note'")?.value || 'TERIMA KASIH';

  return res.json({
    printerName,
    paperWidth,
    receiptFooter
  });
});

/**
 * PUT /settings: Update printer configuration (Admin Only)
 */
router.put('/settings', requireAdmin, (req, res) => {
  const { printerName, paperWidth, receiptFooter } = req.body;

  if (printerName) {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('printer_name', ?)", [printerName]);
  }
  if (paperWidth) {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('printer_paper_width', ?)", [paperWidth]);
  }
  if (receiptFooter) {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('receipt_footer_note', ?)", [receiptFooter]);
  }

  return res.json({ success: true, message: 'Pengaturan printer berhasil disimpan' });
});

export default router;
