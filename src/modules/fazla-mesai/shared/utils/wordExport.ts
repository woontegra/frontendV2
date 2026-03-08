/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

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
    
    const html = container.outerHTML;
    
    // Word belgesi için gerekli XML namespace ve section properties
    // A4 sayfa boyutu (210mm x 297mm = 11906 x 16838 twips)
    // Portrait orientation, standart kenar boşlukları
    const wordDocument = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
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
    @page Section1 {
      size: 210mm 297mm; /* A4 */
      margin: 2.54cm 2.54cm 2.54cm 2.54cm; /* 1 inch margins */
      mso-page-orientation: portrait;
    }
    div.Section1 { page: Section1; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid black; padding: 4px; }
  </style>
</head>
<body>
  <div class="Section1">
    ${html}
  </div>
</body>
</html>`;
    
    // .doc formatını kullan (Word 97-2003 uyumlu)
    const blob = new Blob(['\ufeff', wordDocument], { 
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
