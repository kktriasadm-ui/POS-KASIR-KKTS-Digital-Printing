import { db } from '../db/database.js';

export interface CartItemForStockCheck {
  productId: string;
  variantId?: string | null;
  quantity: number;
  calculatedArea?: number; // in M2 if applicable
  width?: number;
  height?: number;
}

export interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  currentStock: number;
  requiredStock: number;
  remainingStock: number;
  costPrice: number;
}

export interface StockCheckResult {
  ok: boolean;
  insufficientMaterials: Array<{
    materialId: string;
    code: string;
    name: string;
    unit: string;
    currentStock: number;
    requiredStock: number;
    deficit: number;
  }>;
  requirements: MaterialRequirement[];
}

export class StockEngine {
  /**
   * Determine low stock status
   * HABIS: stock <= 0
   * LOW_STOCK: stock <= minStock && stock > 0
   * AMAN: stock > minStock
   */
  public static getStockStatus(stock: number, minimumStock: number): 'AMAN' | 'LOW_STOCK' | 'HABIS' {
    if (stock <= 0) return 'HABIS';
    if (stock <= minimumStock) return 'LOW_STOCK';
    return 'AMAN';
  }

  /**
   * Resolves and calculates all material requirements for a set of cart items
   * properly aggregating shared materials across different products/variants.
   */
  public static calculateRequirements(items: CartItemForStockCheck[]): MaterialRequirement[] {
    const requirementMap = new Map<string, number>();

    for (const item of items) {
      // Find BOM rules for this product and optional variant
      const bomRules = db.query<any>(
        `SELECT pm.*, m.code, m.name, m.unit, m.stock, m.cost_price
         FROM product_materials pm
         JOIN materials m ON pm.material_id = m.id
         WHERE pm.product_id = ? AND (pm.variant_id IS NULL OR pm.variant_id = ?)`,
        [item.productId, item.variantId || null]
      );

      for (const rule of bomRules) {
        let usage = 0;
        const baseQtyReq = rule.quantity_required;

        switch (rule.calculation_type) {
          case 'PER_M2': {
            const area = item.calculatedArea || (item.width && item.height ? item.width * item.height : 1);
            usage = baseQtyReq * area * item.quantity;
            break;
          }
          case 'PER_METER': {
            usage = baseQtyReq * item.quantity;
            break;
          }
          case 'PER_PCS': {
            usage = baseQtyReq * item.quantity;
            break;
          }
          case 'FIXED': {
            usage = baseQtyReq * item.quantity;
            break;
          }
          default:
            usage = baseQtyReq * item.quantity;
        }

        // Aggregate
        const currentTotal = requirementMap.get(rule.material_id) || 0;
        requirementMap.set(rule.material_id, Number((currentTotal + usage).toFixed(4)));
      }
    }

    const results: MaterialRequirement[] = [];
    for (const [materialId, requiredQty] of requirementMap.entries()) {
      const mat = db.queryOne<any>('SELECT * FROM materials WHERE id = ?', [materialId]);
      if (mat) {
        results.push({
          materialId: mat.id,
          materialCode: mat.code,
          materialName: mat.name,
          unit: mat.unit,
          currentStock: mat.stock,
          requiredStock: requiredQty,
          remainingStock: Number((mat.stock - requiredQty).toFixed(4)),
          costPrice: mat.cost_price
        });
      }
    }

    return results;
  }

  /**
   * Check if all required materials have sufficient stock
   */
  public static checkStock(items: CartItemForStockCheck[], allowNegative: boolean = false): StockCheckResult {
    const requirements = this.calculateRequirements(items);
    const insufficient: StockCheckResult['insufficientMaterials'] = [];

    if (!allowNegative) {
      for (const req of requirements) {
        if (req.currentStock < req.requiredStock) {
          insufficient.push({
            materialId: req.materialId,
            code: req.materialCode,
            name: req.materialName,
            unit: req.unit,
            currentStock: req.currentStock,
            requiredStock: req.requiredStock,
            deficit: Number((req.requiredStock - req.currentStock).toFixed(4))
          });
        }
      }
    }

    return {
      ok: insufficient.length === 0,
      insufficientMaterials: insufficient,
      requirements
    };
  }

