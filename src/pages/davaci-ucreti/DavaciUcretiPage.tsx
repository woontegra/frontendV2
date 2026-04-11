/**
 * DavaciUcretiPage.tsx
 * SADECE UI + event bağlama.
 * Hesaplama, API, mantık YAPMAZ.
 * Butonlar sadece action çağırır.
 */

import { useMemo, useEffect, useCallback, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Save, Download, Trash2, Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast, ToastProvider, Toaster } from "./toast";
import { KaydetProvider, useKaydetContext } from "./localHooks/KaydetProvider";
import { usePageStyle } from "./localHooks/usePageStyle";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./storage";
import { getAsgariUcretByDate, getAsgariUcretByYearAndPeriod, hasTwoPeriods } from "./utils";
import { saveCalculation } from "./save";
import EklentiModal from "./EklentiModal";

// State ve actions
import { useDavaciUcretiState } from "./state";
import {
  handleLoadCalculation,
  handleCalculateTotalBrut,
  prepareSaveData,
} from "./actions";
import { computeNetFromGrossSingle, computeGrossFromNetSingle, calculateIncomeTaxWithBrackets } from "@/pages/ucret-alacagi/UcretIndependent/localUtils/incomeTaxCore";
import { fmtCurrency, parseNum } from "./calculations";
import { fmtCurrency as fmt, parseNum as parseNumUtil } from "./utils";
import type { ExtraItem } from "./contract";

// Components
import { type ReportConfig } from "@/components/report";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";

// Constants
const PAGE_TITLE = "Davacı Ücreti Hesaplama";
const CALCULATION_TYPE = "davaci_ucreti";

// Kompakt input sınıfları (mobil-first, program havası)
const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

export default function DavaciUcretiPage() {
  return (
    <ToastProvider>
      <KaydetProvider>
        <DavaciUcretiPageContent />
      </KaydetProvider>
    </ToastProvider>
  );
}

