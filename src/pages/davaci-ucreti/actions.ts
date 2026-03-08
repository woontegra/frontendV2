/**
 * actions.ts
 * Kullanıcı aksiyonları burada olacak.
 * Action → api → calculations akışına uyar.
 * Butonlar doğrudan hesap yapmaz.
 */

import { calculateNetFromGross, loadCalculation } from "./api";
import { calculateTotalBrut } from "./calculations";
import type {
  ExtraItem,
  DavaciUcretiSavedData,
  DavaciUcretiSaveData,
  NetFromGrossData,
} from "./contract";

/**
 * Net from Gross hesaplama aksiyonu
 */
export async function handleCalculateNetFromGross(
  gross: number,
  year: number
): Promise<NetFromGrossData | null> {
  const result = await calculateNetFromGross({ gross, year });

  if (result.success && result.data) {
    return result.data;
  }

  return null;
}

/**
 * Kayıt yükleme aksiyonu
 */
export async function handleLoadCalculation(
  caseId: string
): Promise<{
  formData: DavaciUcretiSavedData;
  name: string;
} | null> {
  try {
    const result = await loadCalculation(caseId);

    if (result.success && result.data) {
      return {
        formData: result.data,
        name: result.name || "",
      };
    }

    return null;
  } catch (err: any) {
    console.error("[Davacı Ücreti] Hesaplama yüklenirken hata oluştu:", err);
    return null;
  }
}

/**
 * Kayıt kaydetme için veri hazırlama
 */
export function prepareSaveData(
  ciplakBrut: string,
  extraItems: ExtraItem[],
  selectedYear: number,
  selectedPeriod: 1 | 2,
  notes: string,
  totalBrut: number,
  netFromGross: NetFromGrossData
): DavaciUcretiSaveData {
  // Normalize data before saving
  const normalizedExtraItems = extraItems.map((item) => ({
    id: item.id || Math.random().toString(36).slice(2),
    name: String(item.name || ""),
    value: item.value !== undefined && item.value !== null ? String(item.value) : "",
  }));

  return {
    data: {
      form: {
        ciplakBrut: String(ciplakBrut || ""),
        extraItems: normalizedExtraItems,
        selectedYear,
        selectedPeriod,
        notes: String(notes || ""),
      },
      results: {
        totals: {
          totalBrut,
        },
        brut: totalBrut,
        net: netFromGross?.net || 0,
      },
      netFromGross: {
        gross: netFromGross?.gross || 0,
        sgk: netFromGross?.sgk || 0,
        issizlik: netFromGross?.issizlik || 0,
        gelirVergisi: netFromGross?.gelirVergisi || 0,
        gelirVergisiDilimleri: String(netFromGross?.gelirVergisiDilimleri || ""),
        damgaVergisi: netFromGross?.damgaVergisi || 0,
        net: netFromGross?.net || 0,
        gelirVergisiBrut: netFromGross?.gelirVergisiBrut,
        gelirVergisiIstisna: netFromGross?.gelirVergisiIstisna,
        damgaVergisiBrut: netFromGross?.damgaVergisiBrut,
        damgaVergisiIstisna: netFromGross?.damgaVergisiIstisna,
      },
    },
    brut_total: totalBrut,
    net_total: netFromGross?.net || 0,
  };
}

/**
 * Toplam brüt hesaplama aksiyonu
 */
export function handleCalculateTotalBrut(
  ciplakBrut: string,
  extraItems: ExtraItem[]
): number {
  return calculateTotalBrut(ciplakBrut, extraItems);
}
