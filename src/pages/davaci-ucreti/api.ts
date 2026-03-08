/**
 * api.ts
 * Backend çağrıları SADECE burada olacak.
 * fetch / axios sadece burada kullanılır.
 * Route path'leri burada sabitlenir.
 */

import { loadCalculation as loadCalculationFromSave } from "./save";
import type {
  NetFromGrossRequest,
  NetFromGrossResponse,
  LoadCalculationResponse,
  GrossFromNetData,
} from "./contract";

import { apiClient } from "@/utils/apiClient";

// Route path'leri
const ROUTES = {
  NET_FROM_GROSS: "/api/bakiye-ucret/net-from-gross",
  GROSS_FROM_NET: "/api/bakiye-ucret/gross-from-net",
} as const;

// Calculation type
const CALCULATION_TYPE = "davaci_ucreti";

/**
 * Net from Gross API çağrısı
 */
export async function calculateNetFromGross(
  request: NetFromGrossRequest
): Promise<NetFromGrossResponse> {
  try {
    const response = await apiClient(ROUTES.NET_FROM_GROSS, {
      method: "POST",
      body: JSON.stringify({
        gross: request.gross,
        year: request.year,
      }),
    });

    if (!response.ok) {
      const errorResult = await response.json().catch(() => ({
        error: `HTTP error! status: ${response.status}`,
      }));
      return {
        success: false,
        error: errorResult.error || `HTTP error! status: ${response.status}`,
      };
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "API çağrısı başarısız oldu",
    };
  }
}

/**
 * Gross from Net API çağrısı (Netten Brüte - Ücret Alacağı ile aynı kurallar)
 */
export async function calculateGrossFromNet(
  netInput: number,
  year: number
): Promise<{ success: boolean; data?: GrossFromNetData; error?: string }> {
  try {
    const response = await apiClient(ROUTES.GROSS_FROM_NET, {
      method: "POST",
      body: JSON.stringify({ netInput, year }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP error! status: ${response.status}`,
      };
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "API çağrısı başarısız oldu";
    return { success: false, error: message };
  }
}

/**
 * Kayıt yükleme API çağrısı
 */
export async function loadCalculation(
  caseId: string
): Promise<LoadCalculationResponse> {
  const result = await loadCalculationFromSave(caseId, CALCULATION_TYPE);
  return {
    success: result.success,
    data: result.data,
    name: result.name,
    error: result.error,
  };
}
