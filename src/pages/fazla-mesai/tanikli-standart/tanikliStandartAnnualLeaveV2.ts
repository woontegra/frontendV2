/**
 * Tanıklı Standart — yıllık izin V2 (davacı haftası hg; 7 günde tatilli/tatilsiz davacı seçimiyle uyumlu).
 * hg 7'den küçükse: ham haftalık saat yaklaşık (hg − izin) × günlük_net. hg = 7 tatilsiz: (7 − izin) × günlük_net.
 * hg = 7 tatilli: 6×net + fazla (net − 7,5) − izin×net (davacı FM metniyle aynı mantık). Sonra bilirkişi yuvarlama ve −45.
 *
 * Satırda `annualLeaveHg` / `annualLeaveSevenDay` varsa (Haftalık Karma, Tanıklı Standart cetveli),
 * o satır için bu değerler kullanılır; yoksa çağrıdaki `hg` ve `davaciSevenDay` uygulanır.
 */

import { addDays, startOfDay, startOfWeek } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import { bilirkisiRoundWeeklyTotalHours } from "../standart/annualLeaveSixDayRowSplit";
import {
  FAZLA_MESAI_DENOMINATOR,
  FAZLA_MESAI_KATSAYI,
  WEEKLY_WORK_LIMIT,
  STANDARD_DAILY_REFERENCE_HOURS,
} from "../standart/constants";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";

const EPS = 1e-7;

/** FM haftalık düşümünde takvim olarak sayılan dışlama türleri. */
const FM_EXCLUSION_TYPES: string[] = ["Yıllık İzin", "UBGT", "Rapor", "Diğer"];

