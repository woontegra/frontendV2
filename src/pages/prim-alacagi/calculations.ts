/**
 * calculations.ts
 * Saf hesaplama — state / API yok.
 */

import type { PrimRowRequest } from "./contract";

export function parseNum(v: string): number {
  return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function calculateNetFromBrut(brut: number): number {
  return brut * (1 - 0.00759);
}

export function calculateDamgaVergisi(brut: number): number {
  return brut * 0.00759;
}

export function getBrutForNetConversion(brutInputForNet: string, total: number): number {
  const inputVal = parseNum(brutInputForNet);
  return inputVal > 0 ? inputVal : total;
}

export function validatePrimForm(rows: PrimRowRequest[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!rows || rows.length === 0) {
    errors.push("En az bir prim kalemi ekleyin");
  } else {
    rows.forEach((r, idx) => {
      if (!r.principal || parseNum(r.principal) <= 0) {
        errors.push(`${idx + 1}. satır: Geçerli bir matrah girin`);
      }
      if (!r.percent || parseNum(r.percent) <= 0) {
        errors.push(`${idx + 1}. satır: Geçerli bir oran girin`);
      }
    });
  }
  return { isValid: errors.length === 0, errors };
}
