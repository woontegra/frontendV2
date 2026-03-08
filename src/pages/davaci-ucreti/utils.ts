/**
 * utils.ts
 * Lokal util fonksiyonları - SADECE bu sayfa için
 */

// Asgari Ücret Tablosu
export interface AsgariUcret {
  start: string;
  end: string;
  brut: number;
}

export const asgariUcretler: AsgariUcret[] = [
  { start: "1996-08-01", end: "1997-07-31", brut: 17010000 },
  { start: "1997-08-01", end: "1998-07-31", brut: 35437500 },
  { start: "1998-08-01", end: "1998-09-30", brut: 47839500 },
  { start: "1998-10-01", end: "1998-12-31", brut: 47839500 },
  { start: "1999-01-01", end: "1999-06-30", brut: 78075000 },
  { start: "1999-07-01", end: "1999-12-31", brut: 93600000 },
  { start: "2000-01-01", end: "2000-03-31", brut: 109800000 },
  { start: "2000-04-01", end: "2000-06-30", brut: 109800000 },
  { start: "2000-07-01", end: "2000-12-31", brut: 118800000 },
  { start: "2001-01-01", end: "2001-06-30", brut: 139950000 },
  { start: "2001-07-01", end: "2001-12-31", brut: 167940000 },
  { start: "2002-01-01", end: "2002-06-30", brut: 222000750 },
  { start: "2002-07-01", end: "2002-12-31", brut: 250875000 },
  { start: "2003-01-01", end: "2003-06-30", brut: 306000000 },
  { start: "2003-07-01", end: "2003-12-31", brut: 306000000 },
  { start: "2004-01-01", end: "2004-06-30", brut: 423000000 },
  { start: "2004-07-01", end: "2004-12-31", brut: 444150000 },
  { start: "2005-01-01", end: "2005-12-31", brut: 488.70 },
  { start: "2006-01-01", end: "2006-12-31", brut: 531.00 },
  { start: "2007-01-01", end: "2007-06-30", brut: 562.50 },
  { start: "2007-07-01", end: "2007-12-31", brut: 585.00 },
  { start: "2008-01-01", end: "2008-06-30", brut: 608.40 },
  { start: "2008-07-01", end: "2008-12-31", brut: 638.70 },
  { start: "2009-01-01", end: "2009-06-30", brut: 666.00 },
  { start: "2009-07-01", end: "2009-12-31", brut: 693.00 },
  { start: "2010-01-01", end: "2010-06-30", brut: 729.00 },
  { start: "2010-07-01", end: "2010-12-31", brut: 760.50 },
  { start: "2011-01-01", end: "2011-06-30", brut: 796.50 },
  { start: "2011-07-01", end: "2011-12-31", brut: 837.00 },
  { start: "2012-01-01", end: "2012-06-30", brut: 886.50 },
  { start: "2012-07-01", end: "2012-12-31", brut: 940.50 },
  { start: "2013-01-01", end: "2013-06-30", brut: 978.60 },
  { start: "2013-07-01", end: "2013-12-31", brut: 1021.50 },
  { start: "2014-01-01", end: "2014-06-30", brut: 1071.00 },
  { start: "2014-07-01", end: "2014-12-31", brut: 1134.00 },
  { start: "2015-01-01", end: "2015-06-30", brut: 1201.50 },
  { start: "2015-07-01", end: "2015-12-31", brut: 1273.50 },
  { start: "2016-01-01", end: "2016-12-31", brut: 1647.00 },
  { start: "2017-01-01", end: "2017-12-31", brut: 1777.50 },
  { start: "2018-01-01", end: "2018-12-31", brut: 2029.50 },
  { start: "2019-01-01", end: "2019-12-31", brut: 2558.40 },
  { start: "2020-01-01", end: "2020-12-31", brut: 2943.00 },
  { start: "2021-01-01", end: "2021-12-31", brut: 3577.50 },
  { start: "2022-01-01", end: "2022-06-30", brut: 5004.00 },
  { start: "2022-07-01", end: "2022-12-31", brut: 6471.00 },
  { start: "2023-01-01", end: "2023-06-30", brut: 10008.00 },
  { start: "2023-07-01", end: "2023-12-31", brut: 13414.50 },
  { start: "2024-01-01", end: "2024-12-31", brut: 20002.50 },
  { start: "2025-01-01", end: "2025-12-31", brut: 26005.50 },
  { start: "2026-01-01", end: "2026-12-31", brut: 33030.00 }
];

