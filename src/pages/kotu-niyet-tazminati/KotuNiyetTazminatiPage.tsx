/**
 * Kötü Niyet Tazminatı — v2 (Kıdem / Prim ile aynı kabuk ve tek kart).
 * Hesaplama: POST /api/kotu-niyet/calculate
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import KidemTazminatiForm from "@/pages/kidem-tazminati/KidemTazminatiForm";
import EklentiModal from "@/pages/kidem-tazminati/EklentiModal";
import type { ExtraItem } from "@/pages/kidem-tazminati/contract";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

import { calculateKotuNiyetApi, loadSavedCase } from "./api";
import type { KotuCalculation, KotuTotals } from "./contract";

const RECORD_TYPE = "kotu_niyet_tazminati";
const REDIRECT_PATH = "/kotu-niyet-tazminati";
const PREVIEW_TITLE = "Kötü Niyet Tazminatı Rapor";
const PAGE_HEADING = "Kötü Niyet Tazminatı";

const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const NOTE_PARAS = [
  "1- Kötü niyet tazminatından iş güvencesinden yararlanamayan işçiler yararlanabilir.",
  "2- İhbar önelinin 3 katı tutarında hesaplama yapılır.",
  "3- Borçlar Kanunu 434'üncü maddesinde düzenlenmiştir. İş Kanunu'nda yoktur, ancak Borçlar Kanununa tabi veya İş Kanunu'na tabi olsa dahi iş güvencesi kapsamı dışındaki çalışanlar için geçerlidir.",
  "4- Hizmet sözleşmesinin fesih hakkının kötüye kullanılarak sona erdirildiği durumlarda işveren, işçiye fesih bildirim süresine ait ücretin 3 katı tutarında tazminat ödemekle yükümlüdür. Sözleşmenin belirsiz süreli olması gerekir.",
  "5- İşverence yapılan feshin hangi andan itibaren kötü niyetli olduğu ölçütü Yargıtay kararlarında belirlenmiştir. Tutar: İşçinin (giydirilmiş) ücreti esas alınır; kötü niyet tazminatı tazminat mahiyetinde olduğundan gelir vergisi kesilmez, binde 7,59 damga vergisi uygulanır. Süre: ihbar süresinin 3 katıdır.",
];

type LoadedFormShape = {
  totals?: KotuTotals;
  iseGiris?: string;
  istenCikis?: string;
  brut?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  extras?: ExtraItem[];
};

function parseSavedPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const d = raw as Record<string, unknown>;
  let inner: unknown = d.data ?? d;
  if (typeof inner === "string") {
    try {
      inner = JSON.parse(inner);
    } catch {
      inner = {};
    }
  }
  if (!inner || typeof inner !== "object") return {};
  return inner as Record<string, unknown>;
}

export default function KotuNiyetTazminatiPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("kotu-niyet");

  const navState = (location.state as Record<string, unknown> | null) || {};
  const loadedIdRef = useRef<string | null>(null);

  const [totals, setTotals] = useState<KotuTotals>({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [calculation, setCalculation] = useState<KotuCalculation>({
    weeks: 0,
    brutAmount: 0,
    damgaVergisi: 0,
    netAmount: 0,
  });
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [loadedForm, setLoadedForm] = useState<LoadedFormShape | null>(null);
  const [liveForm, setLiveForm] = useState<LoadedFormShape | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Eklenti Hesaplama");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({});
  const [applyFn, setApplyFn] = useState<(v: number) => void>(() => () => {});

  const initialBrutFromNav = useMemo(() => {
    try {
      if (navState?.brutUcret) return String(navState.brutUcret);
      const search = new URLSearchParams(location.search);
      const fromQuery = Number(search.get("toplamTutar") || "");
      const fromState = navState?.toplamTutar as number | undefined;
      const val = Number.isNaN(fromQuery) ? Number(fromState) : fromQuery;
      if (!val || !Number.isFinite(val)) return undefined;
      return String(val.toFixed(2)).replace(".", ",");
    } catch {
      return undefined;
    }
  }, [location.search, navState]);

  const selectedYear = useMemo(() => {
    const d = exitDate?.trim();
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const y = new Date(d).getFullYear();
      if (y >= 2010 && y <= 2035) return y;
    }
    return new Date().getFullYear();
  }, [exitDate]);

  useEffect(() => {
    if (totals.toplam <= 0) {
      setCalculation({ weeks: 0, brutAmount: 0, damgaVergisi: 0, netAmount: 0 });
      return;
    }
    let cancelled = false;
    calculateKotuNiyetApi(totals, selectedYear).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setCalculation(res.data);
      else setCalculation({ weeks: 0, brutAmount: 0, damgaVergisi: 0, netAmount: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [totals, selectedYear]);

  useEffect(() => {
    if (!effectiveId || loadedIdRef.current === effectiveId) return;
    let mounted = true;
    loadedIdRef.current = effectiveId;

    loadSavedCase(effectiveId)
      .then((raw) => {
        if (!mounted) return;
        const data = raw as Record<string, unknown>;
        const payload = parseSavedPayload(raw);
        const formRaw =
          (payload.form as LoadedFormShape) ||
          ((payload.data as Record<string, unknown>)?.form as LoadedFormShape) ||
          (payload as LoadedFormShape);

        const t =
          formRaw?.totals ||
          (payload.totals as KotuTotals) ||
          ((payload.results as Record<string, unknown>)?.totals as KotuTotals);
        if (t && typeof t === "object" && "toplam" in t) {
          setTotals({
            toplam: Number(t.toplam) || 0,
            yil: Number(t.yil) || 0,
            ay: Number(t.ay) || 0,
            gun: Number(t.gun) || 0,
          });
        }

        const baseLoaded: LoadedFormShape = {
          totals: t as KotuTotals | undefined,
          iseGiris: formRaw?.iseGiris,
          istenCikis: formRaw?.istenCikis,
          brut: formRaw?.brut,
          prim: formRaw?.prim,
          ikramiye: formRaw?.ikramiye,
          yol: formRaw?.yol,
          yemek: formRaw?.yemek,
          extras: Array.isArray(formRaw?.extras) ? formRaw!.extras : undefined,
        };
        if (!baseLoaded.brut && t && typeof t === "object" && Number(t.toplam) > 0) {
          baseLoaded.brut = fmt(Number(t.toplam));
        }
        setLoadedForm(baseLoaded);
        setLiveForm(null);

        if (formRaw?.istenCikis) setExitDate(formRaw.istenCikis);

        const name =
          (data.name as string) ||
          (data.notes as string) ||
          (data.aciklama as string) ||
          "";
        setCurrentRecordName(name || null);
        success(`Kayıt yüklendi (#${effectiveId})`);
      })
      .catch((err) => {
        if (mounted) {
          loadedIdRef.current = null;
          console.error(err);
          showToastError("Kayıt yüklenemedi");
        }
      });

    return () => {
      mounted = false;
    };
  }, [effectiveId, success, showToastError]);

  const reportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const gunluk = (totals.toplam || 0) / 30;
    const ihbarTutari = gunluk * calculation.weeks * 7;

    return {
      title: PAGE_HEADING,
      sections: { info: true, grossToNet: true },
      infoRows: [
        { label: "Aylık Toplam Ücret", value: totals.toplam ? `${fmtLocal(totals.toplam)} ₺` : "-" },
        { label: "İhbar Süresi (Hafta)", value: calculation.weeks ? String(calculation.weeks) : "-" },
        {
          label: "Hesaplama",
          value: totals.toplam
            ? `(${fmtLocal(totals.toplam)} ₺ / 30 × ${calculation.weeks} × 7 × 3)`
            : "-",
        },
      ],
      customSections: [
        {
          title: "Kötü Niyet Tazminatı Hesaplama Detayı",
          content: (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-4">
                <span className="text-gray-600 dark:text-gray-400">Günlük ücret</span>
                <span className="text-right font-medium">
                  {fmtLocal(totals.toplam || 0)} / 30 = {fmtLocal(gunluk)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-4">
                <span className="text-gray-600 dark:text-gray-400">İhbar süresi tutarı</span>
                <span className="text-right font-medium">
                  {fmtLocal(gunluk)} × {calculation.weeks} × 7 = {fmtLocal(ihbarTutari)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-4 pt-2 border-t border-gray-200 dark:border-gray-600 font-semibold">
                <span>Kötü niyet (×3)</span>
                <span className="text-right">{fmtLocal(calculation.brutAmount)} ₺</span>
              </div>
            </div>
          ),
        },
      ],
      grossToNetData: {
        title: "Brütten Nete",
        rows: [
          { label: "Brüt Kötü Niyet Tazminatı", value: `${fmtLocal(calculation.brutAmount)} ₺` },
          {
            label: "Damga Vergisi (Binde 7,59)",
            value: `-${fmtLocal(calculation.damgaVergisi)} ₺`,
            isDeduction: true,
          },
          { label: "Net Kötü Niyet Tazminatı", value: `${fmtLocal(calculation.netAmount)} ₺`, isNet: true },
        ],
      },
    };
  }, [totals, calculation]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const infoRows = reportConfig.infoRows || [];
    if (infoRows.length) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRows.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const gunlukUcret = (totals.toplam || 0) / 30;
    const ihbarTutari = gunlukUcret * calculation.weeks * 7;
    const n2 = adaptToWordTable({
      headers: ["Alan", "Değer"],
      rows: [
        ["Günlük Ücret", `${fmtLocal(totals.toplam || 0)} / 30 = ${fmtLocal(gunlukUcret)}`],
        ["İhbar Süresi Tutarı", `${fmtLocal(gunlukUcret)} × ${calculation.weeks} × 7 = ${fmtLocal(ihbarTutari)}`],
        ["Kötü Niyet Tazminatı (×3)", `${fmtLocal(calculation.brutAmount)} ₺`],
      ],
    });
    sections.push({
      id: "kotu-hesap",
      title: "Kötü Niyet Tazminatı Hesaplama Detayı",
      html: buildWordTable(n2.headers, n2.rows),
    });

    const gnd = reportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({
        id: "brutten-nete",
        title: reportConfig.grossToNetData?.title || "Brütten Nete",
        html: buildWordTable(n3.headers, n3.rows),
      });
    }

    return sections;
  }, [reportConfig, totals.toplam, calculation]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
    if (!el) return;
    const title = reportConfig.title;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}h2{font-size:12px;margin:8px 0 6px 0}</style></head><body>${el.innerHTML}</body></html>`;
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
  }, [reportConfig.title]);

  const handleSave = () => {
    if (!totals.toplam || totals.toplam <= 0) {
      showToastError("Geçerli bir toplam ücret giriniz");
      return;
    }
    const persistedForm: LoadedFormShape = {
      totals,
      ...(liveForm || loadedForm || {}),
    };

    try {
      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: persistedForm,
            results: {
              brutAmount: calculation.brutAmount,
              netAmount: calculation.netAmount,
              weeks: calculation.weeks,
              totals,
            },
          },
          calculation_type: RECORD_TYPE,
          brut_total: Number(calculation.brutAmount.toFixed(2)),
          net_total: Number(calculation.netAmount.toFixed(2)),
          totals,
          weeks: calculation.weeks,
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: REDIRECT_PATH,
      });
    } catch {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNew = () => {
    const dirty =
      totals.toplam > 0 || totals.yil > 0 || totals.ay > 0 || totals.gun > 0;
    if (dirty && !window.confirm("Kaydedilmemiş veriler silinecek. Devam edilsin mi?")) return;
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setLoadedForm(null);
    setLiveForm(null);
    setCurrentRecordName(null);
    setExitDate("");
    setEklentiValues({});
    loadedIdRef.current = null;
    if (effectiveId) navigate(REDIRECT_PATH);
  };

  const initialIse = loadedForm?.iseGiris || (navState?.iseGiris as string | undefined);
  const initialIsten = loadedForm?.istenCikis || (navState?.istenCikis as string | undefined);

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#1E88E5" }} />
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3">
          {videoLink ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(videoLink, "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Youtube className="w-3 h-3" /> Video
              </button>
            </div>
          ) : null}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <section>
                <h2 className={sectionTitleCls}>Ücret ve çalışma bilgileri</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  Aylık giydirilmiş brüt ücret ve çalışma süresi; ihbar haftası bu süreye göre belirlenir.
                </p>
                <KidemTazminatiForm
                  key={effectiveId ?? "new"}
                  embedInCard
                  showIhbarShortcut={false}
                  onTotalsChange={setTotals}
                  onExitDateChange={setExitDate}
                  onValuesChange={(v) =>
                    setLiveForm({
                      iseGiris: v.iseGiris,
                      istenCikis: v.istenCikis,
                      brut: v.brut,
                      prim: v.prim,
                      ikramiye: v.ikramiye,
                      yol: v.yol,
                      yemek: v.yemek,
                      extras: v.extras,
                    })
                  }
                  onRequestEklenti={(fieldKey, title, apply) => {
                    setActiveField(fieldKey);
                    setModalTitle(title || "Eklenti Hesaplama");
                    setApplyFn(() => (v: number) => {
                      apply(v);
                    });
                    setModalOpen(true);
                  }}
                  initialBrut={loadedForm?.brut ?? initialBrutFromNav}
                  initialIseGiris={initialIse}
                  initialIstenCikis={initialIsten}
                  initialPrim={loadedForm?.prim ?? (navState?.prim as string | undefined)}
                  initialIkramiye={loadedForm?.ikramiye ?? (navState?.ikramiye as string | undefined)}
                  initialYol={loadedForm?.yol ?? (navState?.yol as string | undefined)}
                  initialYemek={loadedForm?.yemek ?? (navState?.yemek as string | undefined)}
                  initialExtras={loadedForm?.extras}
                />
              </section>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>{PAGE_HEADING}</h3>
                </div>
                <div className="p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">İhbar süresi (hafta)</span>
                    <span className="font-medium">{calculation.weeks} hafta</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">Hesap</span>
                    <span className="font-medium text-right pl-2">
                      ({fmt(totals.toplam)} ₺ / 30 × {calculation.weeks} × 7 × 3)
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">Brüt</span>
                    <span className="font-semibold">{fmt(calculation.brutAmount)} ₺</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                    <span>Damga vergisi (binde 7,59)</span>
                    <span>-{fmt(calculation.damgaVergisi)} ₺</span>
                  </div>
                  <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                    <span>Net</span>
                    <span>{fmt(calculation.netAmount)} ₺</span>
                  </div>
                </div>
              </div>

              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 mt-1 space-y-2">
                  {NOTE_PARAS.map((p, i) => (
                    <p key={i} className="text-[11px] font-light text-gray-500 dark:text-gray-400">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <EklentiModal
        open={modalOpen}
        title={modalTitle}
        months={activeField ? eklentiValues[activeField] : undefined}
        onClose={() => setModalOpen(false)}
        onMonthsChange={(i, val) => {
          if (!activeField) return;
          setEklentiValues((prev) => {
            const arr = prev[activeField] ?? Array(12).fill("");
            const next = arr.slice();
            next[i] = val;
            return { ...prev, [activeField]: next };
          });
        }}
        onApply={(v) => {
          applyFn(v);
          setModalOpen(false);
          info("Eklenti hesaplandı", "Seçili kaleme uygulandı");
        }}
      />

      <div style={{ display: "none" }} aria-hidden="true">
        <div
          id="report-content"
          style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}
        >
          <ReportContentFromConfig config={reportConfig} />
        </div>
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={
          isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : effectiveId ? "Güncelle" : "Kaydet"
        }
        onPrint={handlePrint}
        previewButton={{
          title: PREVIEW_TITLE,
          copyTargetId: "kotu-niyet-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #kotu-niyet-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #kotu-niyet-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="kotu-niyet-word-copy">
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
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PREVIEW_TITLE, "report-content"),
        }}
      />
    </>
  );
}
