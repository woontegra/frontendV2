import { apiClient } from "@/utils/apiClient";

const SAVED_CASES = "/api/saved-cases";

export type IseAlmamaRow = { label: string; value: number; k: number };

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

/** Backend: iseAlmamaTazminati.service — 4–8 aylık katsayılar */
export async function calculateIseAlmama(
  brutUcret: number,
  signal?: AbortSignal
): Promise<IseAlmamaRow[]> {
  const res = await apiClient("/api/ise-almama/calculate", {
    method: "POST",
    body: JSON.stringify({ brutUcret }),
    signal,
  });

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Beklenmeyen yanıt formatı");
  }

  const data = await res.json();
  if (!data.success || !data.data?.rows) {
    throw new Error(data.error || "Hesaplama yapılamadı");
  }

  return data.data.rows as IseAlmamaRow[];
}
