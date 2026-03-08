import { getAsgariUcretPeriods } from "@/constants/asgariUcretPeriods";

export function generateDynamicIntervals(startDate: Date, endDate: Date) {
  const intervals: { start: string; end: string }[] = [];

  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    const periods = getAsgariUcretPeriods(year);
    if (periods && periods.length > 0) {
      for (const p of periods) {
        const pStart = new Date(p.start);
        const pEnd = new Date(p.end);

        const effectiveStart = pStart < start ? start : pStart;
        const effectiveEnd = pEnd > end ? end : pEnd;

        if (effectiveEnd >= start && effectiveStart <= end) {
          intervals.push({
            start: formatDate(effectiveStart),
            end: formatDate(effectiveEnd),
          });
        }
      }
    }
  }

  // Yalnızca sıralayıp döndür
  intervals.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return intervals;
}

function formatDate(d: Date) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dt.toISOString().slice(0, 10);
}
