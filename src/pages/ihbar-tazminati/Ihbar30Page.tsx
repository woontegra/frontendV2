/**
 * İhbar Tazminatı - İş Kanununa Göre
 * Davacı Ücreti / Kıdem Tazminatı ile aynı yapı: mobil uyumlu, kompakt
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Save, Download, Trash2, Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import EklentiModal from "@/pages/kidem-tazminati/EklentiModal";
import { loadCalculation } from "./api";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./storage";
import { calcWorkPeriodBilirKisi, parseMoney, getIhbarWeeks, getAsgariUcretByDate } from "./utils";
import { useIhbar30State } from "./state";
import { handleCalculateTotalBrut } from "./actions";
import {
  fmtCurrency,
  parseNum,
  fmt,
  calculateIhbarTazminati,
  calculateDamgaVergisi,
  calculateGelirVergisi,
  calculateNetDisplay,
} from "./calculations";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { copySectionForWord } from "@/utils/copyTableForWord";

const PAGE_TITLE = "İhbar Tazminatı - İş Kanununa Göre";
const RECORD_TYPE = "ihbar_30isci";
const REDIRECT_BASE_PATH = "/ihbar-tazminati/30isci";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

export default function Ihbar30Page() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

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
    eklentiValues,
    setEklentiValues,
    brutIhbar,
    setBrutIhbar,
    netIhbar,
    setNetIhbar,
  } = useIhbar30State();

  const iseGiris = formValues.startDate || formValues.iseGiris || "";
  const istenCikis = formValues.exitDate || formValues.endDate || formValues.istenCikis || "";
  const effectiveExitDate = exitDate || istenCikis || "";

  const diff = useMemo(
    () => calcWorkPeriodBilirKisi(iseGiris, istenCikis),
    [iseGiris, istenCikis]
  );

  const toplamBrut = useMemo(
    () =>
      handleCalculateTotalBrut(
        formValues.brutUcret || formValues.brut || "",
        formValues.prim || "",
        formValues.ikramiye || "",
        formValues.yol || "",
        formValues.yemek || "",
        formValues.extras || []
      ),
    [formValues.brutUcret, formValues.brut, formValues.prim, formValues.ikramiye, formValues.yol, formValues.yemek, formValues.extras]
  );

  useEffect(() => {
    setTotals({ toplam: toplamBrut, yil: diff.years, ay: diff.months, gun: diff.days });
  }, [toplamBrut, diff.years, diff.months, diff.days, setTotals]);

  const weeks = useMemo(() => getIhbarWeeks(diff.years, diff.months, diff.days), [diff.years, diff.months, diff.days]);
  const exitYear = effectiveExitDate ? new Date(effectiveExitDate).getFullYear() : new Date().getFullYear();

  useEffect(() => {
    const brut = calculateIhbarTazminati(toplamBrut, weeks);
    const net = calculateNetDisplay(brut, exitYear);
    setBrutIhbar(brut);
    setNetIhbar(net);
  }, [toplamBrut, weeks, exitYear, setBrutIhbar, setNetIhbar]);

  const asgariUcretHatasi = useMemo(() => {
    const brutStr = formValues.brutUcret || formValues.brut || "";
    if (!brutStr || !effectiveExitDate) return null;
    const brutValue = parseMoney(brutStr);
    if (!brutValue || brutValue === 0) return null;
    const minUcret = getAsgariUcretByDate(effectiveExitDate);
    if (!minUcret) return null;
    if (brutValue < minUcret) {
      const year = new Date(effectiveExitDate).getFullYear();
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${fmtCurrency(minUcret)} ₺).`;
    }
    return null;
  }, [formValues.brutUcret, formValues.brut, effectiveExitDate]);

  const damgaVergisi = calculateDamgaVergisi(brutIhbar);
  const gelirVergisi = calculateGelirVergisi(brutIhbar, exitYear);
  const netDisplay = calculateNetDisplay(brutIhbar, exitYear);

  useEffect(() => {
    if (appliedEklenti) {
      const { field, value } = appliedEklenti;
      const formatted = String(value.toFixed(2)).replace(".", ",");
      setFormValues((p) => {
        const next = { ...p };
        if (field === "prim") next.prim = formatted;
        else if (field === "ikramiye") next.ikramiye = formatted;
        else if (field === "yemek") next.yemek = formatted;
        else if (field === "yol") next.yol = formatted;
        else if (field.startsWith("extra:")) {
          const eid = field.split(":")[1];
          next.extras = (p.extras || []).map((x) => (x.id === eid ? { ...x, value: formatted } : x));
        }
        return next;
      });
    }
  }, [appliedEklenti]);

  useEffect(() => {
    if (!effectiveId || loadedIdRef.current === effectiveId) return;
    let mounted = true;
    loadedIdRef.current = effectiveId;
    setIsLoading(true);
    loadCalculation(effectiveId)
      .then((loaded) => {
        if (!mounted || !loaded) return;
        if (loaded.formValues) setFormValues((p) => ({ ...p, ...loaded.formValues }));
        if (loaded.totals) setTotals(loaded.totals);
        if (loaded.brutIhbar !== undefined) setBrutIhbar(loaded.brutIhbar);
        if (loaded.netIhbar !== undefined) setNetIhbar(loaded.netIhbar);
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
    return () => { mounted = false; };
  }, [effectiveId]);

  const handleFormChange = useCallback((updates: Partial<typeof formValues>) => {
    setFormValues((p) => {
      const next = { ...p, ...updates };
      if (updates.iseGiris !== undefined) next.startDate = updates.iseGiris || "";
      if (updates.istenCikis !== undefined) {
        next.endDate = updates.istenCikis || "";
        next.exitDate = updates.istenCikis || "";
        setExitDate(updates.istenCikis || "");
      }
      return next;
    });
  }, [setFormValues, setExitDate]);

  const handleSave = useCallback(() => {
    const hasAny = Object.values(formValues).some((v) => v && String(v).trim() !== "");
    if (!hasAny) {
      showToastError("Lütfen en az bir ücret bilgisi girin");
      return;
    }
    kaydetAc({
      hesapTuru: RECORD_TYPE,
      veri: {
        data: { form: formValues, results: { totals, brut: brutIhbar, net: netDisplay } },
        brut_total: brutIhbar,
        net_total: netDisplay,
        ise_giris: formValues.startDate || formValues.iseGiris || null,
        isten_cikis: formValues.exitDate || formValues.istenCikis || null,
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName,
      redirectPath: REDIRECT_BASE_PATH,
    });
  }, [formValues, totals, brutIhbar, netDisplay, effectiveId, currentRecordName, kaydetAc, showToastError]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(REDIRECT_BASE_PATH);
    setFormValues({
      brutUcret: "", brut: "", prim: "", ikramiye: "", yol: "", yemek: "",
      startDate: "", endDate: "", exitDate: "", iseGiris: "", istenCikis: "", extras: [],
    });
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setBrutIhbar(0);
    setNetIhbar(0);
    setExitDate("");
    setAppliedEklenti(null);
    setCurrentRecordName(null);
    loadedIdRef.current = null;
  }, [effectiveId, navigate, setFormValues, setTotals, setBrutIhbar, setNetIhbar, setExitDate, setAppliedEklenti, setCurrentRecordName]);

  const handleRequestEklenti = (fieldKey: string) => {
    if (!eklentiValues[fieldKey]) setEklentiValues((p) => ({ ...p, [fieldKey]: Array(12).fill("") }));
    setActiveModal(fieldKey);
  };

  const handleApplyEklenti = (value: number, fieldKey: string) => {
    const formatted = String(value.toFixed(2)).replace(".", ",");
    setFormValues((p) => {
      const next = { ...p };
      if (fieldKey === "prim") next.prim = formatted;
      else if (fieldKey === "ikramiye") next.ikramiye = formatted;
      else if (fieldKey === "yemek") next.yemek = formatted;
      else if (fieldKey === "yol") next.yol = formatted;
      else if (fieldKey.startsWith("extra:")) {
        const eid = fieldKey.split(":")[1];
        next.extras = (p.extras || []).map((x) => (x.id === eid ? { ...x, value: formatted } : x));
      }
      return next;
    });
    setAppliedEklenti({ field: fieldKey, value });
    setActiveModal(null);
  };

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }
    const items: { id: string; name: string; value: string }[] = [];
    if (formValues.prim?.trim()) items.push({ id: "prim", name: "Prim", value: formValues.prim });
    if (formValues.ikramiye?.trim()) items.push({ id: "ikramiye", name: "İkramiye", value: formValues.ikramiye });
    if (formValues.yol?.trim()) items.push({ id: "yol", name: "Yol", value: formValues.yol });
    if (formValues.yemek?.trim()) items.push({ id: "yemek", name: "Yemek", value: formValues.yemek });
    (formValues.extras || []).forEach((x) => items.push({ id: x.id, name: x.label, value: x.value }));
    if (items.length === 0) {
      showToastError("Kaydedilecek veri yok");
      return;
    }
    const ok = await saveExtraCalculationsSet(saveName.trim(), items);
    if (ok) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
      getAllExtraCalculationsSets().then(setSavedSets);
    } else showToastError("Kaydetme başarısız");
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setFormValues((p) => {
        const next = { ...p };
        data.forEach((x: { id?: string; label: string; value: string }) => {
          const id = x.id || x.label?.toLowerCase();
          if (id === "prim" || x.label === "Prim") next.prim = x.value;
          else if (id === "ikramiye" || x.label === "İkramiye") next.ikramiye = x.value;
          else if (id === "yol" || x.label === "Yol") next.yol = x.value;
          else if (id === "yemek" || x.label === "Yemek") next.yemek = x.value;
        });
        const extrasData = data.filter((x: any) => !["prim", "ikramiye", "yol", "yemek"].includes((x.id || x.label || "").toLowerCase()));
        next.extras = extrasData.map((x: any) => ({ id: x.id || Math.random().toString(36).slice(2), label: x.label || x.name || "", value: x.value || "" }));
        return next;
      });
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else showToastError("Yüklenecek veri bulunamadı");
  };

  const handleDeleteExtra = async (setId: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;
    const ok = await deleteExtraCalculationsSet(setId);
    if (ok) {
      success("Set silindi");
      getAllExtraCalculationsSets().then(setSavedSets);
    } else showToastError("Silme başarısız");
  };

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({ headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi"], rows: [[iseGiris || "-", istenCikis || "-", diff.label]] });
    s.push({ id: "ust", title: "Tarih Bilgileri", html: buildWordTable(n1.headers, n1.rows), htmlForPdf: buildStyledReportTable(n1.headers, n1.rows) });
    const bilesen: { label: string; value: string }[] = [
      { label: "Çıplak Brüt", value: fmtCurrency(parseNum(formValues.brutUcret || formValues.brut)) },
      { label: "Prim", value: fmtCurrency(parseNum(formValues.prim)) },
      { label: "İkramiye", value: fmtCurrency(parseNum(formValues.ikramiye)) },
      { label: "Yemek", value: fmtCurrency(parseNum(formValues.yemek)) },
    ];
    if (parseNum(formValues.yol) > 0) bilesen.push({ label: "Yol", value: fmtCurrency(parseNum(formValues.yol)) });
    (formValues.extras || []).forEach((x) => bilesen.push({ label: x.label || "Ekstra", value: fmtCurrency(parseNum(x.value)) }));
    bilesen.push({ label: "Toplam Brüt", value: fmtCurrency(toplamBrut) });
    const n2 = adaptToWordTable(bilesen);
    s.push({ id: "bilesen", title: "Ekstra Hesaplamalar", html: buildWordTable(n2.headers, n2.rows), htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }) });
    const gunlukUcretFormulu = `(${fmt(toplamBrut)} / 30 × ${weeks} × 7)`;
    const ihbarRows: { label: string; value: string }[] = [
      { label: "İhbar Süresi", value: `${weeks} hafta` },
      { label: "Günlük Ücret (Toplam/30 × Hafta × 7)", value: gunlukUcretFormulu },
      { label: "Toplam İhbar Tazminatı", value: fmtCurrency(brutIhbar) },
    ];
    const nIhbar = adaptToWordTable(ihbarRows);
    s.push({ id: "ihbar-hesap", title: "İhbar Tazminatı Hesaplaması", html: buildWordTable(nIhbar.headers, nIhbar.rows), htmlForPdf: buildStyledReportTable(nIhbar.headers, nIhbar.rows, { lastRowBg: "blue" }) });
    const grossNet: { label: string; value: string }[] = [
      { label: "Brüt İhbar Tazminatı", value: fmtCurrency(brutIhbar) },
      { label: "Gelir Vergisi", value: `-${fmtCurrency(gelirVergisi)}` },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(damgaVergisi)}` },
      { label: "Net İhbar Tazminatı", value: fmtCurrency(netDisplay) },
    ];
    const n3 = adaptToWordTable(grossNet);
    s.push({ id: "brutnet", title: "Brüt'ten Net'e", html: buildWordTable(n3.headers, n3.rows), htmlForPdf: buildStyledReportTable(n3.headers, n3.rows, { lastRowBg: "green" }) });
    return s;
  }, [iseGiris, istenCikis, diff.label, formValues, toplamBrut, brutIhbar, damgaVergisi, gelirVergisi, netDisplay, weeks]);

  const handlePrint = () => {
    const el = document.getElementById("report-content");
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
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
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
          {getVideoLink("ihbar-30isci") && (
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => window.open(getVideoLink("ihbar-30isci"), "_blank")} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800">
                <Youtube className="w-3 h-3" /> Video
              </button>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <section>
                <h2 className={sectionTitleCls}>Tarih Bilgileri</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <div>
                    <label htmlFor="iseGiris" className={labelCls}>İşe Giriş</label>
                    <input id="iseGiris" type="date" value={iseGiris} onChange={(e) => handleFormChange({ iseGiris: e.target.value, startDate: e.target.value })} className={inputCls} max="9999-12-31" />
                  </div>
                  <div>
                    <label htmlFor="istenCikis" className={labelCls}>İşten Çıkış</label>
                    <input id="istenCikis" type="date" value={istenCikis} onChange={(e) => { handleFormChange({ istenCikis: e.target.value, endDate: e.target.value, exitDate: e.target.value }); setExitDate(e.target.value); }} className={inputCls} max="9999-12-31" />
                  </div>
                  <div>
                    <label className={labelCls}>Çalışma Süresi</label>
                    <input readOnly value={diff.label} className={`${inputCls} bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400`} />
                  </div>
                </div>
              </section>
              <section>
                <label htmlFor="brut" className={labelCls}>Çıplak Brüt (₺)</label>
                <input id="brut" type="text" value={formValues.brutUcret || formValues.brut || ""} onChange={(e) => handleFormChange({ brutUcret: e.target.value, brut: e.target.value })} placeholder="25.000,00" className={`${inputCls} ${asgariUcretHatasi ? "border-red-500" : ""}`} />
                {asgariUcretHatasi && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{asgariUcretHatasi}</p>}
              </section>
              <section>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className={sectionTitleCls}>Ekstra Hesaplamalar</h2>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => getAllExtraCalculationsSets().then((s) => { setSavedSets(s); setShowImportModal(true); })} className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 whitespace-nowrap">
                      <Download className="w-3 h-3 shrink-0" /> İçe Aktar
                    </button>
                    <button type="button" onClick={() => setShowSaveModal(true)} disabled={!(formValues.prim || formValues.ikramiye || formValues.yemek || formValues.yol || (formValues.extras?.length ?? 0) > 0)} className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap">
                      <Save className="w-3 h-3 shrink-0" /> Kaydet
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  {[
                    { key: "prim", label: "Prim", value: formValues.prim || "", fieldKey: "prim" },
                    { key: "ikramiye", label: "İkramiye", value: formValues.ikramiye || "", fieldKey: "ikramiye" },
                    { key: "yol", label: "Yol", value: formValues.yol || "", fieldKey: "yol" },
                    { key: "yemek", label: "Yemek", value: formValues.yemek || "", fieldKey: "yemek" },
                  ].map(({ key, label, value, fieldKey }) => (
                    <div key={key} className="flex items-center gap-2">
                      <input value={label} readOnly className={`${inputCls} w-24 sm:w-28 shrink-0 bg-gray-50 dark:bg-gray-700`} />
                      <input value={value} onChange={(e) => handleFormChange({ [key]: e.target.value })} placeholder="0" className={`${inputCls} flex-1 min-w-0`} />
                      <button type="button" onClick={() => handleRequestEklenti(fieldKey)} className="shrink-0 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700" title="Eklenti hesapla">Eklenti</button>
                      <button type="button" onClick={() => handleFormChange({ [key]: "" })} className="shrink-0 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded" aria-label="Temizle"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {(formValues.extras || []).map((it) => (
                    <div key={it.id} className="flex items-center gap-2">
                      <input value={it.label} onChange={(e) => setFormValues((p) => ({ ...p, extras: (p.extras || []).map((x) => x.id === it.id ? { ...x, label: e.target.value } : x) }))} placeholder="Kalem" className={`${inputCls} w-24 sm:w-28 shrink-0`} />
                      <input value={it.value} onChange={(e) => setFormValues((p) => ({ ...p, extras: (p.extras || []).map((x) => x.id === it.id ? { ...x, value: e.target.value } : x) }))} placeholder="0" className={`${inputCls} flex-1 min-w-0`} />
                      <button type="button" onClick={() => handleRequestEklenti(`extra:${it.id}`)} className="shrink-0 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700" title="Eklenti hesapla">Eklenti</button>
                      <button type="button" onClick={() => setFormValues((p) => ({ ...p, extras: (p.extras || []).filter((x) => x.id !== it.id) }))} className="shrink-0 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded" aria-label="Sil"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormValues((p) => ({ ...p, extras: [...(p.extras || []), { id: Math.random().toString(36).slice(2), label: "Eklenti", value: "" }] }))} className="mt-1 text-xs text-blue-600 dark:text-blue-400 py-1 px-2 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">+ Kalem ekle</button>
                </div>
              </section>
              <div className="p-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
                <span className="text-xs text-gray-600 dark:text-gray-400">Toplam Brüt</span>
                <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">{fmtCurrency(toplamBrut)} ₺</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>İhbar Tazminatı Hesaplaması</h3>
                </div>
                <div className="p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600"><span>İhbar Süresi</span><span>{weeks} hafta</span></div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600"><span>Günlük Ücret (Toplam/30 × Hafta × 7)</span><span>({fmt(toplamBrut)} / 30 × {weeks} × 7)</span></div>
                  <div className="flex justify-between pt-1.5 font-semibold text-indigo-600 dark:text-indigo-400"><span>Toplam İhbar Tazminatı</span><span>{fmtCurrency(brutIhbar)}</span></div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600"><h3 className={sectionTitleCls}>Brütten Nete</h3></div>
                <div className="p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600"><span className="text-gray-600 dark:text-gray-400">Brüt İhbar Tazminatı</span><span className="font-medium">{fmtCurrency(brutIhbar)}</span></div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400"><span>Gelir Vergisi</span><span>-{fmtCurrency(gelirVergisi)}</span></div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400"><span>Damga Vergisi (Binde 7,59)</span><span>-{fmtCurrency(damgaVergisi)}</span></div>
                  <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400"><span>Net İhbar Tazminatı</span><span>{fmtCurrency(netDisplay)}</span></div>
                </div>
              </div>
              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Bildirim süresine uymayan taraf, bildirim süresine ilişkin ücret tutarında tazminat öder. İhbar süresi çalışma süresine göre belirlenir (İş Kanunu md. 17).</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm border border-gray-200 dark:border-gray-600 shadow-lg">
            <h3 className={sectionTitleCls}>Ekstra Hesaplamaları Kaydet</h3>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Set adı" className={`${inputCls} mt-2 mb-3`} onKeyDown={(e) => { if (e.key === "Enter") handleSaveExtra(); if (e.key === "Escape") setShowSaveModal(false); }} autoFocus />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowSaveModal(false); setSaveName(""); }} className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">İptal</button>
              <button type="button" onClick={handleSaveExtra} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-600 shadow-lg">
            <h3 className={sectionTitleCls}>Kaydedilmiş Setler</h3>
            {savedSets.length === 0 ? <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">Kaydedilmiş set yok</p> : (
              <div className="mt-2 space-y-1.5">
                {savedSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{set.name}</div><div className="text-xs text-gray-500">{set.data?.length ?? 0} kalem</div></div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => handleImportExtra(set.name)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600" title="İçe aktar"><Download className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => handleDeleteExtra(set.id)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title="Sil"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => setShowImportModal(false)} className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Kapat</button></div>
          </div>
        </div>
      )}

      {activeModal && (
        <EklentiModal
          open={!!activeModal}
          title={`${activeModal === "prim" ? "Prim" : activeModal === "ikramiye" ? "İkramiye" : activeModal === "yol" ? "Yol" : activeModal === "yemek" ? "Yemek" : "Eklenti"} Hesaplama`}
          onClose={() => setActiveModal(null)}
          months={eklentiValues[activeModal]}
          onMonthsChange={(i, v) => setEklentiValues((p) => ({ ...p, [activeModal]: (p[activeModal] || Array(12).fill("")).map((x, j) => j === i ? v : x) }))}
          onConfirm={(v) => handleApplyEklenti(v, activeModal)}
        />
      )}

      <FooterActions replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }} onSave={handleSave} saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : (effectiveId ? "Güncelle" : "Kaydet")} saveButtonProps={{ disabled: isSaving }} onPrint={handlePrint} previewButton={{
        title: PAGE_TITLE, copyTargetId: "ihbar-word-copy", hideWordDownload: true,
        renderContent: () => (
          <div>
            <style>{`
              .report-section-copy { margin-bottom: 1.25rem; }
              .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
              .report-section-copy .section-title { font-weight: 600; font-size: 0.75rem; color: #374151; }
              .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; border-radius: 0.375rem; color: #6b7280; }
              .report-section-copy .copy-icon-btn:hover { background: #f3f4f6; color: #374151; }
              #ihbar-word-copy .section-content { border: none; overflow-x: auto; padding: 0; margin: 0; -webkit-overflow-scrolling: touch; }
              #ihbar-word-copy table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; font-size: 0.75rem; color: #111827; }
              #ihbar-word-copy td, #ihbar-word-copy th { border: 1px solid #999; padding: 5px 8px; background: #fff !important; color: #111827 !important; }
              #ihbar-word-copy td:first-child, #ihbar-word-copy th:first-child { width: 62%; min-width: 0; }
              #ihbar-word-copy td:last-child, #ihbar-word-copy th:last-child { width: 38%; text-align: right; white-space: nowrap; }
            `}</style>
            <div id="ihbar-word-copy">
              {wordTableSections.map((sec) => (
                <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                  <div className="section-header">
                    <span className="section-title">{sec.title}</span>
                    <button type="button" className="copy-icon-btn" onClick={async () => { const ok = await copySectionForWord(sec.id); if (ok) success("Kopyalandı"); }} title="Word'e kopyala"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                </div>
              ))}
            </div>
          </div>
        ),
        onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content"),
      }} />

      <div style={{ display: "none" }}>
        <div id="report-content" style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}>
          <style>{`#report-content table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content td,#report-content th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
          <div style={{ marginBottom: 12, fontSize: 10, color: "#6b7280" }}>Tarih: {new Date().toLocaleDateString("tr-TR")}</div>
          {wordTableSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: 14 }} data-section={sec.id}>
              <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px 0", paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>{sec.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: sec.htmlForPdf }} style={{ fontSize: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
