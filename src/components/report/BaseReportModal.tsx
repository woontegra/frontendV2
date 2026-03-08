import React, { useEffect, useRef } from "react";
import DraggableModal from "@/components/DraggableModal";
import { ReportTable, BrutNetTable, MahsuplasmaTable } from "@/components/reports/BaseReportLayout";
import { useReportExport } from "./useReportExport";

// Config tipi
export interface ReportConfig {
  title: string;
  sections?: {
    info?: boolean;
    periodTable?: boolean;
    grossToNet?: boolean;
    mahsuplasma?: boolean;
  };
  infoRows?: Array<{
    label: string;
    value: string | React.ReactNode;
    condition?: boolean; // Opsiyonel render kontrolü
  }>;
  customSections?: Array<{
    title?: string;
    content: React.ReactNode;
    condition?: boolean;
  }>;
  periodData?: {
    title?: string;
    headers: string[];
    rows: string[][];
    footer?: string[];
    alignRight?: number[];
    /** Word'de sayfa içinde sığması için sütun genişlikleri (örn. ['22%','10%',...]) */
    columnWidths?: string[];
    /** Tablo font boyutu (örn. '10px' - diğer bölümlerle uyum için) */
    fontSize?: string;
  };
  grossToNetData?: {
    title?: string;
    rows: Array<{
      label: string;
      value: string;
      isDeduction?: boolean;
      isNet?: boolean;
    }>;
  };
  mahsuplasmaData?: {
    title?: string;
    rows: Array<{
      label: string;
      value: string;
      isDeduction?: boolean;
    }>;
    netRow: {
      label: string;
      value: string;
    };
  };
}

interface BaseReportModalProps {
  open: boolean;
  onClose: () => void;
  config: ReportConfig;
  /** Footer Yazdır'dan açıldığında modal açılır açılmaz yazdırma dialog'unu tetikler (modal ile aynı çıktı) */
  printOnOpen?: boolean;
}

/** Modal dışında (örn. footer yazdır) aynı rapor içeriğini render etmek için kullanılır */
const REPORT_FONT_SIZE = '9px';
const REPORT_SECTION_TITLE_SIZE = '9px';

