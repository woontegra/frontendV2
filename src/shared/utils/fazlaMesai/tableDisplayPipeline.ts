/**
 * Ortak Fazla Mesai Tablo Pipeline
 * Standart / Tanıklı ve diğer sayfalarda tablo satırlarının birleştirilmesi,
 * 270 saat düşümü (manuel satırlar sıfırlanmaz) ve yıllık izin dışlaması tek yerde.
 */

/** Debug: runtime kontrol (modül yüklendiğinde flag henüz set edilmemiş olabilir) */
function isDebugPipeline(): boolean {
  return typeof window !== "undefined" && !!(window as any).__FM_DEBUG_PIPELINE__;
}

import { applyAnnualLeaveExclusions } from "./applyAnnualLeaveExclusions";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { calculateWeeksBetweenDates } from "@/utils/dateUtils";

// Sabitler (270 saat kuralı dosyasına dokunulmaz; sadece kullanım yerinde manuel satır koruması uygulanır)
export const FAZLA_MESAI_DENOMINATOR = 225;
export const FAZLA_MESAI_KATSAYI = 1.5;
export const DAMGA_VERGISI_ORANI = 0.00759;
export const GELIR_VERGISI_ORANI = 0.15;
export const INCLUDED_OVERTIME_HOURS = 270;

/** Pipeline'da kullanılan satır tipi (sayfa tipleri bu alanları içermeli) */
export interface FazlaMesaiRowBase {
  id: string;
  startISO?: string;
  endISO?: string;
  weeks: number;
  weekCount?: number;
  originalWeekCount?: number;
  brut: number;
  wage?: number;
  fmHours: number;
  katsayi?: number;
  fm?: number;
  net?: number;
  overtimeAmount?: number;
  rangeLabel?: string;
  isManual?: boolean;
  manual?: boolean;
  insertAfter?: string;
  [key: string]: unknown;
}

/** 270 detaylı hesaplama sonucu (calculateOvertimeWith270AndLimitation ile uyumlu) */
export interface SonucSatiri270 {
  fmHafta: number;
}

/** 270 detaylı hesaplama parametreleri (sayfa kendi fonksiyonunu geçer) */
export type CalculateOvertime270DetailedParams = {
  iseGirisTarihi: Date;
  istenCikisTarihi: Date;
  haftalikFazlaMesaiSaati: number;
  zamanaSimiTarihi?: Date;
  yillikIzinler: { baslangic: Date; bitis: Date; gunSayisi: number }[];
  tabloSatirlari: { baslangic: Date; bitis: Date }[];
};

export type CalculateOvertime270Detailed = (
  params: CalculateOvertime270DetailedParams
) => SonucSatiri270[];

export interface ComputeDisplayRowsInput<T extends FazlaMesaiRowBase> {
  rows: T[];
  manualRows: T[];
  rowOverrides: Record<string, Partial<T>>;
  katSayi: number;
  weeklyFMSaat: number;
  exclusions: ExcludedDay[] | null | undefined;
  mode270: "none" | "simple" | "detailed";
  iseGiris?: string;
  istenCikis?: string;
  zamanasimiBaslangic?: string | null;
  /** 270 "Şirket" detaylı hesap için; verilmezse detailed modda apply270RuleFrontend kullanılır */
  calculateOvertime270Detailed?: CalculateOvertime270Detailed;
  /** true: Ham takvim haftaları göster (270 düşümü hafta sütununa uygulanmaz). Haftalık Karma için kullanılır. */
  useRawWeeks?: boolean;
}

/**
 * 270 saat (Şirket) kuralını tüm satırlara uygular; yıl bazlı havuz, hafta düşümü.
 * Manuel satırlarda hafta asla sıfırlanmaz (en az originalWeekCount veya 1 korunur).
 */
export function apply270RuleFrontend<
  T extends { startISO?: string; weeks?: number; originalWeekCount?: number; manual?: boolean; isManual?: boolean; [k: string]: unknown }
