export type PricingType = 'PCS' | 'METER' | 'M2' | 'FIXED' | 'CUSTOM';
export type M2RoundingRule = 'ACTUAL' | 'ROUND_UP' | 'ROUND_UP_HALF';

export interface PricingCalculationResult {
  pricingType: PricingType;
  quantity: number;
  unit: string;
  width?: number; // in meters
  height?: number; // in meters
  unitOfDimension?: 'm' | 'cm';
  calculatedArea?: number; // in M2
  roundedArea?: number; // in M2
  unitPrice: number;
  subtotal: number;
  formulaDescription: string;
}

export class PricingEngine {
  /**
   * Converts width and height from given unit (m or cm) into meters
   */
  public static convertToMeters(value: number, unit: 'm' | 'cm'): number {
    if (unit === 'cm') {
      return Number((value / 100).toFixed(4));
    }
    return Number(value.toFixed(4));
  }

  /**
   * Applies M2 rounding rules
   * ACTUAL: exact area (e.g. 5.25 -> 5.25)
   * ROUND_UP: ceiling to next integer (e.g. 5.25 -> 6.0)
   * ROUND_UP_HALF: ceiling to nearest 0.5 (e.g. 5.25 -> 5.5, 5.01 -> 5.5, 5.6 -> 6.0)
   */
  public static applyM2Rounding(area: number, rule: M2RoundingRule = 'ACTUAL'): number {
    if (rule === 'ROUND_UP') {
      return Math.ceil(area);
    }
    if (rule === 'ROUND_UP_HALF') {
      return Math.ceil(area * 2) / 2;
    }
    return Number(area.toFixed(4));
  }

  /**
   * Calculate PCS: Qty * unitPrice
   * Example: 100 PCS * Rp 500 = Rp 50.000
   */
  public static calculatePCS(qty: number, unitPrice: number, unit: string = 'PCS'): PricingCalculationResult {
    const subtotal = Math.round(qty * unitPrice);
    return {
      pricingType: 'PCS',
      quantity: qty,
      unit,
      unitPrice,
      subtotal,
      formulaDescription: `${qty} ${unit} × Rp ${unitPrice.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}`
    };
  }

  /**
   * Calculate Meter: length (qty) * unitPrice
   * Example: 10 meter * Rp 25.000 = Rp 250.000
   */
  public static calculateMeter(lengthMeters: number, unitPrice: number, unit: string = 'METER'): PricingCalculationResult {
    const subtotal = Math.round(lengthMeters * unitPrice);
    return {
      pricingType: 'METER',
      quantity: lengthMeters,
      unit,
      unitPrice,
      subtotal,
      formulaDescription: `${lengthMeters} ${unit} × Rp ${unitPrice.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}`
    };
  }

  /**
   * Calculate M² (Meter Persegi):
   * Width(m) * Height(m) * Qty * unitPrice
   * Example: 3.5m * 1.5m = 5.25 M² * 1 * Rp 30.000 = Rp 157.500
   */
  public static calculateM2(params: {
    width: number;
    height: number;
    dimensionUnit?: 'm' | 'cm';
    qty?: number;
    unitPrice: number;
    roundingRule?: M2RoundingRule;
  }): PricingCalculationResult {
    const dimUnit = params.dimensionUnit || 'm';
    const widthM = this.convertToMeters(params.width, dimUnit);
    const heightM = this.convertToMeters(params.height, dimUnit);
    const qty = params.qty ?? 1;
    const rule = params.roundingRule || 'ACTUAL';

    const actualSingleArea = Number((widthM * heightM).toFixed(4));
    const roundedSingleArea = this.applyM2Rounding(actualSingleArea, rule);
    const totalArea = Number((roundedSingleArea * qty).toFixed(4));
    const subtotal = Math.round(totalArea * params.unitPrice);

    let roundDesc = '';
    if (rule === 'ROUND_UP') roundDesc = ' [Pembulatan Ke Atas]';
    if (rule === 'ROUND_UP_HALF') roundDesc = ' [Pembulatan 0.5]';

    const formulaDescription = `${widthM}m × ${heightM}m = ${roundedSingleArea} M²${roundDesc} × ${qty} pcs @ Rp ${params.unitPrice.toLocaleString('id-ID')}/M² = Rp ${subtotal.toLocaleString('id-ID')}`;

    return {
      pricingType: 'M2',
      quantity: qty,
      unit: 'M2',
      width: widthM,
      height: heightM,
      unitOfDimension: 'm',
      calculatedArea: actualSingleArea,
      roundedArea: roundedSingleArea,
      unitPrice: params.unitPrice,
      subtotal,
      formulaDescription
    };
  }

  /**
   * Fixed price (e.g. standard product with package price)
   */
  public static calculateFixed(qty: number, unitPrice: number, unit: string = 'SET'): PricingCalculationResult {
    const subtotal = Math.round(qty * unitPrice);
    return {
      pricingType: 'FIXED',
      quantity: qty,
      unit,
      unitPrice,
      subtotal,
      formulaDescription: `${qty} ${unit} × Rp ${unitPrice.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}`
    };
  }

  /**
   * Universal dispatch calculator
   */
  public static calculate(params: {
    pricingType: PricingType;
    unitPrice: number;
    quantity?: number;
    width?: number;
    height?: number;
    dimensionUnit?: 'm' | 'cm';
    unit?: string;
    roundingRule?: M2RoundingRule;
  }): PricingCalculationResult {
    const qty = params.quantity ?? 1;

    switch (params.pricingType) {
      case 'M2':
        return this.calculateM2({
          width: params.width || 1,
          height: params.height || 1,
          dimensionUnit: params.dimensionUnit || 'm',
          qty,
          unitPrice: params.unitPrice,
          roundingRule: params.roundingRule || 'ACTUAL'
        });

      case 'METER':
        return this.calculateMeter(qty, params.unitPrice, params.unit || 'METER');

      case 'PCS':
        return this.calculatePCS(qty, params.unitPrice, params.unit || 'PCS');

      case 'FIXED':
        return this.calculateFixed(qty, params.unitPrice, params.unit || 'SET');

      case 'CUSTOM':
        if (params.width && params.height) {
          return this.calculateM2({
            width: params.width,
            height: params.height,
            dimensionUnit: params.dimensionUnit || 'm',
            qty,
            unitPrice: params.unitPrice,
            roundingRule: params.roundingRule || 'ACTUAL'
          });
        }
        return this.calculatePCS(qty, params.unitPrice, params.unit || 'CUSTOM');

      default:
        return this.calculatePCS(qty, params.unitPrice, params.unit || 'PCS');
    }
  }
}
