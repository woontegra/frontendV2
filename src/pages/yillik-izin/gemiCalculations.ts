/**
 * Gemi adamları yıllık izin — v1 GemiIndependent ile aynı 30/360 gün mantığı.
 */

export type WorkPeriod = {
  id: string;
  iseGiris: string;
  istenCikis: string;
  haricTutulacakTarihler?: string;
  gunSayisi?: number;
};

export function calculateDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const startDay = start.getDate();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    const endDay = end.getDate();
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
    const dayDiff = endDay - startDay;
    return totalMonths * 30 + dayDiff + 1;
  } catch {
    return 0;
  }
}

export function calculateTotalDays(workPeriods: WorkPeriod[]): number {
  return workPeriods.reduce((total, period) => {
    if (period.gunSayisi !== undefined) {
      return total + period.gunSayisi;
    }
    if (period.iseGiris && period.istenCikis) {
      return total + calculateDaysBetween(period.iseGiris, period.istenCikis);
    }
    return total;
  }, 0);
}

export function formatTotalWorkDays(totalDays: number): string {
  if (totalDays === 0) return "0 gün";
  if (totalDays < 360) {
    const ay = Math.floor(totalDays / 30);
    const gun = totalDays % 30;
    return `${totalDays} gün / 30 = ${ay} ay ${gun} gün`;
  }
  const yil = Math.floor(totalDays / 360);
  const kalanGun = totalDays % 360;
  const ay = Math.floor(kalanGun / 30);
  const gun = kalanGun % 30;
  return `${totalDays} gün / 360 = ${yil} yıl ${ay} ay ${gun} gün`;
}

export function calculateGemiIzin(workPeriods: WorkPeriod[]): number {
  if (!workPeriods || workPeriods.length === 0) return 0;
  try {
    const totalDaysOverall = calculateTotalDays(workPeriods);
    const yearlyDays: Record<number, number> = {};

    workPeriods.forEach((period) => {
      if (!period.iseGiris || !period.istenCikis) return;
      const startDate = new Date(period.iseGiris);
      const endDate = new Date(period.istenCikis);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        if (!yearlyDays[year]) yearlyDays[year] = 0;
        const yearStart = year === startYear ? startDate : new Date(year, 0, 1);
        const yearEnd = year === endYear ? endDate : new Date(year, 11, 31);
        const daysInThisYear = calculateDaysBetween(
          yearStart.toISOString().split("T")[0],
          yearEnd.toISOString().split("T")[0]
        );
        yearlyDays[year] += daysInThisYear;
      }
    });

    let totalDaysForCalendarRule = 0;
    Object.values(yearlyDays).forEach((days) => {
      if (days >= 180) totalDaysForCalendarRule += days;
    });

    if (totalDaysOverall >= 360) {
      const fullYears = Math.floor(totalDaysOverall / 360);
      return fullYears * 30;
    }
    if (totalDaysForCalendarRule >= 180) return 15;
    return 0;
  } catch {
    return 0;
  }
}

export function calculateGemiBreakdown(workPeriods: WorkPeriod[]) {
  if (!workPeriods || workPeriods.length === 0) {
    return { d1: 0, d2: 0, total: 0, y1: 0, y2: 0 };
  }
  try {
    const totalDaysOverall = calculateTotalDays(workPeriods);
    const yearlyDays: Record<number, number> = {};

    workPeriods.forEach((period) => {
      if (!period.iseGiris || !period.istenCikis) return;
      const startDate = new Date(period.iseGiris);
      const endDate = new Date(period.istenCikis);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        if (!yearlyDays[year]) yearlyDays[year] = 0;
        const yearStart = year === startYear ? startDate : new Date(year, 0, 1);
        const yearEnd = year === endYear ? endDate : new Date(year, 11, 31);
        const daysInThisYear = calculateDaysBetween(
          yearStart.toISOString().split("T")[0],
          yearEnd.toISOString().split("T")[0]
        );
        yearlyDays[year] += daysInThisYear;
      }
    });

    let totalDaysForCalendarRule = 0;
    Object.values(yearlyDays).forEach((days) => {
      if (days >= 180) totalDaysForCalendarRule += days;
    });

    if (totalDaysOverall >= 360) {
      const fullYears = Math.floor(totalDaysOverall / 360);
      return { y1: 0, y2: fullYears, d1: 0, d2: fullYears * 30, total: fullYears * 30 };
    }
    if (totalDaysForCalendarRule >= 180) {
      return { y1: 1, y2: 0, d1: 15, d2: 0, total: 15 };
    }
    return { y1: 0, y2: 0, d1: 0, d2: 0, total: 0 };
  } catch {
    return { d1: 0, d2: 0, total: 0, y1: 0, y2: 0 };
  }
}
