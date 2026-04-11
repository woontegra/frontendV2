/**
 * Kıdem Tazminatı — Basın İş (v1 KidemBasinIndependent ile uyumlu: kıdem süresi mesleğe başlangıç veya işe giriş,
 * deneme düşümü, 5 yıl / 6 ay kuralları, brüt gün payı 365, damga + GVK 25/7 gelir vergisi).
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Youtube, Copy, AlertTriangle } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import KidemTazminatiForm from "./KidemTazminatiForm";
import EklentiModal from "./EklentiModal";
import { loadCalculation } from "./api";
import { parseMoney } from "./utils";
import { useKidem30State } from "./state";
import { calculateMevsimlikBrutUcretToplam } from "./mevsimlikCalculations";
import {
  computeKidemSuresiBasin,
  computeCalismaSuresiBasin,
  kidemTazminatiHakkiYokBasin,
  computeHesaplanacakDegerler,
  computeBrutKidemBasin,
} from "./basinCalculations";
import { calculateIncomeTaxForYear } from "./incomeTaxForYear";
import { fmtCurrency, fmt } from "./calculations";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { isoToTR } from "@/shared/utils/dateUtils";

const PAGE_TITLE = "Kıdem Tazminatı — Basın İş";
const RECORD_TYPE = "kidem_basin";
const REDIRECT_BASE_PATH = "/kidem-tazminati/basin";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

function formatYilAyGun(t: { yil: number; ay: number; gun: number }): string {
  return `${t.yil} Yıl ${t.ay} Ay ${t.gun} Gün`;
}

export default function KidemBasinPage() {
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
    brutTazminat,
    setBrutTazminat,
    setNetTazminat,
  } = useKidem30State();

  const meslegeBaslangic = String(formValues.meslegeBaslangic ?? "");

  const kidemSuresi = useMemo(
    () =>
      computeKidemSuresiBasin(
        meslegeBaslangic,
        formValues.startDate || "",
        formValues.endDate || "",
        String(formValues.denemeSuresiGun ?? "")
      ),
    [meslegeBaslangic, formValues.startDate, formValues.endDate, formValues.denemeSuresiGun]
  );

  const calismaSuresi = useMemo(
    () => computeCalismaSuresiBasin(formValues.startDate || "", formValues.endDate || ""),
    [formValues.startDate, formValues.endDate]
  );

  const toplamBrutUcret = useMemo(() => calculateMevsimlikBrutUcretToplam(formValues), [formValues]);

  const kidemTazminatiHakkiYok = useMemo(
    () => kidemTazminatiHakkiYokBasin(meslegeBaslangic, kidemSuresi.yil),
    [meslegeBaslangic, kidemSuresi.yil]
  );

  const hesaplanacakDegerler = useMemo(
    () => computeHesaplanacakDegerler(kidemSuresi, kidemTazminatiHakkiYok),
    [kidemSuresi, kidemTazminatiHakkiYok]
  );

  const brutNetDisplay = useMemo(
    () =>
      kidemTazminatiHakkiYok
        ? 0
        : computeBrutKidemBasin(toplamBrutUcret, hesaplanacakDegerler),
    [kidemTazminatiHakkiYok, toplamBrutUcret, hesaplanacakDegerler]
  );

  useEffect(() => {
    setTotals({
      toplam: toplamBrutUcret,
      yil: kidemSuresi.yil,
      ay: kidemSuresi.ay,
      gun: kidemSuresi.gun,
    });
  }, [toplamBrutUcret, kidemSuresi, setTotals]);

  useEffect(() => {
    setBrutTazminat(brutNetDisplay);
  }, [brutNetDisplay, setBrutTazminat]);

  const selectedYear = useMemo(() => {
    const d = exitDate || formValues.endDate || "";
    if (!d) return new Date().getFullYear();
    const y = new Date(d).getFullYear();
    if (!Number.isNaN(y) && y >= 2010 && y <= 2035) return y;
    return new Date().getFullYear();
  }, [exitDate, formValues.endDate]);

  const ciplakBrutUcret = useMemo(
    () => parseMoney(formValues.brutUcret || formValues.brut || "0"),
    [formValues.brutUcret, formValues.brut]
  );
  const esikDeger = useMemo(() => ciplakBrutUcret * 24, [ciplakBrutUcret]);

  const damgaVergisi = useMemo(() => brutNetDisplay * 0.00759, [brutNetDisplay]);
  const gelirVergisiUygulanacak = useMemo(() => brutNetDisplay > esikDeger, [brutNetDisplay, esikDeger]);
  const gelirVergisi = useMemo(() => {
    if (!gelirVergisiUygulanacak) return 0;
    const matrah = Math.max(0, brutNetDisplay - esikDeger);
    return calculateIncomeTaxForYear(selectedYear, matrah);
  }, [gelirVergisiUygulanacak, selectedYear, brutNetDisplay, esikDeger]);

  const netDisplay = useMemo(
    () => brutNetDisplay - damgaVergisi - gelirVergisi,
    [brutNetDisplay, damgaVergisi, gelirVergisi]
  );

  useEffect(() => {
    setNetTazminat(netDisplay);
  }, [netDisplay, setNetTazminat]);

  useEffect(() => {
    const e = formValues.endDate || formValues.exitDate;
    if (e && /^\d{4}-\d{2}-\d{2}$/.test(e)) setExitDate(e);
  }, [formValues.endDate, formValues.exitDate, setExitDate]);

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
        if (loaded.formValues) setFormValues((p) => ({ ...p, ...loaded.formValues }));
        if (loaded.totals) setTotals(loaded.totals);
        if (loaded.brutTazminat !== undefined) setBrutTazminat(loaded.brutTazminat);
        if (loaded.netTazminat !== undefined) setNetTazminat(loaded.netTazminat);
        if (loaded.appliedEklenti) setAppliedEklenti(loaded.appliedEklenti);
        if (loaded.name) setCurrentRecordName(loaded.name);
        const ex = loaded.formValues?.exitDate || loaded.formValues?.endDate || loaded.formValues?.istenCikis;
        if (ex) setExitDate(String(ex).split("T")[0]);
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
      showToastError("Lütfen en az bir bilgi girin");
      return;
    }
    kaydetAc({
      hesapTuru: RECORD_TYPE,
      veri: {
        data: {
          form: {
            ...formValues,
            startDate: formValues.startDate,
            endDate: formValues.endDate,
            exitDate: formValues.endDate || formValues.exitDate,
            iseGiris: formValues.startDate,
            istenCikis: formValues.endDate,
            meslegeBaslangic,
          },
          results: { totals, brut: brutNetDisplay, net: netDisplay },
        },
        brut_total: brutNetDisplay,
        net_total: netDisplay,
        ise_giris: formValues.startDate || null,
        isten_cikis: formValues.endDate || null,
      },
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName,
      redirectPath: REDIRECT_BASE_PATH,
    });
  }, [
    formValues,
    totals,
    brutNetDisplay,
    netDisplay,
    meslegeBaslangic,
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
      meslegeBaslangic: "",
      denemeSuresiGun: "",
      extras: [],
    });
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setBrutTazminat(0);
    setNetTazminat(0);
    setExitDate("");
    setAppliedEklenti(undefined);
    setCurrentRecordName(null);
    loadedIdRef.current = null;
    setFormMountKey((k) => k + 1);
  }, [effectiveId, navigate, setFormValues, setTotals, setBrutTazminat, setNetTazminat, setExitDate, setAppliedEklenti, setCurrentRecordName]);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const tarihRows = [
      ["Mesleğe başlangıç", isoToTR(meslegeBaslangic)],
      ["İşe giriş", isoToTR(formValues.startDate)],
      ["İşten çıkış", isoToTR(formValues.endDate)],
      ["Kıdem süresi (hesap)", formatYilAyGun(kidemSuresi)],
      ["Çalışma süresi", formatYilAyGun(calismaSuresi)],
    ];
    const n1 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: tarihRows });
    s.push({ id: "tarih", title: "Tarih Bilgileri", html: buildWordTable(n1.headers, n1.rows), htmlForPdf: buildStyledReportTable(n1.headers, n1.rows) });

    const h = hesaplanacakDegerler;
    const yilT = toplamBrutUcret * h.yil;
    const ayT = (toplamBrutUcret / 12) * h.ay;
    const gunT = (toplamBrutUcret / 365) * h.gun;
    const hesapRows: [string, string][] = [
      ["Aylık toplam brüt (bileşenler)", fmtCurrency(toplamBrutUcret)],
      [`${fmt(toplamBrutUcret)} × ${h.yil} yıl`, fmtCurrency(yilT)],
      [`${fmt(toplamBrutUcret)} / 12 × ${h.ay} ay`, fmtCurrency(ayT)],
      [`${fmt(toplamBrutUcret)} / 365 × ${h.gun} gün`, fmtCurrency(gunT)],
      ["Brüt kıdem (özet)", fmtCurrency(brutNetDisplay)],
    ];
    const n2 = adaptToWordTable({ headers: ["Hesap", "Tutar"], rows: hesapRows });
    s.push({ id: "hesap", title: "Kıdem Hesabı", html: buildWordTable(n2.headers, n2.rows), htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }) });

    const netRows: [string, string][] = [
      ["Brüt kıdem tazminatı", fmtCurrency(brutNetDisplay)],
      ["Damga vergisi (binde 7,59)", `-${fmtCurrency(damgaVergisi)}`],
    ];
    if (gelirVergisiUygulanacak) {
      netRows.push(["Gelir vergisi (matrah: brüt − 24 aylık istisna)", `-${fmtCurrency(gelirVergisi)}`]);
    }
    netRows.push(["Net kıdem tazminatı", fmtCurrency(netDisplay)]);
    const n3 = adaptToWordTable({ headers: ["Kalem", "Tutar"], rows: netRows });
    s.push({ id: "net", title: "Brütten Nete", html: buildWordTable(n3.headers, n3.rows), htmlForPdf: buildStyledReportTable(n3.headers, n3.rows, { lastRowBg: "green" }) });
    return s;
  }, [
    meslegeBaslangic,
    formValues.startDate,
    formValues.endDate,
    kidemSuresi,
    calismaSuresi,
    toplamBrutUcret,
    hesaplanacakDegerler,
    brutNetDisplay,
    damgaVergisi,
    gelirVergisi,
    gelirVergisiUygulanacak,
    netDisplay,
  ]);

  const handlePrint = () => {
    const el = document.getElementById("report-content-basin");
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
      <div style={{ height: "2px", background: pageStyle?.color || "#E11D48" }} />
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3">
          {getVideoLink("kidem-basin") && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(getVideoLink("kidem-basin"), "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Youtube className="w-3 h-3" /> Video
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <section>
                <h2 className={sectionTitleCls}>Tarihler</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Kıdem süresi, mesleğe başlangıç (veya işe giriş) ile işten çıkış arasında; deneme günü mesleğe
                  başlangıca eklenir. Çalışma süresi işe giriş–çıkış arasıdır.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className={labelCls}>Mesleğe başlangıç</label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={meslegeBaslangic}
                      onChange={(e) => setFormValues((p) => ({ ...p, meslegeBaslangic: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>İşe giriş</label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={formValues.startDate || ""}
                      onChange={(e) =>
                        setFormValues((p) => ({
                          ...p,
                          startDate: e.target.value,
                          iseGiris: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>İşten çıkış</label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={formValues.endDate || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormValues((p) => ({
                          ...p,
                          endDate: v,
                          exitDate: v,
                          istenCikis: v,
                        }));
                        setExitDate(v);
                      }}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <div>
                    <label className={labelCls}>Kıdem süresi (hesap)</label>
                    <input type="text" readOnly value={formatYilAyGun(kidemSuresi)} className={`${inputCls} bg-gray-50 dark:bg-gray-700`} />
                  </div>
                  <div>
                    <label className={labelCls}>Çalışma süresi</label>
                    <input type="text" readOnly value={formatYilAyGun(calismaSuresi)} className={`${inputCls} bg-gray-50 dark:bg-gray-700`} />
                  </div>
                </div>
              </section>

              <section>
                <h2 className={sectionTitleCls}>Ücret bilgileri</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  Aylık giydirilmiş brüt ve ek ödemeler (Basın İş).
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
                  initialIseGiris={formValues.startDate || ""}
                  initialIstenCikis={formValues.endDate || exitDate}
                  initialPrim={formValues.prim}
                  initialIkramiye={formValues.ikramiye}
                  initialYol={formValues.yol}
                  initialYemek={formValues.yemek}
                  initialDiger={formValues.diger}
                  initialExtras={formValues.extras}
                />
              </section>

              <section>
                <h2 className={sectionTitleCls}>Deneme süresi düşümü (gün)</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  İsteğe bağlı; mesleğe başlangıç tarihine eklenir (en fazla 90 gün).
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(formValues.denemeSuresiGun ?? "")}
                  onChange={(e) =>
                    setFormValues((p) => ({ ...p, denemeSuresiGun: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  placeholder="0–90"
                  className={`${inputCls} max-w-[120px]`}
                />
              </section>

              <div className="p-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
                <span className="text-xs text-gray-600 dark:text-gray-400">Toplam aylık brüt (bileşenler)</span>
                <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">{fmtCurrency(toplamBrutUcret)} ₺</div>
              </div>

              {kidemTazminatiHakkiYok && (
                <div className="p-2.5 rounded border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/20 text-xs text-orange-800 dark:text-orange-200 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Mesleğe başlangıç girildiğinde, ilk kez kıdem alacaklar için 5 yıldan az kıdemde kıdem tazminatı
                    hakkı doğmaz (v1 ile aynı uyarı).
                  </span>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>Kıdem tazminatı hesaplaması</h3>
                </div>
                <div className="p-2.5 space-y-1 text-xs">
                  {hesaplanacakDegerler.yil > 0 && (
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span>
                        {fmt(toplamBrutUcret)} × {hesaplanacakDegerler.yil} yıl
                      </span>
                      <span>{fmtCurrency(toplamBrutUcret * hesaplanacakDegerler.yil)}</span>
                    </div>
                  )}
                  {hesaplanacakDegerler.ay > 0 && (
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span>
                        {fmt(toplamBrutUcret)} / 12 × {hesaplanacakDegerler.ay} ay
                      </span>
                      <span>{fmtCurrency((toplamBrutUcret / 12) * hesaplanacakDegerler.ay)}</span>
                    </div>
                  )}
                  {hesaplanacakDegerler.gun > 0 && (
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span>
                        {fmt(toplamBrutUcret)} / 365 × {hesaplanacakDegerler.gun} gün
                      </span>
                      <span>{fmtCurrency((toplamBrutUcret / 365) * hesaplanacakDegerler.gun)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                    <span>Brüt kıdem tazminatı</span>
                    <span>{fmtCurrency(brutNetDisplay)}</span>
                  </div>
                </div>
              </div>

              {!kidemTazminatiHakkiYok && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                    <h3 className={`${sectionTitleCls} mb-2`}>Brütten nete</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {gelirVergisiUygulanacak
                        ? `Brüt kıdem, çıplak brütün 24 katını (${fmtCurrency(esikDeger)}) aştığı için gelir vergisi uygulanır.`
                        : `Brüt kıdem, 24 aylık istisnayı aşmadığı için gelir vergisi uygulanmaz.`}{" "}
                      Damga vergisi binde 7,59 kesilir.
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between border-b border-amber-200/80 dark:border-amber-800/50 py-1">
                        <span>Brüt kıdem</span>
                        <span>{fmtCurrency(brutNetDisplay)}</span>
                      </div>
                      {gelirVergisiUygulanacak && (
                        <div className="flex justify-between border-b border-amber-200/80 dark:border-amber-800/50 py-1 text-red-600 dark:text-red-400">
                          <span>Gelir vergisi</span>
                          <span>-{fmtCurrency(gelirVergisi)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-amber-200/80 dark:border-amber-800/50 py-1 text-red-600 dark:text-red-400">
                        <span>Damga vergisi</span>
                        <span>-{fmtCurrency(damgaVergisi)}</span>
                      </div>
                      <div className="flex justify-between pt-1 font-semibold text-green-700 dark:text-green-400">
                        <span>Net kıdem</span>
                        <span>{fmtCurrency(netDisplay)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
                    <h3 className={`${sectionTitleCls} mb-2`}>Taksitlendirme (bilgi)</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      5953 sayılı Kanun m. 6: İşveren tazminatı tek seferde ödeyemezse en çok dört taksit, toplam süre bir
                      yılı geçemez.
                    </p>
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="flex justify-between text-xs py-1 border-b border-gray-200 dark:border-gray-600">
                        <span>{n}. taksit</span>
                        <span>{fmtCurrency(brutNetDisplay / 4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          copyTargetId: "kidem-basin-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`
                .report-section-copy { margin-bottom: 1.25rem; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .report-section-copy .section-title { font-weight: 600; font-size: 0.75rem; color: #374151; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; border-radius: 0.375rem; color: #6b7280; }
                .report-section-copy .copy-icon-btn:hover { background: #f3f4f6; color: #374151; }
                #kidem-basin-word-copy .section-content { border: none; overflow-x: auto; padding: 0; margin: 0; }
                #kidem-basin-word-copy table { border-collapse: collapse; width: 100%; margin: 0; font-size: 0.75rem; color: #111827; }
                #kidem-basin-word-copy td, #kidem-basin-word-copy th { border: 1px solid #999; padding: 5px 8px; background: #fff !important; color: #111827 !important; white-space: nowrap; }
                #kidem-basin-word-copy td:last-child, #kidem-basin-word-copy th:last-child { text-align: right; width: 38%; }
              `}</style>
              <div id="kidem-basin-word-copy">
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
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content-basin"),
        }}
      />

      <div style={{ display: "none" }} aria-hidden>
        <div
          id="report-content-basin"
          style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}
        >
          <style>{`#report-content-basin table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content-basin td,#report-content-basin th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
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
