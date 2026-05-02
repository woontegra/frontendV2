/**
 * Gemi günlük cetvel — UBGT/izin için blok başlangıcı ilk düşüm yapılan gün kabul edilir:
 * her blok 7 gündür (start = ilk gün, end = +6), FM saati o bloğun çalışma kaybına göre yeniden hesaplanır.
 * Bölücü 240, çarpan 1,25; haftalık yasal 48 saat; tatilli fazlada günlük referans 8 saat (gemi backend ile uyumlu).
 */

import { addDays, startOfDay } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import { bilirkisiRoundWeeklyTotalHours } from "../standart/annualLeaveSixDayRowSplit";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";

const EPS = 1e-7;
const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
const WEEKLY_WORK_LIMIT = 48;
/** Gemi tatilli fazla: `segDaily - 8` (standart 7,5 değil) */
const GEMI_STANDARD_DAILY_REF_HOURS = 8;

const FM_EXCLUSION_TYPES: string[] = ["Yıllık İzin", "UBGT", "Rapor", "Diğer"];
type LeaveBlock = { start: Date; end: Date; anchors: Date[] };

export type GemiExpandSourceRow = {
  id?: string;
  isManual?: boolean;
  rangeLabel?: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmManual?: boolean;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  text?: string;
  dailyNet?: number;
  annualLeaveHg?: number;
  annualLeaveSevenDay?: "tatilli" | "tatilsiz";
  yillikIzinAciklama?: string;
};

function dateMax(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function dateMin(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToTrRange(iso: string): string {
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function formatFmDeductionCaption(
  hg: number,
  leaveDaysInt: number,
  exclusions: ExcludedDay[],
  clipStart: Date,
  clipEnd: Date,
  weeklyOffDay: number | null
): string {
  const n = Math.min(hg, Math.max(0, Math.floor(leaveDaysInt)));
  const nIzin = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, ["Yıllık İzin"]);
  const nUbgt = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, ["UBGT"]);
  const nOther = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, ["Rapor", "Diğer"]);
  if (nUbgt === 0 && nOther === 0) return `(${n} gün yıllık izin düşülmüştür)`;
  if (nIzin === 0 && nOther === 0) return `(${n} gün UBGT düşülmüştür)`;
  if (nIzin === 0 && nUbgt === 0) return `(${n} gün dışlama düşülmüştür)`;
  return `(${n} gün dışlama düşülmüştür: yıllık izin / UBGT / diğer)`;
}

function parseLocalDay(value: string): Date | null {
  const s = String(value || "").trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return startOfDay(dt);
}

function isWorkDay(d: Date, weeklyOffDay: number | null): boolean {
  if (weeklyOffDay == null) return true;
  return d.getDay() !== weeklyOffDay;
}

