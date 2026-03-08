// Tanık dönemleri
// Debug helper
const debug = (...args: any[]) => {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[intervalHelper]', ...args);
  }
};
// Normalize: split witness ranges across year boundaries into per-year segments
// @ts-ignore - used internally
function _normalizeWitnessIntervals(
  witnesses: Array<{ dateIn?: string; dateOut?: string; in?: string; out?: string }>
) {
  const out: Array<{ start: Date; end: Date; in?: string; out?: string }> = [];
  for (const w of witnesses || []) {
    const s = parseFlexibleDate(String(w?.dateIn || ''));
    const e = parseFlexibleDate(String(w?.dateOut || ''));
    if (!s || !e) continue;
    let start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
    const endAll = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
    while (start.getTime() <= endAll.getTime()) {
      const year = start.getUTCFullYear();
      const endOfYear = new Date(Date.UTC(year, 11, 31));
      const sliceEnd = endOfYear.getTime() < endAll.getTime() ? endOfYear : endAll;
      out.push({ start: new Date(start.getTime()), end: new Date(sliceEnd.getTime()), in: w?.in, out: w?.out });
      const next = new Date(sliceEnd.getTime());
      next.setUTCDate(next.getUTCDate() + 1);
      start = next;
    }
  }
  // sort
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

// Split overlaps: ensure non-overlapping by trimming previous.end to day before current.start
// @ts-ignore - used internally
function _splitOverlaps(
  intervals: Array<{ start: Date; end: Date; in?: string; out?: string }>
) {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const unique = new Set<string>();
  const res: typeof sorted = [];
  for (const cur of sorted) {
    if (res.length) {
      const prev = res[res.length - 1];
      if (cur.start.getTime() <= prev.end.getTime()) {
        const fixed = new Date(cur.start.getTime());
        fixed.setUTCDate(fixed.getUTCDate() - 1);
        if (fixed.getTime() >= prev.start.getTime()) prev.end = fixed;
      }
    }
    const key = `${cur.start.toISOString().slice(0,10)}|${cur.end.toISOString().slice(0,10)}|${cur.in ?? ''}|${cur.out ?? ''}`;
    if (!unique.has(key)) {
      unique.add(key);
      res.push({ ...cur });
    }
  }
  return res;
}

function applyClaimantHours(
  interval: { start: Date; end: Date; in?: string; out?: string },
  claimant: { startTime?: string; endTime?: string; haftalikGunSayisi?: number }
) {
  const safeStartTime = (interval.in && claimant.startTime && interval.in < claimant.startTime)
    ? claimant.startTime
    : (interval.in || claimant.startTime);
  const safeEndTime = (interval.out && claimant.endTime && interval.out > claimant.endTime)
    ? claimant.endTime
    : (interval.out || claimant.endTime);
  return {
    start: toISODateUTC2(interval.start),
    end: toISODateUTC2(interval.end),
    start_time: safeStartTime || '',
    end_time: safeEndTime || '',
    haftalikGun: claimant.haftalikGunSayisi || 6,
  };
}
export interface WitnessInterval {
  startDate: string; // GG.AA.YYYY
  endDate: string;   // GG.AA.YYYY
  startTime: string; // SS:dd
  endTime: string;   // SS:dd
}

// Compatibility wrapper for legacy 3-arg signature used by the page
export function generateDynamicIntervals(
  beyanlar: Array<{ type: string; startDate?: string; endDate?: string; startTime?: string; endTime?: string }>,
  davaciBeyani: { startDate?: string; endDate?: string; startTime?: string; endTime?: string },
  haftalikGunSayisi: number
) {
  try {
    const davaci = {
      startDate: davaciBeyani?.startDate || "",
      endDate: davaciBeyani?.endDate || "",
      startTime: davaciBeyani?.startTime || "",
      endTime: davaciBeyani?.endTime || "",
      haftalikGunSayisi: Number(haftalikGunSayisi) || 6,
    };
    const witnesses = (beyanlar || [])
      .filter((b) => (b?.type || '').toLowerCase() === 'tanik')
      .map((b) => ({
        dateIn: b?.startDate || '',
        dateOut: b?.endDate || '',
        in: b?.startTime || '',
        out: b?.endTime || '',
      }));
    return generateDynamicIntervalsFromWitnesses(davaci, witnesses);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[intervalHelper] generateDynamicIntervals wrapper error:', e);
    return [] as any[];
  }
}
export interface WorkInterval {
  start: string;
  end: string;
  dailyWork: number;
  weeklyWork: number;
  weeklyOvertime: number;
}

// Asgari ücret dönemleri 6 aylık olan yıllar
const HALF_YEAR_YEARS = [2016, 2018, 2020, 2021, 2022, 2023];

// 2000–2025 kapsamlı dönem tablosu, yarım yıl bölünmesi gereken yılları işaretler
const ASGARI_UCRET_DONEMLERI: Array<{ year: number; half: boolean }> = [
  { year: 2000, half: false },
  { year: 2001, half: false },
  { year: 2002, half: false },
  { year: 2003, half: false },
  { year: 2004, half: false },
  { year: 2005, half: false },
  { year: 2006, half: false },
  { year: 2007, half: false },
  { year: 2008, half: false },
  { year: 2009, half: false },
  { year: 2010, half: false },
  { year: 2011, half: false },
  { year: 2012, half: false },
  { year: 2013, half: false },
  { year: 2014, half: false },
  { year: 2015, half: false },
  { year: 2016, half: true },
  { year: 2017, half: false },
  { year: 2018, half: true },
  { year: 2019, half: false },
  { year: 2020, half: true },
  { year: 2021, half: true },
  { year: 2022, half: true },
  { year: 2023, half: true },
  { year: 2024, half: false },
  { year: 2025, half: false },
];

function isHalfYearPeriod(year: number): boolean {
  const found = ASGARI_UCRET_DONEMLERI.find((p) => p.year === year);
  return !!found?.half;
}

// Davacı beyanı saat sınırları
const DAVACI_MIN = "07:30";
const DAVACI_MAX = "17:30";

function clampTime(time: string | undefined, min: string, max: string) {
  if (!time) return min;
  const [h, m] = time.split(":").map(Number);
  const [minH, minM] = min.split(":").map(Number);
  const [maxH, maxM] = max.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0);
  const minTotal = (minH || 0) * 60 + (minM || 0);
  const maxTotal = (maxH || 0) * 60 + (maxM || 0);
  if (total < minTotal) return min;
  if (total > maxTotal) return max;
  return time;
}

