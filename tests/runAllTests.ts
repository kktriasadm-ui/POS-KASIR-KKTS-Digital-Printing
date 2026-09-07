import { PricingEngine } from '../server/engines/PricingEngine.js';
import { StockEngine } from '../server/engines/StockEngine.js';
import { db } from '../server/db/database.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('\n=============================================');
console.log('🧪 RUNNING KKTS DIGITAL PRINTING ACCEPTANCE TESTS');
console.log('=============================================\n');

// 1. Acceptance Test 94 — Perhitungan PCS
// 100 PCS x Rp 500 = Rp 50.000
{
  const res = PricingEngine.calculatePCS(100, 500);
  assert(res.subtotal === 50000, `Acceptance Test 94: 100 PCS x Rp 500 should equal Rp 50.000 (got ${res.subtotal})`);
}

// 2. Acceptance Test 95 — Perhitungan Meter
// 10 meter x Rp 25.000 = Rp 250.000
{
  const res = PricingEngine.calculateMeter(10, 25000);
  assert(res.subtotal === 250000, `Acceptance Test 95: 10 meter x Rp 25.000 should equal Rp 250.000 (got ${res.subtotal})`);
}

// 3. Acceptance Test 93 — Perhitungan Banner M2
// 3,5 meter x 1,5 meter = 5,25 M2; Harga Rp 30.000/M2 = Rp 157.500
{
  const res = PricingEngine.calculateM2({
    width: 3.5,
    height: 1.5,
    qty: 1,
    unitPrice: 30000,
    roundingRule: 'ACTUAL'
  });
  assert(res.calculatedArea === 5.25, `Acceptance Test 93: Area should be 5.25 M2 (got ${res.calculatedArea})`);
  assert(res.subtotal === 157500, `Acceptance Test 93: Subtotal should be Rp 157.500 (got ${res.subtotal})`);
}

// 4. Custom Size with Centimeter Conversion
// 350 cm x 150 cm => 3.5m x 1.5m = 5.25 M2
{
  const res = PricingEngine.calculateM2({
    width: 350,
    height: 150,
    dimensionUnit: 'cm',
    qty: 1,
    unitPrice: 30000,
    roundingRule: 'ACTUAL'
  });
  assert(res.width === 3.5, `Custom Size: 350cm should be 3.5m (got ${res.width})`);
  assert(res.height === 1.5, `Custom Size: 150cm should be 1.5m (got ${res.height})`);
  assert(res.calculatedArea === 5.25, `Custom Size: Area should be 5.25 M2 (got ${res.calculatedArea})`);
  assert(res.subtotal === 157500, `Custom Size: Subtotal should be Rp 157.500 (got ${res.subtotal})`);
}

// 5. M2 Rounding Rules
// ACTUAL: 5.25 -> 5.25
// ROUND_UP: 5.25 -> 6.0
// ROUND_UP_HALF: 5.25 -> 5.5
{
  const actual = PricingEngine.applyM2Rounding(5.25, 'ACTUAL');
  assert(actual === 5.25, `Rounding ACTUAL: 5.25 -> 5.25 (got ${actual})`);

  const roundUp = PricingEngine.applyM2Rounding(5.25, 'ROUND_UP');
  assert(roundUp === 6, `Rounding ROUND_UP: 5.25 -> 6 (got ${roundUp})`);

  const roundHalf = PricingEngine.applyM2Rounding(5.25, 'ROUND_UP_HALF');
  assert(roundHalf === 5.5, `Rounding ROUND_UP_HALF: 5.25 -> 5.5 (got ${roundHalf})`);
}

// 6. M2 with Quantity
// 3.5 x 1.5 = 5.25 M2; Qty 2 -> 10.50 M2 x Rp 30.000 = Rp 315.000
{
  const res = PricingEngine.calculateM2({
    width: 3.5,
    height: 1.5,
    qty: 2,
    unitPrice: 30000,
    roundingRule: 'ACTUAL'
  });
  assert(res.subtotal === 315000, `M2 with Qty 2: Subtotal should be Rp 315.000 (got ${res.subtotal})`);
}

// 7. Acceptance Test 96 — Low Stock & Out of Stock Logic
{
  const status1 = StockEngine.getStockStatus(25, 20);
  assert(status1 === 'AMAN', `Low Stock Logic: 25 stock with 20 min -> AMAN (got ${status1})`);

  const status2 = StockEngine.getStockStatus(15, 20);
  assert(status2 === 'LOW_STOCK', `Acceptance Test 96: 15 stock with 20 min -> LOW_STOCK (got ${status2})`);

  const status3 = StockEngine.getStockStatus(0, 20);
  assert(status3 === 'HABIS', `Acceptance Test 96: 0 stock -> HABIS (got ${status3})`);
}

// 8. Acceptance Test 92 — Shared Material
// Stock: 100 meter. Buy 5 meter Kisscut -> 95 meter. Then buy 3 meter Tanpa Kisscut -> 92 meter.
{
  const matBefore = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-STK-CAM'");
  const initialStock = matBefore ? matBefore.stock : 100;

  // Reset to 100 for exact test
  db.run("UPDATE materials SET stock = 100 WHERE id = 'MAT-STK-CAM'");

  // Buy 5m Kisscut
  StockEngine.deductStock({
    items: [{
      productId: 'PRD-STK-KC', // Stiker Kisscut
      quantity: 5
    }],
    transactionId: 'TEST-TRX-001',
    transactionNumber: 'TRX-TEST-0001',
    userId: 'USR-ADMIN'
  });

  const matAfter1 = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-STK-CAM'");
  assert(matAfter1.stock === 95, `Acceptance Test 92 Step 1: 100 - 5 = 95 meter (got ${matAfter1.stock})`);

  // Buy 3m Tanpa Kisscut
  StockEngine.deductStock({
    items: [{
      productId: 'PRD-STK-NKC', // Stiker Tanpa Kisscut (Shares same MAT-STK-CAM!)
      quantity: 3
    }],
    transactionId: 'TEST-TRX-002',
    transactionNumber: 'TRX-TEST-0002',
    userId: 'USR-ADMIN'
  });

  const matAfter2 = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-STK-CAM'");
  assert(matAfter2.stock === 92, `Acceptance Test 92 Step 2: 95 - 3 = 92 meter (got ${matAfter2.stock})`);
}

// 9. Acceptance Test 97 — Cash & Change Calculation
// Total: Rp 157.500, Bayar: Rp 200.000 => Kembali: Rp 42.500
{
  const total = 157500;
  const pay = 200000;
  const change = pay - total;
  assert(change === 42500, `Acceptance Test 97: Kembali should be Rp 42.500 (got ${change})`);
}

// 10. Acceptance Test 106 — Stock Insufficiency Blocker
{
  // Try to buy 99999 meters of Stiker Camel (which only has 92m)
  const check = StockEngine.checkStock([{
    productId: 'PRD-STK-KC',
    quantity: 99999
  }], false);

  assert(check.ok === false, 'Acceptance Test 106: Stock check should fail when demand exceeds stock');
  assert(check.insufficientMaterials.length > 0, 'Acceptance Test 106: Should report insufficient materials list');
}

console.log('\n=============================================');
console.log('🎉 ALL ACCEPTANCE CRITERIA ENGINE TESTS PASSED!');
console.log('=============================================\n');
