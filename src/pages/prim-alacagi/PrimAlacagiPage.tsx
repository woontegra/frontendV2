/**
 * Prim Alacağı — v2 (mobil öncelikli, AppShell içinde).
 * Mantık v1 ile uyumlu; UI v2 kompakt stiller.
 */

import { useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Youtube, Copy, Trash2 } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

import { usePrimState } from "./state";
import {
  handleCalculatePrim,
  handleLoadCalculation,
  handleValidateForm,
  prepareSaveData,
} from "./actions";
import {
  fmt,
  getBrutForNetConversion,
  calculateNetFromBrut,
  calculateDamgaVergisi,
  parseNum,
} from "./calculations";
import type { PrimRowRequest } from "./contract";

const PREVIEW_TITLE = "Prim Alacağı Rapor";
const REDIRECT_PATH = "/prim-alacagi";

const BUTTON_LABELS = {
  ADD_ROW: "+ Satır Ekle",
  REMOVE_ROW: "Sil",
};

const FORM_LABELS = {
  PRINCIPAL: "Prim Matrahı (Brüt Ücret)",
  PERCENT: "Prim Oranı (%)",
  PRIM_AMOUNT: "Prim Tutarı",
  TOTAL_PRIM: "Toplam Prim",
};

const NOTE_TEXT =
  "İş sözleşmesinde veya toplu iş sözleşmesinde belirlenen prim ödemeleri, işçinin çalışması karşılığında kazanılan haklardan olup, ödenmemesi halinde alacak olarak talep edilebilir. Primler genellikle performansa, satış rakamlarına veya belirli hedeflere ulaşılmasına bağlı olarak ödenir.";

/** Kıdem 30 işçi sayfası ile aynı form stilleri */
const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

