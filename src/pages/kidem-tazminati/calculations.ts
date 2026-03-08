/**
 * Kıdem Tazminatı - saf hesaplama fonksiyonları
 */

import { findKidemTavan, parseMoney } from "./utils";

export const NET_REDUCTION_FACTOR = 0.85;

export function parseNum(v: string): number {
  return parseMoney(v || "0");
}

export function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCurrency(n: number | undefined): string {
  return `${fmt(n)}₺`;
}

export function calculateKullanilacakBrutUcret(
  formValues: {
    brutUcret?: string;
    brut?: string;
    prim?: string;
    ikramiye?: string;
    yol?: string;
    yemek?: string;
    diger?: string;
    extras?: Array<{ id: string; label: string; value: string }>;
  },
  exitDate: string
): number {
  const brutUcret =
    parseMoney(formValues.brutUcret || formValues.brut || "0") +
    parseMoney(formValues.prim || "0") +
    parseMoney(formValues.ikramiye || "0") +
    parseMoney(formValues.yol || "0") +
    parseMoney(formValues.yemek || "0") +
    parseMoney(formValues.diger || "0");
  const extrasTotal = (formValues.extras || []).reduce(
    (acc: number, item: any) => acc + parseMoney(item.value || "0"),
    0
  );
  const toplamBrutUcret = brutUcret + extrasTotal;
  if (exitDate) {
    const exitDateObj = new Date(exitDate);
    const tavan = findKidemTavan(exitDateObj);
    if (tavan && toplamBrutUcret > tavan) return tavan;
  }
  return toplamBrutUcret;
}

export function calculateTavanBilgisi(
  formValues: {
    brutUcret?: string;
    brut?: string;
    prim?: string;
    ikramiye?: string;
    yol?: string;
    yemek?: string;
    diger?: string;
    extras?: Array<{ id: string; label: string; value: string }>;
  },
  exitDate: string
): { tavanUygulandiFlag: boolean; tavanDegeriValue: number | null; warnings: string[] } {
  const brutUcret =
    parseMoney(formValues.brutUcret || formValues.brut || "0") +
    parseMoney(formValues.prim || "0") +
    parseMoney(formValues.ikramiye || "0") +
    parseMoney(formValues.yol || "0") +
    parseMoney(formValues.yemek || "0") +
    parseMoney(formValues.diger || "0");
  const extrasTotal = (formValues.extras || []).reduce(
    (acc: number, item: any) => acc + parseMoney(item.value || "0"),
    0
  );
  const toplamBrutUcret = brutUcret + extrasTotal;
  const warnings: string[] = [];
  let tavanUygulandiFlag = false;
  let tavanDegeriValue: number | null = null;
  if (exitDate) {
    const exitDateObj = new Date(exitDate);
    const tavan = findKidemTavan(exitDateObj);
    if (tavan && toplamBrutUcret > tavan) {
      tavanUygulandiFlag = true;
      tavanDegeriValue = tavan;
      const formattedTavan = tavan.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      warnings.push(
        `Aylık brüt ücret, dönem tavanı olan ${formattedTavan}₺'yi aştığı için tavan seviyesine çekilmiştir. Hesaplamalar tavan değeri üzerinden yapılmıştır.`
      );
    }
  }
  return { tavanUygulandiFlag, tavanDegeriValue, warnings };
}

export function calculateKidemTazminati(
  kullanilacakBrutUcret: number,
  totals: { toplam: number; yil: number; ay: number; gun: number }
): { brutTazminat: number; netTazminat: number } {
  const yil = totals.yil || 0;
  const ay = totals.ay || 0;
  const gun = totals.gun || 0;
  const finalBrutTazminat =
    kullanilacakBrutUcret * yil + (kullanilacakBrutUcret / 12) * ay + (kullanilacakBrutUcret / 365) * gun;
  const netTazminat = finalBrutTazminat * NET_REDUCTION_FACTOR;
  return { brutTazminat: finalBrutTazminat, netTazminat };
}

export function calculateDamgaVergisi(brut: number): number {
  return brut * 0.00759;
}

export function calculateNetDisplay(brut: number): number {
  return brut - calculateDamgaVergisi(brut);
}

export function checkKidemTazminatiHakki(totals: {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}): boolean {
  return !(totals.yil === 0 && totals.yil * 365 + totals.ay * 30 + totals.gun < 365);
}
