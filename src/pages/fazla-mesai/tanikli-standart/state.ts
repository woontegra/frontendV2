/** Tanıklı Standart Fazla Mesai - state */
import { useState, useCallback } from "react";
import type { CalculationRow, FormValues } from "./contract";

function createWitness(): FormValues["taniklar"][0] {
  return {
    id: `tanik-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    dateIn: "",
    dateOut: "",
    in: "",
    out: "",
  };
}

const initialForm: FormValues = {
  iseGiris: "",
  istenCikis: "",
  weeklyDays: "6",
  davaci: { dateIn: "", dateOut: "", in: "", out: "" },
  taniklar: [createWitness()],
  mode270: "none",
  katSayi: 1,
  mahsuplasmaMiktari: "",
  exclusions: [],
  zamanasimi: null,
};

export function useTanikliStandartState() {
  const [formValues, setFormValues] = useState<FormValues>(initialForm);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<CalculationRow>>>({});
  const [manualRows, setManualRows] = useState<CalculationRow[]>([]);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  const setFormValuesUpdate = useCallback(
    (updater: Partial<FormValues> | ((p: FormValues) => FormValues)) => {
      setFormValues((p) => (typeof updater === "function" ? updater(p) : { ...p, ...updater }));
    },
    []
  );

  const setExclusions = useCallback(
    (value: FormValues["exclusions"] | ((prev: FormValues["exclusions"]) => FormValues["exclusions"])) => {
      setFormValues((p) => ({
        ...p,
        exclusions: typeof value === "function" ? value(p.exclusions) : value,
      }));
    },
    []
  );

  const addWitness = useCallback(() => {
    setFormValues((p) => ({
      ...p,
      taniklar: [...p.taniklar, createWitness()],
    }));
  }, []);

  const removeWitness = useCallback((id: string) => {
    setFormValues((p) => ({
      ...p,
      taniklar: p.taniklar.filter((t) => t.id !== id),
    }));
  }, []);

  const updateWitness = useCallback((id: string, updates: Partial<FormValues["taniklar"][0]>) => {
    setFormValues((p) => ({
      ...p,
      taniklar: p.taniklar.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  }, []);

  return {
    formValues,
    setFormValues: setFormValuesUpdate,
    rowOverrides,
    setRowOverrides,
    manualRows,
    setManualRows,
    currentRecordName,
    setCurrentRecordName,
    exclusions: formValues.exclusions,
    setExclusions,
    addWitness,
    removeWitness,
    updateWitness,
  };
}
