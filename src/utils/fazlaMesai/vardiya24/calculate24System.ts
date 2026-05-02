import type { ExcludedDay } from "@/shared/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import type { WorkDay } from "./generateWorkDays24";
import { generateWorkDays24 } from "./generateWorkDays24";
import { applyExclusions24, buildEffectiveUbgtDates } from "./applyExclusions24";
import { getAnchorWeekBucketKey, groupWeeks24, type Weekly24Row } from "./groupWeeks24";

export type Calculate24SystemInput = {
  startDate: string;
  endDate: string;
  exclusions?: ExcludedDay[] | null;
  anchorIsWorkDay: boolean;
  /** 7 günlük blok başlangıcı (kullanıcının seçtiği ilk tarih) */
  anchorStartDate?: string;
  /** true ise genel dışlamalar da çalışma günü filtresine takılmadan kovadan düşülür (24 bilirkişi pratiği). */
  forceBucketDeductionForAllExclusions?: boolean;
  /**
   * Ardışık UBGT etkin günleri aynı takvim kümesinde toplayıp, değişen satırları tek bir
   * en az 7 günlük zarfta (etkin UBGT başlangıcından itibaren) birleştirir.
   */
  mergeUbgtChangedIntoSevenDayEnvelope?: boolean;
};

export type PeriodSummary24Row = {
  startDate: string;
  endDate: string;
  weekType: string;
  weekCount: number;
  weeklyFmHours: number;
  note?: string;
  beforeWeekType?: string;
};

