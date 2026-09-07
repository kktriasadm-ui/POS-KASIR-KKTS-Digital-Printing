/**
 * Format numeric value to Indonesian Rupiah currency string: Rp 100.000
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'Rp 0';
  }
  const num = Math.round(Number(amount));
  return `Rp ${num.toLocaleString('id-ID')}`;
}

/**
 * Parses raw input string into pure numeric value
 */
export function parseRupiah(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

/**
 * Format ISO string to Indonesian standard DD/MM/YYYY
 */
export function formatDate(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return '-';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return isoDateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format ISO string to DD/MM/YYYY HH:mm
 */
export function formatDateTime(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return '-';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return isoDateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

/**
 * Returns month name in Indonesian
 */
export function getIndonesianMonth(monthNumber: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[monthNumber - 1] || '';
}
