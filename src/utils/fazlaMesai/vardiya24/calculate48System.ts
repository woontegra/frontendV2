import type { ExcludedDay } from "@/shared/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import type { WorkDay } from "./generateWorkDays48";
import { dedupeWorkDaysByDate, generateWorkDays48 } from "./generateWorkDays48";
import { applyExclusions48, buildEffectiveUbgtDates } from "./applyExclusions48";
import { getAnchorWeekBucketKey, groupWeeks48, type Weekly48Row } from "./groupWeeks48";

export type PeriodSummary48Row = {
  startDate: string;
  endDate: string;
  weekType: string;
  weekCount: number;
  weeklyFmHours: number;
  note?: string;
  beforeWeekType?: string;
};

export type Calculate48DebugStage = {
  label: string;
  rows: Array<{
    startDate: string;
    endDate: string;
    weekType: string;
    weekCount: number;
    weeklyFmHours: number;
    note?: string;
  }>;
};

export type Calculate48AggregationDebugInfo = {
  input: { startDate: string; endDate: string; anchorIsWorkDay: boolean; exclusionCount: number };
  generatedDayCount: number;
  baselineWeekCount: number;
  afterExclusionWeekCount: number;
  exclusionHits: Array<{
    weekStart: string;
    beforeWorkDays: number;
    afterWorkDays: number;
    beforeFmHours: number;
    afterFmHours: number;
    note: string;
    matchedExclusions: string[];
  }>;
  stages: Calculate48DebugStage[];
};

function parseISODateLocal(iso: string): Date | null {
  const raw = String(iso || "").trim();
  if (!raw) return null;
  const s = raw.slice(0, 10);

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(+dt)) return dt;
  }

  // dd.mm.yyyy
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (tr) {
    const d = Number(tr[1]);
    const m = Number(tr[2]);
    const y = Number(tr[3]);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(+dt)) return dt;
  }

  // Date-like fallback
  const any = new Date(raw);
  if (!Number.isNaN(+any)) return new Date(any.getFullYear(), any.getMonth(), any.getDate());
  return null;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function dateMax(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function dateMin(a: Date, b: Date): Date {
  return a < b ? a : b;
}

/** Verilen takvim penceresinde hangi dışlama türleri varsa ona göre cetvel notu. */
function exclusionNoteForClippedWindow(
  winStart: Date,
  winEnd: Date,
  exclusions: ExcludedDay[] | null | undefined
): string {
  if (!exclusions?.length || winStart > winEnd) return "";

  const nIzin = countAnnualLeaveCalendarDaysInWindow(winStart, winEnd, exclusions, null, ["Yıllık İzin"]);
  const nUbgt = countAnnualLeaveCalendarDaysInWindow(winStart, winEnd, exclusions, null, ["UBGT"]);
  const nOther = countAnnualLeaveCalendarDaysInWindow(winStart, winEnd, exclusions, null, ["Rapor", "Diğer", "Puantaj/Bordro"]);

  const hasI = nIzin > 0;
  const hasU = nUbgt > 0;
  const hasO = nOther > 0;
  const nTypes = (hasI ? 1 : 0) + (hasU ? 1 : 0) + (hasO ? 1 : 0);

  if (nTypes === 0) return "";
  if (nTypes === 1) {
    if (hasI) return "(Yıllık izin düşümü uygulanmıştır)";
    if (hasU) return "(UBGT düşümü uygulanmıştır)";
    return "(Rapor/diğer dışlama düşümü uygulanmıştır)";
  }
  if (nTypes === 2) {
    if (hasI && hasU) return "(Yıllık izin ve UBGT düşümü uygulanmıştır)";
    if (hasI && hasO) return "(Yıllık izin ve rapor/diğer dışlama uygulanmıştır)";
    if (hasU && hasO) return "(UBGT ve rapor/diğer dışlama uygulanmıştır)";
  }
  return "(Çalışılmayan gün dışlaması uygulanmıştır)";
}

/** ISO haftası (Pzt–Paz) ile global dönemin kesişimine göre cetvel notu. */
function exclusionNoteForIsoWeek(
  weekStartMondayISO: string,
  globalStart: string,
  globalEnd: string,
  exclusions: ExcludedDay[] | null | undefined
): string {
  const mon = parseISODateLocal(weekStartMondayISO);
  const gs = parseISODateLocal(globalStart);
  const ge = parseISODateLocal(globalEnd);
  if (!mon || !gs || !ge) return "";

  const sun = addDaysLocal(mon, 6);
  const winStart = dateMax(mon, gs);
  const winEnd = dateMin(sun, ge);
  return exclusionNoteForClippedWindow(winStart, winEnd, exclusions);
}

function matchedExclusionsForIsoWeek(
  weekStartMondayISO: string,
  globalStart: string,
  globalEnd: string,
  exclusions: ExcludedDay[] | null | undefined
): string[] {
  if (!exclusions?.length) return [];
  const mon = parseISODateLocal(weekStartMondayISO);
  const gs = parseISODateLocal(globalStart);
  const ge = parseISODateLocal(globalEnd);
  if (!mon || !gs || !ge) return [];
  const sun = addDaysLocal(mon, 6);
  const winStart = dateMax(mon, gs);
  const winEnd = dateMin(sun, ge);
  if (winStart > winEnd) return [];
  const out: string[] = [];
  exclusions.forEach((ex) => {
    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) return;
    const ovStart = dateMax(s, winStart);
    const ovEnd = dateMin(e, winEnd);
    if (ovStart > ovEnd) return;
    out.push(`${ex.type || "Dışlama"}:${String(ex.start).slice(0, 10)}-${String(ex.end).slice(0, 10)}`);
  });
  return out;
}

