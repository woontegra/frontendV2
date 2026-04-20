/**
 * Zamanaşımı itirazı uygulandığında cetvel bölümünün hemen alt başlığından sonra gösterilen uyarı şeridi.
 */

function formatNihaiTarihTR(iso: string): string {
  const s = iso.trim().slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y || y.length !== 4) return iso.trim();
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

type Props = {
  /** `zamanasimi.nihaiBaslangic` — ISO `yyyy-mm-dd` */
  nihaiBaslangic: string | null | undefined;
};

export function ZamanasimiCetvelBanner({ nihaiBaslangic }: Props) {
  const raw = (nihaiBaslangic ?? "").trim();
  if (!raw) return null;
  const label = formatNihaiTarihTR(raw);
  return (
    <div
      role="status"
      className="mx-3 mt-3 mb-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2.5 text-sm leading-snug text-amber-950 shadow-sm dark:border-amber-600 dark:bg-amber-950/45 dark:text-amber-50"
    >
      Zamanaşımı <strong className="tabular-nums">{label}</strong> tarihi itibarıyla uygulanmıştır; cetvel bu nihai
      başlangıç tarihine göre düzenlenmiştir.
    </div>
  );
}
