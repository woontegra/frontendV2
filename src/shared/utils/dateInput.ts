/**
 * Tarih input'ları için yıl kısmını 4 karakterle sınırlandıran onChange handler
 * Yıl kısmına 6 karakter yerine 4 karakterden fazla yazılmasını önler
 */
export const handleDateInputChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  originalOnChange?: (value: string) => void
) => {
  let value = e.target.value;
  
  // Date input type="date" için YYYY-MM-DD formatında gelir
  // Yıl kısmını kontrol et ve 4 karakterle sınırla
  if (value && value.includes('-')) {
    const parts = value.split('-');
    if (parts[0] && parts[0].length > 4) {
      // Yıl kısmı 4 karakterden fazlaysa ilk 4 karakteri al
      parts[0] = parts[0].substring(0, 4);
      value = parts.join('-');
      e.target.value = value; // Input değerini düzelt
    }
  } else if (value && /^\d+$/.test(value) && value.length > 4) {
    // Sadece rakamlar varsa ve 4 karakterden fazlaysa
    value = value.substring(0, 4);
    e.target.value = value;
  }
  
  // Orijinal onChange'i çağır
  if (originalOnChange) {
    originalOnChange(value);
  }
};

/**
 * Tarih input'ları için max attribute değeri
 * Yıl kısmını 4 karakterle sınırlar (9999 yılına kadar)
 */
export const MAX_DATE = '9999-12-31';

