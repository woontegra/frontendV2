/**
 * Dönemsel Fazla Mesai - Yaz/Kış desenli
 * Davacı + Tanıklar (dateIn/dateOut + Yaz/Kış desenleri)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import {
  computeDisplayRows,
  adaptToWordTable,
  buildWordTable,
  copySectionForWord,
  downloadPdfFromDOM,
  type FazlaMesaiRowBase,
} from "@modules/fazla-mesai/shared";
import type { SeasonalPattern, DonemselWitness, DonemselState } from "./types";
import {
  DEFAULT_SUMMER_PATTERN,
  DEFAULT_WINTER_PATTERN,
  DEFAULT_SUMMER_PATTERN_HAFTALIK,
  DEFAULT_WINTER_PATTERN_HAFTALIK,
} from "./types";
import { buildDonemselRows, calcFmHoursPerWeekHaftalik, fmt } from "./utils";
import SeasonalWorkPatternEditor from "./components/SeasonalWorkPatternEditor";
import WitnessSeasonalEditor from "./components/WitnessSeasonalEditor";
import { YillikIzinPanel } from "../standart/YillikIzinPanel";
import { ZamanasimiModal } from "../standart/ZamanasimiModal";
import { KatsayiModal } from "../standart/KatsayiModal";
import { MahsuplasamaModal } from "../standart/MahsuplasamaModal";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { Copy } from "lucide-react";

const GELIR_VERGISI = 0.15;
const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelCls = "block text-xs font-normal text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-normal text-gray-800 dark:text-gray-200";

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function fmtCurrency(n: number): string {
  return `${(n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function normalizeLoadedWitnesses(raw: unknown, haftalik: boolean): DonemselWitness[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((item: Record<string, unknown>, idx: number) => {
    const s = (item?.summerPattern as SeasonalPattern) || {};
    const w = (item?.winterPattern as SeasonalPattern) || {};
    if (haftalik) {
      return {
        id: typeof item?.id === "number" ? item.id : idx + 1,
        name: (item?.name as string) || `Tanık ${idx + 1}`,
        dateIn: (item?.dateIn ?? item?.startDateISO ?? "") as string,
        dateOut: (item?.dateOut ?? item?.endDateISO ?? "") as string,
        summerPattern: {
          ...DEFAULT_SUMMER_PATTERN_HAFTALIK,
          ...s,
          months: s.months?.length ? s.months : DEFAULT_SUMMER_PATTERN_HAFTALIK.months,
        },
        winterPattern: {
          ...DEFAULT_WINTER_PATTERN_HAFTALIK,
          ...w,
          months: w.months?.length ? w.months : DEFAULT_WINTER_PATTERN_HAFTALIK.months,
        },
      };
    }
    return {
      id: typeof item?.id === "number" ? item.id : idx + 1,
      name: (item?.name as string) || `Tanık ${idx + 1}`,
      dateIn: (item?.dateIn ?? item?.startDateISO ?? "") as string,
      dateOut: (item?.dateOut ?? item?.endDateISO ?? "") as string,
      summerPattern: { ...DEFAULT_SUMMER_PATTERN, ...s },
      winterPattern: { ...DEFAULT_WINTER_PATTERN, ...w },
    };
  });
}

function emptyDonemselState(pathname: string): DonemselState {
  const haftalik = pathname.includes("donemsel-haftalik");
  if (haftalik) {
    return {
      dateIn: "",
      dateOut: "",
      summerPattern: { ...DEFAULT_SUMMER_PATTERN_HAFTALIK },
      winterPattern: { ...DEFAULT_WINTER_PATTERN_HAFTALIK },
      witnessesSeasons: [],
    };
  }
  return {
    dateIn: "",
    dateOut: "",
    summerPattern: { ...DEFAULT_SUMMER_PATTERN },
    winterPattern: { ...DEFAULT_WINTER_PATTERN },
    witnessesSeasons: [],
  };
}

export default function DonemselPage() {
  const location = useLocation();
  const isDonemselHaftalik = location.pathname.includes("/donemsel-haftalik");
  const PAGE_TITLE = isDonemselHaftalik
    ? "Dönemsel Haftalık Fazla Mesai Hesaplama"
    : "Dönemsel Fazla Mesai Hesaplama";
  const RECORD_TYPE = isDonemselHaftalik ? "donemsel_haftalik_fazla_mesai" : "donemsel_fazla_mesai";
  const REDIRECT_BASE_PATH = isDonemselHaftalik ? "/fazla-mesai/donemsel-haftalik" : "/fazla-mesai/donemsel";
  const wordCopyId = isDonemselHaftalik ? "donemsel-haftalik-word-copy" : "donemsel-word-copy";
  const reportContentId = isDonemselHaftalik ? "report-content-donemsel-haftalik" : "report-content-donemsel";
  const dataPageAttr = isDonemselHaftalik ? "fazla-mesai-donemsel-haftalik" : "fazla-mesai-donemsel";

  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const [donemselState, setDonemselState] = useState<DonemselState>(() =>
    emptyDonemselState(typeof window !== "undefined" ? window.location.pathname : "")
  );

  const [weeklyDays, setWeeklyDays] = useState<string>("6");
  const [activeTab, setActiveTab] = useState<"tatilsiz" | "tatilli">("tatilsiz");
  const [katSayi, setKatSayi] = useState(1);
  const [mode270, setMode270] = useState<"none" | "simple" | "detailed">("none");
  const [mahsuplasmaMiktari, setMahsuplasmaMiktari] = useState("");
  const [zamanasimi, setZamanasimi] = useState<{ nihaiBaslangic?: string } | null>(null);
  const [exclusions, setExclusions] = useState<Array<{ id: string; type: string; start: string; end: string; days: number }>>([]);
  const [currentRecordName, setCurrentRecordName] = useState<string | undefined>();
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [manualRows, setManualRows] = useState<FazlaMesaiRowBase[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<FazlaMesaiRowBase>>>({});

  const zamanasimiBaslangic = zamanasimi?.nihaiBaslangic || null;
  const workDays = Math.max(1, Math.min(7, Number(weeklyDays) || 6));

  // Kayıt yükleme
  useEffect(() => {
    if (!effectiveId) return;
    let mounted = true;
    yukleHesap(effectiveId, RECORD_TYPE)
      .then((res) => {
        if (!mounted) return;
        if (!res.success) {
          showToastError(res.error || "Kayıt yüklenemedi");
          return;
        }
        const raw = res.data?.form || res.data?.formValues || res.data || {};
        const d = raw.donemselState || raw;
        if (d) {
          const baseS = isDonemselHaftalik ? DEFAULT_SUMMER_PATTERN_HAFTALIK : DEFAULT_SUMMER_PATTERN;
          const baseW = isDonemselHaftalik ? DEFAULT_WINTER_PATTERN_HAFTALIK : DEFAULT_WINTER_PATTERN;
          setDonemselState((p) => ({
            dateIn: d.dateIn ?? p.dateIn,
            dateOut: d.dateOut ?? p.dateOut,
            summerPattern: d.summerPattern ? { ...baseS, ...d.summerPattern } : p.summerPattern,
            winterPattern: d.winterPattern ? { ...baseW, ...d.winterPattern } : p.winterPattern,
            witnessesSeasons: Array.isArray(d.witnessesSeasons)
              ? normalizeLoadedWitnesses(d.witnessesSeasons, isDonemselHaftalik)
              : p.witnessesSeasons,
          }));
        }
        if (raw.weeklyDays != null) setWeeklyDays(String(raw.weeklyDays));
        if (raw.activeTab) setActiveTab(raw.activeTab === "tatilli" ? "tatilli" : "tatilsiz");
        if (raw.katSayi != null) setKatSayi(Number(raw.katSayi) || 1);
        if (raw.mode270) setMode270(raw.mode270);
        if (raw.mahsuplasmaMiktari != null) setMahsuplasmaMiktari(String(raw.mahsuplasmaMiktari || ""));
        if (raw.zamanasimi) setZamanasimi(raw.zamanasimi);
        if (Array.isArray(raw.exclusions)) setExclusions(raw.exclusions);
        if (Array.isArray(raw.manualRows)) setManualRows(raw.manualRows);
        if (raw.rowOverrides && typeof raw.rowOverrides === "object") setRowOverrides(raw.rowOverrides);
        if (res.data?.name) setCurrentRecordName(res.data.name);
      })
      .catch((err) => {
        if (mounted) showToastError(err?.message || "Yükleme hatası");
      });
    return () => { mounted = false; };
  }, [effectiveId, showToastError, RECORD_TYPE, isDonemselHaftalik]);

  const rows = useMemo(() => {
    const { dateIn, dateOut, summerPattern, winterPattern, witnessesSeasons } = donemselState;
    if (!dateIn || !dateOut) return [];
    const raw = buildDonemselRows({
      dateIn,
      dateOut,
      summerPattern,
      winterPattern,
      witnesses: witnessesSeasons,
      weeklyDays: workDays,
      activeTab,
      katSayi,
      haftalikMode: isDonemselHaftalik,
    });

    if (zamanasimiBaslangic) {
      const zDate = new Date(zamanasimiBaslangic);
      return raw
        .map((r) => {
          if (!r.startISO || !r.endISO) return r;
          const rEnd = new Date(r.endISO);
          const rStart = new Date(r.startISO);
          if (rEnd < zDate) return null;
          if (rStart < zDate && rEnd >= zDate) {
            const diffMs = rEnd.getTime() - zDate.getTime();
            const diffDays = Math.round(diffMs / 86400000) + 1;
            const adjWeeks = Math.round(diffDays / 7);
            return {
              ...r,
              startISO: zamanasimiBaslangic,
              rangeLabel: `${formatDateTR(zamanasimiBaslangic)} – ${formatDateTR(r.endISO)}`,
              weeks: adjWeeks,
              originalWeekCount: adjWeeks,
            };
          }
          return r;
        })
        .filter(Boolean) as FazlaMesaiRowBase[];
    }
    return raw as FazlaMesaiRowBase[];
  }, [donemselState, workDays, activeTab, katSayi, zamanasimiBaslangic, isDonemselHaftalik]);

  const davaciWeeklyFM = useMemo(() => {
    const sp = donemselState.summerPattern;
    if (isDonemselHaftalik) {
      return calcFmHoursPerWeekHaftalik(sp);
    }
    const [girH, girM] = sp.startTime.split(":").map(Number);
    const [cikH, cikM] = sp.endTime.split(":").map(Number);
    const dailyBrut = (cikH * 60 + (cikM || 0) - girH * 60 - (girM || 0)) / 60;
    let breakH = 1;
    if (dailyBrut >= 15) breakH = 3;
    else if (dailyBrut >= 14) breakH = 2;
    else if (dailyBrut >= 11) breakH = 1.5;
    const dailyNet = Math.max(0, dailyBrut - breakH);
    const total = workDays === 7 && activeTab === "tatilli"
      ? 6 * dailyNet + Math.max(0, dailyNet - 7.5)
      : dailyNet * workDays;
    return Math.max(0, Math.round(total) - 45);
  }, [donemselState.summerPattern, workDays, activeTab, isDonemselHaftalik]);

  const computedDisplayRows = useMemo(() => {
    try {
      return computeDisplayRows({
        rows,
        manualRows,
        rowOverrides,
        katSayi: katSayi || 1,
        weeklyFMSaat: davaciWeeklyFM,
        exclusions,
        mode270,
        iseGiris: donemselState.dateIn,
        istenCikis: donemselState.dateOut,
        zamanasimiBaslangic,
        useRawWeeks: true,
      }) as FazlaMesaiRowBase[];
    } catch {
      return rows;
    }
  }, [rows, manualRows, rowOverrides, katSayi, davaciWeeklyFM, exclusions, mode270, donemselState.dateIn, donemselState.dateOut, zamanasimiBaslangic]);

  const totalBrut = useMemo(
    () => computedDisplayRows.reduce((a, r) => a + (r.fm ?? 0), 0),
    [computedDisplayRows]
  );
  const totalNet = useMemo(
    () => computedDisplayRows.reduce((a, r) => a + (r.net ?? 0), 0),
    [computedDisplayRows]
  );

  const brutNetResult = useMemo(() => {
    if (totalBrut <= 0) return { gelirVergisi: 0, damgaVergisi: 0, netYillik: 0, gelirVergisiDilimleri: "" };
    const sgk = Math.round(totalBrut * SSK_ORAN * 100) / 100;
    const issizlik = Math.round(totalBrut * ISSIZLIK_ORAN * 100) / 100;
    const gelirVergisi = Math.round(totalBrut * 0.15 * 100) / 100;
    const damgaVergisi = Math.round(totalBrut * DAMGA_VERGISI_ORANI * 100) / 100;
    const netYillik = Math.round((totalBrut - sgk - issizlik - gelirVergisi - damgaVergisi) * 100) / 100;
    return { gelirVergisi, damgaVergisi, netYillik, gelirVergisiDilimleri: "(%15)" };
  }, [totalBrut]);

  const mahsupNum = useMemo(() => {
    const s = String(mahsuplasmaMiktari || "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }, [mahsuplasmaMiktari]);

  const hakkaniyetIndirimi = totalBrut / 3;
  const sonNet = Math.max(0, totalBrut - hakkaniyetIndirimi - mahsupNum);

  const handleZamanasimiIptal = useCallback(() => setZamanasimi(null), []);

  const handleZamanaApply = useCallback(
    (p: { nihaiBaslangic: string }) => {
      setZamanasimi({ nihaiBaslangic: p.nihaiBaslangic });
      setShowZamanaModal(false);
    },
    []
  );

  const handleSave = useCallback(() => {
    kaydetAc({
      type: RECORD_TYPE,
      data: {
        form: {
          donemselState,
          weeklyDays,
          activeTab,
          katSayi,
          mode270,
          mahsuplasmaMiktari,
          zamanasimi,
          exclusions,
          manualRows,
          rowOverrides,
        },
        formValues: { donemselState, weeklyDays, activeTab, katSayi, mode270, mahsuplasmaMiktari, zamanasimi },
        totals: { toplam: totalBrut },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        donemselState,
        manualRows,
        rowOverrides,
      },
      name: currentRecordName,
      id: effectiveId,
      redirectPath: `${REDIRECT_BASE_PATH}/:id`,
    });
  }, [
    kaydetAc,
    RECORD_TYPE,
    REDIRECT_BASE_PATH,
    donemselState,
    weeklyDays,
    activeTab,
    katSayi,
    mode270,
    mahsuplasmaMiktari,
    zamanasimi,
    exclusions,
    manualRows,
    rowOverrides,
    totalBrut,
    brutNetResult.netYillik,
    currentRecordName,
    effectiveId,
  ]);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(REDIRECT_BASE_PATH);
  }, [effectiveId, navigate, REDIRECT_BASE_PATH]);

  const handleDavaciUpdate = useCallback(
    (updates: Partial<DonemselState>) => {
      setDonemselState((p) => ({ ...p, ...updates }));
    },
    []
  );

  const videoLink = getVideoLink(isDonemselHaftalik ? "fazla-donemsel-haftalik" : "fazla-donemsel");
  const isValid = Boolean(donemselState.dateIn && donemselState.dateOut);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış"],
      rows: [[formatDateTR(donemselState.dateIn), formatDateTR(donemselState.dateOut)]],
    });
    s.push({ id: "ust", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const cetvelHeaders = ["Tarih Aralığı", "Hafta", "Ücret", "Kat", "FM Saat", "Fazla Mesai"];
    const cetvelRows = computedDisplayRows.map((r) => [
      r.rangeLabel || "-",
      String(r.weeks ?? 0),
      fmt(r.brut ?? 0),
      String(r.katsayi ?? 1),
      String((r.fmHours ?? 0).toFixed(2)),
      fmt(r.fm ?? 0),
    ]);
    cetvelRows.push(["", "", "", "", "Toplam", fmt(totalBrut)]);
    const n2 = adaptToWordTable({ headers: cetvelHeaders, rows: cetvelRows });
    s.push({ id: "cetvel", title: "Fazla Mesai Hesaplama Cetveli", html: buildWordTable(n2.headers, n2.rows) });

    const brutNetRows: { label: string; value: string }[] = [
      { label: "Brüt Fazla Mesai", value: fmtCurrency(totalBrut) },
      { label: "SGK (%14)", value: `-${fmtCurrency(totalBrut * SSK_ORAN)}` },
      { label: "İşsizlik (%1)", value: `-${fmtCurrency(totalBrut * ISSIZLIK_ORAN)}` },
      { label: `Gelir Vergisi ${brutNetResult.gelirVergisiDilimleri || ""}`, value: `-${fmtCurrency(brutNetResult.gelirVergisi)}` },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtCurrency(brutNetResult.damgaVergisi)}` },
      { label: "Net Fazla Mesai", value: fmtCurrency(brutNetResult.netYillik) },
    ];
    const n3 = adaptToWordTable(brutNetRows);
    s.push({ id: "brutnet", title: "Brüt'ten Net'e", html: buildWordTable(n3.headers, n3.rows) });

    const mahsupRows: { label: string; value: string }[] = [
      { label: "Toplam Fazla Mesai (Brüt)", value: fmtCurrency(totalBrut) },
      { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtCurrency(hakkaniyetIndirimi)}` },
      { label: "Mahsuplaşma Miktarı", value: `-${fmtCurrency(mahsupNum)}` },
      { label: "Son Net Alacak", value: fmtCurrency(sonNet) },
    ];
    const n4 = adaptToWordTable(mahsupRows);
    s.push({ id: "mahsup", title: "Hakkaniyet İndirimi / Mahsuplaşma", html: buildWordTable(n4.headers, n4.rows) });

    return s;
  }, [
    donemselState.dateIn,
    donemselState.dateOut,
    computedDisplayRows,
    totalBrut,
    brutNetResult,
    hakkaniyetIndirimi,
    mahsupNum,
    sonNet,
  ]);

  return (
    <div className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors pb-20 sm:pb-6`} data-page={dataPageAttr}>
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
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

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className={sectionTitleCls}>Dönem ve Yaz/Kış Desen (Davacı)</h2>
              <SeasonalWorkPatternEditor
                variant={isDonemselHaftalik ? "haftalik" : "simple"}
                summerPattern={donemselState.summerPattern}
                winterPattern={donemselState.winterPattern}
                onSummerUpdate={(p) => handleDavaciUpdate({ summerPattern: p })}
                onWinterUpdate={(p) => handleDavaciUpdate({ winterPattern: p })}
                dateIn={donemselState.dateIn}
                dateOut={donemselState.dateOut}
                onDateInChange={(v) => handleDavaciUpdate({ dateIn: v })}
                onDateOutChange={(v) => handleDavaciUpdate({ dateOut: v })}
              />

              {!isDonemselHaftalik && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className={labelCls}>Haftada Çalışılan Gün</label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={weeklyDays}
                      onChange={(e) => setWeeklyDays(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {workDays === 7 && (
                    <div className="flex flex-col justify-end">
                      <label className={labelCls}>Hafta Tatili</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab("tatilsiz")}
                          className={`flex-1 min-w-0 sm:flex-none px-3 py-2 text-sm rounded border ${activeTab === "tatilsiz" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                        >
                          Hafta Tatilsiz
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("tatilli")}
                          className={`flex-1 min-w-0 sm:flex-none px-3 py-2 text-sm rounded border ${activeTab === "tatilli" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                        >
                          Hafta Tatilli
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isDonemselHaftalik && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Haftalık çalışma günü, her sezonda Grup 1 + Grup 2 gün toplamıdır. Toplam 7 gün olduğunda &quot;Hafta Tatili Var mı?&quot; ile hafta tatili fazla mesaisi seçilebilir (v1 ile aynı mantık).
                </p>
              )}
              <div className="mt-2 text-xs text-gray-500">
                Örnek FM (Yaz desen, davacı): <strong>{davaciWeeklyFM.toFixed(2)}</strong> saat/hafta
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className={sectionTitleCls}>Tanık Dönemleri (Yaz/Kış Desen)</h2>
              <WitnessSeasonalEditor
                variant={isDonemselHaftalik ? "haftalik" : "simple"}
                witnesses={donemselState.witnessesSeasons}
                onUpdate={(w) => setDonemselState((p) => ({ ...p, witnessesSeasons: w }))}
              />
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5">
              <h2 className={sectionTitleCls}>Ek Ayarlar</h2>
              <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 mt-2 mb-4 overflow-x-auto">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShow270Dropdown(!show270Dropdown)}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap"
                  >
                    {mode270 === "none" && "270 Saat"}
                    {mode270 === "detailed" && "270 Saat (Şirket)"}
                    {mode270 === "simple" && "270 Saat (Yargıtay)"}
                    <svg className={`w-3.5 h-3.5 transition-transform ${show270Dropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {show270Dropdown && (
                    <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1 text-xs">
                      <button type="button" onClick={() => { setMode270("none"); setShow270Dropdown(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${mode270 === "none" ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""}`}>Kapalı</button>
                      <button type="button" onClick={() => { setMode270("detailed"); setShow270Dropdown(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${mode270 === "detailed" ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""}`}>Şirket Uygulaması</button>
                      <button type="button" onClick={() => { setMode270("simple"); setShow270Dropdown(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${mode270 === "simple" ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""}`}>Yargıtay Uygulaması</button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => zamanasimiBaslangic ? handleZamanasimiIptal() : setShowZamanaModal(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap"
                >
                  {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowKatsayiModal(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap"
                >
                  Kat Sayı: {katSayi}
                </button>
              </div>
              <YillikIzinPanel exclusions={exclusions} setExclusions={setExclusions} showToastError={showToastError} />
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-3 sm:p-5 overflow-x-auto">
              <h2 className={sectionTitleCls}>Fazla Mesai Hesaplama Tablosu</h2>
              <div className="min-w-[480px]">
                <table className="w-full text-xs sm:text-sm border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left py-2 px-1.5 sm:px-2 whitespace-nowrap">Tarih Aralığı</th>
                      <th className="text-right py-2 px-1.5 sm:px-2">Hafta</th>
                      <th className="text-right py-2 px-1.5 sm:px-2">Ücret</th>
                      <th className="text-right py-2 px-1.5 sm:px-2">Kat</th>
                      <th className="text-right py-2 px-1.5 sm:px-2">FM Saat</th>
                      <th className="text-right py-2 px-1.5 sm:px-2">Fazla Mesai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedDisplayRows.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-1.5 px-1.5 sm:px-2 text-[11px] sm:text-sm max-w-[120px] sm:max-w-none truncate sm:whitespace-normal" title={r.rangeLabel || "-"}>{r.rangeLabel || "-"}</td>
                        <td className="text-right py-1.5 px-1.5 sm:px-2">{r.weeks ?? 0}</td>
                        <td className="text-right py-1.5 px-1.5 sm:px-2 whitespace-nowrap">{fmt(r.brut ?? 0)}</td>
                        <td className="text-right py-1.5 px-1.5 sm:px-2">{r.katsayi ?? 1}</td>
                        <td className="text-right py-1.5 px-1.5 sm:px-2">{(r.fmHours ?? 0).toFixed(2)}</td>
                        <td className="text-right py-1.5 px-1.5 sm:px-2 whitespace-nowrap">{fmt(r.fm ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-normal border-t-2 border-gray-200 dark:border-gray-600">
                      <td colSpan={5} className="py-2 px-1.5 sm:px-2 text-right">Toplam</td>
                      <td className="text-right py-2 px-1.5 sm:px-2">{fmt(totalBrut)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Brütten Nete</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-xs mt-2">
                <div className="flex justify-between py-1.5"><span>Brüt Fazla Mesai</span><span>{fmtCurrency(totalBrut)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>SGK (%14)</span><span>-{fmtCurrency(totalBrut * SSK_ORAN)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>İşsizlik (%1)</span><span>-{fmtCurrency(totalBrut * ISSIZLIK_ORAN)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>Gelir Vergisi {brutNetResult.gelirVergisiDilimleri}</span><span>-{fmtCurrency(brutNetResult.gelirVergisi)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>Damga Vergisi (Binde 7,59)</span><span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span></div>
                <div className="flex justify-between py-1.5 pt-2 font-normal text-green-700 dark:text-green-400"><span>Net Fazla Mesai</span><span>{fmtCurrency(brutNetResult.netYillik)}</span></div>
              </div>
            </section>

            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
              <h2 className="text-base font-normal text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet İndirimi / Mahsuplaşma</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-sm">
                <div className="flex justify-between py-1.5"><span>Toplam Fazla Mesai (Brüt)</span><span className="font-normal">{fmtCurrency(totalBrut)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>1/3 Hakkaniyet İndirimi</span><span>-{fmtCurrency(hakkaniyetIndirimi)}</span></div>
                <div className="flex flex-wrap gap-2 items-end py-1.5">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Mahsuplaşma Miktarı</label>
                    <input type="text" value={mahsuplasmaMiktari} onChange={(e) => setMahsuplasmaMiktari(e.target.value)} placeholder="0" className={`${inputCls} max-w-[160px]`} />
                  </div>
                  <button type="button" onClick={() => setShowMahsuplasamaModal(true)} className="px-3 py-2 text-sm rounded border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/30 shrink-0 self-end">
                    Mahsuplaşma Ekle
                  </button>
                </div>
                <div className="flex justify-between py-1.5 pt-2 font-normal"><span>Son Net Alacak</span><span>{fmtCurrency(sonNet)}</span></div>
              </div>
            </section>
          </div>
        </div>

        <div id={reportContentId} style={{ position: "absolute", left: "-9999px", top: 0, fontFamily: "Inter, Arial", color: "#111827", maxWidth: "16cm", padding: "0 12px" }} aria-hidden="true">
          <style>{`#${reportContentId} table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#${reportContentId} td,#${reportContentId} th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
          {wordTableSections.map((sec) => (
            <div key={sec.id} id={sec.id}>
              <h2 className="text-xs font-normal mb-1">{sec.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: sec.html }} />
            </div>
          ))}
        </div>

        <FooterActions
          replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
          onSave={handleSave}
          saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : (effectiveId ? "Güncelle" : "Kaydet")}
          saveButtonProps={{ disabled: isSaving }}
          previewButton={{
            title: PAGE_TITLE,
            copyTargetId: wordCopyId,
            hideWordDownload: true,
            renderContent: () => (
              <div>
                <style>{`.report-section-copy{margin-bottom:1.25rem}.report-section-copy .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem}.report-section-copy .section-title{font-weight:400;font-size:0.75rem;color:#374151}.report-section-copy .copy-icon-btn{background:transparent;border:none;cursor:pointer;padding:0.25rem;border-radius:0.375rem;color:#6b7280}.report-section-copy .copy-icon-btn:hover{background:#f3f4f6;color:#374151}#${wordCopyId} .section-content{border:none;overflow-x:auto;padding:0;margin:0}#${wordCopyId} table{border-collapse:collapse;width:100%;margin:0;font-size:0.75rem;color:#111827}#${wordCopyId} td,#${wordCopyId} th{border:1px solid #999;padding:5px 8px;background:#fff!important;color:#111827!important}`}</style>
                <div id={wordCopyId}>
                  {wordTableSections.map((sec) => (
                    <div key={sec.id} className="report-section-copy" data-section={sec.id}>
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
            onPdf: () => downloadPdfFromDOM(PAGE_TITLE, reportContentId),
          }}
        />
      </div>

      <ZamanasimiModal
        isOpen={showZamanaModal}
        onClose={() => setShowZamanaModal(false)}
        onApply={handleZamanaApply}
        form={zForm}
        setForm={setZForm}
        showToastError={showToastError}
        iseGiris={donemselState.dateIn}
      />
      <KatsayiModal
        open={showKatsayiModal}
        onClose={() => setShowKatsayiModal(false)}
        onApply={(k) => {
          setKatSayi(k);
          setShowKatsayiModal(false);
        }}
      />
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onClose={() => setShowMahsuplasamaModal(false)}
        onSave={(total) => setMahsuplasmaMiktari(String(total.toFixed(2)))}
        periodLabels={computedDisplayRows.map((r) => r.startISO || "").filter(Boolean)}
      />
    </div>
  );
}
