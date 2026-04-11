/**
 * İhbar Tazminatı - kayıt yükleme API
 */

import { apiClient, apiPost } from "@/utils/apiClient";
import type {
  Ihbar30SavedData,
  Ihbar30FormData,
  TotalsData,
  CalculateIhbarBorclarRequest,
  CalculateIhbarBorclarResponse,
} from "./contract";

export async function loadCalculation(loadId: string) {
  const response = await apiClient(`/api/saved-cases/${loadId}`);
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    throw new Error("Beklenmeyen yanit format: " + text.substring(0, 100));
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 404) throw new Error("Kayit bulunamadi (ID: " + loadId + ")");
    throw new Error(data.notes || data.aciklama || "Yukleme basarisiz (" + response.status + ")");
  }
  let payload: Ihbar30SavedData = {};
  if (data.data) {
    payload = typeof data.data === "string" ? (JSON.parse(data.data) || {}) : data.data;
  }
  const formData: Ihbar30FormData = payload.form || payload.formValues || {};
  const resultsData = payload.results || {};
  const totals: TotalsData = resultsData.totals || payload.totals || { toplam: 0, yil: 0, ay: 0, gun: 0 };
  const brutIhbar = resultsData.brut ?? payload.brut ?? payload.brutIhbar ?? 0;
  const netIhbar = resultsData.net ?? payload.net ?? payload.netIhbar ?? 0;
  return { data: payload, formValues: formData, appliedEklenti: payload.appliedEklenti || null, totals, brutIhbar, netIhbar, notes: data.notes || "", name: data.name || null };
}

export async function calculateIhbarBorclar(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost("/api/ihbar/borclar", request);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return { success: false, error: (err as { error?: string }).error || `HTTP ${response.status}` };
  }
  return response.json();
}

/** Gemi: backend aynı ihbar30.service hesabını kullanır */
export async function calculateIhbarGemi(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost("/api/ihbar/gemi", request);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return { success: false, error: (err as { error?: string }).error || `HTTP ${response.status}` };
  }
  return response.json();
}

/** Mevsimlik: backend aynı ihbar30.service hesabını kullanır */
export async function calculateIhbarMevsim(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost("/api/ihbar/mevsim", request);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return { success: false, error: (err as { error?: string }).error || `HTTP ${response.status}` };
  }
  return response.json();
}

/** Basın İşçileri: kıdem süresi ile 30/90 gün; backend kidemTotals + calculateIhbar30 */
export async function calculateIhbarBasin(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost("/api/ihbar/basin", request);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return { success: false, error: (err as { error?: string }).error || `HTTP ${response.status}` };
  }
  return response.json();
}

/** Kısmi süreli / part time: backend calculateIhbar30 */
export async function calculateIhbarKismi(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost("/api/ihbar/kismi", request);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return { success: false, error: (err as { error?: string }).error || `HTTP ${response.status}` };
  }
  return response.json();
}

/** Belirli süreli iş sözleşmesi: backend calculateIhbar30 */
export async function calculateIhbarBelirli(
  request: CalculateIhbarBorclarRequest
): Promise<CalculateIhbarBorclarResponse> {
  const response = await apiPost("/api/ihbar/belirli", request);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return { success: false, error: (err as { error?: string }).error || `HTTP ${response.status}` };
  }
  return response.json();
}
