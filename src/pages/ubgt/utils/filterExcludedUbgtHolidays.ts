/**
 * UBGT günü türü bazlı dışlama – sadece liste filtreler, hesaplama yapmaz.
 * Pure function.
 */

// UBGT gün tipleri (ekranla birebir tam liste)
export type UbgtHolidayType =
  | "OCT_28_HALF"       // 28 Ekim - 0.5 gün
  | "OCT_29"           // 29 Ekim - 1 gün
  | "APR_23"           // 23 Nisan
  | "MAY_19"           // 19 Mayıs
  | "AUG_30"           // 30 Ağustos
  | "JAN_1"            // Yılbaşı
  | "MAY_1"            // 1 Mayıs
  | "JUL_15"           // 15 Temmuz
  | "RAMADAN_AREFE_HALF"
  | "RAMADAN_1"
  | "RAMADAN_2"
  | "RAMADAN_3"
  | "KURBAN_AREFE_HALF"
  | "KURBAN_1"
  | "KURBAN_2"
  | "KURBAN_3"
  | "KURBAN_4";

/** Tek bir UBGT günü kaydı (holidayType eşleşmesi için) */
export interface UbgtDayEntry {
  holidayType: UbgtHolidayType;
  date: string;
  days: number;
  periodIndex?: number;
}

/** Yıl aralığı bazlı dışlama kuralı */
export interface UbgtExclusionRule {
  startYear: number;
  endYear: number;
  excludedHolidayTypes: UbgtHolidayType[];
}

/** Dropdown ve filtre için tam UBGT gün listesi (ekranla birebir) */
export const UBGT_HOLIDAY_TYPES: { value: UbgtHolidayType; label: string }[] = [
  { value: "OCT_28_HALF", label: "28 Ekim - 0.5 gün" },
  { value: "OCT_29", label: "29 Ekim - 1 gün" },
  { value: "APR_23", label: "23 Nisan" },
  { value: "MAY_19", label: "19 Mayıs" },
  { value: "AUG_30", label: "30 Ağustos" },
  { value: "JAN_1", label: "Yılbaşı" },
  { value: "MAY_1", label: "1 Mayıs" },
  { value: "JUL_15", label: "15 Temmuz" },
  { value: "RAMADAN_AREFE_HALF", label: "Ramazan Arife - 0.5 gün" },
  { value: "RAMADAN_1", label: "Ramazan 1. Gün" },
  { value: "RAMADAN_2", label: "Ramazan 2. Gün" },
  { value: "RAMADAN_3", label: "Ramazan 3. Gün" },
  { value: "KURBAN_AREFE_HALF", label: "Kurban Arife - 0.5 gün" },
  { value: "KURBAN_1", label: "Kurban 1. Gün" },
  { value: "KURBAN_2", label: "Kurban 2. Gün" },
  { value: "KURBAN_3", label: "Kurban 3. Gün" },
  { value: "KURBAN_4", label: "Kurban 4. Gün" },
];

/** UBGT gün tipi başına gerçek gün değeri (UI özeti için; hesaplama değil) */
export const UBGT_HOLIDAY_DAYS: Record<UbgtHolidayType, number> = {
  OCT_28_HALF: 0.5,
  OCT_29: 1,
  APR_23: 1,
  MAY_19: 1,
  AUG_30: 1,
  JAN_1: 1,
  MAY_1: 1,
  JUL_15: 1,
  RAMADAN_AREFE_HALF: 0.5,
  RAMADAN_1: 1,
  RAMADAN_2: 1,
  RAMADAN_3: 1,
  KURBAN_AREFE_HALF: 0.5,
  KURBAN_1: 1,
  KURBAN_2: 1,
  KURBAN_3: 1,
  KURBAN_4: 1,
};

/** Davacı beyanı tarih aralığından yıl listesi (UI dropdown için; hesaplama değil) */
export function getYearsFromDateRange(rangeStart: string, rangeEnd: string): number[] {
  if (!rangeStart || !rangeEnd) return [];
  const y1 = parseInt(rangeStart.slice(0, 4), 10);
  const y2 = parseInt(rangeEnd.slice(0, 4), 10);
  if (y1 > y2) return [];
  const years: number[] = [];
  for (let y = y1; y <= y2; y++) years.push(y);
  return years;
}

