/**
 * Güvenli formatlama utility fonksiyonları
 * undefined/null değerleri otomatik handle eder
 * 
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
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
