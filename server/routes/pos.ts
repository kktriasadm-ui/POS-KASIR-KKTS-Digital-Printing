import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { PricingEngine } from '../engines/PricingEngine.js';
import { StockEngine, CartItemForStockCheck } from '../engines/StockEngine.js';
import { ProductionEngine } from '../engines/ProductionEngine.js';
import { PrinterService } from '../services/PrinterService.js';

const router = Router();

/**
 * Helper to generate TRX-YYYYMMDD-XXXX
 */
function generateTransactionNumber(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const prefix = `TRX-${yyyy}${mm}${dd}-`;

  const row = db.queryOne<{ max_num: string }>(
    'SELECT transaction_number AS max_num FROM transactions WHERE transaction_number LIKE ? ORDER BY transaction_number DESC LIMIT 1',
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (row && row.max_num) {
    const parts = row.max_num.split('-');
    if (parts.length === 3) {
      const currentSeq = parseInt(parts[2], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * GET /catalog: Products, categories, variants, and live material stock indicators
 */
router.get('/catalog', authMiddleware, (req, res) => {
  const categories = db.query<any>("SELECT * FROM categories WHERE type = 'PRODUCT' AND status = 'ACTIVE' ORDER BY name ASC");

  const products = db.query<any>(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.status = 'ACTIVE'
     ORDER BY p.name ASC`
  );

  for (const prod of products) {
    prod.variants = db.query<any>(
      "SELECT * FROM product_variants WHERE product_id = ? AND status = 'ACTIVE'",
      [prod.id]
    );

    prod.bom = db.query<any>(
      `SELECT pm.*, m.name AS material_name, m.code AS material_code, m.unit AS material_unit, m.stock AS current_stock, m.minimum_stock
       FROM product_materials pm
       JOIN materials m ON pm.material_id = m.id
       WHERE pm.product_id = ?`,
      [prod.id]
    );

    // Check if any material is out of stock
    let minMaterialStock = 999999;
    let anyOutOfStock = false;
    for (const b of prod.bom) {
      if (b.current_stock <= 0) {
        anyOutOfStock = true;
      }
      if (b.current_stock < minMaterialStock) {
        minMaterialStock = b.current_stock;
      }
    }
    prod.hasStockIssue = anyOutOfStock;
    prod.minMaterialStock = minMaterialStock === 999999 ? 0 : minMaterialStock;
  }

  const customers = db.query<any>("SELECT id, name, phone FROM customers WHERE status = 'ACTIVE' ORDER BY name ASC");

  return res.json({
    categories,
    products,
    customers
  });
});

/**
 * POST /calculate: Calculate line item
 */
router.post('/calculate', authMiddleware, (req, res) => {
  const { pricingType, unitPrice, quantity, width, height, dimensionUnit, unit, roundingRule } = req.body;

  try {
    const result = PricingEngine.calculate({
      pricingType,
      unitPrice: Number(unitPrice),
      quantity: Number(quantity) || 1,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      dimensionUnit: dimensionUnit || 'm',
      unit: unit || 'PCS',
      roundingRule: roundingRule || 'ACTUAL'
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /check-stock: Validate stock before checkout
 */
router.post('/check-stock', authMiddleware, (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Daftar item tidak boleh kosong' });
  }

  const allowNegativeRow = db.queryOne<any>("SELECT value FROM settings WHERE key = 'allow_negative_stock'");
  const allowNegative = allowNegativeRow?.value === 'true';

  const checkResult = StockEngine.checkStock(items as CartItemForStockCheck[], allowNegative);
  return res.json(checkResult);
});

/**
 * POST /checkout: Atomic Transaction Checkout
 */
router.post('/checkout', authMiddleware, (req, res) => {
  const {
    customerId,
    items,
    discount = 0,
    paymentMethod = 'CASH',
    paymentAmount,
    note,
    transferBank,
    transferRef,
    idempotencyKey
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Keranjang belanja tidak boleh kosong' });
  }

  // Check idempotency
  if (idempotencyKey) {
    const existingTrx = db.queryOne<any>(
      'SELECT id, transaction_number FROM transactions WHERE idempotency_key = ?',
      [idempotencyKey]
    );
    if (existingTrx) {
      const paymentReceipt = PrinterService.generatePaymentReceipt(existingTrx.id);
      const productionReceipt = PrinterService.generateProductionReceipt(existingTrx.id);
      return res.json({
        success: true,
        isDuplicate: true,
        transaction: existingTrx,
        paymentReceipt,
        productionReceipt
      });
    }
  }

  // Calculate items subtotal
  let subtotal = 0;
  for (const it of items) {
    subtotal += Math.round(Number(it.subtotal));
  }

  const numDiscount = Math.max(0, Math.round(Number(discount) || 0));
  const total = Math.max(0, subtotal - numDiscount);
  const numPaymentAmount = Math.round(Number(paymentAmount) || 0);

  if (numPaymentAmount < total) {
    const shortage = total - numPaymentAmount;
    return res.status(400).json({
      error: `Pembayaran kurang Rp ${shortage.toLocaleString('id-ID')}. Total: Rp ${total.toLocaleString('id-ID')}, Dibayar: Rp ${numPaymentAmount.toLocaleString('id-ID')}`
    });
  }

  const changeAmount = numPaymentAmount - total;
  const allowNegativeRow = db.queryOne<any>("SELECT value FROM settings WHERE key = 'allow_negative_stock'");
  const allowNegative = allowNegativeRow?.value === 'true';

  const transactionNumber = generateTransactionNumber();
  const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  try {
    const checkoutResult = db.transaction(() => {
      // 1. Stock deduction (throws error if insufficient)
      StockEngine.deductStock({
        items: items as CartItemForStockCheck[],
        transactionId,
        transactionNumber,
        userId: req.user!.id,
        allowNegative
      });

      // 2. Insert transaction
      db.run(
        `INSERT INTO transactions (
          id, transaction_number, customer_id, cashier_id,
          subtotal, discount, total,
          payment_method, payment_amount, change_amount,
          payment_status, production_status, note,
          transfer_bank, transfer_ref, idempotency_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'MENUNGGU', ?, ?, ?, ?, ?)`,
        [
          transactionId,
          transactionNumber,
          customerId || 'CUS-UMUM',
          req.user!.id,
          subtotal,
          numDiscount,
          total,
          paymentMethod,
          numPaymentAmount,
          changeAmount,
          note || null,
          transferBank || null,
          transferRef || null,
          idempotencyKey || null,
          now
        ]
      );

      // 3. Insert transaction items with full historical snapshots
      for (const it of items) {
        const itemId = `TXI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        db.run(
          `INSERT INTO transaction_items (
            id, transaction_id, product_id, variant_id,
            product_name_snapshot, variant_name_snapshot, finishing_snapshot,
            width, height, calculated_area, unit,
            quantity, unit_price, subtotal,
            material_snapshot, formula_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            transactionId,
            it.productId,
            it.variantId || null,
            it.productName,
            it.variantName || null,
            it.finishing || null,
            it.width || null,
            it.height || null,
            it.calculatedArea || null,
            it.unit || 'PCS',
            it.quantity,
            it.unitPrice,
            it.subtotal,
            it.materialSnapshot || null,
            it.formulaDescription || null
          ]
        );
      }

      // 4. Create production job
      const prodJob = ProductionEngine.createJob({
        transactionId,
        customerId: customerId || 'CUS-UMUM',
        notes: note,
        userId: req.user!.id
      });

      return {
        transactionId,
        transactionNumber,
        jobNumber: prodJob.jobNumber
      };
    });

    // 5. Generate receipts
    const paymentReceipt = PrinterService.generatePaymentReceipt(checkoutResult.transactionId);
    const productionReceipt = PrinterService.generateProductionReceipt(checkoutResult.transactionId);

    // Initial print log
    PrinterService.logPrint({
      transactionId: checkoutResult.transactionId,
      printType: 'PAYMENT_RECEIPT',
      printedBy: req.user!.id
    });
    PrinterService.logPrint({
      transactionId: checkoutResult.transactionId,
      printType: 'PRODUCTION_RECEIPT',
      printedBy: req.user!.id
    });

    return res.json({
      success: true,
      transaction: {
        id: checkoutResult.transactionId,
        transactionNumber: checkoutResult.transactionNumber,
        jobNumber: checkoutResult.jobNumber,
        subtotal,
        discount: numDiscount,
        total,
        paymentAmount: numPaymentAmount,
        changeAmount,
        paymentMethod
      },
      paymentReceipt,
      productionReceipt
    });
  } catch (err: any) {
    if (err.message && err.message.startsWith('STOCK_INSUFFICIENT')) {
      return res.status(400).json({
        error: err.message.replace('STOCK_INSUFFICIENT: ', ''),
        code: 'STOCK_INSUFFICIENT'
      });
    }
    return res.status(500).json({ error: `Gagal memproses transaksi: ${err.message}` });
  }
});

export default router;
