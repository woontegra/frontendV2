/**
 * İhbar Tazminatı - hesaplama fonksiyonları
 */

import { parseMoney } from "./utils";
import { calculateIncomeTaxForLumpSum } from "@/pages/ucret-alacagi/UcretIndependent/localUtils/incomeTaxCore";

export function parseNum(v: string): number {
  return parseMoney(v || "0");
}

export function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCurrency(n: number | undefined): string {
  return `${fmt(n)}₺`;
}

/** İhbar tazminatı brüt = (Toplam Brüt / 30) × (hafta × 7) gün */
export function calculateIhbarTazminati(toplamBrut: number, weeks: number): number {
  return (toplamBrut / 30) * (weeks * 7);
}

export function calculateDamgaVergisi(brut: number): number {
  return Math.round(brut * 0.00759 * 100) / 100;
}

/** Gelir vergisi (ihbar tazminatı tek seferlik, matrah = brut) */
export function calculateGelirVergisi(brut: number, year: number): number {
  return calculateIncomeTaxForLumpSum(year, brut);
}

/** Net = brut - gelir vergisi - damga vergisi */
export function calculateNetDisplay(brut: number, year: number): number {
  const dv = calculateDamgaVergisi(brut);
  const gv = calculateGelirVergisi(brut, year);
  return Math.round((brut - dv - gv) * 100) / 100;
}
