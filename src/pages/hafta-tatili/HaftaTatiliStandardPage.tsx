/**
 * Standart Hafta Tatili Alacağı Hesaplama
 * Modern, kompakt, %100 responsive.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, Youtube, Copy } from "lucide-react";
import FooterActions from "@/components/FooterActions";
import { getVideoLink } from "@/config/videoLinks";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { downloadPdfFromDOM } from "@/utils/pdfExport";
import { adaptToWordTable } from "@/utils/wordTableAdapter";
import { buildWordTable } from "@/utils/wordTableBuilder";
import { buildStyledReportTable } from "@/utils/styledReportTable";

import { useHaftaTatiliState, type HaftaTatiliTableRow } from "./state";
import { prepareHaftaTatiliStandardSave } from "./haftaTatiliSave";
import {
  calculateWeekCount,
  adjustWeekCountForSeasonalUsage,
  generateHaftaTatiliPeriods,
  getHaftaTatiliDaysForPeriod,
  fmtTR,
} from "./calculations";
import HaftaTatiliExpiryBox from "./HaftaTatiliExpiryBox";
import HaftaTatiliExcludeDays from "./HaftaTatiliExcludeDays";
import HaftaTatiliNetConversion from "./HaftaTatiliNetConversion";
import HaftaTatiliKatsayiModal from "./HaftaTatiliKatsayiModal";

const PAGE_TITLE = "Standart Hafta Tatili Alacağı";
const RECORD_TYPE = "hafta_tatili_standart";
const REDIRECT_BASE = "/hafta-tatili/standard";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

// ─── ROW HESAPLAMA ────────────────────────────────────────────────────────────

function recalcRow(row: HaftaTatiliTableRow): HaftaTatiliTableRow {
  const dailyWage = ((row.wage ?? 0) * (row.coefficient ?? 1)) / 30;
  const daily50 = Number((dailyWage * 1.5).toFixed(2));
  const haftaTatiliTotal = daily50 * (row.weekCount ?? 0);
  return { ...row, dailyWage, haftaTatiliTotal };
}

// ─── ANA COMPONENT ──────────────────────────────────────────────────────────

export default function HaftaTatiliStandardPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const pageStyle = usePageStyle();
  const { success, error: showError, info } = useToast();
  const { kaydetAc } = useKaydetContext();
  const videoLink = getVideoLink("hafta-standard");
  const loadedRef = useRef(false);

  const {
    currentRecordName, setCurrentRecordName,
    dateRanges, setDateRanges,
    selectedHolidayIds, setSelectedHolidayIds,
    haftaTatiliExpiryStart, setHaftaTatiliExpiryStart,
    haftaTatiliExcludedDays, setHaftaTatiliExcludedDays,
    haftaTatiliKullanimBaslangic, setHaftaTatiliKullanimBaslangic,
    haftaTatiliKullanimBitis, setHaftaTatiliKullanimBitis,
    haftaTatiliKullanimGunSayisi, setHaftaTatiliKullanimGunSayisi,
    haftaTatiliRows, setHaftaTatiliRows,
    showKatsayiModal, setShowKatsayiModal,
    hasCustomKatsayi, setHasCustomKatsayi,
    haftaTatiliNetSummary, setHaftaTatiliNetSummary,
  } = useHaftaTatiliState();


  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ─── TARİH ARALIK HANDLER ─────────────────────────────────────────────────

  const handleAddRange = () =>
    setDateRanges([...dateRanges, { id: Date.now().toString(), start: "", end: "" }]);

  const handleRemoveRange = (rid: string) => {
    if (dateRanges.length > 1) setDateRanges(dateRanges.filter((r) => r.id !== rid));
  };

  const handleUpdateRange = (rid: string, field: "start" | "end", val: string) => {
    let v = val;
    if (v && v.length > 10) {
      const parts = v.split("-");
      if (parts[0]?.length > 4) { parts[0] = parts[0].slice(0, 4); v = parts.join("-"); }
    }
    setDateRanges(dateRanges.map((r) => (r.id === rid ? { ...r, [field]: v } : r)));
  };

  // ─── CETVEL HESAPLAMA ─────────────────────────────────────────────────────

  const autoTableData = useMemo((): HaftaTatiliTableRow[] => {
    const all: Array<HaftaTatiliTableRow & { startISO: string }> = [];

    dateRanges.forEach((range) => {
      if (!range.start || !range.end) return;
      const effectiveStart = haftaTatiliExpiryStart
        ? new Date(range.start) > new Date(haftaTatiliExpiryStart)
          ? range.start
          : haftaTatiliExpiryStart
        : range.start;

      const periods = generateHaftaTatiliPeriods(effectiveStart, range.end);

      periods.forEach((p) => {
        const origWeek = calculateWeekCount(p.start, p.end, haftaTatiliExcludedDays);
        const weekCount = adjustWeekCountForSeasonalUsage(
          origWeek, p.start, p.end,
          haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi
        );
        const dailyWage = p.wage / 30;
        const daily50 = Number((dailyWage * 1.5).toFixed(2));
        const haftaTatiliDays = getHaftaTatiliDaysForPeriod(p.start, p.end, selectedHolidayIds, haftaTatiliExcludedDays);
        const haftaTatiliTotal = daily50 * weekCount;

        all.push({
          period: `${new Date(p.start).toLocaleDateString("tr-TR")} - ${new Date(p.end).toLocaleDateString("tr-TR")}`,
          weekCount,
          wage: p.wage,
          coefficient: 1,
          dailyWage,
          haftaTatiliDays,
          haftaTatiliTotal,
          startISO: p.start,
          endISO: p.end,
          manual: false,
        });
      });
    });

    return all.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
  }, [
    dateRanges, selectedHolidayIds, haftaTatiliExpiryStart, haftaTatiliExcludedDays,
    haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi,
  ]);

  useEffect(() => {
    setHaftaTatiliRows(autoTableData);
    setHasCustomKatsayi(false);
  }, [autoTableData]);

  // Kullanım bilgisi değişince otomatik olmayan satırları güncelle
  useEffect(() => {
    if (haftaTatiliRows.length === 0 || haftaTatiliKullanimGunSayisi === 4) return;
    setHaftaTatiliRows((prev) =>
      prev.map((row) => {
        if (row.manualWeekCount) return row;
        const s = row.startISO || "";
        const e = row.endISO || "";
        if (!s || !e) return row;
        const orig = calculateWeekCount(s, e, haftaTatiliExcludedDays);
        const adj = adjustWeekCountForSeasonalUsage(
          orig, s, e, haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi
        );
        const daily50 = Number((row.dailyWage * 1.5).toFixed(2));
        return { ...row, weekCount: adj, haftaTatiliTotal: daily50 * adj };
      })
    );
  }, [haftaTatiliKullanimBaslangic, haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi]);

  // ─── TOPLAM ───────────────────────────────────────────────────────────────

  const totalBrut = useMemo(
    () => haftaTatiliRows.reduce((s, r) => s + (r.haftaTatiliTotal ?? 0), 0),
    [haftaTatiliRows]
  );


  // ─── SATIR İŞLEMLERİ ─────────────────────────────────────────────────────

  const handleRowWeekChange = useCallback((i: number, val: string) => {
    const wc = Math.max(0, Number(val) || 0);
    setHaftaTatiliRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const daily50 = Number((r.dailyWage * 1.5).toFixed(2));
        return { ...r, weekCount: wc, haftaTatiliTotal: daily50 * wc, manualWeekCount: true };
      })
    );
  }, []);

  const handleRowWageChange = useCallback((i: number, val: string) => {
    const clean = val.replace(/\./g, "").replace(",", ".");
    const wage = Number(clean) || 0;
    setHaftaTatiliRows((prev) =>
      prev.map((r, idx) => (idx !== i ? r : recalcRow({ ...r, wage })))
    );
  }, []);

  const applyKatsayi = useCallback((k: number) => {
    const fixed = Number(k.toFixed(4));
    setHaftaTatiliRows((prev) => prev.map((r) => recalcRow({ ...r, coefficient: fixed })));
    setHasCustomKatsayi(fixed !== 1);
  }, []);

  const resetKatsayi = () => {
    setHaftaTatiliRows((prev) => prev.map((r) => recalcRow({ ...r, coefficient: 1 })));
    setHasCustomKatsayi(false);
  };

  const addManualRow = () => {
    setHaftaTatiliRows((prev) => [
      ...prev,
      { period: "", weekCount: 0, wage: 0, coefficient: 1, dailyWage: 0, haftaTatiliDays: 0, haftaTatiliTotal: 0, startISO: "", endISO: "", manual: true },
    ]);
  };

  const deleteRow = (i: number) => {
    if (haftaTatiliRows.length <= 1) return;
    setHaftaTatiliRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ─── YÜKLEME ─────────────────────────────────────────────────────────────

  const loadCalculation = useCallback(async (caseId: string) => {
    const loaded = await yukleHesap(caseId, RECORD_TYPE);
    if (!loaded.success || !loaded.data) {
      if (loaded.error) showError(loaded.error);
      return;
    }
    const form = loaded.data?.data?.form || loaded.data?.form || loaded.data;
    if (form.workerPeriods?.length) setDateRanges(form.workerPeriods);
    if (form.selectedHolidays) setSelectedHolidayIds(form.selectedHolidays);
    if (form.excludedDays) {
      setHaftaTatiliExcludedDays(
        form.excludedDays.map((d: any) => ({
          id: d.id || Math.random().toString(36).slice(2),
          type: d.type || "Diğer",
          start: d.start || "",
          end: d.end || "",
          days: d.days || 0,
        }))
      );
    }
    if (form.zamanasimi?.start) setHaftaTatiliExpiryStart(form.zamanasimi.start);
    if (form.haftaTatiliKullanim) {
      if (form.haftaTatiliKullanim.baslangic) setHaftaTatiliKullanimBaslangic(form.haftaTatiliKullanim.baslangic);
      if (form.haftaTatiliKullanim.bitis) setHaftaTatiliKullanimBitis(form.haftaTatiliKullanim.bitis);
      if (form.haftaTatiliKullanim.gunSayisi) setHaftaTatiliKullanimGunSayisi(form.haftaTatiliKullanim.gunSayisi);
    }
    if (form.periods?.length) setHaftaTatiliRows(form.periods);
    setCurrentRecordName(loaded.name || null);
    success("Kayıt yüklendi");
  }, []);

  useEffect(() => {
    if (id && !loadedRef.current) {
      loadedRef.current = true;
      loadCalculation(id);
    }
  }, [id]);

  // ─── KAYDET ──────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (haftaTatiliRows.length === 0) {
      showError("Hesaplanacak dönem bulunamadı. Lütfen tarih aralığı girin.");
      return;
    }
    const katsayi = haftaTatiliRows[0]?.coefficient ?? 1;
    const saveData = prepareHaftaTatiliStandardSave(
      dateRanges, selectedHolidayIds, haftaTatiliExcludedDays,
      haftaTatiliExpiryStart, haftaTatiliKullanimBaslangic,
      haftaTatiliKullanimBitis, haftaTatiliKullanimGunSayisi,
      haftaTatiliRows, totalBrut, haftaTatiliNetSummary, 0, katsayi
    );
    kaydetAc({
      hesapTuru: RECORD_TYPE,
      veri: saveData,
      mevcutId: id,
      mevcutKayitAdi: currentRecordName,
      varsayilanIsim: `Hafta Tatili Alacağı - ${new Date().toLocaleDateString("tr-TR")}`,
      redirectPath: `${REDIRECT_BASE}/:id`,
      onSuccess: (res) => { if (res?.name) setCurrentRecordName(res.name); },
    });
  };

  // ─── SIFIRLA ─────────────────────────────────────────────────────────────

  const handleNew = useCallback(() => {
    const hasData = dateRanges.some((r) => r.start || r.end) || haftaTatiliRows.length > 0;
    if (hasData && !window.confirm("Kaydedilmemiş veriler silinecek. Devam?")) return;
    setDateRanges([{ id: Date.now().toString(), start: "", end: "" }]);
    setSelectedHolidayIds([]);
    setHaftaTatiliExpiryStart(null);
    setHaftaTatiliExcludedDays([]);
    setHaftaTatiliKullanimBaslangic("");
    setHaftaTatiliKullanimBitis("");
    setHaftaTatiliKullanimGunSayisi(4);
    setHaftaTatiliRows([]);
    setCurrentRecordName(null);
    loadedRef.current = false;
    if (id) navigate(REDIRECT_BASE);
  }, [dateRanges, haftaTatiliRows, id, navigate]);

  // ─── RAPOR (WORD / PDF) ──────────────────────────────────────────────────

  const wordSections = useMemo(() => {
    const sections: Array<{ id: string; title: string; html: string; htmlForPdf: string }> = [];

    const validRanges = dateRanges.filter((r) => r.start && r.end);
    if (validRanges.length > 0) {
      const starts = validRanges.map((r) => new Date(r.start).getTime());
      const ends = validRanges.map((r) => new Date(r.end).getTime());
      const rows: [string, string][] = [
        ["İşe Giriş", new Date(Math.min(...starts)).toLocaleDateString("tr-TR")],
        ["İşten Çıkış", new Date(Math.max(...ends)).toLocaleDateString("tr-TR")],
      ];
      if (haftaTatiliExpiryStart)
        rows.push(["Zamanaşımı Başlangıcı", new Date(haftaTatiliExpiryStart).toLocaleDateString("tr-TR")]);
      const n = adaptToWordTable({ headers: ["Alan", "Değer"], rows });
      sections.push({ id: "bilgiler", title: "Genel Bilgiler", html: buildWordTable(n.headers, n.rows), htmlForPdf: buildStyledReportTable(n.headers, n.rows) });
    }

    if (haftaTatiliExcludedDays.length > 0) {
      const n = adaptToWordTable({
        headers: ["Tür", "Başlangıç", "Bitiş", "Gün"],
        rows: haftaTatiliExcludedDays.map((d) => [
          (d as any).type || "Diğer",
          d.start ? new Date(d.start).toLocaleDateString("tr-TR") : "-",
          d.end ? new Date(d.end).toLocaleDateString("tr-TR") : "-",
          String(d.days),
        ]),
      });
      sections.push({ id: "dislanabilir", title: "Dışlanabilir Günler", html: buildWordTable(n.headers, n.rows), htmlForPdf: buildStyledReportTable(n.headers, n.rows) });
    }

    if (haftaTatiliRows.length > 0) {
      const headers = ["Tarih (Ücret Dönemi)", "Hafta", "Ücret (BRÜT)", "Katsayı", "Günlük Brüt", "Günlük %50 Zamlı", "Hafta Tatili Ücreti"];
      const rows = haftaTatiliRows.map((r) => [
        r.period,
        String(r.weekCount),
        `${fmtTR(r.wage)} ₺`,
        r.coefficient.toFixed(4),
        `${fmtTR(r.dailyWage)} ₺`,
        `${fmtTR(Number((r.dailyWage * 1.5).toFixed(2)))} ₺`,
        `${fmtTR(r.haftaTatiliTotal)} ₺`,
      ]);
      rows.push(["Toplam", "", "", "", "", "", `${fmtTR(totalBrut)} ₺`]);
      const n = adaptToWordTable({ headers, rows });
      sections.push({ id: "cetvel", title: "Hafta Tatili Hesaplama Detayı", html: buildWordTable(n.headers, n.rows), htmlForPdf: buildStyledReportTable(n.headers, n.rows, { lastRowBg: "blue" }) });
    }

    const gnd = [
      { label: "Brüt Hafta Tatili Alacağı", value: `${fmtTR(haftaTatiliNetSummary.brut)} ₺` },
      { label: "SGK İşçi Primi (%14)", value: `-${fmtTR(haftaTatiliNetSummary.ssk)} ₺` },
      { label: "Gelir Vergisi", value: `-${fmtTR(haftaTatiliNetSummary.gelir)} ₺` },
      { label: "Damga Vergisi (Binde 7,59)", value: `-${fmtTR(haftaTatiliNetSummary.damga)} ₺` },
      { label: "Net Hafta Tatili Alacağı", value: `${fmtTR(haftaTatiliNetSummary.net)} ₺` },
    ];
    const ng = adaptToWordTable(gnd);
    sections.push({ id: "brutten-nete", title: "Brüt'ten Net'e Çeviri", html: buildWordTable(ng.headers, ng.rows), htmlForPdf: buildStyledReportTable(ng.headers, ng.rows, { lastRowBg: "green" }) });

    const mahsupNum = Number(String(haftaTatiliNetSummary.settleAmount || "0").replace(/\./g, "").replace(",", ".").replace("₺", "").trim()) || 0;
    const sonuc = Math.max(0, haftaTatiliNetSummary.brut - haftaTatiliNetSummary.hakkaniyet - mahsupNum);
    const md = [
      { label: "Net Hafta Tatili Alacağı", value: `${fmtTR(haftaTatiliNetSummary.brut)} ₺` },
      { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtTR(haftaTatiliNetSummary.hakkaniyet)} ₺` },
      { label: "Mahsuplaşma Miktarı", value: mahsupNum > 0 ? `-${fmtTR(mahsupNum)} ₺` : "0,00 ₺" },
      { label: "Mahsuplaşma Sonucu", value: `${fmtTR(sonuc)} ₺` },
    ];
    const nm = adaptToWordTable(md);
    sections.push({ id: "mahsuplasma", title: "Mahsuplaşma", html: buildWordTable(nm.headers, nm.rows), htmlForPdf: buildStyledReportTable(nm.headers, nm.rows, { lastRowBg: "blue" }) });

    return sections;
  }, [dateRanges, haftaTatiliExpiryStart, haftaTatiliExcludedDays, haftaTatiliRows, totalBrut, haftaTatiliNetSummary]);

  const handlePrint = () => {
    const el = document.getElementById("ht-report-content");
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${PAGE_TITLE}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#111827;padding:0;margin:0;font-size:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:avoid}th,td{border:1px solid #999;padding:4px 6px;font-size:10px}h2{font-size:12px;margin:8px 0 4px}button{display:none!important}</style></head><body>${el.innerHTML}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(html); doc.close();
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 400);
      };
    }
  };

  // ─── UI ──────────────────────────────────────────────────────────────────

  const earliestStart = dateRanges.filter((r) => r.start).map((r) => r.start).sort()[0];

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#8b5cf6" }} />
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3">

          {/* Video linki */}
          {videoLink && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(videoLink, "_blank")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800"
              >
                <Youtube className="w-3 h-3" /> Video
              </button>
            </div>
          )}

          {/* Ana kart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/50">
            <div className="p-3 sm:p-4 space-y-5">

              {/* ── 1. TARİH ARALIĞI ── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={sectionTitleCls}>İşe Giriş - Çıkış Tarihleri</h2>
                  <button
                    type="button"
                    onClick={handleAddRange}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-dashed border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  >
                    <Plus className="w-3 h-3" /> Dönem Ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {dateRanges.map((range) => (
                    <div key={range.id} className="flex items-end gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex-1 min-w-[140px]">
                        <label className={labelCls}>Başlangıç</label>
                        <input
                          type="date"
                          value={range.start}
                          onChange={(e) => handleUpdateRange(range.id, "start", e.target.value)}
                          onBlur={(e) => {
                            if (e.target.value && range.end && new Date(e.target.value) > new Date(range.end))
                              showError("Başlangıç tarihi bitiş tarihinden sonra olamaz");
                          }}
                          className={inputCls}
                          max="9999-12-31"
                        />
                      </div>
                      <span className="text-gray-400 pb-1.5">—</span>
                      <div className="flex-1 min-w-[140px]">
                        <label className={labelCls}>Bitiş</label>
                        <input
                          type="date"
                          value={range.end}
                          onChange={(e) => handleUpdateRange(range.id, "end", e.target.value)}
                          onBlur={(e) => {
                            if (e.target.value && range.start && new Date(e.target.value) < new Date(range.start))
                              showError("Bitiş tarihi başlangıç tarihinden önce olamaz");
                          }}
                          className={inputCls}
                          max="9999-12-31"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRange(range.id)}
                        disabled={dateRanges.length <= 1}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30"
                        aria-label="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── 2. DIŞLANAB. GÜNLER ── */}
              <HaftaTatiliExcludeDays
                excludedDays={haftaTatiliExcludedDays as any}
                onChange={setHaftaTatiliExcludedDays as any}
              />

              {/* ── 3. KULLANIM BİLGİSİ (MEVSIMSEL) ── */}
              <section>
                <h2 className={sectionTitleCls + " mb-2"}>Hafta Tatili Kullanım Bilgisi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Başlangıç (gg.aa, örn: 15.06)</label>
                    <input
                      type="text"
                      placeholder="15.06 — opsiyonel"
                      value={haftaTatiliKullanimBaslangic}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        if (v === "" || /^\d{0,2}\.?\d{0,2}$/.test(v)) setHaftaTatiliKullanimBaslangic(v);
                      }}
                      className={inputCls}
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Bitiş (gg.aa, örn: 15.10)</label>
                    <input
                      type="text"
                      placeholder="15.10 — opsiyonel"
                      value={haftaTatiliKullanimBitis}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        if (v === "" || /^\d{0,2}\.?\d{0,2}$/.test(v)) setHaftaTatiliKullanimBitis(v);
                      }}
                      className={inputCls}
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Ayda Kaç Gün</label>
                    <select
                      value={haftaTatiliKullanimGunSayisi}
                      onChange={(e) => setHaftaTatiliKullanimGunSayisi(Number(e.target.value))}
                      className={inputCls}
                    >
                      <option value={4}>4 gün (tam)</option>
                      <option value={3}>3 gün (%75)</option>
                      <option value={2}>2 gün (%50)</option>
                      <option value={1}>1 gün (%25)</option>
                    </select>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Boş bırakılırsa tüm çalışma süresi için uygulanır. Tarih girilirse her yıl tekrar eden mevsimsel dönem olarak işlem görür.
                </p>
              </section>

              {/* ── 4. HESAPLAMA TABLOSU ── */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h2 className={sectionTitleCls}>Hafta Tatili Hesaplama Tablosu</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <HaftaTatiliExpiryBox
                      expiryStart={haftaTatiliExpiryStart}
                      onChange={setHaftaTatiliExpiryStart}
                      onCancel={() => info("Zamanaşımı itirazı kaldırıldı")}
                      iseGiris={earliestStart}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKatsayiModal(true)}
                      className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Kat Sayı Hesapla
                    </button>
                    {hasCustomKatsayi && (
                      <button
                        type="button"
                        onClick={resetKatsayi}
                        className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      >
                        Kat Sayısını Kaldır
                      </button>
                    )}
                  </div>
                </div>

                {/* Tablo */}
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                        {["Tarih (Ücret Dönemi)", "Hafta", "Ücret (BRÜT) ₺", "Katsayı", "Günlük Brüt ₺", "Günlük %50 Zamlı ₺", "Hafta Tatili Ücreti ₺", ""].map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {haftaTatiliRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-2 py-4 text-center text-gray-400 dark:text-gray-500">
                            Tarih aralığı girin veya + Satır Ekle butonuna tıklayın
                          </td>
                        </tr>
                      ) : (
                        haftaTatiliRows.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-gray-100 dark:border-gray-700/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-800/50"}`}
                          >
                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.period || "-"}</td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={row.weekCount}
                                onChange={(e) => handleRowWeekChange(i, e.target.value)}
                                className="w-14 px-1.5 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                min="0"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={fmtTR(row.wage)}
                                onChange={(e) => handleRowWageChange(i, e.target.value)}
                                className="w-28 px-1.5 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{row.coefficient.toFixed(4)}</td>
                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{fmtTR(row.dailyWage)}</td>
                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{fmtTR(Number((row.dailyWage * 1.5).toFixed(2)))}</td>
                            <td className="px-2 py-1.5 font-medium text-indigo-700 dark:text-indigo-400">{fmtTR(row.haftaTatiliTotal)}</td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => deleteRow(i)}
                                disabled={haftaTatiliRows.length <= 1}
                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30"
                                aria-label="Sil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {haftaTatiliRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-gray-300 dark:border-gray-600 bg-indigo-50 dark:bg-indigo-900/20">
                          <td colSpan={6} className="px-2 py-2 font-semibold text-gray-700 dark:text-gray-300">Toplam</td>
                          <td className="px-2 py-2 font-bold text-indigo-700 dark:text-indigo-400">{fmtTR(totalBrut)} ₺</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <button
                  type="button"
                  onClick={addManualRow}
                  className="mt-2 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Satır Ekle
                </button>
              </section>

              {/* ── 5. BRÜTTEN NETE ── */}
              <HaftaTatiliNetConversion
                brutTotal={totalBrut}
                tableData={haftaTatiliRows}
                dateRanges={dateRanges}
                onSummaryChange={setHaftaTatiliNetSummary}
              />

              {/* ── NOTLAR ── */}
              <section>
                <h2 className={sectionTitleCls}>Notlar</h2>
                <div className="mt-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 text-[11px] font-light text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p>İş Kanunu'nun 46. maddesi gereğince, işçiye işe başladığı günden itibaren 7 günlük çalışma süresi için 1 günlük hafta tatili ücreti ödenir.</p>
                  <p>Hafta tatili ücreti çıplak günlük ücretin %50 fazlası olarak hesaplanır.</p>
                  <p>Zamanaşımı süresi 5 yıldır.</p>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>

      {/* Katsayı Modalı */}
      <HaftaTatiliKatsayiModal
        open={showKatsayiModal}
        onClose={() => setShowKatsayiModal(false)}
        onApply={applyKatsayi}
      />

      {/* Footer */}
      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={id ? "Güncelle" : "Kaydet"}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "ht-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`
                .ht-report-sec { margin-bottom: 1.25rem; }
                .ht-report-sec .sec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .ht-report-sec .sec-title { font-weight: 600; font-size: 0.75rem; color: #374151; }
                .ht-copy-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; border-radius: 0.375rem; color: #6b7280; }
                .ht-copy-btn:hover { background: #f3f4f6; color: #374151; }
                #ht-word-copy .sec-content { border: none; overflow-x: auto; padding: 0; margin: 0; }
                #ht-word-copy table { border-collapse: collapse; width: 100%; margin: 0; font-size: 0.75rem; color: #111827; }
                #ht-word-copy td, #ht-word-copy th { border: 1px solid #999; padding: 5px 8px; background: #fff !important; color: #111827 !important; white-space: nowrap; }
                #ht-word-copy td:last-child, #ht-word-copy th:last-child { text-align: right; width: 38%; }
              `}</style>
              <div id="ht-word-copy">
                {wordSections.map((sec) => (
                  <div key={sec.id} className="ht-report-sec report-section" data-section={sec.id}>
                    <div className="sec-header">
                      <span className="sec-title">{sec.title}</span>
                      <button
                        type="button"
                        className="ht-copy-btn"
                        onClick={async () => {
                          const ok = await copySectionForWord(sec.id);
                          if (ok) success("Kopyalandı");
                        }}
                        title="Word'e kopyala"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="sec-content" dangerouslySetInnerHTML={{ __html: sec.html }} />
                  </div>
                ))}
              </div>
            </div>
          ),
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "ht-report-content"),
        }}
      />

      {/* Yazdırma için gizli içerik */}
      <div style={{ display: "none" }}>
        <div id="ht-report-content" style={{ fontFamily: "Inter, Arial, sans-serif", color: "#111827", maxWidth: "16cm", padding: "0 12px" }}>
          <style>{`#ht-report-content table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:8px}#ht-report-content td,#ht-report-content th{border:1px solid #999;padding:5px 8px;font-size:10px}#ht-report-content h2{font-size:12px;font-weight:700;margin:10px 0 5px}`}</style>
          <div style={{ marginBottom: 10, fontSize: 10, color: "#6b7280" }}>{PAGE_TITLE} · {new Date().toLocaleDateString("tr-TR")}</div>
          {wordSections.map((sec) => (
            <div key={sec.id} data-section={sec.id} style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 6px", paddingBottom: 3, borderBottom: "1px solid #e5e7eb" }}>{sec.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: sec.htmlForPdf }} style={{ fontSize: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
