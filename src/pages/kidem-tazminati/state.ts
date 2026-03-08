/**
 * Kıdem Tazminatı (İş Kanununa Göre) - sayfa state
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
  prim: string;
  ikramiye: string;
  yol: string;
  yemek: string;
  diger: string;
  startDate: string;
  endDate: string;
  exitDate: string;
  iseGiris?: string;
  istenCikis?: string;
  extras?: Array<{ id: string; label: string; value: string }>;
  [key: string]: any;
}

export function useKidem30State() {
  const [totals, setTotals] = useState<TotalsState>({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [formValues, setFormValues] = useState<FormValuesState>({
    brutUcret: "",
    prim: "",
    ikramiye: "",
    yol: "",
    yemek: "",
    diger: "",
    startDate: "",
    endDate: "",
    exitDate: "",
    extras: [],
  });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [appliedEklenti, setAppliedEklenti] = useState<{ field: string; value: number } | number | null>(null);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState<string>("");
  const [tavanUygulandi, setTavanUygulandi] = useState(false);
  const [tavanDegeri, setTavanDegeri] = useState<number | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({
    prim: Array(12).fill(""),
    ikramiye: Array(12).fill(""),
    yemek: Array(12).fill(""),
  });
  const [applyFunctions, setApplyFunctions] = useState<Record<string, (v: number) => void>>({});
  const [brutTazminat, setBrutTazminat] = useState(0);
  const [netTazminat, setNetTazminat] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewKidem30ReportModal, setShowNewKidem30ReportModal] = useState(false);

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
    tavanUygulandi,
    setTavanUygulandi,
    tavanDegeri,
    setTavanDegeri,
    eklentiValues,
    setEklentiValues,
    applyFunctions,
    setApplyFunctions,
    brutTazminat,
    setBrutTazminat,
    netTazminat,
    setNetTazminat,
    warnings,
    setWarnings,
    isLoading,
    setIsLoading,
    showNewKidem30ReportModal,
    setShowNewKidem30ReportModal,
  };
}