function materializeAnchors(exclusions: ExcludedDay[], weeklyOffDay: number | null): Date[] {
  const out: Date[] = [];
  for (const ex of exclusions) {
    if (!FM_EXCLUSION_TYPES.includes(ex.type ?? "")) continue;
    const s = parseLocalDay(ex.start);
    const e = parseLocalDay(ex.end);
    if (!s || !e || s > e) continue;
    const cap = Number(ex.days) > 0 && Number.isFinite(Number(ex.days)) ? Math.floor(Number(ex.days)) : null;
    let used = 0;
    let cur = startOfDay(s);
    while (cur <= e) {
      if (cap != null && used >= cap) break;
      if (isWorkDay(cur, weeklyOffDay)) {
        out.push(startOfDay(cur));
        if (cap != null) used += 1;
      }
      cur = addDays(cur, 1);
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  const uniq: Date[] = [];
  const seen = new Set<string>();
  for (const d of out) {
    const key = toISODate(d);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(d);
  }
  return uniq;
}

function buildSevenDayBlocksForSegment(
  segStart: Date,
  segEnd: Date,
  exclusions: ExcludedDay[],
  weeklyOffDay: number | null
): LeaveBlock[] {
  const anchors = materializeAnchors(exclusions, weeklyOffDay).filter((d) => d >= segStart && d <= segEnd);
  if (anchors.length === 0) return [];
  const out: LeaveBlock[] = [];
  let i = 0;
  while (i < anchors.length) {
    const start = startOfDay(anchors[i]);
    const nominalEnd = addDays(start, 6);
    const end = nominalEnd > segEnd ? segEnd : nominalEnd;
    const group: Date[] = [];
    while (i < anchors.length && anchors[i].getTime() <= end.getTime()) {
      group.push(anchors[i]);
      i += 1;
    }
    out.push({ start, end, anchors: group });
  }
  return out;
}

function weeklyRawHoursForGemiLeaveWeek(
  dailyNet: number,
  hgSafe: number,
  davaciSevenDay: "tatilli" | "tatilsiz",
  leaveDaysInt: number
): number {
  const L = Math.max(0, Math.min(7, Math.floor(leaveDaysInt)));
  if (hgSafe !== 7) {
    return Math.max(0, (hgSafe - L) * dailyNet);
  }
  if (davaciSevenDay === "tatilsiz") {
    return Math.max(0, (7 - L) * dailyNet);
  }
  const holidayExtra = Math.max(0, dailyNet - GEMI_STANDARD_DAILY_REF_HOURS);
  const base = 6 * dailyNet + holidayExtra;
  return Math.max(0, base - L * dailyNet);
}

function countDeclaredOverlapDaysInt(
  clipStart: Date,
  clipEnd: Date,
  exclusions: ExcludedDay[],
  allowedTypes: readonly string[]
): number {
  let total = 0;
  for (const excl of exclusions) {
    if (!allowedTypes.includes(excl.type ?? "")) continue;
    const es = new Date(excl.start);
    const ee = new Date(excl.end);
    if (Number.isNaN(+es) || Number.isNaN(+ee) || es > ee) continue;
    const overlapStart = dateMax(es, clipStart);
    const overlapEnd = dateMin(ee, clipEnd);
    if (overlapStart > overlapEnd) continue;
    total += Math.max(0, Math.floor(Number(excl.days) || 0));
  }
  return total;
}

function gemiFmNet(weeks: number, brut: number, kats: number, fmHours: number): { fm: number; net: number } {
  const step1 = Number((weeks * brut * kats * fmHours).toFixed(6));
  const step2 = Number((step1 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
  const step3 = Number((step2 * FAZLA_MESAI_KATSAYI).toFixed(6));
  const fm = Number(step3.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return { fm, net };
}

function buildRowBits(
  id: string,
  startISO: string,
  endISO: string,
  weeks: number,
  brut: number,
  kats: number,
  fmHours: number,
  yillikIzinAciklama?: string
): GemiExpandSourceRow {
  const { fm, net } = gemiFmNet(weeks, brut, kats, fmHours);
  return {
    id,
    startISO,
    endISO,
    rangeLabel: `${isoToTrRange(startISO)}–${isoToTrRange(endISO)}`,
    weeks,
    brut,
    katsayi: kats,
    fmHours,
    fm,
    net,
    ...(yillikIzinAciklama ? { yillikIzinAciklama } : {}),
  };
}

function expandOneGemiRow(
  row: GemiExpandSourceRow & { dailyNet?: number },
  exclusions: ExcludedDay[],
  rowIdx: number,
  hg: number,
  weeklyOffDay: number | null,
  davaciSevenDay: "tatilli" | "tatilsiz"
): GemiExpandSourceRow[] {
  const startISO = row.startISO;
  const endISO = row.endISO;
  const W0 = row.weeks ?? 0;
  if (!startISO || !endISO || W0 <= 0) return [row];

  const rowWithWeekly = row as GemiExpandSourceRow & { annualLeaveWeeklyIgnoredWeekday?: number | null };
  const effectiveWeeklyOff =
    "annualLeaveWeeklyIgnoredWeekday" in rowWithWeekly
      ? rowWithWeekly.annualLeaveWeeklyIgnoredWeekday ?? null
      : weeklyOffDay;

  const segStartRaw = new Date(startISO);
  const segEndRaw = new Date(endISO);
  if (Number.isNaN(+segStartRaw) || Number.isNaN(+segEndRaw)) return [row];
  const segStart = startOfDay(segStartRaw);
  const segEnd = startOfDay(segEndRaw);
  if (segEnd < segStart) return [row];

  const kats = row.katsayi ?? 1;
  const baselineFm = row.fmHours ?? 0;
  const brutPeriod = row.brut ?? (getAsgariUcretByDate(startISO) || 0);
  const hgFromCaller = Math.max(1, Math.min(7, Math.floor(Number(hg)) || 6));
  const rowHgRaw = row.annualLeaveHg;
  const hgSafe =
    rowHgRaw != null && Number.isFinite(rowHgRaw)
      ? Math.max(1, Math.min(7, Math.floor(Number(rowHgRaw))))
      : hgFromCaller;
  const sevenDayForRow = row.annualLeaveSevenDay ?? davaciSevenDay;

  let dailyNet = row.dailyNet != null && Number.isFinite(Number(row.dailyNet)) ? Number(row.dailyNet) : NaN;
  if (!Number.isFinite(dailyNet) || dailyNet <= 0) {
    const fm = Number(baselineFm);
    if (hgSafe > 0 && Number.isFinite(fm) && fm >= 0) {
      dailyNet = (fm + 45) / hgSafe;
    }
  }
  if (!Number.isFinite(dailyNet) || dailyNet <= 0) return [row];

  type LeaveHit = { clipStart: Date; clipEnd: Date; leaveDaysInt: number };
  const leaveHits: LeaveHit[] = [];
  const blocks = buildSevenDayBlocksForSegment(segStart, segEnd, exclusions, effectiveWeeklyOff);
  for (const blk of blocks) {
    const clipStart = dateMax(segStart, blk.start);
    const clipEnd = dateMin(segEnd, blk.end);
    if (clipStart <= clipEnd) {
      let leaveDaysInt = Math.min(hgSafe, blk.anchors.length);
      if (leaveDaysInt <= 0) {
        leaveDaysInt = Math.min(
          hgSafe,
          countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, effectiveWeeklyOff, FM_EXCLUSION_TYPES)
        );
      }
      if (leaveDaysInt <= 0) {
        const declaredDays = countDeclaredOverlapDaysInt(clipStart, clipEnd, exclusions, FM_EXCLUSION_TYPES);
        if (declaredDays > 0) leaveDaysInt = Math.min(hgSafe, declaredDays);
      }
      if (leaveDaysInt >= 1) leaveHits.push({ clipStart, clipEnd, leaveDaysInt });
    }
  }
  leaveHits.sort((a, b) => a.clipStart.getTime() - b.clipStart.getTime());

  if (leaveHits.length === 0) return [row];

  let H = 0;
  const leavePositiveRows: GemiExpandSourceRow[] = [];

  leaveHits.forEach((hit, j) => {
    const rawTotal = weeklyRawHoursForGemiLeaveWeek(dailyNet, hgSafe, sevenDayForRow, hit.leaveDaysInt);
    const totalRounded = bilirkisiRoundWeeklyTotalHours(rawTotal);
    const fmWeek = Math.max(0, totalRounded - WEEKLY_WORK_LIMIT);
    if (fmWeek <= EPS) {
      H += 1;
      return;
    }
    const brutW = getAsgariUcretByDate(toISODate(hit.clipStart)) || 0;
    leavePositiveRows.push(
      buildRowBits(
        `gemi-yl-${rowIdx}-${j}-${toISODate(hit.clipStart)}`,
        toISODate(hit.clipStart),
        toISODate(hit.clipEnd),
        1,
        brutW,
        kats,
        fmWeek,
        formatFmDeductionCaption(hgSafe, hit.leaveDaysInt, exclusions, hit.clipStart, hit.clipEnd, effectiveWeeklyOff)
      )
    );
  });

  const lp = leavePositiveRows.length;
  const normalWeeks = Math.max(0, W0 - H - lp);
  const out: GemiExpandSourceRow[] = [];

  if (normalWeeks > 0) {
    const { fm: fmN, net: netN } = gemiFmNet(normalWeeks, brutPeriod, kats, baselineFm);
    const { dailyNet: _omitDaily, ...rowBase } = row as GemiExpandSourceRow & { dailyNet?: number };
    out.push({
      ...rowBase,
      id: `gemi-yl-base-${rowIdx}-${startISO}-${endISO}`,
      startISO,
      endISO,
      rangeLabel: `${isoToTrRange(startISO)}–${isoToTrRange(endISO)}`,
      weeks: normalWeeks,
      brut: brutPeriod,
      katsayi: kats,
      fmHours: baselineFm,
      fm: fmN,
      net: netN,
    });
  }

  out.push(...leavePositiveRows);

  if (out.length === 0) return [];

  return out;
}

export type GemiExpandParams = {
  hg: number;
  weeklyOffDay: number | null;
  davaciSevenDay: "tatilli" | "tatilsiz";
};

/**
 * Dışlama (UBGT, yıllık izin, rapor, diğer) varsa satırları ilk düşüm günü bazlı 7 günlük bloklara böler.
 */
export function expandGemiRowsAnnualLeaveUbgt(
  rows: GemiExpandSourceRow[],
  exclusions: ExcludedDay[] | null | undefined,
  params: GemiExpandParams
): GemiExpandSourceRow[] {
  if (!exclusions?.length) return rows;
  const { hg, weeklyOffDay, davaciSevenDay } = params;

  const out: GemiExpandSourceRow[] = [];
  rows.forEach((row, i) => {
    if (row.isManual) {
      out.push(row);
      return;
    }
    const withNet: GemiExpandSourceRow & { dailyNet?: number } = { ...row };
    const expanded = expandOneGemiRow(withNet, exclusions, i, hg, weeklyOffDay, davaciSevenDay);
    if (expanded.length) out.push(...expanded);
    else out.push(row);
  });
  return out;
}
