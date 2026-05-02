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

function parseDateStrict(value: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  // yyyy-mm-dd
  let y = 0;
  let m = 0;
  let d = 0;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    // dd.mm.yyyy
    const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
    if (!tr) return null;
    d = Number(tr[1]);
    m = Number(tr[2]);
    y = Number(tr[3]);
  }

  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  // Taşan/invalid tarihleri ele (örn. 2005-02-29 => 2005-03-01)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calculateDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = parseDateStrict(startDate);
    const end = parseDateStrict(endDate);
    if (!start || !end) return 0;
    if (end < start) return 0;
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const startDay = start.getDate();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    const endDay = Math.min(30, end.getDate());
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
    return totalMonths * 30 + (endDay - startDay) + 1;
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
      const startDate = parseDateStrict(period.iseGiris);
      const endDate = parseDateStrict(period.istenCikis);
      if (!startDate || !endDate) return;
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        if (!yearlyDays[year]) yearlyDays[year] = 0;
        const yearStart = year === startYear ? startDate : new Date(year, 0, 1);
        const yearEnd = year === endYear ? endDate : new Date(year, 11, 31);
        const daysInThisYear = calculateDaysBetween(
          toISODateLocal(yearStart),
          toISODateLocal(yearEnd)
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
      const startDate = parseDateStrict(period.iseGiris);
      const endDate = parseDateStrict(period.istenCikis);
      if (!startDate || !endDate) return;
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        if (!yearlyDays[year]) yearlyDays[year] = 0;
        const yearStart = year === startYear ? startDate : new Date(year, 0, 1);
        const yearEnd = year === endYear ? endDate : new Date(year, 11, 31);
        const daysInThisYear = calculateDaysBetween(
          toISODateLocal(yearStart),
          toISODateLocal(yearEnd)
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
