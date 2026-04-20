import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Youtube, Copy, Check } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { apiPost } from "@/utils/apiClient";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  calcInputCls,
  calcTableInputCls,
  calcLabelCls,
  calcSectionTitleCls,
  calcSectionBoxCls,
  calcHelperTextCls,
} from "@/shared/calcPageFormStyles";
// Constants - inline (UBGT)
const PAGE_TITLE = "UBGT Alacağı";
const DOCUMENT_TITLE = "Mercan Danışmanlık | UBGT Alacağı";

// Tatil dosyaları backend'e taşındı
import UbgtExpiryBox from "./ubgt-standart/UbgtExpiryBox";
import UbgtNetConversion from "./ubgt-standart/UbgtNetConversion";
import UbgtExcludeDays from "./ubgt-standart/UbgtExcludeDays";
import UbgtExclusionCompactUI from "./ubgt-standart/UbgtExclusionCompactUI";
import UbgtHolidaySelectCompact from "./ubgt-standart/UbgtHolidaySelectCompact";
import {
  filterExcludedUbgtHolidaysByRules,
  BACKEND_ID_TO_UBGT_TYPE,
  type UbgtDayEntry,
  type UbgtExclusionRule,
  type UbgtHolidayType,
} from "@/pages/ubgt/utils/filterExcludedUbgtHolidays";
import UbgtKatsayiModal from "@/pages/ucret-alacagi/UbgtKatsayiModal";
import { format } from "date-fns";

// YENİ RAPOR SİSTEMİ
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

// API_BASE_URL already imported from @/utils/apiClient

// Tatil tipi backend'e taşındı

// Tatil tipleri backend'e taşındı

// Tarih aralığı tipi
interface DateRange {
  id: string;
  start: string;
  end: string;
}

// Sabit tatil listesi
interface StaticHoliday {
  id: string;
  name: string;
  days: number;
}

// STATIC_HOLIDAYS - Frontend UI için (hesaplamalar backend'de)
const STATIC_HOLIDAYS: {
  national: StaticHoliday[];
  official: StaticHoliday[];
  general: StaticHoliday[];
  religious: StaticHoliday[];
} = {
  national: [
    { id: "28-ekim", name: "28 Ekim", days: 0.5 },
    { id: "29-ekim", name: "29 Ekim", days: 1 },
  ],
  official: [
    { id: "23-nisan", name: "23 Nisan", days: 1 },
    { id: "19-mayis", name: "19 Mayıs", days: 1 },
    { id: "30-agustos", name: "30 Ağustos", days: 1 },
  ],
  general: [
    { id: "1-ocak", name: "Yılbaşı", days: 1 },
    { id: "1-mayis", name: "1 Mayıs", days: 1 },
    { id: "15-temmuz", name: "15 Temmuz", days: 1 },
  ],
  religious: [
    { id: "ramazan-arife", name: "Ramazan Arife", days: 0.5 },
    { id: "ramazan-1", name: "Ramazan 1. Gün", days: 1 },
    { id: "ramazan-2", name: "Ramazan 2. Gün", days: 1 },
    { id: "ramazan-3", name: "Ramazan 3. Gün", days: 1 },
    { id: "kurban-arife", name: "Kurban Arife", days: 0.5 },
    { id: "kurban-1", name: "Kurban 1. Gün", days: 1 },
    { id: "kurban-2", name: "Kurban 2. Gün", days: 1 },
    { id: "kurban-3", name: "Kurban 3. Gün", days: 1 },
    { id: "kurban-4", name: "Kurban 4. Gün", days: 1 },
  ],
};

// MIN_WAGE_TABLE ve hesaplama fonksiyonları backend'e taşındı

// Hesaplama fonksiyonları backend'e taşındı

// Tatil interface'leri backend'e taşındı

// Tatil eşlemeleri ve geçerlilik kuralları backend'e taşındı

// extractHolidaysInRange ve getUbgtDaysForPeriod fonksiyonları backend'e taşındı
// Ancak frontend'de onChange event'lerinde anında hesaplama için basit bir versiyon gerekli

// Sabit tatillerin ay-gün eşlemesi
const FIXED_HOLIDAY_MAP: Record<string, { month: number; day: number }> = {
  "1-ocak": { month: 0, day: 1 },
  "23-nisan": { month: 3, day: 23 },
  "1-mayis": { month: 4, day: 1 },
  "19-mayis": { month: 4, day: 19 },
  "15-temmuz": { month: 6, day: 15 },
  "30-agustos": { month: 7, day: 30 },
  "28-ekim": { month: 9, day: 28 },
  "29-ekim": { month: 9, day: 29 },
};

// Tatil geçerlilik kuralları
const HOLIDAY_RULES: Record<string, (year: number) => boolean> = {
  "1-mayis": (year) => year >= 2009,
  "15-temmuz": (year) => year >= 2017,
  "1-ocak": () => true,
  "23-nisan": () => true,
  "19-mayis": () => true,
  "30-agustos": () => true,
  "29-ekim": () => true,
  "28-ekim": () => true,
};

