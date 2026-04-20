/**
 * Gemi adamı fazla mesai — tek sayfa; üstte günlük / 7-24 modu.
 * API: /api/fm/gemi | /api/fm/gemi-full-crew24
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, isoToTR } from "@/utils/dateUtils";
import { apiClient, apiPost } from "@/utils/apiClient";
import { buildWordTable, adaptToWordTable, copySectionForWord } from "@modules/fazla-mesai/shared";
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
import { ceilWeeklyWorkHoursToHalfHour } from "@/shared/utils/fazlaMesai/weeklyHoursRounding";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";

const REDIRECT_BASE = "/fazla-mesai/gemi-adami";
const RECORD_GUNLUK = "fazla_mesai_gemi_gunluk";
const RECORD_724 = "fazla_mesai_gemi_7_24";
const HAFTALIK_FM_724 = 35;
const FAZLA_MESAI_DENOMINATOR = 240;
const FAZLA_MESAI_KATSAYI = 1.25;
const GELIR_VERGISI_BIRINCI_DILIM_ORANI = 0.15;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type GemiRow = {
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
};

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

export default function GemiAdamiPage() {
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

  const [gemiMode, setGemiMode] = useState<"gunluk" | "724">("gunluk");
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [rows, setRows] = useState<GemiRow[]>([]);
  const [textPeriods, setTextPeriods] = useState<Array<{ startDate?: string; endDate?: string; text?: string }>>([]);
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

  const { iseGiris, istenCikis, weeklyDays, davaci, taniklar, mode270, katSayi, mahsuplasmaMiktari } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;
  const include270 = mode270 !== "none";

  const recordType = gemiMode === "724" ? RECORD_724 : RECORD_GUNLUK;
  const pageTitle =
    gemiMode === "724" ? "Gemi Adamı — 7/24 Çalışan Fazla Mesai" : "Gemi Adamı — Günlük Çalışan Fazla Mesai";
  const videoLink = getVideoLink(gemiMode === "724" ? "fazla-gemi-7-24" : "fazla-gemi");

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
          if (inner.gemiMode === "gunluk" || inner.gemiMode === "724") {
            setGemiMode(inner.gemiMode);
          } else {
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
          setRows(loadedRows as GemiRow[]);
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

  const ubgtFmCatalogRange = useMemo(() => {
    const dIn = (iseGiris || davaci?.dateIn || "").slice(0, 10);
    const dOut = (istenCikis || davaci?.dateOut || "").slice(0, 10);
    let start = dIn;
    let end = dOut;
    for (const t of taniklar) {
      const a = (t.dateIn || "").slice(0, 10);
      const b = (t.dateOut || "").slice(0, 10);
      if (a && (!start || a < start)) start = a;
      if (b && (!end || b > end)) end = b;
    }
    if (!start || !end || start > end) return { start: "", end: "" };
    return { start, end };
  }, [iseGiris, istenCikis, davaci?.dateIn, davaci?.dateOut, taniklar]);

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
            return {
              rangeLabel: String(r.rangeLabel || ""),
              weeks: Number(r.weeks) || 0,
              brut: Number(r.brut) || 0,
              katsayi: Number(r.katsayi) || 1,
              fmHours: Number(r.fmHours) || 0,
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
              const fm = Math.max(0, ceilWeeklyWorkHoursToHalfHour(net * _hg) - 45);
              return { startMs: new Date(t.dateIn).getTime(), endMs: new Date(t.dateOut).getTime(), fmHours: fm };
            });

          // Her satır için: o tarihi kapsayan aktif tanıklar arasından en yüksek FM seç
          const withBestFM = fromBackend.map((row) => {
            const rS = new Date(row.startISO).getTime(); const rE = new Date(row.endISO).getTime();
            const active = _tanikFM.filter((t) => t.startMs <= rS && t.endMs >= rE);
            if (active.length === 0) return row;
            const best = active.reduce((p, c) => (c.fmHours > p.fmHours ? c : p));
            if (best.fmHours === row.fmHours) return row;
            const { fm, net } = recalcGemiFmNet(row, best.fmHours, katSayi || 1);
            return { ...row, fmHours: best.fmHours, fm, net };
          });

          // Ardışık aynı FM saatli satırları birleştir (hafta toplamı doğru olsun)
          const merged: typeof withBestFM = [];
          for (const row of withBestFM) {
            const last = merged[merged.length - 1];
            if (last && last.fmHours === row.fmHours && last.brut === row.brut && last.katsayi === row.katsayi) {
              const totalWeeks = (last.weeks || 0) + (row.weeks || 0);
              const { fm, net } = recalcGemiFmNet({ ...last, weeks: totalWeeks }, last.fmHours, katSayi || 1);
              merged[merged.length - 1] = {
                ...last,
                endISO: row.endISO,
                rangeLabel: `${last.rangeLabel?.split(" – ")[0] ?? ""} – ${row.rangeLabel?.split(" – ")[1] ?? ""}`,
                weeks: totalWeeks,
                fm: String(fm), net: String(net),
              };
            } else {
              merged.push({ ...row });
            }
          }
          const processedFromBackend = merged;
          // ──────────────────────────────────────────────────────────────────────

          setRows((prev) => {
            if (processedFromBackend.length === 0) return processedFromBackend;
            if (prev.length !== processedFromBackend.length) return processedFromBackend;
            return processedFromBackend.map((backendRow, idx) => {
              const cur = prev[idx];
              if (cur?.fmManual && cur.fmHours !== undefined) {
                const { fm, net } = recalcGemiFmNet(backendRow, cur.fmHours, katSayi || 1);
                return { ...backendRow, fmHours: cur.fmHours, fm, net, fmManual: true, katsayi: backendRow.katsayi };
              }
              return backendRow;
            });
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
    gemiMode,
  ]);

  const stepsText = useMemo(() => {
    const parts = textPeriods.map((p) => p.text || "").filter(Boolean);
    if (parts.length > 0) return parts.join("\n\n");
    const fromRows = rows.map((r) => r.text || "").filter(Boolean);
    return fromRows.join("\n\n");
  }, [textPeriods, rows]);

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

  const updateRowFmHours = useCallback(
    (idx: number, fmHours: number) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== idx) return r;
          const { fm, net } = recalcGemiFmNet(r, fmHours, katSayi || 1);
          return { ...r, fmHours, fm, net, fmManual: true };
        })
      );
    },
    [katSayi]
  );

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
            route: REDIRECT_BASE,
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
      redirectPath: `${REDIRECT_BASE}/:id`,
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
    if (effectiveId) navigate(REDIRECT_BASE);
  }, [effectiveId, navigate]);

  const modeBlurb =
    gemiMode === "724"
      ? "7/24 çalışan gemi adamı: haftalık fazla mesai sunucuda 35 saat sabit; bölücü 240, çarpan 1,25."
      : "Günlük çalışan gemi adamı: haftalık limit 48 saat; ara dinlenme ve haftalık gün sayısına göre FM saati hesaplanır (bölücü 240, çarpan 1,25).";

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
    const cetvelRows = rows.map((r) => [
      r.rangeLabel || `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}`,
      r.weeks ?? 0,
      fmt(r.brut ?? 0),
      r.katsayi ?? 1,
      (r.fmHours ?? 0).toFixed(2),
      "240",
      "1,25",
      fmt(r.fm ?? 0),
    ]);
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
              <select
                value={gemiMode}
                onChange={(e) => setGemiMode(e.target.value as "gunluk" | "724")}
                className={inputCls}
              >
                <option value="gunluk">Günlük çalışan (giriş–çıkış saatleri, haftalık 48 saat limiti)</option>
                <option value="724">7/24 çalışan (sabit 35 saat haftalık FM)</option>
              </select>
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
              {gemiMode === "gunluk" && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                  Günlük modda giriş ve çıkış saatleri zorunludur.
                </p>
              )}
              {gemiMode === "724" && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  7/24 modda saat alanları isteğe bağlıdır; boş bırakılırsa 00:00 gönderilir.
                </p>
              )}
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
              <p className="text-xs text-gray-500 mb-3">Tanık tarihleri davacı dönemine göre sunucuda kırpılır.</p>
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
                    <div className="w-24">
                      <label className={labelCls}>Giriş</label>
                      <input type="time" value={t.in} onChange={(e) => updateWitness(t.id, { in: e.target.value })} className={inputCls} />
                    </div>
                    <div className="w-24">
                      <label className={labelCls}>Çıkış</label>
                      <input type="time" value={t.out} onChange={(e) => updateWitness(t.id, { out: e.target.value })} className={inputCls} />
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

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <details open className="group">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 list-none">
                  Metin / adımlar (sunucu)
                </summary>
                <div className="p-4">
                  {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-200">
                    {stepsText || modeBlurb}
                  </pre>
                </div>
              </details>
            </section>

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
                270 ve zamanaşımı sunucuda gemi usulüne göre uygulanır; şirket/Yargıtay ayrımı kayıtta saklanır, API yalnızca düşümün açık/kapalı olduğunu kullanır.
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

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla mesai cetveli</h2>
              </div>
              <ZamanasimiCetvelBanner nihaiBaslangic={zamanasimiBaslangic} />
              <div className="overflow-x-auto p-2">
                <table className="w-full text-xs border-collapse min-w-[680px] text-gray-900 dark:text-gray-100">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Dönem</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Hafta</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Ücret</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Kat</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">FM saat</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">240</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">1,25</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">FM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="border border-gray-200 dark:border-gray-600 px-2 py-6 text-center text-gray-500">
                          {gemiMode === "gunluk" && (!normalizeTimeStr(davaci?.in) || !normalizeTimeStr(davaci?.out))
                            ? "Tarih ve davacı giriş/çıkış saatlerini girin."
                            : "Tarih aralığını girin."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={`${r.startISO}-${r.endISO}-${i}`}>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1">
                            {r.rangeLabel || `${formatDateTR(r.startISO)}–${formatDateTR(r.endISO)}`}
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{r.weeks}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{fmt(r.brut)}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{r.katsayi}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">
                            <input
                              type="number"
                              step="0.5"
                              className="w-20 px-1 py-0.5 text-right rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                              value={r.fmHours}
                              onChange={(e) => updateRowFmHours(i, parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">240</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">1,25</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right font-medium">{fmt(r.fm)}</td>
                        </tr>
                      ))
                    )}
                    {rows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-semibold">
                        <td colSpan={7} className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">
                          Toplam
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">{fmtCurrency(totalBrut)}</td>
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
              <p className="text-sm font-semibold mt-3">Son net: {fmtCurrency(sonNet)}</p>
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
