/**
 * Ücret Alacağı — v2 (tek kart kabuğu, FooterActions, v1 API ile uyumlu).
 */

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getDaysInMonth } from "date-fns";
import { Youtube, Copy } from "lucide-react";
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
import { asgariUcretler, getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { calcWorkPeriodBilirKisi } from "@/pages/kidem-tazminati/utils";
import { calculateSegmentedNetFromRows } from "@/pages/ucret-alacagi/UcretIndependent/localUtils/incomeTaxCore";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { loadSavedCase } from "./api";
import UbgtKatsayiModal from "./UbgtKatsayiModal";

const PAGE_HEADING = "Ücret Alacağı";
const PREVIEW_TITLE = "Ücret Alacağı Rapor";
const REDIRECT_PATH = "/ucret-alacagi";
const RECORD_TYPE = "ucret_alacagi";

const FORM_LABELS = {
  START_DATE: "Çalışma dönemi başlangıcı",
  END_DATE: "Çalışma dönemi sonu",
  GROSS_TO_NET: "Brütten Nete Çevir",
  NET_TO_GROSS: "Netten Brüte Çevir",
  GROSS_SALARY: "Çıplak Brüt Ücret",
  NET_SALARY: "Net Ücret",
};
const NOTE_TEXT = "Bu alan bilgi amaçlıdır ve ileride güncellenecektir.";

const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

interface CetvelRow {
  id: string;
  rangeLabel: string;
  startISO: string;
  endISO: string;
  katsayi: number;
  ucret: number;
  gunSayisi: number;
  ayGunSayisi: number;
  ucretManual: boolean;
  odenenUcret: number;
}

const formatDateTR = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
};

function getAsgariUcretForPeriod(startISO: string): number {
  const v = getAsgariUcretByDate(startISO);
  return v ?? asgariUcretler[asgariUcretler.length - 1].brut;
}

