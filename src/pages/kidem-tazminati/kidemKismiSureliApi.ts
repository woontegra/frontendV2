import { apiClient } from "@/utils/apiClient";

export type KidemKismiSureliPeriod = { start: string; end: string; days: number };
export type KidemKismiSureliExtra = { id?: string; label?: string; value: string };

export type KidemKismiSureliResponseData = {
  brut: number;
  net: number;
  yilTutar: number;
  ayTutar: number;
  gunTutar: number;
  kullanilacakBrut: number;
  yil: number;
  ay: number;
  gun: number;
  totalDays: number;
  tavanUygulandi: boolean;
  tavanDegeri: number | null;
  warnings: string[];
};

export async function postKidemKismiSureli(body: {
  brutUcret: string;
  prim: string;
  ikramiye: string;
  yemek: string;
  diger: string;
  extras: KidemKismiSureliExtra[];
  periods: KidemKismiSureliPeriod[];
  exitDate?: string;
}): Promise<{ success: true; data: KidemKismiSureliResponseData } | { success: false; error?: string }> {
  const res = await apiClient("/api/kidem/kismi-sureli", {
    method: "POST",
    body: JSON.stringify(body),
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
  const o = json as { success?: boolean; error?: string; message?: string; data?: KidemKismiSureliResponseData };
  if (!res.ok) return { success: false, error: o?.error || o?.message || `HTTP ${res.status}` };
  return json as { success: true; data: KidemKismiSureliResponseData };
}
