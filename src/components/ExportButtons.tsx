import React, { useState } from "react";

type ExportButtonsProps = {
  onPrint?: () => void;
  onWord?: () => Promise<void> | void;
  onCopyForWord?: () => Promise<void> | void;
  onPdf?: () => Promise<void> | void;
  onClose?: () => void;
  wordBusy?: boolean;
  pdfBusy?: boolean;
  printLabel?: string;
  wordLabel?: string;
  pdfLabel?: string;
  closeLabel?: string;
  className?: string;
};

/**
 * Merkezi Word/PDF İndirme Butonları Component'i
 * Tüm sayfalarda aynı görünüm ve davranış için kullanılır
 */
export default function ExportButtons({
  onPrint,
  onWord,
  onCopyForWord,
  onPdf,
  onClose,
  wordBusy = false,
  pdfBusy = false,
  printLabel = "Yazdır",
  wordLabel = "📄 Word İndir",
  pdfLabel = "📕 PDF İndir",
  closeLabel = "Kapat",
  className = "",
}: ExportButtonsProps) {
  const [localWordBusy, setLocalWordBusy] = useState(false);
  const [localPdfBusy, setLocalPdfBusy] = useState(false);

  const handleWord = async () => {
    if (!onWord) return;
    try {
      setLocalWordBusy(true);
      await onWord();
    } catch (err) {
      console.error("Word export error:", err);
    } finally {
      setLocalWordBusy(false);
    }
  };

  const handlePdf = async () => {
    if (!onPdf) return;
    try {
      setLocalPdfBusy(true);
      await onPdf();
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setLocalPdfBusy(false);
    }
  };

  const isWordBusy = wordBusy || localWordBusy;
  const isPdfBusy = pdfBusy || localPdfBusy;

  const btnBase = "text-xs font-medium rounded-lg px-3 py-2 transition-colors border bg-white dark:bg-gray-800 w-full sm:w-auto min-w-0";
  return (
    <div className={`grid grid-cols-2 sm:flex sm:flex-wrap gap-2 ${className}`}>
      {onCopyForWord && (
        <button
          onClick={onCopyForWord}
          className={`${btnBase} border-emerald-500 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30`}
        >
          Word'e Kopyala
        </button>
      )}
      {onPrint && (
        <button
          onClick={onPrint}
          className={`${btnBase} border-blue-500 dark:border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30`}
        >
          {printLabel}
        </button>
      )}
      {onWord && (
        <button
          onClick={handleWord}
          disabled={isWordBusy}
          className={`${btnBase} border-green-500 dark:border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isWordBusy ? "Oluşturuluyor..." : wordLabel}
        </button>
      )}
      {onPdf && (
        <button
          onClick={handlePdf}
          disabled={isPdfBusy}
          className={`${btnBase} border-red-500 dark:border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isPdfBusy ? "Oluşturuluyor..." : pdfLabel}
        </button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className={`${btnBase} border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`}
        >
          {closeLabel}
        </button>
      )}
    </div>
  );
}
