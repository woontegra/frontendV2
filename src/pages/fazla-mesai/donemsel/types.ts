/**
 * Dönemsel Fazla Mesai - Tip tanımları
 * Yaz/Kış desen modeli
 */

export interface SeasonalPattern {
  months: number[];
  startTime: string;
  endTime: string;
  /** Klasik dönemsel: haftalık gün (1–7). Dönemsel haftalıkta grup günleri kullanılır. */
  workDays?: number;
  /** Dönemsel haftalık — Grup 1 */
  days1?: number;
  /** Dönemsel haftalık — Grup 2 */
  days2?: number;
  startTime2?: string;
  endTime2?: string;
  /** Toplam gün 7 iken: hafta tatili var mı */
  hasWeeklyHoliday?: boolean;
  /** Hafta tatili hangi grupta sayılsın (1 veya 2) */
  weeklyHolidayRow?: 1 | 2;
}

export interface DonemselWitness {
  id: number;
  name?: string;
  dateIn: string;
  dateOut: string;
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
}

export interface DonemselState {
  dateIn: string;
  dateOut: string;
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
  witnessesSeasons: DonemselWitness[];
}

export const DEFAULT_SUMMER_PATTERN: SeasonalPattern = {
  months: [4, 5, 6, 7, 8, 9],
  startTime: "08:00",
  endTime: "20:00",
  workDays: 6,
};

export const DEFAULT_WINTER_PATTERN: SeasonalPattern = {
  months: [1, 2, 3, 10, 11, 12],
  startTime: "09:00",
  endTime: "18:00",
  workDays: 6,
};

/** Dönemsel haftalık — gün sayıları boş başlar; toplam 7 olunca hafta tatili seçilebilir */
export const DEFAULT_SUMMER_PATTERN_HAFTALIK: SeasonalPattern = {
  months: [4, 5, 6, 7, 8, 9],
  startTime: "",
  endTime: "",
  startTime2: "",
  endTime2: "",
  hasWeeklyHoliday: false,
  weeklyHolidayRow: 2,
};

export const DEFAULT_WINTER_PATTERN_HAFTALIK: SeasonalPattern = {
  months: [1, 2, 3, 10, 11, 12],
  startTime: "",
  endTime: "",
  startTime2: "",
  endTime2: "",
  hasWeeklyHoliday: false,
  weeklyHolidayRow: 2,
};

export const MONTHS = [
  { value: 1, label: "Oca" },
  { value: 2, label: "Şub" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Nis" },
  { value: 5, label: "May" },
  { value: 6, label: "Haz" },
  { value: 7, label: "Tem" },
  { value: 8, label: "Ağu" },
  { value: 9, label: "Eyl" },
  { value: 10, label: "Eki" },
  { value: 11, label: "Kas" },
  { value: 12, label: "Ara" },
];
