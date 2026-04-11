/**
 * api.ts
 * Backend çağrıları — sadece burada.
 */

import { apiClient, apiPost } from "@/utils/apiClient";
import type {
  PrimCalculateRequest,
  PrimCalculateResponse,
  LoadCalculationRequest,
  LoadCalculationResponse,
} from "./contract";

const ROUTES = {
  CALCULATE: "/api/prim-alacagi/calculate",
  SAVED_CASES: "/api/saved-cases",
} as const;

export async function calculatePrim(
  request: PrimCalculateRequest
): Promise<PrimCalculateResponse> {
  const response = await apiPost(ROUTES.CALCULATE, request);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        (errorData as { error?: string; message?: string }).error ||
        (errorData as { message?: string }).message ||
        `HTTP error! status: ${response.status}`,
    };
  }

  return await response.json();
}

export async function loadCalculation(
  request: LoadCalculationRequest
): Promise<LoadCalculationResponse> {
  const response = await apiClient(`${ROUTES.SAVED_CASES}/${request.loadId}`);

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Beklenmeyen yanıt formatı: ${text.substring(0, 100)}`);
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Kayıt bulunamadı (ID: ${request.loadId}). Kayıt silinmiş olabilir veya başka bir kullanıcıya ait olabilir.`
      );
    }
    throw new Error(
      data.message || data.error || `Yükleme işlemi başarısız oldu (${response.status})`
    );
  }

  return data;
}
