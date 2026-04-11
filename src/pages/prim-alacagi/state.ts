/**
 * state.ts — sadece bu sayfanın state'i.
 */

import { useState } from "react";
import type { PrimRowRequest } from "./contract";

export function usePrimState() {
  const [rows, setRows] = useState<PrimRowRequest[]>([
    { id: Math.random().toString(36).slice(2), principal: "", percent: "" },
  ]);
  const [amounts, setAmounts] = useState<number[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [brutInputForNet, setBrutInputForNet] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  return {
    rows,
    setRows,
    amounts,
    setAmounts,
    total,
    setTotal,
    brutInputForNet,
    setBrutInputForNet,
    currentRecordName,
    setCurrentRecordName,
  };
}
