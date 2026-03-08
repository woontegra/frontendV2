/**
 * Gelir vergisi tarifesi (ücretliler) ve brütten nete hesaplama.
 * Sadece bu sayfa klasöründe kullanılır; harici import yok.
 * GİB tebliğlerine uyumlu 2010–2030.
 */

type Bracket = { limit: number | null; rate: number; baseTax: number; baseLimit: number };

const incomeTaxRates: Record<number, Bracket[]> = {
  2010: [{ limit: 8800, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 22000, rate: 0.2, baseTax: 1320, baseLimit: 8800 }, { limit: 50000, rate: 0.27, baseTax: 3960, baseLimit: 22000 }, { limit: null, rate: 0.35, baseTax: 11520, baseLimit: 50000 }],
  2011: [{ limit: 9400, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 23000, rate: 0.2, baseTax: 1410, baseLimit: 9400 }, { limit: 80000, rate: 0.27, baseTax: 4130, baseLimit: 23000 }, { limit: null, rate: 0.35, baseTax: 19520, baseLimit: 80000 }],
  2012: [{ limit: 10000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 25000, rate: 0.2, baseTax: 1500, baseLimit: 10000 }, { limit: 88000, rate: 0.27, baseTax: 4500, baseLimit: 25000 }, { limit: null, rate: 0.35, baseTax: 21510, baseLimit: 88000 }],
  2013: [{ limit: 10700, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 26000, rate: 0.2, baseTax: 1605, baseLimit: 10700 }, { limit: 94000, rate: 0.27, baseTax: 4665, baseLimit: 26000 }, { limit: null, rate: 0.35, baseTax: 23025, baseLimit: 94000 }],
  2014: [{ limit: 11000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 27000, rate: 0.2, baseTax: 1650, baseLimit: 11000 }, { limit: 97000, rate: 0.27, baseTax: 4850, baseLimit: 27000 }, { limit: null, rate: 0.35, baseTax: 23750, baseLimit: 97000 }],
  2015: [{ limit: 12000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 29000, rate: 0.2, baseTax: 1800, baseLimit: 12000 }, { limit: 106000, rate: 0.27, baseTax: 5200, baseLimit: 29000 }, { limit: null, rate: 0.35, baseTax: 25990, baseLimit: 106000 }],
  2016: [{ limit: 12600, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 30000, rate: 0.2, baseTax: 1890, baseLimit: 12600 }, { limit: 110000, rate: 0.27, baseTax: 5370, baseLimit: 30000 }, { limit: null, rate: 0.35, baseTax: 26970, baseLimit: 110000 }],
  2017: [{ limit: 13000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 30000, rate: 0.2, baseTax: 1950, baseLimit: 13000 }, { limit: 110000, rate: 0.27, baseTax: 5350, baseLimit: 30000 }, { limit: null, rate: 0.35, baseTax: 26950, baseLimit: 110000 }],
  2018: [{ limit: 14800, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 34000, rate: 0.2, baseTax: 2220, baseLimit: 14800 }, { limit: 120000, rate: 0.27, baseTax: 6060, baseLimit: 34000 }, { limit: null, rate: 0.35, baseTax: 29280, baseLimit: 120000 }],
  2019: [{ limit: 18000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 40000, rate: 0.2, baseTax: 2700, baseLimit: 18000 }, { limit: 148000, rate: 0.27, baseTax: 7100, baseLimit: 40000 }, { limit: null, rate: 0.35, baseTax: 36260, baseLimit: 148000 }],
  2020: [{ limit: 22000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 49000, rate: 0.2, baseTax: 3300, baseLimit: 22000 }, { limit: 120000, rate: 0.27, baseTax: 8700, baseLimit: 49000 }, { limit: 600000, rate: 0.35, baseTax: 27870, baseLimit: 120000 }, { limit: null, rate: 0.4, baseTax: 191070, baseLimit: 600000 }],
  2021: [{ limit: 24000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 53000, rate: 0.2, baseTax: 3600, baseLimit: 24000 }, { limit: 190000, rate: 0.27, baseTax: 9400, baseLimit: 53000 }, { limit: 650000, rate: 0.35, baseTax: 46390, baseLimit: 190000 }, { limit: null, rate: 0.4, baseTax: 207390, baseLimit: 650000 }],
  2022: [{ limit: 32000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 70000, rate: 0.2, baseTax: 4800, baseLimit: 32000 }, { limit: 250000, rate: 0.27, baseTax: 12400, baseLimit: 70000 }, { limit: 880000, rate: 0.35, baseTax: 61000, baseLimit: 250000 }, { limit: null, rate: 0.4, baseTax: 281500, baseLimit: 880000 }],
  2023: [{ limit: 70000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 150000, rate: 0.2, baseTax: 10500, baseLimit: 70000 }, { limit: 370000, rate: 0.27, baseTax: 26500, baseLimit: 150000 }, { limit: 1900000, rate: 0.35, baseTax: 85900, baseLimit: 370000 }, { limit: null, rate: 0.4, baseTax: 607000, baseLimit: 1900000 }],
  2024: [{ limit: 110000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 230000, rate: 0.2, baseTax: 16500, baseLimit: 110000 }, { limit: 870000, rate: 0.27, baseTax: 40500, baseLimit: 230000 }, { limit: 3000000, rate: 0.35, baseTax: 213300, baseLimit: 870000 }, { limit: null, rate: 0.4, baseTax: 958800, baseLimit: 3000000 }],
  2025: [{ limit: 158000, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 330000, rate: 0.2, baseTax: 23700, baseLimit: 158000 }, { limit: 1200000, rate: 0.27, baseTax: 58100, baseLimit: 330000 }, { limit: 4300000, rate: 0.35, baseTax: 293000, baseLimit: 1200000 }, { limit: null, rate: 0.4, baseTax: 1410000, baseLimit: 4300000 }],
  2026: [{ limit: 198274, rate: 0.15, baseTax: 0, baseLimit: 0 }, { limit: 414117, rate: 0.2, baseTax: 29741, baseLimit: 198274 }, { limit: 1505880, rate: 0.27, baseTax: 71909, baseLimit: 414117 }, { limit: 5396070, rate: 0.35, baseTax: 366685, baseLimit: 1505880 }, { limit: null, rate: 0.4, baseTax: 1731252, baseLimit: 5396070 }],
};

