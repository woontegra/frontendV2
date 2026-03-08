import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCallback } from "react";
import MobileActionBar from "./MobileActionBar";
import DesktopActionBar from "./DesktopActionBar";

type FooterActionsProps = {
  /** Sol tarafta gösterilecek içerik (örn. 270 Saat Düşüm, Zamanaşımı, Kat Sayı butonları) */
  leftContent?: ReactNode;
  onPrint?: () => void;
  onSave?: () => void;
  printLabel?: string;
  saveLabel?: string;
  printButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  /** Yazdır butonu yerine gösterilecek buton (örn. Yeni Hesapla). Verilirse Yazdır gösterilmez. */
  replacePrintWith?: { label: string; onClick: () => void };
  previewButton?: {
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    buttonClassName?: string; // Yoksayılır - desktop tek tip stil kullanır
    onPdf?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
    onButtonClick?: () => void;
    autoOpen?: boolean;
    hideWordDownload?: boolean;
  };
};

export default function FooterActions({
  leftContent,
  onPrint,
  onSave,
  printLabel = "Yazdır",
  saveLabel = "Kaydet",
  printButtonProps,
  saveButtonProps,
  replacePrintWith,
  previewButton,
}: FooterActionsProps) {
  if (!leftContent && !onPrint && !onSave && !previewButton && !replacePrintWith) return null;

  const hasMobileActions = previewButton || onSave;

  // Merkezi yazdırma fonksiyonu - Yazdır butonu her zaman doğrudan yazdırma (onPrint) kullanır
  const handlePrint = useCallback(() => {
    // Sayfa onPrint veriyorsa her zaman doğrudan yazdır (sayfa #kidem-print vb. ile window.print() yapar)
    if (onPrint) {
      onPrint();
      return;
    }
    // onPrint yoksa, previewButton içeriğini kullanarak yazdır (geriye dönük uyumluluk)
    if (previewButton && previewButton.renderContent) {
      // renderContent'in null döndürüp döndürmediğini kontrol et
      const content = previewButton.renderContent();
      if (content === null || content === undefined) {
        // renderContent null döndürüyorsa, onPrint prop'unu kullan
        if (onPrint) {
          onPrint();
        }
        return;
      }
      try {
        // Modal içeriğini geçici olarak DOM'a ekle
        const tempContainer = document.createElement('div');
        const uniqueId = 'temp-print-container-' + Date.now();
        tempContainer.id = uniqueId;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-10000px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '900px';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.pointerEvents = 'none';
        tempContainer.style.zIndex = '-1';
        document.body.appendChild(tempContainer);
        
        // React render için import
        import('react-dom/client').then(({ createRoot }) => {
          const root = createRoot(tempContainer);
          const content = previewButton.renderContent();
          root.render(content as any);
          
          let cleanupDone = false;
          let observerRef: MutationObserver | null = null;
          let timeoutId: NodeJS.Timeout | null = null;
          
          const cleanup = () => {
            if (cleanupDone) return;
            cleanupDone = true;
            try {
              if (observerRef) {
                observerRef.disconnect();
                observerRef = null;
              }
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              root.unmount();
              if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
              }
            } catch (e) {
              console.error('Cleanup error:', e);
            }
          };
          
          const checkAndPrint = () => {
            const targetEl = tempContainer.querySelector(`#${previewButton.copyTargetId}`);
            if (targetEl && targetEl.innerHTML.trim().length > 100) {
              // İçerik hazır, içeriği al ve cleanup yap
              const contentHtml = targetEl.outerHTML;
              cleanup();
              
              // Yazdır
              setTimeout(() => {
                const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${previewButton.title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
    .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 16px; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { white-space: nowrap !important; text-align: left; }
  </style>
</head>
<body>
  <div class="print-title">${previewButton.title}</div>
  ${contentHtml}
</body>
</html>`;
                
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);
                
                const doc = iframe.contentWindow?.document;
                if (doc) {
                  doc.open();
                  doc.write(html);
                  doc.close();
                  iframe.onload = () => {
                    try {
                      iframe.contentWindow?.focus();
                      iframe.contentWindow?.print();
                    } catch (error) {
                      console.error('Yazdırma hatası:', error);
                    }
                    setTimeout(() => {
                      try {
                        document.body.removeChild(iframe);
                      } catch {}
                    }, 400);
                  };
                }
              }, 50);
              return true;
            }
            return false;
          };
          
          // İlk kontrol
          setTimeout(() => {
            if (checkAndPrint()) return;
          }, 100);
          
          // MutationObserver ile içeriğin render edilmesini bekle
          const observer = new MutationObserver(() => {
            if (checkAndPrint()) {
              // checkAndPrint içinde cleanup yapılıyor
            }
          });
          observerRef = observer;
          
          observer.observe(tempContainer, {
            childList: true,
            subtree: true,
            characterData: true
          });
          
          // Timeout fallback
          timeoutId = setTimeout(() => {
            if (cleanupDone) return;
            if (!checkAndPrint()) {
              console.warn('[Print] Timeout - forcing print with available content');
              cleanup();
              const targetEl = tempContainer.querySelector(`#${previewButton.copyTargetId}`);
              if (targetEl) {
                const contentHtml = targetEl.outerHTML;
                setTimeout(() => {
                  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${previewButton.title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
    .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 16px; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { white-space: nowrap !important; text-align: left; }
  </style>
</head>
<body>
  <div class="print-title">${previewButton.title}</div>
  ${contentHtml}
</body>
</html>`;
                  
                  const iframe = document.createElement('iframe');
                  iframe.style.position = 'fixed';
                  iframe.style.right = '0';
                  iframe.style.bottom = '0';
                  iframe.style.width = '0';
                  iframe.style.height = '0';
                  iframe.style.border = '0';
                  document.body.appendChild(iframe);
                  
                  const doc = iframe.contentWindow?.document;
                  if (doc) {
                    doc.open();
                    doc.write(html);
                    doc.close();
                    iframe.onload = () => {
                      try {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                      } catch (error) {
                        console.error('Yazdırma hatası:', error);
                      }
                      setTimeout(() => {
                        try {
                          document.body.removeChild(iframe);
                        } catch {}
                      }, 400);
                    };
                  }
                }, 50);
              }
            }
          }, 3000);
        }).catch((error) => {
          console.error('React render error:', error);
          if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
          }
        });
      } catch (error) {
        console.error('Print error:', error);
      }
    }
  }, [previewButton, onPrint]);

  return (
    <>
      {/* Mobil: Sadece Önizleme + Kaydet, tek tip footer */}
      {hasMobileActions && (
        <MobileActionBar
          previewButton={previewButton}
          onSave={onSave}
          saveLabel={saveLabel}
          saveButtonProps={saveButtonProps}
        />
      )}
      {/* Desktop: Tek tip footer - Önizleme, Yazdır, Kaydet, leftContent */}
      <DesktopActionBar
        leftContent={leftContent}
        onPrint={onPrint}
        onSave={onSave}
        printLabel={printLabel}
        saveLabel={saveLabel}
        printButtonProps={printButtonProps}
        saveButtonProps={saveButtonProps}
        replacePrintWith={replacePrintWith}
        previewButton={previewButton}
        onPrintClick={handlePrint}
      />
    </>
  );
}

