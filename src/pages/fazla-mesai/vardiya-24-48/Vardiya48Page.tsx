/**
 * 24 / 48 saat vardiya fazla mesai — tek sayfa; üstte mod seçimi.
 * 24: yerel calculate24System. 48 (24/48): yerel calculate48System (bilirkişi 3 saat/vardiya günü, ISO hafta 6 veya 9 saat).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, startOfDay } from "date-fns";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, calculateWeeksBetweenDates, isoToTR } from "@/utils/dateUtils";
import { apiClient } from "@/utils/apiClient";
import { buildWordTable, adaptToWordTable, clampToLastDayOfMonth, copySectionForWord } from "@modules/fazla-mesai/shared";
import { getAsgariUcretByDate } from "@modules/fazla-mesai/shared";
import type { ExcludedDay } from "@/shared/utils/exclusionStorage";
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
import { fmt, fmtCurrency } from "../standart/calculations";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import { buildMergedWitnessSegments } from "@/modules/fazla-mesai/shared/utils/witnessOvertimeSegments";
import { calculate24System } from "../../../utils/fazlaMesai/vardiya24/calculate24System";
import { calculate48System, calculate48SystemWithDebug } from "../../../utils/fazlaMesai/vardiya24/calculate48System";
import { reallocateVardiya48UbgtDonorFromTwoDayColumn } from "./reallocateVardiya48UbgtDonorRows";

const RECORD_24 = "fazla_mesai_vardiya_24";
const RECORD_48 = "fazla_mesai_vardiya_48";

/** Sayfa yenilenince son seçilen 24 / 48 modu korunur (kayıt yüklenirse kayıttaki mod yazılır). */
const VARDIYA_MODE_STORAGE_KEY = "aktuerya:fazla-mesai:vardiya-24-48:mode";
function forcedModeFromPath(pathname: string): "24" | "48" | null {
  if (pathname.includes("/fazla-mesai/vardiya-48")) return "48";
  if (pathname.includes("/fazla-mesai/vardiya-24")) return "24";
  return null;
}

function redirectBaseForMode(mode: "24" | "48"): string {
  return mode === "48" ? "/fazla-mesai/vardiya-48" : "/fazla-mesai/vardiya-24";
}

function readStoredVardiyaMode(): "24" | "48" {
  if (typeof window === "undefined") return "24";
  try {
    const v = window.localStorage.getItem(VARDIYA_MODE_STORAGE_KEY);
    if (v === "48" || v === "24") return v;
  } catch {
    /* private / quota */
  }
  return "24";
}

