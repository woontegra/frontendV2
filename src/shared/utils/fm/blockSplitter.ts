import type { ExcludedDay } from "@/utils/exclusionStorage";

type SplitBlock = { start: Date; end: Date; type: "normal" | "excluded" };

function atStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const s = String(value || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return atStartOfDay(dt);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return atStartOfDay(x);
}

function mergeOverlappingRanges(ranges: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date }> {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Array<{ start: Date; end: Date }> = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start.getTime() <= addDays(last.end, 1).getTime()) {
      if (cur.end > last.end) last.end = cur.end;
      continue;
    }
    out.push({ start: cur.start, end: cur.end });
  }
  return out;
}

export function splitByExclusionsBlocks(
  startDate: Date,
  endDate: Date,
  exclusions: ExcludedDay[]
): SplitBlock[] {
  const segStart = atStartOfDay(startDate);
  const segEnd = atStartOfDay(endDate);
  if (Number.isNaN(+segStart) || Number.isNaN(+segEnd) || segStart > segEnd) return [];

  const selectedDaysMap = new Map<string, Date>();
  for (const ex of exclusions || []) {
    const s = parseIsoDate(ex.start);
    const e = parseIsoDate(ex.end);
    if (!s || !e || s > e) continue;
    let cur = s;
    while (cur <= e) {
      if (cur >= segStart && cur <= segEnd) {
        selectedDaysMap.set(dateKey(cur), cur);
      }
      cur = addDays(cur, 1);
    }
  }

  const selectedDays = Array.from(selectedDaysMap.values()).sort((a, b) => a.getTime() - b.getTime());
  if (!selectedDays.length) {
    return [{ start: segStart, end: segEnd, type: "normal" }];
  }

  // Ardışık seçili günleri tek grupta topla.
  const groups: Array<{ start: Date; end: Date }> = [];
  let gStart = selectedDays[0];
  let gEnd = selectedDays[0];
  for (let i = 1; i < selectedDays.length; i++) {
    const cur = selectedDays[i];
    if (cur.getTime() === addDays(gEnd, 1).getTime()) {
      gEnd = cur;
      continue;
    }
    groups.push({ start: gStart, end: gEnd });
    gStart = cur;
    gEnd = cur;
  }
  groups.push({ start: gStart, end: gEnd });

  // Her grubun ilk günü 7 günlük excluded blok başlangıcıdır.
  const rawExcluded = groups.map((g) => {
    const start = g.start;
    const end = addDays(start, 6);
    return { start, end: end > segEnd ? segEnd : end };
  });
  const excludedRanges = mergeOverlappingRanges(rawExcluded);

  const out: SplitBlock[] = [];
  let cursor = segStart;
  for (const ex of excludedRanges) {
    if (cursor < ex.start) {
      out.push({ start: cursor, end: addDays(ex.start, -1), type: "normal" });
    }
    out.push({ start: ex.start, end: ex.end, type: "excluded" });
    cursor = addDays(ex.end, 1);
  }
  if (cursor <= segEnd) {
    out.push({ start: cursor, end: segEnd, type: "normal" });
  }
  return out;
}
