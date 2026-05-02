export type WorkDay = {
  date: string;
  isWork: boolean;
};

export type GenerateWorkDays24Input = {
  startDate: string;
  endDate: string;
  anchorIsWorkDay: boolean;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODateLocal(iso: string): Date | null {
  const s = String(iso || "").slice(0, 10);
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(+dt)) return null;
  return dt;
}

/**
 * 24/24: gun asiri calisma üretir.
 * index=0 ilk gun; anchor=true ise ilk gun calisma gunudur.
 */
export function generateWorkDays24(input: GenerateWorkDays24Input): WorkDay[] {
  const start = parseISODateLocal(input.startDate);
  const end = parseISODateLocal(input.endDate);
  if (!start || !end || end < start) return [];

  const out: WorkDay[] = [];
  const cur = new Date(start);
  let i = 0;
  while (cur <= end) {
    const even = i % 2 === 0;
    const isWork = input.anchorIsWorkDay ? even : !even;
    out.push({ date: toISODate(cur), isWork });
    cur.setDate(cur.getDate() + 1);
    i += 1;
  }
  return out;
}

