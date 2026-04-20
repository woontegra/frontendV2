/**
 * Bakiye Ücret Alacağı — v2 (tek kart, FooterActions, v1 API ile uyumlu).
 */

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Youtube, Copy, Save, Download, Trash2 } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { apiClient } from "@/utils/apiClient";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "@/utils/extraCalculationsStorage";
import EklentiModal from "@/pages/kidem-tazminati/EklentiModal";
import { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { calcWorkPeriodBilirKisi } from "@/pages/kidem-tazminati/utils";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { loadSavedCase } from "./api";

const PAGE_HEADING = "Bakiye Ücret Alacağı";
const PREVIEW_TITLE = "Bakiye Ücret Alacağı Rapor";
const REDIRECT_PATH = "/bakiye-ucret-alacagi";
const RECORD_TYPE = "bakiye_ucret";

const BUTTON_LABELS = { CALCULATE: "Bakiye Hesapla", SAVE: "Kaydet", RESET: "Sıfırla" };
const FORM_LABELS = {
  START_DATE: "Çalışma dönemi başlangıcı",
  END_DATE: "Çalışma dönemi sonu",
  RESIGN_DATE: "İş Akdinin Fesih Edildiği Tarih",
  BRUT: "Çıplak Brüt Ücret",
  EXTRA_ITEMS: "Ekstra Hesaplamalar (Prim, İkramiye, Yol, Yemek vb.)",
  REMAINING_TIME: "Kalan Süre",
  GROSS_TO_NET: "Brütten Nete Çevir",
  NET_TO_GROSS: "Netten Brüte Çevir",
  GROSS_SALARY: "Brüt Ücret",
  NET_SALARY: "Net Ücret",
};
const NOTE_TEXT =
  "Belirli süreli iş sözleşmelerinde iş akdi süresinden önce sonlandırılır ise sözleşme sonuna kadar kararlaştırılan ücret bakiye ücret olarak talep edilebilir.";

/** KidemTazminatiForm / Boşta Geçen Süre ile aynı ekstra satır stilleri */
const inputClsExtra =
  "px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent min-h-[2.25rem]";
const eklentiBtnCls =
  "min-h-9 min-w-0 flex-1 px-2 py-1.5 text-center text-xs text-blue-600 dark:text-blue-400 sm:flex-none sm:whitespace-nowrap rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700";

const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const round2 = (v: number) => Math.round((v || 0) * 100) / 100;
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function toDisplayDate(iso: string): string {
  try {
    const d = parseISO(iso);
    if (Number.isNaN(+d)) return iso;
    return format(d, "dd.MM.yyyy");
  } catch {
    return iso;
  }
}

const calculateRemainingDays = (resignDate: string, endDate: string): number => {
  try {
    if (!resignDate || !endDate) return 0;
    const r = new Date(resignDate);
    const e = new Date(endDate);
    if (Number.isNaN(+r) || Number.isNaN(+e)) return 0;
    if (r >= e) return 0;
    const date1 = new Date(r.getFullYear(), r.getMonth(), r.getDate());
    const date2 = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const diffTime = date2.getTime() - date1.getTime();
    return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
  } catch {
    return 0;
  }
};

const calculateRemainingLabel = (resignDate: string, endDate: string): string => {
  try {
    if (!resignDate || !endDate) return "";
    const result = calcWorkPeriodBilirKisi(resignDate, endDate);
    return result.label || "";
  } catch {
    return "";
  }
};

type Row = { start: string; end: string; days: number; amount: number };
type MonthRow = { start: string; end: string; days: number; gross: number; net: number };
type ExtraItem = { id: string; name: string; value: string };

const validateBakiyeUcretForm = (form: {
  startDate: string;
  endDate: string;
  resignDate: string;
  brut: string;
}) => {
  const errors: string[] = [];
  if (!form.startDate) errors.push("Başlangıç tarihi gerekli");
  if (!form.endDate) errors.push("Bitiş tarihi gerekli");
  if (!form.resignDate) errors.push("Fesih tarihi gerekli");
  if (!form.brut || parseNum(form.brut) <= 0) errors.push("Geçerli bir brüt ücret girin");
  return { isValid: errors.length === 0, errors };
};

const defaultNetFromGross = {
  gross: 0,
  sgk: 0,
  issizlik: 0,
  gelirVergisi: 0,
  gelirVergisiBrut: 0,
  gelirVergisiIstisna: 0,
  gelirVergisiDilimleri: "",
  damgaVergisi: 0,
  damgaVergisiBrut: 0,
  damgaVergisiIstisna: 0,
  net: 0,
};

export default function BakiyeUcretAlacagiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const videoLink = getVideoLink("bakiye-ucret");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [resignDate, setResignDate] = useState("");
  const [brut, setBrut] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef(false);

  const [extraItems, setExtraItems] = useState<ExtraItem[]>([
    { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
    { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
    { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
    { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
  ]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [eklentiExtraId, setEklentiExtraId] = useState<string | null>(null);

  const [editingGross, setEditingGross] = useState<Record<number, string>>({});
  useEffect(() => {
    if (monthRows.length === 0) setEditingGross({});
  }, [monthRows.length]);

  const [grossForNet, setGrossForNet] = useState("");
  const [netForGross, setNetForGross] = useState("");

  const asgariUcretHatasi = useMemo(() => {
    if (!resignDate || !brut) return null;
    const minUcret = getAsgariUcretByDate(resignDate);
    if (!minUcret) return null;
    const brutValue = parseNum(brut);
    if (!brutValue || brutValue === 0) return null;
    if (brutValue < minUcret) {
      const year = new Date(resignDate).getFullYear();
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${fmtCurrency(minUcret)}₺).`;
    }
    return null;
  }, [resignDate, brut]);

  const monthlyBase = useMemo(() => parseNum(brut), [brut]);
  const extrasTotal = useMemo(
    () => extraItems.reduce((acc, it) => acc + parseNum(it.value), 0),
    [extraItems]
  );
  const monthly = useMemo(() => monthlyBase + extrasTotal, [monthlyBase, extrasTotal]);
  const daily = useMemo(() => (monthly > 0 ? monthly / 30 : 0), [monthly]);
  const total = useMemo(() => round2(rows.reduce((acc, r) => acc + r.amount, 0)), [rows]);

  const remainingDays = useMemo(() => calculateRemainingDays(resignDate, endDate), [resignDate, endDate]);
  const remainingLabel = useMemo(() => calculateRemainingLabel(resignDate, endDate), [resignDate, endDate]);

  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const result = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!result.label) return null;
    return result;
  }, [startDate, endDate]);

  const grossVal = useMemo(() => parseNum(grossForNet), [grossForNet]);

  const selectedYear = useMemo(() => {
    const dateStr = resignDate || endDate || "";
    if (dateStr) {
      try {
        const date = new Date(dateStr);
        if (!Number.isNaN(date.getTime())) return date.getFullYear();
      } catch {
        /* ignore */
      }
    }
    return new Date().getFullYear();
  }, [resignDate, endDate]);

  const [netFromGross, setNetFromGross] = useState(defaultNetFromGross);

  useEffect(() => {
    if (grossVal > 0) {
      const totalFromMonthRows =
        monthRows.length > 0 ? round2(monthRows.reduce((a, b) => a + b.gross, 0)) : 0;
      const useSegmented = monthRows.length > 0 && Math.abs(grossVal - totalFromMonthRows) < 1;
      const endpoint = useSegmented ? "/api/bakiye-ucret/net-from-gross-segmented" : "/api/bakiye-ucret/net-from-gross";
      const body = useSegmented
        ? {
            monthRows: monthRows.map((m) => ({ start: m.start, end: m.end, days: m.days, gross: m.gross })),
            year: selectedYear,
          }
        : { gross: grossVal, year: selectedYear };
      apiClient(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) setNetFromGross(result.data);
        })
        .catch(() => {});
    } else {
      setNetFromGross({ ...defaultNetFromGross });
    }
  }, [grossVal, selectedYear, monthRows]);

  const netVal = useMemo(() => parseNum(netForGross), [netForGross]);
  const [grossFromNet, setGrossFromNet] = useState({
    net: 0,
    gross: 0,
    sgk: 0,
    issizlik: 0,
    gelirVergisi: 0,
    gelirVergisiBrut: 0,
    gelirVergisiIstisna: 0,
    gelirVergisiDilimleri: "",
    damgaVergisi: 0,
    damgaVergisiBrut: 0,
    damgaVergisiIstisna: 0,
  });

  useEffect(() => {
    if (netVal <= 0) {
      setGrossFromNet({
        net: 0,
        gross: 0,
        sgk: 0,
        issizlik: 0,
        gelirVergisi: 0,
        gelirVergisiBrut: 0,
        gelirVergisiIstisna: 0,
        gelirVergisiDilimleri: "",
        damgaVergisi: 0,
        damgaVergisiBrut: 0,
        damgaVergisiIstisna: 0,
      });
      return;
    }
    const netMatchesLeft =
      monthRows.length > 0 && netFromGross.net > 0 && Math.abs(netVal - netFromGross.net) < 1;
    if (netMatchesLeft) {
      setGrossFromNet({ ...netFromGross });
      return;
    }
    apiClient(`/api/bakiye-ucret/gross-from-net`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netInput: netVal, year: selectedYear }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) setGrossFromNet(result.data);
      })
      .catch(() => {});
  }, [netVal, selectedYear, monthRows.length, netFromGross]);

  useEffect(() => {
    loadRanRef.current = false;
  }, [effectiveId]);

  useEffect(() => {
    if (!effectiveId) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (loadRanRef.current) return;
        loadRanRef.current = true;

        const raw = (await loadSavedCase(effectiveId)) as Record<string, unknown>;
        if (!isMounted) return;

        let payload: Record<string, unknown> = {};
        if (raw.data) {
          if (typeof raw.data === "string") {
            try {
              payload = JSON.parse(raw.data) as Record<string, unknown>;
            } catch {
              payload = {};
            }
          } else {
            payload = raw.data as Record<string, unknown>;
          }
        }

        const rawData = payload.data;
        const nested =
          rawData && typeof rawData === "object" && !Array.isArray(rawData)
            ? (rawData as Record<string, unknown>)
            : null;
        const formData =
          (payload.form as Record<string, unknown>) ||
          (nested?.form as Record<string, unknown>) ||
          payload;
        const results =
          (payload.results as Record<string, unknown>) ||
          (nested?.results as Record<string, unknown>) ||
          {};

        const startDateValue =
          (formData.startDate as string) ||
          (formData.start_date as string) ||
          (raw.start_date as string);
        const endDateValue =
          (formData.endDate as string) || (formData.end_date as string) || (raw.end_date as string);
        const resignDateValue =
          (formData.resignDate as string) ||
          (formData.resign_date as string) ||
          (raw.resign_date as string);

        if (startDateValue) setStartDate(startDateValue);
        if (endDateValue) setEndDate(endDateValue);
        if (resignDateValue) setResignDate(resignDateValue);

        const brutValue =
          formData.brut !== undefined && formData.brut !== null
            ? formData.brut
            : (raw as { brut_total?: number }).brut_total;
        if (brutValue !== undefined && brutValue !== null) setBrut(String(brutValue));

        const ex = formData.extraItems as ExtraItem[] | undefined;
        if (ex && Array.isArray(ex)) setExtraItems(ex);

        const rRows = results.rows as Row[] | undefined;
        const mRows = results.monthRows as MonthRow[] | undefined;
        if (rRows && Array.isArray(rRows) && rRows.length > 0) setRows(rRows);
        if (mRows && Array.isArray(mRows) && mRows.length > 0) {
          setMonthRows(mRows);
          const tot = mRows.reduce((a, m) => a + (m.gross || 0), 0);
          if (tot > 0)
            setGrossForNet(tot.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } else if (startDateValue && endDateValue && resignDateValue && brutValue != null) {
          const monthlyValue =
            parseNum(String(brutValue)) +
            (ex && Array.isArray(ex) ? ex.reduce((acc, it) => acc + parseNum(it.value || "0"), 0) : 0);
          if (monthlyValue > 0) {
            const response = await apiClient(`/api/bakiye-ucret/calculate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startDate: startDateValue,
                endDate: endDateValue,
                resignDate: resignDateValue,
                monthly: monthlyValue,
              }),
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                setRows(result.data.rows || []);
                setMonthRows(result.data.monthRows || []);
                const tot =
                  result.data.totalAmount ??
                  (result.data.monthRows || []).reduce((a: number, m: { gross?: number }) => a + (m.gross || 0), 0);
                if (tot > 0)
                  setGrossForNet(
                    Number(tot).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  );
              }
            }
          }
        }

        setCurrentRecordName(
          (raw.name as string) || (raw.notes as string) || (raw.aciklama as string) || null
        );
        success(`Kayıt yüklendi (#${effectiveId})`);
      } catch (e) {
        if (!isMounted) return;
        console.error(e);
        showToastError("Kayıt yüklenemedi");
      }
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, [effectiveId]); // eslint-disable-line react-hooks/exhaustive-deps -- success/showToastError

  useEffect(() => {
    if (showImportModal) {
      void getAllExtraCalculationsSets().then(setSavedSets);
    }
  }, [showImportModal]);

  const handleSaveExtra = async () => {
    if (!saveName.trim()) {
      showToastError("Lütfen bir isim girin");
      return;
    }
    const items = extraItems.map((it) => ({ id: it.id, name: it.name, value: it.value }));
    if (items.length === 0) {
      showToastError("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }
    const ok = await saveExtraCalculationsSet(saveName.trim(), items);
    if (ok) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      showToastError("Kaydetme başarısız");
    }
  };

  const handleImportExtra = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      setExtraItems(data.map((it) => ({ id: it.id, name: it.name, value: it.value })));
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      showToastError("Yüklenecek veri bulunamadı");
    }
  };

  const handleDeleteExtra = async (setId: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;
    const ok = await deleteExtraCalculationsSet(setId);
    if (ok) {
      success("Set silindi");
      void getAllExtraCalculationsSets().then(setSavedSets);
    } else {
      showToastError("Silme başarısız");
    }
  };

  const handleApplyEklenti = useCallback(
    (eklenti: number) => {
      const formatted = String(eklenti.toFixed(2)).replace(".", ",");
      if (eklentiExtraId) {
        setExtraItems((prev) =>
          prev.map((p) => (p.id === eklentiExtraId ? { ...p, value: formatted } : p))
        );
      }
      setModalOpen(false);
      setEklentiExtraId(null);
      info("Eklenti hesaplandı", "Seçili kaleme uygulandı");
    },
    [eklentiExtraId, info]
  );

  const handleMonthRowGrossBlur = useCallback(
    async (index: number) => {
      const raw = editingGross[index];
      if (raw === undefined) return;
      setEditingGross((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      const parsed = parseNum(raw);
      if (!Number.isFinite(parsed) || parsed < 0) return;
      const mr = monthRows[index];
      if (!mr) return;
      try {
        const res = await apiClient(`/api/bakiye-ucret/net-from-gross-segmented`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthRows: [{ start: mr.start, end: mr.end, days: mr.days, gross: parsed }],
            year: selectedYear,
          }),
        });
        const result = await res.json();
        if (result.success && result.data) {
          setMonthRows((prev) =>
            prev.map((m, i) => (i === index ? { ...m, gross: round2(parsed), net: result.data.net } : m))
          );
          const newTotal = monthRows.reduce((a, b, i) => a + (i === index ? parsed : b.gross), 0);
          setGrossForNet(
            round2(newTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          );
        }
      } catch {
        setMonthRows((prev) => prev.map((m, i) => (i === index ? { ...m, gross: round2(parsed) } : m)));
      }
    },
    [editingGross, monthRows, selectedYear]
  );

  const handleCalculate = async () => {
    const validation = validateBakiyeUcretForm({ startDate, endDate, resignDate, brut });
    if (!validation.isValid) {
      showToastError(validation.errors[0] || "Formu kontrol edin");
      setRows([]);
      setMonthRows([]);
      return;
    }
    if (!monthly || monthly <= 0) {
      showToastError("Toplam aylık ücret 0'dan büyük olmalıdır");
      setRows([]);
      setMonthRows([]);
      return;
    }
    try {
      const response = await apiClient(`/api/bakiye-ucret/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, resignDate, monthly }),
      });
      const result = await response.json();
      if (!response.ok) {
        showToastError(result.error || `HTTP ${response.status}`);
        setRows([]);
        setMonthRows([]);
        return;
      }
      if (result.success && result.data) {
        setRows(result.data.rows || []);
        setMonthRows(result.data.monthRows || []);
        setEditingGross({});
        const tot =
          result.data.totalAmount ??
          (result.data.rows || []).reduce((a: number, r: { amount?: number }) => a + (r.amount || 0), 0);
        if (tot > 0) {
          setGrossForNet(
            Number(tot).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          );
        }
      } else {
        showToastError(result.error || "Hesaplama başarısız");
        setRows([]);
        setMonthRows([]);
      }
    } catch (err: unknown) {
      showToastError(err instanceof Error ? err.message : "Hesaplama sırasında hata oluştu");
      setRows([]);
      setMonthRows([]);
    }
  };

  const bakiyeUcretReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const extrasContent = extraItems
      .filter((item) => parseNum(item.value) > 0)
      .map((item) => `${item.name}: ${fmtLocal(parseNum(item.value))}₺`)
      .join(", ");

    const grossToNetRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = [
      { label: "Brüt Ücret", value: `${fmtLocal(netFromGross.gross)}₺` },
      { label: "SGK Primi (%14)", value: `-${fmtLocal(netFromGross.sgk)}₺`, isDeduction: true },
      { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(netFromGross.issizlik)}₺`, isDeduction: true },
    ];
    if ((netFromGross.gelirVergisiIstisna ?? 0) > 0) {
      grossToNetRows.push(
        { label: "Gelir Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.gelirVergisiBrut ?? 0)}₺`, isDeduction: true },
        { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtLocal(netFromGross.gelirVergisiIstisna ?? 0)}₺` },
        { label: "Net Gelir Vergisi", value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push({
        label: "Gelir Vergisi " + (netFromGross.gelirVergisiDilimleri || ""),
        value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`,
        isDeduction: true,
      });
    }
    if ((netFromGross.damgaVergisiIstisna ?? 0) > 0) {
      grossToNetRows.push(
        { label: "Damga Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.damgaVergisiBrut ?? 0)}₺`, isDeduction: true },
        { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtLocal(netFromGross.damgaVergisiIstisna ?? 0)}₺` },
        { label: "Net Damga Vergisi", value: `-${fmtLocal(netFromGross.damgaVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push({
        label: "Damga Vergisi (binde 7,59)",
        value: `-${fmtLocal(netFromGross.damgaVergisi)}₺`,
        isDeduction: true,
      });
    }
    grossToNetRows.push({ label: "Net Ücret", value: `${fmtLocal(netFromGross.net)}₺`, isNet: true });

    return {
      title: PAGE_HEADING,
      sections: { info: true, periodTable: true, grossToNet: true },
      infoRows: [
        {
          label: "Çalışma dönemi başlangıcı",
          value: startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "-",
        },
        {
          label: "Çalışma dönemi sonu",
          value: endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "-",
        },
        {
          label: "İş Akdinin Fesih Edildiği Tarih",
          value: resignDate ? new Date(resignDate).toLocaleDateString("tr-TR") : "-",
        },
        { label: "Kalan Süre", value: remainingLabel || `${remainingDays} gün` },
        { label: "Çıplak Brüt Ücret", value: monthlyBase ? `${fmtLocal(monthlyBase)}₺` : "-" },
        { label: "Ekstra Haklar", value: extrasContent || "-", condition: extrasTotal > 0 },
        { label: "Aylık Toplam Ücret", value: monthly ? `${fmtLocal(monthly)}₺` : "-" },
        { label: "Günlük Ücret", value: daily ? `${fmtLocal(daily)}₺` : "-" },
      ],
      periodData: {
        title: "Bakiye Ücret Hesaplama Cetveli",
        headers: ["Dönem", "Gün Sayısı", "Tutar"],
        rows: rows.map((row) => [
          `${toDisplayDate(row.start)} – ${toDisplayDate(row.end)}`,
          row.days.toString(),
          `${fmtLocal(row.amount)}₺`,
        ]),
        footer: ["TOPLAM:", "", `${fmtLocal(total)}₺`],
        alignRight: [1, 2],
      },
      grossToNetData:
        netFromGross.gross > 0
          ? { title: "Brütten Nete Çevir", rows: grossToNetRows }
          : undefined,
      customSections:
        monthRows.length > 0
          ? [
              {
                title: "Aylık Brüt → Net Dönüşüm",
                content: (
                  <div className="space-y-1 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    <table
                      style={{
                        width: "100%",
                        fontSize: "9px",
                        borderCollapse: "collapse",
                        border: "1px solid #d1d5db",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "8px 10px",
                              fontWeight: 600,
                              border: "1px solid #d1d5db",
                            }}
                          >
                            Dönem
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "8px 10px",
                              fontWeight: 600,
                              border: "1px solid #d1d5db",
                            }}
                          >
                            Gün
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "8px 10px",
                              fontWeight: 600,
                              border: "1px solid #d1d5db",
                            }}
                          >
                            Brüt
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "8px 10px",
                              fontWeight: 600,
                              border: "1px solid #d1d5db",
                            }}
                          >
                            Net
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthRows.map((mr, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: "8px 10px", border: "1px solid #d1d5db" }}>
                              {toDisplayDate(mr.start)} – {toDisplayDate(mr.end)}
                            </td>
                            <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>
                              {mr.days}
                            </td>
                            <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>
                              {fmtLocal(mr.gross)} ₺
                            </td>
                            <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>
                              {fmtLocal(mr.net)} ₺
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 600, background: "#f9fafb" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", border: "1px solid #d1d5db" }}>
                            TOPLAM:
                          </td>
                          <td style={{ textAlign: "right", padding: "8px 10px", border: "1px solid #d1d5db" }}>
                            {fmtLocal(monthRows.reduce((a, b) => a + b.gross, 0))} ₺
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              padding: "8px 10px",
                              border: "1px solid #d1d5db",
                              color: "#16a34a",
                            }}
                          >
                            {fmtLocal(monthRows.reduce((a, b) => a + b.net, 0))} ₺
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ),
              },
            ]
          : undefined,
    };
  }, [
    startDate,
    endDate,
    resignDate,
    remainingDays,
    remainingLabel,
    monthlyBase,
    extrasTotal,
    extraItems,
    monthly,
    daily,
    rows,
    total,
    monthRows,
    netFromGross,
  ]);

  const fmtLocalWord = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const infoRowsFiltered = (bakiyeUcretReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }
    const pd = bakiyeUcretReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) periodRows.push(pd.footer);
      const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({
        id: "bakiye-hesaplama",
        title: pd.title || "Bakiye Ücret Hesaplama Cetveli",
        html: buildWordTable(n2.headers, n2.rows),
      });
    }
    if (monthRows.length > 0) {
      const aylikRows = monthRows.map((mr) => [
        `${toDisplayDate(mr.start)} – ${toDisplayDate(mr.end)}`,
        mr.days.toString(),
        `${fmtLocalWord(mr.gross)} ₺`,
        `${fmtLocalWord(mr.net)} ₺`,
      ]);
      const grossToplam = monthRows.reduce((a, b) => a + b.gross, 0);
      const netToplam = monthRows.reduce((a, b) => a + b.net, 0);
      aylikRows.push(["TOPLAM:", "", `${fmtLocalWord(grossToplam)} ₺`, `${fmtLocalWord(netToplam)} ₺`]);
      const n3 = adaptToWordTable({
        headers: ["Dönem", "Gün", "Brüt", "Net"],
        rows: aylikRows,
      });
      sections.push({
        id: "aylik-brut-net",
        title: "Aylık Brüt → Net Dönüşüm",
        html: buildWordTable(n3.headers, n3.rows),
      });
    }
    const gnd = bakiyeUcretReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n4 = adaptToWordTable(gnd);
      sections.push({
        id: "brutten-nete",
        title: bakiyeUcretReportConfig.grossToNetData?.title || "Brütten Nete Çevir",
        html: buildWordTable(n4.headers, n4.rows),
      });
    }
    return sections;
  }, [bakiyeUcretReportConfig, monthRows]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
    if (!el) return;
    const title = bakiyeUcretReportConfig.title;
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
  }, [bakiyeUcretReportConfig.title]);

  const handleSave = () => {
    try {
      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              startDate,
              endDate,
              resignDate,
              brut,
              extraItems,
              monthly,
            },
            results: {
              total,
              rows,
              monthRows,
              monthly,
              daily,
              brutTotal: total,
              netTotal: total,
            },
          },
          start_date: startDate,
          end_date: endDate,
          resign_date: resignDate,
          brut_total: Number(total.toFixed(2)),
          net_total: Number(total.toFixed(2)),
          brut,
          extraItems,
          monthly,
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
    const dirty = Boolean(startDate || endDate || resignDate || brut || rows.length > 0);
    if (dirty && !window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
    setStartDate("");
    setEndDate("");
    setResignDate("");
    setBrut("");
    setRows([]);
    setMonthRows([]);
    setExtraItems([
      { id: Math.random().toString(36).slice(2), name: "Prim", value: "" },
      { id: Math.random().toString(36).slice(2), name: "İkramiye", value: "" },
      { id: Math.random().toString(36).slice(2), name: "Yol", value: "" },
      { id: Math.random().toString(36).slice(2), name: "Yemek", value: "" },
    ]);
    setCurrentRecordName(null);
    setGrossForNet("");
    setNetForGross("");
    loadRanRef.current = false;
    if (effectiveId) navigate(REDIRECT_PATH);
  };

  const dateInputCls =
    "w-full mt-1 rounded-lg h-9 text-sm border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-2.5";
  const textInputCls =
    "w-full mt-1 rounded-lg h-9 text-sm border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-2.5";

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#004D40" }} />
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
                <h2 className={sectionTitleCls}>{PAGE_HEADING}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Çalışma dönemi, fesih tarihi ve ücret; kalan süre için bakiye ücret hesaplanır.
                </p>
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.START_DATE}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value?.includes("-")) {
                        const parts = value.split("-");
                        if (parts[0]?.length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join("-");
                          e.target.value = value;
                        }
                      }
                      setStartDate(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (
                        newValue &&
                        /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                        endDate &&
                        /^\d{4}-\d{2}-\d{2}$/.test(endDate)
                      ) {
                        const newDate = new Date(newValue);
                        const exitDate = new Date(endDate);
                        if (!Number.isNaN(+newDate) && !Number.isNaN(+exitDate) && newDate > exitDate) {
                          showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                        }
                      }
                    }}
                    className={dateInputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.END_DATE}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value?.includes("-")) {
                        const parts = value.split("-");
                        if (parts[0]?.length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join("-");
                          e.target.value = value;
                        }
                      }
                      setEndDate(value);
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value;
                      if (
                        newValue &&
                        /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                        startDate &&
                        /^\d{4}-\d{2}-\d{2}$/.test(startDate)
                      ) {
                        const newDate = new Date(newValue);
                        const startDateObj = new Date(startDate);
                        if (!Number.isNaN(+newDate) && !Number.isNaN(+startDateObj) && newDate < startDateObj) {
                          showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                        }
                      }
                    }}
                    className={dateInputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {FORM_LABELS.RESIGN_DATE}
                  </label>
                  <input
                    type="date"
                    value={resignDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value?.includes("-")) {
                        const parts = value.split("-");
                        if (parts[0]?.length > 4) {
                          parts[0] = parts[0].substring(0, 4);
                          value = parts.join("-");
                          e.target.value = value;
                        }
                      }
                      setResignDate(value);
                    }}
                    className={dateInputCls}
                  />
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 p-2.5">
                    <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                      {FORM_LABELS.REMAINING_TIME}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                      {remainingDays > 0 ? remainingLabel : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {workPeriod?.label ? (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                    Toplam çalışma süresi: <span className="font-semibold">{workPeriod.label}</span>
                  </p>
                </div>
              ) : null}

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{FORM_LABELS.BRUT}</label>
                <input
                  value={brut}
                  onChange={(e) => setBrut(e.target.value)}
                  placeholder="Örn: 25.000,00"
                  className={`${textInputCls} ${asgariUcretHatasi ? "border-2 border-red-500" : ""}`}
                />
                {asgariUcretHatasi ? (
                  <div className="text-[11px] text-red-600 mt-0.5 font-medium">{asgariUcretHatasi}</div>
                ) : null}
              </div>

              {/* Ekstra hesaplamalar — KidemTazminatiForm / Boşta Geçen Süre ile aynı düzen */}
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="w-6 h-6 shrink-0 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-xs text-indigo-600 dark:text-indigo-400">
                      ₺
                    </span>
                    Ekstra Hesaplamalar
                  </h2>
                  <div className="flex flex-row flex-nowrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        void getAllExtraCalculationsSets().then(setSavedSets);
                        setShowImportModal(true);
                      }}
                      className="flex-1 sm:flex-none min-w-0 px-2 py-1.5 rounded border text-xs font-medium bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 inline-flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">İçe Aktar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveModal(true)}
                      disabled={extraItems.length === 0}
                      className="flex-1 sm:flex-none min-w-0 px-2 py-1.5 rounded border text-xs font-medium bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 inline-flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Kaydet</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                  {FORM_LABELS.EXTRA_ITEMS}
                  <span
                    className="cursor-help text-orange-500 ml-1"
                    title="Çıplak brüt ücrete ek olarak prim, ikramiye, yemek gibi düzenli ödemeleri buraya ekleyebilirsiniz."
                  >
                    ⓘ
                  </span>
                </p>
                <div className="space-y-2">
                  {extraItems.map((it) => (
                    <div
                      key={it.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-nowrap sm:gap-2"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          value={it.name}
                          onChange={(e) =>
                            setExtraItems((prev) =>
                              prev.map((p) => (p.id === it.id ? { ...p, name: e.target.value } : p))
                            )
                          }
                          className={`w-24 shrink-0 sm:w-28 ${inputClsExtra}`}
                          placeholder="Kalem"
                        />
                        <input
                          value={it.value}
                          onChange={(e) =>
                            setExtraItems((prev) =>
                              prev.map((p) => (p.id === it.id ? { ...p, value: e.target.value } : p))
                            )
                          }
                          className={`min-w-0 flex-1 basis-0 ${inputClsExtra} text-right`}
                          placeholder="Örn: 2.500,00"
                        />
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-start">
                        <button
                          type="button"
                          className={eklentiBtnCls}
                          onClick={() => {
                            setModalTitle(`${it.name || "Ek Kalem"} için eklenti hesapla`);
                            setEklentiExtraId(it.id);
                            setModalOpen(true);
                          }}
                        >
                          Eklenti Hesapla
                          <span
                            className="ml-1 cursor-help text-orange-500 dark:text-orange-400"
                            title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın"
                          >
                            ⓘ
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExtraItems((prev) => prev.filter((p) => p.id !== it.id))}
                          className="shrink-0 p-2 text-red-500 transition-colors hover:rounded-full hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          aria-label="Satırı sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setExtraItems((prev) => [
                        ...prev,
                        { id: Math.random().toString(36).slice(2), name: "Ek Kalem", value: "" },
                      ])
                    }
                    className="text-xs text-blue-600 dark:text-blue-400 py-1 px-2 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    + Ekle
                  </button>
                </div>
                <div className="flex flex-col gap-1 pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>Ekstra toplam</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                      {fmtCurrency(extrasTotal)} ₺
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <span>Toplam brüt (çıplak + ekstra)</span>
                    <span className="tabular-nums">{fmtCurrency(monthly)} ₺</span>
                  </div>
                </div>
              </div>

              <Button type="button" onClick={() => void handleCalculate()} className="w-full rounded-lg h-10">
                {BUTTON_LABELS.CALCULATE}
              </Button>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                {rows.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Alanları doldurup <strong>{BUTTON_LABELS.CALCULATE}</strong> ile hesaplayın.
                  </p>
                ) : monthRows.length > 0 ? (
                  <div className="mt-1 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                    <table className="min-w-full text-xs border-collapse text-gray-900 dark:text-gray-100">
                      <thead>
                        <tr className="text-left text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          <th className="py-1.5 px-2 border border-gray-200 dark:border-gray-600 font-semibold">
                            Dönem
                          </th>
                          <th className="py-1.5 px-2 border border-gray-200 dark:border-gray-600 font-semibold">
                            Gün
                          </th>
                          <th className="py-1.5 px-2 border border-gray-200 dark:border-gray-600 font-semibold">
                            Brüt
                          </th>
                          <th className="py-1.5 px-2 border border-gray-200 dark:border-gray-600 font-semibold">
                            Net
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthRows.map((mr, i) => (
                          <tr key={i} className="bg-white dark:bg-gray-800/30">
                            <td className="py-1.5 px-2 border border-gray-200 dark:border-gray-600">
                              {toDisplayDate(mr.start)} – {toDisplayDate(mr.end)}
                            </td>
                            <td className="py-1.5 px-2 border border-gray-200 dark:border-gray-600">
                              {mr.days} gün
                            </td>
                            <td className="py-1.5 px-2 border border-gray-200 dark:border-gray-600">
                              <Input
                                type="text"
                                value={editingGross[i] ?? fmtCurrency(mr.gross)}
                                onChange={(e) => setEditingGross((prev) => ({ ...prev, [i]: e.target.value }))}
                                onBlur={() => void handleMonthRowGrossBlur(i)}
                                className="h-8 w-24 text-xs"
                              />
                            </td>
                            <td className="py-1.5 px-2 border border-gray-200 dark:border-gray-600">
                              {fmtCurrency(mr.net)} ₺
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 text-xs">
                      <div className="flex justify-between">
                        <span>Toplam brüt</span>
                        <span className="font-semibold">
                          {fmtCurrency(monthRows.reduce((a, b) => a + b.gross, 0))} ₺
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Toplam net</span>
                        <span className="font-medium">
                          {fmtCurrency(monthRows.reduce((a, b) => a + b.net, 0))} ₺
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <Card className="border-gray-200 dark:border-gray-600 shadow-sm">
                  <CardHeader className="pb-1.5 pt-3 px-3">
                    <CardTitle className="text-xs">{FORM_LABELS.GROSS_TO_NET}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 pb-3">
                    <div>
                      <Label className="text-[11px]">{FORM_LABELS.GROSS_SALARY}</Label>
                      <Input
                        value={grossForNet}
                        onChange={(e) => setGrossForNet(e.target.value)}
                        placeholder="Örn: 25.000,00"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                    <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-gray-600 text-[11px]">
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Brüt ücret</span>
                        <span className="font-semibold">{fmtCurrency(netFromGross.gross)} ₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                        <span>SGK primi (%14)</span>
                        <span>-{fmtCurrency(netFromGross.sgk)} ₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                        <span>İşsizlik primi (%1)</span>
                        <span>-{fmtCurrency(netFromGross.issizlik)} ₺</span>
                      </div>
                      {(netFromGross.gelirVergisiIstisna ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                            <span>Gelir vergisi (brüt)</span>
                            <span>-{fmtCurrency(netFromGross.gelirVergisiBrut ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-green-600 dark:text-green-400">
                            <span>Asg. üc. gel. vergi ist.</span>
                            <span>+{fmtCurrency(netFromGross.gelirVergisiIstisna ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600 dark:text-gray-400">Net gelir vergisi</span>
                            <span>-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                          <span className="pr-1">Gelir vergisi {netFromGross.gelirVergisiDilimleri}</span>
                          <span className="shrink-0">-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span>
                        </div>
                      )}
                      {(netFromGross.damgaVergisiIstisna ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                            <span>Damga vergisi (brüt)</span>
                            <span>-{fmtCurrency(netFromGross.damgaVergisiBrut ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-green-600 dark:text-green-400">
                            <span>Asg. üc. damga vergi ist.</span>
                            <span>+{fmtCurrency(netFromGross.damgaVergisiIstisna ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600 dark:text-gray-400">Net damga vergisi</span>
                            <span>-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                          <span>Damga vergisi (binde 7,59)</span>
                          <span>-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 font-semibold text-green-700 dark:text-green-400 text-xs">
                        <span>Net ücret</span>
                        <span>{fmtCurrency(netFromGross.net)} ₺</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 dark:border-gray-600 shadow-sm">
                  <CardHeader className="pb-1.5 pt-3 px-3">
                    <CardTitle className="text-xs">{FORM_LABELS.NET_TO_GROSS}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 pb-3">
                    <div>
                      <Label className="text-[11px]">{FORM_LABELS.NET_SALARY}</Label>
                      <div className="flex gap-1.5 mt-0.5">
                        <Input
                          value={netForGross}
                          onChange={(e) => setNetForGross(e.target.value)}
                          placeholder="Örn: 18.000,00"
                          className="h-8 text-xs flex-1"
                        />
                        {netFromGross.net > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setNetForGross(
                                netFromGross.net.toLocaleString("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              )
                            }
                            className="shrink-0 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-700 h-8"
                          >
                            Sol net
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-gray-600 text-[11px]">
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Net ücret</span>
                        <span className="font-semibold">{fmtCurrency(grossFromNet.net)} ₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                        <span>SGK primi (%14)</span>
                        <span>+{fmtCurrency(grossFromNet.sgk)} ₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                        <span>İşsizlik primi (%1)</span>
                        <span>+{fmtCurrency(grossFromNet.issizlik)} ₺</span>
                      </div>
                      {(grossFromNet.gelirVergisiIstisna ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                            <span>Gelir vergisi (brüt)</span>
                            <span>+{fmtCurrency(grossFromNet.gelirVergisiBrut ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-green-600 dark:text-green-400">
                            <span>Asg. üc. gel. vergi ist.</span>
                            <span>-{fmtCurrency(grossFromNet.gelirVergisiIstisna ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600 dark:text-gray-400">Net gelir vergisi</span>
                            <span>+{fmtCurrency(grossFromNet.gelirVergisi)} ₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                          <span className="pr-1">Gelir vergisi {grossFromNet.gelirVergisiDilimleri}</span>
                          <span className="shrink-0">+{fmtCurrency(grossFromNet.gelirVergisi)} ₺</span>
                        </div>
                      )}
                      {(grossFromNet.damgaVergisiIstisna ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                            <span>Damga vergisi (brüt)</span>
                            <span>+{fmtCurrency(grossFromNet.damgaVergisiBrut ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-green-600 dark:text-green-400">
                            <span>Asg. üc. damga vergi ist.</span>
                            <span>-{fmtCurrency(grossFromNet.damgaVergisiIstisna ?? 0)} ₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600 dark:text-gray-400">Net damga vergisi</span>
                            <span>+{fmtCurrency(grossFromNet.damgaVergisi)} ₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
                          <span>Damga vergisi (binde 7,59)</span>
                          <span>+{fmtCurrency(grossFromNet.damgaVergisi)} ₺</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 font-semibold text-green-700 dark:text-green-400 text-xs">
                        <span>Brüt ücret</span>
                        <span>{fmtCurrency(grossFromNet.gross)} ₺</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/10 p-2.5 mt-1">
                  <p className="text-[11px] font-light text-red-600 dark:text-red-400">{NOTE_TEXT}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <EklentiModal open={modalOpen} title={modalTitle} onClose={() => setModalOpen(false)} onApply={handleApplyEklenti} />

      {showSaveModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-md border border-gray-200 dark:border-gray-600">
            <h3 className="text-base font-semibold mb-3">Ekstra hesaplamaları kaydet</h3>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Set adı"
              className="mb-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveExtra();
                if (e.key === "Escape") {
                  setShowSaveModal(false);
                  setSaveName("");
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                }}
              >
                İptal
              </Button>
              <Button size="sm" onClick={() => void handleSaveExtra()}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showImportModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-600">
            <h3 className="text-base font-semibold mb-3">Kayıtlı setleri içe aktar</h3>
            {savedSets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Henüz kayıtlı set yok</p>
            ) : (
              <div className="space-y-2">
                {savedSets.map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-2.5 border rounded-lg border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{set.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {set.data.length} kalem · {new Date(set.createdAt).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => void handleImportExtra(set.name)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-red-300 text-red-600"
                        onClick={() => void handleDeleteExtra(set.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "none" }} aria-hidden="true">
        <div
          id="report-content"
          style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}
        >
          <ReportContentFromConfig config={bakiyeUcretReportConfig} />
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
          copyTargetId: "bakiye-ucret-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #bakiye-ucret-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #bakiye-ucret-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="bakiye-ucret-word-copy">
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
