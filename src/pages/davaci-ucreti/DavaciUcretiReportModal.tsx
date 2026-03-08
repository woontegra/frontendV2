import React, { useState } from "react";
import { parseNum, fmtCurrency } from "./calculations";
import type { ExtraItem } from "./contract";

interface ExtraItem {
  id: string;
  name: string;
  value: string;
}

interface DavaciUcretiReportModalProps {
  open: boolean;
  onClose: () => void;
  ciplakBrut: string;
  extraItems: ExtraItem[];
  totalBrut: number;
  netFromGross: {
    gross: number;
    sgk: number;
    issizlik: number;
    gelirVergisi: number;
    gelirVergisiDilimleri: string;
    damgaVergisi: number;
    net: number;
  };
  selectedYear: number;
  notes?: string;
}

const fmt = (n: number) => fmtCurrency(n);

export default function DavaciUcretiReportModal({
  open,
  onClose,
  ciplakBrut,
  extraItems,
  totalBrut,
  netFromGross,
  selectedYear,
  notes = "",
}: DavaciUcretiReportModalProps) {
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Yazdır
  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Davacı Ücreti</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { text-align: left; }
    h2 { font-size: 12px; margin: 8px 0 6px 0; page-break-after: avoid; }
    div { margin-bottom: 10px; }
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

  // Word indirme - Basit implementasyon
  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      const content = document.getElementById("report-content");
      if (!content) return;
      
      // Word için özel XML başlığı (Sayfa Düzeni görünümü için)
      const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>Davacı Ücreti</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: 'Times New Roman', serif; color: #000; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11pt; }
  h2 { font-size: 14pt; margin: 12px 0 8px 0; font-weight: bold; }
</style>
</head>
<body>`;
      const postHtml = "</body></html>";

      // İçeriği al ve stil düzenlemeleri yap (Word uyumluluğu için)
      // Not: innerHTML zaten style attribute'ları içeriyor olabilir, ancak yukarıdaki global style'lar da yardımcı olur.
      const htmlContent = preHtml + content.innerHTML + postHtml;

      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Davaci_Ucreti_${new Date().toISOString().slice(0, 10)}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  // PDF indirme - Basit implementasyon
  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      handlePrint();
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setPdfBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Davacı Ücreti – Rapor Görünümü</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Yazdır"
            >
              🖨️ Yazdır
            </button>
            <button
              onClick={handleDownloadWord}
              disabled={wordBusy}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50"
              title="Word İndir"
            >
              📄 {wordBusy ? 'İndiriliyor...' : 'Word'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfBusy}
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
              title="PDF İndir"
            >
              📕 {pdfBusy ? 'İndiriliyor...' : 'PDF'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl ml-2"
            >
              ×
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6">
      <div id="report-content" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
        {/* Rapor Tarihi ve Hesaplama Yılı */}
        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
            Hesaplama Yılı: {selectedYear}
          </p>
          <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
            Tarih: {new Date().toLocaleDateString("tr-TR")}
          </p>
        </div>

        {/* Çıplak Brüt ve Ekstra Kalemler */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
            Ücret Bileşenleri
          </h2>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #999',
            fontSize: '10px',
          }}>
            <tbody>
              <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>
                  Çıplak Brüt Ücret
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                  {fmt(parseNum(ciplakBrut))}₺
                </td>
              </tr>
              {extraItems.filter(item => parseNum(item.value) > 0).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                    {item.name || `Ek Kalem ${idx + 1}`}
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                    {fmt(parseNum(item.value))}₺
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#dbeafe', fontWeight: 600 }}>
                <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                  Giydirilmiş Brüt Ücret
                </td>
                <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                  {fmt(totalBrut)}₺
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Brüt'ten Net'e Çeviri */}
        {netFromGross && netFromGross.gross > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Brüt'ten Net'e Çeviri
            </h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #999',
              fontSize: '10px',
            }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmt(netFromGross.gross)}₺</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>SGK Primi (%14)</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(netFromGross.sgk)}₺</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>İşsizlik Primi (%1)</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(netFromGross.issizlik)}₺</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(netFromGross.gelirVergisi)}₺</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Damga Vergisi (binde 7,59)</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{fmt(netFromGross.damgaVergisi)}₺</td>
                </tr>
                <tr style={{ backgroundColor: '#dcfce7', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Net Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right', color: '#16a34a' }}>{fmt(netFromGross.net)}₺</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notlar */}
        {notes && notes.trim() !== "" && (
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
              Notlar
            </h2>
            <div style={{ fontSize: '10px', color: '#374151', whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb', padding: '8px', backgroundColor: '#f9fafb' }}>
              {notes}
            </div>
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}
