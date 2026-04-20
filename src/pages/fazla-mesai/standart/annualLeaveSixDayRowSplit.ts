/**
 * Standart fazla mesai: haftada 6 gün + yıllık izin girildiğinde,
 * yalnızca izinle kesişen takvim haftalarını yeniden hesaplar (bilirkişi yuvarlaması, Math.round yok).
 */

import { addDays, startOfDay, startOfWeek } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "@/shared/utils/fazlaMesai/annualLeaveCalendarDays";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import type { FazlaMesaiRowBase } from "@modules/fazla-mesai/shared";
import { FAZLA_MESAI_DENOMINATOR, FAZLA_MESAI_KATSAYI, WEEKLY_WORK_LIMIT } from "./constants";
import { DAMGA_VERGISI_ORANI, GELIR_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";

const EPS = 1e-7;

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

function normalizeWeeksForStandard(startISO: string, endISO: string, rawWeeks: number): number {
  const s = (startISO || "").slice(0, 10);
  const e = (endISO || "").slice(0, 10);
  if (!s || !e) return rawWeeks;
  const sy = s.slice(0, 4);
  const ey = e.slice(0, 4);
  if (sy === ey && s.slice(5) === "01-01" && e.slice(5) === "12-31") return 52;
  if (sy === ey && s.slice(5) === "01-01" && e.slice(5) === "06-30") return 26;
  if (sy === ey && s.slice(5) === "07-01" && e.slice(5) === "12-31") return 26;
  return rawWeeks;
}

/**
 * .5 aynı kalır; .6+ yukarı tam sayı; .4- aşağı tam sayı. Math.round kullanılmaz.
 */
export function bilirkisiRoundWeeklyTotalHours(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const int = Math.floor(value + EPS);
  const frac = value - int;
  if (frac < 0.5 - EPS) return int;
  if (frac > 0.5 + EPS) return int + 1;
  return int + 0.5;
}

function formatLeaveCaptionInt(
  leaveDaysInt: number,
  nIzin: number,
  nUbgt: number,
  nOther: number
): string {
  const n = Math.min(6, Math.max(0, Math.floor(leaveDaysInt)));
  if (nUbgt === 0 && nOther === 0) return `(${n} gün yıllık izin düşülmüştür)`;
  if (nIzin === 0 && nOther === 0) return `(${n} gün UBGT düşülmüştür)`;
  if (nIzin === 0 && nUbgt === 0) return `(${n} gün dışlama düşülmüştür)`;
  return `(${n} gün dışlama düşülmüştür: yıllık izin / UBGT / diğer)`;
}

type WeekChunk = {
  startISO: string;
  endISO: string;
  weeks: number;
  brut: number;
  fmHours: number;
  yillikIzinAciklama?: string;
};

function mergeNormalWeekChunks(chunks: WeekChunk[]): WeekChunk[] {
  if (chunks.length === 0) return [];
  const out: WeekChunk[] = [];
  for (const c of chunks) {
    const last = out[out.length - 1];
    if (
      last &&
      !last.yillikIzinAciklama &&
      !c.yillikIzinAciklama &&
      last.fmHours === c.fmHours &&
      last.brut === c.brut
    ) {
      last.endISO = c.endISO;
      last.weeks += c.weeks;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

/**
 * Tek asgari segment satırını (çok haftalı) izin etkisine göre haftalık satırlara böler.
 */
export function expandStandartSegmentForSixDayAnnualLeave(
  row: FazlaMesaiRowBase,
  exclusions: ExcludedDay[],
  dailyNet: number,
  baselineWeeklyFm: number,
  segmentIndex: number,
  weeklyOffDay: number | null
): FazlaMesaiRowBase[] {
  const startISO = row.startISO;
  const endISO = row.endISO;
  if (!startISO || !endISO || exclusions.length === 0) return [row];

  const segStartRaw = new Date(startISO);
  const segEndRaw = new Date(endISO);
  if (Number.isNaN(+segStartRaw) || Number.isNaN(+segEndRaw)) return [row];
  // UTC parse kaynaklı gün kaymasını önlemek için yerel gün başına normalize edilir.
  const segStart = startOfDay(segStartRaw);
  const segEnd = startOfDay(segEndRaw);
  if (segEnd < segStart) return [row];

  const kats = row.katsayi ?? 1;
  const chunks: WeekChunk[] = [];

  let weekMon = startOfWeek(segStart, { weekStartsOn: 1 });
  const lastMon = startOfWeek(segEnd, { weekStartsOn: 1 });

  while (weekMon <= lastMon) {
    const weekSun = addDays(weekMon, 6);
    const clipStart = dateMax(segStart, weekMon);
    const clipEnd = dateMin(segEnd, weekSun);
    if (clipStart <= clipEnd) {
      const leaveDaysInt = Math.min(
        6,
        countAnnualLeaveCalendarDaysInWindow(
          clipStart,
          clipEnd,
          exclusions,
          weeklyOffDay,
          ["Yıllık İzin", "UBGT", "Rapor", "Diğer"]
        )
      );
      // Ücret, haftanın pazartesinden değil satırın fiili başlangıç gününden alınmalı.
      // Aksi halde yılın ilk haftası (Pzt önceki yılda kalıyorsa) eski yıl ücretiyle ayrı satır olur.
      const brut = getAsgariUcretByDate(toISODate(clipStart)) || 0;
      const affected = leaveDaysInt >= 1;
      let fmHours: number;
      let note: string | undefined;
      if (affected) {
        const nIzin = countAnnualLeaveCalendarDaysInWindow(
          clipStart,
          clipEnd,
          exclusions,
          weeklyOffDay,
          ["Yıllık İzin"]
        );
        const nUbgt = countAnnualLeaveCalendarDaysInWindow(
          clipStart,
          clipEnd,
          exclusions,
          weeklyOffDay,
          ["UBGT"]
        );
        const nOther = countAnnualLeaveCalendarDaysInWindow(
          clipStart,
          clipEnd,
          exclusions,
          weeklyOffDay,
          ["Rapor", "Diğer"]
        );
        const workedDays = Math.max(0, 6 - leaveDaysInt);
        const rawTotal = workedDays * dailyNet;
        const totalRounded = bilirkisiRoundWeeklyTotalHours(rawTotal);
        fmHours = Math.max(0, totalRounded - WEEKLY_WORK_LIMIT);
        note = formatLeaveCaptionInt(leaveDaysInt, nIzin, nUbgt, nOther);
      } else {
        fmHours = baselineWeeklyFm;
      }
      chunks.push({
        startISO: toISODate(clipStart),
        endISO: toISODate(clipEnd),
        weeks: 1,
        brut,
        fmHours,
        yillikIzinAciklama: note,
      });
    }
    weekMon = addDays(weekMon, 7);
  }

  if (chunks.length === 0) return [row];

  const merged = mergeNormalWeekChunks(chunks);

  return merged.map((c, j) => {
    const weeks = normalizeWeeksForStandard(c.startISO, c.endISO, c.weeks);
    const fm = Number(
      (((c.brut * kats * weeks * c.fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2)
    );
    const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
    return {
      ...row,
      id: `auto-${c.startISO}-${c.endISO}-yl6-${segmentIndex}-${j}`,
      startISO: c.startISO,
      endISO: c.endISO,
      rangeLabel: `${c.startISO} – ${c.endISO}`,
      weeks,
      originalWeekCount: weeks,
      brut: c.brut,
      katsayi: kats,
      fmHours: c.fmHours,
      fm: Number(fm),
      net,
      wage: c.brut,
      overtimeAmount: Number(fm),
      yillikIzinAciklama: c.yillikIzinAciklama,
    } as FazlaMesaiRowBase;
  });
}

export function expandStandartRowsForSixDayAnnualLeave(
  rows: FazlaMesaiRowBase[],
  exclusions: ExcludedDay[] | null | undefined,
  dailyNet: number,
  baselineWeeklyFm: number,
  weeklyOffDay: number | null
): FazlaMesaiRowBase[] {
  if (!exclusions?.length || rows.length === 0) return rows;
  const out: FazlaMesaiRowBase[] = [];
  rows.forEach((row, i) => {
    out.push(
      ...expandStandartSegmentForSixDayAnnualLeave(
        row,
        exclusions,
        dailyNet,
        baselineWeeklyFm,
        i,
        weeklyOffDay
      )
    );
  });
  return out;
}