const SGK_ORAN = 0.14;
const ISSIZLIK_ORAN = 0.01;
const DAMGA_ORAN = 0.00759;

function getRatesForYear(year: number): Bracket[] {
  if (incomeTaxRates[year]) return incomeTaxRates[year];
  const years = Object.keys(incomeTaxRates).map(Number).sort((a, b) => b - a);
  for (const y of years) {
    if (year >= y) return incomeTaxRates[y];
  }
  return incomeTaxRates[2010];
}

function calculateIncomeTax(year: number, income: number): number {
  const brackets = getRatesForYear(year);
  for (const b of brackets) {
    if (b.limit === null || income <= b.limit) {
      return b.baseTax + (income - b.baseLimit) * b.rate;
    }
  }
  return 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tek seferlik tutar için gelir vergisi (matrah = tutar). İhbar/kıdem tazminatı için. */
export function calculateIncomeTaxForLumpSum(year: number, matrah: number): number {
  return round2(calculateIncomeTax(year, matrah));
}

export function calculateNetFromGross(gross: number, year: number) {
  const sgk = round2(gross * SGK_ORAN);
  const issizlik = round2(gross * ISSIZLIK_ORAN);
  const matrah = gross - sgk - issizlik;
  const gelirVergisi = round2(calculateIncomeTax(year, matrah));
  const damgaVergisi = round2(gross * DAMGA_ORAN);
  const net = round2(gross - sgk - issizlik - gelirVergisi - damgaVergisi);
  return { gross, sgk, issizlik, gelirVergisi, damgaVergisi, net };
}

const ASGARI_BRUT = [
  { start: "2022-01-01", end: "2022-06-30", brut: 5004 }, { start: "2022-07-01", end: "2022-12-31", brut: 6471 },
  { start: "2023-01-01", end: "2023-06-30", brut: 10008 }, { start: "2023-07-01", end: "2023-12-31", brut: 13414.5 },
  { start: "2024-01-01", end: "2024-12-31", brut: 20002.5 }, { start: "2025-01-01", end: "2025-12-31", brut: 26005.5 },
  { start: "2026-01-01", end: "2026-12-31", brut: 33030 },
];

function getAsgariBrutForDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  const found = ASGARI_BRUT.find((x) => t >= new Date(x.start).getTime() && t <= new Date(x.end).getTime());
  return found ? found.brut : null;
}

