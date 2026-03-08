/**
 * Kıdem Tazminatı - aksiyonlar (calculations'a yönlendirir)
 */

import {
  calculateKullanilacakBrutUcret,
  calculateTavanBilgisi,
  calculateKidemTazminati,
  calculateDamgaVergisi,
  calculateNetDisplay,
  checkKidemTazminatiHakki,
} from "./calculations";
import type { FormValuesState, TotalsState } from "./state";

export function handleCalculateKullanilacakBrutUcret(formValues: FormValuesState, exitDate: string): number {
  return calculateKullanilacakBrutUcret(formValues, exitDate);
}

export function handleCalculateTavanBilgisi(
  formValues: FormValuesState,
  exitDate: string
): { tavanUygulandiFlag: boolean; tavanDegeriValue: number | null; warnings: string[] } {
  return calculateTavanBilgisi(formValues, exitDate);
}

export function handleCalculateKidemTazminati(
  kullanilacakBrutUcret: number,
  totals: TotalsState
): { brutTazminat: number; netTazminat: number } {
  return calculateKidemTazminati(kullanilacakBrutUcret, totals);
}

export function handleCalculateDamgaVergisi(brut: number): number {
  return calculateDamgaVergisi(brut);
}

export function handleCalculateNetDisplay(brut: number): number {
  return calculateNetDisplay(brut);
}

export function handleCheckKidemTazminatiHakki(totals: TotalsState): boolean {
  return checkKidemTazminatiHakki(totals);
}
