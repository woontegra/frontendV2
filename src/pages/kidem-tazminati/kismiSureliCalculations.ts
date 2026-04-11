/**
 * Kısmi süreli kıdem — backend kidemKismiSureli.service.js ile aynı SSK 360 gün kuralları.
 */

export type WorkPeriod = { start: string; end: string; days: number };

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const isMonthBroken = (day: number): boolean => day !== 1;

/** Tek dönem için gün (SSK 360 sistemi) — backend ile uyumlu */
export function calculatePeriodDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  try {
    const startParts = startDate.split("-");
    const endParts = endDate.split("-");
    if (startParts.length !== 3 || endParts.length !== 3) return 0;

    const gY = parseInt(startParts[0], 10);
    const gA = parseInt(startParts[1], 10);
    const gG = parseInt(startParts[2], 10);
    const cY = parseInt(endParts[0], 10);
    const cA = parseInt(endParts[1], 10);
    const cG = parseInt(endParts[2], 10);

    if (isNaN(gY) || isNaN(gA) || isNaN(gG) || isNaN(cY) || isNaN(cA) || isNaN(cG)) return 0;

    if (gY === cY && gA === cA) return Math.max(0, cG - gG + 1);

    const startMonthBroken = isMonthBroken(gG);
    let startMonthDays = startMonthBroken ? getDaysInMonth(gY, gA) - gG + 1 : 30 - gG + 1;
    let totalDays = startMonthDays;

    let currentYear = gY;
    let currentMonth = gA + 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    while (currentYear < cY || (currentYear === cY && currentMonth < cA)) {
      totalDays += 30;
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    totalDays += cG;
    return totalDays > 0 ? totalDays : 0;
  } catch {
    return 0;
  }
}

export function convertDaysToYilAyGun(totalDays: number): { yil: number; ay: number; gun: number } {
  const d = Math.max(0, Math.floor(totalDays));
  const yil = Math.floor(d / 360);
  const ay = Math.floor((d % 360) / 30);
  const gun = (d % 360) % 30;
  return { yil, ay, gun };
}

export function formatCalismaSuresiKismi(totals: { yil: number; ay: number; gun: number }): string {
  const yil = totals?.yil ?? 0;
  const ay = totals?.ay ?? 0;
  const gun = totals?.gun ?? 0;
  return `${yil} Yıl ${ay} Ay ${gun} Gün`;
}