  /**
   * Deduct material stock atomically during checkout and log stock movements.
   * MUST be executed within an active database transaction.
   */
  public static deductStock(params: {
    items: CartItemForStockCheck[];
    transactionId: string;
    transactionNumber: string;
    userId: string;
    allowNegative?: boolean;
  }): MaterialRequirement[] {
    const stockCheck = this.checkStock(params.items, params.allowNegative);
    if (!stockCheck.ok) {
      const msg = stockCheck.insufficientMaterials
        .map(m => `${m.name} (${m.code}): tersedia ${m.currentStock} ${m.unit}, dibutuhkan ${m.requiredStock} ${m.unit}`)
        .join('; ');
      throw new Error(`STOCK_INSUFFICIENT: ${msg}`);
    }

    const now = new Date().toISOString();

    for (const req of stockCheck.requirements) {
      const current = db.queryOne<any>('SELECT stock FROM materials WHERE id = ?', [req.materialId]);
      const stockBefore = current ? current.stock : 0;
      const stockAfter = Number((stockBefore - req.requiredStock).toFixed(4));

      // Update material stock
      db.run('UPDATE materials SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, now, req.materialId]);

      // Record stock movement
      const movementId = `MOV-SALE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      db.run(
        `INSERT INTO stock_movements (id, material_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, note, created_at)
         VALUES (?, ?, 'SALE', ?, ?, ?, 'TRANSACTION', ?, ?, ?, ?)`,
        [
          movementId,
          req.materialId,
          -req.requiredStock,
          stockBefore,
          stockAfter,
          params.transactionId,
          params.userId,
          `Penjualan ${params.transactionNumber}`,
          now
        ]
      );
    }

    return stockCheck.requirements;
  }

  /**
   * Add stock (Stock In) by Admin
   */
  public static addStock(params: {
    materialId: string;
    quantity: number;
    costPrice?: number;
    supplierId?: string;
    invoiceNumber?: string;
    note?: string;
    userId: string;
  }): { stockBefore: number; stockAfter: number } {
    const now = new Date().toISOString();

    return db.transaction(() => {
      const mat = db.queryOne<any>('SELECT * FROM materials WHERE id = ?', [params.materialId]);
      if (!mat) throw new Error('Material tidak ditemukan');

      const stockBefore = mat.stock;
      const stockAfter = Number((stockBefore + params.quantity).toFixed(4));

      // Update material
      if (params.costPrice !== undefined && params.costPrice > 0) {
        db.run(
          'UPDATE materials SET stock = ?, cost_price = ?, supplier_id = COALESCE(?, supplier_id), updated_at = ? WHERE id = ?',
          [stockAfter, params.costPrice, params.supplierId || null, now, params.materialId]
        );
      } else {
        db.run('UPDATE materials SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, now, params.materialId]);
      }

      // Record movement
      const movementId = `MOV-IN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      db.run(
        `INSERT INTO stock_movements (id, material_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, note, created_at)
         VALUES (?, ?, 'STOCK_IN', ?, ?, ?, 'STOCK_IN', ?, ?, ?, ?)`,
        [
          movementId,
          params.materialId,
          params.quantity,
          stockBefore,
          stockAfter,
          params.invoiceNumber || 'MANUAL_IN',
          params.userId,
          params.note || 'Tambah Stock (Stock In)',
          now
        ]
      );

      return { stockBefore, stockAfter };
    });
  }

  /**
   * Stock Adjustment (Stock Opname) by Admin
   */
  public static adjustStock(params: {
    materialId: string;
    actualStock: number;
    reason: string;
    userId: string;
  }): { stockBefore: number; stockAfter: number; diff: number } {
    const now = new Date().toISOString();

    return db.transaction(() => {
      const mat = db.queryOne<any>('SELECT * FROM materials WHERE id = ?', [params.materialId]);
      if (!mat) throw new Error('Material tidak ditemukan');

      const stockBefore = mat.stock;
      const stockAfter = params.actualStock;
      const diff = Number((stockAfter - stockBefore).toFixed(4));

      db.run('UPDATE materials SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, now, params.materialId]);

      const movementId = `MOV-ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      db.run(
        `INSERT INTO stock_movements (id, material_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, note, created_at)
         VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, 'ADJUSTMENT', 'OPNAME', ?, ?, ?)`,
        [
          movementId,
          params.materialId,
          diff,
          stockBefore,
          stockAfter,
          params.userId,
          `Stock Adjustment: ${params.reason}`,
          now
        ]
      );

      return { stockBefore, stockAfter, diff };
    });
  }

  /**
   * Reverse stock movements when a transaction is VOIDED / CANCELLED
   */
  public static reverseStockForTransaction(transactionId: string, userId: string, reason: string): void {
    const now = new Date().toISOString();

    db.transaction(() => {
      // Find all SALE movements for this transaction
      const movements = db.query<any>(
        "SELECT * FROM stock_movements WHERE reference_id = ? AND movement_type = 'SALE'",
        [transactionId]
      );

      for (const mov of movements) {
        const mat = db.queryOne<any>('SELECT stock FROM materials WHERE id = ?', [mov.material_id]);
        if (!mat) continue;

        const returnQty = Math.abs(mov.quantity);
        const stockBefore = mat.stock;
        const stockAfter = Number((stockBefore + returnQty).toFixed(4));

        db.run('UPDATE materials SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, now, mov.material_id]);

        const revId = `MOV-REV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        db.run(
          `INSERT INTO stock_movements (id, material_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, note, created_at)
           VALUES (?, ?, 'VOID_REVERSAL', ?, ?, ?, 'VOID', ?, ?, ?, ?)`,
          [
            revId,
            mov.material_id,
            returnQty,
            stockBefore,
            stockAfter,
            transactionId,
            userId,
            `Void Reversal: ${reason}`,
            now
          ]
        );
      }
    });
  }
}
