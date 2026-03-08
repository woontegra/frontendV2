import React, { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { printFromModal } from "@/utils/printReport";
import ExportButtons from "./ExportButtons";
import { downloadWordDocument } from "@/utils/wordExport";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { copyTableForWord } from "@/utils/copyTableForWord";

type Props = {
  title: string;
  renderContent: () => ReactNode;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties; // Buton için özel stil
  copyTargetId?: string; // element id whose outerHTML will be copied
  onPdf?: () => Promise<void> | void; // Backend PDF generation callback
  hideWordDownload?: boolean; // Word indir butonunu gizle
  onButtonClick?: () => void; // Özel buton tıklama callback'i (modal açma yerine kullanılır)
  hideButton?: boolean; // Butonu gizle
  autoOpen?: boolean; // Modal'ı otomatik aç
  /** Mobil: ikon üstte, etiket altta küçük buton */
  compact?: boolean;
};

export default function ReportPreviewButton({ title, renderContent, buttonClassName, buttonStyle, copyTargetId, onPdf, onButtonClick, hideButton, autoOpen, hideWordDownload, compact }: Props) {
  const [open, setOpen] = useState(autoOpen || false);
  const [wordBusy, setWordBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const raporRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // autoOpen prop'u değiştiğinde modal'ı aç/kapat
  useEffect(() => {
    if (autoOpen) {
      // Verilerin render edilmesi için kısa bir gecikme
      const timeout = setTimeout(() => {
        setOpen(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [autoOpen]);
  
  // Eğer renderContent null ise modal açma özelliğini devre dışı bırak
  const hasContent = renderContent && typeof renderContent === 'function';
  
  // Buton tıklama handler'ı
  const handleButtonClick = () => {
    if (onButtonClick) {
      // Özel callback varsa onu çağır (modal açma yerine)
      onButtonClick();
    } else {
      // Yoksa normal modal açma davranışı
      setOpen(true);
    }
  };
  const handlePrint = () => {
    // Merkezi yazdırma utility'sini kullan
    printFromModal(title, copyTargetId);
  };

  const handleDownloadWord = async () => {
    try {
      setWordBusy(true);
      const containerId = copyTargetId || 'report-modal-content';
      await downloadWordDocument(title, containerId);
    } catch (error) {
      console.error('Word export error:', error);
    } finally {
      setWordBusy(false);
    }
  };

  const handleCopyForWord = async () => {
    const containerId = copyTargetId || "report-modal-content";
    await copyTableForWord(containerId);
  };

  const handleDownloadPDF = async () => {
    try {
      setPdfBusy(true);
      
      // Eğer onPdf callback'i varsa, backend PDF generation'ı kullan
      if (onPdf) {
        await onPdf();
        return;
      }
      
      // Frontend PDF generation - Merkezi utility kullan
      const containerId = copyTargetId || 'report-modal-content';
      await downloadPdfFromDOM(title, containerId);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') {
        setOpen(false);
        if (onButtonClick) onButtonClick();
      }
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onButtonClick]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  // Dragging logic
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Reset position when modal opens
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
      setIsMinimized(false);
      setIsMaximized(false);
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Sadece başlık çubuğundan sürüklenebilir
    if ((e.target as HTMLElement).closest('.export-buttons')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (!isMaximized) {
      setPosition({ x: 0, y: 0 }); // Maximize olunca ortala
    }
  };

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          className={buttonClassName || "bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap"}
          style={buttonStyle}
          onClick={handleButtonClick}
        >
          {compact ? (
            <>
              <span className="text-base leading-none">🧾</span>
              <span className="text-[10px] font-medium leading-tight">Önizleme</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">🧾 Önizleme</span>
              <span className="sm:hidden">🧾 Önizleme</span>
            </>
          )}
        </button>
      )}
      {open && hasContent && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/40" role="dialog" aria-modal="true">
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 border-2 border-gray-300 dark:border-gray-600 overflow-hidden"
            style={{
              position: 'fixed',
              top: isMaximized ? '0' : '50%',
              left: isMaximized ? '0' : '50%',
              transform: isMaximized 
                ? 'none' 
                : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
              width: isMaximized ? '100vw' : 'min(900px, 95vw)',
              height: isMaximized ? '100vh' : (isMinimized ? 'auto' : 'auto'),
              maxHeight: isMaximized ? '100vh' : '90vh',
              cursor: isDragging ? 'grabbing' : 'default',
              transition: isDragging ? 'none' : 'all 0.2s ease',
              resize: isMaximized ? 'none' : 'both',
              minWidth: '400px',
              minHeight: '300px',
            }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div 
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 dark:border-gray-600 px-4 py-3 sm:py-2.5 bg-white dark:bg-gray-800 select-none"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{title || ''}</div>
                <div className="flex gap-0.5 ml-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition text-xs"
                    title={isMinimized ? "Genişlet" : "Küçült"}
                  >
                    {isMinimized ? '🔼' : '🔽'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition text-xs"
                    title={isMaximized ? "Küçült" : "Tam Ekran"}
                  >
                    {isMaximized ? '🗗' : '🗖'}
                  </button>
                </div>
              </div>
              <div className="export-buttons w-full sm:w-auto">
                <ExportButtons
                  onPrint={handlePrint}
                  onCopyForWord={handleCopyForWord}
                  onWord={hideWordDownload ? undefined : handleDownloadWord}
                  onPdf={async () => {
                    try {
                      await handleDownloadPDF();
                    } catch (err) {
                      console.error("PDF generation error:", err);
                    }
                  }}
                  onClose={() => {
                    setOpen(false);
                    if (onButtonClick) {
                      setTimeout(() => onButtonClick(), 100);
                    }
                  }}
                  wordBusy={wordBusy}
                  pdfBusy={pdfBusy}
                />
              </div>
            </div>
            {!isMinimized && hasContent && (
              <div className="p-5 text-sm overflow-auto bg-gray-50/50 dark:bg-gray-900/30" style={{ maxHeight: isMaximized ? 'calc(100vh - 56px)' : '80vh' }}>
                <div id="report-modal-content" ref={raporRef as any} className="report-preview-content">
                  {renderContent()}
                </div>
              </div>
            )}
            
            {!isMaximized && !isMinimized && (
              <div
                className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize rounded-br-xl bg-gray-200/60 dark:bg-gray-600/40 hover:bg-gray-300/60 dark:hover:bg-gray-500/40 transition-colors"
                title="Boyutlandırmak için sürükleyin"
              />
            )}
          </div>
        </div>, document.body)
      }
    </>
  );
}
