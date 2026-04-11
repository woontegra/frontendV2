/**
 * Haksız Fesih Tazminatı — v2 (Prim / Kötü Niyet ile aynı kabuk, tek kart).
 * Hesaplama: v1 ile aynı (1–6 aylık katsayı tablosu + mahsup + damga).
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { calcWorkPeriodBilirKisi } from "@/pages/kidem-tazminati/utils";
import { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

import { loadSavedCase } from "./api";

const RECORD_TYPE = "haksiz_fesih_tazminati";
const REDIRECT_PATH = "/haksiz-fesih-tazminati";
const PREVIEW_TITLE = "Haksız Fesih Tazminatı Rapor";
const PAGE_HEADING = "Haksız Fesih Tazminatı";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

const DAMGA_ORAN = 0.00759;

type CoefRow = { label: string; value: number; k: number };

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

const NOTE_BLOCKS: string[] = [
  "6098 sayılı Kanun kapsamında hizmet sözleşmesi ile çalışanlar kıdem tazminatı alacağına hak kazanamazken haksız fesih tazminatı alacağı talep edilebilirler; 6098 sayılı Kanun'un 438 inci maddesinde öngörülen şartlar gerçekleştiği takdirde bu tazminata hak kazanabilirler.",
  "TBK'nın \"b. Haklı sebebe dayanmayan fesihte\" başlıklı 438. maddesinde işverenin haklı sebep olmaksızın hizmet sözleşmesini derhâl feshetmesi halinde işçinin tazminat isteyebileceği; belirli süreli sözleşmelerde süreye uyulmaması durumunda tazminat; tasarruf ve diğer gelirlerin mahsubu; hâkimin serbest takdiriyle tazminat (ancak altı aylık ücreti aşmamak üzere) düzenlenmiştir.",
  "Haksız fesih tazminatı, yapılan feshin haksız olması sebebiyle işçiye ödenir. Ancak belirlenecek tazminat, işçinin 6 aylık ücretinden fazla olamaz. Haksız fesih tazminatı, bakiye ücret tazminatından ayrı bir tazminat türüdür.",
];

export default function HaksizFesihTazminatiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("haksiz-fesih");
  const loadedIdRef = useRef<string | null>(null);

  const [brut, setBrut] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [brutInputForNet, setBrutInputForNet] = useState("");
  const [odenenTutar, setOdenenTutar] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  const brutVal = useMemo(() => parseNum(brut), [brut]);

  const coefRows = useMemo((): CoefRow[] => {
    if (brutVal <= 0) return [];
    const katsayilar = [1, 2, 3, 4, 5, 6];
    return katsayilar.map((k) => ({
      label: `${k} aylık${brut ? ` × ${brut}` : ""}`,
      value: brutVal * k,
      k,
    }));
  }, [brut, brutVal]);

  const brutForNetConversion = useMemo(() => {
    const inputVal = parseNum(brutInputForNet);
    return inputVal > 0 ? inputVal : coefRows[coefRows.length - 1]?.value || 0;
  }, [brutInputForNet, coefRows]);

  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const r = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!r.label || r.label === "0 Yıl 0 Ay 0 Gün") return null;
    return r;
  }, [startDate, endDate]);

  const asgariUcretHatasi = useMemo(() => {
    if (!endDate || !brut) return null;
    const minUcret = getAsgariUcretByDate(endDate);
    if (!minUcret) return null;
    if (brutVal > 0 && brutVal < minUcret) {
      const year = new Date(endDate).getFullYear();
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${fmt(minUcret)} ₺).`;
    }
    return null;
  }, [endDate, brut, brutVal]);

  const damgaVergisi = brutForNetConversion * DAMGA_ORAN;
  const netTazminat = brutForNetConversion * (1 - DAMGA_ORAN);
  const odenenVal = parseNum(odenenTutar);
  const mahsupSonrasiNet = Math.max(0, netTazminat - odenenVal);

  useEffect(() => {
    if (!effectiveId || loadedIdRef.current === effectiveId) return;
    let mounted = true;
    loadedIdRef.current = effectiveId;

    loadSavedCase(effectiveId)
      .then((raw) => {
        if (!mounted) return;
        const data = raw as Record<string, unknown>;
        const payload = parseSavedPayload(raw);
        const form =
          (payload.form as Record<string, unknown>) ||
          ((payload.data as Record<string, unknown>)?.form as Record<string, unknown>) ||
          payload;

        const pick = (k: string) => (typeof form[k] === "string" ? (form[k] as string) : "");

        if (pick("brut")) setBrut(pick("brut"));
        if (pick("startDate")) setStartDate(pick("startDate"));
        if (pick("endDate")) setEndDate(pick("endDate"));
        if (pick("brutInputForNet")) setBrutInputForNet(pick("brutInputForNet"));
        if (pick("odenenTutar")) setOdenenTutar(pick("odenenTutar"));

        setCurrentRecordName(
          (data.name as string) || (data.notes as string) || (data.aciklama as string) || null
        );
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

    const grossToNetRows: NonNullable<ReportConfig["grossToNetData"]>["rows"] = [
      { label: "Brüt Haksız Fesih Tazminatı", value: `${fmtLocal(brutForNetConversion)} ₺` },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)} ₺`, isDeduction: true },
      { label: "Net Haksız Fesih Tazminatı", value: `${fmtLocal(netTazminat)} ₺`, isNet: true },
    ];

    if (odenenVal > 0) {
      grossToNetRows.push(
        { label: "İşçiye Ödenen Tutar (Mahsup)", value: `-${fmtLocal(odenenVal)} ₺`, isDeduction: true },
        { label: "Mahsup Sonrası Net Tutar", value: `${fmtLocal(mahsupSonrasiNet)} ₺`, isNet: true }
      );
    }

    return {
      title: PAGE_HEADING,
      sections: { info: true, periodTable: true, grossToNet: true },
      infoRows: [
        { label: "Çıplak Brüt Ücret", value: brutVal ? `${fmtLocal(brutVal)} ₺` : "-" },
        {
          label: "İşe Giriş Tarihi",
          value: startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "-",
          condition: !!startDate,
        },
        {
          label: "İşten Çıkış Tarihi",
          value: endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "-",
          condition: !!endDate,
        },
        { label: "Çalışma Süresi", value: workPeriod?.label || "-", condition: !!workPeriod },
        {
          label: "İşçiye Ödenen Tutar",
          value: odenenVal > 0 ? `${fmtLocal(odenenVal)} ₺` : "-",
          condition: odenenVal > 0,
        },
      ],
      periodData:
        coefRows.length > 0
          ? {
              title: "Haksız Fesih Tazminatı Hesaplama Detayı",
              headers: ["Katsayı", "Hesaplama", "Tutar"],
              rows: coefRows.map((row) => [
                `${row.k} ay`,
                `${fmtLocal(brutVal)} × ${row.k}`,
                `${fmtLocal(row.value)} ₺`,
              ]),
              alignRight: [2],
            }
          : undefined,
      grossToNetData: {
        title: "Brütten Nete",
        rows: grossToNetRows,
      },
    };
  }, [
    brutVal,
    startDate,
    endDate,
    workPeriod,
    coefRows,
    brutForNetConversion,
    odenenVal,
    damgaVergisi,
    netTazminat,
    mahsupSonrasiNet,
  ]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (reportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const pd = reportConfig.periodData;
    if (pd?.rows?.length) {
      const n2 = adaptToWordTable({ headers: pd.headers, rows: pd.rows });
      sections.push({
        id: "haksiz-fesih-hesap",
        title: pd.title || "Haksız Fesih Tazminatı Hesaplama Detayı",
        html: buildWordTable(n2.headers, n2.rows),
      });
    }

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
  }, [reportConfig]);

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
    if (!brut || brutVal <= 0) {
      showToastError("Geçerli bir brüt ücret giriniz");
      return;
    }
    try {
      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              brut,
              startDate,
              endDate,
              brutInputForNet,
              odenenTutar,
            },
            results: {
              rows: coefRows.map((r) => ({ kat: r.k, amount: r.value })),
              maxAmount: coefRows[coefRows.length - 1]?.value || 0,
              brutForNetConversion,
            },
          },
          calculation_type: RECORD_TYPE,
          brut_total: Number((coefRows[coefRows.length - 1]?.value || 0).toFixed(2)),
          net_total: Number(netTazminat.toFixed(2)),
          brut,
          rows: coefRows.map((r) => ({ kat: r.k, amount: r.value })),
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
    if (brut || startDate || endDate) {
      if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam edilsin mi?")) return;
    }
    setBrut("");
    setStartDate("");
    setEndDate("");
    setBrutInputForNet("");
    setOdenenTutar("");
    setCurrentRecordName(null);
    loadedIdRef.current = null;
    if (effectiveId) navigate(REDIRECT_PATH);
  };

  const clampYearInDateInput = (value: string) => {
    if (!value || !value.includes("-")) return value;
    const parts = value.split("-");
    if (parts[0] && parts[0].length > 4) parts[0] = parts[0].substring(0, 4);
    return parts.join("-");
  };

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
                <h2 className={sectionTitleCls}>Tarih bilgileri</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className={labelCls} htmlFor="hf-ise-giris">
                      İşe giriş
                    </label>
                    <input
                      id="hf-ise-giris"
                      type="date"
                      max="9999-12-31"
                      value={startDate}
                      onChange={(e) => setStartDate(clampYearInDateInput(e.target.value))}
                      onBlur={() => {
                        if (
                          startDate &&
                          /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
                          endDate &&
                          /^\d{4}-\d{2}-\d{2}$/.test(endDate)
                        ) {
                          if (new Date(startDate) > new Date(endDate)) {
                            showToastError("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                          }
                        }
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="hf-isten-cikis">
                      İşten çıkış
                    </label>
                    <input
                      id="hf-isten-cikis"
                      type="date"
                      max="9999-12-31"
                      value={endDate}
                      onChange={(e) => setEndDate(clampYearInDateInput(e.target.value))}
                      onBlur={() => {
                        if (
                          startDate &&
                          /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
                          endDate &&
                          /^\d{4}-\d{2}-\d{2}$/.test(endDate)
                        ) {
                          if (new Date(endDate) < new Date(startDate)) {
                            showToastError("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                          }
                        }
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Çalışma süresi</label>
                    <input
                      readOnly
                      value={workPeriod?.label || "-"}
                      className={`${inputCls} bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400`}
                    />
                  </div>
                </div>
              </section>

              <section>
                <label className={`${labelCls} flex flex-wrap items-center gap-1`} htmlFor="hf-brut">
                  Çıplak brüt ücret
                </label>
                <input
                  id="hf-brut"
                  value={brut}
                  onChange={(e) => setBrut(e.target.value)}
                  placeholder="Örn: 25.000"
                  className={`${inputCls} ${asgariUcretHatasi ? "border-red-500" : ""}`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Dava tarihindeki emsal brüt ücret yazılabilir.
                </p>
                {asgariUcretHatasi ? (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{asgariUcretHatasi}</p>
                ) : null}
              </section>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>Katsayı tablosu (1–6 ay)</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  {coefRows.length === 0 ? (
                    <div className="p-2.5 text-xs text-gray-500 dark:text-gray-400">
                      Brüt ücret girildiğinde satırlar listelenir.
                    </div>
                  ) : (
                    coefRows.map((r) => (
                      <div key={r.k} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 px-2.5 py-2 text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 sm:text-right">
                          {fmt(r.value)} ₺
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <section>
                <label className={labelCls} htmlFor="hf-mahsup">
                  İşçiye ödenen tutar (mahsup)
                </label>
                <input
                  id="hf-mahsup"
                  value={odenenTutar}
                  onChange={(e) => setOdenenTutar(e.target.value)}
                  placeholder="Örn: 50.000"
                  className={inputCls}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Varsa net tazminattan mahsup edilir.
                </p>
                {odenenVal > 0 ? (
                  <div className="mt-2 p-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Mahsup sonrası net</span>
                    <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      {fmt(mahsupSonrasiNet)} ₺
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>Brütten nete</h3>
                </div>
                <div className="p-2.5 space-y-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi uygulanır.
                  </p>
                  <div>
                    <label className={labelCls} htmlFor="hf-brut-net-ops">
                      Brüt tutar (opsiyonel)
                    </label>
                    <input
                      id="hf-brut-net-ops"
                      value={brutInputForNet}
                      onChange={(e) => setBrutInputForNet(e.target.value)}
                      placeholder={`Varsayılan: ${fmt(coefRows[coefRows.length - 1]?.value || 0)}`}
                      className={`${inputCls} mt-0.5`}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Boş bırakılırsa tablonun son satırı (6 aylık) kullanılır.
                    </p>
                  </div>
                  <div className="space-y-1 text-xs border-t border-gray-200 dark:border-gray-600 pt-2">
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Brüt haksız fesih</span>
                      <span className="font-medium">{fmt(brutForNetConversion)} ₺</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                      <span>Damga vergisi (binde 7,59)</span>
                      <span>-{fmt(damgaVergisi)} ₺</span>
                    </div>
                    <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                      <span>Net</span>
                      <span>{fmt(netTazminat)} ₺</span>
                    </div>
                    {odenenVal > 0 ? (
                      <>
                        <div className="flex justify-between py-0.5 border-t border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                          <span>Mahsup</span>
                          <span>-{fmt(odenenVal)} ₺</span>
                        </div>
                        <div className="flex justify-between pt-1 font-semibold text-indigo-700 dark:text-indigo-300">
                          <span>Mahsup sonrası net</span>
                          <span>{fmt(mahsupSonrasiNet)} ₺</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 mt-1 space-y-2">
                  {NOTE_BLOCKS.map((p, i) => (
                    <p key={i} className="text-[11px] font-light text-gray-500 dark:text-gray-400">
                      {p}
                    </p>
                  ))}
                  <p className="text-[11px] font-light text-red-600 dark:text-red-400">
                    Ancak belirlenecek tazminat, işçinin 6 aylık ücretinden fazla olamaz.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

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
          copyTargetId: "haksiz-fesih-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #haksiz-fesih-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #haksiz-fesih-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="haksiz-fesih-word-copy">
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
