/**
 * İhbar Tazminatı - yardımcı fonksiyonlar
 * İhbar süresi İş Kanunu md. 17'ye göre
 */

import { calcWorkPeriodBilirKisi } from "@/pages/kidem-tazminati/utils";
export { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
export { calcWorkPeriodBilirKisi };

/**
 * İhbar tazminatı için çalışma süresi hesabı — kıdem'deki +1 (inclusive) günü OLMADAN.
 * İhbar süresinde işten çıkış günü dahil edilmez; standart tarih farkı kullanılır.
 */
export function calcWorkPeriodIhbar(
  startDate: string,
  endDate: string
): { years: number; months: number; days: number; label: string } {
  if (!startDate || !endDate) return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
    if (end < start) return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    if (days < 0) {
      months--;
      const lastDayOfPrevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += lastDayOfPrevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    return { years, months, days, label: `${years} Yıl ${months} Ay ${days} Gün` };
  } catch {
    return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
  }
}

export function parseMoney(value: string | number): number {
  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
    return value;
  }
  if (!value || typeof value !== "string") return 0;
  const trimmed = String(value).trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  return parsed;
}

/** İş Kanunu md. 17 - çalışma süresine göre ihbar süresi (hafta) */
export function getIhbarWeeks(yil: number, ay: number, gun: number): number {
  const totalMonths = yil * 12 + ay + gun / 30;
  if (totalMonths < 6) return 2;
  if (totalMonths < 18) return 4;
  if (totalMonths < 36) return 6;
  return 8;
}

/** İhbar süresi açıklama metni */
export function getIhbarWeeksLabel(weeks: number): string {
  if (weeks === 2) return "2 hafta (altı aydan az)";
  if (weeks === 4) return "4 hafta (altı ay - 1,5 yıl)";
  if (weeks === 6) return "6 hafta (1,5 yıl - 3 yıl)";
  if (weeks === 8) return "8 hafta (3 yıldan fazla)";
  return `${weeks} hafta`;
}