function firstMatchedExclusionDateForIsoWeek(
  weekStartMondayISO: string,
  globalStart: string,
  globalEnd: string,
  exclusions: ExcludedDay[] | null | undefined
): string | null {
  if (!exclusions?.length) return null;
  const mon = parseISODateLocal(weekStartMondayISO);
  const gs = parseISODateLocal(globalStart);
  const ge = parseISODateLocal(globalEnd);
  if (!mon || !gs || !ge) return null;
  const sun = addDaysLocal(mon, 6);
  const winStart = dateMax(mon, gs);
  const winEnd = dateMin(sun, ge);
  if (winStart > winEnd) return null;

  let first: string | null = null;
  exclusions.forEach((ex) => {
    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) return;
    const ovStart = dateMax(s, winStart);
    const ovEnd = dateMin(e, winEnd);
    if (ovStart > ovEnd) return;
    const d = toISODate(ovStart);
    if (!first || d < first) first = d;
  });
  return first;
}

type WagePeriod = {
  startDate: string;
  endDate: string;
};

function buildWagePeriods(startDate: string, endDate: string): WagePeriod[] {
  const s = parseISODateLocal(startDate);
  const e = parseISODateLocal(endDate);
  if (!s || !e || e < s) return [];

  const periods: WagePeriod[] = [];
  for (let y = s.getFullYear(); y <= e.getFullYear(); y++) {
    const yearStart = new Date(y, 0, 1);
    const yearEnd = new Date(y, 11, 31);

    const clipStart = yearStart < s ? s : yearStart;
    const clipEnd = yearEnd > e ? e : yearEnd;
    if (clipStart > clipEnd) continue;

    if (y >= 2022) {
      const h1End = new Date(y, 5, 30);
      const h2Start = new Date(y, 6, 1);
      const p1s = clipStart > yearStart ? clipStart : yearStart;
      const p1e = clipEnd < h1End ? clipEnd : h1End;
      if (p1s <= p1e) periods.push({ startDate: toISODate(p1s), endDate: toISODate(p1e) });

      const p2s = clipStart > h2Start ? clipStart : h2Start;
      const p2e = clipEnd;
      if (p2s <= p2e) periods.push({ startDate: toISODate(p2s), endDate: toISODate(p2e) });
    } else {
      periods.push({ startDate: toISODate(clipStart), endDate: toISODate(clipEnd) });
    }
  }
  return periods;
}

function findPeriodForDate(periods: WagePeriod[], date: string): WagePeriod | null {
  const d = String(date).slice(0, 10);
  for (const p of periods) {
    if (d >= p.startDate && d <= p.endDate) return p;
  }
  return null;
}

function roundedWeeksBetween(startIso: string, endIso: string): number {
  const s = parseISODateLocal(String(startIso).slice(0, 10));
  const e = parseISODateLocal(String(endIso).slice(0, 10));
  if (!s || !e || e < s) return 0;
  const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(0, Math.round(days / 7));
}

