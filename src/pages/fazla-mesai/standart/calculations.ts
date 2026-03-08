/**
 * Standart Fazla Mesai - hesaplama fonksiyonları
 * FM = (brüt × katsayı × hafta × fmHours) / 225 × 1.5
 */

import { FAZLA_MESAI_DENOMINATOR, FAZLA_MESAI_KATSAYI } from "./constants";

export function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCurrency(n: number | undefined): string {
  return `${fmt(n)}₺`;
}

/** Fazla mesai brüt = (brüt × katSayi × hafta × fmHours) / 225 × 1.5 */
export function calculateFazlaMesaiBrut(
  brut: number,
  katSayi: number,
  weeks: number,
  fmHours: number
): number {
  if (!brut || !fmHours) return 0;
  const k = katSayi || 1;
  const w = Math.max(0, weeks);
  const step = (brut * k * w * fmHours) / FAZLA_MESAI_DENOMINATOR;
  return Math.round(step * FAZLA_MESAI_KATSAYI * 100) / 100;
}