function persistVardiyaMode(mode: "24" | "48") {
  try {
    window.localStorage.setItem(VARDIYA_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type VardiyaRow = {
  id?: string;
  isManual?: boolean;
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  calc225?: number;
  factor?: number;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
  yillikIzinAciklama?: string;
  weekTypeLabel?: string;
};

function genVardiyaRowId(): string {
  return `vrd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function recalcVardiyaRow(row: VardiyaRow, vardiyaMode: "24" | "48"): Pick<VardiyaRow, "fm" | "net"> {
  if (vardiyaMode === "24") {
    // 24/24: ucret = (toplamHafta × haftalikSaat × 1.5 × brut) / 225
    const totalWeeks = Math.max(0, row.weeks);
    const weeklyHours = Math.max(0, row.fmHours);
    const brut = Math.max(0, row.brut);
    const fm = Number(((totalWeeks * weeklyHours * 1.5 * brut) / 225).toFixed(2));
    return { fm, net: fm };
  }
  const calc225 = row.calc225 ?? 225;
  const factor = row.factor ?? 1.5;
  const step1 = Number((row.weeks * row.brut).toFixed(6));
  const step2 = Number((step1 * row.katsayi).toFixed(6));
  const step3 = Number((step2 * row.fmHours).toFixed(6));
  const step4 = Number((step3 / calc225).toFixed(6));
  const step5 = Number((step4 * factor).toFixed(6));
  const fm = Number(step5.toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - 0.15)).toFixed(2));
  return { fm, net };
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

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

/** Tanık aralıklarını dava dönemine kırpar; kesişen/yan yana parçaları ortak segmentleyici ile birleştirir (24/48 birleşik sayfa ile aynı). */
function buildWitnessSegments(
  dStart: string,
  dEnd: string,
  taniklar: Array<{ dateIn: string; dateOut: string }>
): Array<{ start: string; end: string }> {
  const parseLocalDayToMs = (raw: string): number => {
    const s = String(raw || "").trim();
    if (!s) return Number.NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return Date.UTC(y || 0, (m || 1) - 1, d || 1);
    }
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
      const [d, m, y] = s.split(".").map(Number);
      return Date.UTC(y || 0, (m || 1) - 1, d || 1);
    }
    const n = new Date(s).getTime();
    return Number.isNaN(n) ? Number.NaN : n;
  };

  const dStartMs = parseLocalDayToMs(normalizeDateInput(dStart));
  const dEndMs = parseLocalDayToMs(normalizeDateInput(dEnd));
  if (Number.isNaN(dStartMs) || Number.isNaN(dEndMs) || dStartMs > dEndMs) return [];

  const witnesses = taniklar
    .filter((t) => t.dateIn && t.dateOut)
    .map((t, idx) => ({
      startMs: parseLocalDayToMs(normalizeDateInput(t.dateIn)),
      endMs: parseLocalDayToMs(normalizeDateInput(t.dateOut)),
      fmHours: idx + 1,
    }))
    .filter((w) => !Number.isNaN(w.startMs) && !Number.isNaN(w.endMs) && w.startMs <= w.endMs);

  if (witnesses.length === 0) return [];

  return buildMergedWitnessSegments(dStart, dEnd, witnesses).map((seg) => ({
    start: seg.start,
    end: seg.end,
  }));
}

/**
 * Bilirkişi kuralı:
 * Aynı dönemde 3+3+1 gibi tek kalan 1 haftayı ayrı satır bırakma;
 * fazla FM saatli bloğa ekleyip 4+3 yap.
 */
function rebalanceSingletonWeekRows(rows: VardiyaRow[], vardiyaMode: "24" | "48"): VardiyaRow[] {
  const autoRows = rows.filter((r) => !r.isManual);
  if (autoRows.length <= 2) return rows;

  const toDrop = new Set<string>();
  const patched = new Map<string, VardiyaRow>();

  // Dinamik kural: 1 haftalık otomatik ve notsuz satırı,
  // aynı ücret parametrelerindeki en yüksek FM saatli bloğa taşı.
  autoRows.forEach((singleton) => {
    if (Math.round(Number(singleton.weeks) || 0) !== 1) return;
    if ((singleton.yillikIzinAciklama || "").trim().length > 0) return;

    const targets = autoRows.filter((r) => {
      if ((r.id || "") === (singleton.id || "")) return false;
      if (toDrop.has(r.id || "")) return false;
      if ((r.yillikIzinAciklama || "").trim().length > 0) return false;
      // 24/48 birleşik sayfa ile aynı: tek hafta yalnızca aynı dönem (start/end) satırına taşınır;
      // aksi halde tanık parçası sınırındaki kısa satırlar (örn. 01.01–14.01) başka döneme emilir.
      if ((r.startISO || "").slice(0, 10) !== (singleton.startISO || "").slice(0, 10)) return false;
      if ((r.endISO || "").slice(0, 10) !== (singleton.endISO || "").slice(0, 10)) return false;
      if ((Number(r.brut) || 0) !== (Number(singleton.brut) || 0)) return false;
      if ((Number(r.katsayi) || 0) !== (Number(singleton.katsayi) || 0)) return false;
      if ((Number(r.calc225 ?? 225) || 0) !== (Number(singleton.calc225 ?? 225) || 0)) return false;
      if ((Number(r.factor ?? 1.5) || 0) !== (Number(singleton.factor ?? 1.5) || 0)) return false;
      return (Number(r.weeks) || 0) >= 1;
    });
    if (!targets.length) return;

    let best = targets[0];
    targets.forEach((r) => {
      const fmH = Number(r.fmHours) || 0;
      const bestFmH = Number(best.fmHours) || 0;
      if (fmH > bestFmH) best = r;
    });

    const base = patched.get(best.id || "") || best;
    const next: VardiyaRow = { ...base, weeks: (Number(base.weeks) || 0) + 1 };
    const recalced = recalcVardiyaRow(next, vardiyaMode);
    patched.set(best.id || "", { ...next, ...recalced });
    toDrop.add(singleton.id || "");
  });

  if (toDrop.size === 0 && patched.size === 0) return rows;
  return rows.filter((r) => !toDrop.has(r.id || "")).map((r) => patched.get(r.id || "") || r);
}

function anchorForSegment(globalStart: string, segmentStart: string, baseAnchorIsWorkDay: boolean): boolean {
  const gs = new Date(globalStart);
  const ss = new Date(segmentStart);
  if (Number.isNaN(+gs) || Number.isNaN(+ss)) return baseAnchorIsWorkDay;
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((startOfDay(ss).getTime() - startOfDay(gs).getTime()) / dayMs);
  if (diffDays <= 0) return baseAnchorIsWorkDay;
  // 24/24 desende her gün faz değişir; segment başlangıcında global fazı koru.
  return diffDays % 2 === 0 ? baseAnchorIsWorkDay : !baseAnchorIsWorkDay;
}

/** Sayfadaki onay kutusu (ref); runBackend öncesi güncellenir. */
const vardiya48DebugUiRef = { current: false };

/** URL `?vardiyaDebug=1` | sessionStorage | window bayrakları */
function vardiya48DebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("vardiyaDebug") ?? u.searchParams.get("debug48");
    if (q === "1" || String(q || "").toLowerCase() === "true") return true;
  } catch {
    /* ignore */
  }
  try {
    if (window.sessionStorage.getItem("aktuerya:vardiya48:debug") === "1") return true;
  } catch {
    /* quota / private */
  }
  const w = window as unknown as { __VARDIYA_DEBUG__?: unknown; __VARDIYA_48_DEBUG__?: unknown };
  const on = (v: unknown) =>
    v === true ||
    v === 1 ||
    v === "1" ||
    (typeof v === "string" && ["true", "yes", "on"].includes(v.trim().toLowerCase()));
  return on(w.__VARDIYA_DEBUG__) || on(w.__VARDIYA_48_DEBUG__);
}

function vardiya48DebugEffective(): boolean {
  return vardiya48DebugUiRef.current || vardiya48DebugEnabled();
}

function logVardiya48Debug(label: string, payload?: unknown) {
  if (!vardiya48DebugEffective()) return;
  // console.info: Chrome’da Varsayılan seviyede görünür; console.log sık sık “Verbose”da kalır.
  // eslint-disable-next-line no-console
  console.info(`[Vardiya48][DEBUG] ${label}`, payload);
}

function logDebugLines48(label: string, lines: string[]) {
  if (!vardiya48DebugEffective()) return;
  // eslint-disable-next-line no-console
  console.info(`[Vardiya48][DEBUG] ${label} (count=${lines.length})`);
  lines.forEach((line, idx) => {
    // eslint-disable-next-line no-console
    console.info(`[Vardiya48][DEBUG] ${label}[${idx}] ${line}`);
  });
}

function readInitialMotorConsoleLog48(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("vardiyaDebug") ?? u.searchParams.get("debug48");
    if (q === "1" || String(q || "").toLowerCase() === "true") return true;
    if (window.sessionStorage.getItem("aktuerya:vardiya48:debug") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function summarizeMotorRows48(
  rows: Array<{ startDate: string; endDate: string; weekType: string | number; weekCount: number; weeklyFmHours: number; note?: string }>
) {
  return rows.map((r) => ({
    start: (r.startDate || "").slice(0, 10),
    end: (r.endDate || "").slice(0, 10),
    type: String(r.weekType),
    weeks: Number(r.weekCount) || 0,
    fmH: Number(r.weeklyFmHours) || 0,
    note: String(r.note || ""),
  }));
}

function formatMotorRowsForLog(
  rows: Array<{ startDate: string; endDate: string; weekType: string | number; weekCount: number; weeklyFmHours: number; note?: string }>
): string[] {
  return summarizeMotorRows48(rows).map(
    (r) => `start=${r.start} end=${r.end} type=${r.type} weeks=${r.weeks} fmH=${r.fmH} note=${r.note || "-"}`
  );
}

function summarizeUiRows48(rows: VardiyaRow[]) {
  return rows.map((r) => ({
    start: (r.startISO || "").slice(0, 10),
    end: (r.endISO || "").slice(0, 10),
    type: String(r.weekTypeLabel || ""),
    weeks: Number(r.weeks) || 0,
    fmH: Number(r.fmHours) || 0,
    fm: Number(r.fm) || 0,
    note: String(r.yillikIzinAciklama || ""),
  }));
}

function formatUiRowsForLog48(rows: VardiyaRow[]): string[] {
  return summarizeUiRows48(rows).map(
    (r) => `start=${r.start} end=${r.end} type=${r.type} weeks=${r.weeks} fmH=${r.fmH} fm=${r.fm} note=${r.note || "-"}`
  );
}

export default function Vardiya48Page() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const forcedMode = useMemo<"24" | "48" | null>(() => forcedModeFromPath(location.pathname), [location.pathname]);
  const [vardiyaMode, setVardiyaMode] = useState<"24" | "48">(() => forcedModeFromPath(window.location.pathname) || readStoredVardiyaMode());
  const [rows, setRows] = useState<VardiyaRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const [anchorIsWorkDay, setAnchorIsWorkDay] = useState(true);
  const [motorConsoleLog48, setMotorConsoleLog48] = useState<boolean>(() => readInitialMotorConsoleLog48());
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useLayoutEffect(() => {
    vardiya48DebugUiRef.current = motorConsoleLog48;
  }, [motorConsoleLog48]);


  const { iseGiris, istenCikis, weeklyDays, davaci, taniklar, vardiyaWeekBucketStart, katSayi, mahsuplasmaMiktari } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;

  const pageTitle = vardiyaMode === "48" ? "48 Saat Çalışma Hesaplama" : "24 Saat Çalışma Hesaplama";
  const recordType = vardiyaMode === "48" ? RECORD_48 : RECORD_24;
  const redirectBase = redirectBaseForMode(vardiyaMode);
  const videoLink = getVideoLink(vardiyaMode === "48" ? "fazla-vardiya48" : "fazla-vardiya24");

  useEffect(() => {
    if (!forcedMode) return;
    setVardiyaMode(forcedMode);
    persistVardiyaMode(forcedMode);
  }, [forcedMode]);

  const bilirkisiDefaultText =
    vardiyaMode === "48"
      ? [
          "24/48 (48 saat dinlenmeli) — bilirkişi özeti:",
          "• Günlük 11 saatlik üst sınır; vardiyada fiilen kabul edilen çalışma 14 saat → vardiya başına 3 saat FM.",
          "• Her 7 günlük blokta (aşağıda seçilen blok başı; boşsa işe giriş / davacı tarihi) vardiya çalışma günü × 3 saat = blok FM;",
          "  tipik olarak blok başına 2 veya 3 vardiya günü → 6 veya 9 saat. Pazartesi zorunlu değildir.",
          `• 24/48 vardiya fazı işe girişe göre; ilk gün: ${anchorIsWorkDay ? "çalıştı" : "dinlendi"}.`,
          "• Üç günlük vardiya ritmi: bir vardiya çalışma günü, ardından iki tam dinlence günü (24/24’teki 1 dolu / 1 boşa karşılık 1 dolu / 2 boş).",
          "• UBGT / yıllık izin vb. dışlamalarda düşüm tabloda yalnızca 2 vardiya günü satırından gösterilir ((3→2) ve (2→1)); çalışma gününe denk gelmeyen dışlama ayrı satır üretmez.",
        ].join("\n")
      : [
          "24/24 Hesap Motoru (izole):",
          "1) Önce çalışma günleri üretilir (gün aşırı sistem).",
          `   Başlangıç fazı: ${anchorIsWorkDay ? "İlk gün çalıştı" : "İlk gün dinlendi"}.`,
          "2) UBGT / yıllık izin sadece çalışma günlerinden düşülür.",
          "   Dinlenme gününe gelen dışlama düşüm oluşturmaz.",
          "3) Haftalık özet çıkarılır:",
          "   - 3 çalışma günü -> 9 saat",
          "   - 4 çalışma günü -> 12 saat",
          "4) Sonuç satırları haftalık olarak cetvele yazılır.",
        ].join("\n");

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
        if (!t.includes("vardiya")) {
          if (mounted) showToastError("Bu kayıt vardiya hesabına ait değil");
          return;
        }
        const mode48 = t.includes("48");
        const d = json.data || {};
        const inner = d.form || d.formValues || d;
        if (mounted) {
          const loadedMode: "24" | "48" = forcedMode
            ? forcedMode
            : inner.vardiyaMode === "24" || inner.vardiyaMode === "48"
              ? inner.vardiyaMode
              : mode48
                ? "48"
                : "24";
          setVardiyaMode(loadedMode);
          persistVardiyaMode(loadedMode);
        }
        setFormValues((p) => ({
          ...p,
          ...(inner.iseGiris != null && { iseGiris: inner.iseGiris }),
          ...(inner.istenCikis != null && { istenCikis: inner.istenCikis }),
          ...(inner.weeklyDays != null && { weeklyDays: String(inner.weeklyDays) }),
          ...(inner.vardiyaWeekBucketStart != null && { vardiyaWeekBucketStart: String(inner.vardiyaWeekBucketStart) }),
          ...(inner.davaci && { davaci: { ...p.davaci, ...inner.davaci } }),
          ...(Array.isArray(inner.taniklar) && inner.taniklar.length > 0 && { taniklar: inner.taniklar }),
          ...(inner.katSayi != null && { katSayi: inner.katSayi }),
          ...(inner.mahsuplasmaMiktari != null && { mahsuplasmaMiktari: inner.mahsuplasmaMiktari }),
          ...(Array.isArray(inner.exclusions) && { exclusions: inner.exclusions }),
          ...(inner.zamanasimi != null && { zamanasimi: inner.zamanasimi }),
        }));
        if (Array.isArray(inner.rows) && inner.rows.length > 0) {
          // Otomatik satırlar her açılışta yeniden hesaplanır; kayıtlı otomatik satırı basmak
          // ilk frame'de eski tabloyu gösterip kısa süre sonra "düzelme" hissi yaratıyordu.
          const manualLoaded = inner.rows.filter((r: VardiyaRow) => !!r.isManual);
          setRows(
            manualLoaded.map((r: VardiyaRow) => ({
              ...r,
              id: r.id ?? genVardiyaRowId(),
            }))
          );
        }
        if (typeof inner.anchorIsWorkDay === "boolean") setAnchorIsWorkDay(inner.anchorIsWorkDay);
        if (json.name && mounted) setCurrentRecordName(json.name);
        if (mounted) success("Kayıt yüklendi");
      } catch (e) {
        if (mounted) showToastError("Kayıt yüklenemedi");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [effectiveId, setFormValues, setCurrentRecordName, success, showToastError, forcedMode]);

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

  const ubgtFmCatalogRange = useMemo(() => {
    const datedRows = rows
      .map((r) => ({ s: (r.startISO || "").slice(0, 10), e: (r.endISO || "").slice(0, 10) }))
      .filter((x) => x.s.length >= 10 && x.e.length >= 10);
    if (datedRows.length > 0) {
      const start = datedRows.reduce((m, x) => (x.s < m ? x.s : m), datedRows[0].s);
      const end = datedRows.reduce((m, x) => (x.e > m ? x.e : m), datedRows[0].e);
      if (start && end && start <= end) return { start, end };
    }
    const fallbackStart = (iseGiris || "").slice(0, 10);
    const fallbackEnd = (istenCikis || "").slice(0, 10);
    if (!fallbackStart || !fallbackEnd || fallbackStart > fallbackEnd) return { start: "", end: "" };
    return { start: fallbackStart, end: fallbackEnd };
  }, [rows, iseGiris, istenCikis]);

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

  const runBackend = useCallback(async () => {
    const dStart = normalizeDateInput(iseGiris);
    const dEnd = normalizeDateInput(istenCikis);
    if (!dStart || !dEnd) {
      setRows([]);
      return;
    }
    const rid = ++reqIdRef.current;
    setIsCalculating(true);
    try {
      if (vardiyaMode === "24") {
        const witnessIntervals = buildWitnessSegments(dStart, dEnd, taniklar);
        if (witnessIntervals.length === 0) {
          setRows((prev) => prev.filter((r) => r.isManual));
          return;
        }
        const summaryRows = witnessIntervals.flatMap((seg) => {
          const segAnchor = anchorForSegment(dStart, seg.start, anchorIsWorkDay);
          return calculate24System({
            startDate: seg.start,
            endDate: seg.end,
            exclusions: exclusions as ExcludedDay[],
            anchorIsWorkDay: segAnchor,
            anchorStartDate: dStart,
          });
        });
        setRows((prev) => {
          const prevApi = prev.filter((r) => !r.isManual);
          const manualRows = prev.filter((r) => r.isManual);
          const apiRowsRaw: VardiyaRow[] = summaryRows.map((w, idx) => {
            const row: VardiyaRow = {
              id: prevApi[idx]?.id ?? genVardiyaRowId(),
              isManual: false,
              rangeLabel: `${formatDateTR(w.startDate)}–${formatDateTR(w.endDate)}`,
              weeks: w.weekCount,
              brut: getAsgariUcretByDate(w.startDate) || 0,
              katsayi: 1,
              fmHours: w.weeklyFmHours,
              calc225: 225,
              factor: 1.5,
              fm: 0,
              net: 0,
              startISO: w.startDate,
              endISO: w.endDate,
              weekTypeLabel: `${w.weekType} gün`,
              yillikIzinAciklama: w.note,
            };
            const { fm, net } = recalcVardiyaRow(row, "24");
            return { ...row, fm, net };
          });
          const apiRows = rebalanceSingletonWeekRows(apiRowsRaw, "24");
          return [...apiRows, ...manualRows];
        });
        return;
      }

      const witnessIntervals48 = buildWitnessSegments(dStart, dEnd, taniklar);
      const zNorm48 = zamanasimiBaslangic ? normalizeDateInput(zamanasimiBaslangic) : null;
      const weekBucketAnchor48 = (() => {
        const wbs = normalizeDateInput(vardiyaWeekBucketStart || "");
        const firstExcl = (exclusions || [])
          .map((ex) => normalizeDateInput((ex as { start?: string }).start || ""))
          .filter((d) => d.length >= 10)
          .sort((a, b) => a.localeCompare(b))[0];
        const di = normalizeDateInput(davaci?.dateIn || "");
        if (wbs.length >= 10) return wbs.slice(0, 10);
        if (firstExcl && firstExcl.length >= 10) return firstExcl.slice(0, 10);
        if (di.length >= 10) return di.slice(0, 10);
        return dStart;
      })();

      if (vardiya48DebugEffective()) {
        logVardiya48Debug("48.branch.enter", {
          path: typeof window !== "undefined" ? window.location.pathname : "",
          vardiyaMode,
        });
        logVardiya48Debug("48.afterBuildWitness", {
          dStart,
          dEnd,
          zNorm48,
          anchorIsWorkDay,
          intervalCount: witnessIntervals48.length,
          exclusionCount: exclusions?.length ?? 0,
          taniklar: taniklar.map((t, i) => ({
            i,
            dateIn: t.dateIn,
            dateOut: t.dateOut,
          })),
        });
        logVardiya48Debug("48.witnessSegments.raw", witnessIntervals48);
        logDebugLines48(
          "48.witnessSegments.lines",
          witnessIntervals48.length > 0
            ? witnessIntervals48.map((s) => `start=${s.start} end=${s.end}`)
            : ["(boş) tanık yok veya davacı dönemiyle kesişen aralık yok — motor çağrılmayacak"]
        );
      }

      if (witnessIntervals48.length === 0) {
        if (vardiya48DebugEffective()) {
          logVardiya48Debug("48.abort", "witnessIntervals48 boş; cetvel satırları üretilmedi.");
        }
        setRows((prev) => prev.filter((r) => r.isManual));
        return;
      }

      const dbg48 = vardiya48DebugEffective();
      // 24 saat ile aynı: buildWitnessSegments çıktısındaki her parça ayrı motor çağrısı (tanık kesişimi / sınır satırları korunur).
      const summaryRows48 = witnessIntervals48.flatMap((seg, segIdx) => {
        const segAnchor = anchorForSegment(dStart, seg.start, anchorIsWorkDay);
        const input48 = {
          witnessSegments: [{ start: seg.start, end: seg.end }] as const,
          anchorStartDate: dStart,
          weekBucketAnchorDate: weekBucketAnchor48,
          anchorIsWorkDay: segAnchor,
          exclusions: exclusions as ExcludedDay[],
          zNorm: zNorm48,
          davaStart: seg.start,
          davaEnd: seg.end,
        };
        if (dbg48) {
          const { rows, debug } = calculate48SystemWithDebug(input48);
          logVardiya48Debug(`48.seg[${segIdx}].motorInput`, {
            ...input48,
            witnessSegments: [...input48.witnessSegments],
            segAnchor,
          });
          logVardiya48Debug(`48.seg[${segIdx}].motorCounts`, {
            mergedWorkDayCount: debug.mergedWorkDayCount,
            dedupedWorkDayCount: debug.dedupedWorkDayCount,
            baselineWeekBuckets: debug.baselineWeeks.length,
            weeksAfterBuckets: debug.weeksAfter.length,
            exclusionHitCount: debug.exclusionHits.length,
          });
          logDebugLines48(
            `48.seg[${segIdx}].clippedSegments`,
            debug.clippedSegments.map((c) => `${c.start} → ${c.end}`)
          );
          if (debug.exclusionHits.length > 0) {
            logDebugLines48(
              `48.seg[${segIdx}].exclusionHits`,
              debug.exclusionHits.map(
                (h, i) =>
                  `[${i}] ${h.weekStart} gün=${h.beforeWorkDays}→${h.afterWorkDays} FMh=${h.beforeFmHours}→${h.afterFmHours} ${h.note || "-"} excl=${(h.matchedExclusions || []).join(",") || "-"}`
              )
            );
          } else {
            logVardiya48Debug(`48.seg[${segIdx}].exclusionHits`, "0 isabet (dışlama yok)");
          }
          logDebugLines48(
            `48.seg[${segIdx}].stages`,
            (debug.stages || []).map((s) => `${s.label}: ${s.rows?.length ?? 0} satır`)
          );
          logVardiya48Debug(`48.seg[${segIdx}].rows.compact`, summarizeMotorRows48(rows));
          logDebugLines48(`48.seg[${segIdx}].rows.lines`, formatMotorRowsForLog(rows));
          return rows;
        }
        return calculate48System(input48);
      });
      if (vardiya48DebugEffective()) {
        logVardiya48Debug("48.summaryRows48.flattened.compact", summarizeMotorRows48(summaryRows48));
        logDebugLines48("48.summaryRows48.flattened.lines", formatMotorRowsForLog(summaryRows48));
        const vis = summaryRows48.filter((w) => (Number(w.weekCount) || 0) > 0 && (Number(w.weeklyFmHours) || 0) > 0);
        logVardiya48Debug("48.pipeline.summary", {
          tanikParcalari: witnessIntervals48.length,
          motorSatirSayisi: summaryRows48.length,
          cetveleGidenSatir: vis.length,
          ipucu:
            "Üstteki satırların hepsi aynı dosya satırından (logVardiya48Debug) gelir; konsolda grubu genişlet veya filtreyi [Vardiya48][DEBUG] yap.",
        });
      }
      setRows((prev) => {
        const prevApi = prev.filter((r) => !r.isManual);
        const manualRows = prev.filter((r) => r.isManual);
        const visibleRows48 = summaryRows48.filter((w) => (Number(w.weekCount) || 0) > 0 && (Number(w.weeklyFmHours) || 0) > 0);
        const apiRowsRaw: VardiyaRow[] = visibleRows48.map((w, idx) => {
          const row: VardiyaRow = {
            id: prevApi[idx]?.id ?? genVardiyaRowId(),
            isManual: false,
            rangeLabel: `${formatDateTR(w.startDate)}–${formatDateTR(w.endDate)}`,
            weeks: w.weekCount,
            brut: getAsgariUcretByDate(w.startDate) || 0,
            katsayi: katSayi || 1,
            fmHours: w.weeklyFmHours,
            calc225: 225,
            factor: 1.5,
            fm: 0,
            net: 0,
            startISO: w.startDate,
            endISO: w.endDate,
            weekTypeLabel: `${w.weekType} gün`,
            yillikIzinAciklama: w.note,
          };
          const { fm, net } = recalcVardiyaRow(row, "48");
          return { ...row, fm, net };
        });
        const apiRows = apiRowsRaw.map((r) => ({ ...r, weeks: Math.max(0, Math.round(Number(r.weeks) || 0)) }));
        if (vardiya48DebugEffective()) {
          logVardiya48Debug("48.apiRows.final.compact", summarizeUiRows48(apiRows));
          logDebugLines48("48.apiRows.final.lines", formatUiRowsForLog48(apiRows));
        }
        return [...apiRows, ...manualRows];
      });
    } catch (e) {
      if (rid === reqIdRef.current) {
        setRows([]);
        console.error("[Vardiya48]", e);
      }
    } finally {
      if (rid === reqIdRef.current) setIsCalculating(false);
    }
  }, [
    iseGiris,
    istenCikis,
    taniklar,
    anchorIsWorkDay,
    exclusions,
    katSayi,
    zamanasimiBaslangic,
    vardiyaMode,
    motorConsoleLog48,
    vardiyaWeekBucketStart,
    davaci?.dateIn,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      void runBackend();
    }, 400);
    return () => clearTimeout(t);
  }, [runBackend]);

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + (r.fm || 0), 0), [rows]);

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

  const handleSave = useCallback(() => {
    kaydetAc({
      hesapTuru: recordType,
      veri: {
        data: {
          form: {
            ...formValues,
            vardiyaMode,
            anchorIsWorkDay,
            rows,
            pageType: vardiyaMode === "48" ? "vardiya-48" : "vardiya-24",
            route: redirectBase,
          },
          results: { rows, totalBrut, totalNet: brutNetResult.netYillik },
        },
        formValues: { ...formValues, vardiyaMode, anchorIsWorkDay, rows },
        totals: { toplam: totalBrut, yil: diff.years, ay: diff.months, gun: diff.days },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        exclusions,
        mode270: "none",
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
    vardiyaMode,
    anchorIsWorkDay,
    rows,
    totalBrut,
    brutNetResult.netYillik,
    diff,
    exclusions,
    katSayi,
    mahsuplasmaMiktari,
    currentRecordName,
    effectiveId,
    redirectBase,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(redirectBase);
  }, [effectiveId, navigate, redirectBase]);

  const applyRowPatch = useCallback((rowId: string, patch: Partial<VardiyaRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const next: VardiyaRow = { ...r, ...patch };
        const s = (next.startISO || "").slice(0, 10);
        const e = (next.endISO || "").slice(0, 10);
        if ((patch.startISO != null || patch.endISO != null) && s.length >= 10 && e.length >= 10) {
          next.weeks = Math.max(1, calculateWeeksBetweenDates(s, e) || 1);
          next.rangeLabel = `${formatDateTR(s)}–${formatDateTR(e)}`;
        }
        const { fm, net } = recalcVardiyaRow(next, vardiyaMode);
        return { ...next, fm, net };
      })
    );
  }, [vardiyaMode]);

  const addRow = useCallback(
    (afterRowId?: string) => {
      const newRow: VardiyaRow = {
        id: genVardiyaRowId(),
        isManual: true,
        rangeLabel: "",
        weeks: 0,
        brut: 0,
        katsayi: katSayi ?? 1,
        fmHours: 0,
        calc225: 225,
        factor: 1.5,
        fm: 0,
        net: 0,
        startISO: "",
        endISO: "",
      };
      const { fm, net } = recalcVardiyaRow(newRow, vardiyaMode);
      newRow.fm = fm;
      newRow.net = net;
      setRows((prev) => {
        if (!afterRowId) return [...prev, newRow];
        const idx = prev.findIndex((r) => r.id === afterRowId);
        if (idx < 0) return [...prev, newRow];
        const out = [...prev];
        out.splice(idx + 1, 0, newRow);
        return out;
      });
    },
    [katSayi, vardiyaMode]
  );

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== rowId);
    });
  }, []);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi", "Mod"],
      rows: [[isoToTR(iseGiris), isoToTR(istenCikis), diff.label, vardiyaMode === "48" ? "48 saat" : "24 saat"]],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });
    const cetvelHeaders =
      vardiyaMode === "24"
        ? ["Dönem", "Hafta Tipi", "Toplam Hafta", "Haftalık FM Saat", "Brüt Ücret", "225", "1,5", "Ücret"]
        : ["Dönem", "Hafta Tipi", "Toplam Hafta", "Ücret (BRÜT)", "Katsayı", "Fazla Mesai Saati", "225", "1,5", "Fazla Mesai"];
    const cetvelRows = rows.map((r) => {
      const periodLabel = r.rangeLabel || `${formatDateTR(r.startISO)}–${formatDateTR(r.endISO)}`;
      const periodWithNote = r.yillikIzinAciklama ? `${periodLabel} ${r.yillikIzinAciklama}` : periodLabel;
      if (vardiyaMode === "24") {
        return [periodWithNote, r.weekTypeLabel || "-", r.weeks, fmt(r.fmHours), fmt(r.brut), "225", "1,5", fmt(r.fm)];
      }
      return [
        periodWithNote,
        r.weekTypeLabel || "-",
        r.weeks,
        fmt(r.brut),
        r.katsayi,
        r.fmHours.toFixed(2),
        (r.calc225 ?? 225).toLocaleString("tr-TR"),
        (r.factor ?? 1.5).toLocaleString("tr-TR"),
        fmt(r.fm),
      ];
    });
    cetvelRows.push(
      vardiyaMode === "24"
        ? ["", "", "", "", "", "", "Toplam", fmt(totalBrut)]
        : ["", "", "", "", "", "", "", "Toplam", fmt(totalBrut)]
    );
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Cetveli",
      html: buildWordTable(n2.headers, n2.rows),
      htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }),
    });
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
  }, [iseGiris, istenCikis, diff.label, vardiyaMode, rows, totalBrut, brutNetResult, hakkaniyetIndirimi, mahsupNum, sonNet]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content-vardiya");
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
    <div className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`} data-page="fazla-mesai-vardiya-24-48">
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
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20 p-3">
              <label className={`${labelCls} text-amber-900 dark:text-amber-200`}>Çalışma sistemi</label>
              <select
                value={vardiyaMode}
                onChange={(e) => {
                  const m = e.target.value as "24" | "48";
                  setVardiyaMode(m);
                  persistVardiyaMode(m);
                  const targetBase = redirectBaseForMode(m);
                  const target = effectiveId ? `${targetBase}/${effectiveId}` : targetBase;
                  if (location.pathname !== target) navigate(target);
                }}
                className={inputCls}
              >
                <option value="24">24 saat çalışma (12/9 bilirkişi dağılımı)</option>
                <option value="48">24/48 vardiya (7 günlük blok / ücret dönemi özeti)</option>
              </select>
            </div>

            {vardiyaMode === "48" ? (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/35 px-3 py-2.5">
                <label className="flex items-start gap-2.5 text-xs cursor-pointer text-indigo-900 dark:text-indigo-100 leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={motorConsoleLog48}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setMotorConsoleLog48(v);
                      try {
                        if (v) window.sessionStorage.setItem("aktuerya:vardiya48:debug", "1");
                        else window.sessionStorage.removeItem("aktuerya:vardiya48:debug");
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                  <span>
                    <span className="font-semibold">48 motor / tanık konsol logu</span>
                    {" — "}
                    İşaretleyince hesap yeniden çalışır; konsolda <code className="text-[10px] px-0.5 rounded bg-white/80 dark:bg-black/30">[Vardiya48][DEBUG]</code> satırlarını arayın.
                    Konsol filtresinde <strong className="font-medium">Info</strong> seviyesinin kapalı olmadığından emin olun (Chrome’da <code className="text-[10px]">console.log</code> sık sık
                    “Verbose”da kalır; biz <code className="text-[10px]">console.info</code> kullanıyoruz).
                  </span>
                </label>
              </div>
            ) : null}

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Dava dönemi</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
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
                  <label className={labelCls}>Başlangıç vardiya günü</label>
                  <select
                    value={anchorIsWorkDay ? "work" : "rest"}
                    onChange={(e) => setAnchorIsWorkDay(e.target.value === "work")}
                    className={inputCls}
                  >
                    <option value="work">İlk gün çalıştı</option>
                    <option value="rest">İlk gün dinlendi</option>
                  </select>
                </div>
                {vardiyaMode === "48" ? (
                  <div className="col-span-2 sm:col-span-3">
                    <label className={labelCls}>7 günlük blok başı (ücret özeti kovası)</label>
                    <input
                      type="date"
                      value={vardiyaWeekBucketStart ? normalizeDateInput(vardiyaWeekBucketStart).slice(0, 10) : ""}
                      onChange={(e) =>
                        setFormValues((p) => ({
                          ...p,
                          vardiyaWeekBucketStart: e.target.value ? e.target.value.slice(0, 10) : "",
                        }))
                      }
                      className={inputCls}
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Boşsa önce davacı ilk tarih, o da yoksa işe giriş kullanılır. İşaretlediğiniz gün 7 günlük özetin 1. günüdür; Pazartesi şartı yoktur.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className={sectionTitleCls}>Tanık beyanları (tarih aralığı)</h2>
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
                Tanık tarihleri davacı dönemine göre kırpılır; tanık yoksa cetvel otomatik dolmaz. 48 modunda motor adımlarını görmek için üstteki{" "}
                <span className="font-medium text-indigo-800 dark:text-indigo-200">48 motor / tanık konsol logu</span> kutusunu kullanın.
              </p>
              <div className="space-y-3">
                {taniklar.map((t, idx) => (
                  <div key={t.id} className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
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

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <details open className="group">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 list-none">
                  Metin Hesaplaması
                </summary>
                <div className="p-4">
                  {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-200">
                    {bilirkisiDefaultText}
                  </pre>
                </div>
              </details>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
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

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla mesai cetveli</h2>
              </div>
              <ZamanasimiCetvelBanner nihaiBaslangic={zamanasimiBaslangic} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-gray-900 dark:text-gray-100">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Dönem</th>
                      {vardiyaMode === "24" ? (
                        <>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Hafta tipi</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Toplam hafta</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Haftalık FM saat</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Brüt Ücret</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">225</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">1,5</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Ücret</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-1 py-1.5 w-14" aria-label="Satır işlemleri" />
                        </>
                      ) : (
                        <>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Hafta tipi</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Toplam hafta</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Ücret</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Kat</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Fazla Mesai Saati</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">225</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">1,5</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Fazla Mesai</th>
                          <th className="border border-gray-200 dark:border-gray-600 px-1 py-1.5 w-14" aria-label="Satır işlemleri" />
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={vardiyaMode === "24" ? 9 : 10} className="border border-gray-200 dark:border-gray-600 px-2 py-6 text-center text-gray-500">
                          Tarih aralığını girin.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) =>
                        vardiyaMode === "24" ? (
                          <tr key={r.id || `${r.startISO}-${r.endISO}-${i}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={r.startISO?.slice(0, 10) || ""}
                                  onChange={(e) => {
                                    const raw = e.target.value || "";
                                    applyRowPatch(r.id!, { startISO: raw ? clampToLastDayOfMonth(raw) : "" });
                                  }}
                                  className={`${tableInputCls} flex-1 min-w-0 text-left`}
                                />
                                <span className="text-gray-400 shrink-0">–</span>
                                <input
                                  type="date"
                                  value={r.endISO?.slice(0, 10) || ""}
                                  onChange={(e) => {
                                    const raw = e.target.value || "";
                                    applyRowPatch(r.id!, { endISO: raw ? clampToLastDayOfMonth(raw) : "" });
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
                            <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-left">
                              {r.weekTypeLabel || "-"}
                            </td>
                            <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={r.weeks ?? 0}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  applyRowPatch(r.id!, { weeks: Number.isNaN(v) ? 0 : Math.max(0, v) });
                                }}
                                className={tableInputCls}
                              />
                            </td>
                            <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={r.fmHours ?? 0}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value.replace(",", "."));
                                  applyRowPatch(r.id!, { fmHours: Number.isNaN(v) ? 0 : Math.max(0, v) });
                                }}
                                className={tableInputCls}
                              />
                            </td>
                            <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={r.brut ?? 0}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value.replace(",", "."));
                                  applyRowPatch(r.id!, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) });
                                }}
                                className={tableInputCls}
                              />
                            </td>
                            <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">225</td>
                            <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">1,5</td>
                            <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right font-medium">{fmt(r.fm)}</td>
                            <td className="border border-gray-200 dark:border-gray-600 px-1 py-1 align-middle">
                              <div className="flex items-center justify-center gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={() => addRow(r.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(r.id!)}
                                  disabled={rows.length <= 1}
                                  className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 font-medium"
                                  aria-label="Satırı sil"
                                >
                                  -
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                        <tr key={r.id || `${r.startISO}-${r.endISO}-${i}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={r.startISO?.slice(0, 10) || ""}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  applyRowPatch(r.id!, { startISO: raw ? clampToLastDayOfMonth(raw) : "" });
                                }}
                                className={`${tableInputCls} flex-1 min-w-0 text-left`}
                              />
                              <span className="text-gray-400 shrink-0">–</span>
                              <input
                                type="date"
                                value={r.endISO?.slice(0, 10) || ""}
                                onChange={(e) => {
                                  const raw = e.target.value || "";
                                  applyRowPatch(r.id!, { endISO: raw ? clampToLastDayOfMonth(raw) : "" });
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
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-left">
                            {r.weekTypeLabel || "-"}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.weeks ?? 0}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                applyRowPatch(r.id!, { weeks: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.brut ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                applyRowPatch(r.id!, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.0001}
                              value={r.katsayi ?? 1}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                applyRowPatch(r.id!, { katsayi: Number.isNaN(v) || v <= 0 ? 1 : v });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.fmHours ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                applyRowPatch(r.id!, { fmHours: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">
                            {vardiyaMode === "24" ? "-" : (r.calc225 ?? 225).toLocaleString("tr-TR")}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">
                            {vardiyaMode === "24" ? "-" : (r.factor ?? 1.5).toLocaleString("tr-TR")}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right font-medium">{fmt(r.fm)}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-1 py-1 align-middle">
                            <div className="flex items-center justify-center gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => addRow(r.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(r.id!)}
                                disabled={rows.length <= 1}
                                className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 font-medium"
                              >
                                -
                              </button>
                            </div>
                          </td>
                        </tr>
                        )
                      )
                    )}
                    {rows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-semibold">
                        <td colSpan={vardiyaMode === "24" ? 7 : 8} className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">
                          Toplam
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {fmtCurrency(totalBrut)}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right" />
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

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet indirimi / mahsuplaşma</h2>
              <p className="text-xs text-pink-800/80 dark:text-pink-200/70 mb-3">
                Son net alacak, brüt fazla mesai üzerinden 1/3 hakkaniyet indirimi ve (varsa) mahsuplaşma düşülerek hesaplanır. Brütten nete bölümündeki vergi kesintileri ayrıdır.
              </p>
              <div className="divide-y divide-pink-200/80 dark:divide-pink-800/60 text-sm">
                <div className="flex justify-between py-1.5">
                  <span>Toplam fazla mesai (brüt)</span>
                  <span className="font-medium tabular-nums">{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>1/3 hakkaniyet indirimi</span>
                  <span className="tabular-nums">-{fmtCurrency(hakkaniyetIndirimi)}</span>
                </div>
                {mahsupNum > 0 && (
                  <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                    <span>Mahsuplaşma</span>
                    <span className="tabular-nums">-{fmtCurrency(mahsupNum)}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-end py-1.5">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Mahsuplaşma miktarı</label>
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
                    Mahsuplaşma ekle
                  </button>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-pink-950 dark:text-pink-100">
                  <span>Son net alacak</span>
                  <span className="tabular-nums">{fmtCurrency(sonNet)}</span>
                </div>
              </div>
            </section>

            <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div id="report-content-vardiya" style={{ fontFamily: "Inter, Arial", maxWidth: "16cm", padding: "8px" }}>
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
          copyTargetId: "vardiya-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <div id="vardiya-word-copy">
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
          onPdf: () => downloadPdfFromDOM(pageTitle, "report-content-vardiya"),
        }}
      />
    </div>
  );
}
