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
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

const DOCUMENT_TITLE = "Mercan Danışmanlık | Bilirkişi UBGT";

interface StaticHoliday {
  id: string;
  name: string;
  days: number;
}

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

function getUbgtDaysForPeriod(
  periodStart: string,
  periodEnd: string,
  selectedHolidayIds: string[],
  excludedDays: Array<{ start: string; end: string }> = []
): number {
  if (!selectedHolidayIds?.length) return 0;
  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  const startNormalized = new Date(
    periodStartDate.getFullYear(),
    periodStartDate.getMonth(),
    periodStartDate.getDate()
  );
  const endNormalized = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate());
  const startYear = startNormalized.getFullYear();
  const endYear = endNormalized.getFullYear();
  const excludedDatesSet = new Set<string>();
  for (const excluded of excludedDays) {
    if (excluded.start && excluded.end) {
      const startDate = new Date(excluded.start);
      const endDate = new Date(excluded.end);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        excludedDatesSet.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        );
      }
    }
  }
  const holidayDates = new Map<string, number>();
  for (const selectedId of selectedHolidayIds) {
    const staticHoliday = [...STATIC_HOLIDAYS.national, ...STATIC_HOLIDAYS.official, ...STATIC_HOLIDAYS.general].find(
      (h) => h.id === selectedId
    );
    if (!staticHoliday) continue;
    const fixedHoliday = FIXED_HOLIDAY_MAP[selectedId];
    if (!fixedHoliday) continue;
    const rule = HOLIDAY_RULES[selectedId];
    if (!rule) continue;
    for (let year = startYear; year <= endYear; year++) {
      if (!rule(year)) continue;
      const holidayDate = new Date(year, fixedHoliday.month, fixedHoliday.day);
      const holidayDateNormalized = new Date(
        holidayDate.getFullYear(),
        holidayDate.getMonth(),
        holidayDate.getDate()
      );
      if (holidayDateNormalized >= startNormalized && holidayDateNormalized <= endNormalized) {
        const dateStr = `${year}-${String(holidayDate.getMonth() + 1).padStart(2, "0")}-${String(
          holidayDate.getDate()
        ).padStart(2, "0")}`;
        if (!excludedDatesSet.has(dateStr)) {
          const existing = holidayDates.get(dateStr);
          if (!existing || staticHoliday.days > existing) holidayDates.set(dateStr, staticHoliday.days);
        }
      }
    }
  }
  let ubgtDays = 0;
  for (const duration of holidayDates.values()) ubgtDays += duration;
  return ubgtDays;
}

function filterHolidaysByAllowed(
  allowed: Set<string>
): {
  national: StaticHoliday[];
  official: StaticHoliday[];
  general: StaticHoliday[];
  religious: StaticHoliday[];
} {
  return {
    national: STATIC_HOLIDAYS.national.filter((h) => allowed.has(h.id)),
    official: STATIC_HOLIDAYS.official.filter((h) => allowed.has(h.id)),
    general: STATIC_HOLIDAYS.general.filter((h) => allowed.has(h.id)),
    religious: STATIC_HOLIDAYS.religious.filter((h) => allowed.has(h.id)),
  };
}

interface DateRangeWithHolidays {
  id: string;
  start: string;
  end: string;
  selectedHolidayIds: string[];
}

interface Witness {
  id: string;
  name: string;
  dateRange: DateRangeWithHolidays;
}

export interface UbgtTableRow {
  period: string;
  wage?: number;
  coefficient?: number;
  dailyWage?: number;
  ubgtDays?: number;
  ubgtTotal?: number;
  startISO?: string;
  endISO?: string;
  manual?: boolean;
  persons?: string[];
}

const WEEKDAYS: { index: number; label: string }[] = [
  { index: 0, label: "Pazar" },
  { index: 1, label: "Pazartesi" },
  { index: 2, label: "Salı" },
  { index: 3, label: "Çarşamba" },
  { index: 4, label: "Perşembe" },
  { index: 5, label: "Cuma" },
  { index: 6, label: "Cumartesi" },
];

