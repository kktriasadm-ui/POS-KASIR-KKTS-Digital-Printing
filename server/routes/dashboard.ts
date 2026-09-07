import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const isKasir = req.user!.role === 'KASIR';
  const today = new Date().toISOString().substring(0, 10);
  const startIso = `${today}T00:00:00.000Z`;
  const endIso = `${today}T23:59:59.999Z`;

  // Check cashier report scope
  const scopeSetting = db.queryOne<any>("SELECT value FROM settings WHERE key = 'cashier_report_scope'");
  const cashierScope = scopeSetting?.value || 'OWN_TRANSACTIONS';

  let todayTrxSql = `
    SELECT
      COUNT(id) AS trx_count,
      COALESCE(SUM(total), 0) AS total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total ELSE 0 END), 0) AS cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'TRANSFER' THEN total ELSE 0 END), 0) AS transfer_sales
    FROM transactions
    WHERE created_at >= ? AND created_at <= ? AND payment_status != 'CANCELLED'
  `;
  const todayParams: any[] = [startIso, endIso];

  if (isKasir && cashierScope === 'OWN_TRANSACTIONS') {
    todayTrxSql += ' AND cashier_id = ?';
    todayParams.push(req.user!.id);
  }

  const todaySummary = db.queryOne<any>(todayTrxSql, todayParams) || {};

  // Total products sold today
  let prodSoldSql = `
    SELECT COALESCE(SUM(ti.quantity), 0) AS products_sold
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
  `;
  const prodSoldParams: any[] = [startIso, endIso];
  if (isKasir && cashierScope === 'OWN_TRANSACTIONS') {
    prodSoldSql += ' AND t.cashier_id = ?';
    prodSoldParams.push(req.user!.id);
  }
  const prodSoldRow = db.queryOne<any>(prodSoldSql, prodSoldParams);

  // Production counts
  const prodCounts = db.queryOne<any>(
    `SELECT
      COUNT(CASE WHEN status = 'MENUNGGU' THEN 1 END) AS menunggu,
      COUNT(CASE WHEN status = 'DIPROSES' THEN 1 END) AS diproses,
      COUNT(CASE WHEN status = 'SELESAI' THEN 1 END) AS selesai,
      COUNT(CASE WHEN status = 'DIAMBIL' THEN 1 END) AS diambil
     FROM production_jobs`
  ) || {};

  // Recent transactions
  let recentTrxSql = `
    SELECT t.id, t.transaction_number, t.total, t.payment_method, t.created_at,
           u.name AS cashier_name, c.name AS customer_name, t.payment_status
    FROM transactions t
    JOIN users u ON t.cashier_id = u.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE 1=1
  `;
  const recentParams: any[] = [];
  if (isKasir && cashierScope === 'OWN_TRANSACTIONS') {
    recentTrxSql += ' AND t.cashier_id = ?';
    recentParams.push(req.user!.id);
  }
  recentTrxSql += ' ORDER BY t.created_at DESC LIMIT 6';
  const recentTransactions = db.query<any>(recentTrxSql, recentParams);

  // Low stock counts
  const stockAlerts = db.queryOne<any>(
    `SELECT
      COUNT(CASE WHEN stock <= minimum_stock AND stock > 0 THEN 1 END) AS low_stock,
      COUNT(CASE WHEN stock <= 0 THEN 1 END) AS out_of_stock
     FROM materials
     WHERE status = 'ACTIVE'`
  ) || {};

  // Response for Kasir (Operational only, zero profit/HPP info)
  if (isKasir) {
    return res.json({
      role: 'KASIR',
      todaySales: todaySummary.total_sales || 0,
      todayTrxCount: todaySummary.trx_count || 0,
      cashSales: todaySummary.cash_sales || 0,
      transferSales: todaySummary.transfer_sales || 0,
      productsSold: Math.round(prodSoldRow?.products_sold || 0),
      production: {
        menunggu: prodCounts.menunggu || 0,
        diproses: prodCounts.diproses || 0,
        selesai: prodCounts.selesai || 0,
        diambil: prodCounts.diambil || 0
      },
      recentTransactions,
      stockInfo: {
        lowStock: stockAlerts.low_stock || 0,
        outOfStock: stockAlerts.out_of_stock || 0
      }
    });
  }

  // Response for Admin (Full business overview)
  // Last 7 days revenue for chart
  const last7Days = db.query<any>(
    `SELECT
      SUBSTR(created_at, 1, 10) AS date_str,
      COALESCE(SUM(total), 0) AS daily_revenue,
      COUNT(id) AS daily_count
     FROM transactions
     WHERE created_at >= date('now', '-7 days') AND payment_status != 'CANCELLED'
     GROUP BY SUBSTR(created_at, 1, 10)
     ORDER BY date_str ASC`
  );

  // Top products
  const topProducts = db.query<any>(
    `SELECT
      product_name_snapshot AS name,
      SUM(quantity) AS total_qty,
      SUM(subtotal) AS total_sales
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE t.payment_status != 'CANCELLED'
     GROUP BY product_name_snapshot
     ORDER BY total_sales DESC
     LIMIT 5`
  );

  return res.json({
    role: 'ADMIN',
    todaySales: todaySummary.total_sales || 0,
    todayTrxCount: todaySummary.trx_count || 0,
    cashSales: todaySummary.cash_sales || 0,
    transferSales: todaySummary.transfer_sales || 0,
    productsSold: Math.round(prodSoldRow?.products_sold || 0),
    lowStockCount: stockAlerts.low_stock || 0,
    outOfStockCount: stockAlerts.out_of_stock || 0,
    production: {
      menunggu: prodCounts.menunggu || 0,
      diproses: prodCounts.diproses || 0,
      selesai: prodCounts.selesai || 0,
      diambil: prodCounts.diambil || 0
    },
    recentTransactions,
    topProducts,
    last7Days
  });
});

export default router;
