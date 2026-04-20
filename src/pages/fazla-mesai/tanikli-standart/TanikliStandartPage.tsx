/**
 * Tanıklı Standart Fazla Mesai - Davacı + Tanık beyanlarına göre hesaplama
 * Standart sayfa ile tutarlı yapı
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, isoToTR } from "@/utils/dateUtils";
import {
  segmentOvertimeResult,
  computeDisplayRows,
  calculateOvertimeWith270AndLimitation,
  getAsgariUcretByDate,
  calculateWeeksBetweenDates,
  clampToLastDayOfMonth,
  generateDynamicIntervalsFromWitnesses,
  calculateOvertimeHours,
  buildWordTable,
  adaptToWordTable,
  copySectionForWord,
  buildMergedWitnessSegments,
  type FazlaMesaiRowBase,
} from "@modules/fazla-mesai/shared";
import { YillikIzinPanel } from "../standart/YillikIzinPanel";
import { UbgtFmDayPicker } from "../standart/UbgtFmDayPicker";
import { ZamanasimiModal } from "../standart/ZamanasimiModal";
import { ZamanasimiCetvelBanner } from "../standart/ZamanasimiCetvelBanner";
import { KatsayiModal } from "../standart/KatsayiModal";
import { MahsuplasamaModal } from "../standart/MahsuplasamaModal";
import { NotlarAccordion } from "../standart/NotlarAccordion";
import { Copy, Plus, Trash2 } from "lucide-react";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { calculateDailyWorkHours, computeBreakHours } from "../standart/utils";
import { useTanikliStandartState } from "./state";
import type { Witness } from "./contract";
import { fmt, fmtCurrency } from "../standart/calculations";
import { FAZLA_MESAI_DENOMINATOR, FAZLA_MESAI_KATSAYI, WEEKLY_WORK_LIMIT, STANDARD_DAILY_REFERENCE_HOURS } from "../standart/constants";
import { ceilWeeklyWorkHoursToHalfHour } from "@/shared/utils/fazlaMesai/weeklyHoursRounding";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import { expandTanikliStandartRowsAnnualLeaveV2 } from "./tanikliStandartAnnualLeaveV2";

const PAGE_TITLE = "Tanıklı Standart Fazla Mesai Hesaplama";
const RECORD_TYPE = "tanikli_standart_fazla_mesai";
const REDIRECT_BASE_PATH = "/fazla-mesai/tanikli-standart";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

/** Seçenek A: FM / metin için; boşsa davacı haftası. Yıllık izin yine davacı weeklyDays ile. */
function resolveWitnessWeeklyDays(t: Witness, davaciHg: number): number {
  const raw = t.weeklyDays;
  if (raw === "" || raw == null) return davaciHg;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? Math.floor(n) : davaciHg;
}

function resolveWitnessSevenDayMode(t: Witness): "tatilsiz" | "tatilli" {
  return t.sevenDayMode === "tatilli" ? "tatilli" : "tatilsiz";
}

