/**
 * Standart Fazla Mesai - İş Kanununa Göre
 * Eski StandartIndependent sayfasının yeniden yazılmış versiyonu
 */

import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import {
  segmentOvertimeResult,
  computeDisplayRows,
  calculateOvertimeWith270AndLimitation,
  getAsgariUcretByDate,
  calculateWeeksBetweenDates,
  buildWordTable,
  adaptToWordTable,
  copySectionForWord,
  type FazlaMesaiRowBase,
} from "@modules/fazla-mesai/shared";
import { YillikIzinPanel } from "./YillikIzinPanel";
import { ZamanasimiModal } from "./ZamanasimiModal";
import { KatsayiModal } from "./KatsayiModal";
import { MahsuplasamaModal } from "./MahsuplasamaModal";
import { NotlarAccordion } from "./NotlarAccordion";
import { Copy } from "lucide-react";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { buildStyledReportTable } from "@/utils/styledReportTable";
import { calculateDailyWorkHours, computeBreakHours, calculateWeeklyFMSaat } from "./utils";
import { STANDARD_DAILY_REFERENCE_HOURS } from "./constants";
import { useStandartFazlaMesaiState } from "./state";
import { fmt, fmtCurrency } from "./calculations";
import { WEEKLY_WORK_LIMIT, FAZLA_MESAI_DENOMINATOR, FAZLA_MESAI_KATSAYI } from "./constants";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { computeNetFromGrossSingle } from "@/pages/ucret-alacagi/UcretIndependent/localUtils/incomeTaxCore";

const PAGE_TITLE = "Standart Fazla Mesai Hesaplama";
const RECORD_TYPE = "fazla_mesai_standart";
const REDIRECT_BASE_PATH = "/fazla-mesai/standart";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const tableInputCls =
  "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

/** ISO tarih (yyyy-mm-dd) → gg.aa.yyyy */
function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

