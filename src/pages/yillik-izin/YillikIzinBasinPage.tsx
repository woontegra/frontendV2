/**
 * Basın işçileri — günlük gazete yıllık ücretli izin (v1 BasinIndependent ile uyumlu, v2 shell).
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
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { apiClient } from "@/utils/apiClient";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/shared/utils/exclusionStorage";
import type { ExcludedDay, SavedExclusionSet } from "@/shared/utils/exclusionStorage";
import { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { calculateGunlukGazeteIzin } from "./basinGunlukGazeteCalculations";

const NOTE_ITEMS: string[] = [
  "Günlük gazeteler için: Yıllık ücretli izin hakkı 20 iş günüdür.",
  "Süreli yayın yapan gazeteler için: Yıllık ücretli izin hakkı 15 iş günüdür.",
  "İzin süreleri çalışma süresine göre değişmez, sabit 15 veya 20 gündür.",
  "Basın İş Kanunu kapsamında çalışanlar için özel düzenlemeler geçerlidir.",
];

const SAVE_TYPE = "Yıllık Ücretli İzin";
const DOCUMENT_TITLE = "Mercan Danışmanlık | Basın Yıllık Ücretli İzin";
const REPORT_TITLE = "Yıllık Ücretli İzin";
const RECORD_TYPE = "yillik_izin_basin";
const REDIRECT_PATH = "/yillik-izin/basin";
const REPORT_CONTENT_ID = "report-content-yillik-basin";

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
    return {
      isValid: false,
      message: "Brüt izin tutarı hesaplanamadı. Lütfen çıplak brüt ücreti kontrol edin.",
    };
  return { isValid: true, message: "" };
}

export default function YillikIzinBasinPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle("yillik-izin");
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("yillik-basin");
  const loadedIdRef = useRef<string | null>(null);

  const [meslegeBaslangic, setMeslegeBaslangic] = useState("");
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brutUcret, setBrutUcret] = useState("");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(7));
  const [employerPayment, setEmployerPayment] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<SavedExclusionSet[]>([]);

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

  const isyeriCalismaLabel = useMemo(
    () => calcWorkPeriodBilirKisi(iseGiris, istenCikis).label,
    [iseGiris, istenCikis]
  );

  const meslekKidemiLabel = useMemo(
    () => calcWorkPeriodBilirKisi(meslegeBaslangic, istenCikis).label,
    [meslegeBaslangic, istenCikis]
  );

  const izinHesaplama = useMemo(
    () => calculateGunlukGazeteIzin(meslegeBaslangic, iseGiris, istenCikis),
    [meslegeBaslangic, iseGiris, istenCikis]
  );

  const totalEntitlement = izinHesaplama.izinGun || 0;

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
    const calculateFromBackend = async () => {
      try {
        const response = await apiClient("/api/yillik-izin/basin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            years: 0,
            brutUcret,
            usedRows: rows,
            exitYear: selectedYear,
            totalEntitlement,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errMsg = result?.error || result?.message || `HTTP ${response.status}`;
          showToastError(errMsg);
          return;
        }
        if (result.success && result.data) {
          setUsedTotal(result.data.usedTotal || 0);
          setRemainingDays(result.data.remainingDays || 0);
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

    if (totalEntitlement > 0 && brutUcret && toDays(brutUcret) > 0) {
      calculateFromBackend();
    } else {
      setUsedTotal(0);
      setRemainingDays(0);
      setBrutIzin(0);
      setSgk(0);
      setIssizlik(0);
      setGelirVergisi(0);
      setGelirVergisiDilimleri("");
      setDamgaVergisi(0);
      setNetIzin(0);
    }
  }, [totalEntitlement, brutUcret, rows, selectedYear, showToastError]);

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
        if (form?.meslegeBaslangic || form?.meslege_baslangic) {
          setMeslegeBaslangic(form.meslegeBaslangic || form.meslege_baslangic);
        }
        if (form?.iseGiris || form?.ise_giris) setIseGiris(form.iseGiris || form.ise_giris);
        if (form?.istenCikis || form?.isten_cikis) setIstenCikis(form.istenCikis || form.isten_cikis);
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

  const basinReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const employerPaymentNum = Number(String(employerPayment).replace(/\./g, "").replace(",", ".")) || 0;
    const mahsuplamaSonucu = Math.max(0, brutIzin - employerPaymentNum);
    const brutUcretNum = Number(String(brutUcret).replace(/\./g, "").replace(",", ".")) || 0;
    const validRows = rows.filter((r) => r.start && r.end && r.days);

    return {
      title: REPORT_TITLE,
      sections: { info: true, periodTable: false, grossToNet: true, mahsuplasma: true },
      infoRows: [
        {
          label: "Mesleğe Başlangıç Tarihi",
          value: meslegeBaslangic ? new Date(meslegeBaslangic).toLocaleDateString("tr-TR") : "-",
        },
        { label: "İşe Giriş Tarihi", value: iseGiris ? new Date(iseGiris).toLocaleDateString("tr-TR") : "-" },
        { label: "İşten Çıkış Tarihi", value: istenCikis ? new Date(istenCikis).toLocaleDateString("tr-TR") : "-" },
        { label: "Meslek Kıdemi", value: meslekKidemiLabel || "-" },
        { label: "Gazete Türü", value: "Günlük Gazete" },
        { label: "Brüt Ücret", value: brutUcret ? `${fmtLocal(brutUcretNum)}₺` : "-" },
      ],
      customSections: [
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
                    ({fmtLocal(brutUcretNum)}₺ / 30 × {remainingDays} gün)
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
          title: "Yıllık İzin Hak Edişi (Basın İşçileri - Günlük Gazete)",
          content: (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "8px", fontWeight: 600 }}>Dönem</th>
                  <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Gün/Hafta</th>
                </tr>
              </thead>
              <tbody>
                {izinHesaplama.y1 > 0 && izinHesaplama.h1 > 0 && (
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px" }}>{izinHesaplama.y1} yıl (İlk 5 yıl)</td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {izinHesaplama.h1} hafta
                    </td>
                  </tr>
                )}
                {izinHesaplama.y2 > 0 && izinHesaplama.h2 > 0 && (
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "8px" }}>{izinHesaplama.y2} yıl (5 yıl sonrası)</td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {izinHesaplama.h2} hafta
                    </td>
                  </tr>
                )}
                <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                  <td style={{ padding: "8px" }}>Toplam Hak Edilen</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {totalEntitlement} gün ({izinHesaplama.toplamHafta} hafta)
                  </td>
                </tr>
                <tr style={{ borderTop: "2px solid #e5e7eb" }}>
                  <td style={{ padding: "8px" }}>Kullanılan İzin</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {usedTotal} gün
                  </td>
                </tr>
                <tr style={{ fontWeight: 600, backgroundColor: "#dcfce7" }}>
                  <td style={{ padding: "8px" }}>Kalan İzin</td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "8px",
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
                title: "Kullanılan İzinler",
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
          {
            label: `Gelir Vergisi ${gelirVergisiDilimleri}`,
            value: `-${fmtLocal(gelirVergisi)}₺`,
            isDeduction: true,
          },
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
        netRow: { label: "Mahsuplaşma Sonucu", value: `${fmtLocal(mahsuplamaSonucu)}₺` },
      },
    };
  }, [
    meslegeBaslangic,
    iseGiris,
    istenCikis,
    meslekKidemiLabel,
    brutUcret,
    izinHesaplama,
    totalEntitlement,
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

    if (basinReportConfig.infoRows?.length) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: basinReportConfig.infoRows.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }

    const calcRows = [
      ["Kalan İzin Süresi", `${remainingDays} gün`],
      [
        "Günlük Ücret (Toplam/30)",
        `(${fmtLocal(Number(String(brutUcret || "0").replace(/\./g, "").replace(",", ".")) || 0)}₺ / 30 × ${remainingDays} gün)`,
      ],
      ["Yıllık Ücretli İzin Alacağı", `${fmtLocal(brutIzin)}₺`],
    ];
    const n1b = adaptToWordTable({ headers: ["Alan", "Değer"], rows: calcRows });
    sections.push({
      id: "yillik-ucretli-izin-hesaplama",
      title: "Yıllık Ücretli İzin Hesaplama",
      html: buildWordTable(n1b.headers, n1b.rows),
    });

    const hakRows: string[][] = [];
    if (izinHesaplama.y1 > 0 && izinHesaplama.h1 > 0)
      hakRows.push([`${izinHesaplama.y1} yıl (İlk 5 yıl)`, `${izinHesaplama.h1} hafta`]);
    if (izinHesaplama.y2 > 0 && izinHesaplama.h2 > 0)
      hakRows.push([`${izinHesaplama.y2} yıl (5 yıl sonrası)`, `${izinHesaplama.h2} hafta`]);
    hakRows.push(["Toplam Hak Edilen", `${totalEntitlement} gün (${izinHesaplama.toplamHafta} hafta)`]);
    hakRows.push(["Kullanılan İzin", `${usedTotal} gün`]);
    hakRows.push(["Kalan İzin", `${remainingDays} gün`]);
    const n2 = adaptToWordTable({ headers: ["Dönem", "Gün/Hafta"], rows: hakRows });
    sections.push({
      id: "yillik-izin-hak-edisi",
      title: "Yıllık İzin Hak Edişi (Basın İşçileri - Günlük Gazete)",
      html: buildWordTable(n2.headers, n2.rows),
    });

    const validRows = rows.filter((r) => r.start && r.end && r.days);
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
      sections.push({ id: "kullanilan-izinler", title: "Kullanılan İzinler", html: buildWordTable(n4.headers, n4.rows) });
    }

    const gnd = basinReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(n3.headers, n3.rows) });
    }

    const md = basinReportConfig.mahsuplasmaData;
    if (md?.rows) {
      const mahsupRows = [...md.rows, { label: md.netRow.label, value: md.netRow.value }];
      const n4m = adaptToWordTable(mahsupRows);
      sections.push({ id: "mahsuplasma", title: md.title || "Mahsuplaşma", html: buildWordTable(n4m.headers, n4m.rows) });
    }

    return sections;
  }, [basinReportConfig, izinHesaplama, totalEntitlement, usedTotal, remainingDays, brutUcret, brutIzin, rows]);

  const handleGazeteciTuruChange = useCallback(
    (value: string) => {
      if (value === "gunlukOlmayan") {
        navigate("/yillik-izin/basin/gunluk-olmayan");
      }
    },
    [navigate]
  );

  const handleSave = () => {
    try {
      const validation = validateSave({ iseGiris, istenCikis, remainingDays, brutIzin });
      if (!validation.isValid) {
        showToastError(validation.message);
        return;
      }

      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              meslegeBaslangic,
              iseGiris,
              istenCikis,
              brutUcret,
              rows,
              employerPayment,
            },
            results: {
              izinHesaplama,
              totalEntitlement,
              usedTotal,
              remainingDays,
              brutIzin,
              sgk,
              issizlik,
              gelirVergisi,
              gelirVergisiDilimleri,
              damgaVergisi,
              netIzin,
            },
          },
          hesaplama_tipi: SAVE_TYPE,
          brut_toplam: Number(brutIzin.toFixed(2)),
          net_toplam: Number(netIzin.toFixed(2)),
          ise_giris: iseGiris || null,
          isten_cikis: istenCikis || null,
          meslege_baslangic: meslegeBaslangic || null,
          eklentiler: { employer_payment: employerPayment, meslege_baslangic: meslegeBaslangic },
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: "/yillik-izin/basin/:id",
      });
    } catch {
      showToastError("Kayıt yapılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleNewCalculation = () => {
    const hasUnsavedChanges =
      meslegeBaslangic ||
      iseGiris ||
      istenCikis ||
      brutUcret ||
      rows.some((r) => r.start || r.end || r.days) ||
      employerPayment;
    if (hasUnsavedChanges && !window.confirm("Kaydedilmemiş veriler silinecek. Devam etmek istiyor musunuz?")) return;

    setMeslegeBaslangic("");
    setIseGiris("");
    setIstenCikis("");
    setBrutUcret("");
    setRows(createInitialRows(7));
    setEmployerPayment("");
    setCurrentRecordName(null);
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
        <ReportContentFromConfig config={basinReportConfig} />
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Basın İşçileri Yıllık İzin Hesaplama
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Günlük gazete — meslek kıdemine göre haftalık izin</p>
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
            <div>
              <label className={labelCls}>Gazeteci türü</label>
              <select
                defaultValue="gunluk"
                onChange={(e) => handleGazeteciTuruChange(e.target.value)}
                className={`${inputCls} mt-1`}
              >
                <option value="gunluk">Günlük gazete</option>
                <option value="gunlukOlmayan">Günlük olmayan gazete</option>
              </select>
            </div>

            {izinHesaplama.aciklama ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                {izinHesaplama.aciklama}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Mesleğe başlangıç tarihi</label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={meslegeBaslangic}
                  onChange={(e) => setMeslegeBaslangic(clampYearInput(e.target.value))}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls}>İşyerindeki çalışma süresi</label>
                <input readOnly value={isyeriCalismaLabel} className={`${inputCls} mt-1 bg-gray-100 dark:bg-gray-900/50`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>İşe giriş tarihi</label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={iseGiris}
                  onChange={(e) => setIseGiris(clampYearInput(e.target.value))}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    if (
                      newValue &&
                      /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                      istenCikis &&
                      /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)
                    ) {
                      const a = new Date(newValue);
                      const b = new Date(istenCikis);
                      if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && a > b) {
                        showToastError("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                      }
                    }
                  }}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls}>İşten çıkış tarihi</label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={istenCikis}
                  onChange={(e) => setIstenCikis(clampYearInput(e.target.value))}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    if (
                      newValue &&
                      /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                      iseGiris &&
                      /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)
                    ) {
                      const a = new Date(newValue);
                      const b = new Date(iseGiris);
                      if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && a < b) {
                        showToastError("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                      }
                    }
                  }}
                  className={`${inputCls} mt-1`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Meslekteki kıdem süresi</label>
                <input readOnly value={meslekKidemiLabel} className={`${inputCls} mt-1 bg-gray-100 dark:bg-gray-900/50`} />
              </div>
              <div>
                <label className={labelCls}>Çıplak brüt ücret</label>
                <input
                  value={brutUcret}
                  onChange={(e) => setBrutUcret(e.target.value)}
                  placeholder="Örn: 25.000,00"
                  className={`${inputCls} mt-1 ${
                    asgariUcretHatasi ? "border-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/20" : ""
                  }`}
                />
                {asgariUcretHatasi && <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi.mesaj}</p>}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/20">
              <div className={labelCls + " mb-2"}>Yıllık izin hakkı (günlük gazete)</div>
              <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                <div>
                  {izinHesaplama.y1 > 0 && (
                    <span>
                      {izinHesaplama.y1} yıl × 4 hafta = {izinHesaplama.h1} hafta
                    </span>
                  )}
                </div>
                <div>
                  {izinHesaplama.y2 > 0 && (
                    <span>
                      {izinHesaplama.y2} yıl × 6 hafta = {izinHesaplama.h2} hafta
                    </span>
                  )}
                </div>
                <div className="font-semibold pt-2 border-t border-gray-200 dark:border-gray-600">
                  Toplam: {izinHesaplama.toplamHafta} hafta ({totalEntitlement} gün)
                </div>
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
                                onChange={(e) => setRow(r.id, { start: clampYearInput(e.target.value) })}
                                className={tableDateCls}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={r.end}
                                onChange={(e) => setRow(r.id, { end: clampYearInput(e.target.value) })}
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
                          <td className="py-2 font-semibold">{calculateUsedTotal(rows)} gün</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <button type="button" onClick={addRow} className="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    + Satır ekle
                  </button>
                  <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Kalan izin hakkı: {remainingDays} gün
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/25 dark:to-indigo-950/20 border-l-4 border-purple-500">
              <h3 className="text-base font-bold text-purple-900 dark:text-purple-300 mb-3">Yıllık ücretli izin hesaplama</h3>
              <div className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                <div className="flex justify-between gap-2 border-b border-purple-200/50 dark:border-purple-900/40 pb-2">
                  <span>Kalan izin süresi</span>
                  <span className="font-semibold">{remainingDays} gün</span>
                </div>
                <div className="flex justify-between gap-2 border-b border-purple-200/50 dark:border-purple-900/40 pb-2">
                  <span>Günlük ücret (toplam/30)</span>
                  <span className="font-medium text-right">
                    ({fmt(toDays(brutUcret))}₺ / 30 × {remainingDays} gün)
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="font-semibold">Yıllık ücretli izin alacağı</span>
                  <span className="font-bold text-lg text-purple-700 dark:text-purple-400">{fmt(brutIzin)}₺</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-l-4 border-amber-500">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-300 mb-3">Brütten nete çevir</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Brüt yıllık izin ücreti", brutIzin, false],
                  ["SGK primi (%14)", -sgk, true],
                  ["İşsizlik primi (%1)", -issizlik, true],
                  [`Gelir vergisi ${gelirVergisiDilimleri}`, -gelirVergisi, true],
                  ["Damga vergisi (binde 7,59)", -damgaVergisi, true],
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
                  <span className="font-bold text-green-700 dark:text-green-400">{fmt(netIzin)}₺</span>
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
          title: `Basın ${REPORT_TITLE} Rapor`,
          copyTargetId: "basin-yillik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #basin-yillik-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #basin-yillik-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="basin-yillik-word-copy">
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
          onPdf: () => downloadPdfFromDOM(`Basın ${REPORT_TITLE} Rapor`, REPORT_CONTENT_ID),
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
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan izinleri kaydet</h3>
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
              <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kayıtlı kullanılan izinler</h3>
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
