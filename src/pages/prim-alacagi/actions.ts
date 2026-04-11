/**
 * actions.ts
 * Kullanıcı aksiyonları: API + hesaplama köprüsü.
 */

import { calculatePrim, loadCalculation } from "./api";
import {
  validatePrimForm,
  getBrutForNetConversion,
  calculateNetFromBrut,
  parseNum,
} from "./calculations";
import type { PrimRowRequest, PrimSavedData } from "./contract";

export async function handleCalculatePrim(rows: PrimRowRequest[]): Promise<{
  amounts: number[];
  total: number;
} | null> {
  const result = await calculatePrim({ rows });

  if (result.success && result.data) {
    return {
      amounts: result.data.amounts || [],
      total: result.data.total || 0,
    };
  }

  return null;
}

export async function handleLoadCalculation(loadId: string): Promise<{
  formData: PrimSavedData;
  name: string;
  notes: string;
} | null> {
  const data = await loadCalculation({ loadId });

  let payload: PrimSavedData = {};

  if (data.data) {
    if (typeof data.data === "string") {
      try {
        payload = JSON.parse(data.data);
      } catch {
        payload = {};
      }
    } else {
      payload = data.data as PrimSavedData;
    }
  }

  const formData = payload.form || payload.formValues || payload;

  return {
    formData: formData as PrimSavedData,
    name: data.name || data.notes || data.aciklama || "",
    notes: data.notes || data.aciklama || "",
  };
}

export function prepareSaveData(
  rows: PrimRowRequest[],
  amounts: number[],
  total: number,
  brutInputForNet: string
) {
  const brutForNetConversion = getBrutForNetConversion(brutInputForNet, total);
  const netTotal = calculateNetFromBrut(brutForNetConversion);

  return {
    data: {
      form: {
        rows: rows.map((r, i) => ({
          id: r.id,
          principal: r.principal,
          percent: r.percent,
          index: i + 1,
          amount: amounts[i] || 0,
        })),
        brutInputForNet,
      },
      results: {
        total,
        amounts,
        brutForNetConversion,
        rows: rows.map((r, i) => ({
          id: r.id,
          principal: r.principal,
          percent: r.percent,
          index: i + 1,
          amount: amounts[i] || 0,
        })),
      },
    },
    brut_total: Number(total.toFixed(2)),
    net_total: Number(netTotal.toFixed(2)),
    rows: rows.map((r, i) => ({
      index: i + 1,
      principal: parseNum(r.principal),
      percent: parseNum(r.percent),
      amount: amounts[i] || 0,
    })),
  };
}

export function handleValidateForm(rows: PrimRowRequest[]): {
  isValid: boolean;
  firstError?: string;
} {
  const validation = validatePrimForm(rows);
  return {
    isValid: validation.isValid,
    firstError: validation.errors[0],
  };
}
