/**
 * İhbar Tazminatı - tipler
 */

export type ExtraItem = { id: string; label: string; value: string };

export interface LoadCalculationRequest {
  loadId: string;
}

export interface Ihbar30SavedData {
  form?: Ihbar30FormData;
  formValues?: Ihbar30FormData;
  results?: Ihbar30ResultsData;
  totals?: TotalsData;
  brutIhbar?: number;
  netIhbar?: number;
  brut?: number;
  net?: number;
  appliedEklenti?: { field: string; value: number } | null;
  [key: string]: any;
}

export interface Ihbar30FormData {
  brutUcret?: string;
  brut?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  startDate?: string;
  endDate?: string;
  exitDate?: string;
  iseGiris?: string;
  istenCikis?: string;
  extras?: ExtraItem[];
  [key: string]: any;
}

export interface Ihbar30ResultsData {
  totals?: TotalsData;
  brut?: number;
  net?: number;
  weeks?: number;
}

export interface TotalsData {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}
