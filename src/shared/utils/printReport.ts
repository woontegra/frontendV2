/**
 * Merkezi yazdırma utility'si
 * Footer ve modal için ortak yazdırma fonksiyonu
 */

import { formatForPrint, createReportDataFromDOM } from './reportFormatter';

export interface PrintOptions {
  title: string;
  containerId?: string; // DOM element ID (ör: 'report-modal-content', 'calc-table')
  copyTargetId?: string; // Alternatif element ID
  sectionSelectors?: string[]; // Belirli section'ları seçmek için
}

/**
 * Merkezi yazdırma fonksiyonu
 * Footer ve modal için aynı sonucu üretir
 */
export function printReport(options: PrintOptions): void {
  try {
    const { title, containerId, copyTargetId, sectionSelectors } = options;

    // Önce copyTargetId'yi container içinde ara (eğer containerId varsa)
    let source: string | null = null;
    
    if (containerId && copyTargetId) {
      const container = document.getElementById(containerId);
      if (container) {
        const targetEl = container.querySelector(`#${copyTargetId}`);
        if (targetEl) {
          source = (targetEl as HTMLElement).outerHTML;
        }
      }
    }
    
    // Eğer bulunamadıysa, copyTargetId'yi doğrudan ara
    if (!source && copyTargetId) {
      const targetEl = document.getElementById(copyTargetId);
      source = targetEl ? targetEl.outerHTML : null;
    }

    // Eğer hala bulunamazsa, containerId'nin innerHTML'ini al
    if (!source && containerId) {
      const container = document.getElementById(containerId);
      source = container ? container.innerHTML : null;
    }

    // Eğer hala bulunamazsa, alternatif ID'leri dene
    if (!source) {
      const rapor = document.getElementById('rapor-icerik');
      const modalWrap = document.getElementById('report-modal-content');
      source = rapor?.outerHTML || modalWrap?.outerHTML || '';
    }

    if (!source) {
      console.error('Yazdırma için içerik bulunamadı', { containerId, copyTargetId });
      return;
    }

    // ReportData oluştur
    // Eğer copyTargetId ile içerik bulunduysa, direkt kullan
    // Aksi takdirde createReportDataFromDOM kullan
    let reportData: any;
    if (copyTargetId && source) {
      // copyTargetId ile bulunan içeriği direkt kullan
      reportData = {
        title,
        sections: [
          {
            type: 'table',
            html: source,
          },
        ],
      };
    } else if (containerId) {
      // createReportDataFromDOM kullan
      reportData = createReportDataFromDOM(title, containerId, sectionSelectors);
      // Eğer section'lar boşsa, source'u kullan
      if (reportData.sections.length === 0 && source) {
        reportData = {
          title,
          sections: [
            {
              type: 'table',
              html: source,
            },
          ],
        };
      }
    } else {
      // Fallback
      reportData = {
        title,
        sections: [
          {
            type: 'table',
            html: source,
          },
        ],
      };
    }

    // HTML formatı oluştur
    const html = formatForPrint(reportData);

    // Iframe ile yazdır
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    // Iframe yazdırma dialog'u için gerekli, pointer-events'i kaldırmayalım
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
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
      } catch (error) {
        console.error('Yazdırma hatası:', error);
      }
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  } catch (error) {
    console.error('Yazdırma işlemi başarısız:', error);
  }
}

/**
 * Modal içeriğinden yazdır (ReportPreviewButton için)
 */
export function printFromModal(title: string, copyTargetId?: string): void {
  printReport({
    title,
    copyTargetId,
    containerId: 'report-modal-content',
  });
}

/**
 * Footer'dan yazdır (sayfa içeriğinden)
 * Modal ile aynı içeriği yazdırmak için copyTargetId de kullanılabilir
 */
export function printFromFooter(title: string, copyTargetId?: string, containerId?: string): void {
  printReport({
    title,
    copyTargetId,
    containerId: containerId || 'report-modal-content',
  });
}
