import type { ExcludedDay } from "@/shared/utils/exclusionStorage";
import type { WorkDay } from "./generateWorkDays48";

function parseISODateLocal(iso: string): Date | null {
  const raw = String(iso || "").trim();
  if (!raw) return null;
  const s = raw.slice(0, 10);

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(+dt)) return dt;
  }

  // dd.mm.yyyy
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (tr) {
    const d = Number(tr[1]);
    const m = Number(tr[2]);
    const y = Number(tr[3]);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(+dt)) return dt;
  }

  // Fallback for Date-like strings / timestamps
  const any = new Date(raw);
  if (!Number.isNaN(+any)) return new Date(any.getFullYear(), any.getMonth(), any.getDate());
  return null;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normDay(d: string): string {
  return String(d || "").trim().slice(0, 10);
}

/**
 * 24/48: her etkin UBGT/yıllık izin günü için 1 vardiya çalışma günü düşülür.
 * `iso` cetvel aralığında yoksa işlem yapılmaz (tanık/dava penceresi dışı UBGT).
 * `iso` çalışma günüyse o gün; dinlenme günüyse o günden itibaren ilk çalışma günü düşülür.
 */
function applyTwoWorkdayDropsForIso(out: WorkDay[], isoRaw: string): void {
  const iso = normDay(isoRaw);
  if (!iso) return;

  let idxAtIso = -1;
  for (let i = 0; i < out.length; i += 1) {
    if (normDay(out[i].date) === iso) {
      idxAtIso = i;
      break;
    }
  }
  if (idxAtIso < 0) return;

  let removed = 0;
  const targetDrops = 1;

  if (out[idxAtIso].isWork) {
    out[idxAtIso] = { ...out[idxAtIso], isWork: false };
    removed += 1;
    for (let j = idxAtIso + 1; j < out.length && removed < targetDrops; j += 1) {
      if (out[j].isWork) {
        out[j] = { ...out[j], isWork: false };
        removed += 1;
      }
    }
    return;
  }

  for (let i = idxAtIso; i < out.length && removed < targetDrops; i += 1) {
    if (out[i].isWork) {
      out[i] = { ...out[i], isWork: false };
      removed += 1;
    }
  }
}

/**
 * UBGT + Yıllık İzin günlerini tek havuzda toplar; ardışık takvim bloklarında
 * 1 düş / 1 düşme (indeks 0,2,4,… → etkin) kuralını uygular.
 */
export function buildEffectiveSequentialDates(exclusions: ExcludedDay[]): Set<string> {
  const raw = new Set<string>();
  exclusions.forEach((ex) => {
    const type = String(ex.type || "").trim();
    if (type !== "UBGT" && type !== "Yıllık İzin") return;
    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) return;
    const capRaw = Number(ex.days);
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : null;
    const cur = new Date(s);
    let used = 0;
    while (cur <= e) {
      if (cap != null && used >= cap) break;
      raw.add(toISODate(cur));
      used += 1;
      cur.setDate(cur.getDate() + 1);
    }
  });

  const sorted = [...raw].sort((a, b) => a.localeCompare(b));
  const effective = new Set<string>();
  let i = 0;
  while (i < sorted.length) {
    const block: string[] = [sorted[i]];
    let j = i + 1;
    while (j < sorted.length) {
      const prev = parseISODateLocal(sorted[j - 1]);
      const curD = parseISODateLocal(sorted[j]);
      if (!prev || !curD) break;
      const next = new Date(prev);
      next.setDate(prev.getDate() + 1);
      if (toISODate(next) !== sorted[j]) break;
      block.push(sorted[j]);
      j += 1;
    }
    for (let k = 0; k < block.length; k += 1) {
      if (k % 2 === 0) effective.add(block[k]);
    }
    i = j;
  }
  return effective;
}

/**
 * 24/48 vardiya: ardışık UBGT + yıllık izin takvim bloklarında etkin günler
 * 3 günlük ritme göre 1-0-0 (üçlüde yalnızca ilk gün) seçilir; 24 saatteki 1-0-1’den ayrılır.
 */
function buildEffectiveSequentialDates48(exclusions: ExcludedDay[]): Set<string> {
  const raw = new Set<string>();

  exclusions.forEach((ex) => {
    const type = String(ex.type || "").trim();
    if (type !== "UBGT" && type !== "Yıllık İzin") return;

    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) return;

    const capRaw = Number(ex.days);
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : null;
    const cur = new Date(s);
    let used = 0;
    while (cur <= e) {
      if (cap != null && used >= cap) break;
      raw.add(toISODate(cur));
      used += 1;
      cur.setDate(cur.getDate() + 1);
    }
  });

  const sorted = [...raw].sort((a, b) => a.localeCompare(b));
  const effective = new Set<string>();

  let i = 0;
  while (i < sorted.length) {
    const block: string[] = [sorted[i]];
    let j = i + 1;

    while (j < sorted.length) {
      const prev = parseISODateLocal(sorted[j - 1]);
      const curD = parseISODateLocal(sorted[j]);
      if (!prev || !curD) break;

      const next = new Date(prev);
      next.setDate(prev.getDate() + 1);

      if (toISODate(next) !== sorted[j]) break;

      block.push(sorted[j]);
      j += 1;
    }

    for (let k = 0; k < block.length; k += 3) {
      effective.add(block[k]);
    }

    i = j;
  }

  return effective;
}