function buildTanikRanges(
  davaciDateRanges: DateRangeWithHolidays[],
  witnesses: Witness[],
  davaciSelectedHolidayIds: string[]
): Array<{ id: string; start: string; end: string; person: string; selectedHolidayIds: string[] }> {
  const davaciRanges = davaciDateRanges.filter((r) => r.start && r.end);
  if (davaciRanges.length === 0) return [];
  const allDavaciDates = davaciRanges.flatMap((r) => [new Date(r.start), new Date(r.end)]);
  const davaciMinDate = new Date(Math.min(...allDavaciDates.map((d) => d.getTime())));
  const davaciMaxDate = new Date(Math.max(...allDavaciDates.map((d) => d.getTime())));

  return witnesses
    .filter((w) => w.dateRange.start && w.dateRange.end)
    .map((w) => {
      let start = w.dateRange.start;
      let end = w.dateRange.end;
      const tanikStart = new Date(w.dateRange.start);
      const tanikEnd = new Date(w.dateRange.end);
      if (tanikStart < davaciMinDate) start = davaciMinDate.toISOString().split("T")[0];
      if (tanikEnd > davaciMaxDate) end = davaciMaxDate.toISOString().split("T")[0];
      if (new Date(start) > new Date(end)) return null;
      const filteredHolidayIds = (w.dateRange.selectedHolidayIds || []).filter((id) => davaciSelectedHolidayIds.includes(id));
      return {
        id: w.dateRange.id,
        start,
        end,
        person: w.name,
        selectedHolidayIds: filteredHolidayIds,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

export default function UbgtBilirkisiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const pageStyle = usePageStyle("ubgt");
  const videoLink = getVideoLink("ubgt-bilirkisi");

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const loadRanRef = useRef<string | null>(null);
  const [loadingFromSave, setLoadingFromSave] = useState(false);

  const [davaciDateRanges, setDavaciDateRanges] = useState<DateRangeWithHolidays[]>([
    { id: Date.now().toString(), start: "", end: "", selectedHolidayIds: [] },
  ]);
  const [witnesses, setWitnesses] = useState<Witness[]>([
    {
      id: `${Date.now()}-w0`,
      name: "Tanık 1",
      dateRange: { id: `${Date.now()}-d0`, start: "", end: "", selectedHolidayIds: [] },
    },
  ]);

  const [ubgtExpiryStart, setUbgtExpiryStart] = useState<string | null>(null);
  const [ubgtExcludedDays, setUbgtExcludedDays] = useState<
    Array<{ id: string; type: "Yıllık İzin" | "Rapor" | "Diğer"; start: string; end: string; days: number }>
  >([]);
  const [ubgtExclusionRules, setUbgtExclusionRules] = useState<UbgtExclusionRule[]>([]);
  const [ubgtDayEntriesList, setUbgtDayEntriesList] = useState<UbgtDayEntry[]>([]);
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([]);
  const [backendExcludedList, setBackendExcludedList] = useState<
    Array<{ date: string; name: string; duration: number; dayOfWeek: number }>
  >([]);

  const [totalDays, setTotalDays] = useState(0);
  const [ubgtTotalBrut, setUbgtTotalBrut] = useState(0);
  const [ubgtRows, setUbgtRows] = useState<UbgtTableRow[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  const [ubgtNetSummary, setUbgtNetSummary] = useState({
    brut: 0,
    ssk: 0,
    gelir: 0,
    damga: 0,
    net: 0,
    hakkaniyet: 0,
    settleAmount: "",
  });
  const [ubgtMahsuplasamaData, setUbgtMahsuplasamaData] = useState<{
    [year: number]: { [holidayName: string]: number };
  }>({});

  const davaciSelectedHolidayIds = useMemo(() => {
    const allIds = new Set<string>();
    davaciDateRanges.forEach((range) => {
      range.selectedHolidayIds?.forEach((hid) => allIds.add(hid));
    });
    return Array.from(allIds);
  }, [davaciDateRanges]);

  const davaciAllowedSet = useMemo(() => new Set(davaciSelectedHolidayIds), [davaciSelectedHolidayIds]);

  const davaciHolidayKey = davaciSelectedHolidayIds.slice().sort().join(",");
  useEffect(() => {
    setWitnesses((prev) =>
      prev.map((w) => ({
        ...w,
        dateRange: {
          ...w.dateRange,
          selectedHolidayIds: w.dateRange.selectedHolidayIds.filter((hid) => davaciAllowedSet.has(hid)),
        },
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davaciHolidayKey]);

  const allHolidaysList = useMemo(
    () => [...STATIC_HOLIDAYS.national, ...STATIC_HOLIDAYS.official, ...STATIC_HOLIDAYS.general, ...STATIC_HOLIDAYS.religious],
    []
  );

  const areAllDavaciHolidaysSelected = useMemo(
    () => allHolidaysList.length > 0 && allHolidaysList.every((h) => davaciSelectedHolidayIds.includes(h.id)),
    [allHolidaysList, davaciSelectedHolidayIds]
  );

  const allHolidayIdsForManual = useMemo(() => {
    const s = new Set<string>(davaciSelectedHolidayIds);
    witnesses.forEach((w) => w.dateRange.selectedHolidayIds.forEach((hid) => s.add(hid)));
    return Array.from(s);
  }, [davaciSelectedHolidayIds, witnesses]);

  const dateRangesForNetAndExclusion = useMemo(
    () => davaciDateRanges.map((r) => ({ id: r.id, start: r.start, end: r.end })),
    [davaciDateRanges]
  );

  const getHolidayTooltip = (holidayId: string): string | undefined => {
    if (holidayId === "1-mayis") return "Bu tatil 22.04.2009 sonrası yıllarda geçerlidir.";
    if (holidayId === "15-temmuz") return "Bu tatil 29.10.2016 sonrası yıllarda geçerlidir.";
    return undefined;
  };

  const handleDavaciHolidayCheckboxChange = (holidayId: string, checked: boolean) => {
    setDavaciDateRanges((prev) =>
      prev.map((range) => ({
        ...range,
        selectedHolidayIds: checked
          ? range.selectedHolidayIds.includes(holidayId)
            ? range.selectedHolidayIds
            : [...range.selectedHolidayIds, holidayId]
          : range.selectedHolidayIds.filter((x) => x !== holidayId),
      }))
    );
  };

  const handleToggleAllDavaciHolidays = () => {
    const newValue = !areAllDavaciHolidaysSelected;
    setDavaciDateRanges((prev) =>
      prev.map((range) => ({
        ...range,
        selectedHolidayIds: newValue ? allHolidaysList.map((h) => h.id) : [],
      }))
    );
  };

  const handleAddDavaciDateRange = () => {
    setDavaciDateRanges((prev) => [...prev, { id: Date.now().toString(), start: "", end: "", selectedHolidayIds: [] }]);
  };

  const handleRemoveDavaciDateRange = (rid: string) => {
    setDavaciDateRanges((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rid)));
  };

  const handleUpdateDavaciDateRange = (rid: string, field: "start" | "end", value: string) => {
    let v = value;
    if (v && v.includes("-")) {
      const parts = v.split("-");
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].substring(0, 4);
        v = parts.join("-");
      }
    }
    setDavaciDateRanges((prev) => prev.map((r) => (r.id === rid ? { ...r, [field]: v } : r)));
  };

  const handleAddWitness = () => {
    const n = witnesses.length + 1;
    setWitnesses((prev) => [
      ...prev,
      {
        id: `${Date.now()}-w${n}`,
        name: `Tanık ${n}`,
        dateRange: { id: `${Date.now()}-d${n}`, start: "", end: "", selectedHolidayIds: [] },
      },
    ]);
  };

  const handleRemoveWitness = (wid: string) => {
    setWitnesses((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.id !== wid)));
  };

  const handleWitnessName = (wid: string, name: string) => {
    const trimmed = name.trim();
    const idx = witnesses.findIndex((w) => w.id === wid) + 1;
    setWitnesses((prev) =>
      prev.map((w) => (w.id === wid ? { ...w, name: trimmed || `Tanık ${idx}` } : w))
    );
  };

  const handleWitnessDate = (wid: string, field: "start" | "end", value: string) => {
    let v = value;
    if (v && v.includes("-")) {
      const parts = v.split("-");
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].substring(0, 4);
        v = parts.join("-");
      }
    }
    setWitnesses((prev) =>
      prev.map((w) => (w.id === wid ? { ...w, dateRange: { ...w.dateRange, [field]: v } } : w))
    );
  };

  const handleWitnessHolidayChange = (wid: string, holidayId: string, checked: boolean) => {
    if (checked && !davaciAllowedSet.has(holidayId)) return;
    setWitnesses((prev) =>
      prev.map((w) => {
        if (w.id !== wid) return w;
        const ids = w.dateRange.selectedHolidayIds;
        return {
          ...w,
          dateRange: {
            ...w.dateRange,
            selectedHolidayIds: checked
              ? ids.includes(holidayId)
                ? ids
                : [...ids, holidayId]
              : ids.filter((x) => x !== holidayId),
          },
        };
      })
    );
  };

  const toggleWitnessToggleAll = (wid: string) => {
    const w = witnesses.find((x) => x.id === wid);
    if (!w) return;
    const allowedIds = allHolidaysList.filter((h) => davaciAllowedSet.has(h.id)).map((h) => h.id);
    const allOn = allowedIds.length > 0 && allowedIds.every((id) => w.dateRange.selectedHolidayIds.includes(id));
    setWitnesses((prev) =>
      prev.map((x) =>
        x.id === wid
          ? { ...x, dateRange: { ...x.dateRange, selectedHolidayIds: allOn ? [] : [...allowedIds] } }
          : x
      )
    );
  };

  const witnessAreAllSelected = (wid: string) => {
    const w = witnesses.find((x) => x.id === wid);
    if (!w || davaciAllowedSet.size === 0) return false;
    const allowedIds = allHolidaysList.filter((h) => davaciAllowedSet.has(h.id)).map((h) => h.id);
    return allowedIds.length > 0 && allowedIds.every((id) => w.dateRange.selectedHolidayIds.includes(id));
  };

  const handleWeekdayExclude = (weekday: number, checked: boolean) => {
    setExcludedWeekdays((prev) => (checked ? [...prev, weekday] : prev.filter((d) => d !== weekday)));
  };

  const recalcRow = (row: UbgtTableRow): UbgtTableRow => {
    const step1 = Number(((row.wage ?? 0) * (row.coefficient ?? 1)).toFixed(6));
    const dailyWage = Number((step1 / 30).toFixed(6));
    const step2 = Number((dailyWage * (row.ubgtDays ?? 0)).toFixed(6));
    const ubgtTotal = Number(step2.toFixed(2));
    return { ...row, dailyWage, ubgtTotal };
  };

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

  const duplicateRow = useCallback(
    (i: number) => {
      setUbgtRows((prev) => {
        const copy = [...prev];
        copy.splice(i + 1, 0, recalcRow(createManualRow()));
        return copy;
      });
    },
    [createManualRow]
  );

  const deleteRow = useCallback((i: number) => {
    setUbgtRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }, []);

  const handleWageChange = (index: number, value: string) => {
    const cleaned = value.replace(/₺/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
    const wage = Number(cleaned) || 0;
    setUbgtRows((prev) => prev.map((r, i) => (i === index ? recalcRow({ ...r, wage }) : r)));
  };

  const applyGlobalCoefficient = (k: number) => {
    const fixed = Number(k.toFixed(4));
    setUbgtRows((prev) => prev.map((r) => recalcRow({ ...r, coefficient: fixed })));
    setHasCustomKatsayi(fixed !== 1);
  };

  const handleResetKatsayi = () => {
    setUbgtRows((prev) => prev.map((r) => recalcRow({ ...r, coefficient: 1 })));
    setHasCustomKatsayi(false);
  };

  const ubgtTotalBrutFromRows = useMemo(() => ubgtRows.reduce((s, r) => s + (r.ubgtTotal ?? 0), 0), [ubgtRows]);

  const handleCalculate = async (showSuccessMessage = true) => {
    const hasValidDavaci = davaciDateRanges.some((r) => r.start && r.end);
    if (!hasValidDavaci) {
      if (showSuccessMessage) showToastError("Lütfen davacı için en az bir tarih aralığı girin");
      return;
    }

    const tanikRanges = buildTanikRanges(davaciDateRanges, witnesses, davaciSelectedHolidayIds);
    if (tanikRanges.length === 0) {
      setUbgtRows([]);
      setUbgtTotalBrut(0);
      setTotalDays(0);
      setUbgtDayEntriesList([]);
      setBackendExcludedList([]);
      if (showSuccessMessage) {
        showToastError("En az bir tanık için davacı aralığıyla kesişen geçerli tarih girin.");
      }
      return;
    }

    try {
      const payload = {
        dateRanges: tanikRanges,
        selectedHolidayIds: [] as string[],
        ubgtExcludedDays,
        ubgtExpiryStart,
        excludedWeekdays,
        year: new Date().getFullYear(),
      };

      const response = await apiPost("/api/ubgt/bilirkisi", payload);
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        throw new Error(errorResult.error || errorResult.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const periods = result.data.periods || [];
        const ubgtDayEntries = result.data.ubgtDayEntries || [];
        setBackendExcludedList(result.data.excludedWeekdayHolidays || []);

        const currentKatsayi = hasCustomKatsayi && ubgtRows.length > 0 ? ubgtRows[0].coefficient ?? 1 : undefined;
        const periodsWithKatsayi =
          currentKatsayi !== undefined
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
            success(
              `Hesaplama tamamlandı. Toplam: ${filteredUbgtDays.reduce((s, r) => s + (r.ubgtDays ?? 0), 0)} gün`
            );
          }
        }
      } else if (showSuccessMessage) {
        showToastError(result.error || "Hesaplama başarısız");
      }
    } catch (e: unknown) {
      console.error(e);
      if (showSuccessMessage) showToastError(e instanceof Error ? e.message : "Hesaplama sırasında bir hata oluştu");
    }
  };

  useEffect(() => {
    if (loadingFromSave) return;
    const hasDavaci = davaciDateRanges.some((r) => {
      if (!r.start || !r.end) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.start) || !/^\d{4}-\d{2}-\d{2}$/.test(r.end)) return false;
      const sy = parseInt(r.start.slice(0, 4), 10);
      const ey = parseInt(r.end.slice(0, 4), 10);
      if (sy < 2000 || sy > 2100 || ey < 2000 || ey > 2100) return false;
      const sd = new Date(r.start);
      const ed = new Date(r.end);
      if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || ed < sd) return false;
      return true;
    });
    const hasWitness = witnesses.some((w) => {
      const { start, end } = w.dateRange;
      if (!start || !end) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
      const sd = new Date(start);
      const ed = new Date(end);
      return !isNaN(sd.getTime()) && !isNaN(ed.getTime()) && ed >= sd;
    });
    if (!hasDavaci || !hasWitness) return;
    const t = window.setTimeout(() => handleCalculate(false), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    davaciDateRanges,
    davaciSelectedHolidayIds,
    witnesses,
    ubgtExcludedDays,
    ubgtExpiryStart,
    excludedWeekdays,
    loadingFromSave,
  ]);

  useEffect(() => {
    if (ubgtDayEntriesList.length === 0) return;
    const filtered = filterExcludedUbgtHolidaysByRules(ubgtDayEntriesList, ubgtExclusionRules);
    const daysByPeriod: Record<number, number> = {};
    filtered.forEach((e) => {
      const idx = e.periodIndex ?? 0;
      daysByPeriod[idx] = (daysByPeriod[idx] ?? 0) + e.days;
    });
    setUbgtRows((prev) => {
      const next = prev.map((row, idx) => recalcRow({ ...row, ubgtDays: daysByPeriod[idx] ?? row.ubgtDays ?? 0 }));
      setTotalDays(next.reduce((s, r) => s + (r.ubgtDays ?? 0), 0));
      setUbgtTotalBrut(next.reduce((s, r) => s + (r.ubgtTotal ?? 0), 0));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubgtExclusionRules]);

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    const run = async () => {
      try {
        if (loadRanRef.current === effectiveId) return;
        loadRanRef.current = String(effectiveId);
        setLoadingFromSave(true);
        const res = await yukleHesap(effectiveId, "ubgt_bilirkisi");
        if (cancelled) return;
        if (!res.success) {
          showToastError(res.error || "Kayıt yüklenemedi");
          loadRanRef.current = null;
          setLoadingFromSave(false);
          return;
        }
        let payload: unknown = res.data;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = {};
          }
        }
        const p = payload as Record<string, unknown>;
        const formData = (p?.form ?? (p?.data as Record<string, unknown>)?.form ?? p ?? {}) as Record<string, unknown>;

        const loadedDavaci = (formData.davaciDateRanges || formData.workerPeriods) as DateRangeWithHolidays[] | undefined;
        const loadedWitnesses = formData.witnesses as Witness[] | undefined;
        const rawExcluded = formData.excludedWeekdays as unknown[] | undefined;
        const loadedExcludedWeekdays = Array.isArray(rawExcluded)
          ? rawExcluded.map((d) => Number(d)).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
          : [];
        const loadedBackendEx = formData.excludedWeekdayHolidays as typeof backendExcludedList | undefined;
        const loadedUbgtExcluded = (formData.ubgtExcludedDays || formData.excludedDays) as typeof ubgtExcludedDays | undefined;
        const loadedRules = formData.ubgtExclusionRules as UbgtExclusionRule[] | undefined;
        const loadedExpiry =
          (formData.ubgtExpiryStart as string) ||
          (formData.zamanasimi as { start?: string } | undefined)?.start ||
          null;
        const loadedPeriods = formData.periods as UbgtTableRow[] | undefined;
        const settlement = formData.settlement as { mahsuplasamaData?: typeof ubgtMahsuplasamaData } | undefined;

        if (loadedDavaci && Array.isArray(loadedDavaci) && loadedDavaci.length > 0) {
          setDavaciDateRanges(
            loadedDavaci.map((range) => ({
              id: String(range.id || Date.now()),
              start: range.start || "",
              end: range.end || "",
              selectedHolidayIds: Array.isArray(range.selectedHolidayIds) ? range.selectedHolidayIds : [],
            }))
          );
        }
        if (loadedWitnesses && Array.isArray(loadedWitnesses) && loadedWitnesses.length > 0) {
          setWitnesses(
            loadedWitnesses.map((witness, idx) => ({
              id: String(witness.id || `w-${idx}`),
              name: witness.name || `Tanık ${idx + 1}`,
              dateRange: {
                id: String(witness.dateRange?.id || `d-${idx}`),
                start: witness.dateRange?.start || "",
                end: witness.dateRange?.end || "",
                selectedHolidayIds: Array.isArray(witness.dateRange?.selectedHolidayIds)
                  ? witness.dateRange.selectedHolidayIds
                  : [],
              },
            }))
          );
        }
        setExcludedWeekdays(loadedExcludedWeekdays);
        if (Array.isArray(loadedBackendEx) && loadedBackendEx.length > 0) setBackendExcludedList(loadedBackendEx);
        if (loadedUbgtExcluded && Array.isArray(loadedUbgtExcluded)) setUbgtExcludedDays(loadedUbgtExcluded);
        if (loadedRules && Array.isArray(loadedRules)) setUbgtExclusionRules(loadedRules);
        if (loadedExpiry) setUbgtExpiryStart(loadedExpiry);
        if (loadedPeriods && Array.isArray(loadedPeriods)) setUbgtRows(loadedPeriods);
        if (settlement?.mahsuplasamaData) setUbgtMahsuplasamaData(settlement.mahsuplasamaData);

        setCurrentRecordName(res.name || null);
        success(`Kayıt yüklendi (#${effectiveId})`);
        setTimeout(() => setLoadingFromSave(false), 800);
      } catch {
        if (!cancelled) {
          showToastError("Kayıt yüklenemedi");
          loadRanRef.current = null;
          setLoadingFromSave(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  const handleUbgtExpiryCancel = () => {
    info("Zamanaşımı itirazı kaldırıldı.");
  };

  const handleSave = () => {
    try {
      const katsayi = ubgtRows.length > 0 ? ubgtRows[0].coefficient : 1;
      const allRanges = [...davaciDateRanges, ...witnesses.map((w) => w.dateRange)];
      const startDate = allRanges
        .filter((r) => r.start)
        .map((r) => new Date(r.start).getTime())
        .sort((a, b) => a - b)[0];
      const endDate = allRanges
        .filter((r) => r.end)
        .map((r) => new Date(r.end).getTime())
        .sort((a, b) => b - a)[0];
      const startDateStr = startDate ? new Date(startDate).toISOString().slice(0, 10) : null;
      const endDateStr = endDate ? new Date(endDate).toISOString().slice(0, 10) : null;

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
        workerPeriods: allRanges,
        selectedHolidays: [] as string[],
        calculatedUbgtDays: totalDays,
        katsayi,
        zamanasimi: { active: !!ubgtExpiryStart, start: ubgtExpiryStart },
        excludedDays: ubgtExcludedDays,
        startDate: startDateStr,
        endDate: endDateStr,
        notes: "",
      };

      kaydetAc({
        hesapTuru: "ubgt_bilirkisi",
        veri: {
          data: {
            form: {
              davaciDateRanges,
              witnesses,
              excludedWeekdays,
              excludedWeekdayHolidays: backendExcludedList,
              ubgtExcludedDays,
              ubgtExclusionRules,
              ubgtExpiryStart,
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
            },
          },
          start_date: startDateStr,
          end_date: endDateStr,
          brut_total: ubgtTotalBrutFromRows,
          net_total: ubgtNetSummary.net,
          notes: "",
          ...ubgtData,
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `/ubgt-bilirkisi/:id`,
      });
    } catch {
      showToastError("Kayıt yapılamadı.");
    }
  };

  const handleNewCalculation = () => {
    const dirty =
      davaciDateRanges.some((r) => r.start || r.end) ||
      witnesses.some((w) => w.dateRange.start || w.dateRange.end) ||
      ubgtRows.length > 0;
    if (dirty && !window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
    setDavaciDateRanges([{ id: Date.now().toString(), start: "", end: "", selectedHolidayIds: [] }]);
    setWitnesses([
      {
        id: `${Date.now()}-w1`,
        name: "Tanık 1",
        dateRange: { id: `${Date.now()}-d1`, start: "", end: "", selectedHolidayIds: [] },
      },
    ]);
    setExcludedWeekdays([]);
    setUbgtExpiryStart(null);
    setUbgtExcludedDays([]);
    setUbgtExclusionRules([]);
    setUbgtRows([]);
    setUbgtDayEntriesList([]);
    setBackendExcludedList([]);
    setUbgtMahsuplasamaData({});
    setCurrentRecordName(null);
    loadRanRef.current = null;
    if (effectiveId) navigate("/ubgt-bilirkisi", { replace: true });
  };

  const ubgtReportConfig = useMemo((): ReportConfig => {
    const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ubgtTotalAmount = ubgtRows.reduce((sum, row) => sum + (row.ubgtTotal ?? 0), 0);
    const davaciSummary = davaciDateRanges
      .filter((r) => r.start && r.end)
      .map((r) => `${r.start} → ${r.end}`)
      .join("; ");

    return {
      title: "Bilirkişi UBGT Alacağı",
      sections: { info: true, periodTable: true, grossToNet: true, mahsuplasma: true },
      infoRows: [
        { label: "Davacı dönemleri", value: davaciSummary || "-", condition: !!davaciSummary },
        {
          label: "Tanık sayısı",
          value: String(witnesses.filter((w) => w.dateRange.start && w.dateRange.end).length),
          condition: witnesses.length > 0,
        },
        { label: "Toplam UBGT günü", value: `${totalDays} gün`, condition: totalDays > 0 },
        {
          label: "Zamanaşımı başlangıcı",
          value: ubgtExpiryStart ? new Date(ubgtExpiryStart).toLocaleDateString("tr-TR") : "-",
          condition: !!ubgtExpiryStart,
        },
      ],
      customSections: [],
      periodData: {
        title: "UBGT hesaplama cetveli",
        headers: ["Dönem", "Kişi(ler)", "Ücret (BRÜT)", "Katsayı", "Günlük ücret", "UBGT günleri", "UBGT ücreti"],
        rows: ubgtRows.map((row) => [
          row.period,
          (row.persons && row.persons.length ? row.persons.join(", ") : "—") as string,
          `${fmt(row.wage || 0)}₺`,
          (row.coefficient || 1).toFixed(4),
          `${fmt(row.dailyWage || 0)}₺`,
          String(row.ubgtDays ?? 0),
          `${fmt(row.ubgtTotal || 0)}₺`,
        ]),
        footer: ["Toplam", "", "", "", "", "", `${fmt(ubgtTotalAmount)}₺`],
        alignRight: [2, 3, 4, 5, 6],
      },
      grossToNetData: {
        title: "Brüt'ten net'e çeviri",
        rows: [
          { label: "Brüt UBGT alacağı", value: `${fmt(ubgtNetSummary.brut)}₺` },
          { label: "SGK işçi primi (%15)", value: `-${fmt(ubgtNetSummary.ssk)}₺`, isDeduction: true },
          { label: "Gelir vergisi", value: `-${fmt(ubgtNetSummary.gelir)}₺`, isDeduction: true },
          { label: "Damga vergisi (binde 7,59)", value: `-${fmt(ubgtNetSummary.damga)}₺`, isDeduction: true },
          { label: "Net UBGT alacağı", value: `${fmt(ubgtNetSummary.net)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Net UBGT alacağı", value: `${fmt(ubgtNetSummary.net)}₺` },
          { label: "1/3 hakkaniyet indirimi", value: `-${fmt(ubgtNetSummary.hakkaniyet)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma sonucu",
          value: `${fmt(Math.max(0, ubgtNetSummary.net - ubgtNetSummary.hakkaniyet))}₺`,
        },
      },
    };
  }, [ubgtRows, ubgtNetSummary, davaciDateRanges, witnesses, totalDays, ubgtExpiryStart]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const infoRowsFiltered = (ubgtReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "bilirkisi-ust", title: "Genel bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }
    const pd = ubgtReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) periodRows.push(pd.footer);
      const n3 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({ id: "bilirkisi-cetvel", title: pd.title || "Cetvel", html: buildWordTable(n3.headers, n3.rows) });
    }
    const gnd = ubgtReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({ id: "bilirkisi-net", title: "Brüt–net", html: buildWordTable(n4.headers, n4.rows) });
    }
    const md = ubgtReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n5 = adaptToWordTable(mahsupRows);
      sections.push({ id: "bilirkisi-mahsup", title: md.title || "Mahsuplaşma", html: buildWordTable(n5.headers, n5.rows) });
    }
    return sections;
  }, [ubgtReportConfig]);

  const firstDavaciStart = davaciDateRanges.map((r) => r.start).filter(Boolean).sort()[0];

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

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <div className="space-y-4">
                <section className={calcSectionBoxCls}>
                  <h2 className={calcSectionTitleCls}>Davacı — işe giriş / çıkış</h2>
                  <p className={calcHelperTextCls}>
                    Tanık çalışma tarihleri bu aralığa göre kısıtlanır; hesaplama yalnızca tanık beyanları üzerinden yapılır.
                  </p>
                  <div className="space-y-3 mt-3">
                    {davaciDateRanges.map((range) => (
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
                            onChange={(e) => handleUpdateDavaciDateRange(range.id, "start", e.target.value)}
                            max="9999-12-31"
                          />
                        </div>
                        <span className="text-gray-400 pb-2 text-xs">—</span>
                        <div className="flex-1 min-w-[8rem]">
                          <label className={calcLabelCls}>Bitiş</label>
                          <input
                            type="date"
                            className={calcInputCls}
                            value={range.end}
                            onChange={(e) => handleUpdateDavaciDateRange(range.id, "end", e.target.value)}
                            max="9999-12-31"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-red-600"
                          disabled={davaciDateRanges.length <= 1}
                          onClick={() => handleRemoveDavaciDateRange(range.id)}
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={handleAddDavaciDateRange} className="text-xs h-9 w-full sm:w-auto">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Davacı dönemi ekle
                    </Button>
                  </div>
                </section>

                <section className={calcSectionBoxCls}>
                  <h2 className={calcSectionTitleCls}>Tanıklar</h2>
                  <p className={calcHelperTextCls}>
                    Her tanık için çalışıldığı iddia edilen dönemi ve (davacının seçtiği tatiller içinden) kanıtlanan tatilleri işaretleyin.
                  </p>
                  <div className="mt-3 space-y-4">
                    {witnesses.map((w) => {
                      const filteredHolidays = filterHolidaysByAllowed(davaciAllowedSet);
                      return (
                        <div
                          key={w.id}
                          className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-3 bg-gray-50/40 dark:bg-gray-900/20"
                        >
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[8rem]">
                              <label className={calcLabelCls}>Tanık adı</label>
                              <input
                                type="text"
                                className={calcInputCls}
                                value={w.name}
                                onChange={(e) => handleWitnessName(w.id, e.target.value)}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 h-9"
                              disabled={witnesses.length <= 1}
                              onClick={() => handleRemoveWitness(w.id)}
                            >
                              Kaldır
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[8rem]">
                              <label className={calcLabelCls}>Başlangıç</label>
                              <input
                                type="date"
                                className={calcInputCls}
                                value={w.dateRange.start}
                                onChange={(e) => handleWitnessDate(w.id, "start", e.target.value)}
                                max="9999-12-31"
                              />
                            </div>
                            <span className="text-gray-400 pb-2 text-xs">—</span>
                            <div className="flex-1 min-w-[8rem]">
                              <label className={calcLabelCls}>Bitiş</label>
                              <input
                                type="date"
                                className={calcInputCls}
                                value={w.dateRange.end}
                                onChange={(e) => handleWitnessDate(w.id, "end", e.target.value)}
                                max="9999-12-31"
                              />
                            </div>
                          </div>
                          {davaciAllowedSet.size === 0 ? (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              Tanık tatili seçmek için önce davacı tatil seçimi yapın.
                            </p>
                          ) : (
                            <UbgtHolidaySelectCompact
                              title={`${w.name} — tatiller (davacı ile sınırlı)`}
                              holidays={filteredHolidays}
                              selectedHolidayIds={w.dateRange.selectedHolidayIds.filter((id) => davaciAllowedSet.has(id))}
                              onSelectionChange={(hid, checked) => handleWitnessHolidayChange(w.id, hid, checked)}
                              onToggleAll={() => toggleWitnessToggleAll(w.id)}
                              areAllSelected={witnessAreAllSelected(w.id)}
                              getHolidayTooltip={getHolidayTooltip}
                              totalDays={0}
                            />
                          )}
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" onClick={handleAddWitness} className="text-xs h-9 w-full sm:w-auto">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Tanık ekle
                    </Button>
                  </div>
                </section>

                <UbgtHolidaySelectCompact
                  title="Davacı — tatil seçimi (üst sınır)"
                  holidays={STATIC_HOLIDAYS}
                  selectedHolidayIds={davaciSelectedHolidayIds}
                  onSelectionChange={handleDavaciHolidayCheckboxChange}
                  onToggleAll={handleToggleAllDavaciHolidays}
                  areAllSelected={areAllDavaciHolidaysSelected}
                  getHolidayTooltip={getHolidayTooltip}
                  totalDays={totalDays}
                />

                <section className={calcSectionBoxCls}>
                  <h2 className={calcSectionTitleCls}>Hafta günü dışlama</h2>
                  <p className={calcHelperTextCls}>
                    İşaretlenen hafta günlerine denk gelen resmi tatiller UBGT hesabına dahil edilmez.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {WEEKDAYS.map((day) => (
                      <label key={day.index} className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={excludedWeekdays.includes(day.index)}
                          onChange={(e) => handleWeekdayExclude(day.index, e.target.checked)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </section>

                {backendExcludedList.length > 0 && (
                  <section className={`${calcSectionBoxCls} border-amber-200/80 dark:border-amber-800/50`}>
                    <h2 className={calcSectionTitleCls}>Hafta tatili nedeniyle dışlanan tatiller</h2>
                    <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-40 overflow-y-auto">
                      {backendExcludedList.map((item) => (
                        <li key={item.date}>
                          {item.date} — {item.name} ({item.duration} gün)
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <UbgtExcludeDays
                  ubgtExcludedDays={ubgtExcludedDays}
                  onUbgtExcludedDaysChange={setUbgtExcludedDays}
                  onImport={() => handleCalculate(true)}
                />

                <UbgtExclusionCompactUI
                  dateRanges={dateRangesForNetAndExclusion}
                  ubgtDayEntries={ubgtDayEntriesList}
                  ubgtExclusionRules={ubgtExclusionRules}
                  setUbgtExclusionRules={setUbgtExclusionRules}
                />

                <section className={calcSectionBoxCls}>
                  <div className="flex flex-wrap justify-between gap-2 items-start">
                    <div>
                      <h2 className={calcSectionTitleCls}>UBGT hesaplama tablosu</h2>
                      <p className={calcHelperTextCls}>
                        Cetvel, tanık beyanlarına göre oluşur; katsayı ve ücret düzenlemesi standart UBGT ile aynıdır.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <UbgtExpiryBox
                        ubgtExpiryStart={ubgtExpiryStart}
                        onUbgtExpiryStartChange={setUbgtExpiryStart}
                        onUbgtExpiryCancel={handleUbgtExpiryCancel}
                        iseGiris={firstDavaciStart || undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKatsayiModal(true)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border ${
                          hasCustomKatsayi
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {hasCustomKatsayi ? "Katsayı" : "Kat sayı hesapla"}
                      </button>
                      {hasCustomKatsayi && (
                        <button type="button" onClick={handleResetKatsayi} className="text-xs text-gray-600 hover:text-red-600">
                          Kaldır
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    {ubgtExpiryStart && ubgtRows.length > 0 && (
                      <div className="mb-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                        Zamanaşımı: {format(new Date(ubgtExpiryStart), "dd.MM.yyyy")}
                      </div>
                    )}
                    {ubgtRows.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-xs text-gray-900 dark:text-gray-100" style={{ border: "1px solid #d2d2d2" }}>
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800">
                              {["Dönem", "Kişi(ler)", "Ücret (BRÜT)", "Katsayı", "Günlük brüt", "UBGT gün", "UBGT ücreti", ""].map(
                                (h, i) => (
                                  <th
                                    key={h || i}
                                    className="text-left font-semibold text-gray-900 dark:text-gray-100 px-1.5 py-1 border border-gray-300 dark:border-gray-600"
                                  >
                                    {h}
                                  </th>
                                )
                              )}
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
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600">
                                  {row.manual ? (
                                    <div className="flex gap-1 items-center flex-wrap">
                                      <input
                                        type="date"
                                        value={row.startISO || ""}
                                        onChange={(e) => {
                                          const newStart = e.target.value;
                                          setUbgtRows((prev) =>
                                            prev.map((r, i) => {
                                              if (i !== index) return r;
                                              const endISO = r.endISO || "";
                                              const p =
                                                newStart && endISO
                                                  ? `${new Date(newStart).toLocaleDateString("tr-TR")}-${new Date(
                                                      endISO
                                                    ).toLocaleDateString("tr-TR")}`
                                                  : r.period;
                                              let d = r.ubgtDays;
                                              if (newStart && endISO) {
                                                d = getUbgtDaysForPeriod(newStart, endISO, allHolidayIdsForManual, ubgtExcludedDays);
                                              }
                                              return recalcRow({
                                                ...r,
                                                startISO: newStart,
                                                period: p,
                                                ubgtDays: d,
                                              });
                                            })
                                          );
                                        }}
                                        className={`${calcTableInputCls} w-[7.5rem]`}
                                      />
                                      <span>-</span>
                                      <input
                                        type="date"
                                        value={row.endISO || ""}
                                        onChange={(e) => {
                                          const newEnd = e.target.value;
                                          setUbgtRows((prev) =>
                                            prev.map((r, i) => {
                                              if (i !== index) return r;
                                              const startISO = r.startISO || "";
                                              const p =
                                                startISO && newEnd
                                                  ? `${new Date(startISO).toLocaleDateString("tr-TR")}-${new Date(
                                                      newEnd
                                                    ).toLocaleDateString("tr-TR")}`
                                                  : r.period;
                                              let d = r.ubgtDays;
                                              if (startISO && newEnd) {
                                                d = getUbgtDaysForPeriod(startISO, newEnd, allHolidayIdsForManual, ubgtExcludedDays);
                                              }
                                              return recalcRow({ ...r, endISO: newEnd, period: p, ubgtDays: d });
                                            })
                                          );
                                        }}
                                        className={`${calcTableInputCls} w-[7.5rem]`}
                                      />
                                    </div>
                                  ) : (
                                    row.period
                                  )}
                                </td>
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                  {row.persons?.length ? row.persons.join(", ") : "—"}
                                </td>
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600 text-right">
                                  <input
                                    type="text"
                                    key={`w-${index}-${row.wage}`}
                                    defaultValue={
                                      (row.wage ?? 0).toLocaleString("tr-TR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }) + "₺"
                                    }
                                    onFocus={(e) => {
                                      const raw = (row.wage ?? 0) > 0 ? String(row.wage).replace(".", ",") : "";
                                      e.target.value = raw;
                                    }}
                                    onBlur={(e) => {
                                      handleWageChange(index, e.target.value);
                                      const wage = row.wage ?? 0;
                                      e.target.value = wage.toLocaleString("tr-TR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }) + "₺";
                                    }}
                                    className={`${calcTableInputCls} border-transparent`}
                                  />
                                </td>
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600 text-center">
                                  {Number((row.coefficient ?? 1).toFixed(4)).toLocaleString("tr-TR", {
                                    minimumFractionDigits: 4,
                                    maximumFractionDigits: 4,
                                  })}
                                </td>
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600 text-right">
                                  {(row.dailyWage ?? 0).toLocaleString("tr-TR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                  ₺
                                </td>
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600 text-right">
                                  {row.manual ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.ubgtDays != null ? String(row.ubgtDays) : ""}
                                      onChange={(e) => {
                                        const newDays = e.target.value === "" ? 0 : Number(e.target.value) || 0;
                                        setUbgtRows((prev) =>
                                          prev.map((r, i) =>
                                            i === index ? recalcRow({ ...r, ubgtDays: newDays }) : r
                                          )
                                        );
                                      }}
                                      className={`${calcTableInputCls} w-16`}
                                    />
                                  ) : (
                                    <>{(row.ubgtDays ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} gün</>
                                  )}
                                </td>
                                <td className="px-1.5 py-1 border border-gray-300 dark:border-gray-600 text-right font-medium">
                                  {(row.ubgtTotal ?? 0).toLocaleString("tr-TR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                  ₺
                                </td>
                                <td className="border-0 w-12 p-0">
                                  {hoveredRow === index && (
                                    <div className="flex gap-1 justify-center">
                                      <button
                                        type="button"
                                        className="text-orange-500 text-sm"
                                        onClick={() => duplicateRow(index)}
                                        title="Satır ekle"
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        className="text-red-500 text-sm disabled:opacity-30"
                                        disabled={ubgtRows.length <= 1}
                                        onClick={() => deleteRow(index)}
                                        title="Sil"
                                      >
                                        −
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                              <td colSpan={6} className="text-right px-1.5 py-1 border border-gray-300 dark:border-gray-600">
                                Toplam UBGT ücreti
                              </td>
                              <td className="text-right px-1.5 py-1 border border-gray-300 dark:border-gray-600">
                                {ubgtTotalBrutFromRows.toLocaleString("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                ₺
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
                        Davacı ve tanık tarihlerini girin; cetvel otomatik oluşur.
                      </p>
                    )}
                  </div>
                </section>

                <UbgtNetConversion
                  ubgtBrutTotal={ubgtTotalBrutFromRows}
                  tableData={ubgtRows}
                  dateRanges={dateRangesForNetAndExclusion}
                  initialMahsuplasamaData={ubgtMahsuplasamaData}
                  onSummaryChange={setUbgtNetSummary}
                  onMahsuplasamaDataChange={setUbgtMahsuplasamaData}
                />

                <section className={calcSectionBoxCls}>
                  <h2 className={calcSectionTitleCls}>Not</h2>
                  <p className={calcHelperTextCls}>
                    Bilirkişi modunda talep, tanık beyanı ile çakışan dönemlerle sınırlıdır; tatil seçimi davacıda belirlenen üst
                    küme içinde tanık bazında yapılır.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="ubgt-bilirkisi-print-wrapper"
        style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }}
        aria-hidden
      >
        <ReportContentFromConfig config={ubgtReportConfig} />
      </div>

      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <FooterActions
        onCalculate={handleCalculate}
        replacePrintWith={{ label: "Yeni hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel={isSaving ? "Kaydediliyor..." : effectiveId ? "Güncelle" : "Kaydet"}
        previewButton={{
          title: "Bilirkişi UBGT raporu",
          copyTargetId: "ubgt-bilirkisi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                #ubgt-bilirkisi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ubgt-bilirkisi-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="ubgt-bilirkisi-word-copy">
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
          onPdf: () => downloadPdfFromDOM("Bilirkişi UBGT Rapor", "report-content"),
        }}
      />
    </>
  );
}
