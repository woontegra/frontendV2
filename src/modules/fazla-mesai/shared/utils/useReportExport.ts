/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import { useState } from "react";
import { downloadWordDocument } from "./wordExport";
import { downloadPdfFromDOM } from "./pdfExport";

export function useReportExport(reportTitle: string, contentId: string = "report-content") {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Yazdır
  const handlePrint = () => {
    try {
      const targetEl = document.getElementById(contentId);
      if (!targetEl) return;
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid !important; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
    h2 { font-size: 12px; margin: 8px 0 6px 0; page-break-after: avoid !important; page-break-before: auto; }
    div { margin-bottom: 10px; }
    /* Bölümlerin sayfa kırılmasını önle - önemli */
    .report-section { 
      page-break-inside: avoid !important; 
      break-inside: avoid !important;
      orphans: 3;
      widows: 3;
    }
    /* Son bölümün tekrarlanmasını önle */
    .report-section-last { 
      page-break-after: auto !important; 
      break-after: auto !important;
    }
    /* Başlıkların sayfa kırılmasını önle */
    .report-section-title {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    /* Tabloların bölünmesini önle */
    table {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Tablo satırlarının bölünmesini önle */
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    button { display: none !important; }
  </style>
</head>
<body>${targetEl.outerHTML}</body>
</html>`;
      
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      
      doc.open();
      doc.write(html);
      doc.close();
      
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {}
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 400);
      };
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  // Word indirme
  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      const filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
      await downloadWordDocument(reportTitle, contentId, filename);
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme
  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      await downloadPdfFromDOM(reportTitle, contentId);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setPdfBusy(false);
    }
  };

  return {
    wordBusy,
    pdfBusy,
    handlePrint,
    handleDownloadWord,
    handleDownloadPDF,
  };
}
