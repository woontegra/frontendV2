/**
 * 24 / 48 saat vardiya fazla mesai — tek sayfa; üstte mod seçimi.
 * API: /api/fm/vardiya24 | /api/fm/vardiya48 (v1 ile aynı payload mantığı)
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
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";

const REDIRECT_BASE = "/fazla-mesai/vardiya-24-48";
const RECORD_24 = "fazla_mesai_vardiya_24";
const RECORD_48 = "fazla_mesai_vardiya_48";
const HAFTALIK_MESAI_24 = 10.5;
const HAFTALIK_MESAI_48 = 7.5;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type VardiyaRow = {
  rangeLabel: string;
  weeks: number;
  brut: number;
  katsayi: number;
  fmHours: number;
  fmType: string;
  fm: number;
  net: number;
  startISO: string;
  endISO: string;
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

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function buildOvertimeIntervals(
  dStart: string,
  dEnd: string,
  taniklar: Array<{ dateIn: string; dateOut: string }>
): Array<{ start: string; end: string }> {
  const dStartDate = new Date(dStart);
  const dEndDate = new Date(dEnd);
  const clipped: Array<{ start: string; end: string }> = [];
  taniklar.forEach((t) => {
    if (!t.dateIn || !t.dateOut) return;
    const tStart = new Date(t.dateIn);
    const tEnd = new Date(t.dateOut);
    if (tEnd < dStartDate || tStart > dEndDate) return;
    const clippedStart = tStart < dStartDate ? dStart : t.dateIn.slice(0, 10);
    const clippedEnd = tEnd > dEndDate ? dEnd : t.dateOut.slice(0, 10);
    clipped.push({ start: clippedStart, end: clippedEnd });
  });
  if (clipped.length === 0) return [{ start: dStart, end: dEnd }];
  return clipped;
}

export default function Vardiya24_48Page() {
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

  const [vardiyaMode, setVardiyaMode] = useState<"24" | "48">("24");
  const [rows, setRows] = useState<VardiyaRow[]>([]);
  const [stepsText, setStepsText] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const { iseGiris, istenCikis, weeklyDays, davaci, taniklar, mode270, katSayi, mahsuplasmaMiktari } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;
  const include270 = mode270 !== "none";

  const pageTitle = vardiyaMode === "48" ? "48 Saat Çalışma Hesaplama" : "24 Saat Çalışma Hesaplama";
  const recordType = vardiyaMode === "48" ? RECORD_48 : RECORD_24;
  const videoLink = getVideoLink(vardiyaMode === "48" ? "fazla-vardiya48" : "fazla-vardiya24");

  const bilirkisiBlurb =
    vardiyaMode === "48"
      ? "48/48 bilirkişi: 9 saatlik haftalar (hafta/2 yukarı) × 9; 6 saatlik haftalar (hafta/2 aşağı) × 6."
      : "24/24 bilirkişi: 12 saatlik haftalar (hafta/2 yukarı) × 12; 9 saatlik haftalar (hafta/2 aşağı) × 9.";

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
          if (inner.vardiyaMode === "24" || inner.vardiyaMode === "48") {
            setVardiyaMode(inner.vardiyaMode);
          } else {
            setVardiyaMode(mode48 ? "48" : "24");
          }
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
        if (Array.isArray(inner.rows) && inner.rows.length > 0) {
          setRows(inner.rows);
        }
        if (json.name && mounted) setCurrentRecordName(json.name);
        if (mounted) success("Kayıt yüklendi");
      } catch (e) {
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

  const exclusionsForApi = useMemo(() => {
    if (!Array.isArray(exclusions)) return [];
    return exclusions
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
      .filter((e) => e.start.length >= 10 && e.end.length >= 10);
  }, [exclusions]);

  const runBackend = useCallback(async () => {
    const dStart = normalizeDateInput(iseGiris);
    const dEnd = normalizeDateInput(istenCikis);
    if (!dStart || !dEnd) {
      setRows([]);
      setStepsText("");
      return;
    }
    const rid = ++reqIdRef.current;
    setIsCalculating(true);
    try {
      const overtimeResults = buildOvertimeIntervals(dStart, dEnd, taniklar);
      const zNorm = zamanasimiBaslangic ? normalizeDateInput(zamanasimiBaslangic) : null;
      const haftalikMesai = vardiyaMode === "48" ? HAFTALIK_MESAI_48 : HAFTALIK_MESAI_24;

      const basePayload = {
        iseGiris: dStart,
        istenCikis: dEnd,
        girisSaati: "00:00",
        cikisSaati: "00:00",
        weeklyDays: Number(weeklyDays) || 6,
        exclusions: exclusionsForApi,
        katSayi: katSayi || 1,
        zamanasimiBaslangic: zNorm,
        include270,
        haftalikMesai,
        overtimeResults,
        davaciBeyani: { startDate: dStart, endDate: dEnd },
      };

      const endpoint = vardiyaMode === "48" ? "/api/fm/vardiya48" : "/api/fm/vardiya24";
      const payload =
        vardiyaMode === "48"
          ? basePayload
          : {
              ...basePayload,
              mode270: mode270 === "simple" ? "simple" : "detailed",
            };

      const response = await apiPost(endpoint, payload);
      if (rid !== reqIdRef.current) return;
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
      const backendResult = await response.json();
      if (rid !== reqIdRef.current) return;
      const backendRows = backendResult.rows || [];
      setStepsText(backendResult.stepsText || "");
      setRows(
        backendRows.map((row: Record<string, unknown>) => {
          const startISO = String(row.startDate || "");
          const endISO = String(row.endDate || "");
          return {
            rangeLabel: `${formatDateTR(startISO)}–${formatDateTR(endISO)}`,
            weeks: Number(row.weeks) || 0,
            brut: Number(row.brut) || 0,
            katsayi: Number(row.katSayi) || 1,
            fmHours: Number(row.fmHours) || 0,
            fmType: String(row.fmType ?? ""),
            fm: Number(row.fm) || 0,
            net: Number(row.net) || 0,
            startISO,
            endISO,
          };
        })
      );
    } catch (e) {
      if (rid === reqIdRef.current) {
        setRows([]);
        setStepsText("");
        console.error("[Vardiya24/48]", e);
      }
    } finally {
      if (rid === reqIdRef.current) setIsCalculating(false);
    }
  }, [
    iseGiris,
    istenCikis,
    weeklyDays,
    taniklar,
    exclusionsForApi,
    katSayi,
    zamanasimiBaslangic,
    include270,
    mode270,
    vardiyaMode,
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
            rows,
            pageType: "vardiya-24-48",
            route: REDIRECT_BASE,
          },
          results: { rows, totalBrut, totalNet: brutNetResult.netYillik },
        },
        formValues: { ...formValues, vardiyaMode, rows },
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
    vardiyaMode,
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
    if (effectiveId) navigate(REDIRECT_BASE);
  }, [effectiveId, navigate]);

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
    const cetvelHeaders = ["Dönem", "Hafta", "Ücret", "Kat", "FM Saat", "Tür", "225", "1,5", "FM"];
    const cetvelRows = rows.map((r) => [
      r.rangeLabel,
      r.weeks,
      fmt(r.brut),
      r.katsayi,
      r.fmHours.toFixed(2),
      r.fmType || "-",
      "225",
      "1,5",
      fmt(r.fm),
    ]);
    cetvelRows.push(["", "", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
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
                onChange={(e) => setVardiyaMode(e.target.value as "24" | "48")}
                className={inputCls}
              >
                <option value="24">24 saat çalışma (12/9 bilirkişi dağılımı)</option>
                <option value="48">48 saat çalışma (9/6 bilirkişi dağılımı)</option>
              </select>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-2">{bilirkisiBlurb}</p>
            </div>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Dava dönemi ve haftalık gün</h2>
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
                  <label className={labelCls}>Haftada çalışılan gün</label>
                  <select value={String(weeklyDays)} onChange={(e) => handleFormChange({ weeklyDays: e.target.value })} className={inputCls}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} gün
                      </option>
                    ))}
                  </select>
                </div>
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
                Tanık tarihleri davacı dönemine göre kırpılır; tanık yoksa tüm dönem tek aralık olarak hesaplanır (v1 ile aynı).
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
                  Metin / adımlar (sunucu)
                </summary>
                <div className="p-4">
                  {isCalculating && <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>}
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-800 dark:text-gray-200">
                    {stepsText || bilirkisiBlurb}
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
                      <button type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => { handleFormChange({ mode270: "none" }); setShow270Dropdown(false); }}>
                        Kapalı
                      </button>
                      <button type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => { handleFormChange({ mode270: "detailed" }); setShow270Dropdown(false); }}>
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
                        Yargıtay {vardiyaMode === "48" ? "(24 saatte tam; 48 saatte şirket mantığına yakın)" : ""}
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
              {vardiyaMode === "48" && mode270 === "simple" && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                  48 saat backend yalnızca hafta bazlı 270 düşümü uygular; Yargıtay seçeneği 24 saat modunda tam etkilidir.
                </p>
              )}
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
                <table className="w-full text-xs border-collapse min-w-[720px] text-gray-900 dark:text-gray-100">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Dönem</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Hafta</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Ücret</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">Kat</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">FM saat</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-center">Tür</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">225</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">1,5</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">FM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="border border-gray-200 dark:border-gray-600 px-2 py-6 text-center text-gray-500">
                          Tarih aralığını girin.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={`${r.startISO}-${r.endISO}-${i}-${r.fmType}`}>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1">{r.rangeLabel}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{r.weeks}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{fmt(r.brut)}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{r.katsayi}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">{r.fmHours.toFixed(2)}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-center">{r.fmType}</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">225</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right">1,5</td>
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-right font-medium">{fmt(r.fm)}</td>
                        </tr>
                      ))
                    )}
                    {rows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-semibold">
                        <td colSpan={8} className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-right">
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
