/**
 * storage.ts
 * Ekstra hesaplamalar için lokal storage fonksiyonları
 */

import type { ExtraItem } from "./contract";
import { apiClient } from "@/utils/apiClient";

export interface SavedExtraCalculationsSet {
  id: number;
  name: string;
  data: ExtraItem[];
  createdAt: string;
}

export async function getAllExtraCalculationsSets(): Promise<SavedExtraCalculationsSet[]> {
  try {
    const response = await apiClient("/api/extra-calculations-sets", {
      method: "GET",
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Ekstra hesaplama setleri yüklenemedi:", error);
    return [];
  }
}

export async function saveExtraCalculationsSet(name: string, data: ExtraItem[]): Promise<boolean> {
  try {
    const response = await apiClient("/api/extra-calculations-sets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, data }),
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Ekstra hesaplama seti kaydedilemedi:", error);
    return false;
  }
}

export async function loadExtraCalculationsSet(name: string): Promise<ExtraItem[]> {
  try {
    const sets = await getAllExtraCalculationsSets();
    const found = sets.find(s => s.name === name);
    return found?.data || [];
  } catch (error) {
    console.error("Ekstra hesaplama seti yüklenemedi:", error);
    return [];
  }
}

export async function deleteExtraCalculationsSet(id: number): Promise<boolean> {
  try {
    const response = await apiClient(`/api/extra-calculations-sets/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Ekstra hesaplama seti silinemedi:", error);
    return false;
  }
}