>(periods: T[]): T[] {
  if (!periods?.length) return [];
  const periodsByYear = new Map<number, { p: T; idx: number }[]>();
  periods.forEach((p, idx) => {
    if (!p.startISO) return;
    const year = new Date(p.startISO).getFullYear();
    if (!periodsByYear.has(year)) periodsByYear.set(year, []);
    periodsByYear.get(year)!.push({ p, idx });
  });
  const adjustedMap = new Map<number, { weeks: number; originalWeekCount: number }>();
  const sortedYears = Array.from(periodsByYear.keys()).sort((a, b) => a - b);
  for (const year of sortedYears) {
    const list = [...(periodsByYear.get(year)!)].sort((a, b) =>
      (a.p.startISO ? new Date(a.p.startISO).getTime() : 0) - (b.p.startISO ? new Date(b.p.startISO).getTime() : 0)
    );
    let kalanSaat = INCLUDED_OVERTIME_HOURS;
    for (const { p, idx } of list) {
      const originalWeeks = p.originalWeekCount ?? p.weeks ?? 0;
      const fmHours = (p as { fmHours?: number }).fmHours ?? 0;
      if (!fmHours || originalWeeks <= 0 || kalanSaat <= 0) {
        adjustedMap.set(idx, { weeks: originalWeeks, originalWeekCount: originalWeeks });
        continue;
      }
      const teorikHafta = kalanSaat / fmHours;
      const dusulecekHafta = Math.min(Math.round(teorikHafta), originalWeeks);
      const dusulenSaat = dusulecekHafta * fmHours;
      kalanSaat = Math.max(0, kalanSaat - dusulenSaat);
      const adjustedWeeks = Math.max(0, originalWeeks - dusulecekHafta);
      adjustedMap.set(idx, { weeks: adjustedWeeks, originalWeekCount: originalWeeks });
    }
  }
  return periods.map((p, idx) => {
    const adj = adjustedMap.get(idx);
    if (adj) {
      const isManual = !!(p.manual ?? p.isManual);
      const weeks = isManual && adj.weeks <= 0 ? (p.originalWeekCount ?? p.weeks ?? 1) : adj.weeks;
      return { ...p, weeks, originalWeekCount: adj.originalWeekCount };
    }
    return { ...p, originalWeekCount: p.originalWeekCount ?? p.weeks };
  });
}

function calcFmNet(
  row: FazlaMesaiRowBase,
  katSayi: number
): { fm: number; net: number } {
  const w = row.weeks ?? 0;
  const b = row.brut ?? 0;
  const k = row.katsayi ?? katSayi;
  const fh = row.fmHours ?? 0;
  const fm = Number(((w * b * k * fh / FAZLA_MESAI_DENOMINATOR) * FAZLA_MESAI_KATSAYI).toFixed(2));
  const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
  return { fm, net };
}

/**
 * Otomatik + manuel satırları birleştirir, 270 düşümü uygular (manuel satırlarda hafta sıfırlanmaz),
 * yıllık izin dışlaması ve fm/net hesaplarını yapar.
 */
