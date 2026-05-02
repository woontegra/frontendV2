/**
 * Gemi adamı fazla mesai — tek sayfa; üstte günlük / 7-24 modu.
 * API: /api/fm/gemi | /api/fm/gemi-full-crew24
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, calculateWeeksBetweenDates, isoToTR } from "@/utils/dateUtils";
import { apiClient, apiPost } from "@/utils/apiClient";
import { buildWordTable, adaptToWordTable, copySectionForWord, clampToLastDayOfMonth } from "@modules/fazla-mesai/shared";
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
import { useTanikliStandartState } from "../tanikli-standart/state";
import type { Witness } from "../tanikli-standart/contract";
import { fmt, fmtCurrency } from "../standart/calculations";
import { calculateDailyWorkHours, computeBreakHours } from "../standart/utils";
import { STANDARD_DAILY_REFERENCE_HOURS } from "../standart/constants";
import { ceilWeeklyWorkHoursToHalfHour } from "@/shared/utils/fazlaMesai/weeklyHoursRounding";
import { expandGemiRowsAnnualLeaveUbgt, type GemiExpandSourceRow } from "./gemiAnnualLeaveUbgtExpand";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";

const REDIRECT_BASE_GUNLUK = "/fazla-mesai/gemi-adami";
const REDIRECT_BASE_724 = "/fazla-mesai/gemi-7-24";
const RECORD_GUNLUK = "fazla_mesai_gemi_gunluk";
const RECORD_724 = "fazla_mesai_gemi_7_24";
const HAFTALIK_FM_724 = 35;
const GEMI_WEEKLY_WORK_LIMIT = 48;
/** Yargıtay 270: her satır FM saatinden (tanık override ile uyum için ön yüzde de uygulanır) */
const YARGITAY_270_FM_SAAT = 5.2;
const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
const GELIR_VERGISI_BIRINCI_DILIM_ORANI = 0.15;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type GemiRow = {
  id?: string;
  isManual?: boolean;
  rangeLabel?: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmManual?: boolean;
  calc225?: number;
  factor?: number;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  text?: string;
  /** UBGT / izin hafta bölmesi (Tanıklı Standart) */
  dailyNet?: number;
  annualLeaveHg?: number;
  annualLeaveSevenDay?: "tatilli" | "tatilsiz";
  yillikIzinAciklama?: string;
};

function genGemiRowId(): string {
  return `gemi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeDateInput(iso: string): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (s.includes(".")) {
    const [g, a, y] = s.split(".");
    if (!y || !a || !g) return s;
    return `${y}-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeTimeStr(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().replace(".", ":");
  const [hs, ms] = clean.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function resolveWitnessWeeklyDaysGemi(t: Witness, davaciHg: number): number {
  const raw = t.weeklyDays;
  if (raw === "" || raw == null) return davaciHg;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? Math.floor(n) : davaciHg;
}

function resolveWitnessSevenDayModeGemi(t: Witness): "tatilsiz" | "tatilli" {
  return t.sevenDayMode === "tatilli" ? "tatilli" : "tatilsiz";
}

/** Sunucu satırları / tanık override sonrası FM ve net tutarını yeniden hesaplar */
function recalcGemiFmNet(row: GemiRow, fmHours: number, katOverride: number): Pick<GemiRow, "fm" | "net"> {
  const kats = Number.isFinite(katOverride) && katOverride > 0 ? katOverride : row.katsayi || 1;
  const step1 = Number((row.weeks * row.brut).toFixed(6));
  const step2 = Number((step1 * kats).toFixed(6));
  const step3 = Number((step2 * fmHours).toFixed(6));
  const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
  const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
  const fm = Number(step5.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_BIRINCI_DILIM_ORANI)).toFixed(2));
  return { fm, net };
}

type GemiAdamiPageProps = {
  forcedMode?: "gunluk" | "724";
};