export default function StandartFazlaMesaiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc } = useKaydetContext();

  const {
    formValues,
    setFormValues,
    rowOverrides,
    setRowOverrides,
    manualRows,
    setManualRows,
    exclusions,
    setExclusions,
    currentRecordName,
    setCurrentRecordName,
  } = useStandartFazlaMesaiState();

  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  /** 7 gün seçiliyken metin hesaplamasında Hafta Tatilsiz / Hafta Tatilli seçimi */
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  /** Tarih inputları için local state – yazarken hesaplama donmasını önlemek için */
  const [localIseGiris, setLocalIseGiris] = useState("");
  const [localIstenCikis, setLocalIstenCikis] = useState("");
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { iseGiris, istenCikis, weeklyDays, davaci, mode270, katSayi, mahsuplasmaMiktari } = formValues;

  useEffect(() => {
    setLocalIseGiris(iseGiris || "");
    setLocalIstenCikis(istenCikis || "");
  }, [iseGiris, istenCikis]);

  useEffect(() => () => {
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
  }, []);

  const debouncedSetDate = useCallback(
    (field: "iseGiris" | "istenCikis", value: string) => {
      if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
      dateDebounceRef.current = setTimeout(() => {
        setFormValues((p) => ({ ...p, [field]: value }));
        dateDebounceRef.current = null;
      }, 350);
    },
    [setFormValues]
  );
  const diff = useMemo(() => calcWorkPeriodBilirKisi(iseGiris, istenCikis), [iseGiris, istenCikis]);

  const dailyWorkingHours = useMemo(() => {
    const raw = calculateDailyWorkHours(davaci?.in || "", davaci?.out || "");
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const brk = computeBreakHours(raw);
    return Math.max(0, raw - brk);
  }, [davaci?.in, davaci?.out]);

  const weeklyFMSaat = useMemo(() => {
    const n = Number(weeklyDays) || 6;
    const mode = n === 7 ? activeTab : undefined;
    return calculateWeeklyFMSaat(dailyWorkingHours, n, WEEKLY_WORK_LIMIT, mode);
  }, [dailyWorkingHours, weeklyDays, activeTab]);

  const fmText = useMemo(() => {
    const inT = davaci?.in || "";
    const outT = davaci?.out || "";
    if (!inT || !outT || dailyWorkingHours <= 0) return "";
    const brut = calculateDailyWorkHours(inT, outT);
    const brk = computeBreakHours(brut);
    const netGunluk = Math.max(0, brut - brk);
    const hg = Number(weeklyDays) || 6;
    const fmtH = (n: number) => n.toFixed(2).replace(".", ",");
    if (hg === 7) {
      const tatilsizWeekly = netGunluk * 7;
      const roundedTatilsiz = Math.round(tatilsizWeekly);
      const fmTatilsiz = Math.max(0, roundedTatilsiz - WEEKLY_WORK_LIMIT);
      const txtTatilsiz =
        `${inT}–${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme = ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `7 x ${fmtH(netGunluk)} = ${fmtH(tatilsizWeekly)} saat çalışma\n` +
        `Net haftalık çalışma = ${roundedTatilsiz} saat,\n` +
        `${roundedTatilsiz} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${fmTatilsiz} saat haftalık fazla mesai`;

      const weeklyWork = netGunluk * 6;
      const extraHT = Math.max(0, netGunluk - STANDARD_DAILY_REFERENCE_HOURS);
      const toplamCalisma = weeklyWork + extraHT;
      const roundedTatilli = Math.round(toplamCalisma);
      const fmTatilli = Math.max(0, roundedTatilli - WEEKLY_WORK_LIMIT);
      const txtTatilli =
        `${inT}–${outT} = ${fmtH(brut)} saat çalışma\n` +
        `- ${fmtH(brk)} saat ara dinlenme = ${fmtH(netGunluk)} saat günlük çalışma\n` +
        `6 x ${fmtH(netGunluk)} = ${fmtH(weeklyWork)} saat çalışma\n` +
        `${fmtH(netGunluk)} - 7,5 = ${fmtH(extraHT)} saat hafta tatili fazla çalışma mesaisi\n` +
        `= ${fmtH(toplamCalisma)} saat çalışma\n` +
        `Net haftalık çalışma = ${roundedTatilli} saat,\n` +
        `${roundedTatilli} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${fmTatilli} saat haftalık fazla mesai`;

      return activeTab === "tatilsiz" ? txtTatilsiz : txtTatilli;
    }
    const haftalik = netGunluk * hg;
    const roundedWeekly = Math.round(haftalik);
    const fm = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
    return `${inT}–${outT} = ${fmtH(brut)} saat çalışma\n` +
      `- ${fmtH(brk)} saat ara dinlenme = ${fmtH(netGunluk)} saat günlük çalışma\n` +
      `${hg} x ${fmtH(netGunluk)} = ${fmtH(haftalik)} saat\n` +
      `Net haftalık çalışma = ${roundedWeekly} saat,\n` +
      `${roundedWeekly} – ${WEEKLY_WORK_LIMIT} saat yasal haftalık çalışma = ${fm} saat haftalık fazla mesai`;
  }, [davaci?.in, davaci?.out, dailyWorkingHours, weeklyDays, activeTab]);

  const zamanasimiBaslangic = formValues.zamanasimi?.nihaiBaslangic || null;

  const rows = useMemo(() => {
    if (!iseGiris || !istenCikis || !davaci?.in || !davaci?.out || weeklyFMSaat <= 0) return [];
    const result = { start: iseGiris, end: istenCikis };
    const segments = segmentOvertimeResult(result);
    const tableRows: Array<Record<string, unknown> & FazlaMesaiRowBase> = [];

    segments.forEach((seg) => {
      let startDate = new Date(seg.start);
      let endDate = new Date(seg.end);

      if (zamanasimiBaslangic) {
        const limitDate = new Date(zamanasimiBaslangic);
        if (endDate < limitDate) return;
        if (startDate < limitDate && endDate >= limitDate) {
          startDate = new Date(limitDate);
          seg.start = startDate.toISOString().slice(0, 10);
        }
      }

      const weeks = calculateWeeksBetweenDates(seg.start, seg.end) || 1;
      const brut = getAsgariUcretByDate(seg.start) || 0;
      const kats = katSayi || 1;
      const hoursEffective = weeks * weeklyFMSaat;
      const fm = Number(((brut * kats * hoursEffective) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2);
      const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - 0.15)).toFixed(2));

      tableRows.push({
        id: `auto-${seg.start}-${seg.end}`,
        startISO: seg.start,
        endISO: seg.end,
        rangeLabel: `${seg.start} – ${seg.end}`,
        weeks,
        originalWeekCount: weeks,
        brut,
        katsayi: kats,
        fmHours: weeklyFMSaat,
        fm,
        net,
        wage: brut,
        overtimeAmount: fm,
      });
    });

    return tableRows;
  }, [iseGiris, istenCikis, davaci?.in, davaci?.out, weeklyFMSaat, katSayi, zamanasimiBaslangic]);

  const computedDisplayRows = useMemo(() => {
    try {
      return computeDisplayRows({
        rows: rows as FazlaMesaiRowBase[],
        manualRows: manualRows as FazlaMesaiRowBase[],
        rowOverrides: rowOverrides as Record<string, Partial<FazlaMesaiRowBase>>,
        katSayi: katSayi || 1,
        weeklyFMSaat,
        exclusions,
        mode270,
        iseGiris,
        istenCikis,
        zamanasimiBaslangic,
        calculateOvertime270Detailed: calculateOvertimeWith270AndLimitation,
      }) as Array<{ fm: number; net: number }>;
    } catch {
      return rows;
    }
  }, [rows, manualRows, rowOverrides, katSayi, weeklyFMSaat, exclusions, mode270, iseGiris, istenCikis, zamanasimiBaslangic]);

  const totalBrut = useMemo(
    () => computedDisplayRows.reduce((a, r) => a + (r.fm ?? 0), 0),
    [computedDisplayRows]
  );
  const totalNet = useMemo(
    () => computedDisplayRows.reduce((a, r) => a + (r.net ?? 0), 0),
    [computedDisplayRows]
  );

  const exitYear = istenCikis ? new Date(istenCikis).getFullYear() : new Date().getFullYear();
  const brutNetResult = useMemo(() => {
    if (totalBrut <= 0) return { gelirVergisi: 0, damgaVergisi: 0, netYillik: 0 };
    const res = computeNetFromGrossSingle(totalBrut, exitYear);
    return {
      gelirVergisi: res.totalGelirVergisi,
      damgaVergisi: res.totalDamgaVergisi,
      netYillik: res.totalNet,
    };
  }, [totalBrut, exitYear]);

  const mahsupNum = useMemo(() => {
    const s = String(mahsuplasmaMiktari || "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }, [mahsuplasmaMiktari]);

  const netAlacak = brutNetResult.netYillik;
  const hakkaniyetIndirimi = netAlacak / 3;
  const sonNet = Math.max(0, netAlacak - hakkaniyetIndirimi - mahsupNum);

  const hasCustomKatsayi = (katSayi ?? 1) !== 1 && (katSayi ?? 1) > 0;

  const handleFormChange = useCallback(
    (updates: Partial<typeof formValues>) => {
      setFormValues((p) => {
        const next = { ...p, ...updates };
        if (updates.davaci) {
          next.davaci = { ...p.davaci, ...updates.davaci };
        }
        return next;
      });
    },
    [setFormValues]
  );

  const handleZamanasimiIptal = useCallback(() => {
    setFormValues((p) => ({ ...p, zamanasimi: null }));
    success("Zamanaşımı kaldırıldı.");
  }, [success]);

  const addRow = useCallback(
    (afterRowId?: string) => {
      const startISO = istenCikis || new Date().toISOString().slice(0, 10);
      const endISO = istenCikis || new Date().toISOString().slice(0, 10);
      const brut = getAsgariUcretByDate(startISO) || 0;
      setManualRows((prev) => [
        ...prev,
        {
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          startISO,
          endISO,
          rangeLabel: `${formatDateTR(startISO)} – ${formatDateTR(endISO)}`,
          weeks: 0,
          originalWeekCount: 0,
          brut,
          katsayi: katSayi ?? 1,
          fmHours: weeklyFMSaat,
          fm: 0,
          net: 0,
          isManual: true,
          insertAfter: afterRowId,
        } as FazlaMesaiRowBase,
      ]);
    },
    [istenCikis, katSayi, weeklyFMSaat]
  );

  const removeRow = useCallback((rowId: string) => {
    const isManual = manualRows.some((r) => r.id === rowId);
    if (isManual) {
      setManualRows((prev) => prev.filter((r) => r.id !== rowId));
      setRowOverrides((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    } else {
      setRowOverrides((prev) => ({ ...prev, [rowId]: { ...prev[rowId], hidden: true } }));
    }
  }, [manualRows]);

  /** Tablodaki manuel değişiklikler – hemen hesaplamaya dahil edilir */
  const handleRowOverride = useCallback(
    (rowId: string, updates: Partial<FazlaMesaiRowBase>) => {
      setRowOverrides((prev) => {
        const cur = prev[rowId] || {};
        const next = { ...cur, ...updates } as Partial<FazlaMesaiRowBase>;
        if (updates.startISO != null) {
          const brut = getAsgariUcretByDate(updates.startISO);
          if (brut != null) next.brut = brut;
        }
        return { ...prev, [rowId]: next };
      });
    },
    [setRowOverrides]
  );

  const handleSave = useCallback(() => {
    kaydetAc({
      type: RECORD_TYPE,
      data: {
        formValues,
        totals: { toplam: totalBrut, yil: diff.years, ay: diff.months, gun: diff.days },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        exclusions,
        mode270,
        katSayi,
        mahsuplasmaMiktari,
      },
      name: currentRecordName || undefined,
      id: effectiveId || undefined,
    });
  }, [
    kaydetAc,
    formValues,
    totalBrut,
    brutNetResult.netYillik,
    diff,
    exclusions,
    mode270,
    katSayi,
    mahsuplasmaMiktari,
    currentRecordName,
    effectiveId,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) {
      navigate(REDIRECT_BASE_PATH);
    }
  }, [effectiveId, navigate]);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Çalışma Süresi", "Haftalık FM Saat"],
      rows: [[iseGiris || "-", istenCikis || "-", diff.label, String(weeklyFMSaat.toFixed(2))]],
    });
    s.push({
      id: "ust",
      title: "Genel Bilgiler",
      html: buildWordTable(n1.headers, n1.rows),
      htmlForPdf: buildStyledReportTable(n1.headers, n1.rows),
    });

    const cetvelHeaders = ["Dönem", "Hafta", "Ücret", "Katsayı", "FM Saat", "225", "1,5", "Fazla Mesai"];
    const cetvelRows = computedDisplayRows.map((r: any) => [
      (r.startISO && r.endISO ? `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}` : r.rangeLabel) || "-",
      r.weeks ?? 0,
      fmt(r.brut ?? 0),
      r.katsayi ?? 1,
      (r.fmHours ?? 0).toFixed(2),
      "225",
      "1,5",
      fmt(r.fm ?? 0),
    ]);
    cetvelRows.push(["", "", "", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({
      id: "cetvel",
      title: "Fazla Mesai Hesaplama Cetveli",
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
      const nYillik = adaptToWordTable({ headers: yillikIzinHeaders, rows: yillikIzinRows });
      s.push({
        id: "yillikizin",
        title: "Yıllık İzin Düşümü",
        html: buildWordTable(nYillik.headers, nYillik.rows),
        htmlForPdf: buildStyledReportTable(nYillik.headers, nYillik.rows),
      });
    }

    const brutNetRows: { label: string; value: string }[] = [
      { label: "Brüt Fazla Mesai", value: fmtCurrency(totalBrut) },
      { label: "SGK (%14)", value: `-${fmtCurrency(totalBrut * SSK_ORAN)}` },
      { label: "İşsizlik (%1)", value: `-${fmtCurrency(totalBrut * ISSIZLIK_ORAN)}` },
      { label: "Gelir Vergisi", value: `-${fmtCurrency(brutNetResult.gelirVergisi)}` },
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
        { label: "Net Alacak", value: fmtCurrency(netAlacak) },
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
    weeklyFMSaat,
    computedDisplayRows,
    totalBrut,
    brutNetResult,
    mahsupNum,
    netAlacak,
    hakkaniyetIndirimi,
    sonNet,
    exclusions,
  ]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
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
        } catch {}
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 400);
      };
    }
  }, []);

  const videoLink = getVideoLink("fazla-standart");

  return (
    <div
      className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`}
      data-page="fazla-mesai-standart"
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

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
          <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
            <h2 className={sectionTitleCls}>Tarih ve Çalışma Bilgileri</h2>
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
            <div className="mt-2 text-xs text-gray-500">
              Haftalık FM Saati: <strong>{weeklyFMSaat.toFixed(2)}</strong> (Günlük net {dailyWorkingHours.toFixed(2)} saat)
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
            <details className="group">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between list-none">
                <span>Metin Hesaplaması</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="p-4 bg-white dark:bg-gray-800/50">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">Hesaplamalar asgari ücret dönemlerine göre yapılmıştır</p>
                {Number(weeklyDays) === 7 && (
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("tatilsiz")}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${activeTab === "tatilsiz" ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                    >
                      Hafta Tatilsiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("tatilli")}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${activeTab === "tatilli" ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                    >
                      Hafta Tatilli
                    </button>
                  </div>
                )}
                <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {fmText || "Giriş ve çıkış saatlerini giriniz."}
                </pre>
              </div>
            </details>
          </section>

          <YillikIzinPanel exclusions={exclusions} setExclusions={setExclusions} success={success} showToastError={showToastError} />

          <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShow270Dropdown((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    mode270 !== "none" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500"
                  }`}
                >
                  {mode270 === "none" && "270 Saat"}
                  {mode270 === "detailed" && "270 (Şirket)"}
                  {mode270 === "simple" && "270 (Yargıtay)"}
                  <svg className={`w-3.5 h-3.5 transition-transform ${show270Dropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {show270Dropdown && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1 text-xs">
                    <button type="button" onClick={() => { handleFormChange({ mode270: "none" }); setShow270Dropdown(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${mode270 === "none" ? "bg-indigo-50 dark:bg-indigo-900/30 font-medium" : ""}`}>Kapalı</button>
                    <button type="button" onClick={() => { handleFormChange({ mode270: "detailed" }); setShow270Dropdown(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${mode270 === "detailed" ? "bg-indigo-50 dark:bg-indigo-900/30 font-medium" : ""}`}>Şirket Uygulaması</button>
                    <button type="button" onClick={() => { handleFormChange({ mode270: "simple" }); setShow270Dropdown(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${mode270 === "simple" ? "bg-indigo-50 dark:bg-indigo-900/30 font-medium" : ""}`}>Yargıtay Uygulaması</button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  zamanasimiBaslangic ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
                title={zamanasimiBaslangic ? "Zamanaşımını kaldır" : "Zamanaşımı hesapla"}
              >
                {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
              </button>
              <button
                type="button"
                onClick={() => hasCustomKatsayi ? handleFormChange({ katSayi: 1 }) : setShowKatsayiModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  hasCustomKatsayi ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500"
                }`}
                title={hasCustomKatsayi ? "Katsayıyı kaldır" : "Katsayı hesapla"}
              >
                {hasCustomKatsayi ? `Katsayı ${katSayi?.toFixed(2) || "1"}` : "Kat Sayı"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
              <h2 className={sectionTitleCls}>Fazla Mesai Hesaplama Cetveli</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse font-sans table-fixed" style={{ minWidth: "640px" }}>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "6%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="px-2 py-1.5 text-left border border-gray-200 dark:border-gray-600 font-semibold whitespace-nowrap">Tarih Aralığı</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Hafta</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">Ücret</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold" title="Katsayı varsayılan 1">Kat Sayı</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold" title="Haftalık fazla mesai saati">FM Saati</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">225</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold">1,5</th>
                    <th className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-600 font-semibold whitespace-nowrap">Fazla Mesai</th>
                    <th className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                  </tr>
                </thead>
                <tbody>
                  {computedDisplayRows.length === 0 ? (
                    <tr>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-left">—</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">0</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">{fmt(0)}</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">1</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">0,00</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">225</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">1,5</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium">{fmt(0)}</td>
                      <td className="px-2 py-1 border border-gray-200 dark:border-gray-600" />
                    </tr>
                  ) : (
                    computedDisplayRows.map((r: any, i: number) => {
                      const startISO = r.startISO ?? "";
                      const endISO = r.endISO ?? "";
                      const weeksVal = r.weeks ?? 0;
                      const fmHoursVal = r.fmHours ?? 0;
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          onMouseEnter={() => setHoveredRow(i)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600 align-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={startISO}
                                onChange={(e) => handleRowOverride(r.id, { startISO: e.target.value || undefined })}
                                className={`${tableInputCls} flex-1 min-w-0`}
                                title="Başlangıç tarihi"
                              />
                              <span className="text-gray-400 shrink-0">–</span>
                              <input
                                type="date"
                                value={endISO}
                                onChange={(e) => handleRowOverride(r.id, { endISO: e.target.value || undefined })}
                                className={`${tableInputCls} flex-1 min-w-0`}
                                title="Bitiş tarihi"
                              />
                            </div>
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={weeksVal}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                handleRowOverride(r.id, { weeks: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.brut ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                handleRowOverride(r.id, { brut: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">{(r.katsayi ?? 1).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                          <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={fmHoursVal}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(",", "."));
                                handleRowOverride(r.id, { fmHours: Number.isNaN(v) ? 0 : Math.max(0, v) });
                              }}
                              className={tableInputCls}
                            />
                          </td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">225</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">1,5</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium whitespace-nowrap">{fmt(r.fm ?? 0)}</td>
                          <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 w-16 text-center">
                            {hoveredRow === i && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addRow(r.id)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 font-medium"
                                  title="Bu satırın altına yeni satır ekle"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(r.id)}
                                  disabled={computedDisplayRows.length <= 1}
                                  className="w-6 h-6 rounded flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                                  title={computedDisplayRows.length <= 1 ? "En az 1 satır kalmalı" : "Bu satırı sil"}
                                >
                                  −
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {computedDisplayRows.length > 0 && (
                    <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-semibold">
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600">Toplam Fazla Mesai:</td>
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 text-right whitespace-nowrap">{fmtCurrency(totalBrut)}</td>
                      <td className="px-2 py-1.5 border border-gray-200 dark:border-gray-600" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
            <h2 className={sectionTitleCls}>Brütten Nete</h2>
            <div className="divide-y divide-gray-200 dark:divide-gray-600 text-xs mt-2">
              <div className="flex justify-between py-1.5"><span>Brüt Fazla Mesai</span><span>{fmtCurrency(totalBrut)}</span></div>
              <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>SGK (%14)</span><span>-{fmtCurrency(totalBrut * SSK_ORAN)}</span></div>
              <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>İşsizlik (%1)</span><span>-{fmtCurrency(totalBrut * ISSIZLIK_ORAN)}</span></div>
              <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>Gelir Vergisi</span><span>-{fmtCurrency(brutNetResult.gelirVergisi)}</span></div>
              <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>Damga Vergisi (Binde 7,59)</span><span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span></div>
              <div className="flex justify-between py-1.5 pt-2 font-semibold text-green-700 dark:text-green-400"><span>Net Fazla Mesai</span><span>{fmtCurrency(brutNetResult.netYillik)}</span></div>
            </div>
          </section>

          <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
            <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet İndirimi / Mahsuplaşma</h2>
            <div className="divide-y divide-gray-200 dark:divide-gray-600 text-sm">
              <div className="flex justify-between py-1.5"><span>Net Alacak</span><span className="font-medium">{fmtCurrency(netAlacak)}</span></div>
              <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>1/3 Hakkaniyet İndirimi</span><span>-{fmtCurrency(hakkaniyetIndirimi)}</span></div>
              <div className="flex flex-wrap gap-2 items-end py-1.5">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Mahsuplaşma Miktarı</label>
                  <input
                    type="text"
                    value={mahsuplasmaMiktari}
                    onChange={(e) => handleFormChange({ mahsuplasmaMiktari: e.target.value })}
                    placeholder="0"
                    className={`${inputCls} max-w-[160px]`}
                  />
                </div>
                <button type="button" onClick={() => setShowMahsuplasamaModal(true)} className="px-3 py-2 text-sm rounded border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/30 shrink-0 self-end">
                  Mahsuplaşma Ekle
                </button>
              </div>
              <div className="flex justify-between py-1.5 pt-2 font-semibold"><span>Son Net Alacak</span><span>{fmtCurrency(sonNet)}</span></div>
            </div>
          </section>

          <NotlarAccordion />
          </div>
        </div>
      </div>

      <div style={{ display: "none" }}>
        <div id="report-content" style={{ fontFamily: "Inter, Arial", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}>
          <style>{`#report-content table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content td,#report-content th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
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
        onApply={(p) => handleFormChange({ zamanasimi: { davaTarihi: p.davaTarihi, arabuluculukBaslangic: p.arabuluculukBaslangic, arabuluculukBitis: p.arabuluculukBitis, nihaiBaslangic: p.nihaiBaslangic } })}
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
        periodLabels={computedDisplayRows.map((r: { startISO?: string }) => r.startISO || "").filter(Boolean)}
      />

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel="Kaydet"
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "fm-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`.report-section-copy{margin-bottom:1.25rem}.report-section-copy .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem}.report-section-copy .section-title{font-weight:600;font-size:0.75rem;color:#374151}.report-section-copy .copy-icon-btn{background:transparent;border:none;cursor:pointer;padding:0.25rem;border-radius:0.375rem;color:#6b7280}.report-section-copy .copy-icon-btn:hover{background:#f3f4f6;color:#374151}#fm-word-copy .section-content{border:none;overflow-x:auto;overflow-y:visible;padding:0;margin:0;-webkit-overflow-scrolling:touch}#fm-word-copy table{border-collapse:collapse;width:100%;margin:0;font-size:0.75rem;color:#111827}#fm-word-copy [data-section="brutnet"] table,[data-section="mahsup"] table{table-layout:fixed}#fm-word-copy [data-section="brutnet"] td:first-child,[data-section="brutnet"] th:first-child,[data-section="mahsup"] td:first-child,[data-section="mahsup"] th:first-child{width:62%}#fm-word-copy [data-section="brutnet"] td:last-child,[data-section="brutnet"] th:last-child,[data-section="mahsup"] td:last-child,[data-section="mahsup"] th:last-child{width:38%;text-align:right}#fm-word-copy td:first-child,#fm-word-copy th:first-child{white-space:nowrap}#fm-word-copy td,#fm-word-copy th{border:1px solid #999;padding:5px 8px;background:#fff!important;color:#111827!important}`}</style>
              <div id="fm-word-copy">
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
    </div>
  );
}
