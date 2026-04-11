/**
 * Mevsimlik işçi — yıllık ücretli izin (v1 MevsimIndependent + standart API gövdesi, `/api/yillik-izin/mevsim`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
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
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { apiClient } from "@/utils/apiClient";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/shared/utils/exclusionStorage";
import type { ExcludedDay } from "@/shared/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";

const NOTE_ITEMS: string[] = [
  "Mevsimlik işçilerin yıllık izin hakları çalışma süresine göre belirlenir.",
  "Sezon sonunda işten ayrılanlarda izin ücreti ödenmesi gerekir.",
  "Çoklu sezon / dönem varsa hizmet süresi genelde ilk işe giriş ile son işten çıkış arasında hesaplanır.",
];

const SAVE_TYPE = "Yıllık Ücretli İzin";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Mevsimlik İşçi Yıllık Ücretli İzin";
const REPORT_TITLE = "Yıllık Ücretli İzin (Mevsimlik)";
const RECORD_TYPE = "yillik_izin_mevsim";
const REDIRECT_PATH = "/yillik-izin/mevsim";
const REPORT_CONTENT_ID = "report-content-yillik-mevsim";

type WorkPeriod = { id: string; iseGiris: string; istenCikis: string };
type UsedRow = { id: string; start: string; end: string; days: string };
type Breakdown = {
  y1: number;
  y2: number;
  y3: number;
  d1: number;
  d2: number;
  d3: number;
  total: number;
  daysPerYear1?: number;
  daysPerYear2?: number;
  daysPerYear3?: number;
};

const createEmptyRow = (): UsedRow => ({
  id: Math.random().toString(36).slice(2),
  start: "",
  end: "",
  days: "",
});
const createInitialRows = (count = 7): UsedRow[] => Array.from({ length: count }, () => createEmptyRow());
const toDays = (value: string) => Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;
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
  if (!data.length) return createInitialRows(7);
  return data.map((row) => ({
    id: row.id || Math.random().toString(36).slice(2),
    start: row.start || "",
    end: row.end || "",
    days: row.days != null ? String(row.days) : "",
  }));
}

export default function YillikIzinMevsimPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle("yillik-izin");
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("yillik-mevsimlik");
  const loadedIdRef = useRef<string | null>(null);

  const [workPeriods, setWorkPeriods] = useState<WorkPeriod[]>([
    { id: "1", iseGiris: "", istenCikis: "" },
  ]);
  const iseGiris = workPeriods[0]?.iseGiris || "";
  const istenCikis = workPeriods[workPeriods.length - 1]?.istenCikis || "";

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
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(7));
  const [employerPayment, setEmployerPayment] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);

  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<
    { id: number; name: string; data: ExcludedDay[]; createdAt: string }[]
  >([]);

  const [is18Or50, setIs18Or50] = useState(false);
  const [isUnderground, setIsUnderground] = useState(false);

  const [breakdown, setBreakdown] = useState<Breakdown>({
    y1: 0,
    y2: 0,
    y3: 0,
    d1: 0,
    d2: 0,
    d3: 0,
    total: 0,
  });
  const [usedTotal, setUsedTotal] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (rowId: string, patch: Partial<UsedRow>) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(iseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [iseGiris, istenCikis]);

  const selectedYear = useMemo(() => {
    if (istenCikis) {
      const year = new Date(istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) return year;
    }
    return new Date().getFullYear();
  }, [istenCikis]);

  const asgariUcretHatasi = useMemo(() => {
    if (!istenCikis || !brutUcret) return null;
    const girilenUcret = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
    if (isNaN(girilenUcret) || girilenUcret <= 0) return null;
    const asgariUcret = getAsgariUcretByDate(istenCikis);
    if (!asgariUcret) return null;
    if (girilenUcret < asgariUcret) {
      const yil = new Date(istenCikis).getFullYear();
      return {
        mesaj: `Girilen ücret, ${yil} yılı asgari brüt ücretinden düşük olamaz (${asgariUcret.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺).`,
        asgariUcret,
      };
    }
    return null;
  }, [istenCikis, brutUcret]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        if (!iseGiris || !istenCikis) {
          setBreakdown({ y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 });
          setUsedTotal(0);
          setRemainingDays(0);
          setBrutIzin(0);
          setSgk(0);
          setIssizlik(0);
          setGelirVergisi(0);
          setGelirVergisiDilimleri("");
          setDamgaVergisi(0);
          setNetIzin(0);
          return;
        }

        const requestBody = {
          years: diff.yil,
          brutUcret,
          usedRows: rows,
          exitYear: selectedYear,
          is18Or50,
          isUnderground,
        };

        const response = await apiClient("/api/yillik-izin/mevsim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) errorMessage = errorData.error;
          } catch {
            /* ignore */
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setBreakdown(
            result.data.breakdown || { y1: 0, y2: 0, y3: 0, d1: 0, d2: 0, d3: 0, total: 0 }
          );
          setUsedTotal(result.data.usedTotal || 0);
          setRemainingDays(result.data.remainingDays || 0);
          setBrutIzin(result.data.brutIzin || 0);
          setSgk(result.data.sgk || 0);
          setIssizlik(result.data.issizlik || 0);
          setGelirVergisi(result.data.gelirVergisi || 0);
          setGelirVergisiDilimleri(result.data.gelirVergisiDilimleri || "");
          setDamgaVergisi(result.data.damgaVergisi || 0);
          setNetIzin(result.data.netIzin || 0);
        } else if (result.error) {
          showToastError(result.error);
        }
      } catch (err) {
        console.error("Yıllık izin hesaplama hatası:", err);
        if (iseGiris && istenCikis && brutUcret) {
          showToastError(`Hesaplama hatası: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
        }
      }
    };
    run();
  }, [diff.yil, brutUcret, rows, selectedYear, is18Or50, isUnderground, iseGiris, istenCikis, showToastError]);

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
        if (Array.isArray(form?.workPeriods) && form.workPeriods.length > 0) {
          setWorkPeriods(
            form.workPeriods.map((p: WorkPeriod) => ({
              id: p.id || Math.random().toString(36).slice(2),
              iseGiris: p.iseGiris || "",
              istenCikis: p.istenCikis || "",
            }))
          );
        } else {
          const ig = form?.iseGiris || form?.ise_giris;
          const ic = form?.istenCikis || form?.isten_cikis;
          if (ig || ic) {
            setWorkPeriods([{ id: "1", iseGiris: ig || "", istenCikis: ic || "" }]);
          }
        }
        if (form?.brutUcret != null || form?.brut_ucret != null)
          setBrutUcret(String(form.brutUcret ?? form.brut_ucret ?? ""));
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
        if (typeof form?.is18Or50 === "boolean") setIs18Or50(form.is18Or50);
        if (typeof form?.isUnderground === "boolean") setIsUnderground(form.isUnderground);
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

  const yillikIzinReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const validRows = rows.filter((r) => r.start && r.end && r.days);
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, "").replace(",", ".")) || 0;
    const mahsuplamaSonucu = Math.max(0, brutIzin - employerPaymentNum);
    const dp1 = breakdown.daysPerYear1 ?? 14;
    const dp2 = breakdown.daysPerYear2 ?? 20;
    const dp3 = breakdown.daysPerYear3 ?? 26;

    const workPeriodsSummary = workPeriods
      .map((wp) => {
        if (!wp.iseGiris || !wp.istenCikis) return null;
        return {
          start: new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
          end: new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
        };
      })
      .filter(Boolean) as { start: string; end: string }[];

    return {
      title: REPORT_TITLE,
      sections: {
        info: true,
        periodTable: false,
        grossToNet: true,
        mahsuplasma: true,
      },
      infoRows: [
        { label: "İşe Giriş Tarihi (ilk dönem)", value: iseGiris ? new Date(iseGiris).toLocaleDateString("tr-TR") : "-" },
        {
          label: "İşten Çıkış Tarihi (son dönem)",
          value: istenCikis ? new Date(istenCikis).toLocaleDateString("tr-TR") : "-",
        },
        { label: "Çalışma Süresi", value: diff.label || "-" },
        {
          label: "Brüt Ücret",
          value: brutUcret ? `${fmtLocal(Number(String(brutUcret).replace(/\./g, "").replace(",", ".")))}₺` : "-",
        },
      ],
      customSections: [
        {
          title: "Çalışma Dönemleri (Mevsimlik)",
          content: (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "16px",
                border: "1px solid #999",
                fontSize: "10px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "5px 8px",
                      fontWeight: 600,
                      border: "1px solid #999",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Başlangıç
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "5px 8px",
                      fontWeight: 600,
                      border: "1px solid #999",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Bitiş
                  </th>
                </tr>
              </thead>
              <tbody>
                {workPeriodsSummary.map((wp, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "5px 8px", border: "1px solid #999" }}>{wp.start}</td>
                    <td style={{ padding: "5px 8px", border: "1px solid #999" }}>{wp.end}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
          condition: workPeriodsSummary.length > 0,
        },
        {
          title: "Yıllık Ücretli İzin Hesaplama",
          content: (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "16px",
                border: "1px solid #999",
                fontSize: "10px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "5px 8px",
                      fontWeight: 600,
                      border: "1px solid #999",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Alan
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      fontWeight: 600,
                      border: "1px solid #999",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Değer
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 8px", border: "1px solid #999" }}>Kalan İzin Süresi</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      border: "1px solid #999",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {remainingDays} gün
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "5px 8px", border: "1px solid #999" }}>Günlük Ücret (Toplam/30)</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      border: "1px solid #999",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    (
                    {fmtLocal(Number(String(brutUcret).replace(/\./g, "").replace(",", ".")) || 0)}₺ / 30 ×{" "}
                    {remainingDays} gün)
                  </td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                  <td style={{ padding: "5px 8px", border: "1px solid #999" }}>Yıllık Ücretli İzin Alacağı</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      border: "1px solid #999",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtLocal(brutIzin)}₺
                  </td>
                </tr>
              </tbody>
            </table>
          ),
        },
        {
          title: "Yıllık İzin Hak Edişi (Mevsimlik İşçiler)",
          content: (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "16px",
                border: "1px solid #999",
                fontSize: "10px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "5px 8px",
                      fontWeight: 600,
                      border: "1px solid #999",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Dönem
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      fontWeight: 600,
                      border: "1px solid #999",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    Gün Sayısı
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.y1 > 0 && breakdown.d1 > 0 && (
                  <tr>
                    <td style={{ padding: "5px 8px", border: "1px solid #999" }}>{breakdown.y1} yıl (1-5 yıl)</td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "5px 8px",
                        border: "1px solid #999",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {breakdown.y1} yıl × {dp1} gün = {breakdown.d1} gün
                    </td>
                  </tr>
                )}
                {breakdown.y2 > 0 && breakdown.d2 > 0 && (
                  <tr>
                    <td style={{ padding: "5px 8px", border: "1px solid #999" }}>{breakdown.y2} yıl (5-15 yıl)</td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "5px 8px",
                        border: "1px solid #999",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {breakdown.y2} yıl × {dp2} gün = {breakdown.d2} gün
                    </td>
                  </tr>
                )}
                {breakdown.y3 > 0 && breakdown.d3 > 0 && (
                  <tr>
                    <td style={{ padding: "5px 8px", border: "1px solid #999" }}>{breakdown.y3} yıl (15+ yıl)</td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "5px 8px",
                        border: "1px solid #999",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {breakdown.y3} yıl × {dp3} gün = {breakdown.d3} gün
                    </td>
                  </tr>
                )}
                <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                  <td style={{ padding: "5px 8px", border: "1px solid #999" }}>Toplam Hak Edilen</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      border: "1px solid #999",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {breakdown.total} gün
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "5px 8px", border: "1px solid #999" }}>Kullanılan İzin</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      border: "1px solid #999",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {usedTotal} gün
                  </td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: "#dcfce7" }}>
                  <td style={{ padding: "5px 8px", border: "1px solid #999" }}>Kalan İzin</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "5px 8px",
                      border: "1px solid #999",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {remainingDays} gün
                  </td>
                </tr>
              </tbody>
            </table>
          ),
        },
        ...(validRows.length > 0
          ? [
              {
                title: "Dışlanabilir Yıllar (Kullanılan İzinler)",
                content: (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginBottom: "16px",
                      border: "1px solid #999",
                      fontSize: "10px",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "5px 8px",
                            fontWeight: 600,
                            border: "1px solid #999",
                            backgroundColor: "#f9f9f9",
                          }}
                        >
                          Başlangıç Tarihi
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "5px 8px",
                            fontWeight: 600,
                            border: "1px solid #999",
                            backgroundColor: "#f9f9f9",
                          }}
                        >
                          Bitiş Tarihi
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "5px 8px",
                            fontWeight: 600,
                            border: "1px solid #999",
                            backgroundColor: "#f9f9f9",
                          }}
                        >
                          Gün Sayısı
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: "5px 8px", border: "1px solid #999" }}>
                            {row.start ? new Date(row.start).toLocaleDateString("tr-TR") : "-"}
                          </td>
                          <td style={{ padding: "5px 8px", border: "1px solid #999" }}>
                            {row.end ? new Date(row.end).toLocaleDateString("tr-TR") : "-"}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              padding: "5px 8px",
                              border: "1px solid #999",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {row.days || "0"} gün
                          </td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                        <td colSpan={2} style={{ padding: "5px 8px", border: "1px solid #999" }}>
                          Toplam Kullanılan
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "5px 8px",
                            border: "1px solid #999",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {usedTotal} gün
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ),
              },
            ]
          : []),
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutIzin)}₺` },
          { label: "SGK İşçi Primi (%14)", value: `-${fmtLocal(sgk)}₺`, isDeduction: true },
          { label: "İşsizlik Sigortası Primi (%1)", value: `-${fmtLocal(issizlik)}₺`, isDeduction: true },
          { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtLocal(gelirVergisi)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)}₺`, isDeduction: true },
          { label: "Net Yıllık İzin Alacağı", value: `${fmtLocal(netIzin)}₺`, isNet: true },
        ],
      },
      mahsuplasmaData: {
        title: "Mahsuplaşma",
        rows: [
          { label: "Brüt Yıllık İzin Alacağı", value: `${fmtLocal(brutIzin)}₺` },
          { label: "İşveren Ödemesi", value: `-${fmtLocal(employerPaymentNum)}₺`, isDeduction: true },
        ],
        netRow: {
          label: "Mahsuplaşma Sonucu",
          value: `${fmtLocal(mahsuplamaSonucu)}₺`,
        },
      },
    };
  }, [
    workPeriods,
    iseGiris,
    istenCikis,
    diff,
    brutUcret,
    breakdown,
    usedTotal,
    remainingDays,
    brutIzin,
    sgk,
    issizlik,
    gelirVergisi,
    gelirVergisiDilimleri,
    damgaVergisi,
    netIzin,
    employerPayment,
    rows,
  ]);

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const validRows = rows.filter((r) => r.start && r.end && r.days);
    const dp1 = breakdown.daysPerYear1 ?? 14;
    const dp2 = breakdown.daysPerYear2 ?? 20;
    const dp3 = breakdown.daysPerYear3 ?? 26;

    if (yillikIzinReportConfig.infoRows?.length) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: yillikIzinReportConfig.infoRows.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const wpWordRows = workPeriods
      .filter((wp) => wp.iseGiris && wp.istenCikis)
      .map((wp) => [
        new Date(wp.iseGiris).toLocaleDateString("tr-TR"),
        new Date(wp.istenCikis).toLocaleDateString("tr-TR"),
      ]);
    if (wpWordRows.length > 0) {
      const nwp = adaptToWordTable({ headers: ["Başlangıç", "Bitiş"], rows: wpWordRows });
      sections.push({
        id: "calisma-donemleri-mevsim",
        title: "Çalışma Dönemleri (Mevsimlik)",
        html: buildWordTable(nwp.headers, nwp.rows),
      });
    }

    const calcRows = [
      ["Kalan İzin Süresi", `${remainingDays} gün`],
      [
        "Günlük Ücret (Toplam/30)",
        `(${fmtLocal(Number(String(brutUcret).replace(/\./g, "").replace(",", ".")) || 0)}₺ / 30 × ${remainingDays} gün)`,
      ],
      ["Yıllık Ücretli İzin Alacağı", `${fmtLocal(brutIzin)}₺`],
    ];
    const n2 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: calcRows });
    sections.push({
      id: "yillik-izin-hesaplama",
      title: "Yıllık Ücretli İzin Hesaplama",
      html: buildWordTable(n2.headers, n2.rows),
    });

    const hakRows: string[][] = [];
    if (breakdown.y1 > 0 && breakdown.d1 > 0)
      hakRows.push([`${breakdown.y1} yıl (1-5 yıl)`, `${breakdown.y1} yıl × ${dp1} gün = ${breakdown.d1} gün`]);
    if (breakdown.y2 > 0 && breakdown.d2 > 0)
      hakRows.push([`${breakdown.y2} yıl (5-15 yıl)`, `${breakdown.y2} yıl × ${dp2} gün = ${breakdown.d2} gün`]);
    if (breakdown.y3 > 0 && breakdown.d3 > 0)
      hakRows.push([`${breakdown.y3} yıl (15+ yıl)`, `${breakdown.y3} yıl × ${dp3} gün = ${breakdown.d3} gün`]);
    hakRows.push(["Toplam Hak Edilen", `${breakdown.total} gün`]);
    hakRows.push(["Kullanılan İzin", `${usedTotal} gün`]);
    hakRows.push(["Kalan İzin", `${remainingDays} gün`]);
    const n3 = adaptToWordTable({ headers: ["Dönem", "Gün Sayısı"], rows: hakRows });
    sections.push({
      id: "yillik-izin-hak-edisi",
      title: "Yıllık İzin Hak Edişi (Mevsimlik İşçiler)",
      html: buildWordTable(n3.headers, n3.rows),
    });

    if (validRows.length > 0) {
      const exclRows = validRows.map((r) => [
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
        title: "Dışlanabilir Yıllar (Kullanılan İzinler)",
        html: buildWordTable(n4.headers, n4.rows),
      });
    }

    const gnd = yillikIzinReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n5 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n5.headers, n5.rows) });
    }

    const md = yillikIzinReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n6 = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n6.headers, n6.rows) });
    }

    return sections;
  }, [yillikIzinReportConfig, workPeriods, rows, remainingDays, brutUcret, brutIzin, breakdown, usedTotal, employerPayment]);

  const handleSave = () => {
    try {
      if (!iseGiris || !istenCikis) {
        showToastError("Lütfen işe giriş ve çıkış tarihlerini girin");
        return;
      }
      if (remainingDays == null || remainingDays < 0) {
        showToastError("Kalan izin günü hesaplanamadı");
        return;
      }
      const ucretValue = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
      if (!brutUcret || isNaN(ucretValue) || ucretValue <= 0) {
        showToastError("Hesaplamayı kaydetmek için brüt ücret girmeniz gerekiyor");
        return;
      }

      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              workPeriods,
              iseGiris,
              istenCikis,
              brutUcret,
              rows,
              employerPayment,
              is18Or50,
              isUnderground,
            },
            results: {
              breakdown,
              usedTotal,
              remainingDays,
              brutIzin,
              sgk,
              issizlik,
              gelirVergisi,
              damgaVergisi,
              netIzin,
            },
          },
          hesaplama_tipi: SAVE_TYPE,
          brut_toplam: Number(brutIzin.toFixed(2)),
          net_toplam: Number(netIzin.toFixed(2)),
          ise_giris: iseGiris || null,
          isten_cikis: istenCikis || null,
          eklentiler: { employer_payment: employerPayment },
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: "/yillik-izin/mevsim/:id",
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
    setRows(createInitialRows(7));
    setEmployerPayment("");
    setCurrentRecordName(null);
    setIs18Or50(false);
    setIsUnderground(false);
    loadedIdRef.current = null;
    navigate(REDIRECT_PATH, { replace: true });
  };

  const clampYearInput = (value: string) => {
    if (!value || !value.includes("-")) return value;
    const parts = value.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].substring(0, 4);
      return parts.join("-");
    }
    return value;
  };

  const accent = pageStyle.color || "#5E35B1";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 pb-24 lg:pb-8">
      <div
        id={REPORT_CONTENT_ID}
        style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", width: "16cm", zIndex: -1 }}
        aria-hidden="true"
      >
        <ReportContentFromConfig config={yillikIzinReportConfig} />
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Mevsimlik İşçi Yıllık İzin Hesaplama
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Çoklu sezon — hizmet süresi ilk giriş ile son çıkış arasında
            </p>
          </div>
          {videoLink && (
            <Button
              type="button"
              onClick={() => window.open(videoLink, "_blank")}
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400"
            >
              <Youtube className="h-4 w-4" />
              Kullanım Videosu
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
          <div className="p-4 sm:p-6 space-y-5">
            <div className="space-y-3">
              <div className={labelCls}>Çalışma dönemleri (sezonlar)</div>
              {workPeriods.map((period, index) => (
                <div
                  key={period.id}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Dönem {index + 1}
                    </span>
                    {workPeriods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorkPeriod(period.id)}
                        className="text-red-600 dark:text-red-400 hover:opacity-80 p-1"
                        title="Dönemi sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>İşe giriş</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={period.iseGiris}
                        onChange={(e) =>
                          updateWorkPeriod(period.id, { iseGiris: clampYearInput(e.target.value) })
                        }
                        onBlur={(e) => {
                          const newValue = e.target.value;
                          if (
                            newValue &&
                            /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                            period.istenCikis &&
                            /^\d{4}-\d{2}-\d{2}$/.test(period.istenCikis)
                          ) {
                            const a = new Date(newValue);
                            const b = new Date(period.istenCikis);
                            if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && a > b) {
                              showToastError("Giriş tarihi, çıkış tarihinden sonra olamaz.");
                            }
                          }
                        }}
                        className={`${inputCls} mt-1`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>İşten çıkış</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={period.istenCikis}
                        onChange={(e) =>
                          updateWorkPeriod(period.id, { istenCikis: clampYearInput(e.target.value) })
                        }
                        onBlur={(e) => {
                          const newValue = e.target.value;
                          if (
                            newValue &&
                            /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                            period.iseGiris &&
                            /^\d{4}-\d{2}-\d{2}$/.test(period.iseGiris)
                          ) {
                            const a = new Date(newValue);
                            const b = new Date(period.iseGiris);
                            if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && a < b) {
                              showToastError("Çıkış tarihi, giriş tarihinden önce olamaz.");
                            }
                          }
                        }}
                        className={`${inputCls} mt-1`}
                      />
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
                <label className={labelCls}>Çalışma süresi (ilk giriş — son çıkış)</label>
                <input readOnly value={diff.label} className={`${inputCls} mt-1 bg-gray-50 dark:bg-gray-900/40`} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Çıplak Brüt Ücret</label>
              <input
                value={brutUcret}
                onChange={(e) => setBrutUcret(e.target.value)}
                placeholder="Örn: 25.000,00"
                className={`mt-1 ${inputCls} ${
                  asgariUcretHatasi ? "border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-950/20" : ""
                }`}
              />
              {asgariUcretHatasi && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">{asgariUcretHatasi.mesaj}</p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={is18Or50}
                  onChange={(e) => setIs18Or50(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                18 yaş altı / 50 yaş üstü
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isUnderground}
                  onChange={(e) => setIsUnderground(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Yeraltı İşçisi
              </label>
            </div>

            <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Yıllık İzin Hesaplama</div>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <div>
                  {breakdown.daysPerYear1 ?? 14} × {breakdown.y1} ={" "}
                  <span className="font-semibold">{breakdown.d1} gün</span>
                </div>
                <div>
                  {breakdown.daysPerYear2 ?? 20} × {breakdown.y2} ={" "}
                  <span className="font-semibold">{breakdown.d2} gün</span>
                </div>
                <div>
                  {breakdown.daysPerYear3 ?? 26} × {breakdown.y3} ={" "}
                  <span className="font-semibold">{breakdown.d3} gün</span>
                </div>
                <div className="mt-2 border-t border-gray-200 dark:border-gray-600 pt-2 font-semibold">
                  Toplam = {breakdown.total} gün
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                Toplam Yıllık İzin Hakkı: {breakdown.total} Gün
              </p>
            </div>

            <div className="border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900/20">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setAccordionOpen((s) => !s)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
                >
                  Kullanılan İzinleri Dışla
                  <svg
                    className={`w-4 h-4 transition-transform ${accordionOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const sets = await getAllExclusionSets();
                      const setsWithCalculatedDays = sets.map((set) => ({
                        ...set,
                        data: set.data.map((row) => {
                          if (row.start && row.end && (row.days == null || Number(row.days) === 0)) {
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
                    }}
                  >
                    İçe Aktar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRows(createInitialRows(7))}
                    disabled={rows.every((r) => !r.start && !r.end && !r.days)}
                    className="text-red-600 dark:text-red-400"
                  >
                    Tümünü Sil
                  </Button>
                </div>
              </div>
              {accordionOpen && (
                <div className="px-3 pb-3 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-2 font-semibold">İzin Başlangıç</th>
                        <th className="py-2 pr-2 font-semibold">İzin Bitiş</th>
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
                              onChange={(e) => setRow(r.id, { start: clampYearInput(e.target.value) })}
                              onBlur={(e) => {
                                const nv = e.target.value;
                                if (nv && /^\d{4}-\d{2}-\d{2}$/.test(nv) && r.end && /^\d{4}-\d{2}-\d{2}$/.test(r.end)) {
                                  const a = new Date(nv);
                                  const b = new Date(r.end);
                                  if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && a > b) {
                                    showToastError("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                                  }
                                }
                              }}
                              className={tableDateCls}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="date"
                              max="9999-12-31"
                              value={r.end}
                              onChange={(e) => setRow(r.id, { end: clampYearInput(e.target.value) })}
                              onBlur={(e) => {
                                const nv = e.target.value;
                                if (nv && /^\d{4}-\d{2}-\d{2}$/.test(nv) && r.start && /^\d{4}-\d{2}-\d{2}$/.test(r.start)) {
                                  const a = new Date(nv);
                                  const b = new Date(r.start);
                                  if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && a < b) {
                                    showToastError("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                                  }
                                }
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
                          TOPLAM
                        </td>
                        <td className="py-2 font-semibold tabular-nums">{usedTotal} gün</td>
                      </tr>
                    </tfoot>
                  </table>
                  <button
                    type="button"
                    onClick={addRow}
                    className="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400"
                  >
                    + Satır Ekle
                  </button>
                  <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Kalan İzin Hakkı: {remainingDays} Gün
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/20">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Yıllık izin hak edişi (mevsimlik)
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {breakdown.y1 > 0 && breakdown.d1 > 0 && (
                    <tr>
                      <td className="py-2">{breakdown.y1} yıl (1-5 yıl)</td>
                      <td className="py-2 text-right tabular-nums">
                        {breakdown.y1} yıl × {breakdown.daysPerYear1 ?? 14} gün = {breakdown.d1} gün
                      </td>
                    </tr>
                  )}
                  {breakdown.y2 > 0 && breakdown.d2 > 0 && (
                    <tr>
                      <td className="py-2">{breakdown.y2} yıl (5-15 yıl)</td>
                      <td className="py-2 text-right tabular-nums">
                        {breakdown.y2} yıl × {breakdown.daysPerYear2 ?? 20} gün = {breakdown.d2} gün
                      </td>
                    </tr>
                  )}
                  {breakdown.y3 > 0 && breakdown.d3 > 0 && (
                    <tr>
                      <td className="py-2">{breakdown.y3} yıl (15+ yıl)</td>
                      <td className="py-2 text-right tabular-nums">
                        {breakdown.y3} yıl × {breakdown.daysPerYear3 ?? 26} gün = {breakdown.d3} gün
                      </td>
                    </tr>
                  )}
                  <tr className="font-semibold bg-gray-100 dark:bg-gray-800/80">
                    <td className="py-2">Toplam Hak Edilen</td>
                    <td className="py-2 text-right tabular-nums">{breakdown.total} gün</td>
                  </tr>
                  <tr>
                    <td className="py-2">Kullanılan İzin</td>
                    <td className="py-2 text-right tabular-nums">{usedTotal} gün</td>
                  </tr>
                  <tr className="font-semibold bg-green-100/80 dark:bg-green-900/30">
                    <td className="py-2">Kalan İzin</td>
                    <td className="py-2 text-right tabular-nums">{remainingDays} gün</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/25 dark:to-indigo-950/25 border-l-4 border-purple-500">
              <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-3">Yıllık Ücretli İzin Hesaplama</h3>
              <div className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                <div className="flex justify-between gap-2 border-b border-purple-200/60 dark:border-purple-800/40 pb-2">
                  <span>Kalan İzin Süresi</span>
                  <span className="font-semibold tabular-nums">{remainingDays} gün</span>
                </div>
                <div className="flex justify-between gap-2 border-b border-purple-200/60 dark:border-purple-800/40 pb-2">
                  <span>Günlük Ücret (Toplam/30)</span>
                  <span className="font-medium text-right text-xs sm:text-sm">
                    ({fmt(Number(String(brutUcret).replace(/\./g, "").replace(",", ".")) || 0)}₺ / 30 × {remainingDays}{" "}
                    gün)
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="font-semibold">Yıllık Ücretli İzin Alacağı</span>
                  <span className="font-bold text-purple-700 dark:text-purple-400">{fmt(brutIzin)}₺</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-l-4 border-amber-500">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-3">Brütten Nete Çevir</h3>
              <div className="text-xs space-y-2 text-gray-800 dark:text-gray-200">
                <div className="flex justify-between">
                  <span>Brüt Yıllık İzin Ücreti</span>
                  <span className="font-semibold">{fmt(brutIzin)}₺</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>SGK Primi (%14)</span>
                  <span>-{fmt(sgk)}₺</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>İşsizlik Primi (%1)</span>
                  <span>-{fmt(issizlik)}₺</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>Gelir Vergisi {gelirVergisiDilimleri}</span>
                  <span>-{fmt(gelirVergisi)}₺</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>Damga Vergisi (Binde 7,59)</span>
                  <span>-{fmt(damgaVergisi)}₺</span>
                </div>
                <div className="flex justify-between pt-2 font-semibold text-green-700 dark:text-green-400">
                  <span>Net Yıllık İzin Ücreti</span>
                  <span>{fmt(netIzin)}₺</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/40">
                <label className="text-xs text-gray-700 dark:text-gray-300 block mb-1">
                  Davalı tarafından yıllık ücretli izin bedeli adı altında yapılan ödeme (mahsup)
                </label>
                <input
                  value={employerPayment}
                  onChange={(e) => setEmployerPayment(e.target.value)}
                  placeholder="Örn: 10.000"
                  className={`${inputCls} max-w-xs text-right`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Notlar</h3>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">Not: Mevsimlik işçi — yıllık izin</p>
          <ol className="space-y-2 text-[11px] font-light text-gray-500 dark:text-gray-400 list-decimal pl-4">
            {NOTE_ITEMS.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ol>
        </div>
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNewCalculation }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : effectiveId ? "Güncelle" : "Kaydet"}
        previewButton={{
          title: `${REPORT_TITLE} Rapor`,
          copyTargetId: "mevsim-yillik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #mevsim-yillik-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #mevsim-yillik-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="mevsim-yillik-word-copy">
                {wordTableSections.map((sec) => (
                  <div key={sec.id} className="report-section-copy report-section" data-section={sec.id}>
                    <div className="section-header">
                      <span className="section-title">{sec.title}</span>
                      <button type="button" className="copy-icon-btn" onClick={() => copySectionForWord(sec.id)} title="Word'e kopyala">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(`${REPORT_TITLE} Rapor`, REPORT_CONTENT_ID),
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
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan İzinleri Kaydet</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste Adı</label>
                <input
                  type="text"
                  placeholder="Örn: Davacı A - Kullanılan İzinler"
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
                      success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`);
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
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kayıtlı Kullanılan İzinler</h3>
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
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{set.name}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRows(exclusionRowsToUsedRows(set.data));
                            success(`"${set.name}" yüklendi!`);
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
                                const updatedSets = await getAllExclusionSets();
                                setSavedExclusionSets(updatedSets);
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
