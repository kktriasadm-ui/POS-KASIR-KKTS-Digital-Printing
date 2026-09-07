import React, { useState } from 'react';
import { ReceiptData } from '../types/index.js';
import { Printer, X, Download, Check, Copy } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
  title?: string;
  onReprint?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  title = 'Struk Pembayaran (58mm ESC/POS)',
  onReprint
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    // Standard thermal receipt printing
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${receipt.type === 'PRODUCTION_RECEIPT' ? 'Struk Produksi' : 'Struk Kasir'} - ${receipt.transactionNumber}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              width: 58mm;
              margin: 0;
              padding: 4mm 2mm;
              font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.3;
              color: #000;
              background: #fff;
              white-space: pre-wrap;
              word-break: break-word;
            }
          </style>
        </head>
        <body>${receipt.plainText}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    if (onReprint) {
      onReprint();
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(receipt.plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-sky-200" />
            <h3 className="font-bold text-base">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 58mm Thermal Monospace Preview */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center">
          <div className="w-[300px] bg-white p-5 rounded-lg shadow-sm border border-slate-200 receipt-font text-[11px] leading-relaxed text-slate-900 whitespace-pre-wrap select-text">
            {receipt.plainText}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Tersalin' : 'Salin Teks'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 rounded-lg shadow-md shadow-sky-500/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              Cetak Struk (58mm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
