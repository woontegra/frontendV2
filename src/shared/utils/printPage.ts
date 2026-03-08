/**
 * Programmatic Print Utility - MİNİMAL YAKLAŞIM
 * 
 * Ekran layout'unu bozmadan sadece hesaplama içeriğini yazdırır.
 * Visibility:hidden kullanmaz, sadece DOM clone + print yapar.
 */

export function printPageContent(contentSelector: string = '#calculation-content') {
  try {
    // 1. İçeriği bul
    const content = document.querySelector(contentSelector);
    
    if (!content) {
      console.error(`Print: ${contentSelector} bulunamadı`);
      return;
    }

    // 2. Clone oluştur
    const clone = content.cloneNode(true) as HTMLElement;
    clone.id = 'print-root';

    // 3. Body'ye ekle, yazdır, sil
    document.body.appendChild(clone);
    window.print();
    document.body.removeChild(clone);

  } catch (error) {
    console.error('Print error:', error);
  }
}

