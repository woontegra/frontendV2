/**
 * Yeraltı cetveli — Tanıklı Standart `expandTanikliStandartRowsAnnualLeaveV2` ile aynı hafta bölme mantığı:
 * UBGT/izin hangi takvim haftasına denk geliyorsa o hafta ayrı satır, FM saati o haftanın çalışma kaybına göre yeniden hesaplanır.
 */

import { addDays, startOfDay, startOfWeek } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { parseIsoDateLocal } from "@/pages/hafta-tatili/calculations";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";

/** `YeraltiIsciPage` cetvel satırı ile uyumlu (döngüsel import yok). */
export type YeraltiExpandSourceRow = {
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
  /** Tanıklı Standart cetveliyle aynı: "(1 gün UBGT düşülmüştür)" vb. */
  yillikIzinAciklama?: string;
};

const FAZLA_MESAI_DENOMINATOR = 187.5;
const FAZLA_MESAI_KATSAYI = 2;
const WEEKLY_WORK_LIMIT_Y = 37.5;
const STANDARD_DAILY_REFERENCE_HOURS = 6.25;
const DAMGA_VERGISI_ORANI = 0.00759;
const GELIR_VERGISI_ORANI = 0.15;
const EPS = 1e-7;

const FM_EXCLUSION_TYPES: readonly string[] = ["Yıllık İzin", "UBGT", "Rapor", "Diğer"];

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

/** Backend `applyYargitayRounding` ile aynı */
function applyYargitayRoundingYeralti(decimalHours: number): number {
  const hours = Math.floor(decimalHours);
  const fractionalPart = decimalHours - hours;
  const minutes = Math.round(fractionalPart * 60);
  if (minutes === 0) return hours;
  if (minutes <= 30) return hours + 0.5;
  return hours + 1;
}

function weeklyRawHoursForDavaciLeaveWeek(
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
  const holidayExtra = Math.max(0, dailyNet - STANDARD_DAILY_REFERENCE_HOURS);
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
    const es = parseIsoDateLocal(String(excl.start ?? "").slice(0, 10));
    const ee = parseIsoDateLocal(String(excl.end ?? "").slice(0, 10));
    if (!es || !ee || es > ee) continue;
    const overlapStart = dateMax(es, clipStart);
    const overlapEnd = dateMin(ee, clipEnd);
    if (overlapStart > overlapEnd) continue;
    total += Math.max(0, Math.floor(Number(excl.days) || 0));
  }
  return total;
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