export default function PrimAlacagiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("prim-alacagi");
  const loadedIdRef = useRef<string | null>(null);

  const {
    rows,
    setRows,
    amounts,
    setAmounts,
    total,
    setTotal,
    brutInputForNet,
    setBrutInputForNet,
    currentRecordName,
    setCurrentRecordName,
  } = usePrimState();

  const brutForNetConversion = useMemo(
    () => getBrutForNetConversion(brutInputForNet, total),
    [brutInputForNet, total]
  );

  useEffect(() => {
    if (rows.length > 0 && rows.some((r) => r.principal && r.percent)) {
      let cancelled = false;
      handleCalculatePrim(rows)
        .then((result) => {
          if (cancelled) return;
          if (result) {
            setAmounts(result.amounts);
            setTotal(result.total);
          } else {
            setAmounts([]);
            setTotal(0);
          }
        })
        .catch((err) => {
          console.error("Prim hesaplama hatası:", err);
          if (!cancelled) {
            setAmounts([]);
            setTotal(0);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    setAmounts([]);
    setTotal(0);
    return undefined;
  }, [rows, setAmounts, setTotal]);

  useEffect(() => {
    if (!effectiveId || loadedIdRef.current === effectiveId) return;
    let mounted = true;
    loadedIdRef.current = effectiveId;

    handleLoadCalculation(effectiveId)
      .then((data) => {
        if (!mounted || !data) return;

        const formData = data.formData;
        const form =
          (formData as { form?: unknown }).form ||
          (formData as { data?: { form?: unknown } }).data?.form ||
          formData;

        if (
          form &&
          typeof form === "object" &&
          "rows" in form &&
          Array.isArray((form as { rows: unknown }).rows) &&
          (form as { rows: unknown[] }).rows.length > 0
        ) {
          const loadedRows: PrimRowRequest[] = (form as { rows: PrimRowRequest[] }).rows.map((r) => ({
            id: r.id || Math.random().toString(36).slice(2),
            principal: r.principal ? String(r.principal) : "",
            percent: r.percent ? String(r.percent) : "",
          }));
          setRows(loadedRows);
        } else if (
          (formData as { rows?: unknown[] }).rows &&
          Array.isArray((formData as { rows: unknown[] }).rows) &&
          (formData as { rows: unknown[] }).rows.length > 0
        ) {
          const loadedRows: PrimRowRequest[] = (formData as { rows: PrimRowRequest[] }).rows.map((r) => ({
            id: r.id || Math.random().toString(36).slice(2),
            principal: r.principal ? String(r.principal) : "",
            percent: r.percent ? String(r.percent) : "",
          }));
          setRows(loadedRows);
        }

        const brutNet =
          (form as { brutInputForNet?: string })?.brutInputForNet ??
          (formData as { brutInputForNet?: string }).brutInputForNet;
        if (brutNet) setBrutInputForNet(brutNet);

        setCurrentRecordName(data.name || data.notes || null);
        success(`Kayıt yüklendi (#${effectiveId})`);
      })
      .catch((err) => {
        if (mounted) {
          loadedIdRef.current = null;
          console.error("Kayıt yüklenirken hata:", err);
          showToastError("Kayıt yüklenemedi");
        }
      });

    return () => {
      mounted = false;
    };
  }, [effectiveId, setRows, setBrutInputForNet, setCurrentRecordName, success, showToastError]);

  const primReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const damgaVergisi = calculateDamgaVergisi(brutForNetConversion);
    const netTotal = calculateNetFromBrut(brutForNetConversion);

    return {
      title: "Prim Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Toplam Prim Kalemi", value: rows.length.toString() },
        { label: "Toplam Prim Alacağı", value: total ? `${fmtLocal(total)} ₺` : "-" },
      ],
      periodData: {
        title: "Prim Alacağı Detayı",
        headers: ["#", "Prim Matrahı (Brüt Ücret)", "Prim Oranı (%)", "Prim Tutarı"],
        rows: rows.map((row, idx) => {
          const amount = amounts[idx] || 0;
          const principalNum = parseNum(row.principal);
          const percentNum = parseNum(row.percent);
          return [
            (idx + 1).toString(),
            principalNum > 0 ? `${fmtLocal(principalNum)} ₺` : "-",
            percentNum > 0 ? `%${fmtLocal(percentNum)}` : "-",
            `${fmtLocal(amount)} ₺`,
          ];
        }),
        footer: ["", "", "TOPLAM:", `${fmtLocal(total)} ₺`],
        alignRight: [1, 2, 3],
      },
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Prim Alacağı", value: `${fmtLocal(brutForNetConversion)} ₺` },
          {
            label: "Damga Vergisi (Binde 7,59)",
            value: `-${fmtLocal(damgaVergisi)} ₺`,
            isDeduction: true,
          },
          { label: "Net Prim Alacağı", value: `${fmtLocal(netTotal)} ₺`, isNet: true },
        ],
      },
    };
  }, [rows, amounts, total, brutForNetConversion]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = primReportConfig.infoRows || [];
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({
        id: "ust-bilgiler",
        title: "Genel Bilgiler",
        html: buildWordTable(n1.headers, n1.rows),
      });
    }

    const pd = primReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) periodRows.push(pd.footer);
      const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({
        id: "prim-detay",
        title: pd.title || "Prim Alacağı Detayı",
        html: buildWordTable(n2.headers, n2.rows),
      });
    }

    const gnd = primReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({
        id: "brutten-nete",
        title: primReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri",
        html: buildWordTable(n3.headers, n3.rows),
      });
    }

    return sections;
  }, [primReportConfig]);

  const handlePrint = useCallback(() => {
    const targetEl = document.getElementById("report-content");
    if (!targetEl) {
      window.print();
      return;
    }
    const title = primReportConfig.title;
    const contentHtml = targetEl.innerHTML;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0 auto;font-size:10px;max-width:16cm}table{width:100%!important;max-width:16cm!important;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid!important}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}</style></head><body>${contentHtml}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
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
  }, [primReportConfig.title]);

  const handleSave = () => {
    try {
      const validation = handleValidateForm(rows);
      if (!validation.isValid) {
        showToastError(validation.firstError || "Form hatası");
        return;
      }
      const saveData = prepareSaveData(rows, amounts, total, brutInputForNet);
      kaydetAc({
        hesapTuru: "prim_alacagi",
        veri: saveData,
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: REDIRECT_PATH,
      });
    } catch {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    const hasUnsavedChanges = rows.some((r) => r.principal || r.percent);
    if (hasUnsavedChanges) {
      if (!window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
    }
    setRows([{ id: Math.random().toString(36).slice(2), principal: "", percent: "" }]);
    setBrutInputForNet("");
    setCurrentRecordName(null);
    loadedIdRef.current = null;
    if (effectiveId) navigate(REDIRECT_PATH);
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), principal: "", percent: "" },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((x) => x.id !== rowId));
  };

  const handleUpdateRow = (rowId: string, field: "principal" | "percent", value: string) => {
    setRows((prev) => prev.map((x) => (x.id === rowId ? { ...x, [field]: value } : x)));
  };

  const damgaVergisiBrut = calculateDamgaVergisi(brutForNetConversion);
  const netPrimDisplay = calculateNetFromBrut(brutForNetConversion);

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
                <h2 className={sectionTitleCls}>Prim Kalemleri</h2>
                <div className="mt-2 space-y-1.5">
                  {rows.map((r, idx) => {
                    const amount = amounts[idx] || 0;
                    return (
                      <div key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 min-w-0">
                          <label className={labelCls}>{FORM_LABELS.PRINCIPAL}</label>
                          <input
                            value={r.principal}
                            onChange={(e) => handleUpdateRow(r.id, "principal", e.target.value)}
                            placeholder="Örn: 50.000"
                            className={inputCls}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="w-full sm:w-24 shrink-0">
                          <label className={labelCls}>{FORM_LABELS.PERCENT}</label>
                          <input
                            value={r.percent}
                            onChange={(e) => handleUpdateRow(r.id, "percent", e.target.value)}
                            placeholder="10"
                            className={inputCls}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="flex-1 min-w-0 sm:min-w-[7rem]">
                          <label className={labelCls}>{FORM_LABELS.PRIM_AMOUNT}</label>
                          <input
                            readOnly
                            value={`${fmt(amount)} ₺`}
                            className={`${inputCls} bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.id)}
                          className="shrink-0 self-end sm:self-auto p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
                          aria-label="Satırı sil"
                          title="Satırı sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 py-1 px-2 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {BUTTON_LABELS.ADD_ROW}
                </button>
              </section>

              <div className="p-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
                <span className="text-xs text-gray-600 dark:text-gray-400">{FORM_LABELS.TOTAL_PRIM}</span>
                <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">{fmt(total)} ₺</div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className={sectionTitleCls}>Brütten Nete</h3>
                </div>
                <div className="p-2.5 space-y-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Brüt tutardan yalnızca binde 7,59 oranında damga vergisi kesintisi uygulanır.
                  </p>
                  <div>
                    <label className={labelCls}>Brüt Tutar (opsiyonel)</label>
                    <input
                      type="text"
                      value={brutInputForNet}
                      onChange={(e) => setBrutInputForNet(e.target.value)}
                      placeholder={`Varsayılan: ${fmt(total)}`}
                      className={`${inputCls} mt-0.5`}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Boş bırakırsanız toplam prim alacağı kullanılır.
                    </p>
                  </div>
                  <div className="space-y-1 text-xs border-t border-gray-200 dark:border-gray-600 pt-2">
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Brüt Prim Alacağı</span>
                      <span className="font-medium">{fmt(brutForNetConversion)} ₺</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                      <span>Damga Vergisi (Binde 7,59)</span>
                      <span>-{fmt(damgaVergisiBrut)} ₺</span>
                    </div>
                    <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                      <span>Net Prim Alacağı</span>
                      <span>{fmt(netPrimDisplay)} ₺</span>
                    </div>
                  </div>
                </div>
              </div>

              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 mt-1">
                  <p className="text-[11px] font-light text-gray-500 dark:text-gray-400">{NOTE_TEXT}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "none" }} aria-hidden="true">
        <div id="report-content" style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}>
          <ReportContentFromConfig config={primReportConfig} />
        </div>
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={
          isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : effectiveId ? "Güncelle" : "Kaydet"
        }
        onPrint={handlePrint}
        previewButton={{
          title: PREVIEW_TITLE,
          copyTargetId: "prim-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #prim-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #prim-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="prim-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button
                        type="button"
                        className="copy-icon-btn"
                        onClick={() => copySectionForWord(sec.id)}
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
