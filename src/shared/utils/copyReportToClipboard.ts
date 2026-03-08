/**
 * MERKEZI WORD KOPYALAMA UTILITY
 * 
 * AMAÇ:
 * - Gizli table'ı seçip clipboard'a kopyalar
 * - Word, LibreOffice, Google Docs'a yapıştırılabilir
 * 
 * KULLANIM:
 * - copyReportToClipboard() çağrıldığında
 * - #copyable-report-table elementini bulur
 * - Range/Selection API ile seçer
 * - Clipboard'a kopyalar
 * - Başarı/hata mesajı döner
 */

export interface CopyResult {
  success: boolean;
  message: string;
}

export const copyReportToClipboard = async (): Promise<CopyResult> => {
  try {
    // 1. Gizli table elementini bul
    const tableElement = document.getElementById('copyable-report-table');
    
    if (!tableElement) {
      return {
        success: false,
        message: 'Kopyalanacak rapor bulunamadı. Lütfen sayfayı yenileyin.',
      };
    }

    // 2. Table'ı geçici olarak görünür yap (kopyalama için gerekli)
    const container = document.getElementById('copyable-report-container');
    if (container) {
      container.style.display = 'block';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
    }

    // 3. Range oluştur ve table'ı seç
    const range = document.createRange();
    range.selectNodeContents(tableElement);

    // 4. Selection API ile seçimi uygula
    const selection = window.getSelection();
    if (!selection) {
      return {
        success: false,
        message: 'Tarayıcı seçim işlemini desteklemiyor.',
      };
    }

    selection.removeAllRanges();
    selection.addRange(range);

    // 5. Clipboard'a kopyala
    let copySuccess = false;
    
    try {
      // Modern API (tercih edilen)
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([tableElement.outerHTML], { type: 'text/html' }),
          'text/plain': new Blob([tableElement.innerText], { type: 'text/plain' }),
        }),
      ]);
      copySuccess = true;
    } catch (modernError) {
      // Fallback: Eski execCommand yöntemi
      copySuccess = document.execCommand('copy');
    }

    // 6. Seçimi temizle
    selection.removeAllRanges();

    // 7. Table'ı tekrar gizle
    if (container) {
      container.style.display = 'none';
    }

    if (copySuccess) {
      return {
        success: true,
        message: 'Rapor kopyalandı! Word\'e yapıştırabilirsiniz (Ctrl+V).',
      };
    } else {
      return {
        success: false,
        message: 'Kopyalama başarısız oldu. Lütfen manuel olarak seçip kopyalayın.',
      };
    }
  } catch (error) {
    console.error('Kopyalama hatası:', error);
    return {
      success: false,
      message: 'Bir hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'),
    };
  }
};

/**
 * ALTERNATIF: Basit metin kopyalama (fallback)
 */
export const copyReportAsText = async (): Promise<CopyResult> => {
  try {
    const tableElement = document.getElementById('copyable-report-table');
    
    if (!tableElement) {
      return {
        success: false,
        message: 'Kopyalanacak rapor bulunamadı.',
      };
    }

    const textContent = tableElement.innerText;
    await navigator.clipboard.writeText(textContent);

    return {
      success: true,
      message: 'Rapor metin olarak kopyalandı.',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Metin kopyalama başarısız oldu.',
    };
  }
};
