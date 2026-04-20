/**
 * Tanıklı Standart: yıllık izin için satırları takvim haftasına böler,
 * o haftadaki izin günü payına göre çalışma günü ve haftalık FM saatini yeniden hesaplar.
 * applyAnnualLeaveExclusions (toplam gün / 7) yerine kullanılır; FM=0 satır üretilmez.
 */

import { addDays, startOfWeek } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { countAnnualLeaveCalendarDaysInWindow } from "./annualLeaveCalendarDays";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared/constants/asgariUcretler";
import { FAZLA_MESAI_DENOMINATOR, FAZLA_MESAI_KATSAYI } from "@/pages/fazla-mesai/standart/constants";
import {
  DAMGA_VERGISI_ORANI,
  GELIR_VERGISI_ORANI,
} from "./tableDisplayPipeline";
import { WEEKLY_WORK_LIMIT, STANDARD_DAILY_REFERENCE_HOURS } from "@/pages/fazla-mesai/standart/constants";
import { ceilWeeklyWorkHoursToHalfHour } from "./weeklyHoursRounding";

export interface TanikliRowWithDailyNet {
  id: string;
  startISO?: string;
  endISO?: string;
  weeks?: number;
  originalWeekCount?: number;
  brut?: number;
  katsayi?: number;
  fmHours?: number;
  fm?: number;
  net?: number;
  wage?: number;
  overtimeAmount?: number;
  rangeLabel?: string;
  dailyNet?: number;
  [key: string]: unknown;
}

function dateMax(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function dateMin(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weeklyFmFromWorkDays(
  dailyNet: number,
  workDays: number,
  hg: number,
  activeTab: "tatilsiz" | "tatilli"
): number {
  if (workDays <= 0) return 0;
  if (hg === 7 && activeTab === "tatilli") {
    if (workDays >= 7) {
      const weeklyNormal = 6 * dailyNet;
      const holidayOvertime = Math.max(0, dailyNet - STANDARD_DAILY_REFERENCE_HOURS);
      return Math.max(
        0,
        ceilWeeklyWorkHoursToHalfHour(weeklyNormal + holidayOvertime) - WEEKLY_WORK_LIMIT
      );
    }
    const weeklyNormal = 6 * dailyNet;
    const holidayOvertime = Math.max(0, dailyNet - STANDARD_DAILY_REFERENCE_HOURS);
    const fullWeekFm = Math.max(
      0,
      ceilWeeklyWorkHoursToHalfHour(weeklyNormal + holidayOvertime) - WEEKLY_WORK_LIMIT
    );
    return Math.max(0, Math.round((fullWeekFm * workDays) / 7));
  }
  if (hg === 7 && activeTab === "tatilsiz") {
    return Math.max(0, ceilWeeklyWorkHoursToHalfHour(dailyNet * workDays) - WEEKLY_WORK_LIMIT);
  }
  return Math.max(0, ceilWeeklyWorkHoursToHalfHour(dailyNet * workDays) - WEEKLY_WORK_LIMIT);
}

type WeekChunk = {
  startISO: string;
  endISO: string;
  weeks: number;
  fmHours: number;
  brut: number;
  katsayi: number;
  dailyNet: number;
};

function mergeChunks(chunks: WeekChunk[]): WeekChunk[] {
  if (chunks.length === 0) return [];
  const out: WeekChunk[] = [];
  let cur = { ...chunks[0] };
  for (let i = 1; i < chunks.length; i++) {
    const n = chunks[i];
    if (n.brut === cur.brut && n.fmHours === cur.fmHours && n.katsayi === cur.katsayi) {
      cur.endISO = n.endISO;
      cur.weeks += n.weeks;
    } else {
      out.push(cur);
      cur = { ...n };
    }
  }
  out.push(cur);
  return out;
}

function expandOneRow(
  row: TanikliRowWithDailyNet,
  exclusions: ExcludedDay[],
  hg: number,
  activeTab: "tatilsiz" | "tatilli",
  rowIndex: number
): TanikliRowWithDailyNet[] {
  const dailyNet = row.dailyNet;
  const startISO = row.startISO;
  const endISO = row.endISO;
  if (dailyNet == null || !startISO || !endISO) return [row];

  const rowStart = new Date(startISO);
  const rowEnd = new Date(endISO);
  if (Number.isNaN(+rowStart) || Number.isNaN(+rowEnd) || rowEnd < rowStart) return [row];

  const kats = row.katsayi ?? 1;
  const chunks: WeekChunk[] = [];

  let weekMonday = startOfWeek(rowStart, { weekStartsOn: 1 });
  const lastMonday = startOfWeek(rowEnd, { weekStartsOn: 1 });

  while (weekMonday <= lastMonday) {
    const weekSunday = addDays(weekMonday, 6);
    const segStart = dateMax(rowStart, weekMonday);
    const segEnd = dateMin(rowEnd, weekSunday);
    if (segStart <= segEnd) {
      const leaveDaysInt = Math.min(hg, countAnnualLeaveCalendarDaysInWindow(segStart, segEnd, exclusions));
      const workDays = Math.max(0, hg - leaveDaysInt);
      const fmWeek = weeklyFmFromWorkDays(dailyNet, workDays, hg, activeTab);
      if (fmWeek > 0) {
        const brut = getAsgariUcretByDate(toISODate(weekMonday)) || 0;
        chunks.push({
          startISO: toISODate(segStart),
          endISO: toISODate(segEnd),
          weeks: 1,
          fmHours: fmWeek,
          brut,
          katsayi: kats,
          dailyNet,
        });
      }
    }
    weekMonday = addDays(weekMonday, 7);
  }

  if (chunks.length === 0) return [];

  const merged = mergeChunks(chunks);
  return merged.map((c, j) => {
    const fm = Number(
      (((c.brut * c.katsayi * c.weeks * c.fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2)
    );
    const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
    return {
      ...row,
      id: `auto-wl-${row.id}-${rowIndex}-${j}`,
      startISO: c.startISO,
      endISO: c.endISO,
      rangeLabel: `${c.startISO} – ${c.endISO}`,
      weeks: c.weeks,
      originalWeekCount: c.weeks,
      brut: c.brut,
      katsayi: c.katsayi,
      fmHours: c.fmHours,
      dailyNet: c.dailyNet,
      fm: Number(fm),
      net,
      wage: c.brut,
      overtimeAmount: Number(fm),
    };
  });
}

/**
 * Tanıklı otomatik satırlarda haftalık yıllık izin; `dailyNet` yoksa satır olduğu gibi kalır.
 */
export function expandTanikliRowsWithWeeklyAnnualLeave(
  rows: TanikliRowWithDailyNet[],
  exclusions: ExcludedDay[] | null | undefined,
  hg: number,
  activeTab: "tatilsiz" | "tatilli"
): TanikliRowWithDailyNet[] {
  if (!exclusions?.length) return rows;

  const out: TanikliRowWithDailyNet[] = [];
  rows.forEach((row, rowIndex) => {
    if (row.dailyNet != null && row.startISO && row.endISO) {
      out.push(...expandOneRow(row, exclusions, hg, activeTab, rowIndex));
    } else {
      out.push(row);
    }
  });
  return out;
}
