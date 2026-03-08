/**
 * calculations.ts
 * SADECE saf hesaplama fonksiyonları olacak.
 * State import etme.
 * API çağırma.
 * Tarih picker, UI, dispatch kullanma.
 * Input → Output mantığında çalış.
 */

import { SGK_ISCIPAY_ORANI, ISSIZLIK_ISCIPAY_ORANI, calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "./utils";
import type { ExtraItem } from "./contract";

// Yardımcı fonksiyon: 2 ondalık basamağa yuvarla
export const round2 = (n: number): number => Math.round(n * 100) / 100;

// Damga Vergisi Oranı
export const DAMGA_VERGISI_ORANI = 0.00759;

/**
 * String'den sayıya çevirme helper
 */
export function parseNum(v: string): number {
  return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
}

/**
 * Sayıyı formatla (TL formatı)
 */
export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

/**
 * Brütten nete dönüşüm (saf hesaplama)
 */
export function calculateNetFromGrossLocal(
  brut: number,
  year: number = new Date().getFullYear()
) {
  const sgk = round2(brut * SGK_ISCIPAY_ORANI);
  const issizlik = round2(brut * ISSIZLIK_ISCIPAY_ORANI);
  const gelirVergisiMatrahi = round2(brut - sgk - issizlik);

  // Gelir vergisi hesapla
  const gelirVergisi = round2(calculateIncomeTaxForYear(year, gelirVergisiMatrahi));
  const gelirVergisiDilimleri = calculateIncomeTaxWithBrackets(
    year,
    gelirVergisiMatrahi
  ).summary;

  // Damga vergisi
  const damgaVergisi = round2(brut * DAMGA_VERGISI_ORANI);

  // Net ücret
  const net = round2(brut - sgk - issizlik - gelirVergisi - damgaVergisi);

  return {
    gross: brut,
    sgk,
    issizlik,
    gelirVergisiMatrahi,
    gelirVergisi,
    gelirVergisiDilimleri,
    damgaVergisi,
    net,
  };
}

/**
 * Netten brüte dönüşüm (iteratif yaklaşım)
 */
export function calculateGrossFromNet(
  targetNet: number,
  year: number = new Date().getFullYear()
): number {
  let low = targetNet;
  let high = targetNet * 2;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const result = calculateNetFromGrossLocal(mid, year);

    if (Math.abs(result.net - targetNet) < 0.01) {
      // Tam sayı brüt değerini kontrol et
      const floorBrut = Math.floor(mid);
      const ceilBrut = Math.ceil(mid);

      const floorResult = calculateNetFromGrossLocal(floorBrut, year);
      const ceilResult = calculateNetFromGrossLocal(ceilBrut, year);

      if (Math.abs(floorResult.net - targetNet) < 0.01) return floorBrut;
      if (Math.abs(ceilResult.net - targetNet) < 0.01) return ceilBrut;

      return round2(mid);
    }

    if (result.net < targetNet) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return round2((low + high) / 2);
}

/**
 * Toplam brüt hesapla (Çıplak + Ekstra)
 */
export function calculateTotalBrut(
  ciplakBrut: string,
  extraItems: ExtraItem[]
): number {
  const ciplak = parseNum(ciplakBrut);
  const extras = extraItems.reduce((acc, it) => acc + parseNum(it.value), 0);
  return ciplak + extras;
}
