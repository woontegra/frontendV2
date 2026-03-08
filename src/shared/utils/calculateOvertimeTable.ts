import { getAsgariUcretPeriods } from "@/constants/asgariUcretPeriods";
import { normalizeLocalDate } from "@/utils/dateHelpers";

type ISODate = string; // yyyy-MM-dd

export type OvertimeTableRow = {
  tarihAraligi: string;
  haftaSayisi: number;
  ucret: number;
  katSayi: number;
  fazlaMesaiSaati: number;
  startISO: ISODate;
  endISO: ISODate;
};

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function formatDate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

function calculateWeekCount(start: Date, end: Date): number {
  const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  let weeks = Math.floor(diffInDays / 7);
  if (weeks > 52) weeks = 52;
  else if (weeks > 26 && diffInDays <= 183) weeks = 26;
  if (weeks < 1) weeks = 1;
  return weeks;
}

export function groupByAsgariPeriods(start: Date, end: Date) {
  const groups: { label: string; start: Date; end: Date; year: number }[] = [];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  for (let y = startYear; y <= endYear; y++) {
    const periods = getAsgariUcretPeriods(y);
    if (!periods || periods.length === 0) {
      const s = new Date(y, 0, 1);
      const e = new Date(y, 11, 31);
      const effectiveStart = s < start ? start : s;
      const effectiveEnd = e > end ? end : e;
      if (effectiveStart <= end && effectiveEnd >= start) {
        groups.push({
          year: y,
          label: `${formatDate(effectiveStart)}–${formatDate(effectiveEnd)}`,
          start: effectiveStart,
          end: effectiveEnd,
        });
      }
      continue;
    }
    for (const p of periods) {
      const pStart = normalizeLocalDate(p.start);
      const pEnd = normalizeLocalDate(p.end);
      const effectiveStart = pStart < start ? start : pStart;
      const effectiveEnd = pEnd > end ? end : pEnd;
      if (effectiveStart <= end && effectiveEnd >= start) {
        groups.push({
          year: y,
          label: `${formatDate(effectiveStart)}–${formatDate(effectiveEnd)}`,
          start: effectiveStart,
          end: effectiveEnd,
        });
      }
    }
  }
  return groups;
}

export function calculateOvertimeTable(startDate: Date | string, endDate: Date | string, hourlyWage: number): OvertimeTableRow[] {
  const s = typeof startDate === 'string' ? normalizeLocalDate(startDate) : startDate;
  const e = typeof endDate === 'string' ? normalizeLocalDate(endDate) : endDate;
  const grouped = groupByAsgariPeriods(s, e);

  const rows: OvertimeTableRow[] = grouped.map((period) => {
    const weeks = calculateWeekCount(period.start, period.end);
    return {
      tarihAraligi: period.label,
      haftaSayisi: weeks,
      ucret: Number(hourlyWage || 0),
      katSayi: 1,
      fazlaMesaiSaati: 0,
      startISO: formatDate(period.start),
      endISO: formatDate(period.end),
    };
  });

  return rows;
}
