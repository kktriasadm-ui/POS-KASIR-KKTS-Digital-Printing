import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { ReportEngine } from '../engines/ReportEngine.js';

const router = Router();

router.use(authMiddleware);

/**
 * GET /daily: Daily Transaction Report (Admin & Kasir)
 */
router.get('/daily', (req, res) => {
  const { date } = req.query;
  const targetDate = date ? String(date) : new Date().toISOString().substring(0, 10);

  // Check cashier report scope
  const scopeSetting = db.queryOne<any>("SELECT value FROM settings WHERE key = 'cashier_report_scope'");
  const cashierScope = scopeSetting?.value || 'OWN_TRANSACTIONS';

  let cashierIdToFilter: string | undefined = undefined;
  if (req.user!.role === 'KASIR' && cashierScope === 'OWN_TRANSACTIONS') {
    cashierIdToFilter = req.user!.id;
  }

  const report = ReportEngine.getDailyReport(targetDate, cashierIdToFilter);
  return res.json({ report, cashierScope, requestingUser: req.user });
});

/**
 * GET /monthly: Monthly Transaction Report (Admin & Kasir)
 */
router.get('/monthly', (req, res) => {
  const now = new Date();
  const year = req.query.year ? parseInt(String(req.query.year), 10) : now.getFullYear();
  const month = req.query.month ? parseInt(String(req.query.month), 10) : now.getMonth() + 1;

  const scopeSetting = db.queryOne<any>("SELECT value FROM settings WHERE key = 'cashier_report_scope'");
  const cashierScope = scopeSetting?.value || 'OWN_TRANSACTIONS';

  let cashierIdToFilter: string | undefined = undefined;
  if (req.user!.role === 'KASIR' && cashierScope === 'OWN_TRANSACTIONS') {
    cashierIdToFilter = req.user!.id;
  }

  const report = ReportEngine.getMonthlyReport(year, month, cashierIdToFilter);
  return res.json({ report, cashierScope, requestingUser: req.user });
});

/**
 * GET /custom: Custom date range report (Admin Only)
 */
router.get('/custom', requireAdmin, (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Tanggal mulai (startDate) dan tanggal selesai (endDate) wajib diisi' });
  }

  const report = ReportEngine.getCustomReport(String(startDate), String(endDate));
  return res.json({ report });
});

/**
 * GET /profit: HPP and Profit Report (Admin Only)
 */
router.get('/profit', requireAdmin, (req, res) => {
  const now = new Date();
  const startDate = req.query.startDate ? String(req.query.startDate) : `${now.getFullYear()}-01-01`;
  const endDate = req.query.endDate ? String(req.query.endDate) : now.toISOString().substring(0, 10);

  const report = ReportEngine.getHPPAndProfitReport(startDate, endDate);
  return res.json({ report });
});

/**
 * GET /stock: Material & Inventory Report (Admin Only)
 */
router.get('/stock', requireAdmin, (req, res) => {
  const report = ReportEngine.getStockReport();
  return res.json({ report });
});

export default router;
