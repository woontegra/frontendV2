import { apiClient } from "@/utils/apiClient";

const SAVED_CASES = "/api/saved-cases";

export type BostaTotals = { toplam: number; yil: number; ay: number; gun: number };

export type BostaCalculation = {
  brutAmount: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  netAmount: number;
};

const EMPTY_CALC: BostaCalculation = {
  brutAmount: 0,
  sgk: 0,
  issizlik: 0,
  gelirVergisi: 0,
  gelirVergisiDilimleri: "",
  damgaVergisi: 0,
  netAmount: 0,
};

export async function loadSavedCase(loadId: string): Promise<unknown> {
  const response = await apiClient(`${SAVED_CASES}/${loadId}`);

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt: ${text.substring(0, 100)}`);
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Kayıt bulunamadı (ID: ${loadId}).`);
    }
    throw new Error(
      data.message || data.error || `Yükleme başarısız (${response.status})`
    );
  }

  return data;
}

export async function calculateBostaGecenSureApi(
  totals: BostaTotals,
  year: number,
  signal?: AbortSignal
): Promise<{ success: boolean; data?: BostaCalculation; error?: string }> {
  const res = await apiClient("/api/bosta-gecen-sure/calculate", {
    method: "POST",
    body: JSON.stringify({ totals, year }),
    signal,
  });

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return { success: false, error: "Geçersiz yanıt" };
  }

  const data = await res.json();
  if (!data.success || !data.data) {
    return { success: false, error: data.error || "Hesaplama yapılamadı" };
  }

  const d = data.data;
  return {
    success: true,
    data: {
      brutAmount: Number(d.brutAmount) || 0,
      sgk: Number(d.sgk) || 0,
      issizlik: Number(d.issizlik) || 0,
      gelirVergisi: Number(d.gelirVergisi) || 0,
      gelirVergisiDilimleri: String(d.gelirVergisiDilimleri || ""),
      damgaVergisi: Number(d.damgaVergisi) || 0,
      netAmount: Number(d.netAmount) || 0,
    },
  };
}

export { EMPTY_CALC };
