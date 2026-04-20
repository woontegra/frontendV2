/**
 * Haftalık Karma Fazla Mesai - Sıfırdan yazılmış
 * Haftalık desen (dayGroups) + davacı + tanıklar ile hesaplama
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";
import { yukleHesap } from "@/core/kaydet/kaydetServisi";
import {
  generateDynamicIntervalsFromWitnesses,
  splitByAsgariUcretPeriods,
  segmentOvertimeResult,
  getAsgariUcretByDate,
  calculateWeeksBetweenDates,
  clampToLastDayOfMonth,
  computeDisplayRows,
  buildWordTable,
  adaptToWordTable,
  copySectionForWord,
  downloadPdfFromDOM,
  buildMergedWitnessSegments,
  type FazlaMesaiRowBase,
} from "@modules/fazla-mesai/shared";
import { Copy, Trash2 } from "lucide-react";
import type { PatternDay, HaftalikKarmaWitness, HaftalikKarmaState, WitnessDayGroup } from "./types";
import WeeklyPatternEditor from "./WeeklyPatternEditor";
import {
  calculateWeeklyFMFromDayGroups,
  generateWeeklyText,
  representativeDailyNetFromDayGroups,
  fallbackDailyNetFromWeeklyFm,
  witnessWeeklyHolidayFromPlaintiffClaim,
  sumRegisteredWorkDays,
} from "./utils";
import { expandTanikliStandartRowsAnnualLeaveV2 } from "../tanikli-standart/tanikliStandartAnnualLeaveV2";
import { FAZLA_MESAI_DENOMINATOR, FAZLA_MESAI_KATSAYI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { DAMGA_VERGISI_ORANI } from "@/utils/fazlaMesai/tableDisplayPipeline";
import { calculateIncomeTaxWithBrackets } from "@/utils/incomeTaxCore";
import { YillikIzinPanel } from "../standart/YillikIzinPanel";
import { UbgtFmDayPicker } from "../standart/UbgtFmDayPicker";
import { ZamanasimiModal } from "../standart/ZamanasimiModal";
import { ZamanasimiCetvelBanner } from "../standart/ZamanasimiCetvelBanner";
import { KatsayiModal } from "../standart/KatsayiModal";
import { MahsuplasamaModal } from "../standart/MahsuplasamaModal";

/**
 * Tanık gün gruplarını davacı gruplarıyla grup indeksine göre saati kısıtlar.
 * Grup 1 → davacı grup 1, grup 2 → davacı grup 2 (v1 HaftalıkKarma ile aynı mantık).
 * Eşleşen davacı grubu yoksa tanık saatleri olduğu gibi bırakılır.
 */
