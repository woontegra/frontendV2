/**
 * Haftalık Karma Fazla Mesai - Tip tanımları
 */

export interface PatternDay {
  dayCount: number;
  startTime: string;
  endTime: string;
}

/** Tanık gün grubu (eski sayfa: days, startTime, endTime) */
export interface WitnessDayGroup {
  days: number;
  startTime: string;
  endTime: string;
}

export interface HaftalikKarmaWitness {
  id: number;
  name?: string;
  startDateISO: string;
  endDateISO: string;
  dayGroups: WitnessDayGroup[];
}

export interface HaftalikKarmaState {
  weeklyStartDateISO: string;
  weeklyEndDateISO: string;
  dayGroups: PatternDay[];
  witnesses: HaftalikKarmaWitness[];
  hasWeeklyHoliday?: boolean;
  weeklyHolidayGroup?: number;
  exclusions?: Array<{ type: string; start: string; end: string; days: number }>;
}