export default function GemiAdamiPage({ forcedMode }: GemiAdamiPageProps = {}) {
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
    exclusions,
    setExclusions,
    currentRecordName,
    setCurrentRecordName,
    addWitness,
    removeWitness,
    updateWitness,
  } = useTanikliStandartState();

  const [gemiMode, setGemiMode] = useState<"gunluk" | "724">(forcedMode ?? "gunluk");
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [rows, setRows] = useState<GemiRow[]>([]);
  const [textPeriods, setTextPeriods] = useState<
    Array<{ startDate?: string; endDate?: string; text?: string; witnessTitle?: string }>
  >([]);
  const [hoveredGemiRow, setHoveredGemiRow] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [haftalikMesaiDisplay, setHaftalikMesaiDisplay] = useState(0);
  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backendRequestIdRef = useRef(0);

  const {
    iseGiris,
    istenCikis,
    weeklyDays,
    davaci,
    taniklar,
    mode270,
    katSayi,
    mahsuplasmaMiktari,
    haftaTatiliGunu,
  } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;
  const include270 = mode270 !== "none";

  const recordType = gemiMode === "724" ? RECORD_724 : RECORD_GUNLUK;
  const redirectBase = gemiMode === "724" ? REDIRECT_BASE_724 : REDIRECT_BASE_GUNLUK;
  const pageTitle =
    gemiMode === "724" ? "Gemi Adamı — 7/24 Çalışan Fazla Mesai" : "Gemi Adamı — Günlük Çalışan Fazla Mesai";
  const videoLink = getVideoLink(gemiMode === "724" ? "fazla-gemi-7-24" : "fazla-gemi");

  useEffect(() => {
    if (!forcedMode) return;
    setGemiMode(forcedMode);
  }, [forcedMode]);

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
    (async () => {
      try {
        const res = await apiClient(`/api/saved-cases/${effectiveId}`);
        if (!res.ok) {
          if (mounted) showToastError("Kayıt yüklenemedi");
          return;
        }
        const json = await res.json();
        const t = String(json.type || "").toLowerCase();
        if (!t.includes("fazla_mesai_gemi")) {
          if (mounted) showToastError("Bu kayıt gemi fazla mesai hesabına ait değil");
          return;
        }
        const mode724 = t.includes("7_24") || t.includes("7-24");
        const d = json.data || {};
        const inner = d.form || d.formValues || d;
        if (mounted) {
          if (!forcedMode && (inner.gemiMode === "gunluk" || inner.gemiMode === "724")) {
            setGemiMode(inner.gemiMode);
          } else if (!forcedMode) {
            setGemiMode(mode724 ? "724" : "gunluk");
          }
        }
        if (inner.activeTab === "tatilsiz" || inner.activeTab === "tatilli") {
          setActiveTab(inner.activeTab);
        }
        setFormValues((p) => ({
          ...p,
          ...(inner.iseGiris != null && { iseGiris: inner.iseGiris }),
          ...(inner.istenCikis != null && { istenCikis: inner.istenCikis }),
          ...(inner.weeklyDays != null && { weeklyDays: String(inner.weeklyDays) }),
          ...(inner.davaci && { davaci: { ...p.davaci, ...inner.davaci } }),
          ...(Array.isArray(inner.taniklar) && inner.taniklar.length > 0 && { taniklar: inner.taniklar }),
          ...(inner.mode270 && { mode270: inner.mode270 }),
          ...(inner.katSayi != null && { katSayi: inner.katSayi }),
          ...(inner.mahsuplasmaMiktari != null && { mahsuplasmaMiktari: inner.mahsuplasmaMiktari }),
          ...(Array.isArray(inner.exclusions) && { exclusions: inner.exclusions }),
          ...(inner.zamanasimi != null && { zamanasimi: inner.zamanasimi }),
        }));
        const loadedRows = inner.rows;
        if (Array.isArray(loadedRows) && loadedRows.length > 0) {
          setRows(
            (loadedRows as GemiRow[]).map((r) => ({
              ...r,
              id: r.id ?? genGemiRowId(),
            }))
          );
        }
        if (json.name && mounted) setCurrentRecordName(json.name);
        if (mounted) success("Kayıt yüklendi");
      } catch {
        if (mounted) showToastError("Kayıt yüklenemedi");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [effectiveId, setFormValues, setCurrentRecordName, success, showToastError]);

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

  /** UBGT kataloğu: yalnızca cetvel satırlarının birleşik aralığı (davacı/tanık beyanına göre genişletilmez). */
  const ubgtFmCatalogRange = useMemo(() => {
    let start = "";
    let end = "";
    for (const r of rows) {
      const s = (r.startISO || "").slice(0, 10);
      const e = (r.endISO || "").slice(0, 10);
      if (!s || !e) continue;
      if (!start || s < start) start = s;
      if (!end || e > end) end = e;
    }
    if (!start || !end || start > end) return { start: "", end: "" };
    return { start, end };
  }, [rows]);

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

  useEffect(() => {
    if (rows.length > 0 && rows[0].fmHours != null) {
      setHaftalikMesaiDisplay(Number(rows[0].fmHours));
    } else {
      setHaftalikMesaiDisplay(gemiMode === "724" ? HAFTALIK_FM_724 : 0);
    }
  }, [rows, gemiMode]);

  useEffect(() => {
    const dStart = normalizeDateInput(iseGiris);
    const dEnd = normalizeDateInput(istenCikis);
    if (!dStart || !dEnd) {
      setRows([]);
      setTextPeriods([]);
      return;
    }

    const t = setTimeout(() => {
      const requestId = ++backendRequestIdRef.current;
      (async () => {
        try {
          const tin = normalizeTimeStr(davaci?.in);
          const tout = normalizeTimeStr(davaci?.out);
          if (gemiMode === "gunluk" && (!tin || !tout)) {
            if (requestId === backendRequestIdRef.current) {
              setRows([]);
              setTextPeriods([]);
              setIsCalculating(false);
            }
            return;
          }

          setIsCalculating(true);
          const exclusionsForApi = Array.isArray(exclusions)
            ? exclusions
                .filter((e) => e && (e.start || e.end))
                .map((e) => {
                  const s = String(e.start ?? "").trim();
                  const eStr = String(e.end ?? "").trim();
                  return {
                    start: s.length > 10 ? s.slice(0, 10) : s,
                    end: eStr.length > 10 ? eStr.slice(0, 10) : eStr,
                    days: Number(e.days) || 0,
                  };
                })
                .filter((e) => e.start.length >= 10 && e.end.length >= 10)
            : [];

          const zNorm = zamanasimiBaslangic ? normalizeDateInput(zamanasimiBaslangic) : null;

          const davaciPayload = {
            dateIn: dStart,
            dateOut: dEnd,
            in: gemiMode === "724" ? normalizeTimeStr(davaci?.in) || "00:00" : tin!,
            out: gemiMode === "724" ? normalizeTimeStr(davaci?.out) || "00:00" : tout!,
          };

          const witnessesPayload = taniklar.map((w) => ({
            id: w.id,
            name: (w.name || "").trim(),
            dateIn: normalizeDateInput(w.dateIn) || w.dateIn,
            dateOut: normalizeDateInput(w.dateOut) || w.dateOut,
            in: normalizeTimeStr(w.in) || "00:00",
            out: normalizeTimeStr(w.out) || "00:00",
          }));

          let response: Response;
          if (gemiMode === "gunluk") {
            const payload = {
              davaci: davaciPayload,
              witnesses: witnessesPayload,
              weeklyDays: Number(weeklyDays) || 6,
              activeTab,
              exclusions: exclusionsForApi,
              katSayi: katSayi || 1,
              zamanasimiBaslangic: zNorm || null,
              include270,
              mode270,
              haftalikMesai: 0,
              iseGiris: dStart,
              istenCikis: dEnd,
            };
            response = await apiPost("/api/fm/gemi", payload);
          } else {
            const payload = {
              davaci: davaciPayload,
              witnesses: witnessesPayload,
              exclusions: exclusionsForApi,
              katSayi: katSayi || 1,
              zamanasimiBaslangic: zNorm || null,
              include270,
              mode270,
              haftalikMesai: HAFTALIK_FM_724,
              iseGiris: dStart,
              istenCikis: dEnd,
            };
            response = await apiPost("/api/fm/gemi-full-crew24", payload);
          }

          if (!response.ok) {
            let msg = "Hesaplama başarısız";
            try {
              const errBody = await response.json();
              msg = errBody.error || errBody.message || msg;
            } catch {
              /* ignore */
            }
            throw new Error(msg);
          }

          const result = await response.json();
          if (requestId !== backendRequestIdRef.current) return;

          const fromBackend: GemiRow[] = (result.rows || []).map((r: Record<string, unknown>) => {
            const startISO = String(r.startISO ?? r.startDate ?? "");
            const endISO = String(r.endISO ?? r.endDate ?? "");
            const dailyNetRaw = r.dailyNet ?? r.dailyHours;
            const dailyNet =
              dailyNetRaw != null && Number.isFinite(Number(dailyNetRaw)) ? Number(dailyNetRaw) : undefined;
            const annualLeaveHgRaw = r.annualLeaveHg;
            const annualLeaveHg =
              annualLeaveHgRaw != null && Number.isFinite(Number(annualLeaveHgRaw))
                ? Number(annualLeaveHgRaw)
                : undefined;
            const sevenRaw = r.annualLeaveSevenDay;
            const annualLeaveSevenDay =
              sevenRaw === "tatilli" || sevenRaw === "tatilsiz" ? sevenRaw : undefined;
            return {
              rangeLabel: String(r.rangeLabel || ""),
              weeks: Number(r.weeks) || 0,
              brut: Number(r.brut) || 0,
              katsayi: Number(r.katsayi) || 1,
              fmHours: Number(r.fmHours) || 0,
              dailyNet,
              annualLeaveHg,
              annualLeaveSevenDay,
              calc225: Number(r.calc225) || 240,
              factor: Number(r.factor) || 1.25,
              fm: Number(r.fm) || 0,
              net: Number(r.net) || 0,
              startISO,
              endISO,
              text: typeof r.text === "string" ? r.text : undefined,
            };
          });

          // ── HER SATIR İÇİN EN İYİ TANIK FM OVERRIDE + AYNI FM'Lİ SATIRLARI BİRLEŞTİR ──
          const _toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
          const _computeBreak = (b: number) => {
            if (!Number.isFinite(b) || b <= 0) return 0;
            if (b <= 4) return 0.25; if (b <= 7.5) return 0.5;
            if (b < 11) return 1; if (b < 14) return 1.5; if (b < 15) return 2; return 3;
          };
          const _dIn = _toMin(davaci?.in || ""); const _dOut = _toMin(davaci?.out || "");
          const _hg = Number(weeklyDays) || 6;
          const _tanikFM = taniklar
            .filter((t) => t.dateIn && t.dateOut && t.in && t.out)
            .map((t) => {
              const tIn = Math.max(_toMin(t.in), _dIn); const tOut = Math.min(_toMin(t.out), _dOut);
              const brut = Math.max(0, (tOut - tIn) / 60); const brk = _computeBreak(brut);
              const net = Math.max(0, brut - brk);
              const fm = Math.max(0, ceilWeeklyWorkHoursToHalfHour(net * _hg) - GEMI_WEEKLY_WORK_LIMIT);
              return { startMs: new Date(t.dateIn).getTime(), endMs: new Date(t.dateOut).getTime(), fmHours: fm };
            });

          const yargitay270Aktif = include270 && mode270 === "simple";
          const applyWitnessBestFm = (rowsIn: GemiRow[]): GemiRow[] =>
            rowsIn.map((row) => {
              const rS = new Date(row.startISO).getTime();
              const rE = new Date(row.endISO).getTime();
              const active = _tanikFM.filter((t) => t.startMs <= rS && t.endMs >= rE);
              if (active.length === 0) return row;
              const best = active.reduce((p, c) => (c.fmHours > p.fmHours ? c : p));
              const bestFmAdjusted = yargitay270Aktif
                ? Math.max(0, (best.fmHours || 0) - YARGITAY_270_FM_SAAT)
                : best.fmHours || 0;
              const rowFm = Number(row.fmHours) || 0;
              if (Math.abs(bestFmAdjusted - rowFm) < 1e-6) return row;
              const { fm, net } = recalcGemiFmNet(row, bestFmAdjusted, katSayi || 1);
              return { ...row, fmHours: bestFmAdjusted, fm, net };
            });

          const withBestFM = applyWitnessBestFm(fromBackend);

          // Ardışık aynı FM saatli satırları birleştir (hafta toplamı doğru olsun)
          const merged: GemiRow[] = [];
          for (const row of withBestFM) {
            const last = merged[merged.length - 1];
            if (last && last.fmHours === row.fmHours && last.brut === row.brut && last.katsayi === row.katsayi) {
              const mergedStart = (last.startISO || "").slice(0, 10);
              const mergedEnd = (row.endISO || "").slice(0, 10);
              let totalWeeks =
                mergedStart.length >= 10 && mergedEnd.length >= 10
                  ? Math.max(1, calculateWeeksBetweenDates(mergedStart, mergedEnd) || 1)
                  : (last.weeks || 0) + (row.weeks || 0);
              const spanMs = new Date(mergedEnd).getTime() - new Date(mergedStart).getTime();
              const spanDays = Math.floor(spanMs / 86400000) + 1;
              if (Number.isFinite(spanDays) && spanDays > 0 && spanDays <= 370) {
                totalWeeks = Math.min(52, totalWeeks);
              }
              const { fm, net } = recalcGemiFmNet({ ...last, weeks: totalWeeks }, last.fmHours, katSayi || 1);
              merged[merged.length - 1] = {
                ...last,
                endISO: row.endISO,
                rangeLabel: `${last.rangeLabel?.split(" – ")[0] ?? ""} – ${row.rangeLabel?.split(" – ")[1] ?? ""}`,
                weeks: totalWeeks,
                fm,
                net,
              };
            } else {
              merged.push({ ...row });
            }
          }
          let pipeRows: GemiRow[] = merged;
          // UBGT / yıllık izin / rapor / diğer dışlamalar: günlük ve 7/24 için aynı blok kuralları (gemiAnnualLeaveUbgtExpand).
          if (exclusions.length > 0) {
            const weeklyOffNum =
              haftaTatiliGunu === "" || haftaTatiliGunu == null ? null : Number(haftaTatiliGunu);
            pipeRows = expandGemiRowsAnnualLeaveUbgt(merged as GemiExpandSourceRow[], exclusions, {
              hg: Number(weeklyDays) || 6,
              weeklyOffDay: Number.isInteger(weeklyOffNum) ? weeklyOffNum : null,
              davaciSevenDay: activeTab,
            }) as GemiRow[];
          }
          // Tanık FM’si zaten `withBestFM` + birleştirmede uygulandı. Expand sonrası tekrar uygulanırsa
          // UBGT/yıllık izin haftası satırlarının yeniden hesaplanmış FM saati tanık değeriyle ezilir.
          const processedFromBackend = pipeRows;
          // ──────────────────────────────────────────────────────────────────────

          setRows((prev) => {
            const manualRows = prev.filter((r) => r.isManual);
            const prevApi = prev.filter((r) => !r.isManual);
            if (processedFromBackend.length === 0) return manualRows;
            const apiRows = processedFromBackend.map((backendRow, idx) => {
              const base = { ...backendRow, id: prevApi[idx]?.id ?? genGemiRowId() };
              const cur = prevApi[idx];
              if (cur?.fmManual && cur.fmHours !== undefined) {
                const { fm, net } = recalcGemiFmNet(base, cur.fmHours, katSayi || 1);
                return { ...base, fmHours: cur.fmHours, fm, net, fmManual: true, katsayi: base.katsayi };
              }
              return base;
            });
            return [...apiRows, ...manualRows];
          });
          setTextPeriods(result.textPeriods || []);
        } catch (e) {
          if (requestId === backendRequestIdRef.current) {
            setRows([]);
            setTextPeriods([]);
            console.error("[GemiAdami]", e);
          }
        } finally {
          if (requestId === backendRequestIdRef.current) setIsCalculating(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [
    iseGiris,
    istenCikis,
    davaci?.in,
    davaci?.out,
    taniklar,
    weeklyDays,
    activeTab,
    exclusions,
    katSayi,
    zamanasimiBaslangic,
    include270,
    mode270,
    gemiMode,
    haftaTatiliGunu,
  ]);

  const stepsText = useMemo(() => {
    const parts = textPeriods.map((p) => p.text || "").filter(Boolean);
    if (parts.length > 0) return parts.join("\n\n");
    const fromRows = rows.map((r) => r.text || "").filter(Boolean);
    return fromRows.join("\n\n");
  }, [textPeriods, rows]);
  const fixed724ExplanationText =
    "7/24 çalışan hesabı:\n" +
    "7 gün × 24 saat = 168 saat (toplam)\n" +
    "168 - 77 saat (dinlenme molası) = 91 saat (net çalışma)\n" +
    "91 - 48 saat (yasal haftalık çalışma) - 8 saat (hafta tatili izni) = 35 saat haftalık fazla mesai";

  /**
   * Günlük mod: Tanıklı Standart ile aynı — 1 davacı + listedeki her tanık için ayrı kart (tarih dönemi değil, beyan).
   */
  const gemiMetinCards = useMemo(() => {
    if (gemiMode !== "gunluk") return [];

    const fmtH = (n: number) => String(n ?? 0).replace(".", ",");
    const hg = Number(weeklyDays) || 6;
    const inT = davaci?.in || "";
    const outT = davaci?.out || "";
    const cards: Array<{ key: string; title: string; body: string }> = [];

    if (!inT || !outT) {
      cards.push({
        key: "davaci",
        title: "",
        body: "Davacı için giriş ve çıkış saatlerini giriniz.",
      });
      taniklar.forEach((tanik, idx) => {
        const tanikName = (tanik.name?.trim() || `TANIK ${idx + 1}`).toUpperCase();
        cards.push({
          key: `tanik-${tanik.id}`,
          title: "",
          body: `${tanikName}:\nDavacı saatleri girildikten sonra bu tanığın hesap metni gösterilir.`,
        });
      });
      return cards;
    }

    const brut = calculateDailyWorkHours(inT, outT);
    const brk = computeBreakHours(brut);
    const netGunluk = Math.max(0, brut - brk);

    let davaciText: string;
    if (hg === 7 && activeTab === "tatilli") {
      const weeklyNormal = 6 * netGunluk;
      const extraHT = Math.max(0, netGunluk - STANDARD_DAILY_REFERENCE_HOURS);
      const toplamCalisma = weeklyNormal + extraHT;
      const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(toplamCalisma);
      const davaciWeeklyFM = Math.max(0, roundedWeekly - GEMI_WEEKLY_WORK_LIMIT);
      davaciText =
        `DAVACI:\n` +
        `${inT} - ${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme\n` +
        `= ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `6 x ${fmtH(netGunluk)} = ${fmtH(weeklyNormal)} saat çalışma\n` +
        `${fmtH(netGunluk)} - 7,5 = ${fmtH(extraHT)} saat hafta tatili fazla çalışma\n` +
        `= ${fmtH(toplamCalisma)} saat haftalık çalışma\n` +
        `- 48 saat haftalık çalışma saati\n` +
        `= ${fmt(davaciWeeklyFM)} saat haftalık fazla mesai`;
    } else if (hg === 7 && activeTab === "tatilsiz") {
      const weeklyTotal = netGunluk * 7;
      const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyTotal);
      const davaciWeeklyFM = Math.max(0, roundedWeekly - GEMI_WEEKLY_WORK_LIMIT);
      davaciText =
        `DAVACI:\n` +
        `${inT} - ${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme\n` +
        `= ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `7 x ${fmtH(netGunluk)} = ${fmtH(weeklyTotal)} saat çalışma\n` +
        `= ${fmt(roundedWeekly)} saat haftalık çalışma\n` +
        `- 48 saat haftalık çalışma saati\n` +
        `= ${fmt(davaciWeeklyFM)} saat haftalık fazla mesai`;
    } else {
      const weeklyTotal = netGunluk * hg;
      const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyTotal);
      const davaciWeeklyFM = Math.max(0, roundedWeekly - GEMI_WEEKLY_WORK_LIMIT);
      davaciText =
        `DAVACI:\n` +
        `${inT} - ${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme\n` +
        `= ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `${hg} x ${fmtH(netGunluk)} = ${fmtH(weeklyTotal)} saat çalışma\n` +
        `= ${fmt(roundedWeekly)} saat haftalık çalışma\n` +
        `- 48 saat haftalık çalışma saati\n` +
        `= ${fmt(davaciWeeklyFM)} saat haftalık fazla mesai`;
    }
    cards.push({ key: "davaci", title: "", body: davaciText });

    const [dGirH, dGirM] = inT.split(":").map(Number);
    const [dCikH, dCikM] = outT.split(":").map(Number);
    const dGirMinutes = dGirH * 60 + dGirM;
    const dCikMinutes = dCikH * 60 + dCikM;

    taniklar.forEach((tanik, idx) => {
      const tanikName = (tanik.name?.trim() || `TANIK ${idx + 1}`).toUpperCase();
      if (!tanik.dateIn || !tanik.dateOut || !tanik.in || !tanik.out) {
        cards.push({
          key: `tanik-${tanik.id}`,
          title: "",
          body: `${tanikName}:\nTarih aralığı ve giriş–çıkış saatlerini giriniz.`,
        });
        return;
      }
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

      const tWorkDays = resolveWitnessWeeklyDaysGemi(tanik, hg);
      const tSeven = resolveWitnessSevenDayModeGemi(tanik);

      let tanikText: string;
      if (tWorkDays === 7 && tSeven === "tatilli") {
        const weeklyNormal = 6 * tDailyNet;
        const holidayOvertime = Math.max(0, tDailyNet - STANDARD_DAILY_REFERENCE_HOURS);
        const weeklyTotal = weeklyNormal + holidayOvertime;
        const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(weeklyTotal);
        const tWeeklyFM = Math.max(0, roundedWeekly - GEMI_WEEKLY_WORK_LIMIT);
        tanikText =
          `${tanikName}:\n` +
          `${kesikGir} - ${kesikCik} = ${fmtH(tDailyBrut)} saat çalışma\n` +
          `- ${fmtH(tBrk)} saat ara dinlenme\n` +
          `= ${fmtH(tDailyNet)} saat günlük çalışma\n` +
          `6 x ${fmtH(tDailyNet)} = ${fmtH(weeklyNormal)} saat çalışma\n` +
          `${fmtH(tDailyNet)} - 7,5 = ${fmtH(holidayOvertime)} saat hafta tatili fazla çalışma\n` +
          `= ${fmtH(weeklyTotal)} saat çalışma\n` +
          `Net haftalık çalışma = ${fmt(roundedWeekly)} saat,\n` +
          `${fmt(roundedWeekly)} – 48 saat yasal haftalık çalışma = ${fmt(tWeeklyFM)} saat haftalık fazla mesai`;
      } else {
        const tWeeklyTotal = tDailyNet * tWorkDays;
        const roundedWeekly = ceilWeeklyWorkHoursToHalfHour(tWeeklyTotal);
        const tWeeklyFM = Math.max(0, roundedWeekly - GEMI_WEEKLY_WORK_LIMIT);
        tanikText =
          `${tanikName}:\n` +
          `${kesikGir} - ${kesikCik} = ${fmtH(tDailyBrut)} saat çalışma\n` +
          `- ${fmtH(tBrk)} saat ara dinlenme\n` +
          `= ${fmtH(tDailyNet)} saat günlük çalışma\n` +
          `${tWorkDays} x ${fmtH(tDailyNet)} = ${fmtH(tWeeklyTotal)} saat çalışma\n` +
          `Net haftalık çalışma = ${fmt(roundedWeekly)} saat,\n` +
          `${fmt(roundedWeekly)} – 48 saat yasal haftalık çalışma = ${fmt(tWeeklyFM)} saat haftalık fazla mesai`;
      }
      cards.push({ key: `tanik-${tanik.id}`, title: "", body: tanikText });
    });

    return cards;
  }, [gemiMode, davaci?.in, davaci?.out, taniklar, weeklyDays, activeTab]);

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + (Number(r.fm) || 0), 0), [rows]);

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

  const applyGemiRowPatch = useCallback(
    (rowId: string, patch: Partial<GemiRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if ((r.id || "") !== rowId) return r;
          const next: GemiRow = { ...r, ...patch };
          const s = (next.startISO || "").slice(0, 10);
          const e = (next.endISO || "").slice(0, 10);
          if ((patch.startISO != null || patch.endISO != null) && s.length >= 10 && e.length >= 10) {
            let w = Math.max(1, calculateWeeksBetweenDates(s, e) || 1);
            const spanMs = new Date(e).getTime() - new Date(s).getTime();
            const spanDays = Math.floor(spanMs / 86400000) + 1;
            if (Number.isFinite(spanDays) && spanDays > 0 && spanDays <= 370) {
              w = Math.min(52, w);
            }
            next.weeks = w;
            next.rangeLabel = `${formatDateTR(s)}–${formatDateTR(e)}`;
          }
          const fmH = Number(next.fmHours) || 0;
          const k = Number(next.katsayi) || 1;
          const { fm, net } = recalcGemiFmNet({ ...next, katsayi: k }, fmH, katSayi || 1);
          return { ...next, katsayi: k, fm, net, fmManual: true };
        })
      );
    },
    [katSayi]
  );

  const addGemiRow = useCallback(
    (afterRowId?: string) => {
      const blank: GemiRow = {
        id: genGemiRowId(),
        isManual: true,
        rangeLabel: "",
        weeks: 0,
        brut: 0,
        katsayi: katSayi ?? 1,
        fmHours: 0,
        calc225: 240,
        factor: 1.25,
        fm: 0,
        net: 0,
        startISO: "",
        endISO: "",
      };
      const { fm, net } = recalcGemiFmNet(blank, 0, katSayi || 1);
      const newRow: GemiRow = { ...blank, fm, net };
      setRows((prev) => {
        if (!afterRowId) return [...prev, newRow];
        const idx = prev.findIndex((x) => x.id === afterRowId);
        if (idx < 0) return [...prev, newRow];
        const out = [...prev];
        out.splice(idx + 1, 0, newRow);
        return out;
      });
    },
    [katSayi]
  );

  const removeGemiRow = useCallback((rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== rowId);
    });
  }, []);

  const handleSave = useCallback(() => {
    kaydetAc({
      hesapTuru: recordType,
      veri: {
        data: {
          form: {
            ...formValues,
            gemiMode,
            activeTab,
            rows,
            pageType: "gemi-adami",
            route: redirectBase,
          },
          results: { rows, totalBrut, totalNet: brutNetResult.netYillik, weeklyFMHours: haftalikMesaiDisplay },
        },
        formValues: { ...formValues, gemiMode, activeTab, rows },
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
      redirectPath: `${redirectBase}/:id`,
    });
  }, [
    kaydetAc,
    recordType,
    formValues,
    gemiMode,
    activeTab,
    rows,
    totalBrut,
    brutNetResult.netYillik,
    haftalikMesaiDisplay,
    diff,
    exclusions,
    mode270,
    katSayi,
    mahsuplasmaMiktari,
    currentRecordName,
    effectiveId,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(redirectBase);
  }, [effectiveId, navigate, redirectBase]);

  const modeBlurb =
    gemiMode === "724"
      ? "7/24 çalışan gemi adamı: haftalık fazla mesai sunucuda 35 saat sabit; bölücü 240, çarpan 1,25."
      : "Günlük çalışan gemi adamı: haftalık yasal çalışma 48 saat; ara dinlenme ve haftalık gün sayısına göre FM saati hesaplanır (bölücü 240, çarpan 1,25).";

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Süre", "Mod", "Haftalık FM saat"],
      rows: [
        [
          isoToTR(iseGiris),
          isoToTR(istenCikis),
          diff.label,
          gemiMode === "724" ? "7/24" : "Günlük",
          haftalikMesaiDisplay.toFixed(2),
        ],
      ],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });

    const cetvelHeaders = ["Dönem", "Hafta", "Ücret", "Kat", "FM Saat", "240", "1,25", "FM"];
    const cetvelRows = rows.map((r) => {
      const periodLabel = r.rangeLabel || `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}`;
      const periodWithNote = r.yillikIzinAciklama ? `${periodLabel} ${r.yillikIzinAciklama}` : periodLabel;
      return [
      periodWithNote,
      r.weeks ?? 0,
      fmt(r.brut ?? 0),
      r.katsayi ?? 1,
      (r.fmHours ?? 0).toFixed(2),
      "240",
      "1,25",
      fmt(r.fm ?? 0),
    ];
    });
    cetvelRows.push(["", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Cetveli (Gemi)",
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
      { label: `Gelir Vergisi ${brutNetResult.gelirVergisiDilimleri}`, value: `-${fmtCurrency(brutNetResult.gelirVergisi)}` },
      { label: "Damga Vergisi", value: `-${fmtCurrency(brutNetResult.damgaVergisi)}` },
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
    gemiMode,
    haftalikMesaiDisplay,
    rows,
    totalBrut,
    brutNetResult,
    exclusions,
    mahsupNum,
    hakkaniyetIndirimi,
    sonNet,
  ]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content-gemi-adami");
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${pageTitle}</title><style>@page{size:A4 portrait;margin:12mm}body{font-family:Inter,Arial,sans-serif;font-size:10px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px}</style></head><body>${el.outerHTML}</body></html>`;
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
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 400);
      };
    }
  }, [pageTitle]);

  return (
    <div className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`} data-page="fazla-mesai-gemi-adami">
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

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
            <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/20 p-3">
              <label className={`${labelCls} text-sky-900 dark:text-sky-200`}>Çalışma şekli</label>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/fazla-mesai/gemi-adami"
                  className={`px-3 py-1.5 rounded-md border text-sm ${
                    gemiMode === "gunluk"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  Günlük çalışan
                </Link>
                <Link
                  to="/fazla-mesai/gemi-7-24"
                  className={`px-3 py-1.5 rounded-md border text-sm ${
                    gemiMode === "724"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  7/24 çalışan
                </Link>
              </div>
              <p className="text-xs text-sky-900/80 dark:text-sky-200/80 mt-2">{modeBlurb}</p>
            </div>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Dava dönemi</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <div>
                  <label className={labelCls}>İşe giriş</label>
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
                  <label className={labelCls}>İşten çıkış</label>
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
                  <label className={labelCls}>Haftada çalışılan gün</label>
                  <select
                    value={String(weeklyDays)}
                    onChange={(e) => handleFormChange({ weeklyDays: e.target.value })}
                    className={inputCls}
                    disabled={gemiMode === "724"}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} gün
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {gemiMode === "gunluk" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className={labelCls}>Giriş saati</label>
                    <input
                      type="time"
                      value={davaci?.in ?? ""}
                      onChange={(e) => handleFormChange({ davaci: { ...davaci, in: e.target.value } })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Çıkış saati</label>
                    <input
                      type="time"
                      value={davaci?.out ?? ""}
                      onChange={(e) => handleFormChange({ davaci: { ...davaci, out: e.target.value } })}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
              {gemiMode === "gunluk" && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                  Günlük modda giriş ve çıkış saatleri zorunludur.
                </p>
              )}
              {gemiMode === "724" && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">7/24 modda saat alanları kullanılmaz.</p>}
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className={sectionTitleCls}>Tanık beyanları</h2>
                <button
                  type="button"
                  onClick={addWitness}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                >
                  <Plus className="w-4 h-4" />
                  Tanık ekle
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Tanık tarihleri davacı dönemine göre sunucuda kırpılır.
                {gemiMode === "724" ? " 7/24 modda tanık saat girişleri kullanılmaz." : ""}
              </p>
              <div className="space-y-3">
                {taniklar.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <div className="w-full sm:w-36">
                      <label className={labelCls}>İsim</label>
                      <input
                        type="text"
                        value={t.name ?? ""}
                        onChange={(e) => updateWitness(t.id, { name: e.target.value })}
                        placeholder={`Tanık ${idx + 1}`}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={labelCls}>Başlangıç</label>
                      <input type="date" value={t.dateIn} onChange={(e) => updateWitness(t.id, { dateIn: e.target.value })} className={inputCls} />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={labelCls}>Bitiş</label>
                      <input type="date" value={t.dateOut} onChange={(e) => updateWitness(t.id, { dateOut: e.target.value })} className={inputCls} />
                    </div>
                    {gemiMode === "gunluk" && (
                      <>
                        <div className="w-24">
                          <label className={labelCls}>Giriş</label>
                          <input type="time" value={t.in} onChange={(e) => updateWitness(t.id, { in: e.target.value })} className={inputCls} />
                        </div>
                        <div className="w-24">
                          <label className={labelCls}>Çıkış</label>
                          <input type="time" value={t.out} onChange={(e) => updateWitness(t.id, { out: e.target.value })} className={inputCls} />
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => removeWitness(t.id)}
                      disabled={taniklar.length <= 1}
                      className="p-2 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {gemiMode === "gunluk" && Number(weeklyDays) === 7 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("tatilsiz")}
                  className={`px-3 py-1.5 rounded-md border text-sm ${
                    activeTab === "tatilsiz"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  Hafta tatilsiz
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tatilli")}
                  className={`px-3 py-1.5 rounded-md border text-sm ${
                    activeTab === "tatilli"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  Hafta tatilli
                </button>
              </div>
            )}

            {gemiMode === "gunluk" ? (
              <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                <details className="group" open>
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between list-none">
                    <span>Metin Hesaplaması</span>
                    <svg
                      className="w-4 h-4 transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="p-4">
                    {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">
                      Aşağıdaki metin kartları yalnızca davacı ve tanık beyanlarına göre üretilir (Tanıklı Standart ile aynı yapı). Cetvel satırları sunucuda dönemsel olarak hesaplanır; haftalık yasal çalışma 48 saattir.
                    </p>
                    <div className="bg-[#f1f3f5] dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      {gemiMetinCards.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {gemiMetinCards.map((c) => (
                            <div
                              key={c.key}
                              className="p-3 rounded-lg border bg-white dark:bg-gray-800 shadow-sm text-xs leading-snug whitespace-pre-line text-gray-800 dark:text-gray-200"
                            >
                              {c.title ? (
                                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-line">{c.title}</p>
                              ) : null}
                              {c.body}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Tarih ve davacı giriş/çıkış saatlerini giriniz.
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              </section>
            ) : (
              <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                <details open className="group">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 list-none">
                    Metin / adımlar
                  </summary>
                  <div className="p-4">
                    {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-200">
                      {fixed724ExplanationText || stepsText || modeBlurb}
                    </pre>
                  </div>
                </details>
              </section>
            )}

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShow270Dropdown((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      mode270 !== "none" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {mode270 === "none" && "270 Saat"}
                    {mode270 === "detailed" && "270 (Şirket)"}
                    {mode270 === "simple" && "270 (Yargıtay)"}
                    <span className="text-[10px] opacity-80">▾</span>
                  </button>
                  {show270Dropdown && (
                    <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1 text-xs">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          handleFormChange({ mode270: "none" });
                          setShow270Dropdown(false);
                        }}
                      >
                        Kapalı
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          handleFormChange({ mode270: "detailed" });
                          setShow270Dropdown(false);
                        }}
                      >
                        Şirket
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          handleFormChange({ mode270: "simple" });
                          setShow270Dropdown(false);
                        }}
                      >
                        Yargıtay
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => (zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    zamanasimiBaslangic ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı itirazı"}
                </button>
                <button
                  type="button"
                  onClick={() => (hasCustomKatsayi ? handleFormChange({ katSayi: 1 }) : setShowKatsayiModal(true))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    hasCustomKatsayi ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {hasCustomKatsayi ? `Katsayı ${katSayi?.toFixed(2)}` : "Kat sayı"}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                270 ve zamanaşımı sunucuda uygulanır: Yargıtay seçeneğinde hafta değişmez, FM saatinden 5 saat 12 dakika düşülür; Şirket seçeneğinde hafta düşümü uygulanır.
              </p>
            </section>

            <div className="space-y-3">
              <YillikIzinPanel exclusions={exclusions} setExclusions={setExclusions} success={success} showToastError={showToastError} />
              <UbgtFmDayPicker
                rangeStart={ubgtFmCatalogRange.start}
                rangeEnd={ubgtFmCatalogRange.end}
                exclusions={exclusions}
                setExclusions={setExclusions}
                showToastError={showToastError}
              />
            </div>

            <p className="text-[11px] sm:text-xs text-red-600 dark:text-red-400 leading-relaxed">
              Son haftaya isabet eden izin/UBGT düşümlerinde, tabloda görülen tarih aralığı 7 günden kısa olsa dahi hesaplama bu süre üzerinden yapılmaz. İlgili düşüm, üst satırdaki toplam haftadan 1 hafta eksiltilerek ayrı bir satırda 1 hafta olarak dikkate alınmıştır.
            </p>

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
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Hafta</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Ücret</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Kat</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">FM Saati</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">240</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">1,25</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Fazla Mesai</th>
                      <th className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" aria-label="Satır işlemleri" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-4 border border-gray-200 dark:border-gray-600 text-center text-gray-500">
                          {gemiMode === "gunluk"
                            ? !normalizeTimeStr(davaci?.in) || !normalizeTimeStr(davaci?.out)
                              ? "Tarih ve davacı giriş/çıkış saatlerini girin."
                              : "Tarih aralığını girin."
                            : "Tarih aralığını girin."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr
                          key={r.id || `${r.startISO}-${r.endISO}-${i}`}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          onMouseEnter={() => setHoveredGemiRow(i)}
                          onMouseLeave={() => setHoveredGemiRow(null)}
                        >
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600 align-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={(r.startISO || "").slice(0, 10)}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  if (!r.id) return;
                                  applyGemiRowPatch(r.id, { startISO: raw ? clampToLastDayOfMonth(raw) : "" });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                              <span className="text-gray-400 shrink-0">–</span>
                              <input
                                type="date"
                                value={(r.endISO || "").slice(0, 10)}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  if (!r.id) return;
                                  applyGemiRowPatch(r.id, { endISO: raw ? clampToLastDayOfMonth(raw) : "" });
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
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { weeks: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.brut ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.0001}
                              value={r.katsayi ?? 1}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { katsayi: Number.isNaN(v) || v <= 0 ? 1 : v });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={r.fmHours ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!r.id) return;
                                applyGemiRowPatch(r.id, { fmHours: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">240</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">1,25</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium whitespace-nowrap">
                            {fmt(Number(r.fm) || 0)}
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600">
                            {hoveredGemiRow === i && r.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addGemiRow(r.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium"
                                  aria-label="Satır ekle"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeGemiRow(r.id)}
                                  disabled={rows.length <= 1}
                                  className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 font-medium"
                                  aria-label="Satırı sil"
                                >
                                  −
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                    {rows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600">Toplam Fazla Mesai:</td>
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

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className={sectionTitleCls}>Brütten nete</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-xs mt-2">
                <div className="flex justify-between py-1.5">
                  <span>Brüt</span>
                  <span>{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>SGK (%14)</span>
                  <span>-{fmtCurrency(totalBrut * SSK_ORAN)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>İşsizlik (%1)</span>
                  <span>-{fmtCurrency(totalBrut * ISSIZLIK_ORAN)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>Gelir vergisi {brutNetResult.gelirVergisiDilimleri}</span>
                  <span>-{fmtCurrency(brutNetResult.gelirVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600">
                  <span>Damga</span>
                  <span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-green-700 dark:text-green-400">
                  <span>Net</span>
                  <span>{fmtCurrency(brutNetResult.netYillik)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet / mahsuplaşma</h2>
              <div className="flex flex-wrap gap-2 items-end text-sm">
                <div>
                  <label className={labelCls}>Mahsuplaşma</label>
                  <input
                    type="text"
                    value={mahsuplasmaMiktari}
                    onChange={(e) => handleFormChange({ mahsuplasmaMiktari: e.target.value })}
                    className={`${inputCls} max-w-[160px]`}
                  />
                </div>
                <button type="button" onClick={() => setShowMahsuplasamaModal(true)} className="px-3 py-2 rounded border border-pink-300 text-pink-700 text-sm">
                  Mahsuplaşma ekle
                </button>
              </div>
              <div className="divide-y divide-pink-200/70 dark:divide-pink-800/60 text-xs sm:text-sm mt-3">
                <div className="flex justify-between py-1.5">
                  <span>Toplam fazla mesai (brüt)</span>
                  <span>{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-700 dark:text-red-300">
                  <span>1/3 hakkaniyet indirimi</span>
                  <span>-{fmtCurrency(hakkaniyetIndirimi)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-700 dark:text-red-300">
                  <span>Mahsuplaşma miktarı</span>
                  <span>-{fmtCurrency(mahsupNum)}</span>
                </div>
                <div className="flex justify-between py-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  <span>Son net</span>
                  <span>{fmtCurrency(sonNet)}</span>
                </div>
              </div>
            </section>

            <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div id="report-content-gemi-adami" style={{ fontFamily: "Inter, Arial", maxWidth: "16cm", padding: "8px" }}>
          <h1 style={{ fontSize: "14px" }}>{pageTitle}</h1>
          {wordTableSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: "12px" }}>
              <h2 style={{ fontSize: "12px" }}>{sec.title}</h2>
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
      <KatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={(k) => handleFormChange({ katSayi: k })} />
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onClose={() => setShowMahsuplasamaModal(false)}
        onSave={(total) => handleFormChange({ mahsuplasmaMiktari: String(total.toFixed(2)) })}
        periodLabels={rows.map((r) => r.startISO).filter(Boolean)}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor…" : "Kaydediliyor…") : effectiveId ? "Güncelle" : "Kaydet"}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: pageTitle,
          copyTargetId: "gemi-adami-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <div id="gemi-adami-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} data-section={sec.id} className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold">{sec.title}</span>
                      <button
                        type="button"
                        className="p-1 text-gray-500"
                        onClick={async () => {
                          const ok = await copySectionForWord(sec.id);
                          if (ok) success("Kopyalandı");
                        }}
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
          onPdf: () => downloadPdfFromDOM(pageTitle, "report-content-gemi-adami"),
        }}
      />
    </div>
  );
}
