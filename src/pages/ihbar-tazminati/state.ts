/**
 * İhbar Tazminatı (İş Kanununa Göre) - sayfa state
 */

import { useState } from "react";

export interface TotalsState {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
}

export interface FormValuesState {
  brutUcret: string;
  brut: string;
  prim: string;
  ikramiye: string;
  yol: string;
  yemek: string;
  startDate: string;
  endDate: string;
  exitDate: string;
  extras?: Array<{ id: string; label: string; value: string }>;
  [key: string]: any;
}

export function useIhbar30State() {
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
  const [brutIhbar, setBrutIhbar] = useState(0);
  const [netIhbar, setNetIhbar] = useState(0);

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
    brutIhbar,
    setBrutIhbar,
    netIhbar,
    setNetIhbar,
  };
}
