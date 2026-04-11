/**
 * Borçlar / Gemi / Mevsimlik / Basın ihbar — aynı istek gövdesi (+isteğe bağlı kidemTotals), farklı endpoint
 */

import {
  calculateIhbarBasin,
  calculateIhbarBelirli,
  calculateIhbarBorclar,
  calculateIhbarGemi,
  calculateIhbarKismi,
  calculateIhbarMevsim,
} from "./api";
import type {
  CalculateIhbarBorclarRequest,
  CalculateIhbarBorclarResponse,
  Ihbar30FormData,
  TotalsData,
} from "./contract";

type CalcSuccess = {
  weeks: number;
  ihbarGun?: number;
  amount: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  net: number;
};

async function handleCalculateIhbarApi(
  apiCall: (req: CalculateIhbarBorclarRequest) => Promise<CalculateIhbarBorclarResponse>,
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void,
  logTag?: string,
  kidemTotals?: Pick<TotalsData, "yil" | "ay" | "gun">
): Promise<void> {
  try {
    if (!formValues || totals.toplam <= 0) return;

    const requestData: CalculateIhbarBorclarRequest = {
      brut: formValues.brutUcret || formValues.brut || "0",
      prim: formValues.prim || "0",
      ikramiye: formValues.ikramiye || "0",
      yol: formValues.yol || "0",
      yemek: formValues.yemek || "0",
      diger: "0",
      extras: formValues.extras || [],
      totals,
      exitYear: selectedYear,
    };
    if (kidemTotals != null) {
      requestData.kidemTotals = kidemTotals;
    }

    const response = await apiCall(requestData);

    if (response.success && response.data) {
      onSuccess({
        weeks: response.data.weeks || 2,
        ihbarGun: response.data.ihbarGun,
        amount: response.data.brut || 0,
        gelirVergisi: response.data.gelirVergisi || 0,
        gelirVergisiDilimleri: response.data.gelirVergisiDilimleri || "",
        damgaVergisi: response.data.damgaVergisi || 0,
        net: response.data.net || 0,
      });
    } else if (onError) {
      onError(response.error || "Hesaplama başarısız oldu");
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Hesaplama hatası oluştu";
    if (onError) onError(msg);
    else if (logTag) console.error(logTag, msg);
  }
}

export async function handleCalculateIhbarBorclar(
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void
): Promise<void> {
  return handleCalculateIhbarApi(
    calculateIhbarBorclar,
    formValues,
    totals,
    selectedYear,
    onSuccess,
    onError,
    "[ihbar borclar]"
  );
}

export async function handleCalculateIhbarGemi(
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void
): Promise<void> {
  return handleCalculateIhbarApi(
    calculateIhbarGemi,
    formValues,
    totals,
    selectedYear,
    onSuccess,
    onError,
    "[ihbar gemi]"
  );
}

export async function handleCalculateIhbarMevsim(
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void
): Promise<void> {
  return handleCalculateIhbarApi(
    calculateIhbarMevsim,
    formValues,
    totals,
    selectedYear,
    onSuccess,
    onError,
    "[ihbar mevsim]"
  );
}

/** Basın İş: kidemTotals = mesleğe başlangıç → işten çıkış (yıl/ay/gün) */
export async function handleCalculateIhbarBasin(
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  kidemTotals: Pick<TotalsData, "yil" | "ay" | "gun">,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void
): Promise<void> {
  return handleCalculateIhbarApi(
    calculateIhbarBasin,
    formValues,
    totals,
    selectedYear,
    onSuccess,
    onError,
    "[ihbar basin]",
    kidemTotals
  );
}

export async function handleCalculateIhbarKismi(
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void
): Promise<void> {
  return handleCalculateIhbarApi(
    calculateIhbarKismi,
    formValues,
    totals,
    selectedYear,
    onSuccess,
    onError,
    "[ihbar kismi]"
  );
}

export async function handleCalculateIhbarBelirli(
  formValues: Ihbar30FormData | null,
  totals: TotalsData,
  selectedYear: number,
  onSuccess: (data: CalcSuccess) => void,
  onError?: (error: string) => void
): Promise<void> {
  return handleCalculateIhbarApi(
    calculateIhbarBelirli,
    formValues,
    totals,
    selectedYear,
    onSuccess,
    onError,
    "[ihbar belirli]"
  );
}
