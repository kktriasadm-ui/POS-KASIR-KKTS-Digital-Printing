import { db } from '../db/database.js';

export interface FormattedReceipt {
  rawEscPos: string; // Base64 or hex encoded ESC/POS command stream
  plainText: string;
  lines: string[];
  type: 'PAYMENT_RECEIPT' | 'PRODUCTION_RECEIPT';
  transactionNumber: string;
  jobNumber?: string;
}

export class PrinterService {
  private static readonly LINE_WIDTH = 32; // 58mm thermal standard width

  /**
   * Helper to center text for 32 columns
   */
  private static center(text: string): string {
    if (text.length >= this.LINE_WIDTH) return text.substring(0, this.LINE_WIDTH);
    const totalPad = this.LINE_WIDTH - text.length;
    const leftPad = Math.floor(totalPad / 2);
    const rightPad = totalPad - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  /**
   * Helper to format a two-column line: left aligned label and right aligned value
   */
  private static row(left: string, right: string): string {
    const spaceNeeded = this.LINE_WIDTH - (left.length + right.length);
    if (spaceNeeded <= 0) {
      return `${left.substring(0, this.LINE_WIDTH - right.length - 1)} ${right}`;
    }
    return left + ' '.repeat(spaceNeeded) + right;
  }

  private static divider(): string {
    return '-'.repeat(this.LINE_WIDTH);
  }

  private static formatRupiah(amount: number): string {
    return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
  }

  private static formatDateTime(isoStr: string): string {
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
  }

  /**
   * Build ESC/POS raw command buffer from plain text lines
   */
  private static buildEscPosBuffer(lines: string[], boldLines: number[] = [], doubleHeightLines: number[] = []): Buffer {
    const chunks: Buffer[] = [];

    // ESC @ : Initialize printer
    chunks.push(Buffer.from([0x1B, 0x40]));
    // Set codepage standard / ASCII
    chunks.push(Buffer.from([0x1B, 0x74, 0x00]));

    lines.forEach((line, idx) => {
      // Check formatting
      const isBold = boldLines.includes(idx);
      const isDouble = doubleHeightLines.includes(idx);

      if (isDouble) {
        chunks.push(Buffer.from([0x1D, 0x21, 0x11])); // Double width + height
      } else {
        chunks.push(Buffer.from([0x1D, 0x21, 0x00])); // Normal
      }

      if (isBold) {
        chunks.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold ON
      } else {
        chunks.push(Buffer.from([0x1B, 0x45, 0x00])); // Bold OFF
      }

      chunks.push(Buffer.from(line, 'ascii'));
      chunks.push(Buffer.from([0x0A])); // Line feed
    });

    // Reset format & Feed paper 3 lines
    chunks.push(Buffer.from([0x1B, 0x45, 0x00]));
    chunks.push(Buffer.from([0x1D, 0x21, 0x00]));
    chunks.push(Buffer.from([0x0A, 0x0A, 0x0A]));
    // GS V 65 0 : Cut paper
    chunks.push(Buffer.from([0x1D, 0x56, 0x41, 0x00]));

    return Buffer.concat(chunks);
  }

  /**
   * Generates formatted Struk Pembayaran (58mm ESC/POS)
   */
  public static generatePaymentReceipt(transactionId: string): FormattedReceipt {
    const trx = db.queryOne<any>(
      `SELECT t.*, u.name AS cashier_name, c.name AS customer_name, c.phone AS customer_phone
       FROM transactions t
       JOIN users u ON t.cashier_id = u.id
       LEFT JOIN customers c ON t.customer_id = c.id
       WHERE t.id = ?`,
      [transactionId]
    );
    if (!trx) throw new Error('Transaksi tidak ditemukan');

    const items = db.query<any>('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);
    const storeSetting = db.queryOne<any>("SELECT value FROM settings WHERE key = 'store_name'");
    const storeName = storeSetting ? storeSetting.value : 'KKTS DIGITAL PRINTING';

    const lines: string[] = [];
    const boldLines: number[] = [];

    // Header
    boldLines.push(lines.length);
    lines.push(this.center(storeName));
    lines.push(this.center(trx.transaction_number));
    lines.push(this.center(this.formatDateTime(trx.created_at)));
    lines.push(this.row(`Kasir: ${trx.cashier_name}`, trx.customer_name ? `Cust: ${trx.customer_name}` : 'Cust: Umum'));
    lines.push(this.divider());

    // Items
    for (const it of items) {
      boldLines.push(lines.length);
      lines.push(it.product_name_snapshot);

      if (it.variant_name_snapshot && it.variant_name_snapshot !== 'Standard') {
        lines.push(` Variant: ${it.variant_name_snapshot}`);
      }

      if (it.unit === 'M2' && it.width && it.height) {
        lines.push(` ${it.width.toFixed(2)} x ${it.height.toFixed(2)} m (${it.calculated_area || (it.width * it.height).toFixed(2)} M2)`);
        lines.push(this.row(` ${it.quantity}x @ ${this.formatRupiah(it.unit_price)}/M2`, this.formatRupiah(it.subtotal)));
      } else if (it.unit === 'METER') {
        lines.push(this.row(` ${it.quantity} METER @ ${this.formatRupiah(it.unit_price)}`, this.formatRupiah(it.subtotal)));
      } else {
        lines.push(this.row(` ${it.quantity} ${it.unit} @ ${this.formatRupiah(it.unit_price)}`, this.formatRupiah(it.subtotal)));
      }
    }

    // Totals
    lines.push(this.divider());
    lines.push(this.row('SUBTOTAL', this.formatRupiah(trx.subtotal)));
    if (trx.discount > 0) {
      lines.push(this.row('DISKON', this.formatRupiah(trx.discount)));
    }
    boldLines.push(lines.length);
    lines.push(this.row('TOTAL', this.formatRupiah(trx.total)));
    lines.push(this.row('BAYAR', this.formatRupiah(trx.payment_amount)));
    boldLines.push(lines.length);
    lines.push(this.row('KEMBALI', this.formatRupiah(trx.change_amount)));

    // Payment method & Footer
    lines.push(this.divider());
    lines.push(this.row('Metode:', trx.payment_method));
    if (trx.payment_method === 'TRANSFER' && trx.transfer_bank) {
      lines.push(this.row('Bank/Ref:', `${trx.transfer_bank} / ${trx.transfer_ref || '-'}`));
    }
    if (trx.note) {
      lines.push(`Catatan: ${trx.note}`);
    }
    lines.push('');
    lines.push(this.center('TERIMA KASIH'));
    lines.push(this.center('KKTS DIGITAL PRINTING'));

    const rawBuffer = this.buildEscPosBuffer(lines, boldLines);

    return {
      rawEscPos: rawBuffer.toString('base64'),
      plainText: lines.join('\n'),
      lines,
      type: 'PAYMENT_RECEIPT',
      transactionNumber: trx.transaction_number
    };
  }

  /**
   * Generates formatted Struk Produksi (58mm ESC/POS)
   */
  public static generateProductionReceipt(jobIdOrTrxId: string): FormattedReceipt {
    // Lookup by job ID or transaction ID
    let job = db.queryOne<any>(
      `SELECT pj.*, t.transaction_number, t.note AS trx_note,
              c.name AS customer_name, c.phone AS customer_phone,
              u.name AS cashier_name
       FROM production_jobs pj
       JOIN transactions t ON pj.transaction_id = t.id
       JOIN users u ON t.cashier_id = u.id
       LEFT JOIN customers c ON pj.customer_id = c.id
       WHERE pj.id = ? OR pj.transaction_id = ?`,
      [jobIdOrTrxId, jobIdOrTrxId]
    );

    if (!job) throw new Error('Production Job tidak ditemukan');

    const items = db.query<any>('SELECT * FROM transaction_items WHERE transaction_id = ?', [job.transaction_id]);
    const storeSetting = db.queryOne<any>("SELECT value FROM settings WHERE key = 'store_name'");
    const storeName = storeSetting ? storeSetting.value : 'KKTS DIGITAL PRINTING';

    const lines: string[] = [];
    const boldLines: number[] = [];

    // Header
    boldLines.push(lines.length);
    lines.push(this.center(storeName));
    boldLines.push(lines.length);
    lines.push(this.center('STRUK PRODUKSI'));
    lines.push(this.center(job.job_number));
    lines.push(this.center(job.transaction_number));
    lines.push(this.divider());

    lines.push(`Tanggal : ${this.formatDateTime(job.created_at)}`);
    lines.push(`Customer: ${job.customer_name || 'Umum'} (${job.customer_phone || '-'})`);
    lines.push(`Kasir   : ${job.cashier_name}`);
    lines.push(this.divider());

    // Products / Jobs detail
    for (const it of items) {
      boldLines.push(lines.length);
      lines.push(`Produk: ${it.product_name_snapshot}`);

      if (it.variant_name_snapshot && it.variant_name_snapshot !== 'Standard') {
        lines.push(`Finishing: ${it.variant_name_snapshot}`);
      }

      if (it.width && it.height) {
        lines.push(`Ukuran   : ${it.width} x ${it.height} meter`);
        lines.push(`Luas     : ${it.calculated_area || (it.width * it.height).toFixed(2)} M2`);
      }

      lines.push(`Qty      : ${it.quantity} ${it.unit}`);

      if (it.material_snapshot) {
        lines.push(`Material : ${it.material_snapshot}`);
      }

      lines.push(this.divider());
    }

    if (job.notes || job.trx_note) {
      lines.push('Catatan:');
      lines.push(job.notes || job.trx_note);
      lines.push(this.divider());
    }

    boldLines.push(lines.length);
    lines.push(`STATUS: ${job.status}`);
    lines.push(this.divider());

    const rawBuffer = this.buildEscPosBuffer(lines, boldLines);

    return {
      rawEscPos: rawBuffer.toString('base64'),
      plainText: lines.join('\n'),
      lines,
      type: 'PRODUCTION_RECEIPT',
      transactionNumber: job.transaction_number,
      jobNumber: job.job_number
    };
  }

  /**
   * Record a print / reprint event into print_logs
   */
  public static logPrint(params: {
    transactionId: string;
    printType: 'PAYMENT_RECEIPT' | 'PRODUCTION_RECEIPT';
    printedBy: string;
    printerName?: string;
  }): void {
    const logId = `PRN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const printerName = params.printerName || 'IWARE C58AC';
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO print_logs (id, transaction_id, print_type, printed_by, printer_name, status, printed_at)
       VALUES (?, ?, ?, ?, ?, 'SUCCESS', ?)`,
      [logId, params.transactionId, params.printType, params.printedBy, printerName, now]
    );
  }

  /**
   * Test Printer output
   */
  public static generateTestReceipt(): FormattedReceipt {
    const lines = [
      this.center('KKTS DIGITAL PRINTING'),
      this.center('TEST PRINTER ESC/POS 58mm'),
      this.center('IWARE C58AC TEST OK'),
      this.divider(),
      this.row('Waktu Test:', this.formatDateTime(new Date().toISOString())),
      this.row('Status:', 'ONLINE & SIAP'),
      this.divider(),
      this.center('PRINTER SERVICE READY')
    ];

    const raw = this.buildEscPosBuffer(lines, [0, 1, 2]);

    return {
      rawEscPos: raw.toString('base64'),
      plainText: lines.join('\n'),
      lines,
      type: 'PAYMENT_RECEIPT',
      transactionNumber: 'TEST-PRINT'
    };
  }
}
