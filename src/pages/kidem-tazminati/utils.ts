/**
 * Kıdem Tazminatı (İş Kanununa Göre) - yardımcı fonksiyonlar
 */

export const KIDEM_TAVAN_DONEMLERI = [
  { start: "01.01.2004", end: "30.06.2004", tavan: 1485430000 / 1000000 },
  { start: "01.07.2004", end: "31.12.2004", tavan: 1574740000 / 1000000 },
  { start: "01.01.2005", end: "30.06.2005", tavan: 1648.9 },
  { start: "01.07.2005", end: "31.12.2005", tavan: 1727.15 },
  { start: "01.01.2006", end: "30.06.2006", tavan: 1770.63 },
  { start: "01.07.2006", end: "31.12.2006", tavan: 1857.44 },
  { start: "01.01.2007", end: "30.06.2007", tavan: 1960.69 },
  { start: "01.07.2007", end: "31.12.2007", tavan: 2030.19 },
  { start: "01.01.2008", end: "30.06.2008", tavan: 2087.92 },
  { start: "01.07.2008", end: "31.12.2008", tavan: 2173.18 },
  { start: "01.01.2009", end: "30.06.2009", tavan: 2260.05 },
  { start: "01.07.2009", end: "31.12.2009", tavan: 2365.16 },
  { start: "01.01.2010", end: "30.06.2010", tavan: 2427.04 },
  { start: "01.07.2010", end: "31.12.2010", tavan: 2517.01 },
  { start: "01.01.2011", end: "30.06.2011", tavan: 2623.23 },
  { start: "01.01.2012", end: "30.06.2012", tavan: 2917.27 },
  { start: "01.07.2012", end: "31.12.2012", tavan: 3033.98 },
  { start: "01.01.2013", end: "30.06.2013", tavan: 3129.25 },
  { start: "01.07.2013", end: "31.12.2013", tavan: 3254.44 },
  { start: "01.01.2014", end: "31.12.2014", tavan: 3438.22 },
  { start: "01.01.2015", end: "30.06.2015", tavan: 3541.37 },
  { start: "01.07.2015", end: "31.08.2015", tavan: 3709.98 },
  { start: "01.09.2015", end: "31.12.2015", tavan: 3828.37 },
  { start: "01.01.2016", end: "30.06.2016", tavan: 4092.53 },
  { start: "01.07.2016", end: "31.12.2016", tavan: 4297.21 },
  { start: "01.01.2017", end: "30.06.2017", tavan: 4426.16 },
  { start: "01.07.2017", end: "31.12.2017", tavan: 4732.48 },
  { start: "01.01.2018", end: "30.06.2018", tavan: 5001.76 },
  { start: "01.07.2018", end: "31.12.2018", tavan: 5434.42 },
  { start: "01.01.2019", end: "30.06.2019", tavan: 6017.6 },
  { start: "01.07.2019", end: "31.12.2019", tavan: 6379.86 },
  { start: "01.01.2020", end: "30.06.2020", tavan: 6730.15 },
  { start: "01.07.2020", end: "31.12.2020", tavan: 7117.17 },
  { start: "01.01.2021", end: "30.06.2021", tavan: 7638.96 },
  { start: "01.07.2021", end: "31.12.2021", tavan: 8284.51 },
  { start: "01.01.2022", end: "30.06.2022", tavan: 10848.59 },
  { start: "01.07.2022", end: "31.12.2022", tavan: 15371.4 },
  { start: "01.01.2023", end: "30.06.2023", tavan: 19982.83 },
  { start: "01.07.2023", end: "31.12.2023", tavan: 23489.83 },
  { start: "01.01.2024", end: "30.06.2024", tavan: 35058.58 },
  { start: "01.07.2024", end: "31.12.2024", tavan: 41828.42 },
  { start: "01.01.2025", end: "30.06.2025", tavan: 46655.43 },
  { start: "01.07.2025", end: "31.12.2025", tavan: 53919.68 },
];

export function findKidemTavan(exitDate: Date): number | null {
  const normalizedExitDate = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate());
  for (const d of KIDEM_TAVAN_DONEMLERI) {
    const startParts = d.start.split(".");
    const endParts = d.end.split(".");
    const start = new Date(
      parseInt(startParts[2], 10),
      parseInt(startParts[1], 10) - 1,
      parseInt(startParts[0], 10)
    );
    const end = new Date(
      parseInt(endParts[2], 10),
      parseInt(endParts[1], 10) - 1,
      parseInt(endParts[0], 10)
    );
    if (normalizedExitDate >= start && normalizedExitDate <= end) return d.tavan;
  }
  return null;
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

export function calcWorkPeriodBilirKisi(
  startDate: string,
  endDate: string
): { years: number; months: number; days: number; label: string } {
  if (!startDate || !endDate) return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
    if (end < start) return { years: 0, months: 0, days: 0, label: "0 Yıl 0 Ay 0 Gün" };
    // Kapsayıcı hesaplama: işe giriş ve işten çıkış günleri dahil edilir
    end.setDate(end.getDate() + 1);
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
