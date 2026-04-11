/**
 * Borçlar Kanunu ihbar — sayfa state (API sonuçları dahil)
 */

import { useState } from "react";
import type { TotalsState, FormValuesState } from "./state";

export function useIhbarBorclarState() {
  const [totals, setTotals] = useState<TotalsState>({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [formValues, setFormValues] = useState<FormValuesState>({
    brutUcret: "",
    brut: "",
    prim: "",
    ikramiye: "",
    yol: "",
    yemek: "",
    startDate: "",
    endDate: "",
    exitDate: "",
    iseGiris: "",
    istenCikis: "",
    extras: [],
  });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | null>(null);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
    ikramiye: Array(12).fill(""),
    yol: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });

  const [weeks, setWeeks] = useState(0);
  const [amount, setAmount] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [net, setNet] = useState(0);

  return {
    totals,
    setTotals,
    formValues,
    setFormValues,
    activeModal,
    setActiveModal,
    appliedEklenti,
    setAppliedEklenti,
    currentRecordName,
    setCurrentRecordName,
    exitDate,
    setExitDate,
    eklentiValues,
    setEklentiValues,
    weeks,
    setWeeks,
    amount,
    setAmount,
    gelirVergisi,
    setGelirVergisi,
    gelirVergisiDilimleri,
    setGelirVergisiDilimleri,
    damgaVergisi,
    setDamgaVergisi,
    net,
    setNet,
  };
}