export function ReportContentFromConfig({ config }: { config: ReportConfig }) {
  const sections = config.sections || {};
  return (
    <div style={{ maxWidth: '16cm', width: '100%', margin: '0 auto', fontSize: REPORT_FONT_SIZE, textAlign: 'center' }}>
      <table
        id="report-content"
        style={{
          fontFamily: 'Inter, Arial, sans-serif',
          color: '#111827',
          fontSize: REPORT_FONT_SIZE,
          width: '16cm',
          maxWidth: '100%',
          borderCollapse: 'collapse',
          display: 'inline-table',
        }}
      >
        <tbody>
          <tr>
            <td style={{ paddingBottom: '12px', textAlign: 'right', fontSize: REPORT_FONT_SIZE, color: '#6b7280', border: 'none' }}>
              Tarih: {new Date().toLocaleDateString("tr-TR")}
            </td>
          </tr>
          {sections.info !== false && config.infoRows && config.infoRows.length > 0 && (
            <tr>
              <td style={{ paddingBottom: '14px', border: 'none', verticalAlign: 'top', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', width: '100%', maxWidth: '16cm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: REPORT_FONT_SIZE }}>
                  <tbody>
                    {config.infoRows
                      .filter(row => row.condition !== false)
                      .map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #999', padding: '5px 8px', backgroundColor: '#f9fafb', fontWeight: 600, width: '30%' }}>
                            {row.label}
                          </td>
                          <td style={{ border: '1px solid #999', padding: '5px 8px' }}>
                            {row.value || "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                </div>
              </td>
            </tr>
          )}
          {config.customSections?.filter(section => section.condition !== false).map((section, idx) => (
            <React.Fragment key={idx}>
              {section.title && (
                <tr>
                  <td style={{ paddingBottom: '4px', borderBottom: '1px solid #e5e7eb', fontSize: REPORT_SECTION_TITLE_SIZE, fontWeight: 700, border: 'none' }}>
                    {section.title}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ paddingBottom: '14px', border: 'none', verticalAlign: 'top', textAlign: 'left' }}>
                  <div style={{ display: 'block', width: '100%', maxWidth: '16cm', minWidth: 0, overflowWrap: 'break-word' }}>
                  {section.content}
                  </div>
                </td>
              </tr>
            </React.Fragment>
          ))}
          {sections.periodTable !== false && config.periodData && (
            <>
              {config.periodData.title && (
                <tr>
                  <td style={{ paddingBottom: '4px', borderBottom: '1px solid #e5e7eb', fontSize: REPORT_SECTION_TITLE_SIZE, fontWeight: 700, border: 'none' }}>
                    {config.periodData.title}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ paddingBottom: '14px', border: 'none', verticalAlign: 'top', textAlign: 'center' }}>
                  <div style={{ display: 'inline-block', width: '100%', maxWidth: '16cm' }}>
                  <ReportTable
                    headers={config.periodData.headers}
                    rows={config.periodData.rows}
                    footer={config.periodData.footer}
                    alignRight={config.periodData.alignRight}
                    columnWidths={config.periodData.columnWidths}
                    fontSize={config.periodData.fontSize || REPORT_FONT_SIZE}
                  />
                  </div>
                </td>
              </tr>
            </>
          )}
          {sections.grossToNet !== false && config.grossToNetData && (
            <>
              <tr>
                <td style={{ paddingBottom: '4px', borderBottom: '1px solid #e5e7eb', fontSize: REPORT_SECTION_TITLE_SIZE, fontWeight: 700, border: 'none' }}>
                  {config.grossToNetData.title || "Brüt'ten Net'e Çeviri"}
                </td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '14px', border: 'none', verticalAlign: 'top', textAlign: 'center' }}>
                  <div style={{ display: 'inline-block', width: '100%', maxWidth: '16cm' }}>
                  <BrutNetTable rows={config.grossToNetData.rows} fontSize={REPORT_FONT_SIZE} />
                  </div>
                </td>
              </tr>
            </>
          )}
          {sections.mahsuplasma !== false && config.mahsuplasmaData && (
            <>
              <tr>
                <td style={{ paddingBottom: '4px', borderBottom: '1px solid #e5e7eb', fontSize: REPORT_SECTION_TITLE_SIZE, fontWeight: 700, border: 'none' }}>
                  {config.mahsuplasmaData.title || "Mahsuplaşma"}
                </td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '14px', border: 'none', verticalAlign: 'top', textAlign: 'center' }}>
                  <div style={{ display: 'inline-block', width: '100%', maxWidth: '16cm' }}>
                  <MahsuplasmaTable
                    rows={config.mahsuplasmaData.rows}
                    netRow={config.mahsuplasmaData.netRow}
                    fontSize={REPORT_FONT_SIZE}
                  />
                  </div>
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function BaseReportModal({ open, onClose, config, printOnOpen }: BaseReportModalProps) {
  const { wordBusy, pdfBusy, handlePrint, handleDownloadWord, handleDownloadPDF } = useReportExport(config.title);
  const printedOnOpenRef = useRef(false);

  useEffect(() => {
    if (open && printOnOpen && !printedOnOpenRef.current) {
      printedOnOpenRef.current = true;
      const t = setTimeout(() => {
        handlePrint();
      }, 150);
      return () => clearTimeout(t);
    }
    if (!open) {
      printedOnOpenRef.current = false;
    }
  }, [open, printOnOpen, handlePrint]);

  if (!open) return null;

  return (
    <DraggableModal
      open={open}
      onClose={onClose}
      title={`${config.title} – Rapor Görünümü`}
      headerActions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handlePrint}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1f2937',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Yazdır"
          >
            🖨️ Yazdır
          </button>
          <button
            onClick={handleDownloadWord}
            disabled={wordBusy}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1e40af',
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              cursor: wordBusy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: wordBusy ? 0.6 : 1,
            }}
            title="Word İndir"
          >
            📄 {wordBusy ? 'İndiriliyor...' : 'Word'}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfBusy}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#991b1b',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              cursor: pdfBusy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: pdfBusy ? 0.6 : 1,
            }}
            title="PDF İndir"
          >
            📕 {pdfBusy ? 'İndiriliyor...' : 'PDF'}
          </button>
        </div>
      }
    >
      {/* Haftalık ile birebir aynı: 16cm – Tüm raporlar aynı (dönemsel + kıdem). Word’de sayfa dışına taşmaz. */}
      <ReportContentFromConfig config={config} />
    </DraggableModal>
  );
}
