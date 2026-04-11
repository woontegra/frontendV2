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

/** Borçlar Kanunu ihbar — API istek/yanıt */
export interface CalculateIhbarBorclarRequest {
  brut: string;
  prim: string;
  ikramiye: string;
  yol: string;
  yemek: string;
  diger: string;
  extras: ExtraItem[];
  totals: TotalsData;
  /** Basın İş: mesleğe başlangıç → işten çıkış kıdem süresi (yıl/ay/gün) */
  kidemTotals?: Pick<TotalsData, "yil" | "ay" | "gun">;
  exitYear: number;
}

export interface CalculateIhbarBorclarResponse {
  success: boolean;
  data?: {
    weeks: number;
    /** Basın İş kıdeme göre ihbar günü (30 veya 90) */
    ihbarGun?: number;
    brut: number;
    gelirVergisi: number;
    gelirVergisiDilimleri: string;
    damgaVergisi: number;
    net: number;
  };
  error?: string;
}