export default function TanikliStandartPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const {
    formValues,
    setFormValues,
    rowOverrides,
    setRowOverrides,
    manualRows,
    setManualRows,
    exclusions,
    setExclusions,
    currentRecordName,
    setCurrentRecordName,
    addWitness,
    removeWitness,
    updateWitness,
  } = useTanikliStandartState();

  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 7 gün seçiliyken Hafta Tatilsiz / Hafta Tatilli */
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");

  const { iseGiris, istenCikis, weeklyDays, haftaTatiliGunu, davaci, taniklar, mode270, katSayi, mahsuplasmaMiktari } = formValues;

  useEffect(() => {
    setLocalIseGiris(iseGiris || "");
    setLocalIstenCikis(istenCikis || "");
  }, [iseGiris, istenCikis]);

  useEffect(() => () => {
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
  }, []);

  useEffect(() => {
    if (!effectiveId) return;
    let mounted = true;
    yukleHesap(effectiveId, RECORD_TYPE)
      .then((res) => {
        if (!mounted) return;
        if (!res.success) {
          showToastError(res.error || "Kayıt yüklenemedi");
          return;
        }
        if (!res.data) return;
        const raw = res.data.form || res.data.formValues || res.data;
        setFormValues((p) => ({
          ...p,
          ...(raw.iseGiris != null && { iseGiris: raw.iseGiris }),
          ...(raw.istenCikis != null && { istenCikis: raw.istenCikis }),
          ...(raw.weeklyDays != null && { weeklyDays: String(raw.weeklyDays) }),
          ...(raw.haftaTatiliGunu != null && { haftaTatiliGunu: raw.haftaTatiliGunu === "" ? "" : Number(raw.haftaTatiliGunu) }),
          ...(raw.davaci && { davaci: { ...p.davaci, ...raw.davaci } }),
          ...(Array.isArray(raw.taniklar) &&
            raw.taniklar.length > 0 && {
              taniklar: (raw.taniklar as Record<string, unknown>[]).map((t, i) => ({
                id: typeof t.id === "string" ? t.id : `tanik-load-${i}-${Date.now()}`,
                name: (t.name as string) ?? "",
                dateIn: (t.dateIn as string) ?? "",
                dateOut: (t.dateOut as string) ?? "",
                in: (t.in as string) ?? "",
                out: (t.out as string) ?? "",
                weeklyDays:
                  t.weeklyDays != null && String(t.weeklyDays).trim() !== ""
                    ? String(t.weeklyDays)
                    : "",
                sevenDayMode: t.sevenDayMode === "tatilli" ? "tatilli" : "tatilsiz",
              })),
            }),
          ...(raw.mode270 && { mode270: raw.mode270 }),
          ...(raw.katSayi != null && { katSayi: raw.katSayi }),
          ...(raw.mahsuplasmaMiktari != null && { mahsuplasmaMiktari: raw.mahsuplasmaMiktari }),
          ...(Array.isArray(raw.exclusions) && { exclusions: raw.exclusions }),
          ...(raw.zamanasimi != null && { zamanasimi: raw.zamanasimi }),
        }));
        if (Array.isArray(raw.manualRows)) setManualRows(raw.manualRows);
        if (raw.rowOverrides && typeof raw.rowOverrides === "object") setRowOverrides(raw.rowOverrides);
        if (res.name) setCurrentRecordName(res.name);
        success("Kayıt yüklendi");
      })
      .catch((err) => {
        if (mounted) showToastError(err.message || "Kayıt yüklenemedi");
      });
    return () => { mounted = false; };
  }, [effectiveId, success, showToastError]);

  const debouncedSetDate = useCallback(
    (field: "iseGiris" | "istenCikis", value: string) => {
      if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
      dateDebounceRef.current = setTimeout(() => {
        setFormValues((p) => ({
          ...p,
          [field]: value,
          davaci: {
            ...p.davaci,
            dateIn: field === "iseGiris" ? value : p.davaci.dateIn,
            dateOut: field === "istenCikis" ? value : p.davaci.dateOut,
          },
        }));
        dateDebounceRef.current = null;
      }, 350);
    },
    [setFormValues]
  );

  const diff = useMemo(() => calcWorkPeriodBilirKisi(iseGiris, istenCikis), [iseGiris, istenCikis]);
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;

  const splitWitnesses = useMemo(() => {
    const valid = taniklar.filter((t) => t.dateIn && t.dateOut && t.in && t.out);
    if (valid.length === 0) return [];
    const sorted = [...valid].sort((a, b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime());
    const out: Array<{ dateIn: string; dateOut: string; in: string; out: string }> = [];
    sorted.forEach((witness, idx) => {
      const wStart = new Date(witness.dateIn);
      const wEnd = new Date(witness.dateOut);
      const overlapping = sorted.filter((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const oStart = new Date(other.dateIn);
        // Sonraki tanık bu tanığın içinde başlıyorsa → overlap
        // VEYA aynı başlangıç tarihinde ama dizide daha sonra geliyorsa → bu tanık "geçersiz" sayılır
        return (oStart > wStart && oStart < wEnd) ||
               (oStart.getTime() === wStart.getTime() && otherIdx > idx);
      });
      if (overlapping.length === 0) {
        out.push({ dateIn: witness.dateIn, dateOut: witness.dateOut, in: witness.in, out: witness.out });
        return;
      }
      let currentStart = wStart;
      const sortedOverlaps = overlapping.sort((a, b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime());
      sortedOverlaps.forEach((overlap) => {
        const overlapStart = new Date(overlap.dateIn);
        const overlapEnd = new Date(overlap.dateOut);
        // Bu overlap currentStart'ın gerisinde bitmişse tamamen atla — currentStart'ı geri alma
        if (overlapEnd.getTime() < currentStart.getTime()) return;
        if (currentStart < overlapStart) {
          const segmentEnd = new Date(overlapStart);
          segmentEnd.setDate(segmentEnd.getDate() - 1);
          if (segmentEnd >= currentStart) {
            out.push({
              dateIn: currentStart.toISOString().slice(0, 10),
              dateOut: segmentEnd.toISOString().slice(0, 10),
              in: witness.in,
              out: witness.out,
            });
          }
        }
        const nextStart = new Date(overlapEnd);
        nextStart.setDate(nextStart.getDate() + 1);
        currentStart = nextStart;
      });
      if (currentStart <= wEnd) {
        out.push({
          dateIn: currentStart.toISOString().slice(0, 10),
          dateOut: wEnd.toISOString().slice(0, 10),
          in: witness.in,
          out: witness.out,
        });
      }
    });
    return out;
  }, [taniklar]);

  const fmTextData = useMemo(() => {
    const davaciDateIn = iseGiris || davaci?.dateIn || "";
    const davaciDateOut = istenCikis || davaci?.dateOut || "";
    if (!davaciDateIn || !davaciDateOut || !davaci?.in || !davaci?.out) return { results: [] };
    if (splitWitnesses.length === 0) return { results: [] };

    const davaciForInterval = {
      startDate: davaciDateIn,
      endDate: davaciDateOut,
      startTime: davaci.in,
      endTime: davaci.out,
      haftalikGunSayisi: Number(weeklyDays) || 6,
    };
    const hg = Number(weeklyDays) || 6;
    const sevenDayMode = hg === 7 ? activeTab : undefined;
    const intervals = generateDynamicIntervalsFromWitnesses(davaciForInterval, splitWitnesses);
    if (!intervals?.length) return { results: [] };
    return calculateOvertimeHours(intervals, { sevenDayMode });
  }, [iseGiris, istenCikis, davaci, splitWitnesses, weeklyDays, activeTab]);

  /** Eski yapı: DAVACI + her TANIK için ayrı kart (tanık ismi ile) */
  const fmPeriods = useMemo(() => {
    const result: Array<{ label: string; text: string; fmHours: number }> = [];
    const fmtH = (n: number) => String(n ?? 0).replace(".", ",");
    const davaciDateIn = iseGiris || davaci?.dateIn || "";
    const davaciDateOut = istenCikis || davaci?.dateOut || "";
    const inT = davaci?.in || "";
    const outT = davaci?.out || "";

    if (!inT || !outT) {
      if (davaciDateIn || davaciDateOut) {
        return [{ label: "Davacı", text: "Davacı tarih bilgisi girildi. Hesaplama için giriş ve çıkış saatlerini giriniz.", fmHours: 0 }];
      }
      return [{ label: "Davacı", text: "Davacı için tarih ve saat bilgilerini giriniz.", fmHours: 0 }];
    }

    const brut = calculateDailyWorkHours(inT, outT);
    const brk = computeBreakHours(brut);
    const netGunluk = Math.max(0, brut - brk);
    const hg = Number(weeklyDays) || 6;

    let davaciText: string;
    let davaciWeeklyFM: number;
    if (hg === 7 && activeTab === "tatilli") {
      const weeklyNormal = 6 * netGunluk;
      const extraHT = Math.max(0, netGunluk - STANDARD_DAILY_REFERENCE_HOURS);
      const toplamCalisma = weeklyNormal + extraHT;
      const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(toplamCalisma);
      davaciWeeklyFM = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
      davaciText =
        `DAVACI:\n` +
        `${inT} - ${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme\n` +
        `= ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `6 x ${fmtH(netGunluk)} = ${fmtH(weeklyNormal)} saat çalışma\n` +
        `${fmtH(netGunluk)} - 7,5 = ${fmtH(extraHT)} saat hafta tatili fazla çalışma\n` +
        `= ${fmtH(toplamCalisma)} saat haftalık çalışma\n` +
        `- 45 saat haftalık çalışma saati\n` +
        `= ${fmt(davaciWeeklyFM)} saat haftalık fazla mesai`;
    } else if (hg === 7 && activeTab === "tatilsiz") {
      const weeklyTotal = netGunluk * 7;
      const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyTotal);
      davaciWeeklyFM = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
      davaciText =
        `DAVACI:\n` +
        `${inT} - ${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme\n` +
        `= ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `7 x ${fmtH(netGunluk)} = ${fmtH(weeklyTotal)} saat çalışma\n` +
        `= ${fmt(roundedWeekly)} saat haftalık çalışma\n` +
        `- 45 saat haftalık çalışma saati\n` +
        `= ${fmt(davaciWeeklyFM)} saat haftalık fazla mesai`;
    } else {
      const weeklyTotal = netGunluk * hg;
      const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyTotal);
      davaciWeeklyFM = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
      davaciText =
        `DAVACI:\n` +
        `${inT} - ${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme\n` +
        `= ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `${hg} x ${fmtH(netGunluk)} = ${fmtH(weeklyTotal)} saat çalışma\n` +
        `= ${fmt(roundedWeekly)} saat haftalık çalışma\n` +
        `- 45 saat haftalık çalışma saati\n` +
        `= ${fmt(davaciWeeklyFM)} saat haftalık fazla mesai`;
    }
    result.push({ label: "Davacı", text: davaciText, fmHours: davaciWeeklyFM });

    const [dGirH, dGirM] = inT.split(":").map(Number);
    const [dCikH, dCikM] = outT.split(":").map(Number);
    const dGirMinutes = dGirH * 60 + dGirM;
    const dCikMinutes = dCikH * 60 + dCikM;

    taniklar.forEach((tanik, idx) => {
      if (!tanik.dateIn || !tanik.dateOut || !tanik.in || !tanik.out) return;
      const [tGirH, tGirM] = tanik.in.split(":").map(Number);
      const [tCikH, tCikM] = tanik.out.split(":").map(Number);
      let tGirMinutes = tGirH * 60 + tGirM;
      let tCikMinutes = tCikH * 60 + tCikM;
      tGirMinutes = Math.max(tGirMinutes, dGirMinutes);
      tCikMinutes = Math.min(tCikMinutes, dCikMinutes);
      const tDailyBrut = Math.max(0, (tCikMinutes - tGirMinutes) / 60);
      const tBrk = computeBreakHours(tDailyBrut);
      const tDailyNet = Math.max(0, tDailyBrut - tBrk);
      const kesikGir = `${String(Math.floor(tGirMinutes / 60)).padStart(2, "0")}:${String(tGirMinutes % 60).padStart(2, "0")}`;
      const kesikCik = `${String(Math.floor(tCikMinutes / 60)).padStart(2, "0")}:${String(tCikMinutes % 60).padStart(2, "0")}`;

      const tanikName = (tanik.name?.trim() || `TANIK ${idx + 1}`).toUpperCase();
      const tWorkDays = resolveWitnessWeeklyDays(tanik, hg);
      const tSeven = resolveWitnessSevenDayMode(tanik);

      let tanikText: string;
      let tWeeklyFM: number;
      if (tWorkDays === 7 && tSeven === "tatilli") {
        const weeklyNormal = 6 * tDailyNet;
        const holidayOvertime = Math.max(0, tDailyNet - STANDARD_DAILY_REFERENCE_HOURS);
        const weeklyTotal = weeklyNormal + holidayOvertime;
        const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyTotal);
        tWeeklyFM = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
        tanikText =
          `${tanikName}:\n` +
          `${kesikGir} - ${kesikCik} = ${fmtH(tDailyBrut)} saat çalışma\n` +
          `- ${fmtH(tBrk)} saat ara dinlenme\n` +
          `= ${fmtH(tDailyNet)} saat günlük çalışma\n` +
          `6 x ${fmtH(tDailyNet)} = ${fmtH(weeklyNormal)} saat çalışma\n` +
          `${fmtH(tDailyNet)} - 7,5 = ${fmtH(holidayOvertime)} saat hafta tatili fazla çalışma\n` +
          `= ${fmtH(weeklyTotal)} saat çalışma\n` +
          `Net haftalık çalışma = ${fmt(roundedWeekly)} saat,\n` +
          `${fmt(roundedWeekly)} – 45 saat yasal haftalık çalışma = ${fmt(tWeeklyFM)} saat haftalık fazla mesai`;
      } else {
        const tWeeklyTotal = tDailyNet * tWorkDays;
        const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(tWeeklyTotal);
        tWeeklyFM = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
        tanikText =
          `${tanikName}:\n` +
          `${kesikGir} - ${kesikCik} = ${fmtH(tDailyBrut)} saat çalışma\n` +
          `- ${fmtH(tBrk)} saat ara dinlenme\n` +
          `= ${fmtH(tDailyNet)} saat günlük çalışma\n` +
          `${tWorkDays} x ${fmtH(tDailyNet)} = ${fmtH(tWeeklyTotal)} saat çalışma\n` +
          `Net haftalık çalışma = ${fmt(roundedWeekly)} saat,\n` +
          `${fmt(roundedWeekly)} – 45 saat yasal haftalık çalışma = ${fmt(tWeeklyFM)} saat haftalık fazla mesai`;
      }
      result.push({ label: tanikName, text: tanikText, fmHours: tWeeklyFM });
    });

    return result;
  }, [iseGiris, istenCikis, davaci, taniklar, weeklyDays, activeTab]);

  const rows = useMemo(() => {
    const davaciDateIn = iseGiris || davaci?.dateIn || "";
    const davaciDateOut = istenCikis || davaci?.dateOut || "";
    if (!davaciDateIn || !davaciDateOut || !davaci?.in || !davaci?.out) return [];
    if (taniklar.length === 0) return [];

    const hg = Number(weeklyDays) || 6;
    const [dGirH, dGirM] = (davaci.in || "0:0").split(":").map(Number);
    const [dCikH, dCikM] = (davaci.out || "0:0").split(":").map(Number);
    const dGirMinutes = dGirH * 60 + dGirM;
    const dCikMinutes = dCikH * 60 + dCikM;

    // Adım 1: Her tanık için davacı saatiyle sınırlı FM saatini hesapla
    const tanikFMData = taniklar
      .filter((t) => t.dateIn && t.dateOut && t.in && t.out)
      .map((t) => {
        const tHg = resolveWitnessWeeklyDays(t, hg);
        const tSeven = resolveWitnessSevenDayMode(t);
        const [tGirH, tGirM] = t.in.split(":").map(Number);
        const [tCikH, tCikM] = t.out.split(":").map(Number);
        const tGirMin = Math.max(tGirH * 60 + tGirM, dGirMinutes);
        const tCikMin = Math.min(tCikH * 60 + tCikM, dCikMinutes);
        const tDailyBrut = Math.max(0, (tCikMin - tGirMin) / 60);
        const tBrk = computeBreakHours(tDailyBrut);
        const tDailyNet = Math.max(0, tDailyBrut - tBrk);
        let tWeeklyFM: number;
        if (tHg === 7 && tSeven === "tatilli") {
          const weeklyNormal = 6 * tDailyNet;
          const holidayOvertime = Math.max(0, tDailyNet - STANDARD_DAILY_REFERENCE_HOURS);
          tWeeklyFM = Math.max(
            0,
            ceilWeeklyWorkHoursToHalfHour(weeklyNormal + holidayOvertime) - WEEKLY_WORK_LIMIT
          );
        } else {
          tWeeklyFM = Math.max(0, ceilWeeklyWorkHoursToHalfHour(tDailyNet * tHg) - WEEKLY_WORK_LIMIT);
        }
        return {
          tanik: t,
          fmHours: tWeeklyFM,
          dailyNet: tDailyNet,
          startMs: new Date(t.dateIn).getTime(),
          endMs: new Date(t.dateOut).getTime(),
          annualLeaveHg: tHg,
          annualLeaveSevenDay: tSeven,
        };
      });

    if (tanikFMData.length === 0) return [];

    const mergedSegments = buildMergedWitnessSegments(davaciDateIn, davaciDateOut, tanikFMData);

    // Adım 4: Asgari ücret dönemlerine bölerek tablo satırları oluştur
    const tableRows: Array<Record<string, unknown> & FazlaMesaiRowBase> = [];
    const kats = katSayi || 1;

    mergedSegments.forEach((seg, segIdx) => {
      const periods = segmentOvertimeResult({ start: seg.start, end: seg.end });

      periods.forEach((period, periodIdx) => {
        let startDate = new Date(period.start);
        const endDate = new Date(period.end);

        if (zamanasimiBaslangic) {
          const limitDate = new Date(zamanasimiBaslangic);
          if (endDate < limitDate) return;
          if (startDate < limitDate && endDate >= limitDate) {
            startDate = new Date(limitDate);
            period.start = startDate.toISOString().slice(0, 10);
          }
        }

        const weeks = calculateWeeksBetweenDates(period.start, period.end) || 1;
        const brut = getAsgariUcretByDate(period.start) || 0;
        const fm = Number(
          ((brut * kats * weeks * seg.fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI
        ).toFixed(2);
        const net = Number((Number(fm) * (1 - DAMGA_VERGISI_ORANI - 0.15)).toFixed(2));

        tableRows.push({
          id: `auto-${period.start}-${period.end}-${segIdx}-${periodIdx}`,
          startISO: period.start,
          endISO: period.end,
          rangeLabel: `${period.start} – ${period.end}`,
          weeks,
          originalWeekCount: weeks,
          brut,
          katsayi: kats,
          fmHours: seg.fmHours,
          dailyNet: seg.dailyNet,
          annualLeaveHg: seg.annualLeaveHg,
          annualLeaveSevenDay: seg.annualLeaveSevenDay,
          fm,
          net,
          wage: brut,
          overtimeAmount: fm,
        });
      });
    });

    if (exclusions.length > 0) {
      const weeklyOffDayNum =
        haftaTatiliGunu === "" || haftaTatiliGunu == null ? null : Number(haftaTatiliGunu);
      return expandTanikliStandartRowsAnnualLeaveV2(
        tableRows as FazlaMesaiRowBase[],
        exclusions,
        Number(weeklyDays) || 6,
        Number.isInteger(weeklyOffDayNum) ? weeklyOffDayNum : null,
        activeTab
      );
    }

    return tableRows;
  }, [
    iseGiris,
    istenCikis,
    davaci,
    taniklar,
    weeklyDays,
    activeTab,
    katSayi,
    zamanasimiBaslangic,
    exclusions,
    haftaTatiliGunu,
  ]);

  /** UBGT kataloğu: davacı/tanık ham tarihleri değil, cetveldeki satırların birleşik aralığı. */
  const ubgtFmCatalogRange = useMemo(() => {
    let start = "";
    let end = "";
    const consider = (r: FazlaMesaiRowBase) => {
      const s = (r.startISO || "").slice(0, 10);
      const e = (r.endISO || "").slice(0, 10);
      if (!s || !e) return;
      if (!start || s < start) start = s;
      if (!end || e > end) end = e;
    };
    (rows as FazlaMesaiRowBase[]).forEach(consider);
    (manualRows as FazlaMesaiRowBase[]).forEach(consider);
    if (!start || !end || start > end) return { start: "", end: "" };
    return { start, end };
  }, [rows, manualRows]);

  const weeklyFMSaatFallback = useMemo(() => {
    if (rows.length > 0 && rows[0].fmHours != null) return rows[0].fmHours;
    return 0;
  }, [rows]);

  const computedDisplayRows = useMemo(() => {
    try {
      return computeDisplayRows({
        rows: rows as FazlaMesaiRowBase[],
        manualRows: manualRows as FazlaMesaiRowBase[],
        rowOverrides: rowOverrides as Record<string, Partial<FazlaMesaiRowBase>>,
        katSayi: katSayi || 1,
        weeklyFMSaat: weeklyFMSaatFallback,
        exclusions,
        skipAnnualLeaveExclusions: exclusions.length > 0,
        mode270,
        iseGiris,
        istenCikis,
        zamanasimiBaslangic,
        calculateOvertime270Detailed: calculateOvertimeWith270AndLimitation,
      }) as Array<{ fm: number; net: number }>;
    } catch {
      return rows;
    }
  }, [
    rows,
    manualRows,
    rowOverrides,
    katSayi,
    weeklyFMSaatFallback,
    exclusions,
    weeklyDays,
    mode270,
    iseGiris,
    istenCikis,
    zamanasimiBaslangic,
  ]);

  /** FM saati 0 olan satırlar cetvelde gösterilmez; toplamlar buna göre. */
  const tableDisplayRows = useMemo(
    () => (computedDisplayRows as Array<{ fmHours?: number; fm?: number }>).filter((r) => Number(r.fmHours ?? 0) !== 0),
    [computedDisplayRows]
  );

  const totalBrut = useMemo(
    () => tableDisplayRows.reduce((a, r) => a + (r.fm ?? 0), 0),
    [tableDisplayRows]
  );
  const exitYear = istenCikis ? new Date(istenCikis).getFullYear() : new Date().getFullYear();
  const brutNetResult = useMemo(() => {
    if (totalBrut <= 0) return { gelirVergisi: 0, damgaVergisi: 0, netYillik: 0, gelirVergisiDilimleri: "" };
    const sgk = Math.round(totalBrut * SSK_ORAN * 100) / 100;
    const issizlik = Math.round(totalBrut * ISSIZLIK_ORAN * 100) / 100;
    const matrah = Math.max(0, totalBrut - sgk - issizlik);
    const gvResult = calculateIncomeTaxWithBrackets(exitYear, matrah);
    const gelirVergisi = Math.round(gvResult.tax * 100) / 100;
    const damgaVergisi = Math.round(totalBrut * DAMGA_VERGISI_ORANI * 100) / 100;
    const netYillik = Math.round((totalBrut - sgk - issizlik - gelirVergisi - damgaVergisi) * 100) / 100;
    return {
      gelirVergisi,
      damgaVergisi,
      netYillik,
      gelirVergisiDilimleri: gvResult.brackets,
    };
  }, [totalBrut, exitYear]);

  const mahsupNum = useMemo(() => {
    const s = String(mahsuplasmaMiktari || "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }, [mahsuplasmaMiktari]);

  const hakkaniyetIndirimi = totalBrut / 3;
  const sonNet = Math.max(0, totalBrut - hakkaniyetIndirimi - mahsupNum);
  const hasCustomKatsayi = (katSayi ?? 1) !== 1 && (katSayi ?? 1) > 0;

  const handleFormChange = useCallback(
    (updates: Partial<typeof formValues>) => {
      setFormValues((p) => {
        const next = { ...p, ...updates };
        if (updates.davaci) next.davaci = { ...p.davaci, ...updates.davaci };
        return next;
      });
    },
    [setFormValues]
  );

  const handleZamanasimiIptal = useCallback(() => {
    setFormValues((p) => ({ ...p, zamanasimi: null }));
    success("Zamanaşımı kaldırıldı.");
  }, [success, setFormValues]);

  const addRow = useCallback(
    (afterRowId?: string) => {
      setManualRows((prev) => [
        ...prev,
        {
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          startISO: "",
          endISO: "",
          rangeLabel: "",
          weeks: 0,
          originalWeekCount: 0,
          brut: 0,
          katsayi: katSayi ?? 1,
          fmHours: 0,
          fm: 0,
          net: 0,
          isManual: true,
          insertAfter: afterRowId,
        } as FazlaMesaiRowBase,
      ]);
    },
    [katSayi]
  );

  const removeRow = useCallback((rowId: string) => {
    const isManual = manualRows.some((r) => r.id === rowId);
    if (isManual) {
      setManualRows((prev) => prev.filter((r) => r.id !== rowId));
      setRowOverrides((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    } else {
      setRowOverrides((prev) => ({ ...prev, [rowId]: { ...prev[rowId], hidden: true } }));
    }
  }, [manualRows, setRowOverrides]);

  const handleRowOverride = useCallback(
    (rowId: string, updates: Partial<FazlaMesaiRowBase>) => {
      setRowOverrides((prev) => {
        const cur = prev[rowId] || {};
        const next = { ...cur, ...updates } as Partial<FazlaMesaiRowBase>;
        if (updates.startISO != null) {
          const brut = getAsgariUcretByDate(updates.startISO);
          if (brut != null) next.brut = brut;
        }
        return { ...prev, [rowId]: next };
      });
    },
    [setRowOverrides]
  );

  const handleSave = useCallback(() => {
    kaydetAc({
      hesapTuru: RECORD_TYPE,
      veri: {
        data: {
          form: formValues,
          results: {
            rows: tableDisplayRows,
            totalBrut,
            totalNet: brutNetResult.netYillik,
            weeklyFMHours: rows.length > 0 ? (rows[0].fmHours ?? 0) : 0,
          },
        },
        formValues,
        totals: { toplam: totalBrut, yil: diff.years, ay: diff.months, gun: diff.days },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        exclusions,
        mode270,
        katSayi,
        mahsuplasmaMiktari,
      },
      mevcutId: effectiveId || undefined,
      mevcutKayitAdi: currentRecordName || undefined,
      redirectPath: "/fazla-mesai/tanikli-standart/:id",
    });
  }, [
    kaydetAc,
    formValues,
    tableDisplayRows,
    rows,
    totalBrut,
    brutNetResult.netYillik,
    diff,
    exclusions,
    mode270,
    katSayi,
    mahsuplasmaMiktari,
    currentRecordName,
    effectiveId,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(REDIRECT_BASE_PATH);
  }, [effectiveId, navigate]);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const avgFm = rows.length > 0
      ? rows.reduce((a, r) => a + (r.fmHours ?? 0), 0) / rows.length
      : 0;
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi", "Haftalık FM Saat (Ort.)"],
      rows: [[isoToTR(iseGiris), isoToTR(istenCikis), diff.label, avgFm.toFixed(2)]],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });

    const cetvelHeaders = ["Dönem", "Hafta", "Ücret", "Katsayı", "FM Saat", "225", "1,5", "Fazla Mesai"];
    const cetvelRows = tableDisplayRows.map((r: any) => {
      const periodLabel =
        (r.startISO && r.endISO ? `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}` : r.rangeLabel) || "-";
      const periodWithNote = r.yillikIzinAciklama ? `${periodLabel} ${r.yillikIzinAciklama}` : periodLabel;
      return [
      periodWithNote,
      r.weeks ?? 0,
      fmt(r.brut ?? 0),
      r.katsayi ?? 1,
      (r.fmHours ?? 0).toFixed(2),
      "225",
      "1,5",
      fmt(r.fm ?? 0),
    ];
    });
    cetvelRows.push(["", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Hesaplama Cetveli",
      html: buildWordTable(n2.headers, n2.rows),
      htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }),
    });

    if (exclusions.length > 0) {
      const yillikIzinHeaders = ["Tür", "Başlangıç", "Bitiş", "Gün"];
      const yillikIzinRows = exclusions.map((ex) => [
        ex.type || "Yıllık İzin",
        formatDateTR(ex.start),
        formatDateTR(ex.end),
        ex.days ?? 0,
      ]);
      const nY = adaptToWordTable({ headers: yillikIzinHeaders, rows: yillikIzinRows });
      s.push({
        id: "yillikizin",
        title: "Yıllık İzin Düşümü",
        html: buildWordTable(nY.headers, nY.rows),
        htmlForPdf: buildStyledReportTable(nY.headers, nY.rows),
      });
    }

    const brutNetRows: { label: string; value: string }[] = [
      { label: "Brüt Fazla Mesai", value: fmtCurrency(totalBrut) },
      { label: "SGK (%14)", value: `-${fmtCurrency(totalBrut * SSK_ORAN)}` },
      { label: "İşsizlik (%1)", value: `-${fmtCurrency(totalBrut * ISSIZLIK_ORAN)}` },
      { label: `Gelir Vergisi ${brutNetResult.gelirVergisiDilimleri || ""}`, value: `-${fmtCurrency(brutNetResult.gelirVergisi)}` },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(brutNetResult.damgaVergisi)}` },
      { label: "Net Fazla Mesai", value: fmtCurrency(brutNetResult.netYillik) },
    ];
    const n3 = adaptToWordTable(brutNetRows);
    s.push({
      id: "brutnet",
      title: "Brüt'ten Net'e",
      html: buildWordTable(n3.headers, n3.rows),
      htmlForPdf: buildStyledReportTable(n3.headers, n3.rows, { lastRowBg: "green" }),
    });

    {
      const mahsupRows: { label: string; value: string }[] = [
        { label: "Toplam Fazla Mesai (Brüt)", value: fmtCurrency(totalBrut) },
        { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtCurrency(hakkaniyetIndirimi)}` },
        ...(mahsupNum > 0 ? [{ label: "Mahsuplaşma Miktarı", value: `-${fmtCurrency(mahsupNum)}` }] : []),
        { label: "Son Net Alacak", value: fmtCurrency(sonNet) },
      ];
      const n4 = adaptToWordTable(mahsupRows);
      s.push({
        id: "mahsup",
        title: "Mahsuplaşma",
        html: buildWordTable(n4.headers, n4.rows),
        htmlForPdf: buildStyledReportTable(n4.headers, n4.rows, { lastRowBg: "green" }),
      });
    }

    return s;
  }, [
    iseGiris,
    istenCikis,
    diff.label,
    rows,
    tableDisplayRows,
    totalBrut,
    brutNetResult,
    mahsupNum,
    hakkaniyetIndirimi,
    sonNet,
    exclusions,
  ]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${PAGE_TITLE}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}h2{font-size:12px;margin:8px 0 6px 0}</style></head><body>${el.outerHTML}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
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
    }
  }, []);

  const videoLink = getVideoLink("fazla-tanikli-standart");

  return (
    <div
      className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`}
      data-page="fazla-mesai-tanikli-standart"
    >
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {videoLink && (
          <div className="flex justify-end mb-4">
            <a
              href={videoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kullanım Videosu İzle
            </a>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Davacı Tarih ve Saat Bilgileri</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <div>
                  <label className={labelCls}>İşe Giriş</label>
                  <input
                    type="date"
                    value={localIseGiris}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalIseGiris(v);
                      debouncedSetDate("iseGiris", v);
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>İşten Çıkış</label>
                  <input
                    type="date"
                    value={localIstenCikis}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalIstenCikis(v);
                      debouncedSetDate("istenCikis", v);
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-normal text-gray-600 dark:text-gray-400 mb-0.5">
                    Haftada Çalışılan Gün (1-7)
                  </label>
                  <select
                    value={String(weeklyDays)}
                    onChange={(e) => handleFormChange({ weeklyDays: e.target.value })}
                    className={`${inputCls} text-xs font-normal`}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} gün
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div>
                  <label className={labelCls}>Giriş Saati</label>
                  <input
                    type="time"
                    value={davaci?.in ?? ""}
                    onChange={(e) => handleFormChange({ davaci: { ...davaci, in: e.target.value } })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Çıkış Saati</label>
                  <input
                    type="time"
                    value={davaci?.out ?? ""}
                    onChange={(e) => handleFormChange({ davaci: { ...davaci, out: e.target.value } })}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-start-3">
                  <label className="block text-[11px] font-normal text-gray-600 dark:text-gray-400 mb-0.5">
                    Hafta Tatili Günü (opsiyonel)
                  </label>
                  <select
                    value={haftaTatiliGunu === "" || haftaTatiliGunu == null ? "" : String(haftaTatiliGunu)}
                    onChange={(e) =>
                      handleFormChange({
                        haftaTatiliGunu: e.target.value === "" ? "" : Number(e.target.value),
                      })}
                    className={`${inputCls} text-xs font-normal`}
                  >
                    <option value="">Seçilmedi (tüm günlerde izin düş)</option>
                    <option value="1">Pazartesi</option>
                    <option value="2">Salı</option>
                    <option value="3">Çarşamba</option>
                    <option value="4">Perşembe</option>
                    <option value="5">Cuma</option>
                    <option value="6">Cumartesi</option>
                    <option value="0">Pazar</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className={sectionTitleCls}>Tanık Beyanları</h2>
                <button
                  type="button"
                  onClick={addWitness}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                >
                  <Plus className="w-4 h-4" />
                  Tanık Ekle
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Davacı ile tanık aralıklarının kesişiminde fazla mesai hesaplanır. Her tanık için tarih ve saat girin. Tanığın haftalık çalışma günü yalnızca FM ve metin hesabına
                etki eder; yıllık izin düşümü davacının haftalık gün sayısına göredir.
              </p>
              <div className="space-y-3">
                {taniklar.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <div className="w-full sm:w-40">
                      <label className={labelCls}>İsim</label>
                      <input
                        type="text"
                        value={t.name ?? ""}
                        onChange={(e) => updateWitness(t.id, { name: e.target.value })}
                        placeholder={`Tanık ${idx + 1}`}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className={labelCls}>Başlangıç</label>
                      <input
                        type="date"
                        value={t.dateIn}
                        onChange={(e) => updateWitness(t.id, { dateIn: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className={labelCls}>Bitiş</label>
                      <input
                        type="date"
                        value={t.dateOut}
                        onChange={(e) => updateWitness(t.id, { dateOut: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="w-24">
                      <label className={labelCls}>Giriş</label>
                      <input
                        type="time"
                        value={t.in}
                        onChange={(e) => updateWitness(t.id, { in: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="w-24">
                      <label className={labelCls}>Çıkış</label>
                      <input
                        type="time"
                        value={t.out}
                        onChange={(e) => updateWitness(t.id, { out: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWitness(t.id)}
                      disabled={taniklar.length <= 1}
                      className="p-2 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                      title="Tanığı kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-full flex flex-wrap gap-2 items-end pt-2 mt-1 border-t border-gray-100 dark:border-gray-700/80">
                      <div className="min-w-[160px] flex-1 sm:flex-none sm:w-44">
                        <label className="block text-[11px] font-normal text-gray-600 dark:text-gray-400 mb-0.5">
                          Haftada çalışılan gün (FM)
                        </label>
                        <select
                          value={t.weeklyDays === "" || t.weeklyDays == null ? "" : String(t.weeklyDays)}
                          onChange={(e) =>
                            updateWitness(t.id, {
                              weeklyDays: e.target.value === "" ? "" : e.target.value,
                            })}
                          className={`${inputCls} text-xs font-normal`}
                        >
                          <option value="">Davacı ile aynı</option>
                          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                            <option key={d} value={d}>
                              {d} gün
                            </option>
                          ))}
                        </select>
                      </div>
                      {resolveWitnessWeeklyDays(t, Number(weeklyDays) || 6) === 7 && (
                        <div className="flex gap-1.5 items-center flex-wrap">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">7 gün:</span>
                          <button
                            type="button"
                            onClick={() => updateWitness(t.id, { sevenDayMode: "tatilsiz" })}
                            className={`px-2.5 py-1 rounded border text-[11px] font-normal ${
                              resolveWitnessSevenDayMode(t) === "tatilsiz"
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            Tatilsiz
                          </button>
                          <button
                            type="button"
                            onClick={() => updateWitness(t.id, { sevenDayMode: "tatilli" })}
                            className={`px-2.5 py-1 rounded border text-[11px] font-normal ${
                              resolveWitnessSevenDayMode(t) === "tatilli"
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            Tatilli
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <details className="group" open>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between list-none">
                  <span>Metin Hesaplaması</span>
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="p-4">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">
                    Hesaplamalar tanık kesişim dönemleri ve asgari ücret dönemlerine göre yapılmıştır
                  </p>
                  {Number(weeklyDays) === 7 && (
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab("tatilsiz")}
                        className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                          activeTab === "tatilsiz"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        Hafta Tatilsiz
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("tatilli")}
                        className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                          activeTab === "tatilli"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        Hafta Tatilli
                      </button>
                    </div>
                  )}
                  <div className="bg-[#f1f3f5] dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    {fmPeriods.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {fmPeriods.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border bg-white dark:bg-gray-800 shadow-sm text-xs leading-snug whitespace-pre-line text-gray-800 dark:text-gray-200"
                          >
                            {p.text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Giriş/çıkış saatlerini giriniz.
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShow270Dropdown((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      mode270 !== "none"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-indigo-400"
                    }`}
                  >
                    {mode270 === "none" && "270 Saat"}
                    {mode270 === "detailed" && "270 (Şirket)"}
                    {mode270 === "simple" && "270 (Yargıtay)"}
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${show270Dropdown ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {show270Dropdown && (
                    <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          handleFormChange({ mode270: "none" });
                          setShow270Dropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Kapalı
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormChange({ mode270: "detailed" });
                          setShow270Dropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Şirket Uygulaması
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormChange({ mode270: "simple" });
                          setShow270Dropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Yargıtay Uygulaması
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    zamanasimiBaslangic
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    hasCustomKatsayi ? handleFormChange({ katSayi: 1 }) : setShowKatsayiModal(true)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    hasCustomKatsayi
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {hasCustomKatsayi ? `Katsayı ${katSayi?.toFixed(2) || "1"}` : "Kat Sayı"}
                </button>
              </div>
            </section>

            <div className="space-y-3">
              <YillikIzinPanel
                exclusions={exclusions}
                setExclusions={setExclusions}
                success={success}
                showToastError={showToastError}
              />
              <UbgtFmDayPicker
                rangeStart={ubgtFmCatalogRange.start}
                rangeEnd={ubgtFmCatalogRange.end}
                exclusions={exclusions}
                setExclusions={setExclusions}
                showToastError={showToastError}
              />
            </div>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla Mesai Hesaplama Cetveli</h2>
              </div>
              <ZamanasimiCetvelBanner nihaiBaslangic={zamanasimiBaslangic} />
              <div className="overflow-x-auto">
                <table
                  className="w-full text-xs border-collapse font-sans table-fixed text-gray-900 dark:text-gray-100"
                  style={{ minWidth: "640px" }}
                >
                  <colgroup>
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="px-2 py-1.5 text-left border border-gray-200 dark:border-gray-600 font-semibold">
                        Tarih Aralığı
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        Hafta
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        Ücret
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        Kat Sayı
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        FM Saati
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        225
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        1,5
                      </th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">
                        Fazla Mesai
                      </th>
                      <th className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                    </tr>
                  </thead>
                  <tbody>
                    {computedDisplayRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-2 py-4 border border-gray-200 dark:border-gray-600 text-center text-gray-500"
                        >
                          Davacı ve en az bir tanık için tarih/saat bilgilerini girin.
                        </td>
                      </tr>
                    ) : tableDisplayRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-2 py-4 border border-gray-200 dark:border-gray-600 text-center text-gray-500"
                        >
                          FM saati 0 olan satırlar gösterilmez; görüntülenecek cetvel satırı yok.
                        </td>
                      </tr>
                    ) : (
                      tableDisplayRows.map((r: any, i: number) => (
                        <tr
                          key={r.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          onMouseEnter={() => setHoveredRow(i)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600 align-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={r.startISO ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  handleRowOverride(r.id, { startISO: raw ? clampToLastDayOfMonth(raw) : undefined });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                              <span className="text-gray-400 shrink-0">–</span>
                              <input
                                type="date"
                                value={r.endISO ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  handleRowOverride(r.id, { endISO: raw ? clampToLastDayOfMonth(raw) : undefined });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                            </div>
                            {r.yillikIzinAciklama ? (
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                                {r.yillikIzinAciklama}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.weeks ?? 0}
                              onChange={(e) =>
                                handleRowOverride(r.id, {
                                  weeks: Number.isNaN(parseInt(e.target.value, 10))
                                    ? 0
                                    : Math.max(0, parseInt(e.target.value, 10)),
                                })
                              }
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              value={r.brut ?? 0}
                              onChange={(e) =>
                                handleRowOverride(r.id, {
                                  brut: Number.isNaN(parseFloat(e.target.value))
                                    ? 0
                                    : Math.max(0, parseFloat(e.target.value.replace(",", "."))),
                                })
                              }
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">
                            {(r.katsayi ?? 1).toLocaleString("tr-TR", {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.fmHours ?? 0}
                              onChange={(e) =>
                                handleRowOverride(r.id, {
                                  fmHours: Number.isNaN(parseFloat(e.target.value.replace(",", ".")))
                                    ? 0
                                    : Math.max(0, parseFloat(e.target.value.replace(",", "."))),
                                })
                              }
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">
                            225
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">
                            1,5
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium whitespace-nowrap">
                            {fmt(r.fm ?? 0)}
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600">
                            {hoveredRow === i && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addRow(r.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 font-medium"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(r.id)}
                                  disabled={computedDisplayRows.length <= 1}
                                  className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-40 font-medium"
                                  title={computedDisplayRows.length <= 1 ? "En az 1 satır kalmalı" : "Satırı sil"}
                                >
                                  −
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                    {tableDisplayRows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600">
                          Toplam Fazla Mesai:
                        </td>
                        <td colSpan={6} className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 text-right whitespace-nowrap">
                          {fmtCurrency(totalBrut)}
                        </td>
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Brütten Nete</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-xs mt-2">
                <div className="flex justify-between py-1.5">
                  <span>Brüt Fazla Mesai</span>
                  <span>{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>SGK (%14)</span>
                  <span>-{fmtCurrency(totalBrut * SSK_ORAN)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>İşsizlik (%1)</span>
                  <span>-{fmtCurrency(totalBrut * ISSIZLIK_ORAN)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>Gelir Vergisi {brutNetResult.gelirVergisiDilimleri}</span>
                  <span>-{fmtCurrency(brutNetResult.gelirVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>Damga Vergisi (Binde 7,59)</span>
                  <span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-green-700 dark:text-green-400">
                  <span>Net Fazla Mesai</span>
                  <span>{fmtCurrency(brutNetResult.netYillik)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">
                Hakkaniyet İndirimi / Mahsuplaşma
              </h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-sm">
                <div className="flex justify-between py-1.5">
                  <span>Toplam Fazla Mesai (Brüt)</span>
                  <span className="font-medium">{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>1/3 Hakkaniyet İndirimi</span>
                  <span>-{fmtCurrency(hakkaniyetIndirimi)}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-end py-1.5">
                  <div>
                    <label className={labelCls}>Mahsuplaşma Miktarı</label>
                    <input
                      type="text"
                      value={mahsuplasmaMiktari}
                      onChange={(e) => handleFormChange({ mahsuplasmaMiktari: e.target.value })}
                      placeholder="0"
                      className={`${inputCls} max-w-[160px]`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMahsuplasamaModal(true)}
                    className="px-3 py-2 text-sm rounded border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/30 shrink-0 self-end"
                  >
                    Mahsuplaşma Ekle
                  </button>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold">
                  <span>Son Net Alacak</span>
                  <span>{fmtCurrency(sonNet)}</span>
                </div>
              </div>
            </section>

            <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div
          id="report-content"
          style={{
            fontFamily: "Inter, Arial",
            color: "#111827",
            maxWidth: "16cm",
            padding: "0 12px",
          }}
        >
          <style>{`#report-content table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content td,#report-content th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
          {wordTableSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "12px", margin: "8px 0 6px 0" }}>{sec.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: sec.html }} />
            </div>
          ))}
        </div>
      </div>

      <ZamanasimiModal
        isOpen={showZamanaModal}
        onClose={() => setShowZamanaModal(false)}
        onApply={(p) =>
          handleFormChange({
            zamanasimi: {
              davaTarihi: p.davaTarihi,
              arabuluculukBaslangic: p.arabuluculukBaslangic,
              arabuluculukBitis: p.arabuluculukBitis,
              nihaiBaslangic: p.nihaiBaslangic,
            },
          })
        }
        form={zForm}
        setForm={setZForm}
        showToastError={showToastError}
        iseGiris={iseGiris}
      />
      <KatsayiModal
        open={showKatsayiModal}
        onClose={() => setShowKatsayiModal(false)}
        onApply={(k) => handleFormChange({ katSayi: k })}
      />
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onClose={() => setShowMahsuplasamaModal(false)}
        onSave={(total) => handleFormChange({ mahsuplasmaMiktari: String(total.toFixed(2)) })}
        periodLabels={tableDisplayRows
          .map((r: { startISO?: string }) => r.startISO || "")
          .filter(Boolean)}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : (effectiveId ? "Güncelle" : "Kaydet")}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "tanikli-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`
                .report-section-copy{margin-bottom:1.25rem}
                .report-section-copy .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem}
                .report-section-copy .section-title{font-weight:600;font-size:0.75rem;color:#374151}
                .report-section-copy .copy-icon-btn{background:transparent;border:none;cursor:pointer;padding:0.25rem;border-radius:0.375rem;color:#6b7280}
                #tanikli-word-copy .section-content{border:none;overflow-x:auto;padding:0;margin:0}
                #tanikli-word-copy table{border-collapse:collapse;width:100%;font-size:0.75rem;color:#111827}
                #tanikli-word-copy [data-section="brutnet"] table,#tanikli-word-copy [data-section="mahsup"] table{table-layout:fixed}
                #tanikli-word-copy [data-section="brutnet"] td:first-child,#tanikli-word-copy [data-section="mahsup"] td:first-child{width:62%}
                #tanikli-word-copy [data-section="brutnet"] td:last-child,#tanikli-word-copy [data-section="mahsup"] td:last-child{width:38%;text-align:right}
                #tanikli-word-copy td,#tanikli-word-copy th{border:1px solid #999;padding:5px 8px;background:#fff!important;color:#111827!important}
              `}</style>
              <div id="tanikli-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button
                        type="button"
                        className="copy-icon-btn"
                        onClick={async () => {
                          const ok = await copySectionForWord(sec.id);
                          if (ok) success("Kopyalandı");
                        }}
                        title="Word'e kopyala"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content"),
        }}
      />
    </div>
  );
}