export interface CetvelRowForNet {
  ucret?: number;
  startISO?: string;
  start?: string;
  endISO?: string;
  katsayi?: number;
  gunSayisi?: number;
  ayGunSayisi?: number;
  odenenUcret?: number;
}

export interface SegmentedNetResult {
  totalGross: number;
  totalSgk: number;
  totalIssizlik: number;
  totalGelirVergisiBrut: number;
  totalGelirVergisiIstisna: number;
  totalGelirVergisi: number;
  totalDamgaVergisiBrut: number;
  totalDamgaVergisiIstisna: number;
  totalDamgaVergisi: number;
  totalNet: number;
}

export function calculateSegmentedNetFromRows(rows: CetvelRowForNet[]): SegmentedNetResult {
  const z = (v: number) => round2(v);
  let totalGross = 0, totalSgk = 0, totalIssizlik = 0;
  let totalGelirVergisiBrut = 0, totalGelirVergisiIstisna = 0, totalGelirVergisi = 0;
  let totalDamgaVergisiBrut = 0, totalDamgaVergisiIstisna = 0, totalDamgaVergisi = 0;
  let totalNet = 0;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { totalGross: 0, totalSgk: 0, totalIssizlik: 0, totalGelirVergisiBrut: 0, totalGelirVergisiIstisna: 0, totalGelirVergisi: 0, totalDamgaVergisiBrut: 0, totalDamgaVergisiIstisna: 0, totalDamgaVergisi: 0, totalNet: 0 };
  }

  for (const row of rows) {
    const gunSayisi = row.gunSayisi ?? 0;
    const ayGunSayisi = row.ayGunSayisi ?? 30;
    const isFullMonth = gunSayisi === ayGunSayisi;
    const brut = isFullMonth
      ? (row.ucret || 0) * (row.katsayi || 1)
      : ((row.ucret || 0) / 30) * gunSayisi * (row.katsayi || 1);
    const odenenUcret = row.odenenUcret || 0;
    const netBrut = Math.max(0, brut - odenenUcret);
    if (netBrut <= 0) continue;

    const year = row.startISO || row.start ? new Date((row.startISO || row.start) as string).getFullYear() : new Date().getFullYear();
    const result = calculateNetFromGross(netBrut, year);

    let gelirIstisna = 0;
    let damgaIstisna = 0;
    if (year >= 2022) {
      const asgariBrut = getAsgariBrutForDate((row.startISO || row.start) as string);
      if (asgariBrut != null && asgariBrut > 0) {
        const asgariResult = calculateNetFromGross(asgariBrut, year);
        gelirIstisna = Math.min(result.gelirVergisi, asgariResult.gelirVergisi);
        damgaIstisna = Math.min(result.damgaVergisi, asgariResult.damgaVergisi);
      }
    }

    const net = netBrut - result.sgk - result.issizlik - (result.gelirVergisi - gelirIstisna) - (result.damgaVergisi - damgaIstisna);

    totalNet += z(net);
    totalGross += netBrut;
    totalSgk += result.sgk;
    totalIssizlik += result.issizlik;
    totalGelirVergisiBrut += result.gelirVergisi;
    totalGelirVergisiIstisna += gelirIstisna;
    totalGelirVergisi += z(result.gelirVergisi - gelirIstisna);
    totalDamgaVergisiBrut += result.damgaVergisi;
    totalDamgaVergisiIstisna += damgaIstisna;
    totalDamgaVergisi += z(result.damgaVergisi - damgaIstisna);
  }

  return {
    totalGross: z(totalGross),
    totalSgk: z(totalSgk),
    totalIssizlik: z(totalIssizlik),
    totalGelirVergisiBrut: z(totalGelirVergisiBrut),
    totalGelirVergisiIstisna: z(totalGelirVergisiIstisna),
    totalGelirVergisi: z(totalGelirVergisi),
    totalDamgaVergisiBrut: z(totalDamgaVergisiBrut),
    totalDamgaVergisiIstisna: z(totalDamgaVergisiIstisna),
    totalDamgaVergisi: z(totalDamgaVergisi),
    totalNet: z(totalNet),
  };
}