function dateMax(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function dateMin(a: Date, b: Date): Date {
  return a < b ? a : b;
}

/** Yerel takvim günü (UTC toISOString kayması yok — TR saat diliminde 01.01 gibi günler için). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const nOther = countAnnualLeaveCalendarDaysInWindow(clipStart, clipEnd, exclusions, weeklyOffDay, [
    "Rapor",
    "Diğer",
  ]);
  if (nUbgt === 0 && nOther === 0) return `(${n} gün yıllık izin düşülmüştür)`;
  if (nIzin === 0 && nOther === 0) return `(${n} gün UBGT düşülmüştür)`;
  if (nIzin === 0 && nUbgt === 0) return `(${n} gün dışlama düşülmüştür)`;
  return `(${n} gün dışlama düşülmüştür: yıllık izin / UBGT / diğer)`;
}

/** Davacı haftası (hg) ve 7 gün iken tatilli/tatilsiz; izin günü düşümüyle ham haftalık çalışma saati. */
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

function buildRowBits(
  id: string,
  startISO: string,
  endISO: string,
  weeks: number,
  brut: number,
  kats: number,
  fmHours: number,
  yillikIzinAciklama?: string
): FazlaMesaiRowBase {
  const fm = Number(
    (((brut * kats * weeks * fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2)
  );
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return {
    id,
    startISO,
    endISO,
    rangeLabel: `${startISO} – ${endISO}`,
    weeks,
    originalWeekCount: weeks,
    brut,
    katsayi: kats,
    fmHours,
    fm,
    net,
    wage: brut,
    overtimeAmount: fm,
    ...(yillikIzinAciklama ? { yillikIzinAciklama } : {}),
  } as FazlaMesaiRowBase;
}

function expandOnePeriodRow(
  row: FazlaMesaiRowBase & { dailyNet?: number },
  exclusions: ExcludedDay[],
  rowIdx: number,
  hg: number,
  weeklyOffDay: number | null,
  davaciSevenDay: "tatilli" | "tatilsiz"
): FazlaMesaiRowBase[] {
  const dailyNet = row.dailyNet;
  const startISO = row.startISO;
  const endISO = row.endISO;
  const W0 = row.weeks ?? 0;
  if (dailyNet == null || !startISO || !endISO || W0 <= 0) return [row];

  /** Dönemsel vb.: satırın kendi desenine göre takvimden çıkarılacak hafta günü; yoksa formdaki `weeklyOffDay` (Tanıklı Standart). */
  const rowWithWeekly = row as FazlaMesaiRowBase & {
    annualLeaveWeeklyIgnoredWeekday?: number | null;
  };
  const effectiveWeeklyOff =
    "annualLeaveWeeklyIgnoredWeekday" in rowWithWeekly
      ? rowWithWeekly.annualLeaveWeeklyIgnoredWeekday ?? null
      : weeklyOffDay;

  const segStartRaw = new Date(startISO);
  const segEndRaw = new Date(endISO);
  if (Number.isNaN(+segStartRaw) || Number.isNaN(+segEndRaw)) return [row];
  // ISO tarih stringleri UTC gece yarısı parse edilir; hafta sınırları yerel 00:00. startOfDay ile
  // aynı takvim gününde clipStart > clipEnd oluşması engellenir (ör. 01.01 Pazar UBGT atlanması).
  const segStart = startOfDay(segStartRaw);
  const segEnd = startOfDay(segEndRaw);
  if (segEnd < segStart) return [row];

  const kats = row.katsayi ?? 1;
  const baselineFm = row.fmHours ?? 0;
  const brutPeriod = row.brut ?? (getAsgariUcretByDate(startISO) || 0);
  const hgFromCaller = Math.max(1, Math.min(7, Math.floor(Number(hg)) || 6));
  const rowHgRaw = (row as { annualLeaveHg?: number }).annualLeaveHg;
  const hgSafe =
    rowHgRaw != null && Number.isFinite(rowHgRaw)
      ? Math.max(1, Math.min(7, Math.floor(Number(rowHgRaw))))
      : hgFromCaller;
  const sevenDayForRow =
    (row as { annualLeaveSevenDay?: "tatilli" | "tatilsiz" }).annualLeaveSevenDay ?? davaciSevenDay;

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
        countAnnualLeaveCalendarDaysInWindow(
          clipStart,
          clipEnd,
          exclusions,
          effectiveWeeklyOff,
          FM_EXCLUSION_TYPES
        )
      );
      // Takvim sayımı 0 ise (tarih/hafta tatili filtresi vb.): kullanıcının dışlama kayıtlarındaki "Gün" toplamıyla düşüm.
      // Yalnızca Yıllık İzin değil — UBGT / Rapor / Diğer de (Dönemsel + Tanıklı Standart uyumu).
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
  const leavePositiveRows: FazlaMesaiRowBase[] = [];

  leaveHits.forEach((hit, j) => {
    const rawTotal = weeklyRawHoursForDavaciLeaveWeek(
      dailyNet,
      hgSafe,
      sevenDayForRow,
      hit.leaveDaysInt
    );
    const totalRounded = bilirkisiRoundWeeklyTotalHours(rawTotal);
    const fmWeek = Math.max(0, totalRounded - WEEKLY_WORK_LIMIT);
    if (fmWeek <= EPS) {
      H += 1;
      return;
    }
    const monIso = toISODate(hit.weekStart);
    const brutW = getAsgariUcretByDate(monIso) || 0;
    leavePositiveRows.push(
      buildRowBits(
        `auto-yl2-${rowIdx}-${j}-${toISODate(hit.clipStart)}`,
        toISODate(hit.clipStart),
        toISODate(hit.clipEnd),
        1,
        brutW,
        kats,
        fmWeek,
        formatFmDeductionCaption(
          hgSafe,
          hit.leaveDaysInt,
          exclusions,
          hit.clipStart,
          hit.clipEnd,
          effectiveWeeklyOff
        )
      )
    );
  });

  const lp = leavePositiveRows.length;
  const normalWeeks = Math.max(0, W0 - H - lp);
  const out: FazlaMesaiRowBase[] = [];

  if (normalWeeks > 0) {
    const fmN = Number(
      (((brutPeriod * kats * normalWeeks * baselineFm) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2)
    );
    const netN = Number(
      (fmN * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2)
    );
    const { dailyNet: _omitDaily, ...rowBase } = row as FazlaMesaiRowBase & { dailyNet?: number };
    out.push({
      ...rowBase,
      id: `auto-yl2-base-${rowIdx}-${startISO}-${endISO}`,
      startISO,
      endISO,
      rangeLabel: `${startISO} – ${endISO}`,
      weeks: normalWeeks,
      originalWeekCount: normalWeeks,
      brut: brutPeriod,
      katsayi: kats,
      fmHours: baselineFm,
      fm: fmN,
      net: netN,
      wage: brutPeriod,
      overtimeAmount: fmN,
    } as FazlaMesaiRowBase);
  }

  out.push(...leavePositiveRows);

  if (out.length === 0) return [];

  return out;
}

/**
 * Tanık satırlarında dailyNet varken yıllık izin V2 uygular; hg = haftalık çalışma günü (form).
 */
export function expandTanikliStandartRowsAnnualLeaveV2(
  rows: Array<FazlaMesaiRowBase & { dailyNet?: number }>,
  exclusions: ExcludedDay[] | null | undefined,
  hg: number,
  weeklyOffDay: number | null,
  davaciSevenDay: "tatilli" | "tatilsiz"
): FazlaMesaiRowBase[] {
  if (!exclusions?.length) return rows as FazlaMesaiRowBase[];

  const out: FazlaMesaiRowBase[] = [];
  rows.forEach((row, i) => {
    if (row.dailyNet != null) {
      const expanded = expandOnePeriodRow(row, exclusions, i, hg, weeklyOffDay, davaciSevenDay);
      if (expanded.length) out.push(...expanded);
      else out.push(row);
    } else {
      out.push(row);
    }
  });
  return out;
}
