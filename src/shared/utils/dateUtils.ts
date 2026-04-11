export type WorkPeriod = { years: number; months: number; days: number; totalDays: number; label: string };

/** ISO (YYYY-MM-DD) → Türkçe tarih (GG.AA.YYYY). Geçersiz/boş girişte "-" döner. */
export function isoToTR(iso?: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function calcWorkPeriodBilirKisi(startISO?: string, endISO?: string): WorkPeriod {
  if (!startISO || !endISO) return { years: 0, months: 0, days: 0, totalDays: 0, label: "" };
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(+s) || Number.isNaN(+e) || e < s) return { years: 0, months: 0, days: 0, totalDays: 0, label: "" };

  // Kapsayıcı hesaplama: işe giriş ve işten çıkış günleri dahil edilir
  e.setDate(e.getDate() + 1);

  // Parçala (ayları 1-12 yap)
  let sDay = s.getDate();
  let sMonth = s.getMonth() + 1;
  let sYear = s.getFullYear();

  let eDay = e.getDate();
  let eMonth = e.getMonth() + 1;
  let eYear = e.getFullYear();

  // 30-gün ay varsayımı
  if (sDay === 31) sDay = 30;
  if (eDay === 31) eDay = 30;

  // Gün borçlanma
  if (eDay < sDay) {
    eDay += 30;
    eMonth -= 1;
  }
  // Ay borçlanma
  if (eMonth < sMonth) {
    eMonth += 12;
    eYear -= 1;
  }

  let days = eDay - sDay; // sistemsel fark dahil; ekstra +1 yok
  let months = eMonth - sMonth;
  let years = eYear - sYear;

  // Devretmeler
  if (days >= 30) { days -= 30; months += 1; }
  if (months >= 12) { months -= 12; years += 1; }

  const label = `${years} yıl ${months} ay ${days} gün`;
  const totalDays = years * 365 + months * 30 + days; // referans amaçlı
  return { years, months, days, totalDays, label };
}

// Returns only the formatted label (e.g., "1 yıl 11 ay 15 gün")
export function calculateWorkPeriod(startDate: Date | string, endDate: Date | string): string {
  const s = typeof startDate === 'string' ? startDate : (startDate as Date)?.toISOString().slice(0,10);
  const e = typeof endDate === 'string' ? endDate : (endDate as Date)?.toISOString().slice(0,10);
  const wp = calcWorkPeriodBilirKisi(s as string, e as string);
  return wp.label;
}

/** Geçersiz günü ayın son geçerli gününe indirger (örn. 31.11 → 30.11). ISO string'i parse edip günü clamp'ler. */
export function clampToLastDayOfMonth(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  let day = parseInt(match[3], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(day) || m < 0 || m > 11 || day < 1) return iso;
  const lastDay = new Date(y, m + 1, 0).getDate();
  if (day <= lastDay) return iso;
  day = lastDay;
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** DD.MM.YYYY veya YYYY-MM-DD → YYYY-MM-DD (clampToLastDayOfMonth ve new Date için gerekli) */
function normalizeToISO(dateStr: string): string {
  const t = (dateStr || "").trim();
  if (!t) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return t;
}

// Calculate weeks between two dates (for overtime calculations)
export function calculateWeeksBetweenDates(startISO?: string, endISO?: string): number {
  const DEBUG = typeof window !== "undefined" && (window as any).__FM_DEBUG_WEEKS__;
  if (DEBUG) console.log("[calculateWeeksBetweenDates] IN:", { startISO, endISO });
  if (!startISO || !endISO) {
    if (DEBUG) console.log("[calculateWeeksBetweenDates] OUT: 0 (missing dates)");
    return 0;
  }
  const startNorm = clampToLastDayOfMonth(normalizeToISO(startISO));
  const endNorm = clampToLastDayOfMonth(normalizeToISO(endISO));
  const s = new Date(startNorm);
  const e = new Date(endNorm);
  if (Number.isNaN(+s) || Number.isNaN(+e) || e < s) {
    if (DEBUG) console.log("[calculateWeeksBetweenDates] OUT: 0 (invalid or reversed dates)", { startNorm, endNorm, sNaN: Number.isNaN(+s), eNaN: Number.isNaN(+e), eLessS: e < s });
    return 0;
  }
  const diffMs = e.getTime() - s.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.round(diffDays / 7);
  const result = Math.max(0, weeks);
  if (DEBUG) console.log("[calculateWeeksBetweenDates] OUT:", result, { startNorm, endNorm, diffDays });
  return result;
}
