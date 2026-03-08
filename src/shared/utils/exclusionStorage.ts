// Dışlanabilir günleri veritabanında kaydetme ve yükleme

export interface ExcludedDay {
  id: string;
  type: string;
  start: string;
  end: string;
  days: number;
}

export interface SavedExclusionSet {
  id: number;
  name: string;
  data: ExcludedDay[];
  createdAt: string;
}

import { apiClient } from "@/utils/apiClient";

/**
 * Tüm kayıtlı dışlama setlerini getir
 */
export async function getAllExclusionSets(): Promise<SavedExclusionSet[]> {
  try {
    const response = await apiClient("/api/exclusion-sets", {
      method: "GET",
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Dışlama setleri yüklenemedi:", error);
    return [];
  }
}

/**
 * Dışlanabilir günleri isimle kaydet
 */
export async function saveExclusionSet(name: string, data: ExcludedDay[]): Promise<boolean> {
  try {
    const response = await apiClient("/api/exclusion-sets", {
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
    console.error("Dışlama seti kaydedilemedi:", error);
    return false;
  }
}

/**
 * İsme göre dışlama setini yükle
 */
export async function loadExclusionSet(name: string): Promise<ExcludedDay[]> {
  try {
    const sets = await getAllExclusionSets();
    const found = sets.find(s => s.name === name);
    return found?.data || [];
  } catch (error) {
    console.error("Dışlama seti yüklenemedi:", error);
    return [];
  }
}

/**
 * Dışlama setini sil (ID ile)
 */
export async function deleteExclusionSet(id: number): Promise<boolean> {
  try {
    const response = await apiClient(`/api/exclusion-sets/${id}`, {
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
    console.error("Dışlama seti silinemedi:", error);
    return false;
  }
}
