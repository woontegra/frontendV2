/**
 * İş Arama İzni Ücreti — v2 (Kidem form kabuğu, v1 API ve düşüm mantığı).
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Youtube, Copy, Plus, Trash2 } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { apiClient } from "@/utils/apiClient";
import KidemTazminatiForm from "@/pages/kidem-tazminati/KidemTazminatiForm";
import EklentiModal from "@/pages/kidem-tazminati/EklentiModal";
import type { ExtraItem } from "@/pages/kidem-tazminati/contract";
import { ReportContentFromConfig } from "@/components/report";
import type { ReportConfig } from "@/components/report";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { loadSavedCase } from "./api";

const RECORD_TYPE = "is_arama_izni";
const REDIRECT_PATH = "/is-arama-izni-ucreti";
const PREVIEW_TITLE = "İş Arama İzni Ücreti Rapor";
const PAGE_HEADING = "İş Arama İzni Ücreti";

const NOTE_ITEMS: string[] = [
  "İş Arama İzni Ücreti",
  "",
  "• İşveren tarafından süreli fesihte, ihbar öneli süresince işçiye günde en az 2 saat iş arama izni verilmesi zorunludur.",
  "",
  "• İşçiye iş arama izni verilmezse, işveren bu süreye ait ücret tutarını ödemekle yükümlüdür.",
  "",
  "• İhbar süreleri İş Kanunu Madde 17'ye göre belirlenir.",
  "",
  "Yeni iş arama izni",
  "",
  "Madde 27-",
  "",
  "• Bildirim süreleri içinde işveren, işçiye yeni bir iş bulması için gerekli olan iş arama iznini iş saatleri içinde ve ücret kesintisi yapmadan vermeye mecburdur.",
  "",
  "• İşveren yeni iş arama iznini vermez veya eksik kullandırırsa o süreye ilişkin ücret işçiye ödenir.",
];

const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";
const inputCls =
  "w-full mt-1 rounded-lg h-9 text-sm border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 px-2.5";
const labelCls = "text-xs font-medium text-gray-700 dark:text-gray-300";

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const toNumber = (value: string) =>
  Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

const getGunlukCalismaSaati = (_haftalikCalismaGunu: number) => 7.5;

const calculateWorkDays = (startDate: string, endDate: string, haftalikCalismaGunu: number): number => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(+start) || Number.isNaN(+end) || start > end) return 0;
  let workDays = 0;
  const current = new Date(start);
  const workDayMap: Record<number, number[]> = {
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const validWorkDays = workDayMap[haftalikCalismaGunu] || workDayMap[5];
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (validWorkDays.includes(dayOfWeek)) workDays++;
    current.setDate(current.getDate() + 1);
  }
  return workDays;
};

type TarihAralikDusum = { id: string; baslangic: string; bitis: string; gunlukSaat: string };

type LiveFormShape = {
  iseGiris?: string;
  istenCikis?: string;
  brut?: string;
  prim?: string;
  ikramiye?: string;
  yol?: string;
  yemek?: string;
  extras?: ExtraItem[];
};

function resetCalcState(setters: {
  setWeeks: (n: number) => void;
  setAmount: (n: number) => void;
  setSsk: (n: number) => void;
  setIssizlik: (n: number) => void;
  setGelir: (n: number) => void;
  setGelirDilim: (s: string) => void;
  setDamga: (n: number) => void;
  setNet: (n: number) => void;
  setToplamGun: (n: number) => void;
  setToplamSaat: (n: number) => void;
  setSaatlik: (n: number) => void;
}) {
  setters.setWeeks(2);
  setters.setAmount(0);
  setters.setSsk(0);
  setters.setIssizlik(0);
  setters.setGelir(0);
  setters.setGelirDilim("");
  setters.setDamga(0);
  setters.setNet(0);
  setters.setToplamGun(0);
  setters.setToplamSaat(0);
  setters.setSaatlik(0);
}

export default function IsAramaIzniUcretiPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError, info } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const videoLink = getVideoLink("is-arama-izni");

  const [totals, setTotals] = useState({ toplam: 0, yil: 0, ay: 0, gun: 0 });
  const [exitDate, setExitDate] = useState("");
  const [liveForm, setLiveForm] = useState<LiveFormShape | null>(null);
  const [loadedForm, setLoadedForm] = useState<LiveFormShape | null>(null);
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [haftalikCalismaGunu, setHaftalikCalismaGunu] = useState("5");

  const [weeks, setWeeks] = useState(2);
  const [amount, setAmount] = useState(0);
  const [sskPrimi, setSskPrimi] = useState(0);
  const [issizlikPrimi, setIssizlikPrimi] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [net, setNet] = useState(0);
  const [toplamIsAramaGunu, setToplamIsAramaGunu] = useState(0);
  const [toplamIsAramaSaati, setToplamIsAramaSaati] = useState(0);
  const [saatlikUcret, setSaatlikUcret] = useState(0);

  const [kullandirilanIzinGun, setKullandirilanIzinGun] = useState("");
  const [tarihAralikDusumler, setTarihAralikDusumler] = useState<TarihAralikDusum[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Eklenti Hesaplama");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({});
  const [applyFn, setApplyFn] = useState<(v: number) => void>(() => () => {});

  const selectedYear = useMemo(() => {
    const dateStr = exitDate || liveForm?.istenCikis || "";
    if (dateStr) {
      try {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) return d.getFullYear();
      } catch {
        /* ignore */
      }
    }
    return new Date().getFullYear();
  }, [exitDate, liveForm?.istenCikis]);

  const haftalikGunNum = Number(haftalikCalismaGunu) || 5;

  const { dusumSaati, netIsAramaSaati } = useMemo(() => {
    const gunlukCalismaSaati = getGunlukCalismaSaati(haftalikGunNum);
    let toplamDusum = 0;
    const gunBazli = toNumber(kullandirilanIzinGun);
    if (gunBazli > 0) toplamDusum += gunBazli * gunlukCalismaSaati;
    tarihAralikDusumler.forEach((dusum) => {
      if (dusum.baslangic && dusum.bitis && dusum.gunlukSaat) {
        const gunler = calculateWorkDays(dusum.baslangic, dusum.bitis, haftalikGunNum);
        toplamDusum += gunler * toNumber(dusum.gunlukSaat);
      }
    });
    const netSaat = Math.max(0, toplamIsAramaSaati - toplamDusum);
    return { dusumSaati: toplamDusum, netIsAramaSaati: netSaat };
  }, [kullandirilanIzinGun, tarihAralikDusumler, toplamIsAramaSaati, haftalikGunNum]);

  const applyApiResult = useCallback((data: Record<string, unknown>) => {
    setWeeks(Number(data.weeks) || 2);
    setAmount(Number(data.brut) || 0);
    setSskPrimi(Number(data.sskPrimi) || 0);
    setIssizlikPrimi(Number(data.issizlikPrimi) || 0);
    setGelirVergisi(Number(data.gelirVergisi) || 0);
    setGelirVergisiDilimleri(String(data.gelirVergisiDilimleri || ""));
    setDamgaVergisi(Number(data.damgaVergisi) || 0);
    setNet(Number(data.net) || 0);
    setToplamIsAramaGunu(Number(data.toplamIsAramaGunu) || 0);
    setToplamIsAramaSaati(Number(data.toplamIsAramaSaati) || 0);
    setSaatlikUcret(Number(data.saatlikUcret) || 0);
  }, []);

  useEffect(() => {
    if (!liveForm) return;
    const brutNum = toNumber(liveForm.brut || "0");
    if (brutNum <= 0 || totals.yil < 0 || totals.ay < 0 || totals.gun < 0) {
      resetCalcState({
        setWeeks,
        setAmount,
        setSsk: setSskPrimi,
        setIssizlik: setIssizlikPrimi,
        setGelir: setGelirVergisi,
        setGelirDilim: setGelirVergisiDilimleri,
        setDamga: setDamgaVergisi,
        setNet,
        setToplamGun: setToplamIsAramaGunu,
        setToplamSaat: setToplamIsAramaSaati,
        setSaatlik: setSaatlikUcret,
      });
      return;
    }

    const body: Record<string, unknown> = {
      brut: liveForm.brut || "0",
      prim: liveForm.prim || "0",
      ikramiye: liveForm.ikramiye || "0",
      yol: liveForm.yol || "0",
      yemek: liveForm.yemek || "0",
      diger: "0",
      extras: liveForm.extras || [],
      totals,
      exitYear: selectedYear,
      haftalikCalismaGunu: haftalikGunNum,
    };

    if (dusumSaati > 0 && toplamIsAramaSaati > 0) {
      body.kullandirilanIzinSaat = dusumSaati;
      body.netIsAramaSaati = netIsAramaSaati;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient("/api/is-arama-izni", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || cancelled) return;
        const result = await res.json();
        if (cancelled || !result.success || !result.data) return;
        applyApiResult(result.data as Record<string, unknown>);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    liveForm,
    totals,
    selectedYear,
    haftalikGunNum,
    dusumSaati,
    netIsAramaSaati,
    toplamIsAramaSaati,
    applyApiResult,
  ]);

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = (await loadSavedCase(effectiveId)) as Record<string, unknown>;
        if (cancelled) return;
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
        const nested = payload.data as Record<string, unknown> | undefined;
        const formRaw =
          (payload.form as Record<string, unknown>) ||
          (nested?.form as Record<string, unknown>) ||
          payload;
        const startDateValue =
          (formRaw.startDate as string) ||
          (formRaw.iseGiris as string) ||
          (raw.start_date as string) ||
          "";
        const endDateValue =
          (formRaw.endDate as string) ||
          (formRaw.istenCikis as string) ||
          (raw.end_date as string) ||
          "";
        const ise = startDateValue
          ? new Date(startDateValue).toISOString().split("T")[0]
          : "";
        const isten = endDateValue ? new Date(endDateValue).toISOString().split("T")[0] : "";
        const brutVal = String(formRaw.brutUcret ?? formRaw.brut ?? "");

        const nextForm: LiveFormShape = {
          ...formRaw,
          iseGiris: ise,
          istenCikis: isten,
          brut: brutVal || (formRaw.brut as string) || "",
          prim: (formRaw.prim as string) || "",
          ikramiye: (formRaw.ikramiye as string) || "",
          yol: (formRaw.yol as string) || "",
          yemek: (formRaw.yemek as string) || "",
          extras: (formRaw.extras as ExtraItem[]) || [],
        };

        setLoadedForm(nextForm);
        setLiveForm(nextForm);
        setExitDate(isten);
        if (formRaw.haftalikCalismaGunu != null) {
          setHaftalikCalismaGunu(String(formRaw.haftalikCalismaGunu));
        }
        if (formRaw.kullandirilanIzinGun != null) {
          setKullandirilanIzinGun(String(formRaw.kullandirilanIzinGun));
        }
        if (Array.isArray(formRaw.tarihAralikDusumler)) {
          setTarihAralikDusumler(formRaw.tarihAralikDusumler as TarihAralikDusum[]);
        }
        const results = (payload.results as Record<string, unknown>) || (nested?.results as Record<string, unknown>);
        if (results?.totals) {
          setTotals(results.totals as { toplam: number; yil: number; ay: number; gun: number });
        }
        setCurrentRecordName(
          (raw.name as string) || (raw.notes as string) || (raw.aciklama as string) || null
        );
        success(`Kayıt yüklendi (#${effectiveId})`);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          showToastError("Kayıt yüklenemedi");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  useEffect(() => {
    if (effectiveId) return;
    const params = new URLSearchParams(location.search);
    const start = params.get("start");
    const end = params.get("end");
    const brut = params.get("brut");
    if (!start && !end && !brut) return;
    setLiveForm((prev) => ({
      ...(prev || {}),
      ...(start ? { iseGiris: start } : {}),
      ...(end ? { istenCikis: end } : {}),
      ...(brut ? { brut } : {}),
    }));
  }, [location.search, effectiveId]);

  const isAramaReportConfig = useMemo((): ReportConfig => {
    const fmtLocal = (n: number) =>
      n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const workPeriodLabel =
      totals.yil > 0 || totals.ay > 0 || totals.gun > 0
        ? `${totals.yil || 0} Yıl, ${totals.ay || 0} Ay, ${totals.gun || 0} Gün`
        : "-";

    return {
      title: PAGE_HEADING,
      sections: { info: true, grossToNet: true },
      infoRows: [
        {
          label: "İşe Giriş",
          value: liveForm?.iseGiris ? new Date(liveForm.iseGiris).toLocaleDateString("tr-TR") : "-",
        },
        {
          label: "İşten Çıkış",
          value: liveForm?.istenCikis ? new Date(liveForm.istenCikis).toLocaleDateString("tr-TR") : "-",
        },
        { label: "Çalışma Süresi", value: workPeriodLabel },
        { label: "Brüt Ücret (giydirilmiş)", value: totals.toplam ? `${fmtLocal(totals.toplam)}₺` : "-" },
        { label: "İhbar Süresi (Hafta)", value: weeks.toString() },
        { label: "Haftalık Çalışma Günü", value: `${haftalikGunNum} gün` },
      ],
      customSections: [
        {
          title: "İş Arama İzni Hesaplama Detayı",
          content: (
            <div className="space-y-2 text-sm">
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #999", fontSize: "11px" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>Toplam İş Arama Günü</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right" }}>
                      {weeks} hafta × {haftalikGunNum} gün = {toplamIsAramaGunu} gün
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>Toplam İş Arama Saati</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right" }}>
                      {toplamIsAramaGunu} gün × 2 saat = {toplamIsAramaSaati} saat
                    </td>
                  </tr>
                  {dusumSaati > 0 ? (
                    <>
                      <tr style={{ color: "#dc2626" }}>
                        <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>Kullandırılan İzin (Düşüm)</td>
                        <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right" }}>
                          -{dusumSaati.toFixed(1)} saat
                        </td>
                      </tr>
                      <tr style={{ fontWeight: 600, backgroundColor: "#dbeafe" }}>
                        <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>Net İş Arama Saati</td>
                        <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right", color: "#1d4ed8" }}>
                          {netIsAramaSaati.toFixed(1)} saat
                        </td>
                      </tr>
                    </>
                  ) : null}
                  <tr>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>Saatlik Ücret</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right" }}>
                      {fmtLocal(totals.toplam || 0)} ₺ / 225 = {fmtLocal(saatlikUcret)} ₺
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>İş Arama İzni Ücreti</td>
                    <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right" }}>
                      {fmtLocal(saatlikUcret)} ₺ × {dusumSaati > 0 ? netIsAramaSaati.toFixed(1) : toplamIsAramaSaati} saat ={" "}
                      {fmtLocal(amount)} ₺
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2 italic">
                * İş Kanunu madde 17&apos;ye göre hesaplanan ihbar süresi esas alınmıştır. Günde 2 saat iş arama izni hakkı
                vardır.
              </p>
            </div>
          ),
        },
      ],
      grossToNetData: {
        title: "Brüt'ten Net'e Çeviri",
        rows: [
          { label: "Brüt İş Arama İzni Ücreti", value: `${fmtLocal(amount)}₺` },
          { label: "SGK Primi (%14)", value: `-${fmtLocal(sskPrimi)}₺`, isDeduction: true },
          { label: "İşsizlik Primi (%1)", value: `-${fmtLocal(issizlikPrimi)}₺`, isDeduction: true },
          { label: `Gelir Vergisi ${gelirVergisiDilimleri}`, value: `-${fmtLocal(gelirVergisi)}₺`, isDeduction: true },
          { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtLocal(damgaVergisi)}₺`, isDeduction: true },
          { label: "Net İş Arama İzni Ücreti", value: `${fmtLocal(net)}₺`, isNet: true },
        ],
      },
    };
  }, [
    liveForm,
    totals,
    weeks,
    haftalikGunNum,
    toplamIsAramaGunu,
    toplamIsAramaSaati,
    dusumSaati,
    netIsAramaSaati,
    saatlikUcret,
    amount,
    sskPrimi,
    issizlikPrimi,
    gelirVergisi,
    gelirVergisiDilimleri,
    damgaVergisi,
    net,
  ]);

  const fmtLocalWord = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const wordTableSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string }> = [];
    const infoRowsFiltered = (isAramaReportConfig.infoRows || []).filter((r) => r.condition !== false);
    if (infoRowsFiltered.length > 0) {
      const n1 = adaptToWordTable({
        headers: ["Alan", "Değer"],
        rows: infoRowsFiltered.map((r) => [r.label, String(r.value ?? "-")]),
      });
      sections.push({ id: "ust-bilgiler", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });
    }
    const hesaplamaRows: [string, string][] = [
      ["Toplam İş Arama Günü", `${weeks} hafta × ${haftalikGunNum} gün = ${toplamIsAramaGunu} gün`],
      ["Toplam İş Arama Saati", `${toplamIsAramaGunu} gün × 2 saat = ${toplamIsAramaSaati} saat`],
    ];
    if (dusumSaati > 0) {
      hesaplamaRows.push(["Kullandırılan İzin (Düşüm)", `-${dusumSaati.toFixed(1)} saat`]);
      hesaplamaRows.push(["Net İş Arama Saati", `${netIsAramaSaati.toFixed(1)} saat`]);
    }
    hesaplamaRows.push(["Saatlik Ücret", `${fmtLocalWord(totals.toplam || 0)} ₺ / 225 = ${fmtLocalWord(saatlikUcret)} ₺`]);
    hesaplamaRows.push([
      "İş Arama İzni Ücreti",
      `${fmtLocalWord(saatlikUcret)} ₺ × ${dusumSaati > 0 ? netIsAramaSaati.toFixed(1) : toplamIsAramaSaati} saat = ${fmtLocalWord(amount)} ₺`,
    ]);
    const n2 = adaptToWordTable({ headers: ["Alan", "Değer"], rows: hesaplamaRows });
    sections.push({
      id: "is-arama-hesaplama",
      title: "İş Arama İzni Hesaplama Detayı",
      html: buildWordTable(n2.headers, n2.rows),
    });
    const gnd = isAramaReportConfig.grossToNetData?.rows;
    if (gnd?.length) {
      const n3 = adaptToWordTable(gnd);
      sections.push({
        id: "brutten-nete",
        title: isAramaReportConfig.grossToNetData?.title || "Brüt'ten Net'e Çeviri",
        html: buildWordTable(n3.headers, n3.rows),
      });
    }
    return sections;
  }, [isAramaReportConfig, weeks, haftalikGunNum, toplamIsAramaGunu, toplamIsAramaSaati, dusumSaati, netIsAramaSaati, totals.toplam, saatlikUcret, amount]);

  const handlePrint = useCallback(() => {
    const el = document.getElementById("report-content");
    if (!el) return;
    const title = isAramaReportConfig.title;
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
  }, [isAramaReportConfig.title]);

  const handleSave = useCallback(() => {
    if (!amount || amount <= 0) {
      showToastError("Önce geçerli bir hesaplama yapın");
      return;
    }
    const iseGiris = liveForm?.iseGiris || null;
    const istenCikis = liveForm?.istenCikis || null;
    try {
      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              ...liveForm,
              haftalikCalismaGunu: haftalikGunNum,
              kullandirilanIzinGun,
              tarihAralikDusumler,
            },
            results: {
              totals,
              brut: amount,
              net,
              dusumSaati,
              netIsAramaSaati,
            },
          },
          ise_giris: iseGiris,
          isten_cikis: istenCikis,
          brut_total: Number(amount.toFixed(2)),
          net_total: Number(net.toFixed(2)),
          start_date: iseGiris,
          end_date: istenCikis,
          total: Number(amount.toFixed(2)),
        },
        mevcutId: effectiveId,
        mevcutKayitAdi: currentRecordName,
        redirectPath: REDIRECT_PATH,
      });
    } catch {
      showToastError("Kayıt yapılamadı");
    }
  }, [
    amount,
    net,
    totals,
    liveForm,
    effectiveId,
    kaydetAc,
    showToastError,
    currentRecordName,
    kullandirilanIzinGun,
    tarihAralikDusumler,
    dusumSaati,
    netIsAramaSaati,
    haftalikGunNum,
  ]);

  const handleNew = () => {
    const dirty = Boolean(liveForm?.iseGiris || liveForm?.istenCikis || toNumber(liveForm?.brut || "") > 0);
    if (dirty && !window.confirm("Kaydedilmemiş veriler silinecek. Devam edilsin mi?")) return;
    setTotals({ toplam: 0, yil: 0, ay: 0, gun: 0 });
    setExitDate("");
    setLiveForm(null);
    setLoadedForm(null);
    setCurrentRecordName(null);
    setHaftalikCalismaGunu("5");
    setKullandirilanIzinGun("");
    setTarihAralikDusumler([]);
    resetCalcState({
      setWeeks,
      setAmount,
      setSsk: setSskPrimi,
      setIssizlik: setIssizlikPrimi,
      setGelir: setGelirVergisi,
      setGelirDilim: setGelirVergisiDilimleri,
      setDamga: setDamgaVergisi,
      setNet,
      setToplamGun: setToplamIsAramaGunu,
      setToplamSaat: setToplamIsAramaSaati,
      setSaatlik: setSaatlikUcret,
    });
    if (effectiveId) navigate(REDIRECT_PATH);
  };

  const initialIse = loadedForm?.iseGiris;
  const initialIsten = loadedForm?.istenCikis;

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

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-4">
              <section>
                <h2 className={sectionTitleCls}>{PAGE_HEADING}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  İhbar süresi ve haftalık çalışma gününe göre iş arama izni saatleri; giydirilmiş brütten saatlik ücret ile
                  hesaplanır.
                </p>
              </section>

              <KidemTazminatiForm
                key={effectiveId ?? "new"}
                embedInCard
                showIhbarShortcut={false}
                customTitle={`${PAGE_HEADING.toUpperCase()} HESAPLAMA`}
                onTotalsChange={setTotals}
                onExitDateChange={setExitDate}
                onValuesChange={(v) =>
                  setLiveForm({
                    iseGiris: v.iseGiris,
                    istenCikis: v.istenCikis,
                    brut: v.brut,
                    prim: v.prim,
                    ikramiye: v.ikramiye,
                    yol: v.yol,
                    yemek: v.yemek,
                    extras: v.extras,
                  })
                }
                onRequestEklenti={(fieldKey, title, apply) => {
                  setActiveField(fieldKey);
                  setModalTitle(title || "Eklenti Hesaplama");
                  setApplyFn(() => (val: number) => {
                    apply(val);
                  });
                  setModalOpen(true);
                }}
                initialBrut={loadedForm?.brut}
                initialIseGiris={initialIse}
                initialIstenCikis={initialIsten}
                initialPrim={loadedForm?.prim}
                initialIkramiye={loadedForm?.ikramiye}
                initialYol={loadedForm?.yol}
                initialYemek={loadedForm?.yemek}
                initialExtras={loadedForm?.extras}
              />

              <div>
                <label className={labelCls}>Haftalık çalışma süresi (gün)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={haftalikCalismaGunu}
                  onChange={(e) => setHaftalikCalismaGunu(e.target.value)}
                  placeholder="Örn: 5"
                  className={inputCls}
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Haftada kaç gün çalışıldığı (5 veya 6 gibi).
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 p-3 space-y-3">
                <h3 className={sectionTitleCls}>
                  Kullandırılmış iş arama izinleri (düşüm){" "}
                  <span className="text-xs font-normal text-gray-500">(isteğe bağlı)</span>
                </h3>
                <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-white/60 dark:bg-gray-800/40 p-2.5">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Gün bazlı düşüm{" "}
                    <span className="font-normal text-gray-500">(günlük 7,5 saat)</span>
                  </div>
                  <input
                    type="text"
                    value={kullandirilanIzinGun}
                    onChange={(e) => setKullandirilanIzinGun(e.target.value)}
                    placeholder="Örn: 2"
                    className={inputCls}
                  />
                  {toNumber(kullandirilanIzinGun) > 0 ? (
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      = {toNumber(kullandirilanIzinGun)} gün × {getGunlukCalismaSaati(haftalikGunNum).toFixed(1)} saat/gün ={" "}
                      {(toNumber(kullandirilanIzinGun) * getGunlukCalismaSaati(haftalikGunNum)).toFixed(1)} saat
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Tarih aralığı bazlı düşüm</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTarihAralikDusumler((prev) => [
                          ...prev,
                          { id: Math.random().toString(36).slice(2), baslangic: "", bitis: "", gunlukSaat: "" },
                        ])
                      }
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs font-medium bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ekle
                    </button>
                  </div>
                  {tarihAralikDusumler.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                      Henüz tarih aralığı eklenmedi
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tarihAralikDusumler.map((dusum) => {
                        const cg = calculateWorkDays(dusum.baslangic, dusum.bitis, haftalikGunNum);
                        const gs = toNumber(dusum.gunlukSaat);
                        const topSaat = cg * gs;
                        return (
                          <div
                            key={dusum.id}
                            className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-900/10 p-2.5 space-y-2"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className={labelCls}>Başlangıç</label>
                                <input
                                  type="date"
                                  value={dusum.baslangic}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setTarihAralikDusumler((rows) =>
                                      rows.map((r) => (r.id === dusum.id ? { ...r, baslangic: v } : r))
                                    );
                                  }}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Bitiş</label>
                                <input
                                  type="date"
                                  value={dusum.bitis}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setTarihAralikDusumler((rows) =>
                                      rows.map((r) => (r.id === dusum.id ? { ...r, bitis: v } : r))
                                    );
                                  }}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Günlük saat</label>
                                <input
                                  type="text"
                                  value={dusum.gunlukSaat}
                                  onChange={(e) =>
                                    setTarihAralikDusumler((rows) =>
                                      rows.map((r) => (r.id === dusum.id ? { ...r, gunlukSaat: e.target.value } : r))
                                    )
                                  }
                                  placeholder="Örn: 2"
                                  className={inputCls}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-amber-800 dark:text-amber-200">
                                {dusum.baslangic && dusum.bitis && dusum.gunlukSaat
                                  ? `= ${cg} çalışma günü × ${gs} saat/gün = ${topSaat.toFixed(1)} saat`
                                  : ""}
                              </span>
                              <button
                                type="button"
                                aria-label="Satırı sil"
                                onClick={() =>
                                  setTarihAralikDusumler((rows) => rows.filter((r) => r.id !== dusum.id))
                                }
                                className="shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {dusumSaati > 0 ? (
                  <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-2.5 flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Toplam düşülecek saat</span>
                    <span className="font-bold text-red-700 dark:text-red-300">{dusumSaati.toFixed(1)} saat</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-1 text-xs">
                <h3 className={`${sectionTitleCls} mb-2`}>Özet</h3>
                <div className="flex justify-between">
                  <span>İhbar süresi</span>
                  <span className="font-medium">{weeks} hafta</span>
                </div>
                <div className="flex justify-between">
                  <span>Haftalık çalışma</span>
                  <span className="font-medium">{haftalikGunNum} gün</span>
                </div>
                <div className="flex justify-between">
                  <span>Toplam iş arama günü</span>
                  <span className="font-medium">
                    {weeks} × {haftalikGunNum} = {toplamIsAramaGunu} gün
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Toplam iş arama saati</span>
                  <span className="font-medium">{toplamIsAramaGunu} × 2 = {toplamIsAramaSaati} saat</span>
                </div>
                {dusumSaati > 0 ? (
                  <>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Düşüm</span>
                      <span>-{dusumSaati.toFixed(1)} saat</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-600 pt-1">
                      <span>Net iş arama saati</span>
                      <span className="text-blue-700 dark:text-blue-300">{netIsAramaSaati.toFixed(1)} saat</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between">
                  <span>Saatlik ücret</span>
                  <span className="font-medium">
                    {fmt(totals.toplam)} ₺ / 225 = {fmt(saatlikUcret)} ₺
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-600 pt-1">
                  <span>İş arama izni ücreti (brüt)</span>
                  <span>
                    {fmt(amount)} ₺
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40">
                  <h3 className={sectionTitleCls}>Brütten nete</h3>
                </div>
                <div className="p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Brüt</span>
                    <span className="font-semibold">{fmt(amount)} ₺</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>SGK (%14)</span>
                    <span>-{fmt(sskPrimi)} ₺</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>İşsizlik (%1)</span>
                    <span>-{fmt(issizlikPrimi)} ₺</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span className="pr-2">Gelir vergisi {gelirVergisiDilimleri}</span>
                    <span className="shrink-0">-{fmt(gelirVergisi)} ₺</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Damga (binde 7,59)</span>
                    <span>-{fmt(damgaVergisi)} ₺</span>
                  </div>
                  <div className="flex justify-between pt-1 font-semibold text-green-700 dark:text-green-400">
                    <span>Net</span>
                    <span>{fmt(net)} ₺</span>
                  </div>
                </div>
              </div>

              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/20 p-2.5 mt-1 space-y-1.5 text-[11px] font-light text-gray-500 dark:text-gray-400">
                  {NOTE_ITEMS.map((item, index) => {
                    if (item === "") return <br key={index} />;
                    const isHeading =
                      item === "İş Arama İzni Ücreti" || item === "Yeni iş arama izni" || item === "Madde 27-";
                    if (isHeading) {
                      return (
                        <p key={index} className="font-semibold text-gray-900 dark:text-gray-100">
                          {item}
                        </p>
                      );
                    }
                    return (
                      <p key={index}>{item.startsWith("• ") ? item : `• ${item}`}</p>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <EklentiModal
        open={modalOpen}
        title={modalTitle}
        months={activeField ? eklentiValues[activeField] : undefined}
        onClose={() => setModalOpen(false)}
        onMonthsChange={(i, val) => {
          if (!activeField) return;
          setEklentiValues((prev) => {
            const arr = prev[activeField] ?? Array(12).fill("");
            const next = arr.slice();
            next[i] = val;
            return { ...prev, [activeField]: next };
          });
        }}
        onApply={(v) => {
          applyFn(v);
          setModalOpen(false);
          info("Eklenti hesaplandı", "Seçili kaleme uygulandı");
        }}
      />

      <div style={{ display: "none" }} aria-hidden="true">
        <div
          id="report-content"
          style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}
        >
          <ReportContentFromConfig config={isAramaReportConfig} />
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
          copyTargetId: "is-arama-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div style={{ background: "white", padding: 24 }}>
              <style>{`
                .report-section-copy { margin-bottom: 20px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .report-section-copy .section-title { font-weight: 600; font-size: 13px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 4px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
                #is-arama-word-copy table { border-collapse: collapse; width: 100%; margin-bottom: 12px; border: 1px solid #999; font-size: 9px; }
                #is-arama-word-copy td { border: 1px solid #999; padding: 4px 6px; }
              `}</style>
              <div id="is-arama-word-copy">
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