// Frontend'de basit UBGT gün hesaplama (sadece sabit tatiller için)
// Dini bayramlar backend API'sinden gelir, bu yüzden burada sadece sabit tatilleri hesaplıyoruz
function getUbgtDaysForPeriod(
  periodStart: string,
  periodEnd: string,
  selectedHolidayIds: string[],
  excludedDays: Array<{ start: string; end: string }> = []
): number {
  if (!selectedHolidayIds || selectedHolidayIds.length === 0) {
    return 0;
  }

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  
  const startNormalized = new Date(periodStartDate.getFullYear(), periodStartDate.getMonth(), periodStartDate.getDate());
  const endNormalized = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate());
  
  const startYear = startNormalized.getFullYear();
  const endYear = endNormalized.getFullYear();

  // Dışlanan tarihleri Set'e ekle
  const excludedDatesSet = new Set<string>();
  for (const excluded of excludedDays) {
    if (excluded.start && excluded.end) {
      const startDate = new Date(excluded.start);
      const endDate = new Date(excluded.end);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        excludedDatesSet.add(dateStr);
      }
    }
  }

  // Tatil günlerini topla
  const holidayDates = new Map<string, number>(); // date -> duration
  
  for (const selectedId of selectedHolidayIds) {
    // Sadece sabit tatilleri hesapla (dini bayramlar backend'den gelir)
    const staticHoliday = [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
    ].find((h) => h.id === selectedId);
    
    if (!staticHoliday) continue; // Dini bayramlar için backend API'sine bağımlıyız
    
    const fixedHoliday = FIXED_HOLIDAY_MAP[selectedId];
    if (!fixedHoliday) continue;
    
    const rule = HOLIDAY_RULES[selectedId];
    if (!rule) continue;

    for (let year = startYear; year <= endYear; year++) {
      if (!rule(year)) continue;
      
      const holidayDate = new Date(year, fixedHoliday.month, fixedHoliday.day);
      const holidayDateNormalized = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());
      
      if (holidayDateNormalized >= startNormalized && holidayDateNormalized <= endNormalized) {
        const dateStr = `${year}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
        
        // Dışlanan tarihlerde değilse ekle
        if (!excludedDatesSet.has(dateStr)) {
          const existing = holidayDates.get(dateStr);
          // Çakışma varsa daha uzun süreli olanı seç
          if (!existing || staticHoliday.days > existing) {
            holidayDates.set(dateStr, staticHoliday.days);
          }
        }
      }
    }
  }

  // Toplam UBGT günlerini hesapla
  let ubgtDays = 0;
  for (const duration of holidayDates.values()) {
    ubgtDays += duration;
  }

  return ubgtDays;
}

// Tablo satırı tipi
export interface UbgtTableRow {
  period: string;
  wage?: number; // Optional - varsayılan 0
  coefficient?: number; // Optional - varsayılan 1
  dailyWage?: number; // Optional - varsayılan 0
  ubgtDays?: number; // Optional - varsayılan 0
  ubgtTotal?: number; // Optional - varsayılan 0
  startISO?: string;
  endISO?: string;
  manual?: boolean;
}

export default function UbgtStandartPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);
  
  const pageStyle = usePageStyle("ubgt");
  const videoLink = getVideoLink("ubgt-standart");
  
  // Mevcut kaydın ismi (güncelleme için)
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const loadRanRef = useRef<string | null>(null);
  
  // Tarih aralıkları state
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { id: Date.now().toString(), start: "", end: "" },
  ]);

  // Seçili tatil ID'leri state (unique id = date + type)
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>([]);

  // UBGT Zamanaşımı state (ubgt prefix'li)
  const [ubgtExpiryStart, setUbgtExpiryStart] = useState<string | null>(null);

  // UBGT Dışlanabilir günler state (ubgt prefix'li)
  const [ubgtExcludedDays, setUbgtExcludedDays] = useState<
    Array<{ id: string; type: "Yıllık İzin" | "Rapor" | "Diğer"; start: string; end: string; days: number }>
  >([]);

  // Yıl aralığı bazlı UBGT günü dışlama kuralları
  const [ubgtExclusionRules, setUbgtExclusionRules] = useState<UbgtExclusionRule[]>([]);
  const [loadingFromSave, setLoadingFromSave] = useState(false);

  // Yeni tarih aralığı ekle
  const handleAddDateRange = () => {
    setDateRanges([
      ...dateRanges,
      { id: Date.now().toString(), start: "", end: "" },
    ]);
  };

  // Tarih aralığı sil
  const handleRemoveDateRange = (id: string) => {
    if (dateRanges.length > 1) {
      setDateRanges(dateRanges.filter((range) => range.id !== id));
    }
  };

  // Tarih aralığı güncelle
  const handleUpdateDateRange = (id: string, field: "start" | "end", value: string) => {
    // Yıl kısmını 4 karakterle sınırla (eğer varsa)
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].substring(0, 4);
        value = parts.join('-');
      }
    }
    
    // Değeri direkt güncelle - validation backend'de yapılıyor
    setDateRanges(
      dateRanges.map((range) =>
        range.id === id ? { ...range, [field]: value } : range
      )
    );
  };

  // Tatil checkbox değişikliği
  const handleHolidayCheckboxChange = (holidayId: string, checked: boolean) => {
    if (checked) {
      setSelectedHolidayIds([...selectedHolidayIds, holidayId]);
    } else {
      setSelectedHolidayIds(selectedHolidayIds.filter((id) => id !== holidayId));
    }
  };

  // Tüm tatilleri birleştir
  const allHolidaysList = useMemo(() => {
    return [
      ...STATIC_HOLIDAYS.national,
      ...STATIC_HOLIDAYS.official,
      ...STATIC_HOLIDAYS.general,
      ...STATIC_HOLIDAYS.religious,
    ];
  }, []);

  // Tüm checkbox değerlerini kontrol eden yardımcı fonksiyon
  const areAllSelected = useMemo(() => {
    return allHolidaysList.length > 0 && allHolidaysList.every(h => selectedHolidayIds.includes(h.id));
  }, [allHolidaysList, selectedHolidayIds]);

  // Tatil tooltip mesajı
  const getHolidayTooltip = (holidayId: string): string | undefined => {
    if (holidayId === "1-mayis") {
      return "Bu tatil 22.04.2009 sonrası yıllarda geçerlidir.";
    }
    
    if (holidayId === "15-temmuz") {
      return "Bu tatil 29.10.2016 sonrası yıllarda geçerlidir.";
    }
    
    return undefined;
  };

  // Tümünü seç / Tümünü kaldır
  const handleToggleAllHolidays = () => {
    const newValue = !areAllSelected;
    if (newValue) {
      // Tümünü seç
      setSelectedHolidayIds(allHolidaysList.map(h => h.id));
    } else {
      // Tümünü kaldır
      setSelectedHolidayIds([]);
    }
  };

  // Seçili tatillerin toplam gün sayısı
  // totalDays artık useState olarak tanımlandı ve backend'den geliyor

  // UBGT hesaplama tablosu (çoklu çalışma dönemlerini destekler)
  // Backend'den hesaplanmış veriler (hesapla butonuna basılınca doldurulur)
  const [totalDays, setTotalDays] = useState<number>(0);
  const [ubgtTotalBrut, setUbgtTotalBrut] = useState<number>(0);

  // Düzenlenebilir satırlar (UBGT sayfasına özel)
  const [ubgtRows, setUbgtRows] = useState<UbgtTableRow[]>([]);
  /** Hesaplanmış UBGT günleri (dropdown seçenekleri buradan türetilir; hesaplama motoruna dokunulmaz) */
  const [ubgtDayEntriesList, setUbgtDayEntriesList] = useState<UbgtDayEntry[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);

  // Net/mahsuplaşma özetleri (child'dan alınır)
  const [ubgtNetSummary, setUbgtNetSummary] = useState<{ brut: number; ssk: number; gelir: number; damga: number; net: number; hakkaniyet: number; settleAmount: string }>({ brut: 0, ssk: 0, gelir: 0, damga: 0, net: 0, hakkaniyet: 0, settleAmount: "" });
  
  // Mahsuplaşma modal verileri
  const [ubgtMahsuplasamaData, setUbgtMahsuplasamaData] = useState<{ [year: number]: { [holidayName: string]: number } }>({});

  // Sayfa yüklendiğinde kayıt ID'si varsa yükle (v2: yukleHesap + ?caseId=)
  useEffect(() => {
    if (!effectiveId) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        if (loadRanRef.current === effectiveId) return;
        loadRanRef.current = String(effectiveId);
        setLoadingFromSave(true);

        const res = await yukleHesap(effectiveId, "ubgt_alacagi");
        if (!isMounted) return;

        if (!res.success) {
          showToastError(res.error || "Kayıt yüklenemedi");
          loadRanRef.current = null;
          setLoadingFromSave(false);
          return;
        }

        let payload: any = res.data;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = {};
          }
        }

        const formData = payload?.form || payload?.data?.form || payload || {};

        const workerPeriods =
          formData.workerPeriods || formData.data?.form?.workerPeriods || formData.form?.workerPeriods;
        const selectedHolidays =
          formData.selectedHolidays || formData.data?.form?.selectedHolidays || formData.form?.selectedHolidays;
        const excludedDays =
          formData.excludedDays || formData.data?.form?.excludedDays || formData.form?.excludedDays;
        const excludedUbgtHolidaysForm =
          formData.excludedUbgtHolidays ||
          formData.data?.form?.excludedUbgtHolidays ||
          formData.form?.excludedUbgtHolidays;
        const ubgtExclusionRulesForm =
          formData.ubgtExclusionRules ||
          formData.data?.form?.ubgtExclusionRules ||
          formData.form?.ubgtExclusionRules;
        const zamanasimi =
          formData.zamanasimi || formData.data?.form?.zamanasimi || formData.form?.zamanasimi;
        const periods = formData.periods || formData.data?.form?.periods || formData.form?.periods;
        const settlement =
          formData.settlement || formData.data?.form?.settlement || formData.form?.settlement;

        if (workerPeriods && Array.isArray(workerPeriods) && workerPeriods.length > 0) {
          setDateRanges(workerPeriods);
        }
        if (selectedHolidays && Array.isArray(selectedHolidays)) {
          setSelectedHolidayIds(selectedHolidays);
        }
        if (excludedDays && Array.isArray(excludedDays)) {
          setUbgtExcludedDays(excludedDays);
        }
        if (ubgtExclusionRulesForm && Array.isArray(ubgtExclusionRulesForm) && ubgtExclusionRulesForm.length > 0) {
          setUbgtExclusionRules(ubgtExclusionRulesForm);
        } else if (excludedUbgtHolidaysForm && Array.isArray(excludedUbgtHolidaysForm) && excludedUbgtHolidaysForm.length > 0) {
          setUbgtExclusionRules([{ startYear: 2000, endYear: 2100, excludedHolidayTypes: excludedUbgtHolidaysForm }]);
        }
        if (zamanasimi?.start) {
          setUbgtExpiryStart(zamanasimi.start);
        }
        if (periods && Array.isArray(periods)) {
          setUbgtRows(periods);
        }
        if (settlement?.mahsuplasamaData) {
          setUbgtMahsuplasamaData(settlement.mahsuplasamaData);
        }

        setCurrentRecordName(res.name || null);
        success(`Kayıt yüklendi (#${effectiveId})`);
        setTimeout(() => setLoadingFromSave(false), 1000);
      } catch (err) {
        if (!isMounted) return;
        console.error("Kayıt yüklenirken hata oluştu:", err);
        showToastError("Kayıt yüklenemedi");
        loadRanRef.current = null;
        setLoadingFromSave(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  // Artık ubgtTableData yok, backend'den geldiğinde ubgtRows'u güncelleyeceğiz

  // İlk yüklemede localStorage'dan verileri al
  useEffect(() => {
    // LocalStorage yüklemesi kaldırıldı; veriler backend'den listeler sayfasında çekilecektir
  }, []);

  const recalcRow = (row: UbgtTableRow): UbgtTableRow => {
    // Standart Fazla Mesai mantığı: Her adımda Number((value).toFixed(6)) kullan, son adımda Number((value).toFixed(2))
    const step1 = Number(((row.wage ?? 0) * (row.coefficient ?? 1)).toFixed(6));
    const dailyWage = Number((step1 / 30).toFixed(6));
    const step2 = Number((dailyWage * (row.ubgtDays ?? 0)).toFixed(6));
    const ubgtTotal = Number(step2.toFixed(2));
    return { ...row, dailyWage, ubgtTotal };
  };

  // Boş satır oluşturma (diğer sayfalarla aynı yapı)
  const createManualRow = useCallback((): UbgtTableRow => {
    return {
      period: "",
      wage: 0,
      coefficient: 1,
      dailyWage: 0,
      ubgtDays: 0,
      ubgtTotal: 0,
      startISO: "",
      endISO: "",
      manual: true,
    };
  }, []);

  // Altına yeni boş satır ekleme (satır kopyalamaz)
  const duplicateRow = useCallback((i: number) => {
    setUbgtRows((prev) => {
      const copy = [...prev];
      const newRow = recalcRow(createManualRow());
      copy.splice(i + 1, 0, newRow);
      return copy;
    });
  }, [createManualRow]);

  // Satır silme (en az 1 satır kalmalı)
  const deleteRow = useCallback((i: number) => {
    setUbgtRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  const handleWageChange = (index: number, value: string) => {
    // TL işaretini, nokta ve virgülü temizle
    const cleaned = value.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
    const wage = Number(cleaned) || 0;
    setUbgtRows(prev => prev.map((r, i) => i === index ? recalcRow({ ...r, wage }) : r));
  };

  const applyGlobalCoefficient = (k: number) => {
    // Standart Fazla Mesai mantığı: Number((value).toFixed(4))
    const fixed = Number(k.toFixed(4));
    setUbgtRows(prev => prev.map(r => recalcRow({ ...r, coefficient: fixed })));
    setHasCustomKatsayi(fixed !== 1);
  };

  const handleResetKatsayi = () => {
    setUbgtRows(prev => prev.map(r => recalcRow({ ...r, coefficient: 1 })));
    setHasCustomKatsayi(false);
  };

  // Toplamı düzenlenebilir satırlardan hesapla
  const ubgtTotalBrutFromRows = useMemo(() => ubgtRows.reduce((s, r) => s + r.ubgtTotal, 0), [ubgtRows]);

  const handleCalculate = async (showSuccessMessage = true) => {
    // Tarih kontrolü - en az bir geçerli tarih aralığı olmalı
    const hasValidDate = dateRanges.some((r) => r.start && r.end);
    if (!hasValidDate) {
      if (showSuccessMessage) {
      showToastError("Lütfen en az bir tarih aralığı girin");
    }
      return;
    }

    try {
      const payload = {
        dateRanges,
        selectedHolidayIds, // Boş olabilir, backend 0 gün olarak hesaplar
        ubgtExcludedDays,
        ubgtExpiryStart,
        year: new Date().getFullYear()
      };
      console.log("[UBGT] Backend'e gönderiliyor:", JSON.stringify(payload, null, 2));
      
      // apiPost kullan - otomatik olarak tenant ID ve diğer header'ları ekler
      const response = await apiPost('/api/ubgt/standard', payload);

      if (!response.ok) {
        // Backend'den hata mesajını al
        const errorResult = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        console.error("[UBGT] Backend hatası:", errorResult);
        const errorMessage = errorResult.error || errorResult.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("[UBGT] Backend'den gelen sonuç:", result);

      if (result.success && result.data) {
        const periods = result.data.periods || [];
        const ubgtDayEntries = result.data.ubgtDayEntries || [];
        // Tarih değişince yeniden hesaplamada kullanıcının girdiği kat sayıyı koru
        const currentKatsayi = hasCustomKatsayi && ubgtRows.length > 0 ? (ubgtRows[0].coefficient ?? 1) : undefined;
        const periodsWithKatsayi = currentKatsayi !== undefined
          ? periods.map((p: UbgtTableRow) => recalcRow({ ...p, coefficient: currentKatsayi }))
          : periods.map((p: UbgtTableRow) => recalcRow(p));

        if (ubgtDayEntries.length === 0) {
          setUbgtDayEntriesList([]);
          setUbgtRows(periodsWithKatsayi);
          setUbgtTotalBrut(result.data.toplamBrut || 0);
          setTotalDays(result.data.totalDays || 0);
          if (showSuccessMessage) {
            success(`Hesaplama tamamlandı. Toplam: ${result.data.totalDays || 0} gün`);
          }
        } else {
          const withType: UbgtDayEntry[] = ubgtDayEntries.map(
            (e: { date: string; holidayId: string; days: number; periodIndex: number }) => ({
              date: e.date,
              holidayType: BACKEND_ID_TO_UBGT_TYPE[e.holidayId] ?? (e.holidayId as UbgtHolidayType),
              days: e.days,
              periodIndex: e.periodIndex,
            })
          );
          setUbgtDayEntriesList(withType);
          const filtered = filterExcludedUbgtHolidaysByRules(withType, ubgtExclusionRules);
          const daysByPeriod: Record<number, number> = {};
          filtered.forEach((e) => {
            const idx = e.periodIndex ?? 0;
            daysByPeriod[idx] = (daysByPeriod[idx] ?? 0) + e.days;
          });
          const filteredUbgtDays = periodsWithKatsayi.map((row: UbgtTableRow, idx: number) => {
            const newUbgtDays = daysByPeriod[idx] ?? row.ubgtDays ?? 0;
            return recalcRow({ ...row, ubgtDays: newUbgtDays });
          });
          setUbgtRows(filteredUbgtDays);
          setUbgtTotalBrut(filteredUbgtDays.reduce((s, r) => s + (r.ubgtTotal ?? 0), 0));
          setTotalDays(filteredUbgtDays.reduce((s, r) => s + (r.ubgtDays ?? 0), 0));
          if (showSuccessMessage) {
            success(`Hesaplama tamamlandı. Toplam: ${filteredUbgtDays.reduce((s, r) => s + (r.ubgtDays ?? 0), 0)} gün`);
          }
        }
      } else {
        if (showSuccessMessage) {
          showToastError(result.error || "Hesaplama başarısız");
        }
      }
    } catch (error: any) {
      console.error("[UBGT] Hesaplama hatası:", error);
      if (showSuccessMessage) {
        // Backend'den gelen hata mesajını göster
        const errorMessage = error.message || "Hesaplama sırasında bir hata oluştu";
        showToastError(errorMessage);
      }
    }
  };

  // Tarih, tatil veya hariç tutulan günler değiştiğinde otomatik hesapla
  useEffect(() => {
    // Tarihlerin geçerli format kontrolü (YYYY-MM-DD ve tam 10 karakter)
    const hasValidDate = dateRanges.some((r) => {
      if (!r.start || !r.end) return false;
      
      // YYYY-MM-DD formatı kontrolü (tam 10 karakter)
      const startValid = /^\d{4}-\d{2}-\d{2}$/.test(r.start);
      const endValid = /^\d{4}-\d{2}-\d{2}$/.test(r.end);
      
      if (!startValid || !endValid) return false;
      
      // Yıl kontrolü (2000-2100 arası)
      const startYear = parseInt(r.start.split('-')[0], 10);
      const endYear = parseInt(r.end.split('-')[0], 10);
      
      if (startYear < 2000 || startYear > 2100 || endYear < 2000 || endYear > 2100) {
        return false;
      }
      
      // Tarih geçerliliği kontrolü (Date objesi oluşturulabilir mi?)
      const startDate = new Date(r.start);
      const endDate = new Date(r.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return false;
      }
      
      // Bitiş tarihi başlangıç tarihinden sonra olmalı
      if (endDate < startDate) {
        return false;
      }
      
      return true;
    });
    
    if (hasValidDate && !loadingFromSave) {
      // Debounce: Kullanıcı yazarken hemen hesaplama yapma, biraz bekle
      const timeoutId = setTimeout(() => {
        handleCalculate(false); // Silent update (toast gösterme)
      }, 500); // 500ms bekle
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRanges, selectedHolidayIds, ubgtExcludedDays, ubgtExpiryStart, ubgtExclusionRules]);

  const handleSave = () => {
    try {
      const katsayi = ubgtRows.length > 0 ? ubgtRows[0].coefficient : 1;

      // Tarih aralığı özetleri
      const startDate = dateRanges
        .filter(r => r.start)
        .map(r => new Date(r.start).getTime())
        .sort((a,b)=>a-b)[0];
      const endDate = dateRanges
        .filter(r => r.end)
        .map(r => new Date(r.end).getTime())
        .sort((a,b)=>b-a)[0];

      const startDateStr = startDate ? new Date(startDate).toISOString().slice(0,10) : null;
      const endDateStr = endDate ? new Date(endDate).toISOString().slice(0,10) : null;

      const ubgtData = {
        periods: ubgtRows,
        totalBrut: ubgtTotalBrutFromRows,
        totalNet: ubgtNetSummary.net,
        netConversion: ubgtNetSummary,
        settlement: {
          hakkaniyet: ubgtNetSummary.hakkaniyet,
          settleAmount: ubgtNetSummary.settleAmount,
          sonuc: Math.max(0, ubgtNetSummary.brut - ubgtNetSummary.hakkaniyet),
          mahsuplasamaData: ubgtMahsuplasamaData,
        },
        workerPeriods: dateRanges,
        selectedHolidays: selectedHolidayIds,
        calculatedUbgtDays: totalDays,
        katsayi,
        zamanasimi: { active: !!ubgtExpiryStart, start: ubgtExpiryStart },
        excludedDays: ubgtExcludedDays,
        ubgtExclusionRules,
        startDate: startDateStr,
        endDate: endDateStr,
        notes: "",
      };

      // Merkezi kayıt sistemini kullan
      kaydetAc({
        hesapTuru: "ubgt_alacagi",
        veri: {
          // Yeni format: data içinde form ve results
          data: {
            form: {
              workerPeriods: dateRanges,
              selectedHolidays: selectedHolidayIds,
              excludedDays: ubgtExcludedDays,
              ubgtExclusionRules,
              zamanasimi: { active: !!ubgtExpiryStart, start: ubgtExpiryStart },
              periods: ubgtRows,
              katsayi,
              calculatedUbgtDays: totalDays,
              settlement: ubgtData.settlement,
            },
            results: {
              totals: { brut: ubgtTotalBrutFromRows, net: ubgtNetSummary.net },
              brut: ubgtTotalBrutFromRows,
              net: ubgtNetSummary.net,
              netConversion: ubgtNetSummary,
            }
          },
          // Geriye dönük uyumluluk için eski alanlar (backend için)
          start_date: startDateStr,
          end_date: endDateStr,
          brut_total: ubgtTotalBrutFromRows,
          net_total: ubgtNetSummary.net,
          notes: "",
          ...ubgtData,
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName, // Mevcut kayıt adı varsa modal açmadan güncelleme yap
        redirectPath: `/ubgt-alacagi/:id`,
      });
    } catch (e) {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    try {
      // Kaydedilmemiş değişiklikler varsa onay iste
      const hasUnsavedChanges = 
        dateRanges.some(r => r.start || r.end) || 
        selectedHolidayIds.length > 0 || 
        ubgtRows.length > 0;
      
      if (hasUnsavedChanges) {
        if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      }
      
      // Tüm state'leri temizle
      setDateRanges([{ id: Date.now().toString(), start: "", end: "" }]);
      setSelectedHolidayIds([]);
      setUbgtExpiryStart(null);
      setUbgtExcludedDays([]);
      setUbgtExclusionRules([]);
      setUbgtRows([]);
      setUbgtMahsuplasamaData({});
      setCurrentRecordName(null);
      loadRanRef.current = null;
      
      if (effectiveId) {
        navigate("/ubgt-alacagi", { replace: true });
      }
    } catch {}
  };

  // handlePrint artık gerekli değil - FooterActions previewButton ile otomatik yazdırıyor

  // UBGT Zamanaşımı iptal handler
  const handleUbgtExpiryCancel = () => {
    info("Zamanaşımı itirazı kaldırıldı, cetvel eski haline döndü.");
  };

  // YENİ RAPOR SİSTEMİ: BaseReportModal Config
  const ubgtReportConfig = useMemo((): ReportConfig => {
    const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ubgtFirstStart = dateRanges.length > 0 ? dateRanges[0].start : "";
    const ubgtLastEnd = dateRanges.length > 0 ? dateRanges[dateRanges.length - 1].end : "";
    const ubgtTotalAmount = ubgtRows.reduce((sum, row) => sum + row.ubgtTotal, 0);

    // Dışlanabilir Günler için ReportTable verisi
    const excludedDaysRows = ubgtExcludedDays.map(day => [
      day.type,
      new Date(day.start).toLocaleDateString("tr-TR"),
      new Date(day.end).toLocaleDateString("tr-TR"),
      day.days.toString(),
    ]);
    const excludedDaysFooter = [
      "TOPLAM",
      "",
      "",
      ubgtExcludedDays.reduce((sum, day) => sum + day.days, 0).toString(),
    ];

    return {
      title: "UBGT Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi", value: ubgtFirstStart || "-" },
        { label: "İşten Çıkış Tarihi", value: ubgtLastEnd || "-" },
        { label: "Seçilen Tatil Sayısı", value: `${selectedHolidayIds.length} adet`, condition: selectedHolidayIds.length > 0 },
        { label: "Toplam UBGT Günü", value: `${totalDays} gün`, condition: totalDays > 0 },
        { 
          label: "Zamanaşımı Başlangıç Tarihi", 
          value: ubgtExpiryStart ? new Date(ubgtExpiryStart).toLocaleDateString("tr-TR") : "-", 
          condition: !!ubgtExpiryStart 
        },
      ],
      customSections: ubgtExcludedDays.length > 0 ? [
        {
          title: "Dışlanabilir Günler",
          condition: true,
          content: (
            <>
              {/* ReportTable import gerekli, ama BaseReportLayout'tan kullanabiliriz */}
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid #999',
                fontSize: '10px',
              }}>
                <thead style={{ background: '#f3f4f6' }}>
                  <tr>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Tür</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Başlangıç</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'left' }}>Bitiş</th>
                    <th style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>Gün Sayısı</th>
                  </tr>
                </thead>
                <tbody>
                  {excludedDaysRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row[0]}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row[1]}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{row[2]}</td>
                      <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ background: '#f3f4f6', fontWeight: 600 }}>
                  <tr>
                    <td colSpan={3} style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      TOPLAM
                    </td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>
                      {excludedDaysFooter[3]}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          ),
        },
      ] : [],
      periodData: {
        title: "UBGT Hesaplama Cetveli",
        headers: ["Dönem", "Ücret (BRÜT)", "Katsayı", "Günlük Ücret", "UBGT Günleri", "UBGT Ücreti"],
        rows: ubgtRows.map(row => [
          row.period,
          `${fmt(row.wage || 0)}₺`,
          (row.coefficient || 1).toFixed(4),
          `${fmt(row.dailyWage || 0)}₺`,
          (row.ubgtDays || 0).toString(),
          `${fmt(row.ubgtTotal || 0)}₺`,
        ]),
        footer: [
          "Toplam UBGT Ücreti:",
          "",
          "",
          "",
          "",
          `${fmt(ubgtTotalAmount)}₺`,
        ],
        alignRight: [1, 2, 3, 4, 5],
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt UBGT Alacağı", value: `${fmt(ubgtNetSummary.brut)}₺` },
          { label: "SGK İşçi Primi (%15)", value: `-${fmt(ubgtNetSummary.ssk)}₺`, isDeduction: true },
          { label: "Gelir Vergisi", value: `-${fmt(ubgtNetSummary.gelir)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmt(ubgtNetSummary.damga)}₺`, isDeduction: true },
          { label: "Net UBGT Alacağı", value: `${fmt(ubgtNetSummary.net)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Net UBGT Alacağı", value: `${fmt(ubgtNetSummary.net)}₺` },
          { label: "1/3 Hakkaniyet İndirimi", value: `-${fmt(ubgtNetSummary.hakkaniyet)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmt(Math.max(0, ubgtNetSummary.net - ubgtNetSummary.hakkaniyet))}₺`,
        },
      },
    };
  }, [ubgtRows, ubgtNetSummary, dateRanges, totalDays, ubgtExcludedDays, selectedHolidayIds, ubgtExpiryStart]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (ubgtReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    if (ubgtExcludedDays.length > 0) {
      const excludedRows = ubgtExcludedDays.map((day) => [
        day.type,
        new Date(day.start).toLocaleDateString("tr-TR"),
        new Date(day.end).toLocaleDateString("tr-TR"),
        day.days.toString(),
      ]);
      const n2 = adaptToWordTable({
        headers: ["Tür", "Başlangıç", "Bitiş", "Gün Sayısı"],
        rows: excludedRows,
      });
      sections.push({ id: "dislanabilir-gunler", title: "Dışlanabilir Günler", html: buildWordTable(n2.headers, n2.rows) });
    }

    const pd = ubgtReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) {
        periodRows.push(pd.footer);
      }
      const n3 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "ubgt-hesaplama-cetveli", title: pd.title || "UBGT Hesaplama Cetveli", html: buildWordTable(n3.headers, n3.rows) });
    }

    const gnd = ubgtReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n4.headers, n4.rows) });
    }

    const md = ubgtReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }

    return sections;
  }, [ubgtReportConfig, ubgtExcludedDays]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("ubgt-print-wrapper");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = ubgtReportConfig.title;
    const contentHtml = targetEl.innerHTML;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0 auto;font-size:10px;max-width:16cm}table{width:100%!important;max-width:16cm!important;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}</style></head><body>${contentHtml}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 400);
    };
  }, [ubgtReportConfig.title]);

  return (
    <>
      <div style={{ height: "2px", background: pageStyle.color }} aria-hidden />
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3">
          {videoLink ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(videoLink, "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Youtube className="w-3 h-3" />
                Video
              </button>
            </div>
          ) : null}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <div id="ubgt-calculation-area" className="space-y-4">
                <section className={calcSectionBoxCls}>
                  <h2 className={calcSectionTitleCls}>İşe Giriş - Çıkış Tarihleri</h2>
                  <p className={calcHelperTextCls}>Çalışma dönemlerinizi ekleyin</p>
                  <div className="space-y-3 mt-3">
                    {dateRanges.map((range) => (
                      <div
                        key={range.id}
                        className="flex items-end gap-2 flex-wrap p-2.5 bg-white dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex-1 min-w-[8rem]">
                          <label className={calcLabelCls}>Başlangıç</label>
                          <input
                            type="date"
                            className={calcInputCls}
                            value={range.start}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleUpdateDateRange(range.id, "start", value);
                            }}
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && range.end && /^\d{4}-\d{2}-\d{2}$/.test(range.end)) {
                                const newDate = new Date(newValue);
                                const endDate = new Date(range.end);
                                if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                                  showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                                }
                              }
                            }}
                            max="9999-12-31"
                          />
                        </div>
                        <span className="text-gray-400 dark:text-gray-500 pb-2 text-xs shrink-0">—</span>
                        <div className="flex-1 min-w-[8rem]">
                          <label className={calcLabelCls}>Bitiş</label>
                          <input
                            type="date"
                            className={calcInputCls}
                            value={range.end}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleUpdateDateRange(range.id, "end", value);
                            }}
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && range.start && /^\d{4}-\d{2}-\d{2}$/.test(range.start)) {
                                const newDate = new Date(newValue);
                                const startDate = new Date(range.start);
                                if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                                  showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                                }
                              }
                            }}
                            max="9999-12-31"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDateRange(range.id)}
                          disabled={dateRanges.length <= 1}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 shrink-0 h-9 w-9"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddDateRange}
                      className="w-full sm:w-auto text-xs h-9 border-gray-300 dark:border-gray-600"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Yeni Tarih Aralığı Ekle
                    </Button>
                  </div>
                </section>

          {/* Tatil Seçimi — kompakt, mobil uyumlu */}
          <UbgtHolidaySelectCompact
            holidays={STATIC_HOLIDAYS}
            selectedHolidayIds={selectedHolidayIds}
            onSelectionChange={(id, checked) => handleHolidayCheckboxChange(id, checked)}
            onToggleAll={handleToggleAllHolidays}
            areAllSelected={areAllSelected}
            getHolidayTooltip={getHolidayTooltip}
            totalDays={totalDays}
          />

          {/* Dışlanabilir Günler */}
          <UbgtExcludeDays
            ubgtExcludedDays={ubgtExcludedDays}
            onUbgtExcludedDaysChange={setUbgtExcludedDays}
            onImport={() => handleCalculate(true)}
          />

          {/* UBGT Hesabından Dışlanacak Günler — zarif tek satır */}
          <UbgtExclusionCompactUI
            dateRanges={dateRanges}
            ubgtDayEntries={ubgtDayEntriesList}
            ubgtExclusionRules={ubgtExclusionRules}
            setUbgtExclusionRules={setUbgtExclusionRules}
          />

                <section className={`${calcSectionBoxCls} mt-2`}>
                  <div className="w-full max-w-full">
                    <h2 className={calcSectionTitleCls}>UBGT Hesaplama Tablosu</h2>
                    <p className={`${calcHelperTextCls} text-red-600 dark:text-red-400`}>
                      Katsayı hesapla butonu ile katsayınızı hesaplayabilirsiniz; bulunan katsayı otomatik olarak hesap tablosuna eklenecektir. Ücret (BRÜT) sütunu istenilirse ücretler bağımsız giriş yapılabilir.
                      <br />
                      Hesaplama (ücret X katsayı / 30 X UBGT günleri = UBGT ücreti) olarak yapılıyor.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 mt-3 w-full">
                <div className="flex items-center gap-3 flex-wrap">
                  <UbgtExpiryBox
                    ubgtExpiryStart={ubgtExpiryStart}
                    onUbgtExpiryStartChange={setUbgtExpiryStart}
                    onUbgtExpiryCancel={handleUbgtExpiryCancel}
                    iseGiris={dateRanges.map((r) => r.start).filter(Boolean).sort()[0] || undefined}
                  />
                  {/* KATSAYI - ZARİF BUTON */}
                  <button
                    type="button"
                    onClick={() => setShowKatsayiModal(true)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
                      hasCustomKatsayi
                        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md hover:from-green-600 hover:to-emerald-700"
                        : "bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50 hover:text-green-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-green-500 dark:hover:bg-gray-700"
                    }`}
                  >
                    {hasCustomKatsayi && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span>{hasCustomKatsayi ? "Katsayı" : "Kat Sayı Hesapla"}</span>
                  </button>
                  {hasCustomKatsayi && (
                    <button
                      type="button"
                      onClick={handleResetKatsayi}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Katsayıyı kaldır"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
                  <div className="mt-3">
              {ubgtExpiryStart && ubgtRows.length > 0 && (
                <div className="mb-3 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                  Zamanaşımı başlangıç tarihi: {format(new Date(ubgtExpiryStart), "dd.MM.yyyy")} — bu tarihten önceki dönemler cetvele dahil edilmemiştir.
                </div>
              )}
              {ubgtRows.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table
                    className="w-full border-collapse text-xs text-gray-900 dark:text-gray-100"
                    style={{ border: "1px solid #d2d2d2" }}
                  >
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="text-left text-xs font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          Tarih (Ücret Dönemi)
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          Ücret (BRÜT)
                        </th>
                        <th className="text-center text-xs font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          Katsayı
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          Günlük Brüt Ücret
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          UBGT Günleri
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          UBGT Ücreti
                        </th>
                        <th className="border-0 bg-transparent w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ubgtRows.map((row, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                          onMouseEnter={() => setHoveredRow(index)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className="text-xs text-gray-900 dark:text-gray-100" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                            {row.manual ? (
                              <div className="flex gap-1 items-center">
                                <input
                                  type="date"
                                  value={row.startISO || ""}
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setUbgtRows((prev) => prev.map((r, i) => {
                                      if (i !== index) return r;
                                      const endISO = r.endISO || "";
                                      // Yeni period string'i oluştur
                                      const startFormatted = newStart ? new Date(newStart).toLocaleDateString("tr-TR") : "";
                                      const endFormatted = endISO ? new Date(endISO).toLocaleDateString("tr-TR") : "";
                                      const newPeriod = startFormatted && endFormatted ? `${startFormatted}-${endFormatted}` : r.period;
                                      // UBGT günlerini yeniden hesapla
                                      let newUbgtDays = r.ubgtDays;
                                      if (newStart && endISO) {
                                        newUbgtDays = getUbgtDaysForPeriod(newStart, endISO, selectedHolidayIds, ubgtExcludedDays);
                                      }
                                      const ubgtTotal = Number((r.dailyWage * newUbgtDays).toFixed(2));
                                      return { ...r, startISO: newStart, period: newPeriod, ubgtDays: newUbgtDays, ubgtTotal };
                                    }));
                                  }}
                                  className={`${calcTableInputCls} w-[7.5rem]`}
                                />
                                <span>-</span>
                                <input
                                  type="date"
                                  value={row.endISO || ""}
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setUbgtRows((prev) => prev.map((r, i) => {
                                      if (i !== index) return r;
                                      const startISO = r.startISO || "";
                                      // Yeni period string'i oluştur
                                      const startFormatted = startISO ? new Date(startISO).toLocaleDateString("tr-TR") : "";
                                      const endFormatted = newEnd ? new Date(newEnd).toLocaleDateString("tr-TR") : "";
                                      const newPeriod = startFormatted && endFormatted ? `${startFormatted}-${endFormatted}` : r.period;
                                      // UBGT günlerini yeniden hesapla
                                      let newUbgtDays = r.ubgtDays;
                                      if (startISO && newEnd) {
                                        newUbgtDays = getUbgtDaysForPeriod(startISO, newEnd, selectedHolidayIds, ubgtExcludedDays);
                                      }
                                      const ubgtTotal = Number((r.dailyWage * newUbgtDays).toFixed(2));
                                      return { ...r, endISO: newEnd, period: newPeriod, ubgtDays: newUbgtDays, ubgtTotal };
                                    }));
                                  }}
                                  className={`${calcTableInputCls} w-[7.5rem]`}
                                />
                              </div>
                            ) : (
                              row.period
                            )}
                          </td>
                          <td className="text-xs text-gray-900 dark:text-gray-100 text-right" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                            <input
                              type="text"
                              key={`wage-${index}-${row.wage}`}
                              defaultValue={(row.wage ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₺'}
                              onFocus={(e) => {
                                const raw = (row.wage ?? 0) > 0 ? (row.wage ?? 0).toString().replace('.', ',') : '';
                                e.target.value = raw;
                              }}
                              onBlur={(e) => {
                                handleWageChange(index, e.target.value);
                                const cleaned = e.target.value.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                                const wage = Number(cleaned) || 0;
                                e.target.value = wage.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₺';
                              }}
                              className={`${calcTableInputCls} border-transparent focus:border-gray-300`}
                            />
                          </td>
                          <td className="text-xs text-gray-900 dark:text-gray-100 text-center" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                            {Number((row.coefficient ?? 1).toFixed(4)).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </td>
                          <td className="text-xs text-gray-900 dark:text-gray-100 text-right" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                            {(row.dailyWage ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺
                          </td>
                          <td className="text-xs text-gray-900 dark:text-gray-100 text-right" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                            {row.manual ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.ubgtDays != null ? String(row.ubgtDays) : ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const newDays = v === "" ? 0 : Number(v) || 0;
                                  setUbgtRows((prev) => prev.map((r, i) => {
                                    if (i !== index) return r;
                                    const ubgtTotal = Number((r.dailyWage * newDays).toFixed(2));
                                    return { ...r, ubgtDays: newDays, ubgtTotal };
                                  }));
                                }}
                                className={`${calcTableInputCls} w-16`}
                              />
                            ) : (
                              <>{(row.ubgtDays ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} gün</>
                            )}
                          </td>
                          <td className="text-xs font-semibold text-gray-900 dark:text-gray-100 text-right" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                            {(row.ubgtTotal ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺
                          </td>
                          {/* Satır ekleme ve silme butonları - sadece hover'da görünür */}
                          <td className="border-0 bg-transparent w-16 p-0">
                            {hoveredRow === index && (
                              <div className="flex gap-1 justify-center items-center">
                                <span
                                  className="row-add-icon text-orange-500 hover:text-orange-600 cursor-pointer text-sm leading-none"
                                  onClick={() => duplicateRow(index)}
                                  title="Altına yeni boş satır ekle"
                                >
                                  +
                                </span>
                                <span
                                  className="row-delete-icon text-red-500 hover:text-red-600 cursor-pointer text-sm leading-none"
                                  onClick={() => {
                                    if (ubgtRows.length <= 1) return;
                                    deleteRow(index);
                                  }}
                                  style={{ opacity: ubgtRows.length <= 1 ? 0.3 : 1, cursor: ubgtRows.length <= 1 ? 'not-allowed' : 'pointer' }}
                                  title={ubgtRows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
                                >
                                  −
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                        <td
                          colSpan={5}
                          className="text-gray-900 dark:text-gray-100 text-right"
                          style={{ padding: "6px", border: "1px solid #d2d2d2" }}
                        >
                          Toplam UBGT Ücreti:
                        </td>
                        <td className="text-xs text-gray-900 dark:text-gray-100 text-right" style={{ padding: "6px", border: "1px solid #d2d2d2" }}>
                          {ubgtTotalBrutFromRows
                            .toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺
                        </td>
                        <td className="border-0 bg-transparent w-16"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-gray-500 dark:text-gray-400">
                  <p>Hesaplama yapmak için lütfen tarih aralıkları girin ve tatilleri seçin.</p>
                </div>
              )}
                  </div>
                </section>

                <div className="mt-2 w-full min-w-0">
                  <UbgtNetConversion
                    ubgtBrutTotal={ubgtTotalBrutFromRows}
                    tableData={ubgtRows}
                    dateRanges={dateRanges}
                    initialMahsuplasamaData={ubgtMahsuplasamaData}
                    onSummaryChange={setUbgtNetSummary}
                    onMahsuplasamaDataChange={setUbgtMahsuplasamaData}
                  />
                </div>

                <section className={`${calcSectionBoxCls} mt-2`}>
                  <h2 className={calcSectionTitleCls}>Notlar</h2>
                  <p className={calcHelperTextCls}>Ulusal Bayram ve Genel Tatil Günleri Hakkında Kanun</p>
                  <div className="mt-2 max-h-[min(50vh,28rem)] overflow-y-auto break-words text-[11px] font-light text-gray-500 dark:text-gray-400 leading-relaxed space-y-2">
                    <p>
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">Madde 1</strong> – 1923 yılında Cumhuriyetin ilan edildiği 29 Ekim günü Ulusal Bayramdır.
                    </p>
                    <p>
                      Türkiye'nin içinde ve dışında Devlet adına yalnız bugün tören yapılır. Bayram 28 Ekim günü saat 13.00'ten itibaren başlar ve 29 Ekim günü devam eder.
                    </p>
                    <p>
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">Madde 2</strong> – Aşağıda sayılan resmi ve dini bayram günleri ile yılbaşı günü, 1 Mayıs günü ve 15 Temmuz günü genel tatil günleridir.
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">A) Resmi bayram günleri şunlardır:</p>
                    <p className="pl-3">
                      1. (Değişik: 20/4/1983 - 2818/1 md.) 23 Nisan günü Ulusal Egemenlik ve Çocuk Bayramıdır.<br />
                      2. 19 Mayıs günü Atatürk'ü Anma ve Gençlik ve Spor Bayramı günüdür.<br />
                      3. 30 Ağustos günü Zafer Bayramıdır.
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">B) Dini bayramlar şunlardır:</p>
                    <p className="pl-3">
                      1. Ramazan Bayramı; Arefe günü saat 13.00'ten itibaren 3,5 gündür.<br />
                      2. Kurban Bayramı; Arefe günü saat 13.00'ten itibaren 4,5 gündür.
                    </p>
                    <p>
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">C)</strong> (Değişik: 25/10/2016-6752/2 md.) 1 Ocak günü yılbaşı tatili, 1 Mayıs günü Emek ve Dayanışma Günü ve 15 Temmuz günü Demokrasi ve Milli Birlik Günü tatilidir.
                    </p>
                    <p>
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">Madde -2</strong> – 22/4/2009 tarihli ve 5892 sayılı Kanunun 1 inci maddesiyle, &quot;yılbaşı günü&quot; ibarelerinden sonra gelmek üzere &quot;ve 1 Mayıs günü&quot; ibaresi eklenmiştir. 25/10/2016 tarihli ve 6752 sayılı Kanunun 2 nci maddesiyle, bu maddenin birinci fıkrasında yer alan &quot;ve 1 Mayıs günü&quot; ibareleri &quot;, 1 Mayıs günü ve 15 Temmuz günü&quot; olarak değiştirilmiştir.
                    </p>
                    <p>
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">D)</strong> (Değişik: 20/4/1983 - 2818/1 md.) Ulusal, resmi ve dini bayram günleri ile yılbaşı günü, 1 Mayıs günü ve 15 Temmuz günü resmi daire ve kuruluşlar tatil edilir.
                    </p>
                    <p>
                      Bu Kanunda belirtilen Ulusal Bayram ve genel tatil günleri; Cuma günü akşamı sona erdiğinde müteakip Cumartesi gününün tamamı tatil yapılır.
                    </p>
                    <p>
                      Mahiyetleri itibariyle sürekli görev yapması gereken kuruluşların özel kanunlarındaki hükümler saklıdır.
                    </p>
                    <p>29 Ekim günü özel işyerlerinin kapanması zorunludur.</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gizli rapor içeriği - PDF ve Yazdır buradan alır */}
      <div id="ubgt-print-wrapper" style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }} aria-hidden="true">
        <ReportContentFromConfig config={ubgtReportConfig} />
      </div>

      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <FooterActions 
        onCalculate={handleCalculate}
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel={isSaving ? "Kaydediliyor..." : (effectiveId ? "Güncelle" : "Kaydet")}
        previewButton={{
          title: "UBGT Alacağı Rapor",
          copyTargetId: "ubgt-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ubgt-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ubgt-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="ubgt-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button
                        type="button"
                        className="copy-icon-btn"
                        onClick={() => {
                          copySectionForWord(sec.id);
                          setCopiedSectionId(sec.id);
                          window.setTimeout(() => setCopiedSectionId(null), 2000);
                        }}
                        title={copiedSectionId === sec.id ? "Kopyalandı" : "Word'e kopyala"}
                      >
                        {copiedSectionId === sec.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM("UBGT Alacağı Rapor", "report-content"),
        }}
      />
    </>
  );
}
