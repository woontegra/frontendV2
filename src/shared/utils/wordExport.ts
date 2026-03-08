/**
 * Merkezi Word Export Utility
 * Tüm sayfalarda aynı format ve davranış için kullanılır
 */

import { formatForWord, createReportDataFromDOM } from './reportFormatter';

/**
 * html-docx-js kütüphanesini yükler
 */
async function ensureDocxLibrary(): Promise<void> {
  // @ts-ignore
  if ((window as any).htmlDocx && (window as any).htmlDocx.asBlob) return;
  
  const load = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('html-docx-js load failed: ' + src));
      document.body.appendChild(s);
    });
  
  try {
    await load('https://cdn.jsdelivr.net/npm/html-docx-js@0.4.1/dist/html-docx.js');
  } catch {
    await load('https://unpkg.com/html-docx-js@0.4.1/dist/html-docx.js');
  }
}

/**
 * Word belgesi indir
 * @param title Belge başlığı
 * @param containerId İçeriğin bulunduğu element ID'si
 * @param fileName İndirilecek dosya adı (opsiyonel)
 */
export async function downloadWordDocument(
  title: string,
  containerId: string,
  fileName?: string
): Promise<void> {
  const dt = new Date().toISOString().slice(0, 10);
  const defaultFileName = fileName || `${title.replace(/\s+/g, '_')}_${dt}`;
  
  try {
    // Element kontrolü
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Word export: Element bulunamadı: ${containerId}`);
    }
    
    // Merkezi formatlama utility'sini kullan
    const reportData = createReportDataFromDOM(title, containerId);
    
    if (!reportData.sections || reportData.sections.length === 0) {
      throw new Error('Word export: İçerik bulunamadı');
    }
    
    const html = formatForWord(reportData);
    
    // İlk önce basit .doc formatını dene (daha güvenilir)
    console.log('Word export: Basit .doc formatı kullanılıyor...');
    const blob = new Blob(['\ufeff', html], { 
      type: 'application/msword;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${defaultFileName}.doc`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error('Word export error:', error);
    
    // Son çare: Düz metin olarak indir
    try {
      const container = document.getElementById(containerId);
      if (container) {
        const textContent = container.innerText || container.textContent || '';
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${defaultFileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.warn('Word export: Düz metin olarak indirildi (.txt)');
      }
    } catch (finalError) {
      console.error('Word export final fallback error:', finalError);
      throw error; // Orijinal hatayı fırlat
    }
  }
}

/**
 * Direkt HTML string'den Word belgesi indir
 * @param title Belge başlığı
 * @param htmlContent HTML içerik
 * @param fileName İndirilecek dosya adı (opsiyonel)
 */
export async function downloadWordFromHTML(
  title: string,
  htmlContent: string,
  fileName?: string
): Promise<void> {
  const dt = new Date().toISOString().slice(0, 10);
  const defaultFileName = fileName || `${title.replace(/\s+/g, '_')}_${dt}`;
  
  try {
    // HTML'i ReportData formatına çevir
    const reportData = {
      title,
      sections: [
        {
          type: 'table' as const,
          html: htmlContent,
        },
      ],
    };
    
    const html = formatForWord(reportData);
    
    // Basit .doc formatını kullan
    const blob = new Blob(['\ufeff', html], { 
      type: 'application/msword;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${defaultFileName}.doc`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error('Word export error:', error);
    throw error;
  }
}
