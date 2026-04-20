/**
 * Fazla mesai sayfaları — UBGT gün kataloğu: backend UBGT standart hesabı ile aynı tatil listesi.
 */

import { apiPost } from "@/utils/apiClient";

/** `/api/ubgt/standard` için tüm sabit tatil kimlikleri (boş liste 0 gün döndürür). */
export const ALL_UBGT_STANDARD_HOLIDAY_IDS: string[] = [
  "28-ekim",
  "29-ekim",
  "23-nisan",
  "19-mayis",
  "30-agustos",
  "1-ocak",
  "1-mayis",
  "15-temmuz",
  "ramazan-arife",
  "ramazan-1",
  "ramazan-2",
  "ramazan-3",
  "kurban-arife",
  "kurban-1",
  "kurban-2",
  "kurban-3",
  "kurban-4",
];

const HOLIDAY_LABELS: Record<string, string> = {
  "28-ekim": "28 Ekim",
  "29-ekim": "29 Ekim",
  "23-nisan": "23 Nisan",
  "19-mayis": "19 Mayıs",
  "30-agustos": "30 Ağustos",
  "1-ocak": "Yılbaşı",
  "1-mayis": "1 Mayıs",
  "15-temmuz": "15 Temmuz",
  "ramazan-arife": "Ramazan Arife",
  "ramazan-1": "Ramazan 1. Gün",
  "ramazan-2": "Ramazan 2. Gün",
  "ramazan-3": "Ramazan 3. Gün",
  "kurban-arife": "Kurban Arife",
  "kurban-1": "Kurban 1. Gün",
  "kurban-2": "Kurban 2. Gün",
  "kurban-3": "Kurban 3. Gün",
  "kurban-4": "Kurban 4. Gün",
};

export interface UbgtFmCatalogRow {
  date: string;
  holidayId: string;
  days: number;
  label: string;
}

export function labelForUbgtHolidayId(id: string): string {
  return HOLIDAY_LABELS[id] ?? id;
}

/**
 * Seçilen dönem için UBGT takvim günlerini backend'den alır (tekrarsız, tarih sıralı).
 */
export async function fetchUbgtFmCatalog(startISO: string, endISO: string): Promise<UbgtFmCatalogRow[]> {
  if (!startISO || !endISO || startISO > endISO) return [];

  const year = Number(startISO.slice(0, 4)) || new Date().getFullYear();

  const response = await apiPost("/api/ubgt/standard", {
    dateRanges: [{ start: startISO, end: endISO }],
    selectedHolidayIds: ALL_UBGT_STANDARD_HOLIDAY_IDS,
    ubgtExcludedDays: [],
    ubgtExpiryStart: null,
    year,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `UBGT katalog HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result?.success || !result?.data) {
    throw new Error((result as { error?: string }).error || "UBGT katalog yanıtı geçersiz");
  }

  const raw = (result.data.ubgtDayEntries || []) as Array<{
    date: string;
    holidayId: string;
    days?: number;
    duration?: number;
  }>;

  const byDate = new Map<string, UbgtFmCatalogRow>();
  for (const e of raw) {
    if (!e?.date) continue;
    const d = String(e.date).slice(0, 10);
    const hid = String(e.holidayId || "");
    const days = Number(e.days ?? e.duration);
    const row: UbgtFmCatalogRow = {
      date: d,
      holidayId: hid,
      days: Number.isFinite(days) && days > 0 ? days : 1,
      label: labelForUbgtHolidayId(hid),
    };
    if (!byDate.has(d)) byDate.set(d, row);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
