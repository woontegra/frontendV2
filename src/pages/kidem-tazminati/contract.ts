/**
 * Kıdem Tazminatı - backend sözleşmeleri
 */

export type ExtraItem = { id: string; label: string; value: string };

export interface LoadCalculationRequest {
  loadId: string;
}

export interface LoadCalculationResponse {
  name?: string;
  notes?: string;
  aciklama?: string;
  data?: Kidem30SavedData | string;
}

export interface Kidem30SavedData {
  form?: Kidem30FormData;
  formValues?: Kidem30FormData;
  results?: Kidem30ResultsData;
  data?: { form?: Kidem30FormData; results?: Kidem30ResultsData };
  appliedEklenti?: { field: string; value: number } | number | null;
  totals?: TotalsData;
  brutTazminat?: number;
  netTazminat?: number;
  brut?: number;
  net?: number;
  notes?: string;
}

export interface Kidem30FormData {
  brutUcret?: string;
  brut?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  diger?: string;
  startDate?: string;
  endDate?: string;
  exitDate?: string;
  iseGiris?: string;
  istenCikis?: string;
  extras?: Array<{ id: string; label: string; value: string }>;
  [key: string]: any;
}

export interface Kidem30ResultsData {
  totals?: TotalsData;
  brut?: number;
  net?: number;
}

export interface TotalsData {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}

export interface LoadCalculationResult {
  data: any;
  formValues: Kidem30FormData;
  appliedEklenti: { field: string; value: number } | number | null;
  totals: TotalsData;
  brutTazminat: number;
  netTazminat: number;
  notes: string;
  name: string | null;
}