export function getAsgariUcretByDate(dateString: string): number | null {
  const date = new Date(dateString);
  const found = asgariUcretler.find(
    (u) => date >= new Date(u.start) && date <= new Date(u.end)
  );
  return found ? found.brut : null;
}

/**
 * Bir yılda 2 dönem asgari ücret olup olmadığını kontrol et
 * @param year - Yıl
 * @returns true ise 2 dönem var, false ise tek dönem
 */
export function hasTwoPeriods(year: number): boolean {
  const firstPeriod = asgariUcretler.find(
    (u) => u.start.startsWith(`${year}-01-01`) || u.start.startsWith(`${year}-01-`)
  );
  const secondPeriod = asgariUcretler.find(
    (u) => u.start.startsWith(`${year}-07-01`) || u.start.startsWith(`${year}-07-`)
  );
  return !!(firstPeriod && secondPeriod);
}

/**
 * Yıl ve döneme göre asgari ücreti getir
 * @param year - Yıl
 * @param period - 1: Ocak-Haziran, 2: Temmuz-Aralık
 * @returns Asgari ücret veya null
 */
export function getAsgariUcretByYearAndPeriod(year: number, period: 1 | 2): number | null {
  if (period === 1) {
    // 1. Dönem: Ocak-Haziran (01.01 - 30.06)
    const checkDate = `${year}-03-01`; // Dönemin ortası (Mart)
    return getAsgariUcretByDate(checkDate);
  } else {
    // 2. Dönem: Temmuz-Aralık (01.07 - 31.12)
    const checkDate = `${year}-09-01`; // Dönemin ortası (Eylül)
    return getAsgariUcretByDate(checkDate);
  }
}

// Gelir Vergisi Tablosu
export interface TaxBracket {
  limit: number | null;
  rate: number;
  baseTax: number;
  baseLimit: number;
}