function DavaciUcretiPageContent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();

  const { success, error: showToastError } = useToast();
  const { kaydetAc } = useKaydetContext();
  const [isSaving, setIsSaving] = useState(false);

  // State
  const {
    ciplakBrut,
    setCiplakBrut,
    extraItems,
    setExtraItems,
    notes,
    setNotes,
    currentRecordName,
    setCurrentRecordName,
    selectedYear,
    setSelectedYear,
    selectedPeriod,
    setSelectedPeriod,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    saveName,
    setSaveName,
    savedSets,
    setSavedSets,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    netFromGross,
    setNetFromGross,
    netForGross,
    setNetForGross,
    currentYear,
  } = useDavaciUcretiState();

  // Toplam brüt hesapla
  const totalBrut = useMemo(
    () => handleCalculateTotalBrut(ciplakBrut, extraItems),
    [ciplakBrut, extraItems]
  );

  // Rapor config – merkezi BaseReportModal (sürüklenebilir, 16cm)
  const davaciReportConfig = useMemo((): ReportConfig => {
    const fmtVal = (n: number) => fmt(n);
    const grossNetRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = [];
    if (netFromGross && netFromGross.gross > 0) {
      grossNetRows.push(
        { label: "Brüt Ücret", value: `${fmtVal(netFromGross.gross)} ₺` },
        { label: "SGK Primi (%14)", value: `-${fmtVal(netFromGross.sgk)} ₺`, isDeduction: true },
        { label: "İşsizlik Primi (%1)", value: `-${fmtVal(netFromGross.issizlik)} ₺`, isDeduction: true }
      );
      if ((netFromGross.gelirVergisiIstisna ?? 0) > 0) {
        grossNetRows.push(
          { label: "Gelir Vergisi (Brüt)", value: `-${fmtVal(netFromGross.gelirVergisiBrut ?? 0)} ₺`, isDeduction: true },
          { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtVal(netFromGross.gelirVergisiIstisna)} ₺` },
          { label: "Net Gelir Vergisi", value: `-${fmtVal(netFromGross.gelirVergisi)} ₺`, isDeduction: true }
        );
      } else {
        grossNetRows.push({ label: `Gelir Vergisi ${netFromGross.gelirVergisiDilimleri || ""}`, value: `-${fmtVal(netFromGross.gelirVergisi)} ₺`, isDeduction: true });
      }
      if ((netFromGross.damgaVergisiIstisna ?? 0) > 0) {
        grossNetRows.push(
          { label: "Damga Vergisi (Brüt)", value: `-${fmtVal(netFromGross.damgaVergisiBrut ?? 0)} ₺`, isDeduction: true },
          { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtVal(netFromGross.damgaVergisiIstisna)} ₺` },
          { label: "Net Damga Vergisi", value: `-${fmtVal(netFromGross.damgaVergisi)} ₺`, isDeduction: true }
        );
      } else {
        grossNetRows.push({ label: "Damga Vergisi (binde 7,59)", value: `-${fmtVal(netFromGross.damgaVergisi)} ₺`, isDeduction: true });
      }
      grossNetRows.push({ label: "Net Ücret", value: `${fmtVal(netFromGross.net)} ₺`, isNet: true });
    }
    return {
      title: "Davacı Ücreti Raporu",
      sections: { info: true, periodTable: false, grossToNet: grossNetRows.length > 0, mahsuplasma: false },
      infoRows: [{ label: "Hesaplama Yılı", value: String(selectedYear) }],
      customSections: [
        {
          title: "Ücret Bileşenleri",
          content: (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #999', fontSize: '10px' }}>
              <tbody>
                <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', width: '60%' }}>Çıplak Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtVal(parseNum(ciplakBrut))}₺</td>
                </tr>
                {extraItems.filter(item => parseNum(item.value) > 0).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #999', padding: '5px 8px' }}>{item.name || `Ek Kalem ${idx + 1}`}</td>
                    <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtVal(parseNum(item.value))}₺</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#dbeafe', fontWeight: 600 }}>
                  <td style={{ border: '1px solid #999', padding: '5px 8px' }}>Giydirilmiş Brüt Ücret</td>
                  <td style={{ border: '1px solid #999', padding: '5px 8px', textAlign: 'right' }}>{fmtVal(totalBrut)}₺</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        ...(notes && notes.trim() !== ""
          ? [{
              title: "Notlar",
              content: <div style={{ fontSize: '10px', color: '#374151', whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb', padding: '8px', backgroundColor: '#f9fafb' }}>{notes}</div>,
            }]
          : []),
      ],
      grossToNetData: grossNetRows.length > 0 ? { title: "Brüt'ten Net'e Çeviri", rows: grossNetRows } : undefined,
    };
  }, [ciplakBrut, extraItems, totalBrut, netFromGross, selectedYear, notes]);

  // Bir yılda 2 dönem var mı kontrol et
  const hasTwoPeriodsForYear = useMemo(() => {
    return hasTwoPeriods(selectedYear);
  }, [selectedYear]);

  // Asgari ücret kontrolü
  const asgariUcretHatasi = useMemo(() => {
    if (!ciplakBrut || !selectedYear) return null;

    const brutValue = parseNum(ciplakBrut);
    if (!brutValue || brutValue === 0) return null;

    // Yıl ve döneme göre asgari ücreti al
    const minUcret = getAsgariUcretByYearAndPeriod(selectedYear, selectedPeriod);
    if (!minUcret) return null;

    const periodText = hasTwoPeriodsForYear 
      ? (selectedPeriod === 1 ? "1. dönem (Ocak-Haziran)" : "2. dönem (Temmuz-Aralık)")
      : "";

    if (brutValue < minUcret) {
      return `Girilen ücret, ${selectedYear} yılı${hasTwoPeriodsForYear ? ` ${periodText}` : ""} asgari brüt ücretinden düşük olamaz (${fmtCurrency(minUcret)} ₺).`;
    }

    return null;
  }, [ciplakBrut, selectedYear, selectedPeriod, hasTwoPeriodsForYear]);

  // Brütten Nete Çeviri - Tek aylık ücret, Ücret Alacağı ile aynı mantık (lokal, asgari ücret istisnaları dahil)
  useEffect(() => {
    if (totalBrut > 0) {
      const d = computeNetFromGrossSingle(totalBrut, selectedYear, selectedPeriod);
      const matrah = totalBrut - d.totalSgk - d.totalIssizlik;
      const bracketResult = calculateIncomeTaxWithBrackets(selectedYear, matrah);
      setNetFromGross({
        gross: d.totalGross,
        sgk: d.totalSgk,
        issizlik: d.totalIssizlik,
        gelirVergisi: d.totalGelirVergisi,
        gelirVergisiDilimleri: bracketResult.summary,
        damgaVergisi: d.totalDamgaVergisi,
        net: d.totalNet,
        gelirVergisiBrut: d.totalGelirVergisiBrut,
        gelirVergisiIstisna: d.totalGelirVergisiIstisna,
        damgaVergisiBrut: d.totalDamgaVergisiBrut,
        damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      });
    } else {
      setNetFromGross({
        gross: 0,
        sgk: 0,
        issizlik: 0,
        gelirVergisi: 0,
        gelirVergisiDilimleri: "",
        damgaVergisi: 0,
        net: 0,
      });
    }
  }, [totalBrut, selectedYear, selectedPeriod]);

  // Netten Brüte Çeviri - Lokal (Brütten Nete ile AYNI kurallar, asgari ücret istisnası dahil)
  const grossFromNet = useMemo(() => {
    const netVal = parseNum(netForGross);
    if (netVal <= 0) {
      return { net: 0, gross: 0, sgk: 0, issizlik: 0, gelirVergisi: 0, gelirVergisiBrut: 0, gelirVergisiIstisna: 0, gelirVergisiDilimleri: "", damgaVergisi: 0, damgaVergisiBrut: 0, damgaVergisiIstisna: 0 };
    }
    const d = computeGrossFromNetSingle(netVal, selectedYear, selectedPeriod);
    const matrah = d.totalGross - d.totalSgk - d.totalIssizlik;
    const bracketResult = calculateIncomeTaxWithBrackets(selectedYear, matrah);
    return {
      net: d.totalNet,
      gross: d.totalGross,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: bracketResult.summary,
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
    };
  }, [netForGross, selectedYear, selectedPeriod]);

  // Bölüm bazlı tablolar: html=modal (siyah beyaz), htmlForPdf=PDF (renkli)
  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];

    const n1 = adaptToWordTable({
      headers: ["Hesaplama Yılı", "Tarih"],
      rows: [[String(selectedYear), new Date().toLocaleDateString("tr-TR")]],
    });
    sections.push({
      id: "ust-bilgiler",
      title: "Üst Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });

    const bilesenData: { label: string; value: string }[] = [
      { label: "Çıplak Brüt Ücret", value: `${fmt(parseNum(ciplakBrut))}₺` },
    ];
    extraItems.filter((item) => parseNum(item.value) > 0).forEach((item, idx) => {
      bilesenData.push({ label: item.name || `Ek Kalem ${idx + 1}`, value: `${fmt(parseNum(item.value))}₺` });
    });
    bilesenData.push({ label: "Giydirilmiş Brüt Ücret", value: `${fmt(totalBrut)}₺` });
    const n2 = adaptToWordTable(bilesenData);
    sections.push({
      id: "ana-hesap",
      title: "Ücret Bileşenleri",
      html: buildWordTable(n2.headers, n2.rows),
      htmlForPdf: buildStyledReportTable(n2.headers, n2.rows, { lastRowBg: "blue" }),
    });

    const grossNetRows = davaciReportConfig.grossToNetData?.rows;
    if (grossNetRows && grossNetRows.length > 0) {
      const n3 = adaptToWordTable(grossNetRows);
      sections.push({
        id: "brutten-nete",
        title: "Brüt'ten Net'e Çeviri",
        html: buildWordTable(n3.headers, n3.rows),
        htmlForPdf: buildStyledReportTable(n3.headers, n3.rows, { lastRowBg: "green" }),
      });
    }

    // Netten Brüte Çeviri - netForGross doluysa ekle
    if (grossFromNet.gross > 0) {
      const nettenBruteRows: { label: string; value: string }[] = [
        { label: "Net Ücret", value: `${fmt(grossFromNet.net)} ₺` },
        { label: "SGK Primi (%14)", value: `+${fmt(grossFromNet.sgk)} ₺` },
        { label: "İşsizlik Primi (%1)", value: `+${fmt(grossFromNet.issizlik)} ₺` },
      ];
      if ((grossFromNet.gelirVergisiIstisna ?? 0) > 0) {
        nettenBruteRows.push(
          { label: "Gelir Vergisi (Brüt)", value: `+${fmt(grossFromNet.gelirVergisiBrut ?? 0)} ₺` },
          { label: "Asg. Üc. Gelir Vergi İstisnası", value: `-${fmt(grossFromNet.gelirVergisiIstisna ?? 0)} ₺` },
          { label: "Net Gelir Vergisi", value: `+${fmt(grossFromNet.gelirVergisi)} ₺` }
        );
      } else {
        nettenBruteRows.push({ label: "Gelir Vergisi", value: `+${fmt(grossFromNet.gelirVergisi)} ₺` });
      }
      if ((grossFromNet.damgaVergisiIstisna ?? 0) > 0) {
        nettenBruteRows.push(
          { label: "Damga Vergisi (Brüt)", value: `+${fmt(grossFromNet.damgaVergisiBrut ?? 0)} ₺` },
          { label: "Asg. Üc. Damga Vergi İstisnası", value: `-${fmt(grossFromNet.damgaVergisiIstisna ?? 0)} ₺` },
          { label: "Net Damga Vergisi", value: `+${fmt(grossFromNet.damgaVergisi)} ₺` }
        );
      } else {
        nettenBruteRows.push({ label: "Damga Vergisi (binde 7,59)", value: `+${fmt(grossFromNet.damgaVergisi)} ₺` });
      }
      nettenBruteRows.push({ label: "Brüt Ücret", value: `${fmt(grossFromNet.gross)} ₺` });
      const nNetten = adaptToWordTable(nettenBruteRows);
      sections.push({
        id: "netten-brute",
        title: "Net'ten Brüt'e Çeviri",
        html: buildWordTable(nNetten.headers, nNetten.rows),
        htmlForPdf: buildStyledReportTable(nNetten.headers, nNetten.rows, { lastRowBg: "green" }),
      });
    }

    if (notes && notes.trim() !== "") {
      const n4 = adaptToWordTable({ headers: ["Notlar"], rows: [[notes.trim()]] });
      sections.push({
        id: "sonuc",
        title: "Notlar",
        html: buildWordTable(n4.headers, n4.rows),
        htmlForPdf: buildStyledReportTable(n4.headers, n4.rows),
      });
    }

    return sections;
  }, [davaciReportConfig, ciplakBrut, extraItems, totalBrut, selectedYear, notes, grossFromNet]);

  // Veri yükleme
  const loadCalculation = useCallback(
    async (caseId: string) => {
      const result = await handleLoadCalculation(caseId);

      if (result) {
        const formData = result.formData;
        const form = formData.data?.form || formData.form || formData;

        if (form.ciplakBrut) {
          setCiplakBrut(String(form.ciplakBrut));
        }

        if (form.extraItems && Array.isArray(form.extraItems)) {
          const normalizedItems = form.extraItems.map((item: any) => ({
            id: item.id || Math.random().toString(36).slice(2),
            name: String(item.name || ""),
            value: item.value !== undefined && item.value !== null ? String(item.value) : "",
          }));
          setExtraItems(normalizedItems);
        }

        if (form.selectedYear) {
          const year = Number(form.selectedYear);
          setSelectedYear(year);
          // Eğer yılda 2 dönem yoksa, period'u 2'ye sıfırla
          if (!hasTwoPeriods(year)) {
            setSelectedPeriod(2);
          } else if (form.selectedPeriod) {
            setSelectedPeriod(Number(form.selectedPeriod) as 1 | 2);
          }
        } else if (form.selectedPeriod) {
          setSelectedPeriod(Number(form.selectedPeriod) as 1 | 2);
        }

        if (form.notes) {
          setNotes(String(form.notes));
        }

        // Load netFromGross if available
        const savedNetFromGross = formData.data?.netFromGross || formData.netFromGross;
        if (savedNetFromGross) {
          setNetFromGross({
            gross: savedNetFromGross.gross || 0,
            sgk: savedNetFromGross.sgk || 0,
            issizlik: savedNetFromGross.issizlik || 0,
            gelirVergisi: savedNetFromGross.gelirVergisi || 0,
            gelirVergisiDilimleri: String(savedNetFromGross.gelirVergisiDilimleri || ""),
            damgaVergisi: savedNetFromGross.damgaVergisi || 0,
            net: savedNetFromGross.net || 0,
            gelirVergisiBrut: savedNetFromGross.gelirVergisiBrut,
            gelirVergisiIstisna: savedNetFromGross.gelirVergisiIstisna,
            damgaVergisiBrut: savedNetFromGross.damgaVergisiBrut,
            damgaVergisiIstisna: savedNetFromGross.damgaVergisiIstisna,
          });
        }

        setCurrentRecordName(result.name || null);
        success(`Kayıt yüklendi`);
      }
    },
    [setCiplakBrut, setExtraItems, setSelectedYear, setSelectedPeriod, setNotes, setNetFromGross, setCurrentRecordName, success]
  );

  // ID değiştiğinde yükle
  useEffect(() => {
    if (effectiveId) {
      loadCalculation(effectiveId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  // Event handlers
  const handleSave = async () => {
    const saveData = prepareSaveData(
      ciplakBrut,
      extraItems,
      selectedYear,
      selectedPeriod,
      notes,
      totalBrut,
      netFromGross
    );

    kaydetAc({
      hesapTuru: CALCULATION_TYPE,
      veri: saveData,
      mevcutId: effectiveId,
      mevcutKayitAdi: currentRecordName,
      onSuccess: (result) => {
        success("Hesaplama kaydedildi");
        setCurrentRecordName(result.name || null);
        if (result.id && !effectiveId) {
          navigate(`/davaci-ucreti/${result.id}`);
        }
      },
      onError: (err) => {
        showToastError(err.message || "Kaydetme hatası");
      },
    });
  };

  const handleNew = () => {
    if (effectiveId) {
      navigate("/davaci-ucreti");
    }
    setCiplakBrut("");
    setExtraItems([
      { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
      { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
      { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
      { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
    ]);
    setSelectedYear(currentYear);
    setSelectedPeriod(2);
    setNotes("");
    setNetFromGross({
      gross: 0,
      sgk: 0,
      issizlik: 0,
      gelirVergisi: 0,
      gelirVergisiDilimleri: "",
      damgaVergisi: 0,
      net: 0,
    });
    setCurrentRecordName(null);
  };

  const handlePrint = () => {
    try {
      const targetEl = document.getElementById("report-content");
      if (!targetEl) return;
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${PAGE_TITLE}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid}thead{background:#f3f4f6}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}th{text-align:left;font-weight:600}td{text-align:right}td:first-child{text-align:left}h2{font-size:12px;margin:8px 0 6px 0;page-break-after:avoid}div{margin-bottom:10px}button{display:none!important}</style></head><body>${targetEl.outerHTML}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
      };
    } catch (err) {
      console.error("Print error:", err);
    }
  };

  const handleRequestEklenti = (itemId: string) => {
    const fieldKey = `extra:${itemId}`;
    if (!eklentiValues[fieldKey]) {
      setEklentiValues((prev) => ({ ...prev, [fieldKey]: Array(12).fill("") }));
    }
    setActiveModal(fieldKey);
  };

  const handleApplyEklenti = (value: number, fieldKey: string) => {
    const itemId = fieldKey.replace("extra:", "");
    setExtraItems(
      extraItems.map((item) =>
        item.id === itemId
          ? { ...item, value: String(value.toFixed(2)).replace(".", ",") }
          : item
      )
    );
    setActiveModal(null);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }

    if (extraItems.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const saveResult = await saveExtraCalculationsSet(saveName.trim(), extraItems);
    if (saveResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
      const sets = await getAllExtraCalculationsSets();
      setSavedSets(sets);
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setExtraItems(data);
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      showToastError("Yüklenecek veri bulunamadı");
    }
  };

  const handleDeleteExtra = async (id: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;

    const deleteResult = await deleteExtraCalculationsSet(id);
    if (deleteResult) {
      success("Set silindi");
      const sets = await getAllExtraCalculationsSets();
      setSavedSets(sets);
    } else {
      showToastError("Silme başarısız");
    }
  };

  const handleUpdateExtraItem = (itemId: string, field: "name" | "value", value: string) => {
    setExtraItems(
      extraItems.map((it) => (it.id === itemId ? { ...it, [field]: value } : it))
    );
  };

  const handleAddExtraItem = () => {
    setExtraItems([
      ...extraItems,
      { id: Math.random().toString(36).slice(2), name: "", value: "" },
    ]);
  };

  const handleRemoveExtraItem = (itemId: string) => {
    setExtraItems(extraItems.filter((it) => it.id !== itemId));
  };

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#6A1B9A" }} />
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3">
          {/* Video butonu */}
          {getVideoLink("davaci-ucreti") && (
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => window.open(getVideoLink("davaci-ucreti"), "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Youtube className="w-3 h-3" />
                Video
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              {/* Temel Bilgiler */}
              <section>
                <h2 className={sectionTitleCls}>Temel Bilgiler</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <div>
                    <label htmlFor="year" className={labelCls}>Yıl</label>
                    <select
                      id="year"
                      value={selectedYear}
                      onChange={(e) => {
                        const newYear = Number(e.target.value);
                        setSelectedYear(newYear);
                        if (!hasTwoPeriods(newYear)) setSelectedPeriod(2);
                      }}
                      className={inputCls}
                    >
                      {Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  {hasTwoPeriodsForYear && (
                    <div>
                      <label htmlFor="period" className={labelCls}>Dönem</label>
                      <select
                        id="period"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(Number(e.target.value) as 1 | 2)}
                        className={inputCls}
                      >
                        <option value={1}>Oca-Haz</option>
                        <option value={2}>Tem-Ara</option>
                      </select>
                    </div>
                  )}
                  <div className={hasTwoPeriodsForYear ? "col-span-2 sm:col-span-1" : ""}>
                    <label htmlFor="ciplakBrut" className={labelCls}>Çıplak Brüt (₺)</label>
                    <input
                      id="ciplakBrut"
                      type="text"
                      value={ciplakBrut}
                      onChange={(e) => setCiplakBrut(e.target.value)}
                      placeholder="25.000,00"
                      className={`${inputCls} pr-7 ${asgariUcretHatasi ? "border-red-500" : ""}`}
                    />
                    {asgariUcretHatasi && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{asgariUcretHatasi}</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <h2 className={sectionTitleCls}>Ekstra Hesaplamalar</h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => getAllExtraCalculationsSets().then((s) => { setSavedSets(s); setShowImportModal(true); })}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> İçe Aktar
                    </button>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      disabled={extraItems.length === 0}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Kaydet
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  {extraItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.name}
                        onChange={(e) => handleUpdateExtraItem(item.id, "name", e.target.value)}
                        placeholder="Kalem"
                        className={`${inputCls} w-24 sm:w-28 shrink-0`}
                      />
                      <input
                        value={item.value}
                        onChange={(e) => handleUpdateExtraItem(item.id, "value", e.target.value)}
                        placeholder="0"
                        className={`${inputCls} flex-1 min-w-0`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRequestEklenti(item.id)}
                        className="shrink-0 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700"
                        title="Eklenti hesapla"
                      >
                        Eklenti
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraItem(item.id)}
                        className="shrink-0 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                        aria-label="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={handleAddExtraItem} className="text-xs text-blue-600 dark:text-blue-400 py-1 px-2 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                    + Kalem ekle
                  </button>
                </div>
              </section>

              <div className="p-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
                <span className="text-xs text-gray-600 dark:text-gray-400">Giydirilmiş Brüt</span>
                <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">{fmtCurrency(totalBrut)} ₺</div>
              </div>

              {/* Brütten Nete & Netten Brüte */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Brütten Nete */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                  <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                    <h3 className={sectionTitleCls}>Brütten Nete</h3>
                  </div>
                  <div className="p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Brüt Ücret</span>
                      <span className="font-medium">{totalBrut > 0 ? fmtCurrency(netFromGross.gross) : "0,00"} ₺</span>
                    </div>
                    {totalBrut > 0 && (
                      <>
                        <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                          <span>SGK Primi (%14)</span><span>-{fmtCurrency(netFromGross.sgk)} ₺</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400">
                          <span>İşsizlik Primi (%1)</span><span>-{fmtCurrency(netFromGross.issizlik)} ₺</span>
                        </div>
                        {(netFromGross.gelirVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600"><span>Gelir Vergisi (Brüt)</span><span>-{fmtCurrency(netFromGross.gelirVergisiBrut ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-green-600"><span>Asg. Üc. Gel. Vergi İst.</span><span>+{fmtCurrency(netFromGross.gelirVergisiIstisna ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600"><span>Net Gelir Vergisi</span><span>-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span></div>
                          </>
                        ) : (
                          <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600"><span>Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</span><span>-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span></div>
                        )}
                        {(netFromGross.damgaVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600"><span>Damga Vergisi (Brüt)</span><span>-{fmtCurrency(netFromGross.damgaVergisiBrut ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-green-600"><span>Asg. Üc. Damga Vergi İst.</span><span>+{fmtCurrency(netFromGross.damgaVergisiIstisna ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600"><span>Net Damga Vergisi</span><span>-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span></div>
                          </>
                        ) : (
                          <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600"><span>Damga Vergisi (binde 7,59)</span><span>-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span></div>
                        )}
                        <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                          <span>Net Ücret</span><span>{fmtCurrency(netFromGross.net)} ₺</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
                  <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600">
                    <h3 className={sectionTitleCls}>Netten Brüte</h3>
                  </div>
                  <div className="p-2.5 space-y-1 text-xs">
                    <div>
                      <label className={labelCls}>Net (₺)</label>
                      <div className="flex gap-1">
                        <input
                          value={netForGross}
                          onChange={(e) => setNetForGross(e.target.value)}
                          placeholder="18.000"
                          className={inputCls}
                        />
                        {netFromGross.net > 0 && (
                          <button
                            type="button"
                            onClick={() => setNetForGross(fmt(netFromGross.net))}
                            className="shrink-0 px-2 py-1 text-xs rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-gray-700"
                          >
                            Net kullan
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Net Ücret</span>
                      <span className="font-medium">{grossFromNet.net > 0 ? fmtCurrency(grossFromNet.net) : "0,00"} ₺</span>
                    </div>
                    {grossFromNet.gross > 0 && (
                      <>
                        <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600"><span>SGK Primi (%14)</span><span>+{fmtCurrency(grossFromNet.sgk)} ₺</span></div>
                        <div className="flex justify-between py-0.5 border-b border-gray-200 dark:border-gray-600 text-red-600"><span>İşsizlik Primi (%1)</span><span>+{fmtCurrency(grossFromNet.issizlik)} ₺</span></div>
                        {(grossFromNet.gelirVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex justify-between py-0.5 border-b text-red-600"><span>Gelir Vergisi (Brüt)</span><span>+{fmtCurrency(grossFromNet.gelirVergisiBrut ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b text-green-600"><span>Asg. Üc. Gel. Vergi İst.</span><span>-{fmtCurrency(grossFromNet.gelirVergisiIstisna ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b"><span>Net Gelir Vergisi</span><span>+{fmtCurrency(grossFromNet.gelirVergisi)} ₺</span></div>
                          </>
                        ) : (
                          <div className="flex justify-between py-0.5 border-b text-red-600"><span>Gelir Vergisi {grossFromNet.gelirVergisiDilimleri}</span><span>+{fmtCurrency(grossFromNet.gelirVergisi)} ₺</span></div>
                        )}
                        {(grossFromNet.damgaVergisiIstisna ?? 0) > 0 ? (
                          <>
                            <div className="flex justify-between py-0.5 border-b text-red-600"><span>Damga Vergisi (Brüt)</span><span>+{fmtCurrency(grossFromNet.damgaVergisiBrut ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b text-green-600"><span>Asg. Üc. Damga Vergi İst.</span><span>-{fmtCurrency(grossFromNet.damgaVergisiIstisna ?? 0)} ₺</span></div>
                            <div className="flex justify-between py-0.5 border-b"><span>Net Damga Vergisi</span><span>+{fmtCurrency(grossFromNet.damgaVergisi)} ₺</span></div>
                          </>
                        ) : (
                          <div className="flex justify-between py-0.5 border-b text-red-600"><span>Damga Vergisi (binde 7,59)</span><span>+{fmtCurrency(grossFromNet.damgaVergisi)} ₺</span></div>
                        )}
                        <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                          <span>Brüt Ücret</span><span>{fmtCurrency(grossFromNet.gross)} ₺</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notlar – bilgi metni + kayıtlı not (not ekle alanı yok, eski dosyayla aynı) */}
              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 space-y-2">
                  <p className="text-[11px] font-light text-gray-500 dark:text-gray-400">Çıplak Brüt Ücret işçinin işi yapmak için aldığı eklentisiz maaşından ibarettir. Prim, İkramiye gibi ücretlerin hesaplanmasında son 12 aylık bordroda yer alan tüm kalemler toplanır, toplam 360'a bölünür, 30 ile çarpılır.</p>
                  {notes && notes.trim() !== "" && (
                    <p className="text-[11px] font-light text-gray-600 dark:text-gray-300 whitespace-pre-wrap pt-2 border-t border-gray-200 dark:border-gray-600">{notes}</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Kaydet Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm border border-gray-200 dark:border-gray-600 shadow-lg">
            <h3 className={sectionTitleCls}>Ekstra Hesaplamaları Kaydet</h3>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Set adı"
              className={`${inputCls} mt-2 mb-3`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveExtra();
                if (e.key === "Escape") setShowSaveModal(false);
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowSaveModal(false); setSaveName(""); }} className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">İptal</button>
              <button onClick={handleSaveExtra} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* İçe Aktar Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-600 shadow-lg">
            <h3 className={sectionTitleCls}>Kaydedilmiş Setler</h3>
            {savedSets.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">Kaydedilmiş set yok</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {savedSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{set.name}</div>
                      <div className="text-xs text-gray-500">{set.data?.length ?? 0} kalem</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleImportExtra(set.name)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600" title="İçe aktar"><Download className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteExtra(set.id)} className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title="Sil"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <button onClick={() => setShowImportModal(false)} className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Eklenti Modal */}
      {activeModal && (
        <EklentiModal
          open={true}
          title="Eklenti Hesapla"
          onClose={closeModal}
          months={eklentiValues[activeModal] || Array(12).fill("")}
          onMonthsChange={(index, value) => {
            setEklentiValues((prev) => ({
              ...prev,
              [activeModal]:
                prev[activeModal]?.map((v, i) => (i === index ? value : v)) || Array(12).fill(""),
            }));
          }}
          onConfirm={(v) => handleApplyEklenti(v, activeModal)}
        />
      )}

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : (effectiveId ? "Güncelle" : "Kaydet")}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "davaci-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`
                .report-section-copy { margin-bottom: 1.25rem; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .report-section-copy .section-title { font-weight: 600; font-size: 0.75rem; color: #374151; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; border-radius: 0.375rem; color: #6b7280; }
                .report-section-copy .copy-icon-btn:hover { background: #f3f4f6; color: #374151; }
                #davaci-word-copy .section-content { border: none; overflow-x: auto; padding: 0; margin: 0; -webkit-overflow-scrolling: touch; }
                #davaci-word-copy table { border-collapse: collapse; width: 100%; margin: 0; font-size: 0.75rem; color: #111827; }
                #davaci-word-copy td, #davaci-word-copy th { border: 1px solid #999; padding: 5px 8px; background: #fff !important; color: #111827 !important; white-space: nowrap; }
                #davaci-word-copy td:last-child, #davaci-word-copy th:last-child { text-align: right; width: 38%; }
              `}</style>
              <div id="davaci-word-copy">
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
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content"),
        }}
      />

      {/* Report Content (hidden, for PDF/yazdır) - modal ile BİREBİR aynı: wordTableSections kullanılıyor */}
      <div style={{ display: "none" }}>
        <div id="report-content" style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}>
          <style>{`#report-content table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content td,#report-content th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
          {wordTableSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: 14 }} data-section={sec.id}>
              <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px 0", paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>{sec.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: sec.htmlForPdf }} style={{ fontSize: 10 }} />
            </div>
          ))}
        </div>
      </div>
      <Toaster />
    </>
  );
}
