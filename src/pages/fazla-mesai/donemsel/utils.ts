/**
 * Dönemsel Fazla Mesai - Hesaplama yardımcıları
 */
import { format } from "date-fns";
import { splitByAsgariUcretPeriods, getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import type { SeasonalPattern, DonemselWitness } from "./types";

const DAMGA_VERGISI = 0.00759;
const GELIR_VERGISI = 0.15;

export function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** Günlük saat hesapla: giriş-çıkış - ara dinlenme */
export function calcDailyNetHours(startTime: string, endTime: string): number {
  const [girH, girM] = startTime.split(":").map(Number);
  const [cikH, cikM] = endTime.split(":").map(Number);
  const girMin = girH * 60 + (girM || 0);
  const cikMin = cikH * 60 + (cikM || 0);
  const dailyBrut = (cikMin - girMin) / 60;
  let breakH = 1;
  if (dailyBrut >= 15) breakH = 3;
  else if (dailyBrut >= 14) breakH = 2;
  else if (dailyBrut >= 11) breakH = 1.5;
  return Math.max(0, dailyBrut - breakH);
}

/** Haftalık FM saati: (dailyNet * workDays - 45) */
export function calcFmHoursPerWeek(
  pattern: SeasonalPattern,
  workDays: number,
  activeTab: "tatilsiz" | "tatilli"
): number {
  const dailyNet = calcDailyNetHours(pattern.startTime, pattern.endTime);
  if (workDays === 7 && activeTab === "tatilli") {
    const weeklyNormal = 6 * dailyNet;
    const holidayOT = Math.max(0, dailyNet - 7.5);
    const weeklyTotal = weeklyNormal + holidayOT;
    return Math.max(0, Math.round(weeklyTotal) - 45);
  }
  const weeklyTotal = dailyNet * workDays;
  return Math.max(0, Math.round(weeklyTotal) - 45);
}

/**
 * Dönemsel haftalık: Grup 1 (gün + giriş/çıkış) + Grup 2; toplam 7 gün ve hafta tatili işaretliyse
 * Haftalık Karma ile aynı mantık (bir grupta 1 gün hafta tatili FM’si).
 */
export function calcFmHoursPerWeekHaftalik(pattern: SeasonalPattern): number {
  const d1 = Math.max(0, Math.min(7, pattern.days1 ?? 0));
  const d2 = Math.max(0, Math.min(7, pattern.days2 ?? 0));
  const net1 =
    pattern.startTime && pattern.endTime ? calcDailyNetHours(pattern.startTime, pattern.endTime) : 0;
  const net2 =
    pattern.startTime2 && pattern.endTime2 ? calcDailyNetHours(pattern.startTime2, pattern.endTime2) : 0;

  const totalDays = d1 + d2;
  const useHoliday =
    Boolean(pattern.hasWeeklyHoliday) && totalDays === 7 && (d1 > 0 || d2 > 0);
  const holidayRow = pattern.weeklyHolidayRow === 1 ? 1 : 2;

  let weeklyTotal = 0;
  if (!useHoliday) {
    weeklyTotal = d1 * net1 + d2 * net2;
  } else {
    const g1H = holidayRow === 1 && d1 > 0;
    const g2H = holidayRow === 2 && d2 > 0;
    if (g1H) {
      weeklyTotal += (d1 - 1) * net1 + Math.max(0, net1 - 7.5);
    } else {
      weeklyTotal += d1 * net1;
    }
    if (g2H) {
      weeklyTotal += (d2 - 1) * net2 + Math.max(0, net2 - 7.5);
    } else {
      weeklyTotal += d2 * net2;
    }
  }
  return Math.max(0, Math.round(weeklyTotal) - 45);
}

/** Tanık çakışma split: Çakışan tanıkları parçala (eski Donemsel mantığı) */
export function applyWitnessOverlapSplit(witnesses: DonemselWitness[]): DonemselWitness[] {
  const filtered = witnesses.filter((w) => w.dateIn && w.dateOut && w.dateIn < w.dateOut);
  if (filtered.length === 0) return [];
  const sorted = [...filtered].sort((a, b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime());
  const result: DonemselWitness[] = [];
  sorted.forEach((w, idx) => {
    const wStart = new Date(w.dateIn);
    const wEnd = new Date(w.dateOut);
    const overlapping = sorted.filter((o, oi) => {
      if (oi === idx) return false;
      const oStart = new Date(o.dateIn);
      const oEnd = new Date(o.dateOut);
      return oStart > wStart && oStart < wEnd;
    });
    if (overlapping.length === 0) {
      result.push(w);
      return;
    }
    let cur = new Date(wStart);
    overlapping.sort((a, b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime());
    overlapping.forEach((ov) => {
      const ovStart = new Date(ov.dateIn);
      const ovEnd = new Date(ov.dateOut);
      if (cur < ovStart) {
        const segEnd = new Date(ovStart);
        segEnd.setDate(segEnd.getDate() - 1);
        if (segEnd >= cur) {
          result.push({
            ...w,
            dateIn: cur.toISOString().slice(0, 10),
            dateOut: segEnd.toISOString().slice(0, 10),
          });
        }
      }
      const next = new Date(ovEnd);
      next.setDate(next.getDate() + 1);
      cur = next;
    });
    if (cur <= wEnd) {
      result.push({
        ...w,
        dateIn: cur.toISOString().slice(0, 10),
        dateOut: wEnd.toISOString().slice(0, 10),
      });
    }
  });
  return result;
}

/** Witness overlap split - tanık aralıklarından interval listesi. Sadece tanıklı dönemler eklenir. */
export function buildIntervalsFromWitnesses(
  dateIn: string,
  dateOut: string,
  davaciSummer: SeasonalPattern,
  davaciWinter: SeasonalPattern,
  witnesses: DonemselWitness[]
): Array<{ start: string; end: string; start_time: string; end_time: string; witnessData?: DonemselWitness }> {
  const splitWitnesses = applyWitnessOverlapSplit(witnesses);
  const filtered = splitWitnesses.length > 0 ? splitWitnesses : witnesses.filter((w) => w.dateIn && w.dateOut);
  if (filtered.length === 0) {
    return [{ start: dateIn, end: dateOut, start_time: davaciSummer.startTime, end_time: davaciSummer.endTime }];
  }
  const dates = new Set<string>();
  dates.add(dateIn);
  dates.add(dateOut);
  filtered.forEach((w) => {
    const s = w.dateIn < dateIn ? dateIn : w.dateIn;
    const e = w.dateOut > dateOut ? dateOut : w.dateOut;
    if (s < e) {
      dates.add(s);
      dates.add(e);
    }
  });
  const sorted = Array.from(dates).sort();
  const intervals: Array<{ start: string; end: string; start_time: string; end_time: string; witnessData?: DonemselWitness }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i];
    const e = sorted[i + 1];
    const inRange = filtered.find((w) => {
      const ws = w.dateIn < dateIn ? dateIn : w.dateIn;
      const we = w.dateOut > dateOut ? dateOut : w.dateOut;
      return ws <= s && we >= e;
    });
    if (inRange) {
      const month = new Date(s).getMonth() + 1;
      const isYaz = inRange.summerPattern.months.includes(month);
      const p = isYaz ? inRange.summerPattern : inRange.winterPattern;
      intervals.push({
        start: s,
        end: e,
        start_time: p.startTime,
        end_time: p.endTime,
        witnessData: inRange,
      });
    }
  }
  return intervals;
}

export interface DonemselRow {
  id: string;
  startISO: string;
  endISO: string;
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fm: number;
  net: number;
  originalWeekCount?: number;
  manual?: boolean;
  [k: string]: unknown;
}

/** Yaz/Kış segmentlere böl - sezon değişiminde satırı parçala */
export function seasonSegmentRow(
  row: DonemselRow,
  summerMonths: number[],
  winterMonths: number[],
  summerPattern: SeasonalPattern,
  winterPattern: SeasonalPattern,
  workDays: number,
  activeTab: "tatilsiz" | "tatilli",
  katSayi: number,
  haftalikMode = false
): DonemselRow[] {
  const rowStart = new Date(row.startISO);
  const rowEnd = new Date(row.endISO);
  const result: DonemselRow[] = [];
  let cur = new Date(rowStart);
  let segStart = new Date(rowStart);
  let segSeason: "summer" | "winter" | null = null;
  const activeSummer = summerMonths;

  const getSeason = (d: Date) => (activeSummer.includes(d.getMonth() + 1) ? "summer" : "winter");

  segSeason = getSeason(cur);

  while (cur <= rowEnd) {
    const m = cur.getMonth() + 1;
    const newSeason = activeSummer.includes(m) ? "summer" : "winter";
    const lastDay = cur.getTime() === rowEnd.getTime();
    const changed = newSeason !== segSeason;

    if (changed || lastDay) {
      let segEnd = new Date(cur);
      if (changed) segEnd.setDate(segEnd.getDate() - 1);

      const siso = `${segStart.getFullYear()}-${String(segStart.getMonth() + 1).padStart(2, "0")}-${String(segStart.getDate()).padStart(2, "0")}`;
      const eiso = `${segEnd.getFullYear()}-${String(segEnd.getMonth() + 1).padStart(2, "0")}-${String(segEnd.getDate()).padStart(2, "0")}`;
      const diffMs = segEnd.getTime() - segStart.getTime();
      const diffDays = Math.ceil(diffMs / 86400000) + 1;
      const weeks = Math.round(diffDays / 7);
      const pattern = segSeason === "summer" ? summerPattern : winterPattern;
      const fmHours = haftalikMode
        ? calcFmHoursPerWeekHaftalik(pattern)
        : calcFmHoursPerWeek(pattern, workDays, activeTab);
      const brut = getAsgariUcretByDate(siso) || 0;
      const fm = (weeks * brut * katSayi * fmHours / 225) * 1.5;
      const net = fm * (1 - DAMGA_VERGISI - GELIR_VERGISI);

      result.push({
        ...row,
        id: `period-${result.length}`,
        startISO: siso,
        endISO: eiso,
        rangeLabel: `${format(segStart, "dd.MM.yyyy")} – ${format(segEnd, "dd.MM.yyyy")}`,
        weeks,
        originalWeekCount: weeks,
        brut,
        katsayi: katSayi,
        fmHours,
        fm: Number(fm.toFixed(2)),
        net: Number(net.toFixed(2)),
      });

      if (changed && !lastDay) {
        segStart = new Date(cur);
        segSeason = newSeason;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/** Dönemsel ham satırları üret: intervals → asgari split → sezon split. 270/zamanaşımı/exclusions uygulanmaz. */
export function buildDonemselRows(params: {
  dateIn: string;
  dateOut: string;
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
  witnesses: DonemselWitness[];
  weeklyDays: number;
  activeTab: "tatilsiz" | "tatilli";
  katSayi: number;
  /** true: Grup1+Grup2 + hafta tatili (v1 dönemsel haftalık) */
  haftalikMode?: boolean;
}): DonemselRow[] {
  const {
    dateIn,
    dateOut,
    summerPattern,
    winterPattern,
    witnesses,
    weeklyDays,
    activeTab,
    katSayi,
    haftalikMode = false,
  } = params;

  const workDays = Math.max(1, Math.min(7, weeklyDays || 6));
  const kats = katSayi || 1;

  const intervals = buildIntervalsFromWitnesses(
    dateIn,
    dateOut,
    summerPattern,
    winterPattern,
    witnesses
  );

  const rawRows: (DonemselRow & { witnessData?: DonemselWitness })[] = [];

  for (const interval of intervals) {
    const intStart = new Date(interval.start);
    const intEnd = new Date(interval.end);
    const segments = splitByAsgariUcretPeriods(intStart, intEnd);

    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.end;
      const siso = segStart.toISOString().slice(0, 10);
      const eiso = segEnd.toISOString().slice(0, 10);
      const diffDays = Math.round((segEnd.getTime() - segStart.getTime()) / 86400000) + 1;
      const weeks = Math.round(diffDays / 7) || 1;
      const brut = getAsgariUcretByDate(siso) || 0;
      const month = segStart.getMonth() + 1;
      const activeSummer = interval.witnessData?.summerPattern?.months ?? summerPattern.months;
      const isSummer = activeSummer.includes(month);
      const pattern = isSummer
        ? (interval.witnessData?.summerPattern ?? summerPattern)
        : (interval.witnessData?.winterPattern ?? winterPattern);
      const fmHours = haftalikMode
        ? calcFmHoursPerWeekHaftalik(pattern)
        : calcFmHoursPerWeek(pattern, workDays, activeTab);

      const baseRow: DonemselRow & { witnessData?: DonemselWitness } = {
        id: `period-${rawRows.length}`,
        startISO: siso,
        endISO: eiso,
        rangeLabel: `${format(segStart, "dd.MM.yyyy")} – ${format(segEnd, "dd.MM.yyyy")}`,
        weeks,
        originalWeekCount: weeks,
        brut,
        katsayi: kats,
        fmHours,
        fm: 0,
        net: 0,
        witnessData: interval.witnessData,
      };

      const summerMonths = interval.witnessData?.summerPattern?.months ?? summerPattern.months;
      const winterMonths = interval.witnessData?.winterPattern?.months ?? winterPattern.months;
      const activeSummerP = interval.witnessData?.summerPattern ?? summerPattern;
      const activeWinterP = interval.witnessData?.winterPattern ?? winterPattern;

      const seasonRows = seasonSegmentRow(
        baseRow,
        summerMonths,
        winterMonths,
        activeSummerP,
        activeWinterP,
        workDays,
        activeTab,
        kats,
        haftalikMode
      );

      seasonRows.forEach((r) => {
        const { witnessData: _wd, ...rest } = r as DonemselRow & { witnessData?: DonemselWitness };
        rawRows.push(rest);
      });
    }
  }

  rawRows.forEach((r, i) => {
    r.id = `period-${i}`;
  });

  return rawRows.sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""));
}
