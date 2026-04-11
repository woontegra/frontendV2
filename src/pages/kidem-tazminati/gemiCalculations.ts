/**
 * Gemi Adamları kıdem — v1 KidemGemiIndependent/calculations ile uyumlu (brüt kıdem + GVK 25/7 net).
 */
import { calculateIncomeTaxForYear } from "@/shared/utils/incomeTaxCore";
import { parseMoney } from "./utils";
import type { FormValuesState, TotalsState } from "./state";

export function calculateGemiBrutKidemTazminati(kullanilacakBrutUcret: number, totals: TotalsState): number {
  const yil = totals.yil || 0;
  const ay = totals.ay || 0;
  const gun = totals.gun || 0;
  return (
    kullanilacakBrutUcret * yil +
    (kullanilacakBrutUcret / 12) * ay +
    (kullanilacakBrutUcret / 365) * gun
  );
}

export function calculateCiplakBrutUcret(formValues: FormValuesState): number {
  return parseMoney(formValues.brutUcret || formValues.brut || "0");
}

export function calculateMuafiyetTutari(ciplakBrutUcret: number): number {
  return ciplakBrutUcret * 24;
}

export function calculateDamgaVergisi(brutKidem: number): number {
  return brutKidem * 0.00759;
}

/**
 * Gelir vergisi: kıdem brütü > 24 aylık çıplak brüt muafiyeti ise vergiye tabi matrah üzerinden.
 */
export function calculateGelirVergisiKidem(brutKidem: number, muafiyetTutari: number, year: number): number {
  if (brutKidem <= muafiyetTutari) return 0;
  const vergiyeTabi = brutKidem - muafiyetTutari;
  return calculateIncomeTaxForYear(year, vergiyeTabi);
}

export function calculateGemiNetDisplay(
  brutKidem: number,
  damgaVergisi: number,
  gelirVergisi: number
): number {
  return brutKidem - damgaVergisi - gelirVergisi;
}
