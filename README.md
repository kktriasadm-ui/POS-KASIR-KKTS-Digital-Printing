# POS-KASIR-KKTS-Digital-Printing

Sistem POS Kasir, Manajemen Produk, Manajemen Material & Stock, Pelacak Produksi, dan Laporan Keuangan/Operasional yang dirancang khusus untuk bisnis **Digital Printing**.

---

## 🚀 Fitur Utama

- **Kalkulasi Khusus Digital Printing**:
  - Satuan: **PCS**, **METER**, dan **M²** (Meter Persegi).
  - Auto-konversi ukuran CM ke Meter ($P \times L \div 10.000$).
  - Aturan pembulatan M²: `ACTUAL`, `ROUND_UP` (ke atas), `ROUND_UP_HALF` (kelipatan 0.5).
  - Snapshot formula dan spesifikasi ukuran per item transaksi.

- **Manajemen Material & Stock (BOM - Bill of Materials)**:
  - Stok dikelola pada level bahan baku (bukan nama produk).
  - **Shared Material**: Berbagai variasi produk memotong stok bahan baku yang sama.
  - **Multi Material**: Satu produk dapat memotong beberapa jenis bahan sekaligus (cetak + rangka/finishing).
  - Atomic stock validation: Mencegah stok minus secara atomik.
  - Void Reversal: Pembatalan transaksi otomatis mengembalikan stok bahan.

- **Manajemen Produksi (SPK)**:
  - Nomor SPK otomatis: `JOB-YYYYMMDD-XXXX`.
  - Workflow status: `MENUNGGU` ➔ `DIPROSES` ➔ `SELESAI` ➔ `DIAMBIL`.
  - Audit trail perubahan status produksi per operator.

- **Kasir & Struk Thermal 58mm**:
  - Live Rupiah Formatter (`Rp 100.000`) dan kalkulasi kembalian otomatis.
  - Cetak struk pembayaran kasir & struk produksi 58mm (IWARE C58AC).
  - Fitur reprint tanpa menduplikasi data transaksi (tercatat di `print_logs`).

- **Laporan & Export PDF**:
  - Laporan Penjualan Harian & Bulanan untuk kasir (unduh PDF langsung).
  - Laporan HPP, Laba Kotor, Gross Margin, Rekapitulasi M², dan Valuasi Stok untuk Admin.

- **Hak Akses Ketat (RBAC)**:
  - **Kasir**: Terkunci pada 4 menu (Dashboard, POS Kasir, Transaksi, Produksi).
  - **Admin**: Akses penuh ke seluruh fitur dan pengaturan.

- **Offline-First & Reliable**:
  - Menggunakan SQLite bawaan Node.js 24 (`node:sqlite` WAL mode).
  - Fitur backup & restore database satu klik.

---

## 🛠️ Teknologi yang Digunakan

- **Backend**: Node.js v24, Express, TypeScript, `node:sqlite` (ACID WAL mode), JWT, bcryptjs
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, jsPDF & jsPDF-AutoTable
- **Printing**: ESC/POS 58mm Thermal Printer standard (IWARE C58AC)

---

## 👤 Akun Bawaan Sistem

| Role | Username | Password |
|---|---|---|
| **Admin** | `admin` | `admin123` |
| **Kasir** | `kasir1` | `kasir123` |

---

## ⚡ Cara Menjalankan

### Mode Kasir / Production:
Cukup klik ganda file:
```cmd
start-kkts-pos.bat
```
Aplikasi akan membuka di browser pada alamat `http://localhost:3001`.

### Mode Development:
```bash
npm run dev
```
Buka browser pada `http://localhost:5173`.
