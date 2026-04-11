/**
 * state.ts
 * Sadece bu sayfanın state'i.
 * Başka sayfa state'i ile bağlantı KURMA.
 */

import { useState } from "react";

// Tarih aralığı tipi
export interface DateRange {
  id: string;
  start: string;
  end: string;
}

// Hafta Tatili Tablo satırı tipi
export interface HaftaTatiliTableRow {
  period: string;
  weekCount: number;
  wage: number;
  coefficient: number;
  dailyWage: number;
  haftaTatiliDays: number;
  haftaTatiliTotal: number;
  manual?: boolean;
  startISO?: string;
  endISO?: string;
  manualWeekCount?: boolean;
}

// Dışlanabilir günler tipi
export interface ExcludedDay {
  id: string;
  type: "Yıllık İzin" | "Rapor" | "Diğer";
  start: string;
  end: string;
  days: number;
}

// Net/mahsuplaşma özeti tipi
export interface HaftaTatiliNetSummary {
  brut: number;
  ssk: number;
  gelir: number;
  damga: number;
  net: number;
  hakkaniyet: number;
  settleAmount: string;
}

/**
 * State hook'u
 */
export function useHaftaTatiliState() {
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  
  // Tarih aralıkları state
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { id: Date.now().toString(), start: "", end: "" },
  ]);

  // Seçili tatil ID'leri state
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>([]);

  // Hafta Tatili Zamanaşımı state
  const [haftaTatiliExpiryStart, setHaftaTatiliExpiryStart] = useState<string | null>(null);

  // Hafta Tatili Dışlanabilir günler state
  const [haftaTatiliExcludedDays, setHaftaTatiliExcludedDays] = useState<ExcludedDay[]>([]);

  // Hafta Tatili Kullanım Bilgisi state (opsiyonel)
  const [haftaTatiliKullanimBaslangic, setHaftaTatiliKullanimBaslangic] = useState<string>("");
  const [haftaTatiliKullanimBitis, setHaftaTatiliKullanimBitis] = useState<string>("");
  const [haftaTatiliKullanimGunSayisi, setHaftaTatiliKullanimGunSayisi] = useState<number>(4);

  // Düzenlenebilir satırlar
  const [haftaTatiliRows, setHaftaTatiliRows] = useState<HaftaTatiliTableRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);

  // Net/mahsuplaşma özetleri
  const [haftaTatiliNetSummary, setHaftaTatiliNetSummary] = useState<HaftaTatiliNetSummary>({
    brut: 0,
    ssk: 0,
    gelir: 0,
    damga: 0,
    net: 0,
    hakkaniyet: 0,
    settleAmount: "",
  });

  // Kaydetme durumu
  const [isSaving, setIsSaving] = useState(false);

  return {
    currentRecordName,
    setCurrentRecordName,
    dateRanges,
    setDateRanges,
    selectedHolidayIds,
    setSelectedHolidayIds,
    haftaTatiliExpiryStart,
    setHaftaTatiliExpiryStart,
    haftaTatiliExcludedDays,
    setHaftaTatiliExcludedDays,
    haftaTatiliKullanimBaslangic,
    setHaftaTatiliKullanimBaslangic,
    haftaTatiliKullanimBitis,
    setHaftaTatiliKullanimBitis,
    haftaTatiliKullanimGunSayisi,
    setHaftaTatiliKullanimGunSayisi,
    haftaTatiliRows,
    setHaftaTatiliRows,
    hoveredRow,
    setHoveredRow,
    showKatsayiModal,
    setShowKatsayiModal,
    hasCustomKatsayi,
    setHasCustomKatsayi,
    haftaTatiliNetSummary,
    setHaftaTatiliNetSummary,
    isSaving,
    setIsSaving,
  };
}
