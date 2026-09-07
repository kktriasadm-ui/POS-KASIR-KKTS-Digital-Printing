import { db } from '../db/database.js';

export interface DailyReportSummary {
  date: string;
  totalTransactions: number;
  grossSales: number;
  totalDiscount: number;
  netSales: number;
  cashTotal: number;
  transferTotal: number;
  totalPcs: number;
  totalMeter: number;
  totalM2: number;
  transactions: any[];
}

export interface MonthlyReportSummary {
  year: number;
  month: number;
  periodLabel: string;
  totalTransactions: number;
  grossSales: number;
  totalDiscount: number;
  netSales: number;
  cashTotal: number;
  transferTotal: number;
  totalPcs: number;
  totalMeter: number;
  totalM2: number;
  dailyRecap: Array<{
    date: string;
    formattedDate: string;
    transactionCount: number;
    cashTotal: number;
    transferTotal: number;
    totalAmount: number;
  }>;
  transactions: any[];
}

export class ReportEngine {
  /**
   * Helper: format date to DD/MM/YYYY
   */
  public static formatDateID(isoDateStr: string): string {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return isoDateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Daily Transaction Report
   */
  public static getDailyReport(dateStr: string, cashierId?: string): DailyReportSummary {
    // dateStr format: YYYY-MM-DD
    const startIso = `${dateStr}T00:00:00.000Z`;
    const endIso = `${dateStr}T23:59:59.999Z`;

    let queryBase = `
      FROM transactions t
      JOIN users u ON t.cashier_id = u.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
    `;
    const params: any[] = [startIso, endIso];

    if (cashierId) {
      queryBase += ' AND t.cashier_id = ?';
      params.push(cashierId);
    }

    const summaryRow = db.queryOne<any>(
      `SELECT
        COUNT(t.id) AS total_count,
        COALESCE(SUM(t.subtotal), 0) AS gross_sales,
        COALESCE(SUM(t.discount), 0) AS total_discount,
        COALESCE(SUM(t.total), 0) AS net_sales,
        COALESCE(SUM(CASE WHEN t.payment_method = 'CASH' THEN t.total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN t.payment_method = 'TRANSFER' THEN t.total ELSE 0 END), 0) AS transfer_total
       ${queryBase}`,
      params
    ) || {};

    // Unit totals (PCS, METER, M2) from transaction_items
    let itemsQuery = `
      SELECT
        ti.unit,
        COALESCE(ti.calculated_area, 0) as calculated_area,
        ti.quantity
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
    `;
    const itemParams: any[] = [startIso, endIso];
    if (cashierId) {
      itemsQuery += ' AND t.cashier_id = ?';
      itemParams.push(cashierId);
    }

    const items = db.query<any>(itemsQuery, itemParams);

    let totalPcs = 0;
    let totalMeter = 0;
    let totalM2 = 0;

    for (const it of items) {
      const u = (it.unit || '').toUpperCase();
      if (u === 'M2') {
        totalM2 += (it.calculated_area || 0) * (it.quantity || 1);
      } else if (u === 'METER' || u === 'M') {
        totalMeter += it.quantity || 0;
      } else {
        totalPcs += it.quantity || 0;
      }
    }

    // Transactions list
    const transactions = db.query<any>(
      `SELECT t.*, u.name AS cashier_name, c.name AS customer_name, c.phone AS customer_phone
       ${queryBase}
       ORDER BY t.created_at DESC`,
      params
    );

    for (const trx of transactions) {
      trx.items = db.query<any>('SELECT * FROM transaction_items WHERE transaction_id = ?', [trx.id]);
    }

    return {
      date: dateStr,
      totalTransactions: summaryRow.total_count || 0,
      grossSales: summaryRow.gross_sales || 0,
      totalDiscount: summaryRow.total_discount || 0,
      netSales: summaryRow.net_sales || 0,
      cashTotal: summaryRow.cash_total || 0,
      transferTotal: summaryRow.transfer_total || 0,
      totalPcs: Math.round(totalPcs),
      totalMeter: Number(totalMeter.toFixed(2)),
      totalM2: Number(totalM2.toFixed(2)),
      transactions
    };
  }

  /**
   * Monthly Transaction Report
   */
  public static getMonthlyReport(year: number, month: number, cashierId?: string): MonthlyReportSummary {
    const padMonth = String(month).padStart(2, '0');
    const startIso = `${year}-${padMonth}-01T00:00:00.000Z`;
    const lastDay = new Date(year, month, 0).getDate();
    const endIso = `${year}-${padMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    let queryBase = `
      FROM transactions t
      JOIN users u ON t.cashier_id = u.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
    `;
    const params: any[] = [startIso, endIso];

    if (cashierId) {
      queryBase += ' AND t.cashier_id = ?';
      params.push(cashierId);
    }

    const summaryRow = db.queryOne<any>(
      `SELECT
        COUNT(t.id) AS total_count,
        COALESCE(SUM(t.subtotal), 0) AS gross_sales,
        COALESCE(SUM(t.discount), 0) AS total_discount,
        COALESCE(SUM(t.total), 0) AS net_sales,
        COALESCE(SUM(CASE WHEN t.payment_method = 'CASH' THEN t.total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN t.payment_method = 'TRANSFER' THEN t.total ELSE 0 END), 0) AS transfer_total
       ${queryBase}`,
      params
    ) || {};

    // Unit totals
    let itemsQuery = `
      SELECT
        ti.unit,
        COALESCE(ti.calculated_area, 0) as calculated_area,
        ti.quantity
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
    `;
    const itemParams: any[] = [startIso, endIso];
    if (cashierId) {
      itemsQuery += ' AND t.cashier_id = ?';
      itemParams.push(cashierId);
    }

    const items = db.query<any>(itemsQuery, itemParams);
    let totalPcs = 0;
    let totalMeter = 0;
    let totalM2 = 0;

    for (const it of items) {
      const u = (it.unit || '').toUpperCase();
      if (u === 'M2') {
        totalM2 += (it.calculated_area || 0) * (it.quantity || 1);
      } else if (u === 'METER' || u === 'M') {
        totalMeter += it.quantity || 0;
      } else {
        totalPcs += it.quantity || 0;
      }
    }

    // Daily breakdown table
    const dailyRows = db.query<any>(
      `SELECT
        SUBSTR(t.created_at, 1, 10) AS date_str,
        COUNT(t.id) AS count,
        COALESCE(SUM(CASE WHEN t.payment_method = 'CASH' THEN t.total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN t.payment_method = 'TRANSFER' THEN t.total ELSE 0 END), 0) AS transfer,
        COALESCE(SUM(t.total), 0) AS total
       ${queryBase}
       GROUP BY SUBSTR(t.created_at, 1, 10)
       ORDER BY date_str ASC`,
      params
    );

    const dailyRecap = dailyRows.map(r => ({
      date: r.date_str,
      formattedDate: this.formatDateID(r.date_str),
      transactionCount: r.count,
      cashTotal: r.cash,
      transferTotal: r.transfer,
      totalAmount: r.total
    }));

    // Transactions list
    const transactions = db.query<any>(
      `SELECT t.*, u.name AS cashier_name, c.name AS customer_name
       ${queryBase}
       ORDER BY t.created_at DESC`,
      params
    );

    const monthsID = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    return {
      year,
      month,
      periodLabel: `${monthsID[month - 1]} ${year}`,
      totalTransactions: summaryRow.total_count || 0,
      grossSales: summaryRow.gross_sales || 0,
      totalDiscount: summaryRow.total_discount || 0,
      netSales: summaryRow.net_sales || 0,
      cashTotal: summaryRow.cash_total || 0,
      transferTotal: summaryRow.transfer_total || 0,
      totalPcs: Math.round(totalPcs),
      totalMeter: Number(totalMeter.toFixed(2)),
      totalM2: Number(totalM2.toFixed(2)),
      dailyRecap,
      transactions
    };
  }

  /**
   * Custom Range Report (Admin)
   */
  public static getCustomReport(startDateStr: string, endDateStr: string) {
    const startIso = `${startDateStr}T00:00:00.000Z`;
    const endIso = `${endDateStr}T23:59:59.999Z`;

    const summaryRow = db.queryOne<any>(
      `SELECT
        COUNT(t.id) AS total_count,
        COALESCE(SUM(t.subtotal), 0) AS gross_sales,
        COALESCE(SUM(t.discount), 0) AS total_discount,
        COALESCE(SUM(t.total), 0) AS net_sales,
        COALESCE(SUM(CASE WHEN t.payment_method = 'CASH' THEN t.total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN t.payment_method = 'TRANSFER' THEN t.total ELSE 0 END), 0) AS transfer_total
       FROM transactions t
       WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'`,
      [startIso, endIso]
    ) || {};

    // Top selling products
    const topProducts = db.query<any>(
      `SELECT
        ti.product_name_snapshot AS product_name,
        ti.variant_name_snapshot AS variant_name,
        ti.unit,
        SUM(ti.quantity) AS total_qty,
        SUM(ti.subtotal) AS total_revenue
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
       GROUP BY ti.product_name_snapshot, ti.variant_name_snapshot, ti.unit
       ORDER BY total_revenue DESC
       LIMIT 10`,
      [startIso, endIso]
    );

    // Sales by cashier
    const cashierStats = db.query<any>(
      `SELECT
        u.name AS cashier_name,
        COUNT(t.id) AS transaction_count,
        SUM(t.total) AS total_sales
       FROM transactions t
       JOIN users u ON t.cashier_id = u.id
       WHERE t.created_at >= ? AND t.created_at <= ? AND t.payment_status != 'CANCELLED'
       GROUP BY u.name
       ORDER BY total_sales DESC`,
      [startIso, endIso]
    );

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      summary: summaryRow,
      topProducts,
      cashierStats
    };
  }

  /**
   * HPP and Profit Report (Admin Only)
   */
  public static getHPPAndProfitReport(startDateStr: string, endDateStr: string) {
    const startIso = `${startDateStr}T00:00:00.000Z`;
    const endIso = `${endDateStr}T23:59:59.999Z`;

    // 1. Revenue
    const revRow = db.queryOne<any>(
      `SELECT COALESCE(SUM(total), 0) AS net_revenue
       FROM transactions
       WHERE created_at >= ? AND created_at <= ? AND payment_status != 'CANCELLED'`,
      [startIso, endIso]
    );
    const netRevenue = revRow ? revRow.net_revenue : 0;

    // 2. Material Cost from stock movements belonging to active transactions
    const costRows = db.query<any>(
      `SELECT
        sm.material_id,
        m.name AS material_name,
        m.unit,
        m.cost_price,
        ABS(SUM(sm.quantity)) AS total_used,
        ABS(SUM(sm.quantity)) * m.cost_price AS total_cost
       FROM stock_movements sm
       JOIN materials m ON sm.material_id = m.id
       JOIN transactions t ON sm.reference_id = t.id
       WHERE sm.movement_type = 'SALE' AND t.payment_status != 'CANCELLED'
         AND sm.created_at >= ? AND sm.created_at <= ?
       GROUP BY sm.material_id, m.name, m.unit, m.cost_price
       ORDER BY total_cost DESC`,
      [startIso, endIso]
    );

    let totalMaterialCost = 0;
    for (const r of costRows) {
      totalMaterialCost += r.total_cost || 0;
    }

    const grossProfit = netRevenue - totalMaterialCost;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return {
      period: `${this.formatDateID(startDateStr)} - ${this.formatDateID(endDateStr)}`,
      netRevenue,
      totalMaterialCost: Math.round(totalMaterialCost),
      grossProfit: Math.round(grossProfit),
      grossMargin: Number(grossMargin.toFixed(2)),
      materialDetails: costRows
    };
  }

  /**
   * Stock & Material Usage Report (Admin Only)
   */
  public static getStockReport() {
    const materials = db.query<any>(
      `SELECT m.*, c.name AS category_name, s.name AS supplier_name
       FROM materials m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.status != 'ARCHIVED'
       ORDER BY m.name ASC`
    );

    return materials.map(m => {
      let status = 'AMAN';
      if (m.stock <= 0) status = 'HABIS';
      else if (m.stock <= m.minimum_stock) status = 'LOW_STOCK';

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category_name || '-',
        unit: m.unit,
        stock: m.stock,
        minimumStock: m.minimum_stock,
        costPrice: m.cost_price,
        supplier: m.supplier_name || '-',
        status,
        valuation: Math.round(m.stock * m.cost_price)
      };
    });
  }
}