/** Sabit tarihli UBGT: tip → (ay 0–11, gün) — sadece UI filtreleme için */
const FIXED_DATE_BY_TYPE: Partial<Record<UbgtHolidayType, { month: number; day: number }>> = {
  OCT_28_HALF: { month: 9, day: 28 },
  OCT_29: { month: 9, day: 29 },
  APR_23: { month: 3, day: 23 },
  MAY_19: { month: 4, day: 19 },
  AUG_30: { month: 7, day: 30 },
  JAN_1: { month: 0, day: 1 },
  MAY_1: { month: 4, day: 1 },
  JUL_15: { month: 6, day: 15 },
};

/** Hangi yıldan itibaren UBGT (mevzuat; sadece UI, hesaplama motoru değil) */
const VALID_FROM_YEAR: Partial<Record<UbgtHolidayType, number>> = {
  MAY_1: 2009,
  JUL_15: 2017,
};

/** Bu UBGT tipi seçilen yılda geçerli mi? */
export function isUbgtTypeValidInYear(type: UbgtHolidayType, year: number): boolean {
  const from = VALID_FROM_YEAR[type];
  if (from != null) return year >= from;
  return true;
}

/**
 * Seçilen yıl + davacı beyanı tarih aralığına göre listede gösterilecek UBGT tipleri.
 * Koşullar: (1) O yılda UBGT tanımlı, (2) Tarihi [rangeStart, rangeEnd] içinde.
 * Sadece sabit tarihli günler (dini bayram tarihi frontend'de yok).
 */
export function getUbgtTypesForYearAndRange(
  selectedYear: number,
  rangeStart: string,
  rangeEnd: string
): UbgtHolidayType[] {
  if (!rangeStart || !rangeEnd) return [];
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  const result: UbgtHolidayType[] = [];
  for (const entry of UBGT_HOLIDAY_TYPES) {
    const type = entry.value;
    if (!isUbgtTypeValidInYear(type, selectedYear)) continue;
    const fixed = FIXED_DATE_BY_TYPE[type];
    if (fixed) {
      const d = new Date(selectedYear, fixed.month, fixed.day);
      if (d >= start && d <= end) result.push(type);
    }
  }
  return result;
}

/** Backend holidayId -> UbgtHolidayType (API yanıtını dönüştürmek için) */
export const BACKEND_ID_TO_UBGT_TYPE: Record<string, UbgtHolidayType> = {
  "28-ekim": "OCT_28_HALF",
  "29-ekim": "OCT_29",
  "23-nisan": "APR_23",
  "19-mayis": "MAY_19",
  "30-agustos": "AUG_30",
  "1-ocak": "JAN_1",
  "1-mayis": "MAY_1",
  "15-temmuz": "JUL_15",
  "ramazan-arife": "RAMADAN_AREFE_HALF",
  "ramazan-1": "RAMADAN_1",
  "ramazan-2": "RAMADAN_2",
  "ramazan-3": "RAMADAN_3",
  "kurban-arife": "KURBAN_AREFE_HALF",
  "kurban-1": "KURBAN_1",
  "kurban-2": "KURBAN_2",
  "kurban-3": "KURBAN_3",
  "kurban-4": "KURBAN_4",
};

/**
 * holidayType'ı excludedUbgtHolidays içinde olan günleri listeden çıkarır.
 * Sadece filtreler; hesaplama yapmaz.
 */
export function filterExcludedUbgtHolidays<T extends UbgtDayEntry>(
  ubgtDays: T[],
  excludedUbgtHolidays: UbgtHolidayType[]
): T[] {
  if (!excludedUbgtHolidays || excludedUbgtHolidays.length === 0) {
    return ubgtDays;
  }
  const set = new Set(excludedUbgtHolidays);
  return ubgtDays.filter((d) => !set.has(d.holidayType));
}

/**
 * Yıl aralığı bazlı kurallara göre günleri filtreler.
 * Bir gün: yılı herhangi bir rule'un startYear–endYear aralığındaysa VE
 * holidayType o rule'un excludedHolidayTypes içindeyse → listeden çıkarılır.
 * Kural yoksa liste aynen döner. Sadece filtreler; hesaplama yapmaz.
 */
export function filterExcludedUbgtHolidaysByRules<T extends UbgtDayEntry>(
  ubgtDays: T[],
  rules: UbgtExclusionRule[]
): T[] {
  if (!rules || rules.length === 0) {
    return ubgtDays;
  }
  return ubgtDays.filter((d) => {
    const year = parseInt(d.date.slice(0, 4), 10);
    const shouldExclude = rules.some(
      (r) =>
        year >= r.startYear &&
        year <= r.endYear &&
        r.excludedHolidayTypes.length > 0 &&
        r.excludedHolidayTypes.includes(d.holidayType)
    );
    return !shouldExclude;
  });
}
