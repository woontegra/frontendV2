/**
 * Kıdem Tazminatı - kayıt yükleme API
 */

import { apiClient } from "@/utils/apiClient";
import type {
  LoadCalculationRequest,
  LoadCalculationResponse,
  LoadCalculationResult,
  Kidem30SavedData,
} from "./contract";

export async function loadCalculation(request: LoadCalculationRequest): Promise<LoadCalculationResult> {
  const response = await apiClient(`/api/saved-cases/${request.loadId}`);
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
  }
  const data: LoadCalculationResponse = await response.json();
  if (!response.ok) {
    if (response.status === 404)
      throw new Error(`Kayıt bulunamadı (ID: ${request.loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`);
    throw new Error((data as any).notes || (data as any).aciklama || `Yükleme işlemi başarısız oldu (${response.status})`);
  }
  let payload: Kidem30SavedData = {};
  if (data.data) {
    if (typeof data.data === "string") {
      try {
        payload = JSON.parse(data.data);
      } catch {
        payload = {};
      }
    } else {
      payload = data.data as Kidem30SavedData;
    }
  }
  const formData = payload.form || payload.formValues || payload.data?.form || {};
  const resultsData = payload.results || payload.data?.results || {};
  return {
    data: payload,
    formValues: formData,
    appliedEklenti: payload.appliedEklenti || null,
    totals: resultsData.totals || payload.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 },
    brutTazminat: resultsData.brut ?? payload.brut ?? payload.brutTazminat ?? 0,
    netTazminat: resultsData.net ?? payload.net ?? payload.netTazminat ?? 0,
    notes: (data as any).notes || (data as any).aciklama || "",
    name: (data as any).name || null,
  };
}
