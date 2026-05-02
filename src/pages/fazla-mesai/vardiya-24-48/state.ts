import { useCallback, useState } from "react";
import type { ExcludedDay } from "@/utils/exclusionStorage";

export type VardiyaMode270 = "none" | "simple" | "detailed";

export type VardiyaWitness = {
  id: string;
  name?: string;
  dateIn: string;
  dateOut: string;
  in: string;
  out: string;
  weeklyDays?: number | string | "";
  sevenDayMode?: "tatilsiz" | "tatilli";
};

export type VardiyaFormValues = {
  iseGiris: string;
  istenCikis: string;
  weeklyDays: number | string;
  haftaTatiliGunu?: number | "";
  davaci: {
    dateIn: string;
    dateOut: string;
    in: string;
    out: string;
  };
  taniklar: VardiyaWitness[];
  mode270: VardiyaMode270;
  katSayi: number;
  mahsuplasmaMiktari: string;
  exclusions: ExcludedDay[];
  zamanasimi: {
    davaTarihi: string;
    arabuluculukBaslangic: string;
    arabuluculukBitis: string;
    nihaiBaslangic: string;
  } | null;
};

function createWitness(): VardiyaWitness {
  return {
    id: `vardiya-tanik-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    dateIn: "",
    dateOut: "",
    in: "",
    out: "",
    weeklyDays: "",
    sevenDayMode: "tatilsiz",
  };
}

const initialForm: VardiyaFormValues = {
  iseGiris: "",
  istenCikis: "",
  weeklyDays: "6",
  haftaTatiliGunu: "",
  davaci: { dateIn: "", dateOut: "", in: "", out: "" },
  taniklar: [createWitness()],
  mode270: "none",
  katSayi: 1,
  mahsuplasmaMiktari: "",
  exclusions: [],
  zamanasimi: null,
};

export function useVardiyaState() {
  const [formValues, setFormValues] = useState<VardiyaFormValues>(initialForm);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  const setFormValuesUpdate = useCallback(
    (updater: Partial<VardiyaFormValues> | ((p: VardiyaFormValues) => VardiyaFormValues)) => {
      setFormValues((p) => (typeof updater === "function" ? updater(p) : { ...p, ...updater }));
    },
    []
  );

  const setExclusions = useCallback(
    (
      value:
        | VardiyaFormValues["exclusions"]
        | ((prev: VardiyaFormValues["exclusions"]) => VardiyaFormValues["exclusions"])
    ) => {
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

  const updateWitness = useCallback((id: string, updates: Partial<VardiyaWitness>) => {
    setFormValues((p) => ({
      ...p,
      taniklar: p.taniklar.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  }, []);

  return {
    formValues,
    setFormValues: setFormValuesUpdate,
    currentRecordName,
    setCurrentRecordName,
    exclusions: formValues.exclusions,
    setExclusions,
    addWitness,
    removeWitness,
    updateWitness,
  };
}

