/**
 * Kıdem Tazminatı — Kısmi Süreli / Part Time (360 gün, backend POST /api/kidem/kismi-sureli)
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Trash2, Youtube, Copy, Plus, AlertTriangle } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import KidemTazminatiForm from "./KidemTazminatiForm";
import EklentiModal from "./EklentiModal";
import { loadCalculation } from "./api";
import { parseNum, fmtCurrency, fmt } from "./calculations";
import { useKidem30State } from "./state";
import {
  calculatePeriodDays,
  convertDaysToYilAyGun,
  formatCalismaSuresiKismi,
  type WorkPeriod,
} from "./kismiSureliCalculations";
import { postKidemKismiSureli } from "./kidemKismiSureliApi";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { isoToTR } from "@/utils/dateUtils";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { copySectionForWord } from "@/utils/copyTableForWord";

const PAGE_TITLE = "Kıdem Tazminatı — Kısmi Süreli / Part Time";
const RECORD_TYPE = "kidem_kismi_sureli";
const REDIRECT_BASE_PATH = "/kidem-tazminati/kismi-sureli";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

export default function KidemKismiSureliPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const [isLoading, setIsLoading] = useState(false);
  const [formMountKey, setFormMountKey] = useState(0);
  const [eklentiModalTitle, setEklentiModalTitle] = useState("Eklenti Hesaplama");
  const [eklentiApply, setEklentiApply] = useState<(v: number) => void>(() => () => {});
  const loadedIdRef = useRef<string | null>(null);

  const [periods, setPeriods] = useState<WorkPeriod[]>([{ start: "", end: "", days: 0 }]);
  const [totalDaysManual, setTotalDaysManual] = useState("");
  const [isManualOverride, setIsManualOverride] = useState(false);

  const [kidemHesaplama, setKidemHesaplama] = useState({
    yilTutar: 0,
    ayTutar: 0,
    gunTutar: 0,
    toplamTutar: 0,
    warnings: [] as string[],
    kullanilacakBrut: 0,
    tavanUygulandi: false,
    tavanDegeri: null as number | null,
  });

  const {
    totals,
    setTotals,
    formValues,
    setFormValues,
    activeModal,
    setActiveModal,
    appliedEklenti,
    setAppliedEklenti,
    currentRecordName,
    setCurrentRecordName,
    exitDate,
    setExitDate,
    setTavanUygulandi,
    setTavanDegeri,
    eklentiValues,
    setEklentiValues,
    brutTazminat,
    setBrutTazminat,
    netTazminat,
    setNetTazminat,
    warnings,
    setWarnings,
  } = useKidem30State();

  const calculatedTotalDays = useMemo(
    () => periods.reduce((acc, p) => acc + (p.days || 0), 0),
    [periods]
  );

  useEffect(() => {
    if (!isManualOverride) {
      setTotalDaysManual(calculatedTotalDays > 0 ? String(calculatedTotalDays) : "");
    }
  }, [calculatedTotalDays, isManualOverride]);

  const effectiveTotalDays = useMemo(() => {
    const raw = totalDaysManual.trim();
    if (raw) {
      const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : calculatedTotalDays;
    }
    return calculatedTotalDays;
  }, [totalDaysManual, calculatedTotalDays]);

  const { yil: localYil, ay: localAy, gun: localGun } = useMemo(
    () => convertDaysToYilAyGun(effectiveTotalDays),
    [effectiveTotalDays]
  );

  const effectiveExitDate = useMemo(() => {
    const withEnd = periods.filter((p) => p.end && p.end.trim() !== "");
    if (withEnd.length > 0) {
      const sorted = [...withEnd].sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
      return sorted[0].end;
    }
    return exitDate || "";
  }, [periods, exitDate]);

  const iseGiris = useMemo(() => {
    const withStart = periods.filter((p) => p.start && p.start.trim() !== "");
    if (withStart.length > 0) {
      const sorted = [...withStart].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      return sorted[0].start;
    }
    return formValues.startDate || formValues.iseGiris || "";
  }, [periods, formValues.startDate, formValues.iseGiris]);

  const istenCikis = effectiveExitDate;

  const apiPeriods = useMemo((): WorkPeriod[] => {
    if (isManualOverride && effectiveTotalDays > 0) {
      const starts = periods.filter((p) => p.start).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      const ends = periods.filter((p) => p.end).sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
      const start = starts[0]?.start || "";
      const end = ends[0]?.end || exitDate || "";
      return [{ start, end, days: effectiveTotalDays }];
    }
    return periods;
  }, [isManualOverride, effectiveTotalDays, periods, exitDate]);

  const brutUcretToplam = useMemo(() => {
    const extras = formValues.extras || [];
    const extrasSum = extras.reduce((acc, it) => acc + parseNum(it.value), 0);
    return (
      parseNum(formValues.brutUcret || formValues.brut || "0") +
      parseNum(formValues.prim || "0") +
      parseNum(formValues.ikramiye || "0") +
      parseNum(formValues.yol || "0") +
      parseNum(formValues.yemek || "0") +
      parseNum(formValues.diger || "0") +
      extrasSum
    );
  }, [formValues]);

  const digerForApi = useMemo(
    () => String(parseNum(formValues.diger || "0") + parseNum(formValues.yol || "0")),
    [formValues.diger, formValues.yol]
  );

  const extrasForApi = useMemo(
    () =>
      (formValues.extras || []).map((x) => ({
        id: x.id,
        label: x.label,
        value: x.value ?? "",
      })),
    [formValues.extras]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (brutUcretToplam <= 0 || (localYil <= 0 && localAy <= 0 && localGun <= 0)) {
        if (cancelled) return;
        setKidemHesaplama({
          yilTutar: 0,
          ayTutar: 0,
          gunTutar: 0,
          toplamTutar: 0,
          warnings: [],
          kullanilacakBrut: 0,
          tavanUygulandi: false,
          tavanDegeri: null,
        });
        setBrutTazminat(0);
        setNetTazminat(0);
        setTotals({ toplam: brutUcretToplam, yil: 0, ay: 0, gun: 0 });
        setTavanUygulandi(false);
        setTavanDegeri(null);
        setWarnings([]);
        return;
      }

      try {
        const result = await postKidemKismiSureli({
          brutUcret: formValues.brutUcret || formValues.brut || "0",
          prim: formValues.prim || "0",
          ikramiye: formValues.ikramiye || "0",
          yemek: formValues.yemek || "0",
          diger: digerForApi,
          extras: extrasForApi,
          periods: apiPeriods,
          exitDate: effectiveExitDate || undefined,
        });

        if (cancelled) return;

        if (result.success && result.data) {
          const d = result.data;
          setKidemHesaplama({
            yilTutar: d.yilTutar || 0,
            ayTutar: d.ayTutar || 0,
            gunTutar: d.gunTutar || 0,
            toplamTutar: d.brut || 0,
            warnings: d.warnings || [],
            kullanilacakBrut: d.kullanilacakBrut ?? brutUcretToplam,
            tavanUygulandi: !!d.tavanUygulandi,
            tavanDegeri: d.tavanDegeri ?? null,
          });
          const brutVal = d.brut || 0;
          setBrutTazminat(brutVal);
          setNetTazminat(brutVal - brutVal * 0.00759);
          setTotals({ toplam: brutUcretToplam, yil: d.yil, ay: d.ay, gun: d.gun });
          setTavanUygulandi(!!d.tavanUygulandi);
          setTavanDegeri(d.tavanDegeri ?? null);
          setWarnings(d.warnings || []);
        } else {
          setKidemHesaplama({
            yilTutar: 0,
            ayTutar: 0,
            gunTutar: 0,
            toplamTutar: 0,
            warnings: [],
            kullanilacakBrut: 0,
            tavanUygulandi: false,
            tavanDegeri: null,
          });
          setBrutTazminat(0);
          setNetTazminat(0);
          setTavanUygulandi(false);
          setTavanDegeri(null);
          setWarnings([]);
        }
      } catch {
        if (cancelled) return;
        setBrutTazminat(0);
        setNetTazminat(0);
        setWarnings([]);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    brutUcretToplam,
    localYil,
    localAy,
    localGun,
    formValues.brutUcret,
    formValues.brut,
    formValues.prim,
    formValues.ikramiye,
    formValues.yemek,
    digerForApi,
    extrasForApi,
    apiPeriods,
    effectiveExitDate,
    setBrutTazminat,
    setNetTazminat,
    setTotals,
    setTavanUygulandi,
    setTavanDegeri,
    setWarnings,
  ]);

  const kidemTazminatiHakkiYok = useMemo(
    () => effectiveTotalDays > 0 && effectiveTotalDays < 360,
    [effectiveTotalDays]
  );

  const calismaLabel = useMemo(
    () => formatCalismaSuresiKismi({ yil: totals.yil, ay: totals.ay, gun: totals.gun }),
    [totals.yil, totals.ay, totals.gun]
  );

  const brutNetDisplay = brutTazminat;
  const damgaVergisi = brutNetDisplay * 0.00759;

  const kullanilacakBrutUcret = kidemHesaplama.kullanilacakBrut;

  useEffect(() => {
    if (!effectiveId || loadedIdRef.current === effectiveId) {
      if (!effectiveId) setIsLoading(false);
      return;
    }
    let mounted = true;
    loadedIdRef.current = effectiveId;
    setIsLoading(true);
    loadCalculation({ loadId: effectiveId })
      .then((loaded) => {
        if (!mounted || !loaded) return;
        const fv = loaded.formValues as Record<string, unknown> | undefined;
        if (fv?.periods && Array.isArray(fv.periods)) {
          setPeriods(fv.periods as WorkPeriod[]);
          if (typeof fv.totalDaysManual === "string") {
            setTotalDaysManual(fv.totalDaysManual);
            setIsManualOverride(true);
          }
        } else if (fv?.startDate && fv?.endDate) {
          const s = String(fv.startDate).split("T")[0];
          const e = String(fv.endDate).split("T")[0];
          setPeriods([{ start: s, end: e, days: calculatePeriodDays(s, e) }]);
        }
        if (loaded.formValues) setFormValues((p) => ({ ...p, ...loaded.formValues }));
        if (loaded.totals) setTotals(loaded.totals);
        if (loaded.brutTazminat !== undefined) setBrutTazminat(loaded.brutTazminat);
        if (loaded.netTazminat !== undefined) setNetTazminat(loaded.netTazminat);
        if (loaded.appliedEklenti) setAppliedEklenti(loaded.appliedEklenti);
        if (loaded.name) setCurrentRecordName(loaded.name);
        const ex = loaded.formValues?.exitDate || loaded.formValues?.endDate || loaded.formValues?.istenCikis;
        if (ex) setExitDate(ex);
        success("Kayıt yüklendi");
      })
      .catch((err) => {
        if (mounted) {
          loadedIdRef.current = null;
          showToastError(err.message || "Kayıt yüklenemedi");
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [effectiveId]);

  const handleSave = useCallback(() => {
    const hasAny = Object.values(formValues).some((v) => v && String(v).trim() !== "");
    if (!hasAny) {
      showToastError("Lütfen en az bir ücret bilgisi girin");
      return;
    }
    const brutNet = brutTazminat;
    const netVal = netTazminat;
    kaydetAc({
      hesapTuru: RECORD_TYPE,
      veri: {
        data: {
          form: {
            ...formValues,
            periods,
            totalDaysManual: isManualOverride ? totalDaysManual : undefined,
            startDate: iseGiris,
            endDate: istenCikis,
            iseGiris,
            istenCikis,
            exitDate: istenCikis,
          },
          results: { totals, brut: brutNet, net: netVal },
        },
        brut_total: brutNet,
        net_total: netVal,
        ise_giris: iseGiris || null,
        isten_cikis: istenCikis || null,
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName,
      redirectPath: REDIRECT_BASE_PATH,
    });
  }, [
    formValues,
    totals,
    brutTazminat,
    netTazminat,
    periods,
    totalDaysManual,
    isManualOverride,
    iseGiris,
    istenCikis,
    effectiveId,
    currentRecordName,
    kaydetAc,
    showToastError,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(REDIRECT_BASE_PATH);
    setFormValues({
      brutUcret: "",
      prim: "",
      ikramiye: "",
      yol: "",
      yemek: "",
      diger: "",
      startDate: "",
      endDate: "",
      exitDate: "",
      iseGiris: "",
      istenCikis: "",
      extras: [],
    });
    setPeriods([{ start: "", end: "", days: 0 }]);
    setTotalDaysManual("");
    setIsManualOverride(false);
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setBrutTazminat(0);
    setNetTazminat(0);
    setExitDate("");
    setAppliedEklenti(undefined);
    setCurrentRecordName(null);
    loadedIdRef.current = null;
    setFormMountKey((k) => k + 1);
  }, [effectiveId, navigate, setFormValues, setTotals, setBrutTazminat, setNetTazminat, setExitDate, setAppliedEklenti, setCurrentRecordName]);

  const handleAddPeriod = useCallback(() => {
    setPeriods((prev) => [...prev, { start: "", end: "", days: 0 }]);
  }, []);

  const handleRemovePeriod = useCallback((index: number) => {
    setPeriods((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const handleUpdatePeriod = useCallback((index: number, field: "start" | "end" | "days", value: string) => {
    setPeriods((prev) =>
      prev.map((period, i) => {
        if (i !== index) return period;
        if (field === "days") {
          const n = parseInt(value, 10);
          return { ...period, days: Number.isFinite(n) && n >= 0 ? n : 0 };
        }
        const next = { ...period, [field]: value };
        if (next.start && next.end) {
          next.days = calculatePeriodDays(next.start, next.end);
        } else {
          next.days = 0;
        }
        return next;
      })
    );
    if (field === "start" || field === "end") setIsManualOverride(false);
  }, []);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi"],
      rows: [[isoToTR(iseGiris), isoToTR(istenCikis), calismaLabel]],
    });
    s.push({
      id: "ust",
      title: "Tarih Bilgileri",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });
    const bilesen: { label: string; value: string }[] = [
      { label: "Çıplak Brüt", value: fmtCurrency(parseNum(formValues.brutUcret || formValues.brut)) },
      { label: "Prim", value: fmtCurrency(parseNum(formValues.prim)) },
      { label: "İkramiye", value: fmtCurrency(parseNum(formValues.ikramiye)) },
      { label: "Yemek", value: fmtCurrency(parseNum(formValues.yemek)) },
    ];
    if (parseNum(formValues.yol) > 0) bilesen.push({ label: "Yol", value: fmtCurrency(parseNum(formValues.yol)) });
    if (parseNum(formValues.diger) > 0) bilesen.push({ label: "Diğer", value: fmtCurrency(parseNum(formValues.diger)) });
    (formValues.extras || []).forEach((x) => bilesen.push({ label: x.label || "Ekstra", value: fmtCurrency(parseNum(x.value)) }));
    bilesen.push({ label: "Toplam Brüt", value: fmtCurrency(brutUcretToplam) });
    const n2 = adaptToWordTable(bilesen);
    s.push({
      id: "bilesen",
      title: "Ücret bileşenleri",
      html: buildWordTable(n2.headers, n2.rows),
      htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }),
    });
    if (warnings.length > 0) {
      const tavanRows = warnings.map((w) => [w]);
      const nTavan = adaptToWordTable({ headers: ["Uyarı"], rows: tavanRows });
      s.push({
        id: "tavan",
        title: "Uyarılar",
        html: buildWordTable(nTavan.headers, nTavan.rows),
        htmlForPdf: buildStyledReportTable(nTavan.headers, nTavan.rows),
      });
    }
    const kh = kidemHesaplama;
    const kidemRows: { label: string; value: string }[] = [];
    if (totals.yil > 0)
      kidemRows.push({
        label: `${fmt(kullanilacakBrutUcret)} × ${totals.yil} yıl`,
        value: fmtCurrency(kh.yilTutar),
      });
    if (totals.ay > 0)
      kidemRows.push({
        label: `${fmt(kullanilacakBrutUcret)} / 12 × ${totals.ay} ay`,
        value: fmtCurrency(kh.ayTutar),
      });
    kidemRows.push({
      label: `${fmt(kullanilacakBrutUcret)} / 360 × ${totals.gun} gün`,
      value: fmtCurrency(kh.gunTutar),
    });
    kidemRows.push({ label: "Toplam Kıdem Tazminatı (brüt)", value: fmtCurrency(brutNetDisplay) });
    const nKidem = adaptToWordTable(kidemRows);
    s.push({
      id: "kidem-hesaplama",
      title: "Kıdem Tazminatı Hesaplaması",
      html: buildWordTable(nKidem.headers, nKidem.rows),
      htmlForPdf: buildStyledReportTable(nKidem.headers, nKidem.rows, { lastRowBg: "blue" }),
    });
    const grossNet: { label: string; value: string }[] = [
      { label: "Brüt Kıdem Tazminatı", value: fmtCurrency(brutNetDisplay) },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(damgaVergisi)}` },
      { label: "Net Kıdem Tazminatı", value: fmtCurrency(netTazminat) },
    ];
    const n3 = adaptToWordTable(grossNet);
    s.push({
      id: "brutnet",
      title: "Brüt'ten Net'e",
      html: buildWordTable(n3.headers, n3.rows),
      htmlForPdf: buildStyledReportTable(n3.headers, n3.rows, { lastRowBg: "green" }),
    });
    return s;
  }, [
    iseGiris,
    istenCikis,
    calismaLabel,
    formValues,
    brutUcretToplam,
    brutNetDisplay,
    netTazminat,
    warnings,
    totals,
    kullanilacakBrutUcret,
    kidemHesaplama,
  ]);

  const handlePrint = () => {
    const el = document.getElementById("report-content-kismi-sureli");
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${PAGE_TITLE}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}h2{font-size:12px;margin:8px 0 6px 0}button{display:none!important}</style></head><body>${el.outerHTML}</body></html>`;
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
  };

  if (isLoading && effectiveId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Kayıt yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#1E88E5" }} />
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3">
          {getVideoLink("kidem-kismi") && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(getVideoLink("kidem-kismi"), "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Youtube className="w-3 h-3" /> Video
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <section>
                <h2 className={sectionTitleCls}>Çalışma dönemleri</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Her dönem için başlangıç ve bitiş tarihlerini girin; gün sayısı SSK 360 gün kuralına göre hesaplanır.
                </p>
                <div className="space-y-3 mt-2">
                  {periods.map((period, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-end gap-2 border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0"
                    >
                      <div className="min-w-[140px] flex-1">
                        <label className={labelCls}>Başlangıç</label>
                        <input
                          type="date"
                          value={period.start}
                          onChange={(e) => handleUpdatePeriod(index, "start", e.target.value)}
                          className={inputCls}
                          max="9999-12-31"
                        />
                      </div>
                      <div className="min-w-[140px] flex-1">
                        <label className={labelCls}>Bitiş</label>
                        <input
                          type="date"
                          value={period.end}
                          onChange={(e) => handleUpdatePeriod(index, "end", e.target.value)}
                          className={inputCls}
                          max="9999-12-31"
                        />
                      </div>
                      <div className="w-24">
                        <label className={labelCls}>Gün</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={period.days ? String(period.days) : ""}
                          onChange={(e) => handleUpdatePeriod(index, "days", e.target.value)}
                          className={`${inputCls} text-center`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePeriod(index)}
                        disabled={periods.length <= 1}
                        className="p-1.5 text-red-500 disabled:opacity-40 shrink-0"
                        aria-label="Dönemi sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddPeriod}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 border border-dashed border-gray-300 dark:border-gray-600 rounded px-2 py-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Dönem ekle
                  </button>
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Toplam çalışma günü (isteğe bağlı)</label>
                  <input
                    type="text"
                    value={totalDaysManual}
                    onChange={(e) => {
                      setTotalDaysManual(e.target.value.replace(/[^\d.,]/g, ""));
                      setIsManualOverride(true);
                    }}
                    onBlur={() => {
                      if (!totalDaysManual.trim()) setIsManualOverride(false);
                    }}
                    placeholder={calculatedTotalDays > 0 ? String(calculatedTotalDays) : ""}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-500 mt-0.5">
                    Boş bırakılırsa dönemlerden hesaplanan toplam kullanılır. Manuel girildiğinde sunucuya tek dönem olarak iletilir.
                  </p>
                </div>
              </section>

              <section>
                <h2 className={sectionTitleCls}>Ücret bilgileri</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  Aylık giydirilmiş brüt ve ek ödemeler; yol ve diğer kalemleri sunucu tek &quot;diğer&quot; satırında toplar.
                </p>
                <KidemTazminatiForm
                  key={`${effectiveId ?? "new"}-${formMountKey}`}
                  embedInCard
                  showIhbarShortcut={false}
                  hideEmploymentDates
                  showDigerInput
                  extraCalculationsLabel="Ekstra Hesaplamalar (Prim, İkramiye, Yemek vb.)"
                  onTotalsChange={() => {}}
                  appliedEklenti={appliedEklenti ?? undefined}
                  onExitDateChange={(d) => {
                    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setExitDate(d);
                  }}
                  onValuesChange={(v) => {
                    setFormValues((p) => ({
                      ...p,
                      brutUcret: v.brut,
                      brut: v.brut,
                      prim: v.prim,
                      ikramiye: v.ikramiye,
                      yol: v.yol,
                      yemek: v.yemek,
                      diger: v.diger ?? "",
                      extras: v.extras,
                      iseGiris: v.iseGiris,
                      istenCikis: v.istenCikis,
                      startDate: v.iseGiris || p.startDate,
                      endDate: v.istenCikis || p.endDate,
                      exitDate: v.istenCikis || p.exitDate,
                    }));
                  }}
                  onRequestEklenti={(fieldKey, title, apply) => {
                    setEklentiModalTitle(title || "Eklenti Hesaplama");
                    setEklentiApply(() => apply);
                    if (!eklentiValues[fieldKey]) {
                      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
                    }
                    setActiveModal(fieldKey);
                  }}
                  initialBrut={formValues.brutUcret || formValues.brut || ""}
                  initialIseGiris={iseGiris}
                  initialIstenCikis={istenCikis || exitDate}
                  initialPrim={formValues.prim}
                  initialIkramiye={formValues.ikramiye}
                  initialYol={formValues.yol}
                  initialYemek={formValues.yemek}
                  initialDiger={formValues.diger}
                  initialExtras={formValues.extras}
                />
              </section>

              <div className="p-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
                <span className="text-xs text-gray-600 dark:text-gray-400">Toplam Brüt</span>
                <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">{fmtCurrency(brutUcretToplam)} ₺</div>
              </div>

              {(warnings.length > 0 || kidemTazminatiHakkiYok) && (
                <section>
                  <h2 className={sectionTitleCls}>Uyarılar</h2>
                  <div className="space-y-2 mt-1">
                    {warnings.length > 0 && (
                      <div className="p-2.5 rounded border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
                        {warnings.map((w, i) => (
                          <div key={i}>{w}</div>
                        ))}
                      </div>
                    )}
                    {kidemTazminatiHakkiYok && (
                      <div className="p-2.5 rounded border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/20 text-xs text-orange-700 dark:text-orange-300 flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          Toplam çalışma süresi 360 günden az ise kıdem tazminatı hakkı doğmayabilir (bilgilendirme).
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>Kıdem Tazminatı Hesaplaması</h3>
                </div>
                <div className="p-2.5 space-y-1 text-xs">
                  {totals.yil > 0 && (
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span>
                        {fmt(kullanilacakBrutUcret)} × {totals.yil} yıl
                      </span>
                      <span>{fmtCurrency(kidemHesaplama.yilTutar)}</span>
                    </div>
                  )}
                  {totals.ay > 0 && (
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span>
                        {fmt(kullanilacakBrutUcret)} / 12 × {totals.ay} ay
                      </span>
                      <span>{fmtCurrency(kidemHesaplama.ayTutar)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                    <span>
                      {fmt(kullanilacakBrutUcret)} / 360 × {totals.gun} gün
                    </span>
                    <span>{fmtCurrency(kidemHesaplama.gunTutar)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                    <span>Toplam Kıdem Tazminatı (brüt)</span>
                    <span>{fmtCurrency(brutNetDisplay)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>Brüt'ten Net'e</h3>
                </div>
                <div className="p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">Brüt Kıdem Tazminatı</span>
                    <span className="font-medium">{fmtCurrency(brutNetDisplay)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                    <span>Damga Vergisi (Binde 7,59)</span>
                    <span>-{fmtCurrency(damgaVergisi)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                    <span>Net Kıdem Tazminatı</span>
                    <span>{fmtCurrency(netTazminat)}</span>
                  </div>
                </div>
              </div>

              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5">
                  <p className="text-[11px] font-light text-gray-500 dark:text-gray-400">
                    Çalışma süresi 360 günlük yıla göre yıl/ay/gün&apos;e çevrilir; günlük pay brüt ücretin 360&apos;a bölünmesiyle bulunur. Net
                    tutar, brüt tazminattan yalnızca binde 7,59 oranında damga vergisi düşülerek hesaplanır.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <EklentiModal
        open={!!activeModal}
        title={eklentiModalTitle}
        onClose={() => setActiveModal(null)}
        months={activeModal ? eklentiValues[activeModal] : undefined}
        onMonthsChange={(i, v) => {
          if (!activeModal) return;
          setEklentiValues((p) => ({
            ...p,
            [activeModal]: (p[activeModal] || Array(12).fill("")).map((x, j) => (j === i ? v : x)),
          }));
        }}
        onConfirm={(v) => {
          eklentiApply(v);
        }}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : effectiveId ? "Güncelle" : "Kaydet"}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "kidem-kismi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`
                .report-section-copy { margin-bottom: 1.25rem; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .report-section-copy .section-title { font-weight: 600; font-size: 0.75rem; color: #374151; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; border-radius: 0.375rem; color: #6b7280; }
                .report-section-copy .copy-icon-btn:hover { background: #f3f4f6; color: #374151; }
                #kidem-kismi-word-copy .section-content { border: none; overflow-x: auto; padding: 0; margin: 0; -webkit-overflow-scrolling: touch; }
                #kidem-kismi-word-copy table { border-collapse: collapse; width: 100%; margin: 0; font-size: 0.75rem; color: #111827; }
                #kidem-kismi-word-copy td, #kidem-kismi-word-copy th { border: 1px solid #999; padding: 5px 8px; background: #fff !important; color: #111827 !important; white-space: nowrap; }
                #kidem-kismi-word-copy td:last-child, #kidem-kismi-word-copy th:last-child { text-align: right; width: 38%; }
              `}</style>
              <div id="kidem-kismi-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
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
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content-kismi-sureli"),
        }}
      />

      <div style={{ display: "none" }}>
        <div
          id="report-content-kismi-sureli"
          style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}
        >
          <style>{`#report-content-kismi-sureli table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content-kismi-sureli td,#report-content-kismi-sureli th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
          <div style={{ marginBottom: 12, fontSize: 10, color: "#6b7280" }}>Tarih: {new Date().toLocaleDateString("tr-TR")}</div>
          {wordTableSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: 14 }} data-section={sec.id}>
              <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px 0", paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>
                {sec.title}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: sec.htmlForPdf }} style={{ fontSize: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
