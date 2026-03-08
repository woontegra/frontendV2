/**
 * Tarih input'ları için yıl validasyonu helper fonksiyonu
 * Tüm date input onChange handler'larında kullanılabilir
 */

/**
 * Date input onChange handler'ında kullanılacak wrapper fonksiyon
 * Yıl kısmını 4 karakterle sınırlar
 */
export const createDateInputHandler = (
  originalHandler: (value: string) => void
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Yıl kısmını kontrol et (YYYY-MM-DD formatı)
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        // Yıl kısmı 4 karakterden fazlaysa ilk 4 karakteri al
        parts[0] = parts[0].substring(0, 4);
        value = parts.join('-');
        e.target.value = value;
      }
    }
    
    originalHandler(value);
  };
};

/**
 * Date input'lar için max attribute değeri
 */
export const MAX_DATE = '9999-12-31';



