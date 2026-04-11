/**
 * Mevsimlik işçi kıdem — v1 KidemMevsimlikIndependent ile uyumlu (gün payı 360, net = brüt − damga).
 */
import { findKidemTavan, parseMoney } from "./utils";

export type WorkPeriod = { start: string; end: string; days: number };

export function calculatePeriodDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

/** Toplam takvim gününden yıl/ay/gün (365 gün = 1 yıl, kalan 30 günlük ay) */
export function formatCalismaSuresiMevsimlik(totals: { yil: number; ay: number; gun: number }): string {
  const yil = totals.yil ?? 0;
  const ay = totals.ay ?? 0;
  const gun = totals.gun ?? 0;
  return `${yil} Yıl ${ay} Ay ${gun} Gün`;
}

export function convertDaysToYilAyGun(totalDays: number): { yil: number; ay: number; gun: number } {
  const d = Math.max(0, Math.floor(totalDays));
  const yil = Math.floor(d / 365);
  const kalanGun = d % 365;
  const ay = Math.floor(kalanGun / 30);
  const gun = kalanGun % 30;
  return { yil, ay, gun };
}

export function calculateMevsimlikKidemTazminati(
  brutUcret: number,
  yil: number,
  ay: number,
  gun: number,
  exitDate?: Date
): {
  kullanilacakBrut: number;
  yilTutar: number;
  ayTutar: number;
  gunTutar: number;
  toplamTutar: number;
  tavanUygulandi: boolean;
  warnings: string[];
} {
  let kullanilacakBrut = brutUcret;
  let tavanUygulandi = false;
  const warnings: string[] = [];

  if (exitDate) {
    const tavan = findKidemTavan(exitDate);
    if (tavan && brutUcret > tavan) {
      kullanilacakBrut = tavan;
      tavanUygulandi = true;
      warnings.push(
        `Aylık brüt ücret, dönem tavanı olan ${tavan.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺'yi aştığı için tavan seviyesine çekilmiştir. Hesaplamalar tavan değeri üzerinden yapılmıştır.`
      );
    }
  }

  const yilTutar = kullanilacakBrut * yil;
  const ayTutar = (kullanilacakBrut / 12) * ay;
  const gunTutar = (kullanilacakBrut / 360) * gun;

  return {
    kullanilacakBrut,
    yilTutar,
    ayTutar,
    gunTutar,
    toplamTutar: yilTutar + ayTutar + gunTutar,
    tavanUygulandi,
    warnings,
  };
}

/** Aylık brüt bileşen toplamı — diğer kıdem sayfaları (Kidem30/Gemi) ile aynı kalem seti */
export function calculateMevsimlikBrutUcretToplam(formValues: {
  brutUcret?: string;
  brut?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  diger?: string;
  extras?: Array<{ value: string }>;
}): number {
  const base =
    parseMoney(formValues.brutUcret || formValues.brut || "0") +
    parseMoney(formValues.prim || "0") +
    parseMoney(formValues.ikramiye || "0") +
    parseMoney(formValues.yol || "0") +
    parseMoney(formValues.yemek || "0") +
    parseMoney(formValues.diger || "0");
  const extrasSum = (formValues.extras || []).reduce((a, it) => a + parseMoney(it.value || "0"), 0);
  return base + extrasSum;
}

export function calculateDamgaVergisiMevsimlik(brutKidem: number): number {
  return brutKidem * 0.00759;
}

export function calculateNetMevsimlik(brutKidem: number): number {
  return brutKidem - calculateDamgaVergisiMevsimlik(brutKidem);
}
