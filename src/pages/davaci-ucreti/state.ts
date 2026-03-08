/**
 * state.ts
 * Sadece bu sayfanın state'i.
 * Başka sayfa state'i ile bağlantı KURMA.
 */

import { useState } from "react";
import type { ExtraItem, NetFromGrossData, GrossFromNetData } from "./contract";

/**
 * Davacı Ücreti sayfası state interface'i
 */
export interface DavaciUcretiState {
  ciplakBrut: string;
  extraItems: ExtraItem[];
  notes: string;
  currentRecordName: string | null;
  selectedYear: number;
  selectedPeriod: 1 | 2; // 1: Ocak-Haziran, 2: Temmuz-Aralık
  showImportModal: boolean;
  showSaveModal: boolean;
  saveName: string;
  savedSets: any[];
  activeModal: string | null;
  eklentiValues: Record<string, string[]>;
  showReportModal: boolean;
  netFromGross: NetFromGrossData;
  netForGross: string;
}

/**
 * State hook'u
 */
export function useDavaciUcretiState() {
  const currentYear = new Date().getFullYear();
  
  const [ciplakBrut, setCiplakBrut] = useState<string>("");
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([
    { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
    { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
    { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
    { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 2>(2); // Varsayılan 2. dönem
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [netFromGross, setNetFromGross] = useState<NetFromGrossData>({
    gross: 0,
    sgk: 0,
    issizlik: 0,
    gelirVergisi: 0,
    gelirVergisiDilimleri: "",
    damgaVergisi: 0,
    net: 0,
  });
  const [netForGross, setNetForGross] = useState<string>("");

  return {
    ciplakBrut,
    setCiplakBrut,
    extraItems,
    setExtraItems,
    notes,
    setNotes,
    currentRecordName,
    setCurrentRecordName,
    selectedYear,
    setSelectedYear,
    selectedPeriod,
    setSelectedPeriod,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    saveName,
    setSaveName,
    savedSets,
    setSavedSets,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    showReportModal,
    setShowReportModal,
    netFromGross,
    setNetFromGross,
    netForGross,
    setNetForGross,
    currentYear,
  };
}
