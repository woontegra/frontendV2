export type Row24Like = {
  startISO: string;
  endISO: string;
  weeks: number;
  weekTypeLabel?: string;
  yillikIzinAciklama?: string;
};

type ParsedTransition = {
  before: number;
  after: number;
};

function parseWeekType(label?: string): number | null {
  const m = /^(\d+)\s*gün/i.exec(String(label || "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseTransition(note?: string): ParsedTransition | null {
  const m = /\((\d+)\s*->\s*(\d+)\s*gün\)/i.exec(String(note || ""));
  if (!m) return null;
  const before = Number(m[1]);
  const after = Number(m[2]);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  return { before, after };
}

function inRange(targetIso: string, startIso: string, endIso: string): boolean {
  const t = (targetIso || "").slice(0, 10);
  const s = (startIso || "").slice(0, 10);
  const e = (endIso || "").slice(0, 10);
  if (!t || !s || !e) return false;
  return s <= t && t <= e;
}

/**
 * 24 saat bilirkişi istisnası:
 * - Düşüm gün toplamında 4 ve katları 4-gün sütunundan düşülür (4->3)
 * - Kalan günler 3-gün sütunundan düşülür (3->2)
 *
 * Not: Bu fonksiyon sadece mevcut düşüm satırlarının hafta adetlerini yeniden dağıtır.
 */
export function apply24DeductionSourceRule<T extends Row24Like>(rows: T[]): T[] {
  if (!rows.length) return rows;
  const out = rows.map((r) => ({ ...r }));

  const isTransitionRow = (r: T) => !!parseTransition(r.yillikIzinAciklama);
  const baseIdxs = out
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => !isTransitionRow(r))
    .map(({ idx }) => idx);

  const periods = new Map<string, number[]>();
  out.forEach((r, idx) => {
    let key = `${(r.startISO || "").slice(0, 10)}|${(r.endISO || "").slice(0, 10)}`;
    if (isTransitionRow(r)) {
      // Düşüm satırı (ör. 4->3) kısa bir tarih aralığına sahip olabilir.
      // Donor (4 gün / 3 gün) satırıyla eşleşmesi için, geçiş satırını kapsayan
      // notsuz en uygun satırın dönem anahtarını kullan.
      const container = baseIdxs.find((bi) => {
        const b = out[bi];
        return inRange((r.startISO || "").slice(0, 10), b.startISO, b.endISO);
      });
      if (container != null) {
        const b = out[container];
        key = `${(b.startISO || "").slice(0, 10)}|${(b.endISO || "").slice(0, 10)}`;
      }
    }
    const arr = periods.get(key) || [];
    arr.push(idx);
    periods.set(key, arr);
  });

  periods.forEach((idxs) => {
    const base4Idx = idxs.find((i) => parseWeekType(out[i].weekTypeLabel) === 4 && !parseTransition(out[i].yillikIzinAciklama));
    const base3Idx = idxs.find((i) => parseWeekType(out[i].weekTypeLabel) === 3 && !parseTransition(out[i].yillikIzinAciklama));
    const tr43Idxs = idxs.filter((i) => {
      const t = parseTransition(out[i].yillikIzinAciklama);
      return !!t && t.before === 4 && t.after === 3;
    });
    const tr32Idxs = idxs.filter((i) => {
      const t = parseTransition(out[i].yillikIzinAciklama);
      return !!t && t.before === 3 && t.after === 2;
    });

    const has43 = tr43Idxs.length > 0;
    if (base4Idx != null && has43) {
      const transitionWeeks43 = tr43Idxs.reduce(
        (acc, i) => acc + Math.max(0, Math.round(Number(out[i].weeks) || 0)),
        0
      );
      const baseWeeks43 = Math.max(0, Math.round(Number(out[base4Idx].weeks) || 0));
      out[base4Idx].weeks = Math.max(0, baseWeeks43 - Math.min(baseWeeks43, transitionWeeks43));
    }

    // 4->3 geçişi olan dönemde 3 gün donor satırından ekstra düşme yapılmaz.
    // Aksi halde tek UBGT düşümünde iki ana satır birden azalabiliyor.
    if (!has43 && base3Idx != null && tr32Idxs.length > 0) {
      const transitionWeeks32 = tr32Idxs.reduce(
        (acc, i) => acc + Math.max(0, Math.round(Number(out[i].weeks) || 0)),
        0
      );
      const baseWeeks32 = Math.max(0, Math.round(Number(out[base3Idx].weeks) || 0));
      out[base3Idx].weeks = Math.max(0, baseWeeks32 - Math.min(baseWeeks32, transitionWeeks32));
    }
  });

  return out.filter((r) => Math.max(0, Math.round(Number(r.weeks) || 0)) > 0) as T[];
}