export default function UcretAlacagiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const videoLink = getVideoLink("ucret-alacagi");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCetvel, setShowCetvel] = useState(false);
  const [cetvelRows, setCetvelRows] = useState<CetvelRow[]>([]);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [globalKatsayi, setGlobalKatsayi] = useState(1);
  const [hasCustomKatsayi, setHasCustomKatsayi] = useState(false);
  const [grossForNet, setGrossForNet] = useState("");
  const [netForGross, setNetForGross] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = useRef(false);
  const calcRequestIdRef = useRef(0);

  const selectedYear = useMemo(() => {
    if (endDate && endDate.trim() !== "") {
      const exitDate = new Date(endDate);
      if (!isNaN(exitDate.getTime())) {
        const year = exitDate.getFullYear();
        if (year >= 2010 && year <= 2030) return year;
      }
    }
    return new Date().getFullYear();
  }, [endDate]);

  const workPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    const result = calcWorkPeriodBilirKisi(startDate, endDate);
    if (!result.label) return null;
    return result;
  }, [startDate, endDate]);

  const netFromGross = useMemo(() => {
    if (!cetvelRows.length) {
      return {
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
    }
    const d = calculateSegmentedNetFromRows(cetvelRows);
    return {
      gross: d.totalGross,
      sgk: d.totalSgk,
      issizlik: d.totalIssizlik,
      gelirVergisi: d.totalGelirVergisi,
      gelirVergisiBrut: d.totalGelirVergisiBrut,
      gelirVergisiIstisna: d.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: "",
      damgaVergisi: d.totalDamgaVergisi,
      damgaVergisiBrut: d.totalDamgaVergisiBrut,
      damgaVergisiIstisna: d.totalDamgaVergisiIstisna,
      net: d.totalNet,
    };
  }, [cetvelRows]);

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
  const netVal = useMemo(() => parseNum(netForGross), [netForGross]);

  useEffect(() => {
    if (netVal > 0) {
      apiClient(`/api/ucret-alacagi/gross-from-net`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ net: netVal, year: selectedYear }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) setGrossFromNet(result.data);
        })
        .catch(() => {});
    } else {
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
    }
  }, [netVal, selectedYear]);

  const totalBrut = useMemo(() => {
    const brutToplam = cetvelRows.reduce((acc, row) => {
      const isFullMonth = row.gunSayisi === row.ayGunSayisi;
      const rowTotal = isFullMonth ? row.ucret * row.katsayi : (row.ucret / 30) * row.gunSayisi * row.katsayi;
      return acc + rowTotal;
    }, 0);
    const odenenToplam = cetvelRows.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
    return Math.max(0, brutToplam - odenenToplam);
  }, [cetvelRows]);

  const applyGlobalCoefficient = useCallback((katsayi: number) => {
    if (!Number.isFinite(katsayi) || katsayi <= 0) return;
    setGlobalKatsayi(katsayi);
    setHasCustomKatsayi(true);
    setCetvelRows((prev) => prev.map((row) => ({ ...row, katsayi })));
  }, []);

  const removeGlobalCoefficient = useCallback(() => {
    setGlobalKatsayi(1);
    setHasCustomKatsayi(false);
    setCetvelRows((prev) => prev.map((row) => ({ ...row, katsayi: 1 })));
  }, []);

  const generateCetvel = useCallback(async () => {
    calcRequestIdRef.current += 1;
    const currentRequestId = calcRequestIdRef.current;

    if (!startDate || !endDate) {
      if (currentRequestId !== calcRequestIdRef.current) return;
      setCetvelRows([]);
      setShowCetvel(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    if (start > end) return;

    try {
      const avgUcret = getAsgariUcretForPeriod(startDate);
      const monthly = Number(avgUcret) || getAsgariUcretForPeriod(endDate);
      if (!monthly || monthly <= 0) {
        if (currentRequestId !== calcRequestIdRef.current) return;
        showToastError("Seçilen dönem için asgari ücret bulunamadı. Lütfen tarih aralığını kontrol edin.");
        setCetvelRows([]);
        setShowCetvel(false);
        return;
      }

      const response = await apiClient(`/api/ucret-alacagi/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, monthly }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (currentRequestId !== calcRequestIdRef.current) return;
        const serverMessage = result?.error || `Sunucu hatası (${response.status})`;
        showToastError(serverMessage);
        setCetvelRows([]);
        setShowCetvel(false);
        return;
      }

      if (result.success && result.data?.rows) {
        const newRows: CetvelRow[] = result.data.rows.map((row: { start: string; end: string; days: number }, idx: number) => ({
          id: `row-${idx}-${Date.now()}`,
          rangeLabel: `${formatDateTR(row.start)} – ${formatDateTR(row.end)}`,
          startISO: row.start,
          endISO: row.end,
          katsayi: globalKatsayi,
          ucret: getAsgariUcretForPeriod(row.start),
          gunSayisi: row.days,
          ayGunSayisi: getDaysInMonth(new Date(row.start)),
          ucretManual: false,
          odenenUcret: 0,
        }));

        if (currentRequestId !== calcRequestIdRef.current) return;
        setCetvelRows(newRows);
        setShowCetvel(true);
      } else {
        if (currentRequestId !== calcRequestIdRef.current) return;
        if (result.error) showToastError(result.error);
        setCetvelRows([]);
        setShowCetvel(false);
      }
    } catch {
      if (currentRequestId !== calcRequestIdRef.current) return;
      showToastError("Hesaplama sırasında bir hata oluştu");
      setCetvelRows([]);
      setShowCetvel(false);
    }
  }, [startDate, endDate, globalKatsayi, showToastError]);

  useEffect(() => {
    if (loadRanRef.current) return;
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    const timer = setTimeout(() => {
      void generateCetvel();
    }, 300);

    return () => clearTimeout(timer);
  }, [startDate, endDate, generateCetvel]);

  useEffect(() => {
    loadRanRef.current = false;
  }, [effectiveId]);

  const handleUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ucret: numValue, ucretManual: true } : row)));
  }, []);

  const handleKatsayiBlur = useCallback((rowId: string, newValue: string) => {
    const numValue = parseFloat(newValue.replace(",", ".")) || 1;
    setCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, katsayi: numValue } : row)));
  }, []);

  const handleOdenenUcretBlur = useCallback((rowId: string, newValue: string) => {
    const cleanValue = newValue.replace(/₺/g, "").replace(/\s/g, "").trim();
    const numValue = parseFloat(cleanValue.replace(/\./g, "").replace(",", ".")) || 0;
    setCetvelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, odenenUcret: numValue } : row)));
  }, []);

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
        const formObj =
          (payload.form as Record<string, unknown>) ||
          (nested?.form as Record<string, unknown>) ||
          payload;
        const formInner = (formObj as { form?: Record<string, unknown> })?.form ?? formObj;

        if (formInner?.startDate) setStartDate(String(formInner.startDate));
        if (formInner?.endDate) setEndDate(String(formInner.endDate));

        if (formInner?.globalKatsayi != null) {
          setGlobalKatsayi(Number(formInner.globalKatsayi));
          setHasCustomKatsayi(Number(formInner.globalKatsayi) !== 1);
        }

        const rowsSource =
          (formInner as { cetvelRows?: unknown }).cetvelRows ??
          (formInner as { rows?: unknown }).rows ??
          (nested as { results?: { rows?: unknown } })?.results?.rows ??
          (formObj as { cetvelRows?: unknown }).cetvelRows ??
          (formObj as { rows?: unknown }).rows;

        if (rowsSource && Array.isArray(rowsSource)) {
          const mappedRows = rowsSource.map((r: Record<string, unknown>) => {
            const odenenRaw = r.odenenUcret ?? r.odenen_ucret ?? r.OdenenUcret ?? 0;
            const odenen = Number(odenenRaw) || 0;
            return { ...r, odenenUcret: odenen };
          }) as CetvelRow[];
          setCetvelRows(mappedRows);
          setShowCetvel(true);
        }

        setCurrentRecordName(
          (raw.name as string) || (raw.notes as string) || (raw.aciklama as string) || null
        );
        success(`Kayıt yüklendi (#${effectiveId})`);
      } catch {
        if (!isMounted) return;
        loadRanRef.current = false;
        showToastError("Kayıt yüklenemedi");
      }
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, [effectiveId]); // eslint-disable-line react-hooks/exhaustive-deps -- success/showToastError

  const ucretReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const grossToNetRows: Array<{ label: string; value: string; isDeduction?: boolean; isNet?: boolean }> = [
      { label: "Brüt Ücret", value: `${fmtLocal(netFromGross.gross)}₺` },
      { label: "SGK Primi (%14)", value: `-${fmtLocal(netFromGross.sgk)}₺`, isDeduction: true },
      { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(netFromGross.issizlik)}₺`, isDeduction: true },
    ];
    if (netFromGross.gelirVergisiIstisna > 0) {
      grossToNetRows.push(
        { label: "Gelir Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.gelirVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Gelir Vergi İstisnası", value: `+${fmtLocal(netFromGross.gelirVergisiIstisna)}₺` },
        { label: "Net Gelir Vergisi", value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`, isDeduction: true }
      );
    } else {
      grossToNetRows.push({
        label: "Gelir Vergisi " + (netFromGross.gelirVergisiDilimleri || ""),
        value: `-${fmtLocal(netFromGross.gelirVergisi)}₺`,
        isDeduction: true,
      });
    }
    if (netFromGross.damgaVergisiIstisna > 0) {
      grossToNetRows.push(
        { label: "Damga Vergisi (Brüt)", value: `-${fmtLocal(netFromGross.damgaVergisiBrut)}₺`, isDeduction: true },
        { label: "Asg. Üc. Damga Vergi İstisnası", value: `+${fmtLocal(netFromGross.damgaVergisiIstisna)}₺` },
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
      title: "Ücret Alacağı",
      sections: {
        info: true,
        periodTable: true,
        grossToNet: true,
      },
      infoRows: [
        { label: "Çalışma Dönemi Başlangıcı", value: startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Dönemi Sonu", value: endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "-" },
        { label: "Çalışma Süresi", value: workPeriod?.label || "-" },
        { label: "Katsayı", value: hasCustomKatsayi ? globalKatsayi.toString() : "1", condition: hasCustomKatsayi },
      ],
      periodData: {
        title: "Ücret Hesaplama Cetveli",
        fontSize: "10px",
        headers: ["Tarih Aralığı", "Gün Sayısı", "Katsayı", "Ücret (₺)", "Ödenen Ücret", "Toplam (₺)"],
        rows: cetvelRows.map((row) => {
          const isFullMonth = row.gunSayisi === row.ayGunSayisi;
          const rowBrut = isFullMonth ? row.ucret * row.katsayi : (row.ucret / 30) * row.gunSayisi * row.katsayi;
          const rowNet = Math.max(0, rowBrut - (row.odenenUcret || 0));
          return [
            row.rangeLabel,
            row.gunSayisi.toString(),
            row.katsayi.toFixed(4).replace(".", ","),
            `${fmtLocal(row.ucret)}₺`,
            row.odenenUcret ? `${fmtLocal(row.odenenUcret)}₺` : "-",
            `${fmtLocal(rowNet)}₺`,
          ];
        }),
        footer: ["Toplam Brüt Ücret:", "", "", "", "", `${fmtLocal(totalBrut)}₺`],
        alignRight: [1, 2, 3, 4, 5],
      },
      grossToNetData: {
        title: "Brütten Nete Çeviri",
        fontSize: "10px",
        rows: grossToNetRows,
      },
    };
  }, [startDate, endDate, workPeriod, cetvelRows, totalBrut, hasCustomKatsayi, globalKatsayi, netFromGross]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];

    const infoRowsFiltered = (ucretReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const pd = ucretReportConfig.periodData;
    if (pd?.rows?.length) {
      const periodRows = [...pd.rows];
      if (pd.footer?.length) periodRows.push(pd.footer);
      const n2 = adaptToWordTable({ headers: pd.headers, rows: periodRows });
      sections.push({
        id: "ucret-hesaplama",
        title: pd.title || "Ücret Hesaplama Cetveli",
        html: buildWordTable(n2.headers, n2.rows),
      });
    }

    const gnd = ucretReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({
        id: "brutten-nete",
        title: ucretReportConfig.grossToNetData?.title || "Brütten Nete Çeviri",
        html: buildWordTable(n3.headers, n3.rows),
      });
    }

    return sections;
  }, [ucretReportConfig]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
    if (!el) return;
    const title = ucretReportConfig.title;
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
  }, [ucretReportConfig.title]);

  const handleSave = () => {
    try {
      if (document.activeElement instanceof HTMLInputElement) {
        (document.activeElement as HTMLInputElement).blur();
      }

      const parseNumLocal = (v: string) => {
        const clean = String(v || "").replace(/₺/g, "").replace(/\s/g, "").trim();
        return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
      };
      let rowsToSave = cetvelRows.map((r) => ({ ...r }));

      const container = document.getElementById("ucret-print");
      const ucretInputs = (container || document).querySelectorAll<HTMLInputElement>("input[data-ucret-row]");
      ucretInputs.forEach((inp) => {
        const rowId = inp.getAttribute("data-ucret-row");
        if (rowId) {
          const num = parseNumLocal(inp.value);
          const idx = rowsToSave.findIndex((r) => r.id === rowId);
          if (idx >= 0) rowsToSave[idx] = { ...rowsToSave[idx], ucret: num, ucretManual: true };
        }
      });

      const katsayiInputs = (container || document).querySelectorAll<HTMLInputElement>("input[data-katsayi-row]");
      katsayiInputs.forEach((inp) => {
        const rowId = inp.getAttribute("data-katsayi-row");
        if (rowId) {
          const num = parseFloat(String(inp.value || "").replace(",", ".")) || 1;
          const idx = rowsToSave.findIndex((r) => r.id === rowId);
          if (idx >= 0) rowsToSave[idx] = { ...rowsToSave[idx], katsayi: num };
        }
      });

      const odenenInputs = (container || document).querySelectorAll<HTMLInputElement>("input[data-odenen-row]");
      odenenInputs.forEach((inp) => {
        const rowId = inp.getAttribute("data-odenen-row");
        if (rowId) {
          const num = parseNumLocal(inp.value);
          const idx = rowsToSave.findIndex((r) => r.id === rowId);
          if (idx >= 0) rowsToSave[idx] = { ...rowsToSave[idx], odenenUcret: num };
        }
      });

      const brutToplam = rowsToSave.reduce((acc, row) => {
        const isFullMonth = row.gunSayisi === row.ayGunSayisi;
        const rowBrut = isFullMonth ? row.ucret * row.katsayi : (row.ucret / 30) * row.gunSayisi * row.katsayi;
        return acc + rowBrut;
      }, 0);
      const odenenToplam = rowsToSave.reduce((acc, row) => acc + (row.odenenUcret || 0), 0);
      const finalTotal = Math.max(0, brutToplam - odenenToplam);

      setCetvelRows(rowsToSave);

      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: { startDate, endDate, cetvelRows: rowsToSave, globalKatsayi },
            results: { total: finalTotal, rows: rowsToSave },
          },
          start_date: startDate,
          end_date: endDate,
          brut_total: Number(finalTotal.toFixed(2)),
          net_total: Number(finalTotal.toFixed(2)),
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `${REDIRECT_PATH}/:id`,
      });
    } catch {
      showToastError("Kayıt yapılamadı.");
    }
  };

  const handleNewCalculation = () => {
    try {
      const hasUnsavedChanges = Boolean(startDate || endDate || cetvelRows.length > 0);
      if (hasUnsavedChanges && !window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
      setStartDate("");
      setEndDate("");
      setCetvelRows([]);
      setShowCetvel(false);
      setGlobalKatsayi(1);
      setHasCustomKatsayi(false);
      setNetForGross("");
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
      setCurrentRecordName(null);
      loadRanRef.current = false;
      if (effectiveId) navigate(REDIRECT_PATH);
    } catch {
      /* ignore */
    }
  };

  const dateInputCls =
    "w-full mt-1 rounded-lg h-9 text-sm border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-2.5";

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
                <h2 className={sectionTitleCls}>{PAGE_HEADING}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Çalışma dönemi için asgari ücret tabanlı ücret cetveli; brüt/net dönüştürücüler ve rapor.
                </p>
              </section>

              <div id="ucret-print" className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Tarih bilgileri</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{FORM_LABELS.START_DATE}</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={startDate}
                        onChange={(e) => {
                          loadRanRef.current = false;
                          setStartDate(e.target.value);
                        }}
                        className={dateInputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{FORM_LABELS.END_DATE}</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={endDate}
                        onChange={(e) => {
                          loadRanRef.current = false;
                          setEndDate(e.target.value);
                        }}
                        className={dateInputCls}
                      />
                    </div>
                  </div>
                  {workPeriod?.label ? (
                    <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                        Toplam çalışma süresi: <span className="font-semibold">{workPeriod.label}</span>
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowKatsayiModal(true)}>
                      Kat Sayı Hesapla
                    </Button>
                    {hasCustomKatsayi ? (
                      <Button type="button" variant="outline" size="sm" onClick={removeGlobalCoefficient}>
                        Kat Sayı Kaldır ({globalKatsayi.toFixed(4)})
                      </Button>
                    ) : null}
                  </div>
                </div>

                {showCetvel && cetvelRows.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Ücret Hesaplama Cetveli</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dönem bazlı ücret hesaplaması</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-600">
                            <th className="text-left px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Tarih Aralığı</th>
                            <th className="text-center px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Gün</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Katsayı</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Ücret (₺)</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Ödenen</th>
                            <th className="text-right px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Toplam (₺)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cetvelRows.map((row, idx) => {
                            const isFullMonth = row.gunSayisi === row.ayGunSayisi;
                            const rowBrut = isFullMonth
                              ? row.ucret * row.katsayi
                              : (row.ucret / 30) * row.gunSayisi * row.katsayi;
                            const rowNet = Math.max(0, rowBrut - (row.odenenUcret || 0));
                            return (
                              <tr
                                key={row.id}
                                className={`border-b border-gray-100 dark:border-gray-700 ${
                                  idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/80"
                                }`}
                              >
                                <td className="px-2 py-2 text-gray-800 dark:text-gray-200 font-medium">{row.rangeLabel}</td>
                                <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.gunSayisi}</td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    type="text"
                                    key={`katsayi-${row.id}-${row.katsayi}`}
                                    data-katsayi-row={row.id}
                                    defaultValue={row.katsayi.toFixed(4).replace(".", ",")}
                                    onBlur={(e) => handleKatsayiBlur(row.id, e.target.value)}
                                    className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800"
                                  />
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    type="text"
                                    key={`ucret-${row.id}-${row.ucret}`}
                                    data-ucret-row={row.id}
                                    defaultValue={`${fmtCurrency(row.ucret)}₺`}
                                    onBlur={(e) => handleUcretBlur(row.id, e.target.value)}
                                    className={`w-24 text-right border rounded px-1 py-0.5 text-xs ${
                                      row.ucretManual
                                        ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                    }`}
                                  />
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    type="text"
                                    key={`odenen-${row.id}`}
                                    data-odenen-row={row.id}
                                    defaultValue={row.odenenUcret ? fmtCurrency(row.odenenUcret) : ""}
                                    placeholder="0"
                                    onBlur={(e) => handleOdenenUcretBlur(row.id, e.target.value)}
                                    className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800"
                                  />
                                </td>
                                <td className="px-2 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                                  {fmtCurrency(rowNet)}₺
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <td colSpan={5} className="px-2 py-2 text-right font-bold text-base">
                              Toplam Brüt Ücret:
                            </td>
                            <td className="px-2 py-2 text-right font-bold">{fmtCurrency(totalBrut)}₺</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900 space-y-1">
                      <p className="text-[11px] text-amber-800 dark:text-amber-200">
                        <strong>Not:</strong> Ücret sütunundaki değerler varsayılan olarak ilgili dönemin resmi asgari brüt ücretini gösterir. İsterseniz bu değerleri manuel olarak değiştirebilirsiniz.
                      </p>
                      <p className="text-[11px] text-amber-800 dark:text-amber-200">
                        Brütten Nete çevirme kısmında hesaplamalar yukarıda yer alan aylık brüt ücretler tek tek hesaplanarak toplam veri tabloda yer almaktadır.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ücret hesaplaması için tarihleri girin. Tablo otomatik oluşturulacaktır.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{FORM_LABELS.GROSS_TO_NET}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div>
                      <Label className="text-xs">{FORM_LABELS.GROSS_SALARY}</Label>
                      <div className="h-8 text-sm flex items-center text-gray-600 dark:text-gray-400">
                        {cetvelRows.length > 0 ? `Cetvelden: ${fmtCurrency(totalBrut)}₺` : "Cetvel oluşturun"}
                      </div>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Brüt Ücret</span>
                        <span className="font-semibold">{fmtCurrency(netFromGross.gross)}₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-red-600">SGK Primi (%14)</span>
                        <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.sgk)}₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-red-600">İşsizlik Primi (%1)</span>
                        <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.issizlik)}₺</span>
                      </div>
                      {netFromGross.gelirVergisiIstisna > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                            <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.gelirVergisiBrut)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                            <span className="font-semibold text-green-600">+{fmtCurrency(netFromGross.gelirVergisiIstisna)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600">Net Gelir Vergisi</span>
                            <span className="font-semibold">-{fmtCurrency(netFromGross.gelirVergisi)}₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-red-600">Gelir Vergisi {netFromGross.gelirVergisiDilimleri}</span>
                          <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.gelirVergisi)}₺</span>
                        </div>
                      )}
                      {netFromGross.damgaVergisiIstisna > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-red-600">Damga Vergisi (Brüt)</span>
                            <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.damgaVergisiBrut)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                            <span className="font-semibold text-green-600">+{fmtCurrency(netFromGross.damgaVergisiIstisna)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600">Net Damga Vergisi</span>
                            <span className="font-semibold">-{fmtCurrency(netFromGross.damgaVergisi)}₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                          <span className="font-semibold text-red-600">-{fmtCurrency(netFromGross.damgaVergisi)}₺</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2">
                        <span className="text-sm font-semibold text-green-700 dark:text-green-400">Net Ücret</span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmtCurrency(netFromGross.net)}₺</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{FORM_LABELS.NET_TO_GROSS}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div>
                      <Label className="text-xs">{FORM_LABELS.NET_SALARY}</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={netForGross}
                          onChange={(e) => setNetForGross(e.target.value)}
                          placeholder="Örn: 18.000,00"
                          className="h-8 text-sm flex-1"
                        />
                        {netFromGross.net > 0 ? (
                          <button
                            type="button"
                            onClick={() => setNetForGross(fmtCurrency(netFromGross.net))}
                            className="shrink-0 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded border border-emerald-200 dark:border-emerald-700 h-8"
                          >
                            Sol panelin netini kullan
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">Net Ücret</span>
                        <span className="font-semibold">{fmtCurrency(grossFromNet.net)}₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-red-600">SGK Primi (%14)</span>
                        <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.sgk)}₺</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-red-600">İşsizlik Primi (%1)</span>
                        <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.issizlik)}₺</span>
                      </div>
                      {(grossFromNet.gelirVergisiIstisna ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-red-600">Gelir Vergisi (Brüt)</span>
                            <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.gelirVergisiBrut ?? 0)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-green-600">Asg. Üc. Gel. Vergi İst.</span>
                            <span className="font-semibold text-green-600">-{fmtCurrency(grossFromNet.gelirVergisiIstisna ?? 0)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600">Net Gelir Vergisi</span>
                            <span className="font-semibold">+{fmtCurrency(grossFromNet.gelirVergisi)}₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-red-600">Gelir Vergisi {grossFromNet.gelirVergisiDilimleri}</span>
                          <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.gelirVergisi)}₺</span>
                        </div>
                      )}
                      {(grossFromNet.damgaVergisiIstisna ?? 0) > 0 ? (
                        <>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-red-600">Damga Vergisi (Brüt)</span>
                            <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.damgaVergisiBrut ?? 0)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-green-600">Asg. Üc. Damga Vergi İst.</span>
                            <span className="font-semibold text-green-600">-{fmtCurrency(grossFromNet.damgaVergisiIstisna ?? 0)}₺</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-600">Net Damga Vergisi</span>
                            <span className="font-semibold">+{fmtCurrency(grossFromNet.damgaVergisi)}₺</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-red-600">Damga Vergisi (binde 7,59)</span>
                          <span className="font-semibold text-red-600">+{fmtCurrency(grossFromNet.damgaVergisi)}₺</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2">
                        <span className="text-sm font-semibold text-green-700 dark:text-green-400">Brüt Ücret</span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmtCurrency(grossFromNet.gross)}₺</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">Notlar</h3>
                <p className="text-[11px] font-light text-slate-500 dark:text-slate-400 leading-relaxed">{NOTE_TEXT}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UbgtKatsayiModal open={showKatsayiModal} onClose={() => setShowKatsayiModal(false)} onApply={applyGlobalCoefficient} />

      <div style={{ display: "none" }} aria-hidden="true">
        <ReportContentFromConfig config={ucretReportConfig} />
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
          copyTargetId: "ucret-alacagi-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #ucret-alacagi-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #ucret-alacagi-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="ucret-alacagi-word-copy">
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