export function computeDisplayRows<T extends FazlaMesaiRowBase>(
  input: ComputeDisplayRowsInput<T>
): T[] {
  const {
    rows,
    manualRows,
    rowOverrides,
    katSayi,
    weeklyFMSaat,
    exclusions,
    mode270,
    iseGiris,
    istenCikis,
    zamanasimiBaslangic,
    calculateOvertime270Detailed,
    useRawWeeks,
  } = input;

  const kats = katSayi || 1;

  if (isDebugPipeline()) {
    const inputZeros = rows.filter((r) => (r.weeks ?? 0) <= 0);
    if (inputZeros.length) console.log("[computeDisplayRows] GİRİŞ: Hafta<=0 olan rows:", inputZeros.map((r) => ({ id: r.id, startISO: r.startISO, endISO: r.endISO, weeks: r.weeks })));
  }
  const automaticWithOverrides = rows
    .filter((row) => !(rowOverrides[row.id] as { hidden?: boolean })?.hidden)
    .map((row) => {
      const override = rowOverrides[row.id];
      if (!override) {
        if (isDebugPipeline() && (row.weeks ?? 0) <= 0) console.log("[computeDisplayRows] auto NO override, row as-is:", row.id, { weeks: row.weeks });
        return row;
      }
      const merged = { ...row, ...override } as T;
      const startISO = (merged as FazlaMesaiRowBase).startISO ?? row.startISO;
      const endISO = (merged as FazlaMesaiRowBase).endISO ?? row.endISO;
      const weeksFromDates = startISO && endISO ? calculateWeeksBetweenDates(startISO, endISO) : undefined;
      // override.weeks 0 geldiyse (kaydedilmiş hatalı veri) tarihten hesaplananı kullan; 0 ?? 11 = 0 olduğu için
      let effectiveWeeks = override.weeks ?? weeksFromDates ?? row.weeks;
      if (effectiveWeeks <= 0 && (weeksFromDates ?? row.weeks ?? 0) > 0) effectiveWeeks = weeksFromDates ?? row.weeks ?? effectiveWeeks;
      if (isDebugPipeline() && (effectiveWeeks <= 0 || row.id.includes("2023"))) {
        console.log("[computeDisplayRows] auto override row:", row.id, { startISO, endISO, "override.weeks": override.weeks, weeksFromDates, "row.weeks": row.weeks, effectiveWeeks });
      }
      if (
        override.weeks !== undefined ||
        override.startISO !== undefined ||
        override.endISO !== undefined ||
        override.brut !== undefined ||
        override.fmHours !== undefined ||
        weeksFromDates !== undefined
      ) {
        const weeks = effectiveWeeks;
        const brut = override.brut ?? row.brut;
        const fmHours = override.fmHours ?? row.fmHours;
        const hoursEffective = weeks * fmHours;
        const step3 = Number((brut * kats * hoursEffective).toFixed(6));
        const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
        const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
        const fm = Number(step5.toFixed(2));
        const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
        (merged as FazlaMesaiRowBase).weeks = weeks;
        (merged as FazlaMesaiRowBase).originalWeekCount = override.originalWeekCount ?? weeks;
        (merged as FazlaMesaiRowBase).fm = fm;
        (merged as FazlaMesaiRowBase).net = net;
        (merged as FazlaMesaiRowBase).overtimeAmount = fm;
      }
      return merged;
    });

  const manualWithOverrides = manualRows.map((row) => {
    const override = rowOverrides[row.id];
    const merged = (override ? { ...row, ...override } : row) as T;
    const startISO = merged.startISO ?? row.startISO;
    const endISO = merged.endISO ?? row.endISO;
    const weeksFromDates = startISO && endISO ? calculateWeeksBetweenDates(startISO, endISO) : undefined;
    let weeks = merged.weeks ?? weeksFromDates ?? 0;
    if (weeks <= 0 && (weeksFromDates ?? row.weeks ?? 0) > 0) weeks = weeksFromDates ?? row.weeks ?? weeks;
    const brut = merged.brut ?? 0;
    const fmHours = merged.fmHours ?? weeklyFMSaat;
    const hoursEffective = weeks * fmHours;
    const step3 = Number((brut * kats * hoursEffective).toFixed(6));
    const step4 = Number((step3 / FAZLA_MESAI_DENOMINATOR).toFixed(6));
    const step5 = Number((step4 * FAZLA_MESAI_KATSAYI).toFixed(6));
    const fm = Number(step5.toFixed(2));
    const net = Number((fm * (1 - DAMGA_VERGISI_ORANI - GELIR_VERGISI_ORANI)).toFixed(2));
    (merged as FazlaMesaiRowBase).weeks = weeks;
    (merged as FazlaMesaiRowBase).originalWeekCount = merged.originalWeekCount ?? weeks;
    (merged as FazlaMesaiRowBase).fm = fm;
    (merged as FazlaMesaiRowBase).net = net;
    (merged as FazlaMesaiRowBase).overtimeAmount = fm;
    return merged;
  });

  const result: T[] = [];
  for (const autoRow of automaticWithOverrides) {
    result.push(autoRow);
    const manualRowsAfterThis = manualWithOverrides.filter(
      (m) => (m as FazlaMesaiRowBase).insertAfter === autoRow.id
    );
    result.push(...manualRowsAfterThis);
  }
  const insertedManualIds = new Set(
    result.filter((r) => (r as FazlaMesaiRowBase).isManual).map((r) => r.id)
  );
  const remainingManual = manualWithOverrides.filter((m) => !insertedManualIds.has(m.id));
  result.push(...remainingManual);

  let with270 = result.map((r) => ({
    ...r,
    originalWeekCount: r.originalWeekCount ?? r.weeks,
  })) as T[];

  if (useRawWeeks) {
    // Ham takvim haftaları Hafta sütununda gösterilir - Haftalık Karma için
    const getRawWeeks = (r: T) => {
      const fromDates = r.startISO && r.endISO ? calculateWeeksBetweenDates(r.startISO, r.endISO) : undefined;
      return fromDates ?? r.originalWeekCount ?? r.weeks ?? 0;
    };
    const withRaw = with270.map((r) => ({
      ...r,
      originalWeekCount: getRawWeeks(r),
      weeks: getRawWeeks(r),
    })) as T[];

    if (mode270 === "simple") {
      with270 = withRaw.map((r) => ({ ...r, fmHours: Math.max(0, (r.fmHours ?? 0) - 5.2) })) as T[];
    } else if (mode270 === "detailed") {
      with270 = apply270RuleFrontend(withRaw) as T[];
    } else {
      with270 = withRaw;
    }
  } else if (mode270 !== "none") {
    if (mode270 === "simple") {
      const YARGITAY_270 = 5.2;
      with270 = with270.map((r) => ({
        ...r,
        fmHours: Math.max(0, (r.fmHours ?? 0) - YARGITAY_270),
      })) as T[];
    } else if (mode270 === "detailed") {
      const valid = with270.filter((r) => r.startISO && r.endISO);
      const weeklyFM = valid[0]?.fmHours ?? weeklyFMSaat;
      const tabloSatirlari = valid.map((r) => ({
        baslangic: new Date(r.startISO!),
        bitis: new Date(r.endISO!),
      }));
      if (
        tabloSatirlari.length > 0 &&
        iseGiris &&
        istenCikis &&
        calculateOvertime270Detailed
      ) {
        const sonuclar = calculateOvertime270Detailed({
          iseGirisTarihi: new Date(iseGiris),
          istenCikisTarihi: new Date(istenCikis),
          haftalikFazlaMesaiSaati: weeklyFM,
          zamanaSimiTarihi: zamanasimiBaslangic ? new Date(zamanasimiBaslangic) : undefined,
          yillikIzinler: [],
          tabloSatirlari,
        });
        with270 = with270.map((r) => {
          const j = valid.findIndex((v) => v.id === r.id);
          if (j >= 0 && sonuclar[j] != null) {
            const rawWeeks = r.originalWeekCount ?? r.weeks ?? 0;
            const adjusted = sonuclar[j].fmHafta;
            const isManual = !!(r.manual ?? r.isManual);
            // adjusted 0 olduğunda ?? rawWeeks kullanılmaz (0 !== null/undefined). Bu yüzden 0 gösterme hatası oluyordu.
            const weeks = Number.isFinite(adjusted)
              ? (isManual && adjusted <= 0 ? Math.max(1, rawWeeks) : (adjusted > 0 ? adjusted : rawWeeks))
              : rawWeeks;
            return {
              ...r,
              weeks: weeks > 0 ? weeks : rawWeeks,
              originalWeekCount: r.originalWeekCount ?? r.weeks,
            } as T;
          }
          return r;
        });
      } else {
        with270 = apply270RuleFrontend(with270) as T[];
      }
    }
  }

  const afterExclusions = applyAnnualLeaveExclusions(with270, exclusions, { minWeeks: 1 });
  if (isDebugPipeline()) {
    const zeros = afterExclusions.filter((r) => (r.weeks ?? 0) <= 0);
    if (zeros.length) console.log("[computeDisplayRows] SONUÇ: Hafta=0 olan satırlar:", zeros.map((r) => ({ id: r.id, startISO: r.startISO, endISO: r.endISO, weeks: r.weeks })));
    const overrideIds = Object.keys(rowOverrides);
    const override2023 = overrideIds.filter((k) => k.includes("2023")).map((k) => ({ id: k, ...rowOverrides[k] }));
    if (override2023.length) console.log("[computeDisplayRows] rowOverrides (2023 satırları):", override2023);
    console.log("[computeDisplayRows] mode270:", mode270, "rowOverrides toplam:", overrideIds.length);
  }
  return afterExclusions.map((row) => {
    const { fm, net } = calcFmNet(row as FazlaMesaiRowBase, kats);
    return { ...row, fm, net } as T;
  });
}
