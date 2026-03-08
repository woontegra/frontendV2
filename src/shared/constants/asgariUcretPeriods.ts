export interface AsgariUcretPeriod {
  year: number;
  periods: { start: string; end: string }[];
}

export const ASGARI_UCRET_PERIODS: AsgariUcretPeriod[] = [
  // 2000–2004: Yılda 2 dönem
  ...[2000, 2001, 2002, 2003, 2004].map((y) => ({
    year: y,
    periods: [
      { start: `${y}-01-01`, end: `${y}-06-30` },
      { start: `${y}-07-01`, end: `${y}-12-31` },
    ],
  })),

  // 2005–2006: Tek dönem
  ...[2005, 2006].map((y) => ({
    year: y,
    periods: [{ start: `${y}-01-01`, end: `${y}-12-31` }],
  })),

  // 2007–2015: 2 dönem
  ...Array.from({ length: 9 }, (_, i) => 2007 + i).map((y) => ({
    year: y,
    periods: [
      { start: `${y}-01-01`, end: `${y}-06-30` },
      { start: `${y}-07-01`, end: `${y}-12-31` },
    ],
  })),

  // 2016–2021: Tek dönem
  ...Array.from({ length: 6 }, (_, i) => 2016 + i).map((y) => ({
    year: y,
    periods: [{ start: `${y}-01-01`, end: `${y}-12-31` }],
  })),

  // 2022–2023: 2 dönem (ara zamlı)
  ...[2022, 2023].map((y) => ({
    year: y,
    periods: [
      { start: `${y}-01-01`, end: `${y}-06-30` },
      { start: `${y}-07-01`, end: `${y}-12-31` },
    ],
  })),

  // 2024–2025: Tek dönem (şimdilik)
  ...[2024, 2025].map((y) => ({
    year: y,
    periods: [{ start: `${y}-01-01`, end: `${y}-12-31` }],
  })),
];

export function getAsgariUcretPeriods(year: number) {
  const found = ASGARI_UCRET_PERIODS.find((p) => p.year === year);
  return found ? found.periods : [];
}