export type Calculate24DebugStage = {
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

export type Calculate24DebugInfo = {
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
  stages: Calculate24DebugStage[];
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

function summarizeByWagePeriod(
  weeks: ReturnType<typeof groupWeeks24>,
  startDate: string,
  endDate: string,
  excludedWeekStarts?: Set<string>
): PeriodSummary24Row[] {
  const out: PeriodSummary24Row[] = [];
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

function buildWeekMap(weeks: Weekly24Row[]): Map<string, Weekly24Row> {
  const m = new Map<string, Weekly24Row>();
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
  changedRows: PeriodSummary24Row[],
  exclusions: ExcludedDay[] | null | undefined,
  globalStart: string,
  globalEnd: string,
  anchorStart: string,
  workBaseline: WorkDay[],
  workAfter: WorkDay[]
): PeriodSummary24Row[] {
  if (!exclusions?.length) return changedRows;

  const transitionRe = /\(\d+\s*->\s*\d+\s*gün\)/i;
  // Not metni her zaman "UBGT" içermeyebiliyor; geçiş satırlarını esas al.
  const ubgtRows = changedRows.filter((r) => transitionRe.test(String(r.note || "")));
  if (!ubgtRows.length) return changedRows;

  const effective = collectEffectiveExclusionAnchorDates(exclusions, workBaseline);
  if (!effective.length) return changedRows;

  const clusters = clusterConsecutiveSortedDates(effective);
  const otherChanged = changedRows.filter((r) => !transitionRe.test(String(r.note || "")));
  const consumed = new Set<PeriodSummary24Row>();
  const mergedUbgt: PeriodSummary24Row[] = [];

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
 * 7 günlük kova çıktısından ücret dönemi özeti + tavan/denge (24/24 ve 24/48 için ortak).
 */
export function aggregateWeeklyBucketsToPeriodRows(
  baselineWeeks: Weekly24Row[],
  weeksAfter: Weekly24Row[],
  globalStart: string,
  globalEnd: string,
  exclusions: ExcludedDay[] | null | undefined,
  mergeUbgtEnvelope?: AggregateWeeklyBucketsMergeOpts | null
): {
  rows: PeriodSummary24Row[];
  exclusionHits: Calculate24DebugInfo["exclusionHits"];
  stages: Calculate24DebugStage[];
} {
  const baselineMap = buildWeekMap(baselineWeeks);
  const afterMap = buildWeekMap(weeksAfter);
  const changedWeekStarts = new Set<string>();
  let changedRows: PeriodSummary24Row[] = [];
  const exclusionHits: Calculate24DebugInfo["exclusionHits"] = [];

  baselineMap.forEach((beforeWeek, key) => {
    const afterWeek = afterMap.get(key);
    if (!afterWeek) {
      changedWeekStarts.add(key);
      const note = exclusionNoteForIsoWeek(key, globalStart, globalEnd, exclusions);
      const beforeType = String(beforeWeek.workDayCount);
      changedRows.push({
        startDate: beforeWeek.startDate,
        endDate: beforeWeek.endDate,
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
        startDate: afterWeek.startDate,
        endDate: afterWeek.endDate,
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

  if (mergeUbgtEnvelope) {
    changedRows = mergeUbgtChangedRowsIntoSevenDayEnvelope(
      changedRows,
      exclusions,
      globalStart,
      globalEnd,
      mergeUbgtEnvelope.anchorStart,
      mergeUbgtEnvelope.workBaseline,
      mergeUbgtEnvelope.workAfter
    );
  }

  const summaryRows = summarizeByWagePeriod(weeksAfter, globalStart, globalEnd, changedWeekStarts);
  // Düşüm kovası summarize'da zaten changedWeekStarts ile dışarıda; donor'dan tekrar -1 yapma (çifte düşüm, toplam hafta -2).
  const mergedRows = [...summaryRows, ...changedRows].filter((r) => (Number(r.weekCount) || 0) > 0);
  const cappedRows = enforcePeriodWeekCaps(mergedRows, globalStart, globalEnd);
  const rebalancedRows = enforceWitnessSplitPolicy(cappedRows, globalStart, globalEnd);
  const sortedRows = rebalancedRows.sort((a, b) =>
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
      { label: "cappedRows", rows: cappedRows },
      { label: "rebalancedRows", rows: sortedRows },
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

function enforcePeriodWeekCaps(rows: PeriodSummary24Row[], startDate: string, endDate: string): PeriodSummary24Row[] {
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
function enforceWitnessSplitPolicy(rows: PeriodSummary24Row[], startDate: string, endDate: string): PeriodSummary24Row[] {
  if (!rows.length) return rows;
  const hasExclusion = rows.some((r) => r.note && r.note.length > 0);

  if (hasExclusion) return rows;
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
    // Dönemde düşüm geçiş satırı varsa (örn. 4->3 / 3->2),
    // donor satırdan düşülen haftayı geri 22/22 dengelemesine sokma.
    const hasTransitionNote = idxs.some((i) => /\(\d+\s*->\s*\d+\s*gün\)/i.test(String(out[i].note || "")));
    if (hasTransitionNote) return;

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

function calculate24SystemInternal(input: Calculate24SystemInput): { rows: PeriodSummary24Row[]; debug: Calculate24DebugInfo } {
  const generated = generateWorkDays24({
    startDate: input.startDate,
    endDate: input.endDate,
    anchorIsWorkDay: input.anchorIsWorkDay,
  });
  const periodAnchor = input.anchorStartDate || input.startDate;
  const periodOpts = { periodStart: periodAnchor, periodEnd: input.endDate };
  const baselineWeeks = groupWeeks24(generated, periodOpts);
  const afterExclusions = applyExclusions24(generated, input.exclusions, periodAnchor, {
    respectWorkdayFilter: !input.forceBucketDeductionForAllExclusions,
  });
  const weeksAfter = groupWeeks24(afterExclusions, periodOpts);

  const anchorForPeriod = periodAnchor;
  const mergeUbgtEnvelope =
    input.mergeUbgtChangedIntoSevenDayEnvelope === true
      ? { anchorStart: anchorForPeriod, workBaseline: generated, workAfter: afterExclusions }
      : null;

  const { rows: sortedRows, exclusionHits, stages } = aggregateWeeklyBucketsToPeriodRows(
    baselineWeeks,
    weeksAfter,
    input.startDate,
    input.endDate,
    input.exclusions,
    mergeUbgtEnvelope
  );
  return {
    rows: sortedRows,
    debug: {
      input: {
        startDate: input.startDate,
        endDate: input.endDate,
        anchorIsWorkDay: input.anchorIsWorkDay,
        exclusionCount: input.exclusions?.length || 0,
      },
      generatedDayCount: generated.length,
      baselineWeekCount: baselineWeeks.length,
      afterExclusionWeekCount: weeksAfter.length,
      exclusionHits,
      stages,
    },
  };
}

export function calculate24System(input: Calculate24SystemInput): PeriodSummary24Row[] {
  return calculate24SystemInternal(input).rows;
}

export function calculate24SystemWithDebug(input: Calculate24SystemInput): { rows: PeriodSummary24Row[]; debug: Calculate24DebugInfo } {
  return calculate24SystemInternal(input);
}

