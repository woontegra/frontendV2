/**
 * Merkezi rapor formatlama utility'leri
 * Word ve PDF için ortak HTML formatı oluşturur
 */

export interface ReportSection {
  title?: string;
  type: 'table' | 'text' | 'summary';
  data?: any;
  html?: string; // Direkt HTML içerik
}

export interface ReportData {
  title: string;
  sections: ReportSection[];
}

/**
 * Word için HTML formatı oluşturur
 */
export function formatForWord(data: ReportData): string {
  const sectionsHTML = data.sections
    .map(section => {
      if (section.html) {
        // HTML'i direkt kullan, inline style'ları koru
        return section.html;
      }
      if (section.type === 'table' && section.data) {
        return formatTableForWord(section.data, section.title);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="Microsoft Word" />
  <meta name="Originator" content="Microsoft Word" />
  <title>${data.title}</title>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 15mm 15mm 15mm 15mm; 
    }
    * { 
      box-sizing: border-box; 
    }
    body { 
      font-family: 'Inter', 'Arial', sans-serif; 
      color: #111827; 
      line-height: 1.1 !important;
      font-size: 13px;
      padding: 0;
      margin: 0;
      background: #ffffff;
    }
    /* Tablolar sayfa dışına taşmasın: 16cm ≈ A4 yazı alanı */
    table { 
      width: 100% !important; 
      max-width: 16cm !important;
      border-collapse: collapse; 
      margin-bottom: 8px;
      page-break-inside: avoid;
      table-layout: fixed;
    }
    /* Satır yüksekliklerini minimuma indir */
    tr {
      line-height: 1.1 !important;
      height: auto !important;
    }
    th, td {
      word-wrap: break-word;
      line-height: 1.1 !important;
      padding-top: 2px !important;
      padding-bottom: 2px !important;
      vertical-align: middle;
    }
    /* Div ve paragraf satır yüksekliklerini de azalt */
    div, p {
      line-height: 1.2 !important;
      margin: 0;
      padding: 0;
    }
    @media print {
      body { 
        margin: 0;
        padding: 0;
      }
      table {
        page-break-inside: avoid;
      }
    }
  </style>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
      <w:ValidateAgainstSchemas/>
      <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
      <w:IgnoreMixedContent>false</w:IgnoreMixedContent>
      <w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText>
      <w:DoNotPromoteQF/>
      <w:LidThemeOther>TR</w:LidThemeOther>
      <w:LidThemeAsian>X-NONE</w:LidThemeAsian>
      <w:LidThemeComplexScript>X-NONE</w:LidThemeComplexScript>
      <w:Compatibility>
        <w:BreakWrappedTables/>
        <w:SnapToGridInCell/>
        <w:WrapTextWithPunct/>
        <w:UseAsianBreakRules/>
        <w:DontGrowAutofit/>
        <w:SplitPgBreakAndParaMark/>
        <w:EnableOpenTypeKerning/>
        <w:DontFlipMirrorIndents/>
        <w:OverrideTableStyleHps/>
      </w:Compatibility>
    </w:WordDocument>
  </xml>
  <![endif]-->
</head>
<body>
  ${sectionsHTML}
</body>
</html>`;
}

/**
 * Yazdırma için HTML formatı oluşturur
 */
export function formatForPrint(data: ReportData): string {
  const sectionsHTML = data.sections
    .map(section => {
      if (section.html) {
        return section.html;
      }
      if (section.type === 'table' && section.data) {
        return formatTableForPrint(section.data, section.title);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; }
    .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .print-sub { font-size: 12px; color: #374151; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 16px; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { white-space: nowrap !important; text-align: left; }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; margin-top: 16px; }
    .copy-icon-btn { display: none !important; }
  </style>
</head>
<body>
  <div class="print-title">${data.title}</div>
  ${sectionsHTML}
</body>
</html>`;
}

/**
 * Tablo verisini Word formatına çevirir
 */
function formatTableForWord(data: any, title?: string): string {
  // Eğer data zaten HTML string ise, direkt döndür
  if (typeof data === 'string') {
    return title ? `<div class="section-title">${title}</div>${data}` : data;
  }

  // Eğer data bir HTML element ise, outerHTML'ini al
  if (data && data.outerHTML) {
    return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  }

  // Tablo verisi formatında değilse, boş döndür
  return '';
}

/**
 * Tablo verisini yazdırma formatına çevirir
 */
function formatTableForPrint(data: any, title?: string): string {
  // Eğer data zaten HTML string ise, direkt döndür
  if (typeof data === 'string') {
    return title ? `<div class="section-title">${title}</div>${data}` : data;
  }

  // Eğer data bir HTML element ise, outerHTML'ini al
  if (data && data.outerHTML) {
    return title ? `<div class="section-title">${title}</div>${data.outerHTML}` : data.outerHTML;
  }

  // Tablo verisi formatında değilse, boş döndür
  return '';
}

/**
 * HTML içeriğini Word uyumlu hale getir
 * Word desteklemeyen elementleri ve stilleri temizle
 */
function sanitizeHTMLForWord(html: string): string {
  // Geçici bir div oluştur
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // SVG'leri kaldır
  temp.querySelectorAll('svg').forEach(el => el.remove());
  
  // Button'ları kaldır
  temp.querySelectorAll('button').forEach(el => el.remove());
  
  // Script'leri kaldır
  temp.querySelectorAll('script').forEach(el => el.remove());
  
  // Style tag'lerini kaldır (inline style'lar kalacak)
  temp.querySelectorAll('style').forEach(el => el.remove());
  
  // Word desteklemeyen CSS özelliklerini temizle
  temp.querySelectorAll('*').forEach((el: any) => {
    if (el.style) {
      // Flexbox, Grid gibi modern CSS'leri kaldır
      el.style.display = el.style.display === 'flex' || el.style.display === 'grid' ? 'block' : el.style.display;
      el.style.removeProperty('flex');
      el.style.removeProperty('flex-direction');
      el.style.removeProperty('flex-wrap');
      el.style.removeProperty('justify-content');
      el.style.removeProperty('align-items');
      el.style.removeProperty('gap');
      el.style.removeProperty('grid');
      el.style.removeProperty('grid-template-columns');
      
      // Transform, transition gibi animasyonları kaldır
      el.style.removeProperty('transform');
      el.style.removeProperty('transition');
      el.style.removeProperty('animation');
      
      // Box-shadow, border-radius gibi dekoratif özellikleri kaldır
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('text-shadow');
      
      // Max-width ve min-width'i kaldır (tablo genişlikleri için sorun yaratabilir)
      el.style.removeProperty('max-width');
      el.style.removeProperty('min-width');
    }
    
    // Gereksiz class'ları temizle
    if (el.classList) {
      const keepClasses: string[] = [];
      el.classList.forEach((cls: string) => {
        // Sadece basit sınıfları tut
        if (!cls.includes(':') && !cls.includes('[') && !cls.includes('dark:')) {
          keepClasses.push(cls);
        }
      });
      el.className = keepClasses.join(' ');
    }
  });
  
  return temp.innerHTML;
}

/**
 * DOM elementinden ReportData oluşturur
 */
export function createReportDataFromDOM(
  title: string,
  containerId: string,
  sectionSelectors?: string[]
): ReportData {
  const container = document.getElementById(containerId);
  if (!container) {
    return { title, sections: [] };
  }

  const sections: ReportSection[] = [];

  if (sectionSelectors && sectionSelectors.length > 0) {
    // Belirli section'ları al
    sectionSelectors.forEach(selector => {
      const element = container.querySelector(selector);
      if (element) {
        const cleanHTML = sanitizeHTMLForWord((element as HTMLElement).outerHTML);
        sections.push({
          type: 'table',
          html: cleanHTML,
        });
      }
    });
  } else {
    // Container <table> ise outerHTML kullan (Word'de geçerli olsun; innerHTML sadece tbody verir)
    const isTable = container.tagName === 'TABLE';
    const containerHTML = isTable ? container.outerHTML : container.innerHTML;
    
    if (containerHTML.trim()) {
      const cleanHTML = sanitizeHTMLForWord(containerHTML);
      sections.push({
        type: 'table',
        html: cleanHTML,
      });
    } else {
      const sectionElements = container.querySelectorAll('table, div');
      sectionElements.forEach((element) => {
        const cleanHTML = sanitizeHTMLForWord((element as HTMLElement).outerHTML);
        sections.push({
          type: 'table',
          html: cleanHTML,
        });
      });
    }
  }

  return { title, sections };
}