/**
 * Yalnızca UBGT kayıtları için etkin gün kümesi (calculate48System ile uyumlu).
 * Birleşik 1-0 kuralı için {@link buildEffectiveSequentialDates} kullanın.
 */
export function buildEffectiveUbgtDates(exclusions: ExcludedDay[]): Set<string> {
  const raw = new Set<string>();
  exclusions.forEach((ex) => {
    if (String(ex.type || "").trim() !== "UBGT") return;
    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) return;
    const capRaw = Number(ex.days);
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : null;
    const cur = new Date(s);
    let used = 0;
    while (cur <= e) {
      if (cap != null && used >= cap) break;
      raw.add(toISODate(cur));
      used += 1;
      cur.setDate(cur.getDate() + 1);
    }
  });

  const sorted = [...raw].sort((a, b) => a.localeCompare(b));
  const effective = new Set<string>();
  let i = 0;
  while (i < sorted.length) {
    const block: string[] = [sorted[i]];
    let j = i + 1;
    while (j < sorted.length) {
      const prev = parseISODateLocal(sorted[j - 1]);
      const cur = parseISODateLocal(sorted[j]);
      if (!prev || !cur) break;
      const next = new Date(prev);
      next.setDate(prev.getDate() + 1);
      if (toISODate(next) !== sorted[j]) break;
      block.push(sorted[j]);
      j += 1;
    }
    // Vardiya örüntüsü: ardışık UBGT günlerinde bir gün düş, bir gün atla.
    for (let k = 0; k < block.length; k += 2) effective.add(block[k]);
    i = j;
  }
  return effective;
}

function materializeExclusionDates(exclusions: ExcludedDay[]): { normal: Set<string>; forced: string[] } {
  const normal = new Set<string>();
  const forced: string[] = [];
  const effectiveSeq = buildEffectiveSequentialDates48(exclusions);
  exclusions.forEach((ex) => {
    const s = parseISODateLocal(String(ex.start || ""));
    const e = parseISODateLocal(String(ex.end || ""));
    if (!s || !e || e < s) return;
    const type = String(ex.type || "").trim();
    const isForcedType = type === "Puantaj/Bordro";
    const capRaw = Number(ex.days);
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : null;
    const cur = new Date(s);
    let used = 0;
    while (cur <= e) {
      if (cap != null && used >= cap) break;
      const key = toISODate(cur);
      if (type === "UBGT" || type === "Yıllık İzin") {
        if (effectiveSeq.has(key)) forced.push(key);
      } else if (isForcedType) {
        forced.push(key);
      } else {
        normal.add(key);
      }
      used += 1;
      cur.setDate(cur.getDate() + 1);
    }
  });
  return { normal, forced };
}

type LeaveBlock = { start: string; end: string; count: number };

function buildSevenDayBlocks(dates: Iterable<string>): LeaveBlock[] {
  const sorted = [...new Set(dates)].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 0) return [];
  const blocks: LeaveBlock[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    const startDt = parseISODateLocal(start);
    if (!startDt) {
      i += 1;
      continue;
    }
    const endDt = new Date(startDt);
    endDt.setDate(endDt.getDate() + 6);
    const end = toISODate(endDt);
    let count = 0;
    while (i < sorted.length && sorted[i] <= end) {
      count += 1;
      i += 1;
    }
    blocks.push({ start, end, count });
  }
  return blocks;
}

/**
 * UBGT/izin sadece calisma gununden dusulur.
 * Dinlenme gunune gelen dislama etkisizdir.
 *
 * @param _forcedDeductionAnchorIso Geriye uyum için korunur (48 motorunda kullanılmaz).
 */
export function applyExclusions48(
  workDays: WorkDay[],
  exclusions: ExcludedDay[] | null | undefined,
  _forcedDeductionAnchorIso?: string | null,
  options?: { respectWorkdayFilter?: boolean }
): WorkDay[] {
  if (!exclusions?.length) return workDays;
  const respectWorkdayFilter = options?.respectWorkdayFilter ?? true;
  const { normal, forced } = materializeExclusionDates(exclusions);
  const out = respectWorkdayFilter
    ? workDays.map((d) => (d.isWork && normal.has(d.date) ? { ...d, isWork: false } : { ...d }))
    : workDays.map((d) => ({ ...d }));

  // 24 saat ile aynı: zorunlu düşümler 7 günlük bloklara ayrılır,
  // her blokta işaretli gün sayısı kadar çalışma günü düşülür.
  const forcedAll = [...forced];
  if (!respectWorkdayFilter) {
    normal.forEach((iso) => forcedAll.push(iso));
  }

  if (!forcedAll.length) return out;

  const blocks = buildSevenDayBlocks(forcedAll);
  blocks.forEach((block) => {
    let need = block.count;
    for (let idx = 0; idx < out.length; idx += 1) {
      if (need <= 0) break;
      const dayIso = out[idx].date;
      if (dayIso < block.start || dayIso > block.end) continue;
      if (!out[idx].isWork) continue;
      out[idx] = { ...out[idx], isWork: false };
      need -= 1;
    }
  });

  return out;
}