function clampWitnessGroupsByIndex(
  witnessGroups: Array<{ days?: number; dayCount?: number; startTime: string; endTime: string }>,
  davaciGroups: PatternDay[]
): PatternDay[] {
  const toMins = (t: string) => {
    const [h, m] = (t || "0:0").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const toTime = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

  return witnessGroups.map((group, groupIdx) => {
    const dayCount = (group as { days?: number; dayCount?: number }).days ?? group.dayCount ?? 0;
    const davaciGroup = davaciGroups[groupIdx];
    if (!davaciGroup?.startTime || !davaciGroup?.endTime) {
      return { dayCount, startTime: group.startTime, endTime: group.endTime };
    }
    const kesikGir = Math.max(toMins(group.startTime), toMins(davaciGroup.startTime));
    const kesikCik = Math.min(toMins(group.endTime), toMins(davaciGroup.endTime));
    return { dayCount, startTime: toTime(kesikGir), endTime: toTime(kesikCik) };
  });
}

const PAGE_TITLE = "Haftalık Karma Fazla Mesai Hesaplama";
const RECORD_TYPE = "haftalik_karma_fazla_mesai";
const REDIRECT_BASE_PATH = "/fazla-mesai/haftalik-karma";

const SSK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

function formatDateTR(iso: string | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
/** Tutar + ₺ (sembol sağda: 47.858,46 ₺) */
function fmtCurrency(n: number): string {
  return `${(n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

const DEFAULT_DAY_GROUPS: PatternDay[] = [
  { dayCount: 0, startTime: "", endTime: "" },
  { dayCount: 0, startTime: "", endTime: "" },
];

export default function HaftalikKarmaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const pageStyle = usePageStyle();
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();

  const [haftalikKarmaState, setHaftalikKarmaState] = useState<HaftalikKarmaState>({
    weeklyStartDateISO: "",
    weeklyEndDateISO: "",
    dayGroups: [...DEFAULT_DAY_GROUPS],
    witnesses: [],
  });

  const [katSayi, setKatSayi] = useState(1);
  const [mode270, setMode270] = useState<"none" | "simple" | "detailed">("none");
  const [mahsuplasmaMiktari, setMahsuplasmaMiktari] = useState("");
  const [zamanasimi, setZamanasimi] = useState<{ nihaiBaslangic?: string } | null>(null);
  const [exclusions, setExclusions] = useState<Array<{ id: string; type: string; start: string; end: string; days: number }>>([]);
  /** Yıllık izin / UBGT V2: boş = tüm takvim günleri düşer; 0–6 = JS getDay (0 Pazar) hafta tatili — o gün düşümde sayılmaz. */
  const [haftaTatiliGunu, setHaftaTatiliGunu] = useState<number | "">("");
  const [currentRecordName, setCurrentRecordName] = useState<string | undefined>();
  const [show270Dropdown, setShow270Dropdown] = useState(false);
  const [showZamanaModal, setShowZamanaModal] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const [showKatsayiModal, setShowKatsayiModal] = useState(false);
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [manualRows, setManualRows] = useState<FazlaMesaiRowBase[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<FazlaMesaiRowBase>>>({});
  const DEBUG = searchParams.get("debug") === "1" || (typeof window !== "undefined" && !!(window as any).__FM_DEBUG_HAFTALIK__);
  if (DEBUG && typeof window !== "undefined") {
    (window as any).__FM_DEBUG_WEEKS__ = true;
    (window as any).__FM_DEBUG_PIPELINE__ = true;
    console.log("%c🔍 FM DEBUG AKTIF - Haftalık Karma (Tarayıcı konsolu F12)", "background:#222;color:#0f0;padding:4px 8px;font-weight:bold");
  }

  const zamanasimiBaslangic = zamanasimi?.nihaiBaslangic || null;

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
        const hk = raw.haftalikKarmaState || res.data?.haftalikKarmaState;
        if (hk) {
          setHaftalikKarmaState((p) => ({
            ...p,
            weeklyStartDateISO: hk.weeklyStartDateISO ?? p.weeklyStartDateISO,
            weeklyEndDateISO: hk.weeklyEndDateISO ?? p.weeklyEndDateISO,
            dayGroups: Array.isArray(hk.dayGroups) && hk.dayGroups.length > 0 ? hk.dayGroups : p.dayGroups,
            hasWeeklyHoliday: hk.hasWeeklyHoliday ?? p.hasWeeklyHoliday,
            weeklyHolidayGroup: hk.weeklyHolidayGroup ?? p.weeklyHolidayGroup,
            witnesses: Array.isArray(hk.witnesses)
              ? hk.witnesses.map((w: HaftalikKarmaWitness & { startTime?: string; endTime?: string; dayGroups?: Array<{ days?: number; dayCount?: number; startTime?: string; endTime?: string }> }) => {
                  const dg = w.dayGroups;
                  const hasNewFormat = dg && dg.length > 0 && typeof (dg[0]?.days ?? dg[0]?.dayCount) === "number";
                  const dayGroups: WitnessDayGroup[] = hasNewFormat
                    ? (dg as any[]).map((g: any) => ({
                        days: g.days ?? g.dayCount ?? 0,
                        startTime: g.startTime ?? "09:00",
                        endTime: g.endTime ?? "18:00",
                      }))
                    : [{ days: 6, startTime: w.startTime ?? "09:00", endTime: w.endTime ?? "18:00" }];
                  return {
                    id: w.id,
                    name: w.name,
                    startDateISO: w.startDateISO ?? "",
                    endDateISO: w.endDateISO ?? "",
                    dayGroups,
                  } as HaftalikKarmaWitness;
                })
              : p.witnesses,
          }));
        }
        const ks = raw.katSayi ?? res.data?.katSayi;
        if (ks != null) setKatSayi(ks);
        const m270 = raw.mode270 ?? res.data?.mode270;
        if (m270 != null) setMode270(m270);
        const mh = raw.mahsuplasmaMiktari ?? res.data?.mahsuplasmaMiktari;
        if (mh != null) setMahsuplasmaMiktari(mh ?? "");
        const zs = raw.zamanasimi ?? res.data?.zamanasimi;
        if (zs != null) setZamanasimi(zs);
        const ex = raw.exclusions ?? res.data?.exclusions;
        if (Array.isArray(ex)) {
          setExclusions(
            ex.map((x: Record<string, unknown>, i: number) => ({
              id: (x.id as string) || `load-${i}`,
              type: (x.type as string) || "Yıllık İzin",
              start: (x.start as string) || (x.startDate as string) || "",
              end: (x.end as string) || (x.endDate as string) || "",
              days: Number(x.days) || 0,
            }))
          );
        }
        const mr = raw.manualRows ?? res.data?.manualRows;
        if (Array.isArray(mr)) setManualRows(mr);
        const ro = raw.rowOverrides ?? res.data?.rowOverrides;
        if (ro && typeof ro === "object") setRowOverrides(ro);
        const htg = raw.haftaTatiliGunu ?? res.data?.haftaTatiliGunu;
        if (htg !== undefined && htg !== null) {
          setHaftaTatiliGunu(htg === "" ? "" : Number(htg));
        } else {
          setHaftaTatiliGunu("");
        }
        if (res.name) setCurrentRecordName(res.name);
        success("Kayıt yüklendi");
      })
      .catch((err) => {
        if (mounted) showToastError(err.message || "Kayıt yüklenemedi");
      });
    return () => {
      mounted = false;
    };
  }, [effectiveId, success, showToastError]);

  // fmHoursMap: her dönem (DAVACI, TANIK n) için haftalık FM saati
  const fmHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    const hasHoliday = haftalikKarmaState.hasWeeklyHoliday ?? false;
    const holidayGroup = haftalikKarmaState.weeklyHolidayGroup ?? 1;
    const davaciFM = calculateWeeklyFMFromDayGroups(
      haftalikKarmaState.dayGroups,
      hasHoliday,
      holidayGroup
    );
    map.set("DAVACI", davaciFM);

    const davaciGroupsForClamp = haftalikKarmaState.dayGroups;
    haftalikKarmaState.witnesses.forEach((w, idx) => {
      const rawGroups = w.dayGroups?.length
        ? (w.dayGroups as WitnessDayGroup[])
        : davaciGroupsForClamp.map((g) => ({ days: g.dayCount, startTime: g.startTime, endTime: g.endTime }));
      const wGroups = clampWitnessGroupsByIndex(rawGroups, davaciGroupsForClamp);
      const wHt = witnessWeeklyHolidayFromPlaintiffClaim({
        davaciDayGroups: davaciGroupsForClamp,
        davaciHasWeeklyHoliday: hasHoliday,
        davaciWeeklyHolidayGroup: holidayGroup,
        witnessDayGroups: wGroups,
      });
      const wFM = calculateWeeklyFMFromDayGroups(wGroups, wHt.hasWeeklyHoliday, wHt.weeklyHolidayGroup);
      const label = (w.name && String(w.name).trim()) || `TANIK ${idx + 1}`;
      map.set(label, wFM);
    });
    return map;
  }, [haftalikKarmaState.dayGroups, haftalikKarmaState.witnesses, haftalikKarmaState.hasWeeklyHoliday, haftalikKarmaState.weeklyHolidayGroup]);

  // Dönem etiketleri (interval → periodLabel)
  const allPeriodsForLabel = useMemo(() => {
    const list: Array<{ start: Date; end: Date; label: string }> = [];

    haftalikKarmaState.witnesses.forEach((w, idx) => {
      if (w.startDateISO && w.endDateISO) {
        const label = (w.name && String(w.name).trim()) || `TANIK ${idx + 1}`;
        list.push({
          start: new Date(w.startDateISO),
          end: new Date(w.endDateISO),
          label,
        });
      }
    });

    if (haftalikKarmaState.weeklyStartDateISO && haftalikKarmaState.weeklyEndDateISO) {
      list.push({
        start: new Date(haftalikKarmaState.weeklyStartDateISO),
        end: new Date(haftalikKarmaState.weeklyEndDateISO),
        label: "DAVACI",
      });
    }
    return list;
  }, [haftalikKarmaState.witnesses, haftalikKarmaState.weeklyStartDateISO, haftalikKarmaState.weeklyEndDateISO]);

  const getPeriodLabelForInterval = useCallback(
    (intervalStart: Date, intervalEnd: Date): string => {
      for (const p of allPeriodsForLabel) {
        if (p.start.getTime() <= intervalStart.getTime() && p.end.getTime() >= intervalEnd.getTime()) {
          return p.label;
        }
      }
      return "DAVACI";
    },
    [allPeriodsForLabel]
  );

  const davaciForInterval = useMemo(() => {
    const dg = haftalikKarmaState.dayGroups[0];
    return {
      startDate: haftalikKarmaState.weeklyStartDateISO,
      endDate: haftalikKarmaState.weeklyEndDateISO,
      startTime: dg?.startTime || "09:00",
      endTime: dg?.endTime || "18:00",
      haftalikGunSayisi: haftalikKarmaState.dayGroups.reduce((s, g) => s + (g.dayCount || 0), 0) || 6,
    };
  }, [
    haftalikKarmaState.weeklyStartDateISO,
    haftalikKarmaState.weeklyEndDateISO,
    haftalikKarmaState.dayGroups,
  ]);

  const splitWitnesses = useMemo(() => {
    const witnesses = haftalikKarmaState.witnesses.map((w) => {
      const g0 = (w.dayGroups?.[0] as WitnessDayGroup | undefined) || haftalikKarmaState.dayGroups[0];
      const inTime = g0?.startTime || "09:00";
      const outTime = g0?.endTime || "18:00";
      return {
        dateIn: w.startDateISO,
        dateOut: w.endDateISO,
        in: inTime,
        out: outTime,
      };
    });

    if (witnesses.length <= 1) return witnesses;

    const sorted = [...witnesses].sort((a, b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime());
    const split: typeof witnesses = [];

    sorted.forEach((w, idx) => {
      const wStart = new Date(w.dateIn);
      const wEnd = new Date(w.dateOut);

      // TanikliStandartPage splitWitnesses ile aynı: içeride başlayan + aynı başlangıçta sonraki indeks
      const overlaps = sorted.filter((other, otherIdx) => {
        if (otherIdx === idx) return false;
        const oStart = new Date(other.dateIn);
        return (
          (oStart > wStart && oStart < wEnd) ||
          (oStart.getTime() === wStart.getTime() && otherIdx > idx)
        );
      });

      if (overlaps.length === 0) {
        split.push(w);
      } else {
        let cur = wStart;
        overlaps.sort((a, b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime());

        for (const ov of overlaps) {
          const ovStart = new Date(ov.dateIn);
          const ovEnd = new Date(ov.dateOut);
          if (ovEnd.getTime() < cur.getTime()) continue;
          if (cur < ovStart) {
            const segEnd = new Date(ovStart);
            segEnd.setDate(segEnd.getDate() - 1);
            if (segEnd >= cur) {
              split.push({ ...w, dateIn: cur.toISOString().slice(0, 10), dateOut: segEnd.toISOString().slice(0, 10) });
            }
          }
          const next = new Date(ovEnd);
          next.setDate(next.getDate() + 1);
          cur = next;
        }
        if (cur <= wEnd) {
          split.push({ ...w, dateIn: cur.toISOString().slice(0, 10), dateOut: wEnd.toISOString().slice(0, 10) });
        }
      }
    });
    return split;
  }, [haftalikKarmaState.witnesses, haftalikKarmaState.dayGroups]);

  const intervals = useMemo(() => {
    // En az 1 day group gerekli (2 yerine 1: tek satırda da hesaplama çalışsın)
    if (!haftalikKarmaState.weeklyStartDateISO || !haftalikKarmaState.weeklyEndDateISO || haftalikKarmaState.dayGroups.length < 1) return [];
    const list = generateDynamicIntervalsFromWitnesses(davaciForInterval, splitWitnesses);
    if (!list?.length) {
      return [
        {
          start: new Date(haftalikKarmaState.weeklyStartDateISO),
          end: new Date(haftalikKarmaState.weeklyEndDateISO),
          start_time: davaciForInterval.startTime,
          end_time: davaciForInterval.endTime,
        },
      ];
    }
    return list;
  }, [haftalikKarmaState, davaciForInterval, splitWitnesses]);

  const rows = useMemo(() => {
    const davaciStart = haftalikKarmaState.weeklyStartDateISO;
    const davaciEnd   = haftalikKarmaState.weeklyEndDateISO;
    if (!davaciStart || !davaciEnd) return [];

    const kats = katSayi || 1;

    // Davacı gün grupları (kıyaslama tabanı)
    const davaciGroups = haftalikKarmaState.dayGroups;
    const hasHoliday = haftalikKarmaState.hasWeeklyHoliday ?? false;
    const holidayGroup = haftalikKarmaState.weeklyHolidayGroup ?? 1;

    // Tanıklar: TanikliStandartPage ile aynı mantık —
    //   1) hem tarih hem gün grubu zorunlu
    //   2) tanık saatleri davacı saatiyle kısıtlanır (Math.max giriş, Math.min çıkış)
    const witnesses = haftalikKarmaState.witnesses
      .filter((w) => {
        if (!w.startDateISO || !w.endDateISO) return false;
        return w.dayGroups?.some(
          (g) => (g.days ?? g.dayCount ?? 0) > 0 && g.startTime && g.endTime
        );
      })
      .map((w) => {
        const rawGroups = w.dayGroups?.length ? w.dayGroups : davaciGroups;
        // Her gün grubunu karşılık gelen davacı grubuyla kısıtla (grup indeksi bazlı, v1 ile aynı)
        const clampedGroups = clampWitnessGroupsByIndex(rawGroups, davaciGroups);
        const wHt = witnessWeeklyHolidayFromPlaintiffClaim({
          davaciDayGroups: davaciGroups,
          davaciHasWeeklyHoliday: hasHoliday,
          davaciWeeklyHolidayGroup: holidayGroup,
          witnessDayGroups: clampedGroups,
        });
        const wFM = calculateWeeklyFMFromDayGroups(clampedGroups, wHt.hasWeeklyHoliday, wHt.weeklyHolidayGroup);
        const repNet = representativeDailyNetFromDayGroups(
          clampedGroups,
          wHt.hasWeeklyHoliday,
          wHt.weeklyHolidayGroup
        );
        const dailyNet =
          repNet ??
          fallbackDailyNetFromWeeklyFm(wFM, clampedGroups, wHt.hasWeeklyHoliday, wHt.weeklyHolidayGroup);
        const workDays = sumRegisteredWorkDays(clampedGroups);
        const annualLeaveHg = Math.max(1, Math.min(7, workDays || 6));
        const annualLeaveSevenDay: "tatilli" | "tatilsiz" = wHt.hasWeeklyHoliday ? "tatilli" : "tatilsiz";
        return {
          startMs: new Date(w.startDateISO).getTime(),
          endMs: new Date(w.endDateISO).getTime(),
          fmHours: wFM,
          dailyNet,
          annualLeaveHg,
          annualLeaveSevenDay,
        };
      })
      .filter(
        (w) =>
          Number.isFinite(w.startMs) &&
          Number.isFinite(w.endMs) &&
          !Number.isNaN(w.startMs) &&
          !Number.isNaN(w.endMs)
      );

    // TanikliStandartPage ile aynı kaynak: buildMergedWitnessSegments (tarih/sınırlama birebir)
    const merged = buildMergedWitnessSegments(davaciStart, davaciEnd, witnesses);

    // Adım 4: Asgari ücret dönemlerine bölerek satır oluştur (TanikliStandartPage ile aynı)
    const generatedRows: Array<FazlaMesaiRowBase & { originalWeekCount?: number }> = [];

    merged.forEach((seg, segIdx) => {
      const periods = segmentOvertimeResult({ start: seg.start, end: seg.end });

      periods.forEach((period, periodIdx) => {
        let startDate = new Date(period.start);
        const endDate = new Date(period.end);

        if (zamanasimiBaslangic) {
          const limitDate = new Date(zamanasimiBaslangic);
          if (endDate < limitDate) return;
          if (startDate < limitDate && endDate >= limitDate) {
            startDate = new Date(limitDate);
            period.start = startDate.toISOString().slice(0, 10);
          }
        }

        const weeks = calculateWeeksBetweenDates(period.start, period.end) || 1;
        const brut = getAsgariUcretByDate(period.start) || 0;
        const fm = Number(((brut * kats * weeks * seg.fmHours) / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2);
        const net = Number((Number(fm) * (1 - DAMGA_VERGISI_ORANI - 0.15)).toFixed(2));

        generatedRows.push({
          id: `row-${period.start}-${period.end}-${segIdx}-${periodIdx}`,
          startISO: period.start,
          endISO: period.end,
          rangeLabel: `${formatDateTR(period.start)} – ${formatDateTR(period.end)}`,
          weeks,
          originalWeekCount: weeks,
          brut,
          katsayi: kats,
          fmHours: seg.fmHours,
          dailyNet: seg.dailyNet,
          annualLeaveHg: seg.annualLeaveHg,
          annualLeaveSevenDay: seg.annualLeaveSevenDay,
          fm,
          net,
        });
      });
    });

    if (generatedRows.length === 0) return [];

    const davaciHg = Math.max(
      1,
      Math.min(7, haftalikKarmaState.dayGroups.reduce((s, g) => s + (g.dayCount || 0), 0) || 6)
    );
    const davaciSevenDay: "tatilli" | "tatilsiz" =
      davaciHg === 7 && (haftalikKarmaState.hasWeeklyHoliday ?? false) ? "tatilli" : "tatilsiz";

    if (exclusions.length > 0) {
      const weeklyOffDayNum =
        haftaTatiliGunu === "" || haftaTatiliGunu == null ? null : Number(haftaTatiliGunu);
      const weeklyOffDay = Number.isInteger(weeklyOffDayNum) ? weeklyOffDayNum : null;
      return expandTanikliStandartRowsAnnualLeaveV2(
        generatedRows as Array<FazlaMesaiRowBase & { dailyNet?: number }>,
        exclusions,
        davaciHg,
        weeklyOffDay,
        davaciSevenDay
      );
    }

    return generatedRows;
  }, [haftalikKarmaState, fmHoursMap, katSayi, zamanasimiBaslangic, exclusions, haftaTatiliGunu]);

  /** UBGT kataloğu: davacı/tanık ham tarihleri değil, cetveldeki satırların birleşik aralığı. */
  const ubgtFmCatalogRange = useMemo(() => {
    let start = "";
    let end = "";
    const consider = (r: FazlaMesaiRowBase) => {
      const s = (r.startISO || "").slice(0, 10);
      const e = (r.endISO || "").slice(0, 10);
      if (!s || !e) return;
      if (!start || s < start) start = s;
      if (!end || e > end) end = e;
    };
    rows.forEach(consider);
    manualRows.forEach(consider);
    if (!start || !end || start > end) return { start: "", end: "" };
    return { start, end };
  }, [rows, manualRows]);

  const davaciWeeklyFM = fmHoursMap.get("DAVACI") ?? 0;

  /** Metin Hesaplaması - davacı + tanıklar için FM metni */
  const fmPeriods = useMemo(() => {
    const results: Array<{ label: string; text: string }> = [];
    const hasHoliday = haftalikKarmaState.hasWeeklyHoliday ?? false;
    const holidayGroup = haftalikKarmaState.weeklyHolidayGroup ?? 1;

    const davaciText = generateWeeklyText(haftalikKarmaState.dayGroups, "DAVACI", hasHoliday, holidayGroup);
    if (davaciText) results.push({ label: davaciText.label, text: davaciText.text });

    const davaciGroupsForPeriods = haftalikKarmaState.dayGroups;
    haftalikKarmaState.witnesses.forEach((w, idx) => {
      const rawGroups = w.dayGroups?.length
        ? (w.dayGroups as WitnessDayGroup[])
        : davaciGroupsForPeriods.map((g) => ({ days: g.dayCount, startTime: g.startTime, endTime: g.endTime }));
      const clampedGroups = clampWitnessGroupsByIndex(rawGroups, davaciGroupsForPeriods);
      const wName = (w.name && String(w.name).trim()) || `TANIK ${idx + 1}`;
      const wHt = witnessWeeklyHolidayFromPlaintiffClaim({
        davaciDayGroups: davaciGroupsForPeriods,
        davaciHasWeeklyHoliday: hasHoliday,
        davaciWeeklyHolidayGroup: holidayGroup,
        witnessDayGroups: clampedGroups,
      });
      const wText = generateWeeklyText(clampedGroups, wName, wHt.hasWeeklyHoliday, wHt.weeklyHolidayGroup);
      if (wText) results.push({ label: wText.label, text: wText.text });
    });

    return results;
  }, [haftalikKarmaState.dayGroups, haftalikKarmaState.witnesses, haftalikKarmaState.hasWeeklyHoliday, haftalikKarmaState.weeklyHolidayGroup]);

  const computedDisplayRows = useMemo(() => {
    try {
      if (DEBUG) console.log("[HaftalikKarma] computeDisplayRows öncesi - rowOverrides:", Object.keys(rowOverrides).length, "son satırlar:", rows.slice(-3).map((r) => ({ id: r.id, weeks: r.weeks })));
      const result = computeDisplayRows({
        rows: rows as FazlaMesaiRowBase[],
        manualRows,
        rowOverrides,
        katSayi: katSayi || 1,
        weeklyFMSaat: davaciWeeklyFM,
        exclusions,
        mode270,
        iseGiris: haftalikKarmaState.weeklyStartDateISO,
        istenCikis: haftalikKarmaState.weeklyEndDateISO,
        zamanasimiBaslangic,
        useRawWeeks: true,
        skipAnnualLeaveExclusions: exclusions.length > 0,
      }) as Array<{ fm: number; net: number } & FazlaMesaiRowBase>;
      if (DEBUG) {
        const zeros = result.filter((r) => (r.weeks ?? 0) <= 0);
        if (zeros.length) console.log("[HaftalikKarma] computeDisplayRows SONRASI - Hafta=0:", zeros.map((r) => ({ id: r.id, startISO: r.startISO, endISO: r.endISO })));
      }
      return result;
    } catch (e) {
      if (DEBUG) console.error("[HaftalikKarma] computeDisplayRows hata:", e);
      return rows;
    }
  }, [rows, manualRows, rowOverrides, katSayi, davaciWeeklyFM, exclusions, mode270, haftalikKarmaState, zamanasimiBaslangic]);

  /** Tanıklı Standart ile aynı: FM saati 0 olan otomatik bölüm satırları cetvelde gösterilmez */
  const tableDisplayRows = useMemo(
    () =>
      (computedDisplayRows as Array<{ fmHours?: number; fm?: number }>).filter(
        (r) => Number(r.fmHours ?? 0) !== 0
      ) as typeof computedDisplayRows,
    [computedDisplayRows]
  );

  const totalBrut = useMemo(() => tableDisplayRows.reduce((a, r) => a + (r.fm ?? 0), 0), [tableDisplayRows]);
  const totalNet = useMemo(() => tableDisplayRows.reduce((a, r) => a + (r.net ?? 0), 0), [tableDisplayRows]);

  const exitYear = haftalikKarmaState.weeklyEndDateISO
    ? new Date(haftalikKarmaState.weeklyEndDateISO).getFullYear()
    : new Date().getFullYear();
  const brutNetResult = useMemo(() => {
    if (totalBrut <= 0) return { gelirVergisi: 0, damgaVergisi: 0, netYillik: 0, gelirVergisiDilimleri: "" };
    const sgk = Math.round(totalBrut * SSK_ORAN * 100) / 100;
    const issizlik = Math.round(totalBrut * ISSIZLIK_ORAN * 100) / 100;
    const matrah = Math.max(0, totalBrut - sgk - issizlik);
    const gvResult = calculateIncomeTaxWithBrackets(exitYear, matrah);
    const gelirVergisi = Math.round(gvResult.tax * 100) / 100;
    const damgaVergisi = Math.round(totalBrut * DAMGA_VERGISI_ORANI * 100) / 100;
    const netYillik = Math.round((totalBrut - sgk - issizlik - gelirVergisi - damgaVergisi) * 100) / 100;
    return {
      gelirVergisi,
      damgaVergisi,
      netYillik,
      gelirVergisiDilimleri: gvResult.brackets,
    };
  }, [totalBrut, exitYear]);

  const mahsupNum = useMemo(() => {
    const s = String(mahsuplasmaMiktari || "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }, [mahsuplasmaMiktari]);

  const hakkaniyetIndirimi = totalBrut / 3;
  const sonNet = Math.max(0, totalBrut - hakkaniyetIndirimi - mahsupNum);
  const hasCustomKatsayi = (katSayi ?? 1) !== 1 && (katSayi ?? 1) > 0;

  const handleZamanasimiIptal = useCallback(() => setZamanasimi(null), []);

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
    []
  );

  const addRow = useCallback(
    (afterRowId?: string) => {
      setManualRows((prev) => [
        ...prev,
        {
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          startISO: "",
          endISO: "",
          rangeLabel: "",
          weeks: 0,
          originalWeekCount: 0,
          brut: 0,
          katsayi: katSayi ?? 1,
          fmHours: 0,
          fm: 0,
          net: 0,
          isManual: true,
          insertAfter: afterRowId,
        } as FazlaMesaiRowBase,
      ]);
    },
    [katSayi]
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

  const handleDayGroupsUpdate = useCallback((days: PatternDay[]) => {
    setHaftalikKarmaState((p) => ({ ...p, dayGroups: days }));
  }, []);

  const handleAddWitness = useCallback(() => {
    const nextId = haftalikKarmaState.witnesses.reduce((max, w) => Math.max(max, w.id, 0), 0) + 1;
    const newWitness: HaftalikKarmaWitness = {
      id: nextId,
      name: `Tanık ${nextId}`,
      startDateISO: "",
      endDateISO: "",
      dayGroups: [{ days: 0, startTime: "", endTime: "" }],
    };
    setHaftalikKarmaState((p) => ({ ...p, witnesses: [...p.witnesses, newWitness] }));
  }, [haftalikKarmaState.witnesses]);

  const handleRemoveWitness = useCallback((id: number) => {
    setHaftalikKarmaState((p) => ({ ...p, witnesses: p.witnesses.filter((w) => w.id !== id) }));
  }, []);

  const handleWitnessUpdate = useCallback((id: number, updates: Partial<HaftalikKarmaWitness>) => {
    setHaftalikKarmaState((p) => ({
      ...p,
      witnesses: p.witnesses.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }));
  }, []);

  const handleNew = useCallback(() => {
    if (effectiveId) navigate(REDIRECT_BASE_PATH);
  }, [effectiveId, navigate]);

  const handleSave = useCallback(() => {
    kaydetAc({
      type: RECORD_TYPE,
      data: {
        form: {
          haftalikKarmaState,
          katSayi,
          mode270,
          mahsuplasmaMiktari,
          zamanasimi,
          exclusions,
          manualRows,
          rowOverrides,
          haftaTatiliGunu,
        },
        formValues: { haftalikKarmaState, katSayi, mode270, mahsuplasmaMiktari, zamanasimi, haftaTatiliGunu },
        totals: { toplam: totalBrut },
        brut_total: totalBrut,
        net_total: brutNetResult.netYillik,
        exclusions,
        mode270,
        katSayi,
        mahsuplasmaMiktari,
        haftalikKarmaState,
        manualRows,
        rowOverrides,
        haftaTatiliGunu,
      },
      name: currentRecordName,
      id: effectiveId,
      redirectPath: `${REDIRECT_BASE_PATH}/:id`,
    });
  }, [
    kaydetAc,
    haftalikKarmaState,
    katSayi,
    mode270,
    mahsuplasmaMiktari,
    zamanasimi,
    exclusions,
    manualRows,
    rowOverrides,
    haftaTatiliGunu,
    totalBrut,
    brutNetResult.netYillik,
    currentRecordName,
    effectiveId,
  ]);

  const wordTableSections = useMemo(() => {
    const s: Array<{ id: string; title: string; html: string }> = [];
    const n1 = adaptToWordTable({
      headers: ["İşe Giriş", "İşten Çıkış", "Haftalık FM Saat"],
      rows: [[haftalikKarmaState.weeklyStartDateISO ? formatDateTR(haftalikKarmaState.weeklyStartDateISO) : "-", haftalikKarmaState.weeklyEndDateISO ? formatDateTR(haftalikKarmaState.weeklyEndDateISO) : "-", String(davaciWeeklyFM.toFixed(2))]],
    });
    s.push({ id: "ust", title: "Genel Bilgiler", html: buildWordTable(n1.headers, n1.rows) });

    const cetvelHeaders = ["Tarih Aralığı", "Hafta", "Ücret", "Kat Sayı", "FM Saat", "225", "1,5", "Fazla Mesai"];
    const cetvelRows = tableDisplayRows.map((r) => [
      (r.rangeLabel || (r.startISO && r.endISO ? `${formatDateTR(r.startISO)} – ${formatDateTR(r.endISO)}` : "")) || "-",
      String((r as any).displayWeeks ?? r.weeks ?? 0),
      fmt(r.brut ?? 0),
      String(r.katsayi ?? 1),
      String((r.fmHours ?? 0).toFixed(2)),
      "225",
      "1,5",
      fmt(r.fm ?? 0),
    ]);
    cetvelRows.push(["", "", "", "", "", "Toplam", "", fmt(totalBrut)]);
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

    const mahsupNum = Number(String(mahsuplasmaMiktari || "").replace(/\./g, "").replace(",", ".")) || 0;
    {
      const hakkaniyetIndirimi = totalBrut / 3;
      const sonNet = brutNetResult.netYillik - mahsupNum;
      const mahsupRows: { label: string; value: string }[] = [
        { label: "Toplam Fazla Mesai (Brüt)", value: fmtCurrency(totalBrut) },
        { label: "1/3 Hakkaniyet İndirimi", value: `-${fmtCurrency(hakkaniyetIndirimi)}` },
        ...(mahsupNum > 0 ? [{ label: "Mahsuplaşma Miktarı", value: `-${fmtCurrency(mahsupNum)}` }] : []),
        { label: "Son Net Alacak", value: fmtCurrency(sonNet) },
      ];
      const n4 = adaptToWordTable(mahsupRows);
      s.push({ id: "mahsup", title: "Mahsuplaşma", html: buildWordTable(n4.headers, n4.rows) });
    }

    return s;
  }, [
    haftalikKarmaState.weeklyStartDateISO,
    haftalikKarmaState.weeklyEndDateISO,
    davaciWeeklyFM,
    tableDisplayRows,
    totalBrut,
    brutNetResult,
    mahsuplasmaMiktari,
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

  const videoLink = getVideoLink("fazla-haftalik-karma");

  const isValid = Boolean(
    haftalikKarmaState.weeklyStartDateISO &&
      haftalikKarmaState.weeklyEndDateISO &&
      haftalikKarmaState.dayGroups.length >= 2 &&
      haftalikKarmaState.dayGroups[0]?.startTime &&
      haftalikKarmaState.dayGroups[0]?.endTime
  );

  return (
    <div className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`} data-page="fazla-mesai-haftalik-karma">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {videoLink && (
          <div className="flex justify-end mb-4">
            <a href={videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              Kullanım Videosu İzle
            </a>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" aria-hidden />
          <div className="p-4 sm:p-5 space-y-5">
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30">
              <h2 className={sectionTitleCls}>Dönem ve Haftalık Desen</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className={labelCls}>İşe Giriş</label>
                  <input
                    type="date"
                    value={haftalikKarmaState.weeklyStartDateISO}
                    onChange={(e) => setHaftalikKarmaState((p) => ({ ...p, weeklyStartDateISO: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>İşten Çıkış</label>
                  <input
                    type="date"
                    value={haftalikKarmaState.weeklyEndDateISO}
                    onChange={(e) => setHaftalikKarmaState((p) => ({ ...p, weeklyEndDateISO: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="mt-4">
                <WeeklyPatternEditor days={haftalikKarmaState.dayGroups} onUpdate={handleDayGroupsUpdate} />
              </div>

              {/* Hafta Tatili Var mı? - Sadece toplam 7 gün olduğunda göster */}
              {haftalikKarmaState.dayGroups.reduce((s, g) => s + (g.dayCount || 0), 0) === 7 && (
                <div className="mt-3 p-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={haftalikKarmaState.hasWeeklyHoliday ?? false}
                      onChange={(e) =>
                        setHaftalikKarmaState((p) => ({ ...p, hasWeeklyHoliday: e.target.checked }))
                      }
                      className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Hafta Tatili Var mı?
                    </span>
                  </label>
                  {haftalikKarmaState.hasWeeklyHoliday && (
                    <div className="mt-2 ml-6">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Hafta tatili hangi gruba dahil?
                      </label>
                      <select
                        value={haftalikKarmaState.weeklyHolidayGroup ?? 1}
                        onChange={(e) =>
                          setHaftalikKarmaState((p) => ({
                            ...p,
                            weeklyHolidayGroup: parseInt(e.target.value, 10) as 1 | 2,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value={1}>Grup 1</option>
                        <option value={2}>Grup 2</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 text-xs text-gray-500">
                Haftalık FM Saati (Davacı): <strong>{davaciWeeklyFM.toFixed(2)}</strong> (45 saat üzeri)
              </div>
            </section>

            {/* Tanıklar - Eski sayfa yapısı: İşe Giriş/İşten Çıkış + Gün Grupları */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className={sectionTitleCls}>Tanık Dönemleri</h2>
                <button
                  type="button"
                  onClick={handleAddWitness}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                >
                  Tanık Ekle
                </button>
              </div>
              {haftalikKarmaState.witnesses.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Henüz tanık eklenmedi.</p>
              ) : (
                <div className="space-y-4">
                  {haftalikKarmaState.witnesses.map((w, idx) => (
                    <div key={w.id} className="rounded-lg border border-green-200 dark:border-green-700 p-4 space-y-3 bg-green-50/70 dark:bg-green-900/20">
                      {/* Tanık adı ve sil butonu */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <input
                          type="text"
                          value={w.name ?? ""}
                          onChange={(e) => handleWitnessUpdate(w.id, { name: e.target.value })}
                          placeholder={`Tanık ${idx + 1}`}
                          className="min-w-0 flex-1 text-sm font-semibold border-b-2 border-green-400 dark:border-green-600 px-2 py-1 bg-transparent focus:outline-none focus:border-green-600 dark:focus:border-green-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveWitness(w.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Tarih alanları: İşe Giriş, İşten Çıkış */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>İşe Giriş</label>
                          <input
                            type="date"
                            value={w.startDateISO}
                            onChange={(e) => handleWitnessUpdate(w.id, { startDateISO: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>İşten Çıkış</label>
                          <input
                            type="date"
                            value={w.endDateISO}
                            onChange={(e) => handleWitnessUpdate(w.id, { endDateISO: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      {/* Gün Grupları */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Gün Grupları</label>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Toplam: <span className="font-semibold text-green-600 dark:text-green-400">
                              {w.dayGroups.reduce((sum, g) => sum + (g.days || 0), 0)}
                            </span> gün
                          </span>
                        </div>
                        <div className="space-y-2">
                          {w.dayGroups.map((group, gIdx) => (
                            <div key={`${w.id}-${gIdx}`} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Gün Sayısı</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={7}
                                    value={group.days === 0 ? "" : group.days}
                                    onChange={(e) => {
                                      const requested = parseInt(e.target.value, 10) || 0;
                                      const otherSum = w.dayGroups.reduce(
                                        (s, g, i) => (i !== gIdx ? s + (g.days || 0) : s),
                                        0
                                      );
                                      const maxForThis = Math.max(0, 7 - otherSum);
                                      const capped = Math.min(Math.max(0, requested), maxForThis);
                                      const newGroups = [...w.dayGroups];
                                      newGroups[gIdx] = { ...group, days: capped };
                                      handleWitnessUpdate(w.id, { dayGroups: newGroups });
                                    }}
                                    className={inputCls}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Başlangıç</label>
                                  <input
                                    type="time"
                                    value={group.startTime}
                                    onChange={(e) => {
                                      const newGroups = [...w.dayGroups];
                                      newGroups[gIdx] = { ...group, startTime: e.target.value };
                                      handleWitnessUpdate(w.id, { dayGroups: newGroups });
                                    }}
                                    className={inputCls}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Bitiş</label>
                                  <input
                                    type="time"
                                    value={group.endTime}
                                    onChange={(e) => {
                                      const newGroups = [...w.dayGroups];
                                      newGroups[gIdx] = { ...group, endTime: e.target.value };
                                      handleWitnessUpdate(w.id, { dayGroups: newGroups });
                                    }}
                                    className={inputCls}
                                  />
                                </div>
                              </div>
                              {w.dayGroups.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newGroups = w.dayGroups.filter((_, i) => i !== gIdx);
                                    handleWitnessUpdate(w.id, { dayGroups: newGroups });
                                  }}
                                  className="self-start sm:self-center shrink-0 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center justify-center"
                                  title="Sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newGroups = [...w.dayGroups, { days: 0, startTime: "", endTime: "" }];
                            handleWitnessUpdate(w.id, { dayGroups: newGroups });
                          }}
                          className="mt-2 w-full px-2 py-1 text-xs text-green-600 dark:text-green-400 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/30 border border-green-300 dark:border-green-700 rounded"
                        >
                          + Grup Ekle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Metin Hesaplaması */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <details className="group" open>
                <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between list-none">
                  <span>Metin Hesaplaması</span>
                  <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <style>{`
                  details summary::-webkit-details-marker { display: none; }
                  details summary::marker { display: none; }
                `}</style>
                <div className="p-4">
                  {fmPeriods.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {fmPeriods.map((p, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 leading-relaxed whitespace-pre-line text-xs font-serif text-gray-800 dark:text-gray-200">
                          {p.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 text-sm">
                      Gün gruplarını doldurarak haftalık fazla mesai metnini görebilirsiniz.
                    </div>
                  )}
                </div>
              </details>
            </section>

            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800 px-4 py-3 shadow-sm">
                <label className={`${labelCls} mb-1`}>Hafta tatili günü (yıllık izin / UBGT düşümü)</label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                  Seçilmezse işaretlenen her takvim günü düşüme girer. Bir gün seçilirse, o haftanın tatil günü dışlamada sayılmaz (Tanıklı Standart ile aynı).
                </p>
                <select
                  value={haftaTatiliGunu === "" || haftaTatiliGunu == null ? "" : String(haftaTatiliGunu)}
                  onChange={(e) =>
                    setHaftaTatiliGunu(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={`${inputCls} text-xs max-w-md`}
                >
                  <option value="">Seçilmedi (tüm günlerde düşüm)</option>
                  <option value="1">Pazartesi</option>
                  <option value="2">Salı</option>
                  <option value="3">Çarşamba</option>
                  <option value="4">Perşembe</option>
                  <option value="5">Cuma</option>
                  <option value="6">Cumartesi</option>
                  <option value="0">Pazar</option>
                </select>
              </div>
              <YillikIzinPanel exclusions={exclusions} setExclusions={setExclusions} success={success} showToastError={showToastError} />
              <UbgtFmDayPicker
                rangeStart={ubgtFmCatalogRange.start}
                rangeEnd={ubgtFmCatalogRange.end}
                exclusions={exclusions}
                setExclusions={setExclusions}
                showToastError={showToastError}
              />
            </div>

            {/* 270 Saat, Zamanaşımı, Kat Sayı - Hesaplama cetvelinin hemen üstünde */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShow270Dropdown(!show270Dropdown)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {mode270 === "none" && "270 Saat Düşüm"}
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {zamanasimiBaslangic ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
              </button>
              <button
                type="button"
                onClick={() => hasCustomKatsayi ? setKatSayi(1) : setShowKatsayiModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {hasCustomKatsayi ? `Katsayı ${(katSayi ?? 1).toFixed(2)}` : "Kat Sayı Hesapla"}
              </button>
            </div>

            {/* Hesaplama Cetveli */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                <h2 className={sectionTitleCls}>Fazla Mesai Hesaplama Cetveli</h2>
              </div>
              <ZamanasimiCetvelBanner nihaiBaslangic={zamanasimiBaslangic} />
              <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse font-sans table-fixed text-gray-900 dark:text-gray-100" style={{ minWidth: "640px" }}>
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
                {tableDisplayRows.length === 0 ? (
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
                  tableDisplayRows.map((r: any, i: number) => {
                    const tableInputCls = "w-full min-w-0 px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right";
                    const startISO = r.startISO ?? "";
                    const endISO = r.endISO ?? "";
                    const weeksVal = (r as any).displayWeeks ?? r.weeks ?? 0;
                    const fmHoursVal = r.fmHours ?? 0;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50" onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)}>
                        <td className="px-1 py-1 border border-gray-200 dark:border-gray-600 align-top">
                          <div className="flex items-center gap-1">
                            <input type="date" value={startISO} onChange={(e) => {
                                const raw = e.target.value || "";
                                handleRowOverride(r.id, { startISO: raw ? clampToLastDayOfMonth(raw) : undefined });
                              }} className={`${tableInputCls} flex-1 min-w-0`} title="Başlangıç tarihi" />
                            <span className="text-gray-400 shrink-0">–</span>
                            <input type="date" value={endISO} onChange={(e) => {
                                const raw = e.target.value || "";
                                handleRowOverride(r.id, { endISO: raw ? clampToLastDayOfMonth(raw) : undefined });
                              }} className={`${tableInputCls} flex-1 min-w-0`} title="Bitiş tarihi" />
                          </div>
                            {r.yillikIzinAciklama ? (
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                                {r.yillikIzinAciklama}
                              </div>
                            ) : null}
                        </td>
                        <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                          <input type="number" min={0} value={weeksVal} onChange={(e) => handleRowOverride(r.id, { weeks: parseInt(e.target.value, 10) || 0 })} className={tableInputCls} />
                        </td>
                        <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                          <input type="number" min={0} value={r.brut ?? 0} onChange={(e) => handleRowOverride(r.id, { brut: parseFloat(e.target.value) || 0 })} className={tableInputCls} />
                        </td>
                        <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">{(r.katsayi ?? 1).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                        <td className="px-1 py-1 border border-gray-200 dark:border-gray-600">
                          <input type="number" min={0} step={0.01} value={fmHoursVal} onChange={(e) => handleRowOverride(r.id, { fmHours: parseFloat(e.target.value) || 0 })} className={tableInputCls} />
                        </td>
                        <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">225</td>
                        <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right">1,5</td>
                        <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 text-right font-medium whitespace-nowrap">{fmt(r.fm ?? 0)}</td>
                        <td className="px-2 py-1 border border-gray-200 dark:border-gray-600 w-16 text-center">
                          {hoveredRow === i && (
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => addRow(r.id)} className="w-6 h-6 rounded flex items-center justify-center text-orange-600 hover:bg-orange-50 font-medium" title="Altına satır ekle">+</button>
                              <button type="button" onClick={() => removeRow(r.id)} disabled={computedDisplayRows.length <= 1} className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-40 font-medium" title={computedDisplayRows.length <= 1 ? "En az 1 satır kalmalı" : "Satırı sil"}>−</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {tableDisplayRows.length > 0 && (
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

            {/* Brütten Nete */}
            <section className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
              <h2 className={sectionTitleCls}>Brütten Nete Çevir</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-xs mt-2">
                <div className="flex justify-between py-1.5"><span>Brüt Fazla Mesai</span><span>{fmtCurrency(totalBrut)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>SGK (%14)</span><span>-{fmtCurrency(totalBrut * SSK_ORAN)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>İşsizlik (%1)</span><span>-{fmtCurrency(totalBrut * ISSIZLIK_ORAN)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>Gelir Vergisi {brutNetResult.gelirVergisiDilimleri}</span><span>-{fmtCurrency(brutNetResult.gelirVergisi)}</span></div>
                <div className="flex justify-between py-1.5 text-red-600 dark:text-red-400"><span>Damga Vergisi (Binde 7,59)</span><span>-{fmtCurrency(brutNetResult.damgaVergisi)}</span></div>
                <div className="flex justify-between py-1.5 pt-2 font-semibold text-green-700 dark:text-green-400"><span>Net Fazla Mesai</span><span>{fmtCurrency(brutNetResult.netYillik)}</span></div>
              </div>
            </section>

            {/* Hakkaniyet İndirimi / Mahsuplaşma */}
            <section className="rounded-xl border border-pink-200 dark:border-pink-800 p-4 sm:p-5 bg-pink-50/50 dark:bg-pink-900/10 shadow-sm">
              <h2 className="text-base font-semibold text-pink-900 dark:text-pink-300 mb-3">Hakkaniyet İndirimi / Mahsuplaşma</h2>
              <div className="divide-y divide-gray-200 dark:divide-gray-600 text-sm">
                <div className="flex justify-between py-1.5"><span>Toplam Fazla Mesai (Brüt)</span><span className="font-medium">{fmtCurrency(totalBrut)}</span></div>
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
                <div className="flex justify-between py-1.5 pt-2 font-semibold"><span>Son Net Alacak</span><span>{fmtCurrency(sonNet)}</span></div>
              </div>
            </section>

          </div>
        </div>

        {!isValid && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
            Dönem tarihleri ve haftalık desen gün gruplarını (en az 2 grup) doldurun.
          </p>
        )}
      </div>

      <div id="report-content" style={{ position: "absolute", left: "-9999px", top: 0, fontFamily: "Inter, Arial", color: "#111827", maxWidth: "16cm", padding: "0 12px" }} aria-hidden="true">
        <style>{`#report-content table{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:4px}#report-content td,#report-content th{border:1px solid #999;padding:5px 8px;font-size:10px}`}</style>
        {wordTableSections.map((sec) => (
          <div key={sec.id} id={sec.id}>
            <h2 className="text-xs font-semibold mb-1">{sec.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: sec.html }} />
          </div>
        ))}
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        onSave={handleSave}
        saveLabel={isSaving ? (effectiveId ? "Güncelleniyor..." : "Kaydediliyor...") : (effectiveId ? "Güncelle" : "Kaydet")}
        saveButtonProps={{ disabled: isSaving }}
        onPrint={handlePrint}
        previewButton={{
          title: PAGE_TITLE,
          copyTargetId: "haftalik-word-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div>
              <style>{`.report-section-copy{margin-bottom:1.25rem}.report-section-copy .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem}.report-section-copy .section-title{font-weight:600;font-size:0.75rem;color:#374151}.report-section-copy .copy-icon-btn{background:transparent;border:none;cursor:pointer;padding:0.25rem;border-radius:0.375rem;color:#6b7280}.report-section-copy .copy-icon-btn:hover{background:#f3f4f6;color:#374151}#haftalik-word-copy .section-content{border:none;overflow-x:auto;padding:0;margin:0}#haftalik-word-copy table{border-collapse:collapse;width:100%;margin:0;font-size:0.75rem;color:#111827}#haftalik-word-copy td,#haftalik-word-copy th{border:1px solid #999;padding:5px 8px;background:#fff!important;color:#111827!important}`}</style>
              <div id="haftalik-word-copy">
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
          onPdf: () => downloadPdfFromDOM(PAGE_TITLE, "report-content"),
        }}
      />

      <ZamanasimiModal
        isOpen={showZamanaModal}
        onClose={() => setShowZamanaModal(false)}
        onApply={(p) => setZamanasimi({ nihaiBaslangic: p.nihaiBaslangic })}
        form={zForm}
        setForm={setZForm}
        showToastError={showToastError}
        iseGiris={haftalikKarmaState.weeklyStartDateISO}
      />
      <KatsayiModal
        open={showKatsayiModal}
        onClose={() => setShowKatsayiModal(false)}
        onApply={(k) => setKatSayi(k)}
      />
      <MahsuplasamaModal
        open={showMahsuplasamaModal}
        onClose={() => setShowMahsuplasamaModal(false)}
        onSave={(total) => setMahsuplasmaMiktari(String(total.toFixed(2)))}
        periodLabels={tableDisplayRows.map((r) => r.startISO || "").filter(Boolean)}
      />
    </div>
  );
}
