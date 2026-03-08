/**
 * Yıllık izin dışlamalarını hesaplama tablosu satırlarına uygular.
 * Kullanıcının girdiği "gün" (excl.days) kullanılır; tarihten hesaplanan değil.
 * Tüm yıllık izin dışlaması yapan sayfalarda import edilerek kullanılır.
 */

import { differenceInCalendarDays } from "date-fns";
import type { ExcludedDay } from "@/utils/exclusionStorage";

export interface RowWithExclusionFields {
  startISO: string;
  endISO: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  rangeLabel?: string;
  [key: string]: unknown;
}

export interface ApplyAnnualLeaveExclusionsOptions {
  /** Düşüm sonrası satırda en az bu kadar hafta kalır (örn. 1 = Tanıklı Standart, 0 = Haftalık Karma). */
  minWeeks?: number;
}

/**
 * Satır listesine yıllık izin dışlaması uygular.
 * Her satır için: kesişen dışlamalarda (kesişen gün / dışlama span) * excl.days payı hesaplanır,
 * toplam gün / 7 yuvarlanarak hafta düşümü yapılır.
 */
export function applyAnnualLeaveExclusions<T extends RowWithExclusionFields>(
  rows: T[],
  exclusions: ExcludedDay[] | null | undefined,
  options: ApplyAnnualLeaveExclusionsOptions = {}
): T[] {
  const { minWeeks = 0 } = options;

  if (!exclusions || exclusions.length === 0) {
    return rows;
  }

  return rows.map((row) => {
    if (!row.startISO || !row.endISO) return row;

    const rowStart = new Date(row.startISO);
    const rowEnd = new Date(row.endISO);

    let totalOverlapDays = 0;
    exclusions.forEach((excl) => {
      const exclStart = new Date(excl.start);
      const exclEnd = new Date(excl.end);
      if (exclStart > rowEnd || exclEnd < rowStart) return;

      const overlapStart = exclStart > rowStart ? exclStart : rowStart;
      const overlapEnd = exclEnd < rowEnd ? exclEnd : rowEnd;
      const overlapCalendarDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
      const exclCalendarSpan = Math.max(1, differenceInCalendarDays(exclEnd, exclStart) + 1);
      const effectiveExclDays =
        typeof excl.days === "number" && excl.days >= 0 ? excl.days : exclCalendarSpan;
      const rowShare = (overlapCalendarDays / exclCalendarSpan) * effectiveExclDays;
      totalOverlapDays += rowShare;
    });

    if (totalOverlapDays <= 0) return row;

    const weeksToDeduct = Math.round(totalOverlapDays / 7);
    if (weeksToDeduct === 0) return row;

    const newWeeks = Math.max(minWeeks, row.weeks - weeksToDeduct);
    const newFm = (newWeeks * row.brut * row.katsayi * row.fmHours) / 225 * 1.5;

    return {
      ...row,
      weeks: newWeeks,
      fm: Number(newFm.toFixed(2)),
    };
  });
}
