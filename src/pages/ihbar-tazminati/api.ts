/**
 * İhbar Tazminatı - kayıt yükleme API
 */

import { apiClient } from "@/utils/apiClient";
import type { Ihbar30SavedData, Ihbar30FormData, TotalsData } from "./contract";

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
