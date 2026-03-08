/**
 * contract.ts
 * Backend ile olan TEK sözleşme burada olacak.
 * Request ve Response interface'leri burada tanımlanacak.
 */

// Extra Item tipi
export interface ExtraItem {
  id: string;
  name: string;
  value: string;
}

// Net from Gross API Request
export interface NetFromGrossRequest {
  gross: number;
  year: number;
}

// Net from Gross API Response
export interface NetFromGrossResponse {
  success: boolean;
  data?: {
    gross: number;
    sgk: number;
    issizlik: number;
    gelirVergisi: number;
    gelirVergisiDilimleri: string;
    damgaVergisi: number;
    net: number;
  };
  error?: string;
}

// Kayıt yükleme response (yukleHesap'tan gelen)
export interface LoadCalculationResponse {
  success: boolean;
  data?: DavaciUcretiSavedData;
  name?: string;
  error?: string;
}

// Kaydedilmiş davacı ücreti verisi formatı
export interface DavaciUcretiSavedData {
  data?: {
    form?: DavaciUcretiFormData;
    results?: DavaciUcretiResultsData;
    netFromGross?: NetFromGrossData;
  };
  form?: DavaciUcretiFormData;
  netFromGross?: NetFromGrossData;
  ciplakBrut?: string;
  extraItems?: ExtraItem[];
  selectedYear?: number;
  selectedPeriod?: 1 | 2;
  notes?: string;
}

export interface DavaciUcretiFormData {
  ciplakBrut?: string;
  extraItems?: ExtraItem[];
  selectedYear?: number;
  selectedPeriod?: 1 | 2; // 1: Ocak-Haziran, 2: Temmuz-Aralık
  notes?: string;
}

export interface DavaciUcretiResultsData {
  totals?: {
    totalBrut: number;
  };
  brut?: number;
  net?: number;
}

export interface NetFromGrossData {
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  net: number;
  /** Ücret Alacağı tarzı brütten nete detayı (asgari ücret istisnaları) */
  gelirVergisiBrut?: number;
  gelirVergisiIstisna?: number;
  damgaVergisiBrut?: number;
  damgaVergisiIstisna?: number;
}

export interface GrossFromNetData {
  net: number;
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  gelirVergisiBrut?: number;
  gelirVergisiIstisna?: number;
  damgaVergisiBrut?: number;
  damgaVergisiIstisna?: number;
}

// Kayıt kaydetme request (kaydetAc tarafından kullanılır)
export interface DavaciUcretiSaveData {
  data: {
    form: DavaciUcretiFormData;
    results: DavaciUcretiResultsData;
    netFromGross: NetFromGrossData;
  };
  brut_total: number;
  net_total: number;
}