function normalize48PeriodDistribution(rows: PeriodSummary48Row[]): PeriodSummary48Row[] {
  if (!rows.length) return rows;
  const out = rows.map((r) => ({ ...r }));
  const byPeriod = new Map<string, number[]>();
  out.forEach((r, idx) => {
    const key = `${String(r.startDate).slice(0, 10)}|${String(r.endDate).slice(0, 10)}`;
    const arr = byPeriod.get(key) || [];
    arr.push(idx);
    byPeriod.set(key, arr);
  });

  const trRe = /\((\d+)\s*->\s*(\d+)\s*gün\)/i;

  byPeriod.forEach((idxs, key) => {
    const [ps, pe] = key.split("|");
    if (!ps || !pe) return;

    const transitionWeeks = out.reduce((acc, r) => {
      const note = String(r.note || "");
      if (!trRe.test(note)) return acc;
      const rs = String(r.startDate || "").slice(0, 10);
      const re = String(r.endDate || "").slice(0, 10);
      if (!rs || !re) return acc;
      // Geçiş satırları ayrı 7 günlük anahtarda gelebilir; dönem içinde kalanları toplamdan düş.
      if (rs < ps || re > pe) return acc;
      return acc + Math.max(0, Math.round(Number(r.weekCount) || 0));
    }, 0);

    const notelessIdxs = idxs.filter((i) => !String(out[i].note || "").trim());
    if (!notelessIdxs.length) return;

    const expected = Math.max(0, roundedWeeksBetween(ps, pe) - transitionWeeks);
    const totalRounded = Math.max(0, roundedWeeksBetween(ps, pe));
    const idx3 = notelessIdxs.find((i) => Number(out[i].weekType) === 3) ?? -1;
    const idx2 = notelessIdxs.find((i) => Number(out[i].weekType) === 2) ?? -1;

    if (idx3 >= 0 && idx2 >= 0) {
      // Sabit kural: baz dağılımı (drop yokmuş gibi) kur, düşümü önce 2 gün satırından yap.
      let base3 = Math.ceil(totalRounded / 2);
      let base2 = Math.floor(totalRounded / 2);
      let remainingDrop = Math.max(0, transitionWeeks);

      const cutFrom2 = Math.min(base2, remainingDrop);
      base2 -= cutFrom2;
      remainingDrop -= cutFrom2;

      if (remainingDrop > 0) {
        const cutFrom3 = Math.min(base3, remainingDrop);
        base3 -= cutFrom3;
        remainingDrop -= cutFrom3;
      }

      const actualTotal = Math.max(0, base3 + base2);
      const targetTotal = Math.max(0, expected);
      if (actualTotal !== targetTotal) {
        // Güvenlik: olası kenar durumda toplamı hedefe sabitle.
        let delta = targetTotal - actualTotal;
        while (delta > 0) {
          base2 += 1;
          delta -= 1;
        }
        while (delta < 0 && base2 > 0) {
          base2 -= 1;
          delta += 1;
        }
        while (delta < 0 && base3 > 0) {
          base3 -= 1;
          delta += 1;
        }
      }

      out[idx3].weekCount = base3;
      out[idx2].weekCount = base2;
      notelessIdxs.forEach((i) => {
        if (i !== idx3 && i !== idx2) out[i].weekCount = 0;
      });
      return;
    }

    if (idx3 >= 0) {
      out[idx3].weekCount = expected;
      notelessIdxs.forEach((i) => {
        if (i !== idx3) out[i].weekCount = 0;
      });
      return;
    }

    if (idx2 >= 0) {
      out[idx2].weekCount = expected;
      notelessIdxs.forEach((i) => {
        if (i !== idx2) out[i].weekCount = 0;
      });
    }
  });

  return out.filter((r) => (Number(r.weekCount) || 0) > 0);
}

function summarizeByWagePeriod(
  weeks: ReturnType<typeof groupWeeks48>,
  startDate: string,
  endDate: string,
  excludedWeekStarts?: Set<string>
): PeriodSummary48Row[] {
  const out: PeriodSummary48Row[] = [];
  type Bucket = { startDate: string; endDate: string; weekType: string; weekCount: number; weeklyFmHours: number };
  const buckets = new Map<string, Bucket>();
  const periods = buildWagePeriods(startDate, endDate);

  weeks.forEach((w) => {
    if (excludedWeekStarts?.has(w.weekStartMonday)) return;
    const period = findPeriodForDate(periods, w.weekStartMonday);
    if (!period) return;
    const weekType = String(Math.max(0, w.workDayCount));
    const key = `${period.startDate}|${period.endDate}|${weekType}`;
    const cur = buckets.get(key);
    if (!cur) {
      buckets.set(key, {
        startDate: period.startDate,
        endDate: period.endDate,
        weekType,
        weekCount: 1,
        weeklyFmHours: Math.max(0, w.workDayCount) * 3,
      });
      return;
    }
    cur.weekCount += 1;
  });

  out.push(...buckets.values());
  out.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    // Aynı dönemde 4->3->2->1 şeklinde göster; düşümle oluşan düşük tipler alta gelsin.
    return Number(b.weekType) - Number(a.weekType);
  });
  return out;
}

function buildWeekMap(weeks: Weekly48Row[]): Map<string, Weekly48Row> {
  const m = new Map<string, Weekly48Row>();
  weeks.forEach((w) => m.set(w.weekStartMonday, w));
  return m;
}