// Tanık dönemlerini sıralar, çakışmaları keser ve davacı sınırını uygular (native Date)
export function mergeWitnessIntervals(
  witnesses: any[],
  davaciMin: string = DAVACI_MIN,
  davaciMax: string = DAVACI_MAX
) {
  // Merge disabled by policy. Only normalize times and sort.
  const sorted = (witnesses || [])
    .map((w) => {
      const rawStart = w.in || w.gir || w.giris || w.startTime || w.start;
      const rawEnd = w.out || w.cik || w.cikis || w.endTime || w.end;
      const giris = clampTime(rawStart, davaciMin, davaciMax);
      const cikis = clampTime(rawEnd, davaciMin, davaciMax);
      const s = parseDateString(String(w.dateIn || w.baslangic || w.startDate));
      const e = parseDateString(String(w.dateOut || w.bitis || w.endDate));
      return { start: s, end: e, giris, cikis };
    })
    .filter((w) => !Number.isNaN(w.start.getTime()) && !Number.isNaN(w.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return sorted;
}

// 6 aylık alt dönemlere böl (native Date)
export function splitIntoSixMonthPeriods(
  intervals: Array<{ start: Date; end: Date; giris: string; cikis: string }>
) {
  debug('📥 splitIntoSixMonthPeriods INPUT intervals:', intervals);
  const results: Array<{ start: Date; end: Date; giris: string; cikis: string }> = [];

  const addMonthsUTC = (d: Date, months: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  const addDaysUTC2 = (d: Date, days: number) => {
    const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    nd.setUTCDate(nd.getUTCDate() + days);
    return nd;
  };

  for (const item of intervals) {
    let tempStart = new Date(Date.UTC(item.start.getUTCFullYear(), item.start.getUTCMonth(), item.start.getUTCDate()));
    const end = new Date(Date.UTC(item.end.getUTCFullYear(), item.end.getUTCMonth(), item.end.getUTCDate()));

    while (tempStart.getTime() <= end.getTime()) {
      const tempEnd = addDaysUTC2(addMonthsUTC(tempStart, 6), -1);
      const sliceEnd = tempEnd.getTime() > end.getTime() ? end : tempEnd;

      results.push({
        start: tempStart,
        end: sliceEnd,
        giris: item.giris,
        cikis: item.cikis,
      });

      tempStart = addDaysUTC2(sliceEnd, 1);
    }
  }
  debug('📆 6 Aylık Bölünme (splitIntoSixMonthPeriods):', results.map(r => `${formatTR_DDMMYYYY(r.start)} - ${formatTR_DDMMYYYY(r.end)}`));
  return results;
}

// ----- Dayjs tabanlı ek yardımcılar -----
function timeToMinutes(t: string): number {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(totalMin: number): string {
  const h = Math.floor((totalMin || 0) / 60);
  const min = Math.max(0, (totalMin || 0) % 60);
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

export function normalizeData(davaci: any, witnesses: any[]) {
  debug('🎯 INPUT Davacı (normalizeData):', davaci);
  debug('🎯 INPUT Tanıklar (normalizeData):', witnesses);
  const davaciStart = parseDateString(String(davaci?.dateIn || ''));
  const davaciEnd = parseDateString(String(davaci?.dateOut || ''));
  const davaciIn = timeToMinutes(davaci?.in || "00:00");
  const davaciOut = timeToMinutes(davaci?.out || "23:59");

  const normalized = (witnesses || [])
    .map((w: any) => {
      const s = parseDateString(String(w?.dateIn || w?.baslangic || w?.startDate || ''));
      const e = parseDateString(String(w?.dateOut || w?.bitis || w?.endDate || ''));
      return {
        start: s,
        end: e,
        startTime: Math.max(timeToMinutes(w?.in || w?.gir || w?.giris || w?.startTime || "00:00"), davaciIn),
        endTime: Math.min(timeToMinutes(w?.out || w?.cik || w?.cikis || w?.endTime || "23:59"), davaciOut),
      };
    })
    .filter((w) => !Number.isNaN(w.start.getTime()) && !Number.isNaN(w.end.getTime()))
    .filter((w) => w.start.getTime() <= davaciEnd.getTime() && w.end.getTime() >= davaciStart.getTime());

  debug('🧩 Normalize Edilmiş Tanıklar (normalizeData):', normalized);
  return { davaciStart, davaciEnd, normalized };
}

export function mergeTimelines(witnesses: Array<{ start: Date; end: Date; startTime: number; endTime: number }>) {
  // Only sorting; no merge
  return [...(witnesses || [])].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function splitIntoHalfYears(period: { start: Date; end: Date; startTime: number; endTime: number }) {
  const result: Array<{ start: Date; end: Date; startTime: number; endTime: number }> = [];
  const mkDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
  let cursor = mkDate(period.start.getUTCFullYear(), period.start.getUTCMonth(), period.start.getUTCDate());
  const endAll = mkDate(period.end.getUTCFullYear(), period.end.getUTCMonth(), period.end.getUTCDate());

  while (cursor.getTime() <= endAll.getTime()) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const nextBoundary = month < 6 ? mkDate(year, 5, 30) : mkDate(year, 11, 31);
    const sliceEnd = nextBoundary.getTime() < endAll.getTime() ? nextBoundary : endAll;
    result.push({ start: cursor, end: sliceEnd, startTime: period.startTime, endTime: period.endTime });
    const next = new Date(sliceEnd.getTime());
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next;
  }
  debug('📆 6 Aylık Bölünme (splitIntoHalfYears):', result.map(r => `${formatTR_DDMMYYYY(r.start)} - ${formatTR_DDMMYYYY(r.end)}`));
  return result;
}

export function generateDynamicIntervalsNormalized(davaci: any, witnesses: any[]) {
  debug('🎯 generateDynamicIntervalsNormalized INPUT davaci:', davaci);
  debug('🎯 generateDynamicIntervalsNormalized INPUT witnesses:', witnesses);
  const { davaciStart, davaciEnd, normalized } = normalizeData(davaci, witnesses);
  if (!normalized.length) return [] as any[];

  const merged = mergeTimelines(normalized);

  const finalIntervals: Array<{ start: Date; end: Date; startTime: number; endTime: number }> = [];
  for (const p of merged) {
    const halfYears = splitIntoHalfYears(p);
    finalIntervals.push(...halfYears);
  }

  const results = finalIntervals.map((p) => {
    const daily = (p.endTime - p.startTime) / 60 - 1;
    const weekly = daily * 6;
    const overtime = Math.max(0, daily - 9);
    return {
      donem: `${formatTR_DDMMYYYY(p.start)} – ${formatTR_DDMMYYYY(p.end)}`,
      gunluk: daily.toFixed(2),
      haftalik: weekly,
      fazlaMesai: overtime > 0 ? overtime.toFixed(2) : "0.00",
      giris: minutesToTime(p.startTime),
      cikis: minutesToTime(p.endTime),
      davaciStart: formatTR_DDMMYYYY(davaciStart),
      davaciEnd: formatTR_DDMMYYYY(davaciEnd),
    } as any;
  });
  debug('✅ Nihai Sonuçlar (generateDynamicIntervalsNormalized):', results);
  return results;
}

// Yardımcı: HH:mm biçiminde saat farkı (eksik saat korumalı)
function timeDiffInHours(startTime: string | undefined, endTime: string | undefined): number {
  if (!startTime || !endTime) {
    // eslint-disable-next-line no-console
    console.warn("Eksik saat bilgisi:", { startTime, endTime });
    return 0;
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let diff = (endH * 60 + endM) - (startH * 60 + startM);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

// Tek dönem hesap (Date tabanlı)
function formatTR_DDMMYYYY(d: Date): string {
  try {
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${dd}.${m}.${y}`;
  }
}

function calculateOneInterval(start: Date, end: Date, w: WitnessInterval): WorkInterval {
  const daily = timeDiffInHours(w.startTime, w.endTime) - 1; // 1 saat mola
  const weekly = daily * 6; // haftada 6 gün
  const overtime = weekly > 45 ? weekly - 45 : 0;
  return {
    start: formatTR_DDMMYYYY(start),
    end: formatTR_DDMMYYYY(end),
    dailyWork: Number(daily.toFixed(2)),
    weeklyWork: Number(weekly.toFixed(2)),
    weeklyOvertime: Number(overtime.toFixed(2)),
  };
}

// Ana hesaplama: tanık bazlı, 6 aylık yılı böler (Date tabanlı)
export function calculateIntervals(
  witnesses: any[],
  davaciMin: string = DAVACI_MIN,
  davaciMax: string = DAVACI_MAX
) {
  debug('🎯 calculateIntervals INPUT witnesses:', witnesses);
  debug('🎯 calculateIntervals INPUT davaciMin/Max:', { davaciMin, davaciMax });
  const merged = mergeWitnessIntervals(witnesses, davaciMin, davaciMax);
  const periods = splitIntoSixMonthPeriods(merged);
  debug('📊 calculateIntervals merged size / periods size:', { merged: merged.length, periods: periods.length });
  const results: any[] = [];

  periods.forEach((p) => {
    const dailyHours = timeDiffInHours(p.giris, p.cikis) - 1; // 1 saat mola
    const weeklyHours = dailyHours * 6;
    const overtime = Math.max(0, weeklyHours - 45);

    results.push({
      donem: `${formatTR_DDMMYYYY(p.start)} – ${formatTR_DDMMYYYY(p.end)}`,
      gunluk: dailyHours.toFixed(2),
      haftalik: weeklyHours.toFixed(2),
      fazlaMesai: overtime.toFixed(2),
      giris: p.giris,
      cikis: p.cikis,
    });
  });

  return results;
}

export interface RawInterval { start: string; end: string }

// Türk ve ISO formatlarını destekleyen tarih parse
export function parseDateString(dateString: string): Date {
  if (!dateString) return new Date();

  // Türk formatı: gg.aa.yyyy
  const turkishDateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const match = dateString.match(turkishDateRegex);
  if (match) {
    const [_, day, month, year] = match;
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  // ISO formatı destekleniyorsa direkt dön
  return new Date(dateString);
}

// Normalize time like "8.30" or "8:30" -> "08:30"
function normalizeTime(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().replace(".", ":");
  const [hs, ms] = clean.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Normalize date like "dd.MM.yyyy" -> "yyyy-MM-dd"
function normalizeDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.includes(".")) {
    const [gun, ay, yil] = s.split(".");
    return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
  }
  return s;
}

// Parse flexible date 'yyyy-MM-dd' or 'dd.MM.yyyy' to UTC Date
function parseFlexibleDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(t)) {
    const [d, m, y] = t.split('.').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  }
  return null;
}

function toISODateUTC2(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDaysUTC(d: Date, days: number): Date {
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}
 
export function generateDynamicIntervalsFromWitnesses(davaci: any, witnesses: any[]) {
  const toDate = (d: string) => parseFlexibleDate(String(d) || "");
  const minDate = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);
  const maxDate = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

  if (!davaci || !witnesses || witnesses.length === 0) {
    debug('⛔ Tanık beyanı bulunamadı veya eksik veri:', { davaci, witnesses });
    return [] as any[];
  }

  debug('🎯 generateDynamicIntervalsFromWitnesses input:', { davaci, witnesses });
  const out: Array<{ start: Date; end: Date; in?: string; out?: string }> = [];
  const dStart = toDate(davaci.startDate);
  const dEnd = toDate(davaci.endDate);
  if (!dStart || !dEnd) return [] as any[];

  const raw = (witnesses || [])
    .map((w) => ({
      startDate: toDate(w?.dateIn || w?.startDate || ''),
      endDate: toDate(w?.dateOut || w?.endDate || ''),
      in: w?.in || w?.startTime || '',
      out: w?.out || w?.endTime || '',
    }))
    .filter((x): x is { startDate: Date; endDate: Date; in: string; out: string } => 
      x.startDate !== null && x.endDate !== null && !Number.isNaN(x.startDate.getTime()) && !Number.isNaN(x.endDate.getTime()))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  for (const w of raw) {
    const s = maxDate(w.startDate, dStart);
    const e = minDate(w.endDate, dEnd);
    if (e.getTime() < s.getTime()) continue;

    if (out.length > 0 && s) {
      const last = out[out.length - 1];
      try {
        if (last.end.getTime() >= s.getTime()) {
          const fixedEnd = new Date(s.getTime());
          fixedEnd.setUTCDate(fixedEnd.getUTCDate() - 1);
          if (fixedEnd.getTime() >= last.start.getTime()) last.end = fixedEnd;
        }
      } catch {}
    }

    out.push({ start: s, end: e, in: w.in, out: w.out });
  }

  const final = out.map((m) => applyClaimantHours({ start: m.start, end: m.end, in: m.in, out: m.out } as any, davaci));
  debug('✅ Nihai aralıklar (generateDynamicIntervalsFromWitnesses):', final);
  return final as any[];
}

// Calculate weekly overtime per interval using 45h rule
export function calculateOvertimeHours(
  intervals: Array<{ start: string; end: string; start_time: string; end_time: string; haftalikGun: number; claimant_start_time?: string; claimant_end_time?: string }>
) {
  // ... (other exports remain unchanged)
  const round2 = (n: number) => Number((n ?? 0).toFixed(2));
  const NORMAL = 48; // Günlük çalışanlar için haftalık çalışma limiti 48 saat

  const sorted = [...(intervals || [])].sort((a, b) => (a.start || "").localeCompare(b.start || ""));

  const results = sorted.map((it) => {
    let st = normalizeTime(it.start_time) || "";
    let et = normalizeTime(it.end_time) || "";

    const timeDiffHours = (startHHMM: string, endHHMM: string) => {
      try {
        const s = new Date(`1970-01-01T${startHHMM}:00`);
        const e = new Date(`1970-01-01T${endHHMM}:00`);
        let diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
        if (!Number.isFinite(diff)) return 0;
        if (diff < 0) diff += 24; // overnight wrap
        return diff;
      } catch { return 0; }
    };

    let gunlukBrut = timeDiffHours(st, et);
    // Ara dinlenme – 4857/68 + Yargıtay: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h
    const computeBreakHours = (dailyGross: number) => {
      if (!Number.isFinite(dailyGross) || dailyGross <= 0) return 0;
      if (dailyGross <= 4) return 0.25;
      if (dailyGross <= 7.5) return 0.5;
      if (dailyGross < 11) return 1;
      if (dailyGross < 14) return 1.5;
      if (dailyGross < 15) return 2;
      return 3;
    };
    const breakHours = computeBreakHours(gunlukBrut);
    const gunluk = Math.max(0, gunlukBrut - breakHours);
    const haftalikGun = parseInt(String(it.haftalikGun ?? 6), 10);
    const haftalik = gunluk * haftalikGun;
    const fm = Math.max(0, haftalik - NORMAL);

    return {
      start: it.start,
      end: it.end,
      start_time: st,
      end_time: et,
      haftalikGun: Number(it.haftalikGun) || 0,
      brutCalisma: round2(gunlukBrut),
      gunlukSaat: round2(gunluk),
      haftalikCalisma: round2(haftalik),
      fazlaMesai: round2(fm),
    };
  });

  const toplamFazlaMesai = results.reduce((acc, r) => acc + (r.fazlaMesai || 0), 0);
  const weeklyAverage = results.length ? Number((toplamFazlaMesai / results.length).toFixed(2)) : 0;
  return { results, toplamFazlaMesai, weeklyAverage };
}