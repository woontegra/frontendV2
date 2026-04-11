import { apiClient, apiPost } from "@/utils/apiClient";
import type { KotuCalculateApiResponse, KotuTotals } from "./contract";

const ROUTES = {
  CALCULATE: "/api/kotu-niyet/calculate",
  SAVED_CASES: "/api/saved-cases",
} as const;

export async function calculateKotuNiyetApi(
  totals: KotuTotals,
  year: number
): Promise<KotuCalculateApiResponse> {
  const response = await apiPost(ROUTES.CALCULATE, { totals, year });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        (errorData as { error?: string; message?: string }).error ||
        (errorData as { message?: string }).message ||
        `HTTP ${response.status}`,
    };
  }

  return (await response.json()) as KotuCalculateApiResponse;
}

export async function loadSavedCase(loadId: string): Promise<unknown> {
  const response = await apiClient(`${ROUTES.SAVED_CASES}/${loadId}`);

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
