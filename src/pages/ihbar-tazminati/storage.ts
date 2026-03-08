/**
 * İhbar Tazminatı - ekstra hesaplama setleri
 */

import type { ExtraItem } from "./contract";
import { apiClient } from "@/utils/apiClient";

export interface SavedExtraCalculationsSet {
  id: number;
  name: string;
  data: Array<{ id: string; name: string; value: string }>;
  createdAt: string;
}

export async function getAllExtraCalculationsSets(): Promise<SavedExtraCalculationsSet[]> {
  try {
    const response = await apiClient("/api/extra-calculations-sets", { method: "GET" });
    if (!response.ok) return [];
    const data = await response.json();
    return data || [];
  } catch {
    return [];
  }
}

export async function saveExtraCalculationsSet(
  name: string,
  data: Array<{ id: string; name: string; value: string }>
): Promise<boolean> {
  try {
    const response = await apiClient("/api/extra-calculations-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function loadExtraCalculationsSet(name: string): Promise<ExtraItem[]> {
  try {
    const sets = await getAllExtraCalculationsSets();
    const found = sets.find((s) => s.name === name);
    if (!found?.data) return [];
    return found.data.map((item) => ({ id: item.id, label: item.name, value: item.value }));
  } catch {
    return [];
  }
}

export async function deleteExtraCalculationsSet(id: number): Promise<boolean> {
  try {
    const response = await apiClient(`/api/extra-calculations-sets/${id}`, { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}
