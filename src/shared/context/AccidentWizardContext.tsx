import React, { createContext, useContext, useState } from "react";
import { getScopedStorageKey } from "@/utils/storageKey";

type Taraf = { ad: string; soyad: string };
type KarsiTaraf = { ad: string; soyad: string; tur?: string };

export type WizardData = {
  taraf: Taraf;
  karsiTaraflar: KarsiTaraf[];
  dogumTarihi: string;
  kazaTarihi: string;
  raporTarihi: string;
  cinsiyet: string;
  maluliyetOrani: string;
  kusurOranlari: Array<{ taraf: string; oran: string }>;
  raporDonemleri?: Array<{ baslangic: string; bitis: string; gun: number }>;
  raporluGun?: string;
  asgariUcretYili?: string;
  asgariUcretTutari?: string;
  kullaniciGeliri?: string;
  geciciIsGoremezlikDonemi?: { baslangic: string; bitis: string; gun: number };
  geciciIsGoremezlikGun?: string;
  // Step 4: Compensation
  pesinSermayeTarihi?: string;
  sgkOdeme?: string;
  sigortaTarihi?: string;
  sigortaOdeme?: string;
  avansTarihi?: string;
  avans?: string;
};

type ContextShape = {
  wizardData: WizardData;
  updateWizardData: (updates: Partial<WizardData>) => void;
  resetWizardData: () => void;
} | null;

const defaultData: WizardData = {
  taraf: { ad: "", soyad: "" },
  karsiTaraflar: [],
  dogumTarihi: "",
  kazaTarihi: "",
  raporTarihi: "",
  cinsiyet: "",
  maluliyetOrani: "",
  kusurOranlari: [],
  raporDonemleri: [{ baslangic: "", bitis: "", gun: 0 }],
  raporluGun: "",
  asgariUcretYili: "",
  asgariUcretTutari: "",
  kullaniciGeliri: "",
  geciciIsGoremezlikDonemi: { baslangic: "", bitis: "", gun: 0 },
  geciciIsGoremezlikGun: "",
  pesinSermayeTarihi: "",
  sgkOdeme: "",
  sigortaTarihi: "",
  sigortaOdeme: "",
  avansTarihi: "",
  avans: "",
};

const AccidentWizardContext = createContext<ContextShape>(null);

export const AccidentWizardProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [wizardData, setWizardData] = useState<WizardData>(() => {
    const saved = localStorage.getItem(getScopedStorageKey("wizardData"));
    return saved ? (JSON.parse(saved) as WizardData) : defaultData;
  });

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => {
      const merged = { ...prev, ...updates } as WizardData;
      localStorage.setItem(getScopedStorageKey("wizardData"), JSON.stringify(merged));
      return merged;
    });
  };

  const resetWizardData = () => {
    setWizardData(defaultData);
    localStorage.removeItem(getScopedStorageKey("wizardData"));
  };

  return (
    <AccidentWizardContext.Provider value={{ wizardData, updateWizardData, resetWizardData }}>
      {children}
    </AccidentWizardContext.Provider>
  );
};

export const useAccidentWizard = () => useContext(AccidentWizardContext as any);
