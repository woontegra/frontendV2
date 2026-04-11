/**
 * Gemi adamları — yıllık ücretli izin (v1 GemiIndependent ile uyumlu, v2 shell).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Youtube, Copy, Trash2 } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { apiClient } from "@/utils/apiClient";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/shared/utils/exclusionStorage";
import type { ExcludedDay, SavedExclusionSet } from "@/shared/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { calculateIncomeTaxWithBrackets } from "@/shared/utils/incomeTaxCore";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import {
  type WorkPeriod,
  calculateDaysBetween,
  calculateTotalDays,
  formatTotalWorkDays,
  calculateGemiBreakdown,
} from "./gemiCalculations";

const NOTE_ITEMS: string[] = [
  "Gemi adamları için yıllık ücretli izin hakkı 4857 sayılı İş Kanunu'na tabidir.",
  "Deniz taşıma işlerinde çalışanlar özel hesaplamaya tabidir.",
];

const SAVE_TYPE = "Yıllık Ücretli İzin";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Gemi Adamları Yıllık Ücretli İzin";
const REPORT_TITLE = "Yıllık Ücretli İzin";
const RECORD_TYPE = "yillik_izin_gemi";
const REDIRECT_PATH = "/yillik-izin/gemi";
const REPORT_CONTENT_ID = "report-content-yillik-gemi";

type UsedRow = { id: string; start: string; end: string; days: string };

const createEmptyRow = (): UsedRow => ({
  id: Math.random().toString(36).slice(2),
  start: "",
  end: "",
  days: "",
});
const createInitialRows = (count = 7): UsedRow[] =>
  Array.from({ length: count }, () => createEmptyRow());
const toDays = (value: string) =>
  Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded-xl h-11 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "text-sm font-semibold text-gray-700 dark:text-gray-300";
const tableDateCls =
  "w-full rounded-xl h-10 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-indigo-500";

function rowsToExcludedDays(rows: UsedRow[]): ExcludedDay[] {
  return rows
    .filter((r) => r.start && r.end)
    .map((r) => ({
      id: r.id,
      type: "Kullanılan İzin",
      start: r.start,
      end: r.end,
      days: toDays(r.days),
    }));
}

function exclusionRowsToUsedRows(data: ExcludedDay[]): UsedRow[] {
  if (!data.length) return createInitialRows(2);
  return data.map((row) => ({
    id: row.id || Math.random().toString(36).slice(2),
    start: row.start || "",
    end: row.end || "",
    days: row.days != null ? String(row.days) : "",
  }));
}

function calculateUsedTotal(rows: UsedRow[]) {
  return rows.reduce((acc, row) => acc + toDays(row.days), 0);
}

function calculateRemainingDays(total: number, used: number) {
  return Math.max(0, total - used);
}

function validateSave(data: {
  iseGiris: string;
  istenCikis: string;
  remainingDays: number;
  brutIzin: number;
}) {
  if (!data.iseGiris?.trim()) return { isValid: false, message: "Giriş tarihi gerekli" };
  if (!data.istenCikis?.trim()) return { isValid: false, message: "Çıkış tarihi gerekli" };
  if (data.remainingDays < 0) return { isValid: false, message: "Geçerli izin günü giriniz" };
  if (data.brutIzin <= 0)
    return { isValid: false, message: "Brüt izin tutarı hesaplanamadı. Lütfen çıplak brüt ücreti kontrol edin." };
  return { isValid: true, message: "" };
}

export default function YillikIzinGemiPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle("yillik-izin");
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("yillik-gemi");
  const loadedIdRef = useRef<string | null>(null);

  const [workPeriods, setWorkPeriods] = useState<WorkPeriod[]>([
    { id: "1", iseGiris: "", istenCikis: "" },
  ]);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(2));
  const [employerPayment, setEmployerPayment] = useState("");
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<SavedExclusionSet[]>([]);

  const [d1, setD1] = useState("");
  const [d2, setD2] = useState("");

  const workPeriodDays = useMemo(() => {
    const daysMap: Record<string, number> = {};
    workPeriods.forEach((period) => {
      if (period.gunSayisi !== undefined) {
        daysMap[period.id] = period.gunSayisi;
      } else if (period.iseGiris && period.istenCikis) {
        daysMap[period.id] = calculateDaysBetween(period.iseGiris, period.istenCikis);
      } else {
        daysMap[period.id] = 0;
      }
    });
    return daysMap;
  }, [workPeriods]);

  const handleDateChange = (periodId: string, field: "iseGiris" | "istenCikis", value: string) => {
    setWorkPeriods((prev) =>
      prev.map((p) => (p.id === periodId ? { ...p, [field]: value, gunSayisi: undefined } : p))
    );
  };

  const addWorkPeriod = () => {
    setWorkPeriods((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), iseGiris: "", istenCikis: "" },
    ]);
  };

  const removeWorkPeriod = (pid: string) => {
    if (workPeriods.length > 1) {
      setWorkPeriods((prev) => prev.filter((p) => p.id !== pid));
    }
  };

  const updateWorkPeriod = (pid: string, patch: Partial<WorkPeriod>) => {
    setWorkPeriods((prev) => prev.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (rid: string, patch: Partial<UsedRow>) =>
    setRows((prev) => prev.map((r) => (r.id === rid ? { ...r, ...patch } : r)));

  const totalWorkDays = useMemo(() => calculateTotalDays(workPeriods), [workPeriods]);
  const initialBreakdown = useMemo(() => calculateGemiBreakdown(workPeriods), [workPeriods]);

  useEffect(() => {
    setD1(String(initialBreakdown.d1));
    setD2(String(initialBreakdown.d2));
  }, [initialBreakdown]);

  const breakdown = useMemo(() => {
    const d1Num = Number(d1) || 0;
    const d2Num = Number(d2) || 0;
    const total = d1Num + d2Num;
    const y1 = d1Num > 0 ? Math.round(d1Num / 15) : 0;
    const y2 = d2Num > 0 ? Math.round(d2Num / 30) : 0;
    return { y1, y2, d1: d1Num, d2: d2Num, total };
  }, [d1, d2]);

  const usedTotal = useMemo(() => calculateUsedTotal(rows), [rows]);
  const remainingDays = useMemo(
    () => calculateRemainingDays(breakdown.total, usedTotal),
    [breakdown.total, usedTotal]
  );

  const [totalWorkDaysFromBackend, setTotalWorkDaysFromBackend] = useState(0);
  const [breakdownFromBackend, setBreakdownFromBackend] = useState<{
    y1: number;
    y2: number;
    d1: number;
    d2: number;
    total: number;
  }>({ y1: 0, y2: 0, d1: 0, d2: 0, total: 0 });
  const [remainingDaysFromBackend, setRemainingDaysFromBackend] = useState(0);
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);

  const displayTotalWorkDays = totalWorkDaysFromBackend || totalWorkDays;
  const displayBreakdown = breakdownFromBackend.total > 0 ? breakdownFromBackend : breakdown;
  const displayRemainingDays =
    remainingDaysFromBackend > 0 || brutIzin > 0 ? remainingDaysFromBackend : remainingDays;

  const morKartTutar = useMemo(() => {
    if (brutIzin > 0) return brutIzin;
    const ucret = toDays(brutUcret);
    return (ucret / 30) * displayRemainingDays;
  }, [brutIzin, brutUcret, displayRemainingDays]);

  const selectedYear = useMemo(() => {
    if (workPeriods?.length) {
      const exitDates = workPeriods
        .map((p) => p.istenCikis)
        .filter((d) => d && d.trim() !== "")
        .map((d) => new Date(d!))
        .filter((d) => !isNaN(d.getTime()));
      if (exitDates.length > 0) {
        const latestExit = exitDates.reduce((latest, current) => (current > latest ? current : latest));
        const year = latestExit.getFullYear();
        if (year >= 2010 && year <= 2030) return year;
      }
    }
    return new Date().getFullYear();
  }, [workPeriods]);

  const bruttenNeteDisplay = useMemo(() => {
    const brut = brutIzin > 0 ? brutIzin : morKartTutar;
    if (brut <= 0)
      return {
        brut: 0,
        sgk: 0,
        issizlik: 0,
        gelirVergisi: 0,
        gelirVergisiDilimleri: "",
        damgaVergisi: 0,
        net: 0,
      };
    if (brutIzin > 0) {
      return {
        brut,
        sgk,
        issizlik,
        gelirVergisi,
        gelirVergisiDilimleri,
        damgaVergisi,
        net: netIzin,
      };
    }
    const sgkVal = brut * 0.14;
    const issizlikVal = brut * 0.01;
    const matrah = Math.max(0, brut - sgkVal - issizlikVal);
    const gv = calculateIncomeTaxWithBrackets(selectedYear, matrah);
    const damgaVal = brut * 0.00759;
    const netVal = brut - sgkVal - issizlikVal - gv.tax - damgaVal;
    return {
      brut,
      sgk: sgkVal,
      issizlik: issizlikVal,
      gelirVergisi: gv.tax,
      gelirVergisiDilimleri: gv.brackets,
      damgaVergisi: damgaVal,
      net: netVal,
    };
  }, [
    brutIzin,
    morKartTutar,
    sgk,
    issizlik,
    gelirVergisi,
    gelirVergisiDilimleri,
    damgaVergisi,
    netIzin,
    selectedYear,
  ]);

  const asgariUcretHatasi = useMemo(() => {
    if (!workPeriods?.length || !brutUcret) return null;
    const exitDates = workPeriods.map((p) => p.istenCikis).filter((d) => d && d.trim() !== "");
    if (exitDates.length === 0) return null;
    const latestExitDate = exitDates[exitDates.length - 1];
    const girilenUcret = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
    if (isNaN(girilenUcret) || girilenUcret <= 0) return null;
    const asgariUcret = getAsgariUcretByDate(latestExitDate);
    if (!asgariUcret) return null;
    if (girilenUcret < asgariUcret) {
      const yil = new Date(latestExitDate).getFullYear();
      return {
        mesaj: `Girilen ücret, ${yil} yılı asgari brüt ücretinden düşük olamaz (${asgariUcret.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺).`,
        asgariUcret,
      };
    }
    return null;
  }, [workPeriods, brutUcret]);

  useEffect(() => {
    const calculateFromBackend = async () => {
      try {
        const payload = {
          workPeriods: workPeriods.filter((p) => p.iseGiris && p.istenCikis),
          brutUcret: toDays(brutUcret),
          usedDays: usedTotal,
          year: selectedYear,
        };
        const response = await apiClient("/api/yillik-izin/gemi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errMsg = result?.error || `HTTP ${response.status}`;
          showToastError(errMsg);
          return;
        }
        if (result.success && result.data) {
          setTotalWorkDaysFromBackend(result.data.totalWorkDays || 0);
          setBreakdownFromBackend(
            result.data.breakdown || { y1: 0, y2: 0, d1: 0, d2: 0, total: 0 }
          );
          setRemainingDaysFromBackend(result.data.remainingDays || 0);
          setBrutIzin(result.data.brutIzin || 0);
          setSgk(result.data.sgk || 0);
          setIssizlik(result.data.issizlik || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNetIzin(result.data.netIzin || 0);
        }
      } catch (error) {
        showToastError(error instanceof Error ? error.message : "Hesaplama isteği başarısız.");
      }
    };

    if (brutUcret && toDays(brutUcret) > 0 && workPeriods.some((p) => p.iseGiris && p.istenCikis)) {
      calculateFromBackend();
    } else {
      setTotalWorkDaysFromBackend(0);
      setBreakdownFromBackend({ y1: 0, y2: 0, d1: 0, d2: 0, total: 0 });
      setRemainingDaysFromBackend(0);
      setBrutIzin(0);
      setSgk(0);
      setIssizlik(0);
      setGelirVergisi(0);
      setGelirVergisiDilimleri("");
      setDamgaVergisi(0);
      setNetIzin(0);
    }
  }, [brutUcret, selectedYear, workPeriods, usedTotal, showToastError]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  useEffect(() => {
    if (!effectiveId || loadedIdRef.current === effectiveId) return;
    let mounted = true;
    loadedIdRef.current = effectiveId;

    yukleHesap(effectiveId, RECORD_TYPE)
      .then((res) => {
        if (!mounted) return;
        if (!res.success) {
          showToastError(res.error || "Kayıt yüklenemedi");
          loadedIdRef.current = null;
          return;
        }
        let payload: any = res.data;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = {};
          }
        }
        const form = payload?.form || payload?.data?.form || payload;
        if (Array.isArray(form?.workPeriods)) setWorkPeriods(form.workPeriods);
        if (form?.brutUcret != null || form?.brut_ucret != null) {
          setBrutUcret(String(form.brutUcret ?? form.brut_ucret ?? ""));
        }
        if (Array.isArray(form?.rows)) {
          setRows(
            form.rows.map((r: UsedRow) => ({
              id: r.id || Math.random().toString(36).slice(2),
              start: r.start || "",
              end: r.end || "",
              days: r.days != null ? String(r.days) : "",
            }))
          );
        }
        if (form?.employerPayment != null || form?.employer_payment != null) {
          setEmployerPayment(String(form.employerPayment ?? form.employer_payment ?? ""));
        }
        if (form?.d1 != null) setD1(String(form.d1));
        if (form?.d2 != null) setD2(String(form.d2));
        setCurrentRecordName(res.name || null);
        success(`Kayıt yüklendi (#${effectiveId})`);
      })
      .catch((err) => {
        if (mounted) {
          loadedIdRef.current = null;
          showToastError(err?.message || "Kayıt yüklenemedi");
        }
      });

    return () => {
      mounted = false;
    };
  }, [effectiveId, success, showToastError]);

  const gemiYillikReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brutForReport = brutIzin > 0 ? brutIzin : bruttenNeteDisplay.brut;
    const netForReport = brutIzin > 0 ? netIzin : bruttenNeteDisplay.net;
    const sgkForReport = brutIzin > 0 ? sgk : bruttenNeteDisplay.sgk;
    const issizlikForReport = brutIzin > 0 ? issizlik : bruttenNeteDisplay.issizlik;
    const gelirVergisiForReport = brutIzin > 0 ? gelirVergisi : bruttenNeteDisplay.gelirVergisi;
    const damgaVergisiForReport = brutIzin > 0 ? damgaVergisi : bruttenNeteDisplay.damgaVergisi;
    const gelirVergisiDilimleriForReport =
      brutIzin > 0 ? gelirVergisiDilimleri : bruttenNeteDisplay.gelirVergisiDilimleri;
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, "").replace(",", ".")) || 0;
    const mahsuplamaSonucu = Math.max(0, brutForReport - employerPaymentNum);

    const workPeriodsSummary = workPeriods
      .map((wp) => {
        if (!wp.iseGiris || !wp.istenCikis) return null;
        const days = wp.gunSayisi ?? calculateDaysBetween(wp.iseGiris, wp.istenCikis);
        return {
          start: new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
          end: new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
          days,
        };
      })
      .filter(Boolean) as { start: string; end: string; days: number }[];

    const validUsedRows = rows
      .filter((r) => r.start || r.end || r.days)
      .map((r) => ({ start: r.start, end: r.end, days: r.days || "0" }));
    const brutUcretNum = Number(String(brutUcret).replace(/\./g, "").replace(",", ".")) || 0;

    const tableStyle = {
      width: "100%",
      borderCollapse: "collapse" as const,
      marginBottom: "16px",
      border: "1px solid #999",
      fontSize: "10px",
    };
    const thStyle = { padding: "5px 8px", fontWeight: 600, border: "1px solid #999", backgroundColor: "#f9fafb" };
    const tdStyle = { padding: "5px 8px", border: "1px solid #999" };
    const tdRightStyle = { ...tdStyle, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

    return {
      title: REPORT_TITLE,
      sections: { info: true, periodTable: false, grossToNet: true, mahsuplasma: true },
      infoRows: [
        {
          label: "İşe Giriş Tarihi",
          value: workPeriods[0]?.iseGiris
            ? new Date(workPeriods[0].iseGiris).toLocaleDateString("tr-TR")
            : "-",
        },
        {
          label: "İşten Çıkış Tarihi",
          value: workPeriods[workPeriods.length - 1]?.istenCikis
            ? new Date(workPeriods[workPeriods.length - 1].istenCikis).toLocaleDateString("tr-TR")
            : "-",
        },
        { label: "Çıplak Brüt Ücret", value: brutUcret ? `${fmtLocal(brutUcretNum)}₺` : "-" },
        { label: "Toplam Çalışma Süresi", value: formatTotalWorkDays(displayTotalWorkDays) },
      ],
      customSections: [
        {
          title: "Çalışma Dönemleri",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Başlangıç</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Bitiş</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Gün Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {workPeriodsSummary.map((wp, idx) => (
                  <tr key={idx}>
                    <td style={tdStyle}>{wp.start}</td>
                    <td style={tdStyle}>{wp.end}</td>
                    <td style={tdRightStyle}>{wp.days} gün</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
          condition: workPeriodsSummary.length > 0,
        },
        {
          title: "Yıllık İzin Hak Edişi (Gemi Adamları)",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Dönem</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Gün Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {displayBreakdown.y1 > 0 && displayBreakdown.d1 > 0 && (
                  <tr>
                    <td style={tdStyle}>
                      {displayBreakdown.y1} yıl (İlk dönem - 15 gün/yıl)
                    </td>
                    <td style={tdRightStyle}>
                      {displayBreakdown.y1} yıl × 15 gün = {displayBreakdown.d1} gün
                    </td>
                  </tr>
                )}
                {displayBreakdown.y2 > 0 && displayBreakdown.d2 > 0 && (
                  <tr>
                    <td style={tdStyle}>
                      {displayBreakdown.y2} yıl (Sonraki dönem - 30 gün/yıl)
                    </td>
                    <td style={tdRightStyle}>
                      {displayBreakdown.y2} yıl × 30 gün = {displayBreakdown.d2} gün
                    </td>
                  </tr>
                )}
                <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                  <td style={tdStyle}>Toplam Hak Edilen</td>
                  <td style={tdRightStyle}>{displayBreakdown.total} gün</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        ...(validUsedRows.length > 0
          ? [
              {
                title: "Kullanılan İzinler",
                content: (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: "left" }}>Başlangıç Tarihi</th>
                        <th style={{ ...thStyle, textAlign: "left" }}>Bitiş Tarihi</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Gün Sayısı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validUsedRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={tdStyle}>
                            {row.start ? new Date(row.start).toLocaleDateString("tr-TR") : "-"}
                          </td>
                          <td style={tdStyle}>
                            {row.end ? new Date(row.end).toLocaleDateString("tr-TR") : "-"}
                          </td>
                          <td style={tdRightStyle}>{row.days || "0"} gün</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                        <td colSpan={2} style={tdStyle}>
                          Toplam Kullanılan
                        </td>
                        <td style={tdRightStyle}>{usedTotal} gün</td>
                      </tr>
                    </tbody>
                  </table>
                ),
              },
            ]
          : []),
        {
          title: "Yıllık Ücretli İzin Hesaplama",
          content: (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Alan</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Değer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Kalan İzin Süresi</td>
                  <td style={tdRightStyle}>{displayRemainingDays} gün</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Günlük Ücret (Toplam/30)</td>
                  <td style={tdRightStyle}>
                    ({fmtLocal(brutUcretNum)}₺ / 30 × {displayRemainingDays} gün)
                  </td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                  <td style={tdStyle}>Yıllık Ücretli İzin Alacağı</td>
                  <td style={tdRightStyle}>{fmtLocal(brutForReport)}₺</td>
                </tr>
              </tbody>
            </table>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutForReport)}₺` },
          { label: "SGK İşçi Primi (%14)", value: `-${fmtLocal(sgkForReport)}₺`, isDeduction: true },
          { label: "İşsizlik Sigortası Primi (%1)", value: `-${fmtLocal(issizlikForReport)}₺`, isDeduction: true },
          {
            label: `Gelir Vergisi ${gelirVergisiDilimleriForReport}`,
            value: `-${fmtLocal(gelirVergisiForReport)}₺`,
            isDeduction: true,
          },
          {
            label: "Damga Vergisi (Binde 7,59)",
            value: `-${fmtLocal(damgaVergisiForReport)}₺`,
            isDeduction: true,
          },
          { label: "Net Yıllık İzin Alacağı", value: `${fmtLocal(netForReport)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutForReport)}₺` },
          { label: "İşveren Ödemesi", value: `-${fmtLocal(employerPaymentNum)}₺`, isDeduction: true },
        ],
        netRow: { label: "Mahsuplaşma Sonucu", value: `${fmtLocal(mahsuplamaSonucu)}₺` },
      },
    };
  }, [
    workPeriods,
    brutUcret,
    displayTotalWorkDays,
    displayBreakdown,
    displayRemainingDays,
    rows,
    usedTotal,
    brutIzin,
    bruttenNeteDisplay,
    sgk,
    issizlik,
    gelirVergisi,
    gelirVergisiDilimleri,
    damgaVergisi,
    netIzin,
    employerPayment,
  ]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brutForReport = brutIzin > 0 ? brutIzin : bruttenNeteDisplay.brut;
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, "").replace(",", ".")) || 0;
    const validUsedRows = rows
      .filter((r) => r.start || r.end || r.days)
      .map((r) => ({ start: r.start, end: r.end, days: r.days || "0" }));
    const brutUcretNum = Number(String(brutUcret).replace(/\./g, "").replace(",", ".")) || 0;

    const workPeriodsSummary = workPeriods
      .filter((wp) => wp.iseGiris && wp.istenCikis)
      .map((wp) => ({
        start: new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
        end: new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
        days: wp.gunSayisi ?? calculateDaysBetween(wp.iseGiris, wp.istenCikis),
      }));

    if (gemiYillikReportConfig.infoRows && gemiYillikReportConfig.infoRows.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: gemiYillikReportConfig.infoRows.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    if (workPeriodsSummary.length > 0) {
      const wpRows = workPeriodsSummary.map((wp) => [wp.start, wp.end, `${wp.days} gün`]);
      const n2 = adaptToWordTable({ headers: ["Başlangıç", "Bitiş", "Gün Sayısı"], rows: wpRows });
      sections.push({
        id: "calisma-donemleri",
        title: "Çalışma Dönemleri",
        html: buildWordTable(n2.headers, n2.rows),
      });
    }

    const hakRows: string[][] = [];
    if (displayBreakdown.y1 > 0 && displayBreakdown.d1 > 0) {
      hakRows.push([
        `${displayBreakdown.y1} yıl (İlk dönem - 15 gün/yıl)`,
        `${displayBreakdown.y1} yıl × 15 gün = ${displayBreakdown.d1} gün`,
      ]);
    }
    if (displayBreakdown.y2 > 0 && displayBreakdown.d2 > 0) {
      hakRows.push([
        `${displayBreakdown.y2} yıl (Sonraki dönem - 30 gün/yıl)`,
        `${displayBreakdown.y2} yıl × 30 gün = ${displayBreakdown.d2} gün`,
      ]);
    }
    hakRows.push(["Toplam Hak Edilen", `${displayBreakdown.total} gün`]);
    const n3 = adaptToWordTable({ headers: ["Dönem", "Gün Sayısı"], rows: hakRows });
    sections.push({
      id: "yillik-izin-hak-edisi",
      title: "Yıllık İzin Hak Edişi (Gemi Adamları)",
      html: buildWordTable(n3.headers, n3.rows),
    });

    if (validUsedRows.length > 0) {
      const exclRows = validUsedRows.map((r) => [
        r.start ? new Date(r.start).toLocaleDateString("tr-TR") : "-",
        r.end ? new Date(r.end).toLocaleDateString("tr-TR") : "-",
        `${r.days || "0"} gün`,
      ]);
      exclRows.push(["Toplam Kullanılan", "", `${usedTotal} gün`]);
      const n4 = adaptToWordTable({
        headers: ["Başlangıç Tarihi", "Bitiş Tarihi", "Gün Sayısı"],
        rows: exclRows,
      });
      sections.push({
        id: "kullanilan-izinler",
        title: "Kullanılan İzinler",
        html: buildWordTable(n4.headers, n4.rows),
      });
    }

    const calcRows = [
      ["Kalan İzin Süresi", `${displayRemainingDays} gün`],
      ["Günlük Ücret (Toplam/30)", `(${fmtLocal(brutUcretNum)}₺ / 30 × ${displayRemainingDays} gün)`],
      ["Yıllık Ücretli İzin Alacağı", `${fmtLocal(brutForReport)}₺`],
    ];
    const n5 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: calcRows });
    sections.push({
      id: "yillik-ucretli-izin-hesaplama",
      title: "Yıllık Ücretli İzin Hesaplama",
      html: buildWordTable(n5.headers, n5.rows),
    });

    const gnd = gemiYillikReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n6 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n6.headers, n6.rows) });
    }

    const md = gemiYillikReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n7 = adaptToWordTable(mahsupRows);
      sections.push({
        id: "mahsuplasma",
        title: md.title || "Mahsuplaşma",
        html: buildWordTable(n7.headers, n7.rows),
      });
    }

    return sections;
  }, [
    gemiYillikReportConfig,
    workPeriods,
    displayBreakdown,
    displayRemainingDays,
    rows,
    usedTotal,
    brutUcret,
    brutIzin,
    bruttenNeteDisplay,
    employerPayment,
  ]);

  const handleSave = () => {
    try {
      const brutForValidation = brutIzin > 0 ? brutIzin : bruttenNeteDisplay.brut;
      const netForSave = brutIzin > 0 ? netIzin : bruttenNeteDisplay.net;
      const validation = validateSave({
        iseGiris: workPeriods[0]?.iseGiris || "",
        istenCikis: workPeriods[workPeriods.length - 1]?.istenCikis || "",
        remainingDays: displayRemainingDays,
        brutIzin: brutForValidation,
      });
      if (!validation.isValid) {
        showToastError(validation.message);
        return;
      }

      const sgkForSave = brutIzin > 0 ? sgk : bruttenNeteDisplay.sgk;
      const issizlikForSave = brutIzin > 0 ? issizlik : bruttenNeteDisplay.issizlik;
      const gelirVergisiForSave = brutIzin > 0 ? gelirVergisi : bruttenNeteDisplay.gelirVergisi;
      const damgaVergisiForSave = brutIzin > 0 ? damgaVergisi : bruttenNeteDisplay.damgaVergisi;
      const gelirVergisiDilimleriForSave =
        brutIzin > 0 ? gelirVergisiDilimleri : bruttenNeteDisplay.gelirVergisiDilimleri;

      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              workPeriods,
              brutUcret,
              rows,
              employerPayment,
              d1,
              d2,
            },
            results: {
              breakdown,
              usedTotal,
              remainingDays: displayRemainingDays,
              brutIzin: brutForValidation,
              sgk: sgkForSave,
              issizlik: issizlikForSave,
              gelirVergisi: gelirVergisiForSave,
              gelirVergisiDilimleri: gelirVergisiDilimleriForSave,
              damgaVergisi: damgaVergisiForSave,
              netIzin: netForSave,
            },
          },
          hesaplama_tipi: SAVE_TYPE,
          brut_toplam: Number(brutForValidation.toFixed(2)),
          net_toplam: Number(netForSave.toFixed(2)),
          ise_giris: workPeriods[0]?.iseGiris || null,
          isten_cikis: workPeriods[workPeriods.length - 1]?.istenCikis || null,
          eklentiler: { employer_payment: employerPayment, workPeriods },
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: `/yillik-izin/gemi/:id`,
      });
    } catch {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    const hasUnsavedChanges =
      workPeriods.some((p) => p.iseGiris || p.istenCikis) ||
      brutUcret ||
      rows.some((r) => r.start || r.end || r.days) ||
      employerPayment;
    if (hasUnsavedChanges && !window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;

    setWorkPeriods([{ id: "1", iseGiris: "", istenCikis: "" }]);
    setBrutUcret("");
    setRows(createInitialRows(2));
    setEmployerPayment("");
    setD1("");
    setD2("");
    setCurrentRecordName(null);
    loadedIdRef.current = null;
    navigate(REDIRECT_PATH, { replace: true });
  };

  const clampDateYear = (value: string) => {
    if (!value || !value.includes("-")) return value;
    const parts = value.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].substring(0, 4);
      return parts.join("-");
    }
    return value;
  };

  const accent = pageStyle.color || "#5E35B1";

  const openLoadModal = useCallback(async () => {
    const sets = await getAllExclusionSets();
    const setsWithCalculatedDays = sets.map((set) => ({
      ...set,
      data: set.data.map((row) => {
        if (row.start && row.end && (!row.days || row.days === 0)) {
          const startDate = new Date(row.start);
          const endDate = new Date(row.end);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return { ...row, days: diffDays };
          }
        }
        return row;
      }),
    }));
    setSavedExclusionSets(setsWithCalculatedDays);
    setShowExclusionLoadModal(true);
  }, []);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 pb-24 lg:pb-8">
      <div
        id={REPORT_CONTENT_ID}
        style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }}
        aria-hidden="true"
      >
        <ReportContentFromConfig config={gemiYillikReportConfig} />
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Gemi Adamları Yıllık İzin Hesaplama
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Deniz İş Kanunu 40. madde — çoklu çalışma dönemi
            </p>
          </div>
          {videoLink && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(videoLink, "_blank")}
              className="gap-2 font-semibold rounded-full border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0"
            >
              <Youtube className="h-4 w-4" />
              Kullanım Videosu
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
          <div className="p-4 sm:p-6 space-y-5">
            <div className="space-y-3">
              <div className={labelCls}>Çalışma dönemleri</div>
              {workPeriods.map((period) => (
                <div
                  key={period.id}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/30"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Giriş tarihi</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={period.iseGiris}
                        onChange={(e) => {
                          const value = clampDateYear(e.target.value);
                          handleDateChange(period.id, "iseGiris", value);
                        }}
                        onBlur={(e) => {
                          const newValue = e.target.value;
                          if (
                            newValue &&
                            /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                            period.istenCikis &&
                            /^\d{4}-\d{2}-\d{2}$/.test(period.istenCikis)
                          ) {
                            const newDate = new Date(newValue);
                            const exitDate = new Date(period.istenCikis);
                            if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                              showToastError("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                              handleDateChange(period.id, "iseGiris", period.istenCikis);
                            }
                          }
                        }}
                        className={`${inputCls} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Çıkış tarihi</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={period.istenCikis}
                        onChange={(e) => {
                          const value = clampDateYear(e.target.value);
                          handleDateChange(period.id, "istenCikis", value);
                        }}
                        onBlur={(e) => {
                          const newValue = e.target.value;
                          if (
                            newValue &&
                            /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                            period.iseGiris &&
                            /^\d{4}-\d{2}-\d{2}$/.test(period.iseGiris)
                          ) {
                            const newDate = new Date(newValue);
                            const entryDate = new Date(period.iseGiris);
                            if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                              showToastError("Çıkış tarihi, giriş tarihinden önce olamaz.");
                              handleDateChange(period.id, "istenCikis", period.iseGiris);
                            }
                          }
                        }}
                        className={`${inputCls} mt-1`}
                      />
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={workPeriodDays[period.id] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const value = v === "" ? 0 : Number(v) || 0;
                            updateWorkPeriod(period.id, { gunSayisi: value });
                          }}
                          className="w-16 rounded-xl border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm text-center font-semibold bg-white dark:bg-gray-800 h-10"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          ≈ {workPeriodDays[period.id] || 0} gün
                        </span>
                        {workPeriods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWorkPeriod(period.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium ml-auto"
                          >
                            Dönemi sil
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addWorkPeriod}
                className="w-full text-sm font-semibold text-indigo-600 dark:text-indigo-400 py-2 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
              >
                + Yeni dönem ekle
              </button>

              <div>
                <label className={labelCls}>Toplam çalışma süresi</label>
                <input
                  readOnly
                  value={formatTotalWorkDays(displayTotalWorkDays)}
                  className={`${inputCls} mt-1 bg-gray-100 dark:bg-gray-900/50 cursor-not-allowed`}
                />
              </div>
              <div>
                <label className={labelCls}>Çıplak brüt ücret</label>
                <input
                  value={brutUcret}
                  onChange={(e) => setBrutUcret(e.target.value)}
                  placeholder="Örn: 25.000,00"
                  className={`${inputCls} mt-1 ${
                    asgariUcretHatasi
                      ? "border-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/20"
                      : ""
                  }`}
                />
                {asgariUcretHatasi && (
                  <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi.mesaj}</p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/20">
              <div className={labelCls + " mb-2"}>Yıllık izin hesaplama</div>
              <div className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="whitespace-nowrap">15 × {displayBreakdown.y1} =</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={d1}
                    onChange={(e) => setD1(e.target.value)}
                    className="w-[72px] rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-center font-semibold"
                  />
                  <span>gün</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="whitespace-nowrap">30 × {displayBreakdown.y2} =</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={d2}
                    onChange={(e) => setD2(e.target.value)}
                    className="w-[72px] rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-center font-semibold"
                  />
                  <span>gün</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 font-semibold">
                  Toplam = {displayBreakdown.total} gün
                </div>
              </div>
              <div className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                Toplam yıllık izin hakkı: {displayBreakdown.total} gün
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-900/30">
                <button
                  type="button"
                  onClick={() => setAccordionOpen((s) => !s)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
                >
                  Kullanılan izinleri dışla
                  <span className={`inline-block transition ${accordionOpen ? "rotate-180" : ""}`}>▼</span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExclusionSaveName("");
                      setShowExclusionSaveModal(true);
                    }}
                    disabled={rows.every((r) => !r.start || !r.end)}
                  >
                    Kaydet
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={openLoadModal}>
                    İçe aktar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRows(createInitialRows(7))}
                    disabled={rows.every((r) => !r.start && !r.end && !r.days)}
                    className="text-red-600 border-red-200 dark:border-red-900"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1 inline" />
                    Tümünü sil
                  </Button>
                </div>
              </div>
              {accordionOpen && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-700 dark:text-gray-300">
                          <th className="py-2 pr-2 font-semibold">İzin başlangıç</th>
                          <th className="py-2 pr-2 font-semibold">İzin bitiş</th>
                          <th className="py-2 pr-2 font-semibold">Gün</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={r.start}
                                onChange={(e) => {
                                  const value = clampDateYear(e.target.value);
                                  setRow(r.id, { start: value });
                                }}
                                className={tableDateCls}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={r.end}
                                onChange={(e) => {
                                  const value = clampDateYear(e.target.value);
                                  setRow(r.id, { end: value });
                                }}
                                className={tableDateCls}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                value={r.days}
                                onChange={(e) => setRow(r.id, { days: e.target.value })}
                                placeholder="Örn: 5"
                                className={tableDateCls}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                            Toplam
                          </td>
                          <td className="py-2 font-semibold">{usedTotal} gün</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400"
                  >
                    + Satır ekle
                  </button>
                  <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Kalan izin hakkı: {displayRemainingDays} gün
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/25 dark:to-indigo-950/20 border-l-4 border-purple-500">
              <h3 className="text-base font-bold text-purple-900 dark:text-purple-300 mb-3">
                Yıllık ücretli izin hesaplama
              </h3>
              <div className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                <div className="flex justify-between gap-2 border-b border-purple-200/50 dark:border-purple-900/40 pb-2">
                  <span>Kalan izin süresi</span>
                  <span className="font-semibold">{displayRemainingDays} gün</span>
                </div>
                <div className="flex justify-between gap-2 border-b border-purple-200/50 dark:border-purple-900/40 pb-2">
                  <span>Günlük ücret (toplam/30)</span>
                  <span className="font-medium text-right">
                    ({fmt(toDays(brutUcret))}₺ / 30 × {displayRemainingDays} gün)
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="font-semibold">Yıllık ücretli izin alacağı</span>
                  <span className="font-bold text-lg text-purple-700 dark:text-purple-400">
                    {fmt(morKartTutar)}₺
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-l-4 border-amber-500">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-300 mb-3">
                Brütten nete çevir
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Brüt yıllık izin ücreti", bruttenNeteDisplay.brut, false],
                  ["SGK primi (%14)", -bruttenNeteDisplay.sgk, true],
                  ["İşsizlik primi (%1)", -bruttenNeteDisplay.issizlik, true],
                  [
                    `Gelir vergisi ${bruttenNeteDisplay.gelirVergisiDilimleri}`,
                    -bruttenNeteDisplay.gelirVergisi,
                    true,
                  ],
                  ["Damga vergisi (binde 7,59)", -bruttenNeteDisplay.damgaVergisi, true],
                ].map(([label, val, neg]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between gap-2 border-b border-amber-200/50 dark:border-amber-900/40 pb-2"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{label}</span>
                    <span
                      className={
                        neg
                          ? "font-semibold text-red-600 dark:text-red-400"
                          : "font-semibold text-gray-900 dark:text-white"
                      }
                    >
                      {neg ? "-" : ""}
                      {fmt(Math.abs(Number(val)))}₺
                    </span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 pt-2">
                  <span className="font-semibold text-gray-900 dark:text-white">Net yıllık izin ücreti</span>
                  <span className="font-bold text-green-700 dark:text-green-400">{fmt(bruttenNeteDisplay.net)}₺</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-amber-200/60 dark:border-amber-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödeme
                  </span>
                  <input
                    value={employerPayment}
                    onChange={(e) => setEmployerPayment(e.target.value)}
                    placeholder="Örn: 10.000"
                    className="w-full sm:w-40 rounded-xl h-10 border border-gray-200 dark:border-gray-600 px-3 text-sm font-semibold text-right bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Notlar</h3>
              <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">
                Not: Deniz İş Kanunu – Yıllık ücretli izin 40. madde
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] font-light text-gray-500 dark:text-gray-400">
                {NOTE_ITEMS.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : effectiveId ? "Güncelle" : "Kaydet"}
        previewButton={{
          title: `Gemi ${REPORT_TITLE} Rapor`,
          copyTargetId: "gemi-yillik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #gemi-yillik-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #gemi-yillik-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="gemi-yillik-word-copy">
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
          onPdf: () => downloadPdfFromDOM(`Gemi ${REPORT_TITLE} Rapor`, REPORT_CONTENT_ID),
        }}
      />

      {showExclusionSaveModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
            onClick={() => setShowExclusionSaveModal(false)}
            role="presentation"
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">
                Kullanılan izinleri kaydet
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste adı</label>
                <input
                  type="text"
                  placeholder="Örn: Davacı A - kullanılan izinler"
                  value={exclusionSaveName}
                  onChange={(e) => setExclusionSaveName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowExclusionSaveModal(false);
                    setExclusionSaveName("");
                  }}
                >
                  İptal
                </Button>
                <Button
                  onClick={async () => {
                    if (!exclusionSaveName.trim()) {
                      showToastError("Lütfen bir isim girin.");
                      return;
                    }
                    const saved = await saveExclusionSet(exclusionSaveName.trim(), rowsToExcludedDays(rows));
                    if (saved) {
                      success(`"${exclusionSaveName.trim()}" olarak kaydedildi.`);
                      setShowExclusionSaveModal(false);
                      setExclusionSaveName("");
                    } else {
                      showToastError("Kaydetme işlemi başarısız oldu.");
                    }
                  }}
                  disabled={!exclusionSaveName.trim()}
                >
                  Kaydet
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showExclusionLoadModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
            onClick={() => setShowExclusionLoadModal(false)}
            role="presentation"
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">
                Kayıtlı kullanılan izinler
              </h3>
              {savedExclusionSets.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                  {savedExclusionSets.map((set) => (
                    <div
                      key={set.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600 gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                          {set.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRows(exclusionRowsToUsedRows(set.data));
                            success(`"${set.name}" yüklendi.`);
                            setShowExclusionLoadModal(false);
                          }}
                        >
                          Yükle
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (window.confirm(`"${set.name}" listesini silmek istediğinize emin misiniz?`)) {
                              const deleted = await deleteExclusionSet(set.id);
                              if (deleted) {
                                success("Liste silindi.");
                                setSavedExclusionSets(await getAllExclusionSets());
                              } else {
                                showToastError("Silme işlemi başarısız oldu.");
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowExclusionLoadModal(false)}>
                  Kapat
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
