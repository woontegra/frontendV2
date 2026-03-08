/**
 * BASİT 270 SAAT MOTORU (YARGITAY UYGULAMASI)
 * 
 * Bu motor haftalık fazla mesai saatine direkt uygulanır.
 * Tarih, yıl, zamanaşımı, izin, tablo bölme işlemleri YOKTUR.
 * 
 * Formül: Haftalık FM - (270 / 52) = Haftalık FM - 5.1923
 * 
 * @param weeklyOvertimeHour Haftalık fazla mesai saati
 * @param use270Simple Basit 270 uygulanacak mı?
 * @returns Düşüm sonrası haftalık FM saati (4 ondalık)
 */
export function calculateWeeklyOvertimeWith270Simple(
  weeklyOvertimeHour: number,
  use270Simple: boolean
): number {
  if (!use270Simple) return weeklyOvertimeHour;

  const DEDUCT_HOUR = 270 / 52; // 5.1923

  const result = weeklyOvertimeHour - DEDUCT_HOUR;

  return result > 0 ? Number(result.toFixed(4)) : 0;
}