export const incomeTaxRates: Record<number, TaxBracket[]> = {
  2025: [
    { limit: 158000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 330000, rate: 0.20, baseTax: 23700, baseLimit: 158000 },
    { limit: 1200000, rate: 0.27, baseTax: 58100, baseLimit: 330000 },
    { limit: 4300000, rate: 0.35, baseTax: 293000, baseLimit: 1200000 },
    { limit: null, rate: 0.40, baseTax: 1410000, baseLimit: 4300000 }
  ],
  2024: [
    { limit: 110000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 230000, rate: 0.20, baseTax: 16500, baseLimit: 110000 },
    { limit: 870000, rate: 0.27, baseTax: 40500, baseLimit: 230000 },
    { limit: 3000000, rate: 0.35, baseTax: 213300, baseLimit: 870000 },
    { limit: null, rate: 0.40, baseTax: 958800, baseLimit: 3000000 }
  ],
  2023: [
    { limit: 70000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 150000, rate: 0.20, baseTax: 10500, baseLimit: 70000 },
    { limit: 370000, rate: 0.27, baseTax: 26500, baseLimit: 150000 },
    { limit: 1900000, rate: 0.35, baseTax: 85900, baseLimit: 370000 },
    { limit: null, rate: 0.40, baseTax: 607000, baseLimit: 1900000 }
  ],
  2022: [
    { limit: 32000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 70000, rate: 0.20, baseTax: 4800, baseLimit: 32000 },
    { limit: 250000, rate: 0.27, baseTax: 12400, baseLimit: 70000 },
    { limit: 880000, rate: 0.35, baseTax: 61000, baseLimit: 250000 },
    { limit: null, rate: 0.40, baseTax: 281500, baseLimit: 880000 }
  ],
  2021: [
    { limit: 24000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 53000, rate: 0.20, baseTax: 3600, baseLimit: 24000 },
    { limit: 130000, rate: 0.27, baseTax: 9400, baseLimit: 53000 },
    { limit: 650000, rate: 0.35, baseTax: 30190, baseLimit: 130000 },
    { limit: null, rate: 0.40, baseTax: 212190, baseLimit: 650000 }
  ],
  2020: [
    { limit: 22000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 49000, rate: 0.20, baseTax: 3300, baseLimit: 22000 },
    { limit: 120000, rate: 0.27, baseTax: 8700, baseLimit: 49000 },
    { limit: 600000, rate: 0.35, baseTax: 27870, baseLimit: 120000 },
    { limit: null, rate: 0.40, baseTax: 191070, baseLimit: 600000 }
  ],
  2019: [
    { limit: 18000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 40000, rate: 0.20, baseTax: 2700, baseLimit: 18000 },
    { limit: 148000, rate: 0.27, baseTax: 7100, baseLimit: 40000 },
    { limit: null, rate: 0.35, baseTax: 36260, baseLimit: 148000 }
  ],
  2018: [
    { limit: 14800, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 34000, rate: 0.20, baseTax: 2220, baseLimit: 14800 },
    { limit: 120000, rate: 0.27, baseTax: 6060, baseLimit: 34000 },
    { limit: null, rate: 0.35, baseTax: 29280, baseLimit: 120000 }
  ],
  2017: [
    { limit: 13000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 30000, rate: 0.20, baseTax: 1950, baseLimit: 13000 },
    { limit: 110000, rate: 0.27, baseTax: 5350, baseLimit: 30000 },
    { limit: null, rate: 0.35, baseTax: 26950, baseLimit: 110000 }
  ],
  2016: [
    { limit: 12600, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 30000, rate: 0.20, baseTax: 1890, baseLimit: 12600 },
    { limit: 110000, rate: 0.27, baseTax: 5370, baseLimit: 30000 },
    { limit: null, rate: 0.35, baseTax: 26970, baseLimit: 110000 }
  ],
  2015: [
    { limit: 12000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 29000, rate: 0.20, baseTax: 1800, baseLimit: 12000 },
    { limit: 106000, rate: 0.27, baseTax: 5200, baseLimit: 29000 },
    { limit: null, rate: 0.35, baseTax: 25990, baseLimit: 106000 }
  ],
  2014: [
    { limit: 11000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 27000, rate: 0.20, baseTax: 1650, baseLimit: 11000 },
    { limit: 97000, rate: 0.27, baseTax: 4850, baseLimit: 27000 },
    { limit: null, rate: 0.35, baseTax: 23750, baseLimit: 97000 }
  ],
  2013: [
    { limit: 10700, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 26000, rate: 0.20, baseTax: 1605, baseLimit: 10700 },
    { limit: 94000, rate: 0.27, baseTax: 4665, baseLimit: 26000 },
    { limit: null, rate: 0.35, baseTax: 23025, baseLimit: 94000 }
  ],
  2012: [
    { limit: 10000, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 25000, rate: 0.20, baseTax: 1500, baseLimit: 10000 },
    { limit: 88000, rate: 0.27, baseTax: 4500, baseLimit: 25000 },
    { limit: null, rate: 0.35, baseTax: 21510, baseLimit: 88000 }
  ],
  2011: [
    { limit: 9400, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 23000, rate: 0.20, baseTax: 1410, baseLimit: 9400 },
    { limit: 80000, rate: 0.27, baseTax: 4130, baseLimit: 23000 },
    { limit: null, rate: 0.35, baseTax: 19520, baseLimit: 80000 }
  ],
  2010: [
    { limit: 8800, rate: 0.15, baseTax: 0, baseLimit: 0 },
    { limit: 22000, rate: 0.20, baseTax: 1320, baseLimit: 8800 },
    { limit: 50000, rate: 0.27, baseTax: 3960, baseLimit: 22000 },
    { limit: null, rate: 0.35, baseTax: 11520, baseLimit: 50000 }
  ]
};

export const SGK_ISCIPAY_ORANI = 0.14;
export const ISSIZLIK_ISCIPAY_ORANI = 0.01;
export const DAMGA_VERGISI_ORANI = 0.00759;

export function calculateIncomeTaxForYear(year: number, income: number): number {
  const brackets = incomeTaxRates[year];
  if (!brackets) return 0;

  for (const b of brackets) {
    if (b.limit === null || income <= b.limit) {
      return b.baseTax + (income - b.baseLimit) * b.rate;
    }
  }

  return 0;
}

export function calculateIncomeTaxWithBrackets(year: number, income: number): { tax: number; summary: string } {
  const brackets = incomeTaxRates[year];
  if (!brackets) return { tax: 0, summary: '' };

  const appliedBrackets: number[] = [];
  let tax = 0;

  for (const b of brackets) {
    if (!appliedBrackets.includes(b.rate * 100)) {
      appliedBrackets.push(b.rate * 100);
    }

    if (b.limit === null || income <= b.limit) {
      tax = b.baseTax + (income - b.baseLimit) * b.rate;
      break;
    }
  }

  const summary = appliedBrackets.length > 0 
    ? `(${appliedBrackets.map(rate => `%${rate}`).join(', ')})` 
    : '';

  return { tax, summary };
}

// String'den sayıya çevirme
export function parseNum(v: string): number {
  return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
}

// Sayıyı formatla (TL formatı)
export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}
