/** Standart Fazla Mesai - state */
import { useState, useCallback } from "react";
import type { CalculationRow, FormValues } from "./contract";

const initialForm: FormValues = {
  iseGiris: "",
  istenCikis: "",
  weeklyDays: "6",
  haftaTatiliGunu: "",
  davaci: { in: "", out: "" },
  mode270: "none",
  katSayi: 1,
  mahsuplasmaMiktari: "",
  exclusions: [],
  zamanasimi: null,
};

export function useStandartFazlaMesaiState() {
  const [formValues, setFormValues] = useState<FormValues>(initialForm);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<CalculationRow>>>({});
  const [manualRows, setManualRows] = useState<CalculationRow[]>([]);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  const setFormValuesUpdate = useCallback((updater: Partial<FormValues> | ((p: FormValues) => FormValues)) => {
    setFormValues((p) => (typeof updater === "function" ? updater(p) : { ...p, ...updater }));
  }, []);

  const setExclusions = useCallback((value: FormValues["exclusions"] | ((prev: FormValues["exclusions"]) => FormValues["exclusions"])) => {
    setFormValues((p) => ({
      ...p,
      exclusions: typeof value === "function" ? value(p.exclusions) : value,
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
  };
}
