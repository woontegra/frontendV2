/**
 * 24/48 (48 saat) cetvelinde UBGT/yıllık izin geçiş satırları için düşümün
 * yalnızca "2 vardiya günü" ana satırından görünmesi (bilirkişi pratiği).
 *
 * (3→2): geçiş haftası kadar 3 gün satırına iade, aynı miktarda 2 gün satırından düş.
 * (2→1): yalnızca 2 gün satırından düşer (3 gün satırına iade yok).
 */
export type Vardiya48DonorRow = {
  startISO: string;
  endISO: string;
  weeks: number;
  weekTypeLabel?: string;
  yillikIzinAciklama?: string;
};

function parseWeekTypeLabel(label?: string): number {
  return parseInt(String(label || "").trim().split(/\s+/)[0] || "0", 10) || 0;
}

function periodKeyForTransitionRow<T extends Vardiya48DonorRow>(out: T[], r: T, trRe: RegExp): string | null {
  const rs = (r.startISO || "").slice(0, 10);
  const container = out.find((x) => {
    const note = String(x.yillikIzinAciklama || "");
    if (trRe.test(note)) return false;
    const xs = (x.startISO || "").slice(0, 10);
    const xe = (x.endISO || "").slice(0, 10);
    return !!rs && !!xs && !!xe && xs <= rs && rs <= xe;
  });
  if (!container) return null;
  const cs = (container.startISO || "").slice(0, 10);
  const ce = (container.endISO || "").slice(0, 10);
  return `${cs}|${ce}`;
}

export function reallocateVardiya48UbgtDonorFromTwoDayColumn<T extends Vardiya48DonorRow>(rows: T[]): T[] {
  if (!rows.length) return rows;
  const out = rows.map((r) => ({ ...r }));
  const trRe = /\((\d+)\s*->\s*(\d+)\s*gün\)/i;

  type Agg = { sum: number; cs: string; ce: string };
  const byPeriod32 = new Map<string, Agg>();
  const byPeriod21 = new Map<string, Agg>();

  out.forEach((r) => {
    const m = trRe.exec(String(r.yillikIzinAciklama || ""));
    if (!m) return;
    const before = Number(m[1]);
    const after = Number(m[2]);
    const key = periodKeyForTransitionRow(out, r, trRe);
    if (!key) return;
    const cs = key.split("|")[0];
    const ce = key.split("|")[1];
    const w = Math.max(0, Math.round(Number(r.weeks) || 0));

    if (before === 3 && after === 2) {
      const prev = byPeriod32.get(key);
      if (prev) prev.sum += w;
      else byPeriod32.set(key, { sum: w, cs, ce });
    } else if (before === 2 && after === 1) {
      const prev = byPeriod21.get(key);
      if (prev) prev.sum += w;
      else byPeriod21.set(key, { sum: w, cs, ce });
    }
  });

  byPeriod32.forEach(({ sum: sumTr, cs, ce }) => {
    if (sumTr <= 0) return;
    const idx3 = out.findIndex((x) => {
      const note = String(x.yillikIzinAciklama || "");
      if (trRe.test(note)) return false;
      if ((x.startISO || "").slice(0, 10) !== cs) return false;
      if ((x.endISO || "").slice(0, 10) !== ce) return false;
      return parseWeekTypeLabel(x.weekTypeLabel) === 3;
    });
    const idx2 = out.findIndex((x) => {
      const note = String(x.yillikIzinAciklama || "");
      if (trRe.test(note)) return false;
      if ((x.startISO || "").slice(0, 10) !== cs) return false;
      if ((x.endISO || "").slice(0, 10) !== ce) return false;
      return parseWeekTypeLabel(x.weekTypeLabel) === 2;
    });
    if (idx3 < 0 || idx2 < 0) return;

    const w2 = Math.max(0, Math.round(Number(out[idx2].weeks) || 0));
    const move = Math.min(sumTr, w2);
    if (move <= 0) return;

    out[idx3].weeks = Math.max(0, Math.round(Number(out[idx3].weeks) || 0) + move);
    out[idx2].weeks = Math.max(0, w2 - move);
  });

  byPeriod21.forEach(({ sum: sumTr, cs, ce }) => {
    if (sumTr <= 0) return;
    const idx2 = out.findIndex((x) => {
      const note = String(x.yillikIzinAciklama || "");
      if (trRe.test(note)) return false;
      if ((x.startISO || "").slice(0, 10) !== cs) return false;
      if ((x.endISO || "").slice(0, 10) !== ce) return false;
      return parseWeekTypeLabel(x.weekTypeLabel) === 2;
    });
    if (idx2 < 0) return;
    const w2 = Math.max(0, Math.round(Number(out[idx2].weeks) || 0));
    const cut = Math.min(sumTr, w2);
    if (cut <= 0) return;
    out[idx2].weeks = Math.max(0, w2 - cut);
  });

  return out;
}
