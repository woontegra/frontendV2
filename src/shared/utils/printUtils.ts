/**
 * Global yazdırma utility fonksiyonları
 * Tüm sayfalarda tutarlı yazdırma deneyimi sağlar
 */

interface PrintOptions {
  title?: string;
  heading?: string;
  contentId?: string;
  excludeElements?: string[]; // Yazdırmadan hariç tutulacak selector'lar
}

/**
 * Sayfa içeriğini yeni bir pencerede yazdırır
 * @param options Yazdırma seçenekleri
 */
export function printPageContent(options: PrintOptions = {}) {
  const {
    title = document.title,
    heading = title,
    contentId,
    excludeElements = [
      '.no-print',
      'button',
      '[class*="sidebar"]',
      'nav',
      'header:not(.print-include)',
      'footer',
      '.print-button',
      '[class*="FooterActions"]',
    ],
  } = options;

  // İçeriği al
  let printContent: HTMLElement | null = null;
  
  if (contentId) {
    printContent = document.getElementById(contentId);
  } else {
    // main element'ini al veya body'yi kullan
    printContent = document.querySelector('main') || document.body;
  }

  if (!printContent) {
    console.error('Yazdırılacak içerik bulunamadı');
    return;
  }

  // İçeriği klonla (orijinali bozmamak için)
  const contentClone = printContent.cloneNode(true) as HTMLElement;

  // Hariç tutulacak elementleri kaldır
  excludeElements.forEach(selector => {
    const elements = contentClone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Yeni pencere aç
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up engelleyici nedeniyle yazdırma penceresi açılamadı. Lütfen pop-up engelleyiciyi devre dışı bırakın.');
    return;
  }

  // HTML içeriği oluştur
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>
          /* Yazdırma için özel stiller */
          @media print {
            @page {
              size: A4;
              margin: 1.5cm 1cm;
            }

            body {
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .no-print,
            button,
            .print-button {
              display: none !important;
            }

            /* Sayfa break kontrol */
            .print-avoid-break,
            table,
            .card,
            h1, h2, h3 {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            /* Table stilleri */
            table {
              width: 100%;
              border-collapse: collapse;
            }

            table th,
            table td {
              border: 1px solid #e5e7eb;
              padding: 8px;
              font-size: 10pt;
            }

            table th {
              background-color: #f3f4f6 !important;
              font-weight: 600;
            }
          }

          /* Genel stiller (hem ekran hem yazdırma) */
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: white;
            color: #111827;
            font-size: 12pt;
            line-height: 1.5;
            padding: 20px;
          }

          .print-heading {
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 20px;
            color: #1e3a8a;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 10px;
          }

          /* Card stilleri */
          .card, [class*="Card"] {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            box-shadow: none;
          }

          /* Table responsive */
          table {
            width: 100%;
            margin: 16px 0;
          }

          /* Input ve form elementlerini gizle */
          input, select, textarea, button {
            border: none;
            background: transparent;
            font-size: inherit;
            font-family: inherit;
          }

          input[type="date"],
          input[type="text"],
          input[type="number"] {
            appearance: none;
            -webkit-appearance: none;
          }

          /* Dark mode renklerini override et */
          * {
            color: #111827 !important;
            background: white !important;
          }

          table th {
            background: #f3f4f6 !important;
          }

          /* Değerler ve sonuçlar için vurgu */
          .font-bold,
          .font-semibold {
            font-weight: 600;
            color: #1e3a8a !important;
          }
        </style>
      </head>
      <body>
        <div class="print-heading">${heading}</div>
        <div class="print-content">
          ${contentClone.innerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
            
            // Yazdırma tamamlandığında veya iptal edildiğinde pencereyi kapat
            window.onafterprint = function() {
              setTimeout(function() {
                window.close();
              }, 100);
            };
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Belirli bir elementi yazdırır
 * @param elementId Yazdırılacak elementin ID'si
 * @param title Yazdırma başlığı
 */
export function printElement(elementId: string, title?: string, heading?: string) {
  printPageContent({
    title,
    heading,
    contentId: elementId,
  });
}

/**
 * Rapor modal'ı için optimize edilmiş yazdırma fonksiyonu
 * Sadece belirli bir element'i iframe ile yazdırır (daha temiz sonuç)
 * @param contentId Yazdırılacak içeriğin ID'si
 * @param title Sayfa başlığı
 * @param heading Rapor başlığı
 */
export function printReportContent(contentId: string, title: string = "Rapor", heading: string = "Rapor Görünümü") {
  try {
    const targetEl = document.getElementById(contentId);
    if (!targetEl) {
      console.error(`Element bulunamadı: ${contentId}`);
      return;
    }

    const source = targetEl.outerHTML;
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page { 
              size: A4 portrait; 
              margin: 15mm; 
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Inter, Arial, sans-serif; 
              color: #111827; 
              padding: 0;
              margin: 0;
              background: white;
            }
            .print-title {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .print-sub {
              font-size: 12px;
              color: #374151;
              margin-bottom: 6px;
            }
            table {
              width: 100%; 
              border-collapse: collapse;
            }
            thead {
              background: #f3f4f6;
            }
            th, td {
              border: 1px solid #999; 
              padding: 6px; 
              font-size: 12px;
            }
            th {
              text-align: left;
              font-weight: 600;
            }
            td {
              text-align: right;
            }
            /* Dark mode ve gereksiz elementleri temizle */
            .no-print,
            button,
            .lucide,
            svg {
              display: none !important;
            }
            /* Sayfa break kontrolü */
            table, .card, h1, h2, h3 {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="print-title">${heading}</div>
          ${source}
        </body>
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
    if (!doc) {
      console.error("Iframe document bulunamadı");
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Yazdırma hatası:", e);
      }
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  } catch (error) {
    console.error("printReportContent hatası:", error);
  }
}

