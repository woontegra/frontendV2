/**
 * Güvenli formatlama utility fonksiyonları
 * undefined/null değerleri otomatik handle eder
 */

/**
 * Sayıyı güvenli şekilde Türkçe formatına çevirir
 * @param value - Formatlanacak değer (undefined/null olabilir)
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string
 */
export function safeNumber(
  value: number | undefined | null,
  decimals: number = 2
): string {
  const num = value ?? 0;
  return num.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Para birimi ile birlikte güvenli formatlama
 * @param value - Formatlanacak değer
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string (₺ simgesi ile)
 */
export function safeCurrency(
  value: number | undefined | null,
  decimals: number = 2
): string {
  return `₺${safeNumber(value, decimals)}`;
}

/**
 * UBGT günleri için güvenli formatlama (1 ondalık)
 * @param days - Gün sayısı
 * @returns Formatlanmış string ("X.X gün" formatında)
 */
export function safeDays(days: number | undefined | null): string {
  return `${safeNumber(days, 1)} gün`;
}

/**
 * Katsayı için güvenli değer döndür
 * @param coefficient - Katsayı değeri
 * @returns Katsayı veya varsayılan (1)
 */
export function safeCoefficient(coefficient: number | undefined | null): number {
  return coefficient ?? 1;
}

/**
 * Herhangi bir sayısal değeri güvenli şekilde döndür
 * @param value - Değer
 * @param defaultValue - Varsayılan değer (default: 0)
 * @returns Değer veya varsayılan
 */
export function safeValue(
  value: number | undefined | null,
  defaultValue: number = 0
): number {
  return value ?? defaultValue;
}



