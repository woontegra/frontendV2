export type KotuTotals = { toplam: number; yil: number; ay: number; gun: number };

export type KotuCalculation = {
  weeks: number;
  brutAmount: number;
  damgaVergisi: number;
  netAmount: number;
};

export type KotuCalculateApiResponse =
  | { success: true; data: KotuCalculation }
  | { success: false; error?: string };
