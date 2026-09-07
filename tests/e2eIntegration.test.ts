import http from 'node:http';
import app from '../server/index.js';
import { db } from '../server/db/database.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function request(serverUrl: string, method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  return { status: res.status, data };
}

async function runE2ETests() {
  console.log('\n=============================================');
  console.log('🚀 RUNNING END-TO-END SYSTEM INTEGRATION TESTS');
  console.log('=============================================\n');

  // Start temporary test server on port 3002
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3002, () => resolve()));
  const serverUrl = 'http://localhost:3002';

  try {
    // 1. Healthcheck
    {
      const res = await request(serverUrl, 'GET', '/api/health');
      assert(res.status === 200 && res.data.status === 'ok', 'Server healthcheck responded with status: ok');
    }

    // 2. Login Admin
    let adminToken = '';
    {
      const res = await request(serverUrl, 'POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      assert(res.status === 200 && res.data.user.role === 'ADMIN', 'Admin login successful and returned role ADMIN');
      adminToken = res.data.token;
    }

    // 3. Login Kasir
    let kasirToken = '';
    {
      const res = await request(serverUrl, 'POST', '/api/auth/login', {
        username: 'kasir1',
        password: 'kasir123'
      });
      assert(res.status === 200 && res.data.user.role === 'KASIR', 'Kasir login successful and returned role KASIR');
      kasirToken = res.data.token;
    }

    // 4. RBAC Authorization Test: Kasir attempting Admin-only endpoint
    {
      const res = await request(serverUrl, 'POST', '/api/products', { name: 'Test' }, kasirToken);
      assert(res.status === 403, 'RBAC Guard: Kasir blocked with 403 Forbidden from creating products');
    }

    // 5. Catalog Fetch
    let products: any[] = [];
    {
      const res = await request(serverUrl, 'GET', '/api/pos/catalog', undefined, kasirToken);
      assert(res.status === 200 && Array.isArray(res.data.products), 'POS Catalog returned active products list');
      products = res.data.products;
    }

    // 6. Test Atomic Checkout (Banner Outdoor: 3.5m x 1.5m = 5.25 M2)
    // Total Rp 157.500, Cash Rp 200.000, Change Rp 42.500
    let testTrxId = '';
    let testJobId = '';
    {
      const bannerProd = products.find((p: any) => p.id === 'PRD-BNR-OUT');
      assert(!!bannerProd, 'Found Banner Outdoor product PRD-BNR-OUT');

      // Check initial stock of Flexi 280
      const flexiBefore = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-FLX-280'").stock;

      const checkoutRes = await request(serverUrl, 'POST', '/api/pos/checkout', {
        customerId: 'CUS-UMUM',
        items: [{
          productId: bannerProd.id,
          productName: bannerProd.name,
          variantId: 'VAR-BNR-MA',
          variantName: 'Mata Ayam',
          finishing: 'Mata Ayam',
          width: 3.5,
          height: 1.5,
          calculatedArea: 5.25,
          unit: 'M2',
          quantity: 1,
          unitPrice: 30000,
          subtotal: 157500,
          formulaDescription: '3.5m x 1.5m = 5.25 M2 @ Rp 30.000 = Rp 157.500'
        }],
        discount: 0,
        paymentMethod: 'CASH',
        paymentAmount: 200000,
        note: 'Cetak banner urgent untuk toko'
      }, kasirToken);

      assert(checkoutRes.status === 200 && checkoutRes.data.success === true, 'Checkout succeeded');
      assert(checkoutRes.data.transaction.total === 157500, `Total is Rp 157.500 (got ${checkoutRes.data.transaction.total})`);
      assert(checkoutRes.data.transaction.changeAmount === 42500, `Change is Rp 42.500 (got ${checkoutRes.data.transaction.changeAmount})`);
      assert(checkoutRes.data.transaction.transactionNumber.startsWith('TRX-'), 'Generated TRX-YYYYMMDD-XXXX format');
      assert(checkoutRes.data.transaction.jobNumber.startsWith('JOB-'), 'Generated JOB-YYYYMMDD-XXXX format');
      assert(!!checkoutRes.data.paymentReceipt.plainText, 'Generated 58mm ESC/POS payment receipt text');
      assert(!!checkoutRes.data.productionReceipt.plainText, 'Generated 58mm ESC/POS production receipt text');

      testTrxId = checkoutRes.data.transaction.id;
      testJobId = checkoutRes.data.transaction.jobNumber;

      // Verify material stock deduction
      const flexiAfter = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-FLX-280'").stock;
      const expectedFlexi = Number((flexiBefore - 5.25).toFixed(4));
      assert(flexiAfter === expectedFlexi, `Flexi stock accurately deducted by 5.25 M2 (before: ${flexiBefore}, after: ${flexiAfter})`);
    }

    // 7. Test Kasir Production Status Progression
    // MENUNGGU -> DIPROSES -> SELESAI -> DIAMBIL
    {
      const jobRow = db.queryOne<any>('SELECT id, status FROM production_jobs WHERE job_number = ?', [testJobId]);
      assert(!!jobRow, 'Found production job in database');

      // Kasir updates to DIPROSES
      const step1 = await request(serverUrl, 'POST', `/api/production/jobs/${jobRow.id}/status`, {
        newStatus: 'DIPROSES',
        notes: 'Sedang dicetak mesin outdoor'
      }, kasirToken);
      assert(step1.status === 200 && step1.data.newStatus === 'DIPROSES', 'Kasir successfully moved job to DIPROSES');

      // Kasir updates to SELESAI
      const step2 = await request(serverUrl, 'POST', `/api/production/jobs/${jobRow.id}/status`, {
        newStatus: 'SELESAI',
        notes: 'Selesai finishing mata ayam'
      }, kasirToken);
      assert(step2.status === 200 && step2.data.newStatus === 'SELESAI', 'Kasir successfully moved job to SELESAI');

      // Kasir updates to DIAMBIL
      const step3 = await request(serverUrl, 'POST', `/api/production/jobs/${jobRow.id}/status`, {
        newStatus: 'DIAMBIL',
        notes: 'Telah diserahkan ke pelanggan'
      }, kasirToken);
      assert(step3.status === 200 && step3.data.newStatus === 'DIAMBIL', 'Kasir successfully moved job to DIAMBIL');

      // Verify logs
      const logs = db.query<any>('SELECT * FROM production_status_logs WHERE production_job_id = ?', [jobRow.id]);
      assert(logs.length >= 4, `Status logs recorded accurately (found ${logs.length} transitions)`);
    }

    // 8. Test Reprint (Payment and Production Receipts)
    {
      const reprintPay = await request(serverUrl, 'POST', `/api/transactions/${testTrxId}/reprint-payment`, undefined, kasirToken);
      assert(reprintPay.status === 200 && !!reprintPay.data.receipt, 'Payment receipt reprint succeeded');

      const reprintProd = await request(serverUrl, 'POST', `/api/transactions/${testTrxId}/reprint-production`, undefined, kasirToken);
      assert(reprintProd.status === 200 && !!reprintProd.data.receipt, 'Production receipt reprint succeeded');

      const printLogs = db.query<any>('SELECT * FROM print_logs WHERE transaction_id = ?', [testTrxId]);
      assert(printLogs.length >= 2, 'Reprint event logged into print_logs table without creating duplicate transactions');
    }

    // 9. Test Daily & Monthly Reports for Kasir
    {
      const todayStr = new Date().toISOString().substring(0, 10);
      const dailyRes = await request(serverUrl, 'GET', `/api/reports/daily?date=${todayStr}`, undefined, kasirToken);
      assert(dailyRes.status === 200 && dailyRes.data.report.totalTransactions >= 1, 'Kasir daily report contains transaction summary');
      assert(dailyRes.data.report.totalM2 >= 5.25, `Kasir daily report includes accurate M2 recap (got ${dailyRes.data.report.totalM2})`);

      const monthlyRes = await request(serverUrl, 'GET', '/api/reports/monthly', undefined, kasirToken);
      assert(monthlyRes.status === 200 && monthlyRes.data.report.dailyRecap.length >= 1, 'Kasir monthly report contains daily breakdown table');
    }

    // 10. Test Admin HPP and Profit Report
    {
      const hppRes = await request(serverUrl, 'GET', '/api/reports/profit', undefined, adminToken);
      assert(hppRes.status === 200, 'Admin HPP report accessible');
      assert(hppRes.data.report.netRevenue >= 157500, `HPP report calculates net revenue: ${hppRes.data.report.netRevenue}`);
      assert(hppRes.data.report.grossProfit > 0, `HPP report calculates gross profit: ${hppRes.data.report.grossProfit}`);
      assert(hppRes.data.report.grossMargin > 0, `HPP report calculates gross margin: ${hppRes.data.report.grossMargin}%`);
    }

    // 11. Test Void / Cancellation (Admin Only) & Automatic Stock Reversal
    {
      const flexiBeforeVoid = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-FLX-280'").stock;

      const voidRes = await request(serverUrl, 'POST', `/api/transactions/${testTrxId}/void`, {
        reason: 'Customer revisi cetak banner'
      }, adminToken);
      assert(voidRes.status === 200, 'Transaction void succeeded');

      const trxAfter = db.queryOne<any>('SELECT payment_status FROM transactions WHERE id = ?', [testTrxId]);
      assert(trxAfter.payment_status === 'CANCELLED', 'Transaction status marked CANCELLED');

      const flexiAfterVoid = db.queryOne<any>("SELECT stock FROM materials WHERE id = 'MAT-FLX-280'").stock;
      const expectedRestored = Number((flexiBeforeVoid + 5.25).toFixed(4));
      assert(flexiAfterVoid === expectedRestored, `Flexi material stock successfully restored after VOID (before: ${flexiBeforeVoid}, after: ${flexiAfterVoid})`);
    }

    // 12. Test Database Backup
    {
      const backupRes = await request(serverUrl, 'POST', '/api/backup/create', undefined, adminToken);
      assert(backupRes.status === 200 && backupRes.data.backup.filename.endsWith('.db'), 'Database backup created successfully');
    }

    console.log('\n=============================================');
    console.log('🎉 ALL END-TO-END INTEGRATION TESTS PASSED!');
    console.log('=============================================\n');
  } finally {
    server.close();
  }
}

runE2ETests().catch(err => {
  console.error('Fatal E2E test error:', err);
  process.exit(1);
});