function inclusiveCalendarSpanDays(minISO: string, maxISO: string): number {
  const a = parseISODateLocal(minISO.slice(0, 10));
  const b = parseISODateLocal(maxISO.slice(0, 10));
  if (!a || !b) return 1;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function countWorkDaysBetween(workDays: WorkDay[], startISO: string, endISO: string): number {
  const s = startISO.slice(0, 10);
  const e = endISO.slice(0, 10);
  let n = 0;
  for (const d of workDays) {
    const dd = d.date.slice(0, 10);
    if (dd >= s && dd <= e && d.isWork) n += 1;
  }
  return n;
}

function clusterConsecutiveSortedDates(sorted: string[]): string[][] {
  if (!sorted.length) return [];
  const out: string[][] = [];
  let cur: string[] = [sorted[0].slice(0, 10)];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = parseISODateLocal(sorted[i - 1].slice(0, 10));
    const nextD = parseISODateLocal(sorted[i].slice(0, 10));
    if (!prev || !nextD) continue;
    const nextCal = addDaysLocal(prev, 1);
    if (toISODate(nextCal) === sorted[i].slice(0, 10)) cur.push(sorted[i].slice(0, 10));
    else {
      out.push(cur);
      cur = [sorted[i].slice(0, 10)];
    }
  }
  out.push(cur);
  return out;
}

