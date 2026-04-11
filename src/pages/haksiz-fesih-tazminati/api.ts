import { apiClient } from "@/utils/apiClient";

const SAVED_CASES = "/api/saved-cases";

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