function yeraltiFmNet(weeks: number, brut: number, kats: number, fmHours: number): { fm: number; net: number } {
  const step1 = Number((weeks * brut * kats * fmHours).toFixed(6));
  const step2 = Number((step1 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
  const step3 = Number((step2 * FAZLA_MESAI_KATSAYI).toFixed(6));
  const fm = Number(step3.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return { fm, net };
}

function expandOneYeraltiRow(
  row: YeraltiExpandSourceRow & { dailyNet?: number },
  exclusions: ExcludedDay[],
  rowIdx: number,
  hg: number,
  weeklyOffDay: number | null,
  davaciSevenDay: "tatilli" | "tatilsiz",
  applyLeaveFmAdj: (h: number) => number
): YeraltiExpandSourceRow[] {
  const dailyNet = row.dailyNet;
  const startISO = row.startISO;
  const endISO = row.endISO;
  const W0 = row.weeks ?? 0;
  if (dailyNet == null || !startISO || !endISO || W0 <= 0) return [row];

  const segStartRaw = parseIsoDateLocal(String(startISO).slice(0, 10));
  const segEndRaw = parseIsoDateLocal(String(endISO).slice(0, 10));
  if (!segStartRaw || !segEndRaw) return [row];
  const segStart = startOfDay(segStartRaw);
  const segEnd = startOfDay(segEndRaw);
  if (segEnd < segStart) return [row];

  const kats = row.katsayi ?? 1;
  const baselineFm = row.fmHours ?? 0;
  const brutPeriod = row.brut ?? (getAsgariUcretByDate(startISO) || 0);
  const hgFromCaller = Math.max(1, Math.min(7, Math.floor(Number(hg)) || 6));
  const hgSafe = hgFromCaller;
  const sevenDayForRow = davaciSevenDay;

  type LeaveHit = { weekStart: Date; weekEnd: Date; clipStart: Date; clipEnd: Date; leaveDaysInt: number };
  const leaveHits: LeaveHit[] = [];

  let weekMon = startOfWeek(segStart, { weekStartsOn: 1 });
  const lastMon = startOfWeek(segEnd, { weekStartsOn: 1 });

  while (weekMon <= lastMon) {
    const weekSun = addDays(weekMon, 6);
    const clipStart = dateMax(segStart, weekMon);
    const clipEnd = dateMin(segEnd, weekSun);
    if (clipStart <= clipEnd) {
      let leaveDaysInt = Math.min(
        hgSafe,
        countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, [...FM_EXCLUSION_TYPES])
      );
      if (leaveDaysInt <= 0) {
        const declaredDays = countDeclaredOverlapDaysInt(clipStart, clipEnd, exclusions, FM_EXCLUSION_TYPES);
        if (declaredDays > 0) leaveDaysInt = Math.min(hgSafe, declaredDays);
      }
      if (leaveDaysInt >= 1) {
        leaveHits.push({
          weekStart: new Date(weekMon),
          weekEnd: new Date(weekSun),
          clipStart,
          clipEnd,
          leaveDaysInt,
        });
      }
    }
    weekMon = addDays(weekMon, 7);
  }

  leaveHits.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  if (leaveHits.length === 0) return [row];

  let H = 0;
  const leavePositiveRows: YeraltiExpandSourceRow[] = [];

  leaveHits.forEach((hit, j) => {
    const rawTotal = weeklyRawHoursForDavaciLeaveWeek(dailyNet, hgSafe, sevenDayForRow, hit.leaveDaysInt);
    const totalRounded = applyYargitayRoundingYeralti(rawTotal);
    let fmWeek = Math.max(0, totalRounded - WEEKLY_WORK_LIMIT_Y);
    fmWeek = applyLeaveFmAdj(fmWeek);
    if (fmWeek <= EPS) {
      H += 1;
      return;
    }
    const monIso = toISODate(hit.weekStart);
    const brutW = getAsgariUcretByDate(monIso) || 0;
    const caption = formatFmDeductionCaption(
      hgSafe,
      hit.leaveDaysInt,
      exclusions,
      hit.clipStart,
      hit.clipEnd,
      weeklyOffDay
    );
    const { fm, net } = yeraltiFmNet(1, brutW, kats, fmWeek);
    leavePositiveRows.push({
      id: `yr-ubgt-${rowIdx}-${j}-${toISODate(hit.clipStart)}`,
      startISO: toISODate(hit.clipStart),
      endISO: toISODate(hit.clipEnd),
      rangeLabel: `${toISODate(hit.clipStart)} – ${toISODate(hit.clipEnd)}`,
      weeks: 1,
      brut: brutW,
      katsayi: kats,
      fmHours: fmWeek,
      fm,
      net,
      yillikIzinAciklama: caption,
    });
  });

  const lp = leavePositiveRows.length;
  const normalWeeks = Math.max(0, W0 - H - lp);
  const out: YeraltiExpandSourceRow[] = [];

  if (normalWeeks > 0) {
    const { fm: fmN, net: netN } = yeraltiFmNet(normalWeeks, brutPeriod, kats, baselineFm);
    const { dailyNet: _omitDaily, ...rowBase } = row as YeraltiExpandSourceRow & { dailyNet?: number };
    out.push({
      ...rowBase,
      id: `yr-base-${rowIdx}-${startISO}-${endISO}`,
      startISO,
      endISO,
      rangeLabel: `${formatDateTRLocal(startISO)} – ${formatDateTRLocal(endISO)}`,
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

function formatDateTRLocal(iso: string): string {
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

export type YeraltiExpandParams = {
  dailyNet: number;
  hg: number;
  weeklyOffDay: number | null;
  davaciSevenDay: "tatilli" | "tatilsiz";
  applyLeaveFmAdj: (h: number) => number;
};

export function expandYeraltiRowsForExclusions(
  rows: YeraltiExpandSourceRow[],
  exclusions: ExcludedDay[] | null | undefined,
  params: YeraltiExpandParams
): YeraltiExpandSourceRow[] {
  if (!exclusions?.length) return rows;
  const { dailyNet, hg, weeklyOffDay, davaciSevenDay, applyLeaveFmAdj } = params;

  const out: YeraltiExpandSourceRow[] = [];
  rows.forEach((row, i) => {
    if (row.isManual) {
      out.push(row);
      return;
    }
    const withNet: YeraltiExpandSourceRow & { dailyNet?: number } = { ...row, dailyNet };
    const expanded = expandOneYeraltiRow(withNet, exclusions, i, hg, weeklyOffDay, davaciSevenDay, applyLeaveFmAdj);
    if (expanded.length) out.push(...expanded);
    else out.push(row);
  });
  return out;
}
