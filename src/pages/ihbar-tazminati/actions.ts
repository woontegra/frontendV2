/**
 * İhbar Tazminatı - actions
 */

import { parseMoney } from "./utils";

export function handleCalculateTotalBrut(
  brutUcret: string,
  prim: string,
  ikramiye: string,
  yol: string,
  yemek: string,
  extras: Array<{ id: string; label: string; value: string }>
): number {
  const base =
    parseMoney(brutUcret || "0") +
    parseMoney(prim || "0") +
    parseMoney(ikramiye || "0") +
    parseMoney(yol || "0") +
    parseMoney(yemek || "0");
  const ex = (extras || []).reduce((acc, it) => acc + parseMoney(it.value || "0"), 0);
  return base + ex;
}