/**
 * Yıl ve döneme göre startISO (asgari ücret seçimi için)
 */
function getStartISOForYearPeriod(year: number, period?: 1 | 2): string {
  return period === 2 ? `${year}-07-15` : `${year}-06-15`;
}

/**
 * Tek aylık brüt ücret için brütten nete çeviri (Ücret Alacağı ile aynı mantık, tek ay).
 * Davacı Ücreti sayfasında kullanılır.
 * @param period - 1: Ocak-Haziran, 2: Temmuz-Aralık (asgari ücret dönemi)
 */
export function computeNetFromGrossSingle(
  gross: number,
  year: number,
  period?: 1 | 2
): SegmentedNetResult {
  if (!gross || gross <= 0) {
    return {
      totalGross: 0,
      totalSgk: 0,
      totalIssizlik: 0,
      totalGelirVergisiBrut: 0,
      totalGelirVergisiIstisna: 0,
      totalGelirVergisi: 0,
      totalDamgaVergisiBrut: 0,
      totalDamgaVergisiIstisna: 0,
      totalDamgaVergisi: 0,
      totalNet: 0,
    };
  }
  const row: CetvelRowForNet = {
    ucret: gross,
    katsayi: 1,
    gunSayisi: 30,
    ayGunSayisi: 30,
    startISO: getStartISOForYearPeriod(year, period),
  };
  return calculateSegmentedNetFromRows([row]);
}

/**
 * Tek aylık net ücret için netten brüte çeviri (Brütten Nete ile AYNI kurallar, binary search).
 * computeNetFromGrossSingle'ın tersi.
 * @param period - 1: Ocak-Haziran, 2: Temmuz-Aralık (asgari ücret dönemi)
 */
export function computeGrossFromNetSingle(netInput: number, year: number, period?: 1 | 2): SegmentedNetResult {
  if (!netInput || netInput <= 0) {
    return {
      totalGross: 0,
      totalSgk: 0,
      totalIssizlik: 0,
      totalGelirVergisiBrut: 0,
      totalGelirVergisiIstisna: 0,
      totalGelirVergisi: 0,
      totalDamgaVergisiBrut: 0,
      totalDamgaVergisiIstisna: 0,
      totalDamgaVergisi: 0,
      totalNet: 0,
    };
  }
  let low = netInput;
  let high = netInput * 2;
  let gross = netInput / 0.7;
  for (let i = 0; i < 100; i++) {
    gross = (low + high) / 2;
    const res = computeNetFromGrossSingle(gross, year, period);
    const calculatedNet = round2(res.totalNet);
    if (Math.abs(calculatedNet - netInput) < 0.005) break;
    if (calculatedNet < netInput) low = gross;
    else high = gross;
  }
  gross = round2(gross);
  const grossPlus1 = round2(gross + 0.01);
  const resPlus = computeNetFromGrossSingle(grossPlus1, year, period);
  if (round2(resPlus.totalNet) === round2(netInput)) {
    return { ...computeNetFromGrossSingle(grossPlus1, year, period), totalGross: grossPlus1 };
  }
  return { ...computeNetFromGrossSingle(gross, year, period), totalGross: gross };
}
