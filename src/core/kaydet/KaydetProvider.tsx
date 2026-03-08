/**
 * Global Kayıt Provider
 * Tüm uygulama için tek bir modal instance'ı sağlar
 */

import { createContext, useContext, ReactNode } from "react";
import { useKaydet } from "./useKaydet";

interface KaydetContextType {
  kaydetAc: (options: {
    hesapTuru: string;
    veri: any;
    mevcutId?: string | number | null;
    mevcutKayitAdi?: string | null; // Mevcut kayıt adı (güncelleme için)
    redirectPath?: string;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
  }) => void;
  kaydetKapat: () => void;
  isModalOpen: boolean;
  isSaving: boolean;
}

const KaydetContext = createContext<KaydetContextType | undefined>(undefined);

export function KaydetProvider({ children }: { children: ReactNode }) {
  const { kaydetAc, kaydetKapat, isModalOpen, isSaving, KaydetModal } = useKaydet();

  return (
    <KaydetContext.Provider value={{ kaydetAc, kaydetKapat, isModalOpen, isSaving }}>
      {children}
      <KaydetModal />
    </KaydetContext.Provider>
  );
}

export function useKaydetContext() {
  const context = useContext(KaydetContext);
  if (!context) {
    throw new Error("useKaydetContext must be used within KaydetProvider");
  }
  return context;
}

