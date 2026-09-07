import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah, formatDate, formatDateTime } from './formatters.js';

export class PDFReportService {
  /**
   * Helper: Add branded header to PDF
   */
  private static addHeader(doc: jsPDF, title: string, subtitle: string) {
    // Top banner blue gradient effect
    doc.setFillColor(3, 105, 161); // Blue 700
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('KKTS DIGITAL PRINTING', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Sistem POS Kasir, Stock, Produksi & Laporan Profesional', 14, 17);

    // Document Title
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, 14, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(subtitle, 14, 38);
  }

  /**
   * Helper: Add footer to PDF
   */
  private static addFooter(doc: jsPDF) {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Digenerate pada: ${formatDateTime(new Date().toISOString())} | KKTS POS System`, 14, pageHeight - 7);
      doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    }
  }

  /**
   * Generate Daily Transaction Report PDF
   * Acceptance Test 101: File name Laporan_Transaksi_Harian_07-09-2026.pdf
   */
  public static generateDailyReportPDF(data: {
    date: string; // YYYY-MM-DD
    cashierName?: string;
    summary: {
      totalTransactions: number;
      grossSales: number;
      totalDiscount: number;
      netSales: number;
      cashTotal: number;
      transferTotal: number;
      totalPcs: number;
      totalMeter: number;
      totalM2: number;
    };
    transactions: any[];
  }): { doc: jsPDF; filename: string } {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const formattedDate = formatDate(data.date).replace(/\//g, '-');
    const filename = `Laporan_Transaksi_Harian_${formattedDate}.pdf`;

    this.addHeader(
      doc,
      'LAPORAN TRANSAKSI HARIAN',
      `Tanggal: ${formatDate(data.date)} | Kasir: ${data.cashierName || 'Seluruh Toko'}`
    );

    // Summary Box
    const s = data.summary;
    autoTable(doc, {
      startY: 44,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['Ringkasan Penjualan', 'Nilai', 'Rekap Kuantitas Cetak', 'Total']],
      body: [
        ['Total Transaksi', `${s.totalTransactions} Transaksi`, 'Total PCS / Lembar', `${s.totalPcs} PCS`],
        ['Penjualan Kotor (Gross)', formatRupiah(s.grossSales), 'Total METER', `${s.totalMeter} Meter`],
        ['Total Diskon', formatRupiah(s.totalDiscount), 'Total M² (Meter Persegi)', `${s.totalM2} M²`],
        ['Penjualan Bersih (Net)', formatRupiah(s.netSales), 'Pembayaran CASH', formatRupiah(s.cashTotal)],
        ['Pembayaran TRANSFER', formatRupiah(s.transferTotal), '-', '-']
      ]
    });

    // Detail Transactions Table
    const trxRows = data.transactions.map((t, idx) => {
      const time = t.created_at ? t.created_at.substring(11, 16) : '-';
      const itemsDesc = (t.items || []).map((it: any) => `${it.product_name_snapshot} (${it.quantity} ${it.unit})`).join(', ') || '-';
      return [
        String(idx + 1),
        t.transaction_number,
        time,
        t.customer_name || 'Umum',
        itemsDesc,
        t.payment_method,
        formatRupiah(t.total)
      ];
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica' },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['No', 'No. Transaksi', 'Jam', 'Customer', 'Item / Produk', 'Metode', 'Total']],
      body: trxRows.length > 0 ? trxRows : [['-', 'Belum ada transaksi pada tanggal ini', '', '', '', '', '']],
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 30 },
        4: { cellWidth: 60 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 25, halign: 'right' }
      }
    });

    this.addFooter(doc);

    return { doc, filename };
  }

  /**
   * Generate Monthly Transaction Report PDF
   * Acceptance Test 102: File name Laporan_Transaksi_Bulanan_09-2026.pdf
   */
  public static generateMonthlyReportPDF(data: {
    year: number;
    month: number;
    cashierName?: string;
    summary: {
      totalTransactions: number;
      grossSales: number;
      totalDiscount: number;
      netSales: number;
      cashTotal: number;
      transferTotal: number;
      totalPcs: number;
      totalMeter: number;
      totalM2: number;
    };
    dailyRecap: Array<{
      formattedDate: string;
      transactionCount: number;
      cashTotal: number;
      transferTotal: number;
      totalAmount: number;
    }>;
    transactions: any[];
  }): { doc: jsPDF; filename: string } {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const padMonth = String(data.month).padStart(2, '0');
    const filename = `Laporan_Transaksi_Bulanan_${padMonth}-${data.year}.pdf`;

    const lastDay = new Date(data.year, data.month, 0).getDate();
    const periodStr = `01/${padMonth}/${data.year} – ${lastDay}/${padMonth}/${data.year}`;

    this.addHeader(
      doc,
      'LAPORAN TRANSAKSI BULANAN',
      `Periode: ${periodStr} | Kasir: ${data.cashierName || 'Seluruh Toko'}`
    );

    // Summary Box
    const s = data.summary;
    autoTable(doc, {
      startY: 44,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['Ringkasan Periode', 'Nilai', 'Rekap Kuantitas Cetak', 'Total']],
      body: [
        ['Total Transaksi', `${s.totalTransactions} Transaksi`, 'Total PCS / Lembar', `${s.totalPcs} PCS`],
        ['Penjualan Kotor (Gross)', formatRupiah(s.grossSales), 'Total METER', `${s.totalMeter} Meter`],
        ['Total Diskon', formatRupiah(s.totalDiscount), 'Total M² (Meter Persegi)', `${s.totalM2} M²`],
        ['Penjualan Bersih (Net)', formatRupiah(s.netSales), 'Pembayaran CASH', formatRupiah(s.cashTotal)],
        ['Pembayaran TRANSFER', formatRupiah(s.transferTotal), '-', '-']
      ]
    });

    // Rekap Harian Table
    const recapRows = data.dailyRecap.map(r => [
      r.formattedDate,
      String(r.transactionCount),
      formatRupiah(r.cashTotal),
      formatRupiah(r.transferTotal),
      formatRupiah(r.totalAmount)
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('REKAPITULASI HARIAN', 14, (doc as any).lastAutoTable.finalY + 8);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 11,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica' },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Tanggal', 'Transaksi', 'Cash', 'Transfer', 'Total']],
      body: recapRows.length > 0 ? recapRows : [['-', 'Belum ada transaksi bulan ini', '', '', '']],
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
        4: { cellWidth: 40, halign: 'right' }
      }
    });

    this.addFooter(doc);

    return { doc, filename };
  }

  /**
   * Generate Custom Date Range Report PDF (Admin)
   */
  public static generateCustomReportPDF(data: {
    startDate: string;
    endDate: string;
    summary: any;
    topProducts: any[];
    cashierStats: any[];
  }): { doc: jsPDF; filename: string } {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const sDate = formatDate(data.startDate).replace(/\//g, '-');
    const eDate = formatDate(data.endDate).replace(/\//g, '-');
    const filename = `Laporan_Custom_${sDate}_sampai_${eDate}.pdf`;

    this.addHeader(
      doc,
      'LAPORAN TRANSAKSI PERIODE KHUSUS',
      `Periode: ${formatDate(data.startDate)} s/d ${formatDate(data.endDate)}`
    );

    const s = data.summary;
    autoTable(doc, {
      startY: 44,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['Metrik', 'Nilai', 'Metode Pembayaran', 'Total']],
      body: [
        ['Total Transaksi', `${s.total_count || 0} Transaksi`, 'CASH', formatRupiah(s.cash_total || 0)],
        ['Penjualan Kotor', formatRupiah(s.gross_sales || 0), 'TRANSFER', formatRupiah(s.transfer_total || 0)],
        ['Total Diskon', formatRupiah(s.total_discount || 0), '-', '-'],
        ['Penjualan Bersih', formatRupiah(s.net_sales || 0), '-', '-']
      ]
    });

    // Top products
    const prodRows = data.topProducts.map((p, idx) => [
      String(idx + 1),
      p.product_name + (p.variant_name ? ` (${p.variant_name})` : ''),
      `${p.total_qty} ${p.unit}`,
      formatRupiah(p.total_revenue)
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('PRODUK TERLARIS (TOP PRODUCTS)', 14, (doc as any).lastAutoTable.finalY + 8);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 11,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica' },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['No', 'Nama Produk', 'Jumlah Terjual', 'Total Omset']],
      body: prodRows.length > 0 ? prodRows : [['-', 'Tidak ada data produk', '', '']],
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 90 },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 40, halign: 'right' }
      }
    });

    this.addFooter(doc);

    return { doc, filename };
  }

  /**
   * Common actions: View in new window, Download, or Print
   */
  public static viewPDF(doc: jsPDF) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  public static downloadPDF(doc: jsPDF, filename: string) {
    doc.save(filename);
  }

  public static printPDF(doc: jsPDF) {
    doc.autoPrint();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}
