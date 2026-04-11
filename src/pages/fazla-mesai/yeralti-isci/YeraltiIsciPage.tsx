/**
 * Yeraltı İşçileri Fazla Mesai — backend /api/fm/yeralti-isci (çift asgari, 187.5, katsayı 2)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi, isoToTR } from "@/utils/dateUtils";
import { apiPost } from "@/utils/apiClient";
import { buildWordTable, adaptToWordTable, copySectionForWord } from "@modules/fazla-mesai/shared";
import { YillikIzinPanel } from "../standart/YillikIzinPanel";
import { ZamanasimiModal } from "../standart/ZamanasimiModal";
import { KatsayiModal } from "../standart/KatsayiModal";
import { MahsuplasamaModal } from "../standart/MahsuplasamaModal";
import { NotlarAccordion } from "../standart/NotlarAccordion";
import { Copy, Plus, Trash2 } from "lucide-react";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { useTanikliStandartState } from "../tanikli-standart/state";
import { fmt, fmtCurrency } from "../standart/calculations";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";

const PAGE_TITLE = "Yeraltı İşçileri Fazla Mesai Hesaplama";
const RECORD_TYPE = "fazla_mesai_yeralti_isci";
const REDIRECT_BASE_PATH = "/fazla-mesai/yeralti-isci";
const FAZLA_MESAI_DENOMINATOR = 187.5;
const FAZLA_MESAI_KATSAYI = 2;
const GELIR_VERGISI_BIRINCI_DILIM_ORANI = 0.15;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

export type YeraltiPeriodRow = {
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

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function recalcYeraltiFmNet(row: YeraltiPeriodRow, fmHours: number, katOverride: number): Pick<YeraltiPeriodRow, "fm" | "net"> {
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

export default function YeraltiIsciPage() {
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

  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [rows, setRows] = useState<YeraltiPeriodRow[]>([]);
  const [textPeriods, setTextPeriods] = useState<Array<{ startDate?: string; endDate?: string; text?: string }>>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [haftalikMesai, setHaftalikMesai] = useState(0);
  const backendRequestIdRef = useRef(0);

  const { iseGiris, istenCikis, weeklyDays, davaci, taniklar, mode270, katSayi, mahsuplasmaMiktari } = formValues;
  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;
  const include270 = mode270 !== "none";

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
        const innerForm = raw?.data?.form || raw;
        setFormValues((p) => ({
          ...p,
          ...(innerForm.iseGiris != null && { iseGiris: innerForm.iseGiris }),
          ...(innerForm.istenCikis != null && { istenCikis: innerForm.istenCikis }),
          ...(innerForm.weeklyDays != null && { weeklyDays: String(innerForm.weeklyDays) }),
          ...(innerForm.davaci && { davaci: { ...p.davaci, ...innerForm.davaci } }),
          ...(Array.isArray(innerForm.taniklar) && innerForm.taniklar.length > 0 && { taniklar: innerForm.taniklar }),
          ...(innerForm.mode270 && { mode270: innerForm.mode270 }),
          ...(innerForm.katSayi != null && { katSayi: innerForm.katSayi }),
          ...(innerForm.mahsuplasmaMiktari != null && { mahsuplasmaMiktari: innerForm.mahsuplasmaMiktari }),
          ...(Array.isArray(innerForm.exclusions) && { exclusions: innerForm.exclusions }),
          ...(innerForm.zamanasimi != null && { zamanasimi: innerForm.zamanasimi }),
        }));
        const loadedRows = innerForm.rows ?? raw.rows;
        if (Array.isArray(loadedRows) && loadedRows.length > 0) {
          setRows(loadedRows as YeraltiPeriodRow[]);
        }
        if (res.name) setCurrentRecordName(res.name);
        success("Kayıt yüklendi");
      })
      .catch((err) => {
        if (mounted) showToastError(err.message || "Kayıt yüklenemedi");
      });
    return () => {
      mounted = false;
    };
  }, [effectiveId, success, showToastError, setFormValues, setCurrentRecordName]);

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

  const apiMode270 = mode270 === "simple" ? "simple" : "detailed";

  useEffect(() => {
    if (rows.length > 0 && rows[0].fmHours != null) {
      setHaftalikMesai(Number(rows[0].fmHours));
    } else {
      setHaftalikMesai(0);
    }
  }, [rows]);

  useEffect(() => {
    if (!iseGiris?.trim() || !istenCikis?.trim()) {
      setRows([]);
      setTextPeriods([]);
      return;
    }
    const t = setTimeout(() => {
      const requestId = ++backendRequestIdRef.current;
      (async () => {
        try {
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

          const payload = {
            davaci: {
              in: davaci?.in || "",
              out: davaci?.out || "",
              dateIn: iseGiris || "",
              dateOut: istenCikis || "",
            },
            witnesses: taniklar,
            weeklyDays: Number(weeklyDays) || 6,
            activeTab,
            exclusions: exclusionsForApi,
            katSayi: katSayi || 1,
            zamanasimiBaslangic: zamanasimiBaslangic || null,
            include270,
            mode270: apiMode270,
            /** Backend computeClassic şu an payload haftalikMesai kullanmıyor; döngüyü önlemek için 0 */
            haftalikMesai: 0,
            iseGiris,
            istenCikis,
          };

          const response = await apiPost("/api/fm/yeralti-isci", payload);
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
          const fromBackend: YeraltiPeriodRow[] = (result.rows || []).map((r: YeraltiPeriodRow) => ({ ...r }));
          setRows((prev) => {
            if (fromBackend.length === 0) return fromBackend;
            if (prev.length !== fromBackend.length) return fromBackend;
            return fromBackend.map((backendRow, idx) => {
              const cur = prev[idx];
              if (cur?.fmManual && cur.fmHours !== undefined) {
                const { fm, net } = recalcYeraltiFmNet(backendRow, cur.fmHours, katSayi || 1);
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
            console.error("[Yeraltı İşçileri]", e);
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
    apiMode270,
  ]);

  const totalBrut = useMemo(() => rows.reduce((a, r) => a + (r.fm || 0), 0), [rows]);

  const brutNetResult = useMemo(() => {
    if (totalBrut <= 0) return { gelirVergisi: 0, damgaVergisi: 0, netYillik: 0, gelirVergisiDilimleri: "" };
    const sgk = Math.round(totalBrut * SSK_ORAN * 100) / 100;
    const issizlik = Math.round(totalBrut * ISSIZLIK_ORAN * 100) / 100;
    const sskPrim = totalBrut * 0.15;
    const matrah = Math.max(0, totalBrut - sskPrim);
    const gelirVergisi = Math.round(matrah * GELIR_VERGISI_BIRINCI_DILIM_ORANI * 100) / 100;
    const damgaVergisi = Math.round(totalBrut * DAMGA_VERGISI_ORANI * 100) / 100;
    const netYillik = Math.round((totalBrut - sgk - issizlik - gelirVergisi - damgaVergisi) * 100) / 100;
    return { gelirVergisi, damgaVergisi, netYillik, gelirVergisiDilimleri: "(%15)" };
  }, [totalBrut]);

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

  const updateRowFmHours = useCallback(
    (idx: number, fmHours: number) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== idx) return r;
          const { fm, net } = recalcYeraltiFmNet(r, fmHours, katSayi || 1);
          return { ...r, fmHours, fm, net, fmManual: true };
        })
      );
    },
    [katSayi]
  );

  const handleSave = useCallback(() => {
    kaydetAc({
      hesapTuru: RECORD_TYPE,
      veri: {
        data: {
          form: {
            ...formValues,
            rows,
            include270,
            zamanasimiBaslangic,
            pageType: "yeralti-isci",
            route: REDIRECT_BASE_PATH,
          },
          results: {
            rows,
            totalBrut,
            totalNet: brutNetResult.netYillik,
            weeklyFMHours: haftalikMesai,
          },
        },
        formValues: { ...formValues, rows, include270 },
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
      redirectPath: "/fazla-mesai/yeralti-isci/:id",
    });
  }, [
    kaydetAc,
    formValues,
    rows,
    include270,
    zamanasimiBaslangic,
    totalBrut,
    brutNetResult.netYillik,
    haftalikMesai,
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

  const fmPeriodsForUi = useMemo(() => {
    if (textPeriods.length > 0) {
      return textPeriods.map((p) => ({
        text:
          p.text ||
          `${formatDateTR(p.startDate)} – ${formatDateTR(p.endDate)}`,
      }));
    }
    return [];
  }, [textPeriods]);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi", "Haftalık FM Saat"],
      rows: [[isoToTR(iseGiris), isoToTR(istenCikis), diff.label, haftalikMesai.toFixed(2)]],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });

    const cetvelHeaders = ["Dönem", "Hafta", "Ücret (2×AU)", "Katsayı", "FM Saat", "187,5", "2", "Fazla Mesai"];
    const cetvelRows = rows.map((r) => [
      `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}`,
      r.weeks ?? 0,
      fmt(r.brut ?? 0),
      r.katsayi ?? 1,
      (r.fmHours ?? 0).toFixed(2),
      "187,5",
      "2",
      fmt(r.fm ?? 0),
    ]);
    cetvelRows.push(["", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Hesaplama Cetveli (Yeraltı)",
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

    if (mahsupNum > 0) {
      const mahsupRows: { label: string; value: string }[] = [
        { label: "Toplam Fazla Mesai (Brüt)", value: fmtCurrency(totalBrut) },
        { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtCurrency(hakkaniyetIndirimi)}` },
        { label: "Mahsuplaşma Miktarı", value: `-${fmtCurrency(mahsupNum)}` },
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
    haftalikMesai,
    rows,
    totalBrut,
    brutNetResult,
    mahsupNum,
    hakkaniyetIndirimi,
    sonNet,
    exclusions,
  ]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content-yeralti");
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
  }, []);

  const videoLink = getVideoLink("fazla-yeralti-isci");

  return (
    <div
      className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`}
      data-page="fazla-mesai-yeralti-isci"
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

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              Yeraltı işçileri: haftalık çalışma limiti 37:30; ücret tablosunda çift asgari ücret; bölücü 187,5 ve çarpan 2 uygulanır.
            </p>

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
                  <label className={labelCls}>Haftada Çalışılan Gün (1-7)</label>
                  <select
                    value={String(weeklyDays)}
                    onChange={(e) => handleFormChange({ weeklyDays: e.target.value })}
                    className={inputCls}
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
                Dönemler davacı ile tanık tarih kesişimine göre sunucuda hesaplanır.
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
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <details className="group" open>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between list-none">
                  <span>Metin Hesaplaması</span>
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="p-4">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">
                    Metinler sunucu hesaplamasından gelir (yeraltı usulü, 6:15 hafta tatili referansı).
                  </p>
                  {Number(weeklyDays) === 7 && (
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab("tatilsiz")}
                        className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                          activeTab === "tatilsiz"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
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
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Hafta Tatilli
                      </button>
                    </div>
                  )}
                  <div className="bg-[#f1f3f5] dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    {isCalculating && (
                      <p className="text-xs text-gray-500 mb-2">Hesaplanıyor…</p>
                    )}
                    {fmPeriodsForUi.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {fmPeriodsForUi.map((p, idx) => (
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
                        Tarihleri ve en az bir geçerli tanık aralığını girin; haftalık FM:{" "}
                        <span className="font-mono font-semibold">{haftalikMesai.toFixed(2).replace(".", ",")}</span> saat
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
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {mode270 === "none" && "270 Saat"}
                    {mode270 === "detailed" && "270 (Şirket)"}
                    {mode270 === "simple" && "270 (Yargıtay)"}
                    <svg className={`w-3.5 h-3.5 transition-transform ${show270Dropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  onClick={() => (zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    zamanasimiBaslangic ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
                </button>
                <button
                  type="button"
                  onClick={() => (hasCustomKatsayi ? handleFormChange({ katSayi: 1 }) : setShowKatsayiModal(true))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                    hasCustomKatsayi ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {hasCustomKatsayi ? `Katsayı ${katSayi?.toFixed(2) || "1"}` : "Kat Sayı"}
                </button>
              </div>
            </section>

            <YillikIzinPanel exclusions={exclusions} setExclusions={setExclusions} success={success} showToastError={showToastError} />

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla Mesai Cetveli (Yeraltı)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse font-sans table-fixed" style={{ minWidth: "640px" }}>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="px-2 py-1.5 text-left border border-gray-200 dark:border-gray-600 font-semibold">Dönem</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Hafta</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Ücret</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Kat</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">FM Saat</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">187,5</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">2</th>
                      <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">FM Tutarı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-4 border border-gray-200 dark:border-gray-600 text-center text-gray-500">
                          İşe giriş/çıkış, davacı saatleri ve tanık aralıklarını girin.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={`${r.startISO}-${r.endISO}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600">
                            {formatDateTR(r.startISO)} – {formatDateTR(r.endISO)}
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">{r.weeks}</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">{fmt(r.brut)}</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">{r.katsayi ?? 1}</td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.fmHours ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                if (!Number.isNaN(v)) updateRowFmHours(i, Math.max(0, v));
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">187,5</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">2</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium">{fmt(r.fm)}</td>
                        </tr>
                      ))
                    )}
                    {rows.length > 0 && (
                      <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600">Toplam</td>
                        <td colSpan={6} className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                        <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 text-right">{fmtCurrency(totalBrut)}</td>
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
                  <span>Damga Vergisi</span>
                  <span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-green-700 dark:text-green-400">
                  <span>Net Fazla Mesai</span>
                  <span>{fmtCurrency(brutNetResult.netYillik)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet / Mahsuplaşma</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-sm">
                <div className="flex justify-between py-1.5">
                  <span>Toplam (Brüt)</span>
                  <span className="font-medium">{fmtCurrency(totalBrut)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400">
                  <span>1/3 Hakkaniyet</span>
                  <span>-{fmtCurrency(hakkaniyetIndirimi)}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-end py-1.5">
                  <div>
                    <label className={labelCls}>Mahsuplaşma</label>
                    <input
                      type="text"
                      value={mahsuplasmaMiktari}
                      onChange={(e) => handleFormChange({ mahsuplasmaMiktari: e.target.value })}
                      className={`${inputCls} max-w-[160px]`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMahsuplasamaModal(true)}
                    className="px-3 py-2 text-sm rounded border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300"
                  >
                    Mahsuplaşma Ekle
                  </button>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold">
                  <span>Son Net</span>
                  <span>{fmtCurrency(sonNet)}</span>
                </div>
              </div>
            </section>

            <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div id="report-content-yeralti" style={{ fontFamily: "Inter, Arial", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}>
          <style>{`#report-content-yeralti table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content-yeralti td,#report-content-yeralti th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
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
      <KatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={(k) => handleFormChange({ katSayi: k })} />
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onClose={() => setShowMahsuplasamaModal(false)}
        onSave={(total) => handleFormChange({ mahsuplasmaMiktari: String(total.toFixed(2)) })}
        periodLabels={rows.map((r) => r.startISO || "").filter(Boolean)}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : effectiveId ? "Güncelle" : "Kaydet"}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "yeralti-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`
                .report-section-copy{margin-bottom:1.25rem}
                #yeralti-word-copy table{border-collapse:collapse;width:100%;font-size:0.75rem}
                #yeralti-word-copy td,#yeralti-word-copy th{border:1px solid #999;padding:5px 8px}
              `}</style>
              <div id="yeralti-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy" data-section={sec.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-xs text-gray-700">{sec.title}</span>
                      <button
                        type="button"
                        className="p-1 text-gray-500"
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
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content-yeralti"),
        }}
      />
    </div>
  );
}