function collectEffectiveExclusionAnchorDates(
  exclusions: ExcludedDay[] | null | undefined,
  workBaseline: WorkDay[]
): string[] {
  if (!exclusions?.length) return [];
  const out = new Set<string>();
  const effectiveUbgt = buildEffectiveUbgtDates(exclusions);
  const workdaySet = new Set(workBaseline.map((d) => String(d.date || "").slice(0, 10)).filter(Boolean));
  for (const ex of exclusions) {
    const type = String(ex.type || "").trim();
    if (!["UBGT", "Yıllık İzin", "Rapor", "Diğer"].includes(type)) continue;
    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) continue;
    const capRaw = Number(ex.days);
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : null;
    const cur = new Date(s);
    let used = 0;
    while (cur <= e) {
      if (cap != null && used >= cap) break;
      const key = toISODate(cur);
      if (!workdaySet.has(key)) {
        cur.setDate(cur.getDate() + 1);
        continue;
      }
      if (type === "UBGT") {
        if (effectiveUbgt.has(key)) out.add(key);
      } else {
        out.add(key);
      }
      used += 1;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const a1 = startA.slice(0, 10);
  const a2 = endA.slice(0, 10);
  const b1 = startB.slice(0, 10);
  const b2 = endB.slice(0, 10);
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 <= b2 && b1 <= a2;
}

function mergeUbgtChangedRowsIntoSevenDayEnvelope(
  changedRows: PeriodSummary48Row[],
  exclusions: ExcludedDay[] | null | undefined,
  globalStart: string,
  globalEnd: string,
  anchorStart: string,
  workBaseline: WorkDay[],
  workAfter: WorkDay[]
): PeriodSummary48Row[] {
  if (!exclusions?.length) return changedRows;

  const transitionRe = /\(\d+\s*->\s*\d+\s*gün\)/i;
  // Not metni her zaman "UBGT" içermeyebiliyor; geçiş satırlarını esas al.
  const ubgtRows = changedRows.filter((r) => transitionRe.test(String(r.note || "")));
  if (!ubgtRows.length) return changedRows;

  const effective = collectEffectiveExclusionAnchorDates(exclusions, workBaseline);
  if (!effective.length) return changedRows;

  const clusters = clusterConsecutiveSortedDates(effective);
  const otherChanged = changedRows.filter((r) => !transitionRe.test(String(r.note || "")));
  const consumed = new Set<PeriodSummary48Row>();
  const mergedUbgt: PeriodSummary48Row[] = [];

  for (const C of clusters) {
    const bucketKeys = new Set<string>();
    for (const d of C) {
      const k = getAnchorWeekBucketKey(d, anchorStart);
      if (k) bucketKeys.add(k);
    }
    if (!bucketKeys.size) continue;

    const clusterMin = C[0].slice(0, 10);
    const clusterMax = C[C.length - 1].slice(0, 10);
    const span = inclusiveCalendarSpanDays(clusterMin, clusterMax);
    const minD = parseISODateLocal(clusterMin);
    if (!minD) continue;
    let envEnd = toISODate(addDaysLocal(minD, Math.max(6, span - 1)));
    const ge = parseISODateLocal(globalEnd.slice(0, 10));
    const envEndD = parseISODateLocal(envEnd);
    if (ge && envEndD && envEndD > ge) envEnd = globalEnd.slice(0, 10);

    const rowsIn = ubgtRows.filter((r) => {
      if (consumed.has(r)) return false;
      const ks = getAnchorWeekBucketKey(r.startDate.slice(0, 10), anchorStart);
      const ke = getAnchorWeekBucketKey(r.endDate.slice(0, 10), anchorStart);
      if (ks && bucketKeys.has(ks)) return true;
      if (ke && bucketKeys.has(ke)) return true;
      // Seçilen gün blok başlangıcıdır: kova kayması olsa bile blokla çakışan satırları birleştir.
      if (rangesOverlap(r.startDate, r.endDate, clusterMin, envEnd)) return true;
      return false;
    });

    if (!rowsIn.length) continue;
    rowsIn.forEach((r) => consumed.add(r));

    const beforeC = countWorkDaysBetween(workBaseline, clusterMin, envEnd);
    const afterC = countWorkDaysBetween(workAfter, clusterMin, envEnd);
    const gs = parseISODateLocal(globalStart.slice(0, 10));
    const winStart = gs && minD ? dateMax(minD, gs) : minD;
    const winEnd = ge && envEndD ? dateMin(envEndD, ge) : envEndD;
    let note =
      winStart && winEnd ? exclusionNoteForClippedWindow(winStart, winEnd, exclusions) : "";
    if (!note.trim()) note = "(UBGT düşümü uygulanmıştır)";

    mergedUbgt.push({
      startDate: clusterMin,
      endDate: envEnd,
      weekType: String(afterC),
      beforeWeekType: String(beforeC),
      weekCount: 1,
      weeklyFmHours: afterC * 3,
      note: `${note} (${beforeC}->${afterC} gün)`,
    });
  }

  const leftoverUbgt = ubgtRows.filter((r) => !consumed.has(r));
  const allUbgt = [...mergedUbgt, ...leftoverUbgt].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return [...otherChanged, ...allUbgt];
}

export type AggregateWeeklyBucketsMergeOpts = {
  anchorStart: string;
  workBaseline: WorkDay[];
  workAfter: WorkDay[];
};

/**
 * 7 günlük kova çıktısından ücret dönemi özeti + tavan/denge (48 saat vardiya motoru; 24’ten kopya).
 */
function aggregateWeeklyBucketsToPeriodRows(
  baselineWeeks: Weekly48Row[],
  weeksAfter: Weekly48Row[],
  globalStart: string,
  globalEnd: string,
  exclusions: ExcludedDay[] | null | undefined
): {
  rows: PeriodSummary48Row[];
  exclusionHits: Calculate48AggregationDebugInfo["exclusionHits"];
  stages: Calculate48DebugStage[];
} {
  const baselineMap = buildWeekMap(baselineWeeks);
  const afterMap = buildWeekMap(weeksAfter);
  const changedWeekStarts = new Set<string>();
  let changedRows: PeriodSummary48Row[] = [];
  const exclusionHits: Calculate48AggregationDebugInfo["exclusionHits"] = [];

  baselineMap.forEach((beforeWeek, key) => {
    const afterWeek = afterMap.get(key);
    const keyStart = key.slice(0, 10);
    const keyStartD = parseISODateLocal(keyStart);
    const keyEnd = keyStartD ? toISODate(addDaysLocal(keyStartD, 6)) : keyStart;
    const matchedStart =
      firstMatchedExclusionDateForIsoWeek(key, globalStart, globalEnd, exclusions) ||
      (keyStart < globalStart ? globalStart : keyStart);
    const matchedStartD = parseISODateLocal(matchedStart);
    const matchedEnd = matchedStartD ? toISODate(addDaysLocal(matchedStartD, 6)) : keyEnd;
    const rowStart = matchedStart < globalStart ? globalStart : matchedStart;
    const rowEnd = matchedEnd > globalEnd ? globalEnd : matchedEnd;
    if (!afterWeek) {
      changedWeekStarts.add(key);
      const note = exclusionNoteForIsoWeek(key, globalStart, globalEnd, exclusions);
      const beforeType = String(beforeWeek.workDayCount);
      changedRows.push({
        startDate: rowStart,
        endDate: rowEnd,
        weekType: "0",
        beforeWeekType: beforeType,
        weekCount: 1,
        weeklyFmHours: 0,
        note: `${note} (${beforeType}->0 gün)`,
      });
      exclusionHits.push({
        weekStart: key,
        beforeWorkDays: beforeWeek.workDayCount,
        afterWorkDays: 0,
        beforeFmHours: beforeWeek.workDayCount * 3,
        afterFmHours: 0,
        note,
        matchedExclusions: matchedExclusionsForIsoWeek(key, globalStart, globalEnd, exclusions),
      });
      return;
    }
    if (beforeWeek.workDayCount !== afterWeek.workDayCount) {
      changedWeekStarts.add(key);
      const note = exclusionNoteForIsoWeek(key, globalStart, globalEnd, exclusions);
      const beforeType = String(beforeWeek.workDayCount);
      changedRows.push({
        startDate: rowStart,
        endDate: rowEnd,
        weekType: String(afterWeek.workDayCount),
        beforeWeekType: beforeType,
        weekCount: 1,
        weeklyFmHours: afterWeek.workDayCount * 3,
        note: `${note} (${beforeType}->${afterWeek.workDayCount} gün)`,
      });
      exclusionHits.push({
        weekStart: key,
        beforeWorkDays: beforeWeek.workDayCount,
        afterWorkDays: afterWeek.workDayCount,
        beforeFmHours: beforeWeek.workDayCount * 3,
        afterFmHours: afterWeek.workDayCount * 3,
        note,
        matchedExclusions: matchedExclusionsForIsoWeek(key, globalStart, globalEnd, exclusions),
      });
    }
  });

  const summaryRows = summarizeByWagePeriod(weeksAfter, globalStart, globalEnd, changedWeekStarts);
  const mergedRows = [...summaryRows, ...changedRows].filter((r) => (Number(r.weekCount) || 0) > 0);
  const normalizedRows = normalize48PeriodDistribution(mergedRows);
  const sortedRows = normalizedRows.sort((a, b) =>
    a.startDate === b.startDate
      ? Number(b.weekType) - Number(a.weekType)
      : a.startDate.localeCompare(b.startDate)
  );

  return {
    rows: sortedRows,
    exclusionHits,
    stages: [
      { label: "summaryRows", rows: summaryRows },
      { label: "changedRows", rows: changedRows },
      { label: "summaryPlusChanged", rows: mergedRows },
      { label: "normalizedRows", rows: normalizedRows },
      { label: "finalRows", rows: sortedRows },
    ],
  };
}

function periodWeekCap(period: WagePeriod): number | null {
  const y = period.startDate.slice(0, 4);
  if (period.startDate === `${y}-01-01` && period.endDate === `${y}-12-31`) return 52;
  if (period.startDate === `${y}-01-01` && period.endDate === `${y}-06-30`) return 26;
  if (period.startDate === `${y}-07-01` && period.endDate === `${y}-12-31`) return 26;
  return null;
}

function enforcePeriodWeekCaps(rows: PeriodSummary48Row[], startDate: string, endDate: string): PeriodSummary48Row[] {
  if (!rows.length) return rows;
  const periods = buildWagePeriods(startDate, endDate);
  if (!periods.length) return rows;

  const out = rows.map((r) => ({ ...r }));
  const byPeriod = new Map<string, number[]>();
  out.forEach((r, idx) => {
    const p = findPeriodForDate(periods, r.startDate);
    if (!p) return;
    const key = `${p.startDate}|${p.endDate}`;
    const arr = byPeriod.get(key) || [];
    arr.push(idx);
    byPeriod.set(key, arr);
  });

  byPeriod.forEach((idxs, key) => {
    const [ps, pe] = key.split("|");
    const cap = periodWeekCap({ startDate: ps, endDate: pe });
    if (cap == null) return;
    const total = idxs.reduce((acc, i) => acc + Math.max(0, Math.round(Number(out[i].weekCount) || 0)), 0);
    let overflow = total - cap;
    if (overflow <= 0) return;

    // Aşımı önce düşük FM saatli satırlardan düş: yüksek FM tarafında hafta korunur.
    const order = [...idxs].sort((a, b) => {
      const afm = Number(out[a].weeklyFmHours) || 0;
      const bfm = Number(out[b].weeklyFmHours) || 0;
      if (afm !== bfm) return afm - bfm;
      return (Number(out[a].weekType) || 0) - (Number(out[b].weekType) || 0);
    });

    for (const i of order) {
      if (overflow <= 0) break;
      const current = Math.max(0, Math.round(Number(out[i].weekCount) || 0));
      if (current <= 0) continue;
      const cut = Math.min(current, overflow);
      out[i].weekCount = current - cut;
      overflow -= cut;
    }
  });

  return out.filter((r) => (Number(r.weekCount) || 0) > 0);
}

/**
 * Bilirkişi dağıtım kuralı:
 * Aynı dönem içinde (notsuz) hafta tipleri birden fazlaysa,
 * toplam hafta iki bloğa dağıtılır; tek haftadaki +1 yüksek FM saatli bloğa verilir.
 */
function enforceWitnessSplitPolicy(rows: PeriodSummary48Row[], startDate: string, endDate: string): PeriodSummary48Row[] {
  if (!rows.length) return rows;
  // Notlu satır (UBGT geçişi vb.) varken tüm dengeyi iptal etme: notsuz satırlar aday olarak aşağıda filtrelenir.

  const periods = buildWagePeriods(startDate, endDate);
  if (!periods.length) return rows;
  const out = rows.map((r) => ({ ...r }));

  const byPeriod = new Map<string, number[]>();
  out.forEach((r, idx) => {
    const p = findPeriodForDate(periods, r.startDate);
    if (!p) return;
    const key = `${p.startDate}|${p.endDate}`;
    const arr = byPeriod.get(key) || [];
    arr.push(idx);
    byPeriod.set(key, arr);
  });

  byPeriod.forEach((idxs) => {
    // Geçiş satırları (örn. 3→1) notludur; aday listesine zaten girmiyorlar.
    // Dönemde böyle satır olsa bile notsuz 3 gün / 2 gün bloklarını 21/21 gibi dengelemek
    // için burada erken çıkış yapılmaz — aksi halde 14/28 gibi çarpık dağılım kalıyordu.

    // Notlu (UBGT/yıllık izin) satırlar dengeleme adayına girmez.
    // Ancak notlu satır var diye dönem genelindeki dengeleme tamamen iptal edilmez;
    // aksi halde aynı dönemde düşüm yokken 22/22 iken düşümle 14/29 gibi dengesizleşme oluşur.
    const candidates = idxs.filter((i) => !(out[i].note || "").trim());
    if (candidates.length < 2) return;
    const oneWeekCount = candidates.filter((i) => Math.round(Number(out[i].weekCount) || 0) === 1).length;

    const sortByHighFm = (arr: number[]) =>
      [...arr].sort((a, b) => {
        const afm = Number(out[a].weeklyFmHours) || 0;
        const bfm = Number(out[b].weeklyFmHours) || 0;
        if (afm !== bfm) return bfm - afm;
        return (Number(out[b].weekType) || 0) - (Number(out[a].weekType) || 0);
      });

    // İki satırlı blokta bilirkişi kuralı zorunlu:
    // toplam tek ise +1 yüksek FM saatli bloğa gider (örn. 4+5 -> 5+4).
    if (candidates.length === 2) {
      const total2 = candidates.reduce((acc, i) => acc + Math.max(0, Math.round(Number(out[i].weekCount) || 0)), 0);
      if (total2 > 0) {
        const sorted2 = sortByHighFm(candidates);
        const high2 = sorted2[0];
        const low2 = sorted2[1];
        out[high2].weekCount = Math.ceil(total2 / 2);
        out[low2].weekCount = Math.floor(total2 / 2);
      }
      return;
    }

    // Sınırda oluşan 1 gün/3 saat tekli hafta (ör. 8+9+1g) dağıtıma katılmaz, düşürülür.
    // Sonrasında kalan iki ana blok tekrar bilirkişi kuralına göre dengelenir (9/8; +1 yüksek FM'ye).
    if (candidates.length >= 3 && oneWeekCount === 1) {
      const singletonIdx = candidates.find((i) => Math.round(Number(out[i].weekCount) || 0) === 1);
      if (singletonIdx != null) {
        const singletonFm = Number(out[singletonIdx].weeklyFmHours) || 0;
        const singletonType = Number(out[singletonIdx].weekType) || 0;
        if (singletonFm <= 3 || singletonType <= 1) {
          out[singletonIdx].weekCount = 0;
          const remaining = candidates.filter((i) => i !== singletonIdx && (Number(out[i].weekCount) || 0) > 0);
          if (remaining.length >= 2) {
            const totalR = remaining.reduce((acc, i) => acc + Math.max(0, Math.round(Number(out[i].weekCount) || 0)), 0);
            const sortedR = sortByHighFm(remaining);
            const highR = sortedR[0];
            const lowR = sortedR[1];
            out[highR].weekCount = Math.ceil(totalR / 2);
            out[lowR].weekCount = Math.floor(totalR / 2);
            for (let k = 2; k < sortedR.length; k += 1) out[sortedR[k]].weekCount = 0;
          }
          return;
        }
      }
    }

    const totalWeeks = candidates.reduce((acc, i) => acc + Math.max(0, Math.round(Number(out[i].weekCount) || 0)), 0);
    if (totalWeeks <= 0) return;

    const sorted = sortByHighFm(candidates);

    const high = sorted[0];
    const low = sorted[1];
    const highWeeks = Math.ceil(totalWeeks / 2);
    const lowWeeks = Math.floor(totalWeeks / 2);

    out[high].weekCount = highWeeks;
    out[low].weekCount = lowWeeks;
    for (let k = 2; k < sorted.length; k += 1) out[sorted[k]].weekCount = 0;
  });

  return out.filter((r) => (Number(r.weekCount) || 0) > 0);
}

export type Calculate48SystemInput = {
  witnessSegments: Array<{ start: string; end: string }>;
  /** 24/48 vardiya fazı (işe girişe göre 3 günlük döngü) — genelde işe giriş tarihi */
  anchorStartDate: string;
  anchorIsWorkDay: boolean;
  /**
   * 7 günlük özet kovası / bilanço haftası başlangıcı (işaretlenen gün = kova günü 1).
   * Verilmezse `anchorStartDate` kullanılır. Pazartesi zorunlu değildir.
   */
  weekBucketAnchorDate?: string | null;
  exclusions?: ExcludedDay[] | null;
  /** Zamanaşımı başlangıcı — bu tarihten önceki günler elenir */
  zNorm?: string | null;
  /** Cetvel notları ve ücret dönemi özeti için dava dönemi (işe giriş–çıkış) */
  davaStart: string;
  davaEnd: string;
};

export type Calculate48SystemDebugInfo = {
  input: {
    witnessSegmentCount: number;
    anchorStartDate: string;
    /** Etkin 7 günlük kova başı (ISO gün) */
    weekBucketAnchorDate: string;
    anchorIsWorkDay: boolean;
    exclusionCount: number;
    zNorm: string | null;
    davaStart: string;
    davaEnd: string;
  };
  clippedSegments: Array<{ start: string; end: string }>;
  mergedWorkDayCount: number;
  dedupedWorkDayCount: number;
  baselineWeeks: ReturnType<typeof groupWeeks48>;
  weeksAfter: ReturnType<typeof groupWeeks48>;
  exclusionHits: Calculate48AggregationDebugInfo["exclusionHits"];
  stages: Calculate48DebugStage[];
};

function clipSegmentZamana48(
  seg: { start: string; end: string },
  zNorm: string | null | undefined
): { start: string; end: string } | null {
  const zn = zNorm ? String(zNorm).slice(0, 10) : "";
  if (!zn) return seg;
  if (seg.end < zn) return null;
  return { start: seg.start < zn ? zn : seg.start, end: seg.end };
}

/**
 * 24/48 vardiya — bilirkişi: vardiya günü başına 3 saat FM.
 * 24 saat motorundan tamamen ayrı dosya zinciri (generateWorkDays48, applyExclusions48, groupWeeks48).
 */
export function calculate48System(input: Calculate48SystemInput): PeriodSummary48Row[] {
  return calculate48SystemWithDebug(input).rows;
}

export function calculate48SystemWithDebug(input: Calculate48SystemInput): {
  rows: PeriodSummary48Row[];
  debug: Calculate48SystemDebugInfo;
} {
  const merged: WorkDay[] = [];
  const clippedSegments: Array<{ start: string; end: string }> = [];
  for (const seg of input.witnessSegments) {
    const c = clipSegmentZamana48(seg, input.zNorm);
    if (!c) continue;
    clippedSegments.push(c);
    merged.push(
      ...generateWorkDays48({
        startDate: c.start,
        endDate: c.end,
        anchorStartDate: input.anchorStartDate,
        anchorIsWorkDay: input.anchorIsWorkDay,
      })
    );
  }
  const deduped = dedupeWorkDaysByDate(merged);
  const weekBucket =
    (input.weekBucketAnchorDate && String(input.weekBucketAnchorDate).trim().slice(0, 10)) || input.anchorStartDate;
  const periodOpts = { periodStart: weekBucket, periodEnd: input.davaEnd };
  const baselineWeeks = groupWeeks48(deduped, periodOpts);
  const afterExcl = applyExclusions48(deduped, input.exclusions, weekBucket);
  const weeksAfter = groupWeeks48(afterExcl, periodOpts);

  const { rows, exclusionHits, stages } = aggregateWeeklyBucketsToPeriodRows(
    baselineWeeks,
    weeksAfter,
    input.davaStart,
    input.davaEnd,
    input.exclusions
  );
  return {
    rows,
    debug: {
      input: {
        witnessSegmentCount: input.witnessSegments.length,
        anchorStartDate: input.anchorStartDate,
        weekBucketAnchorDate: weekBucket,
        anchorIsWorkDay: input.anchorIsWorkDay,
        exclusionCount: input.exclusions?.length || 0,
        zNorm: input.zNorm || null,
        davaStart: input.davaStart,
        davaEnd: input.davaEnd,
      },
      clippedSegments,
      mergedWorkDayCount: merged.length,
      dedupedWorkDayCount: deduped.length,
      baselineWeeks,
      weeksAfter,
      exclusionHits,
      stages,
    },
  };
}

