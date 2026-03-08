/**
 * Merkezi PDF Export Utility
 * Tüm sayfalarda aynı format ve davranış için kullanılır
 */

import { generateReport } from './pdf';

/**
 * html2canvas ve jsPDF kütüphanelerini yükler
 */
async function ensurePdfLibraries(): Promise<void> {
  const load = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('script load failed: ' + src));
      document.body.appendChild(s);
    });

  // @ts-ignore
  if (!(window as any).html2canvas) {
    await load('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
  }
  // @ts-ignore
  if (!((window as any).jspdf && (window as any).jspdf.jsPDF)) {
    await load('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  }
}

/**
 * Frontend PDF generation - DOM elementinden PDF oluştur
 * @param title Belge başlığı
 * @param containerId İçeriğin bulunduğu element ID'si
 * @param fileName İndirilecek dosya adı (opsiyonel)
 */
export async function downloadPdfFromDOM(
  title: string,
  containerId: string,
  fileName?: string
): Promise<void> {
  try {
    await new Promise((r) => setTimeout(r, 100));
    await ensurePdfLibraries();

    // Kaynak içeriği al
    const src = document.getElementById(containerId);
    if (!src) {
      throw new Error(`PDF generation: Content not found for ID: ${containerId}`);
    }

    // Container oluştur - Modal genişliği kadar
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.zIndex = '-1';
    container.style.background = '#ffffff';
    container.style.width = '850px'; // Modal genişliğine yakın
    container.style.padding = '20px';
    container.style.boxSizing = 'border-box';

    const clone = src.cloneNode(true) as HTMLElement;
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    container.appendChild(clone);
    document.body.appendChild(container);

    await new Promise((r) => setTimeout(r, 300));

    // @ts-ignore
    const h2c = (window as any).html2canvas;
    // @ts-ignore
    const jsPDF = (window as any).jspdf.jsPDF;

    const canvas = await h2c(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.scrollWidth,
      height: container.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / usableWidth;

    const pdfImgWidth = usableWidth;
    const pdfImgHeight = imgHeight / ratio;

    // Sayfalara böl
    let heightLeft = pdfImgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', margin, margin, pdfImgWidth, Math.min(pdfImgHeight, usableHeight));
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position + margin, pdfImgWidth, pdfImgHeight);
      heightLeft -= usableHeight;
    }

    const dt = new Date().toISOString().slice(0, 10);
    pdf.save(fileName || `${title.replace(/\s+/g, '_')}_${dt}.pdf`);

    document.body.removeChild(container);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}

/**
 * Backend PDF generation - Backend'e istek gönder ve PDF indir
 * @param type Hesaplama tipi (örn: "fazla_mesai_standart", "hafta_tatili_alacagi_standart")
 * @param form Form verileri
 * @param results Sonuç verileri (opsiyonel)
 * @param userId Kullanıcı ID (opsiyonel)
 */
export async function downloadPdfFromBackend(
  type: string,
  form: Record<string, any>,
  results?: Record<string, any> | number | null,
  userId?: number
): Promise<void> {
  try {
    await generateReport({
      type,
      form,
      results,
      userId,
    });
  } catch (error) {
    console.error('Backend PDF generation error:', error);
    throw error;
  }
}

/**
 * PDF indir - Otomatik olarak backend veya frontend seçer
 * @param title Belge başlığı
 * @param containerId İçeriğin bulunduğu element ID'si (frontend için)
 * @param backendConfig Backend PDF generation config (opsiyonel)
 * @param fileName İndirilecek dosya adı (opsiyonel)
 */
export async function downloadPdf(
  title: string,
  containerId: string,
  backendConfig?: {
    type: string;
    form: Record<string, any>;
    results?: Record<string, any> | number | null;
    userId?: number;
  },
  fileName?: string
): Promise<void> {
  // Eğer backend config varsa, backend PDF generation kullan
  if (backendConfig) {
    return downloadPdfFromBackend(
      backendConfig.type,
      backendConfig.form,
      backendConfig.results,
      backendConfig.userId
    );
  }

  // Yoksa frontend PDF generation kullan
  return downloadPdfFromDOM(title, containerId, fileName);
}
