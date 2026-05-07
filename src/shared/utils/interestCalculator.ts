import { legalInterestRates } from "../../constants/legalInterestRates";

export type InterestType = "LEGAL_INTEREST" | "HIGHEST_DEPOSIT_INTEREST";

type DepositInterestRatePeriod = {
  startDate: string;
  endDate: string | null;
  rate: number;
  source: "TCMB_EVDS";
  currency: "TRY";
  maturity: "ONE_YEAR_OR_LESS";
};

// Veri kaynağı hazır olduğunda bu dizi doldurulacak.
const depositInterestRates: DepositInterestRatePeriod[] = [];
export type DepositInterestRateInput = {
  startDate: string;
  endDate: string | null;
  rate: number;
  source: "TCMB_EVDS";
  currency: "TRY";
  maturity: "ONE_YEAR_OR_LESS";
};

export type InterestPeriodResult = {
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  interest: number;
};

export type CalculateInterestSuccess = {
  ok: true;
  totalDays: number;
  totalInterest: number;
  periods: InterestPeriodResult[];
};

export type CalculateInterestError = {
  ok: false;
  message: string;
};

export type CalculateInterestResult = CalculateInterestSuccess | CalculateInterestError;

type CalculateInterestInput = {
  principal: number;
  startDate: string;
  endDate: string;
  interestType: InterestType;
  depositInterestRates?: DepositInterestRateInput[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round((value || 0) * 100) / 100;
}

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function diffDaysUtc(startDate: string, endDate: string): number {
  const start = toUtcDate(startDate).getTime();
  const end = toUtcDate(endDate).getTime();
  return Math.floor((end - start) / DAY_MS);
}

function addDaysUtc(dateStr: string, days: number): string {
  const dt = toUtcDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

function calculatePeriodInterest(principal: number, days: number, rate: number): number {
  return (principal * days * rate) / 36500;
}

function calculateFromPeriods({
  principal,
  startDate,
  endDate,
  periods,
}: {
  principal: number;
  startDate: string;
  endDate: string;
  periods: Array<{ startDate: string; endDate: string | null; rate: number }>;
}) {
  const allPeriods: InterestPeriodResult[] = [];
  const endExclusive = addDaysUtc(endDate, 1);

  for (const period of periods) {
    const periodEnd = period.endDate ?? endDate;
    const periodEndExclusive = addDaysUtc(periodEnd, 1);
    const overlapStart = maxDate(startDate, period.startDate);
    const overlapEndExclusive = minDate(endExclusive, periodEndExclusive);
    if (overlapStart >= overlapEndExclusive) continue;
    const days = diffDaysUtc(overlapStart, overlapEndExclusive);
    if (days <= 0) continue;
    allPeriods.push({
      startDate: overlapStart,
      endDate: addDaysUtc(overlapEndExclusive, -1),
      days,
      rate: period.rate,
      interest: round2(calculatePeriodInterest(principal, days, period.rate)),
    });
  }

  return {
    totalDays: allPeriods.reduce((sum, item) => sum + item.days, 0),
    totalInterest: round2(allPeriods.reduce((sum, item) => sum + item.interest, 0)),
    periods: allPeriods,
  };
}

export function calculateInterest({
  principal,
  startDate,
  endDate,
  interestType,
  depositInterestRates: dbDepositInterestRates,
}: CalculateInterestInput): CalculateInterestResult {
  if (!principal || principal <= 0) {
    return { ok: false, message: "Brüt alacak tutarı boş veya net tutar 0 olduğu için faiz hesaplanamaz." };
  }

  if (!startDate || !endDate) {
    return { ok: false, message: "Faiz hesaplaması için tarih alanları zorunludur." };
  }

  if (startDate > endDate) {
    return { ok: false, message: "Faiz başlangıç tarihi, icra takip tarihinden sonra olamaz." };
  }

  if (interestType === "HIGHEST_DEPOSIT_INTEREST") {
    const activeDepositRates = dbDepositInterestRates ?? depositInterestRates;
    if (activeDepositRates.length === 0) {
      return {
        ok: false,
        message:
          "Bankalarca mevduatlara uygulanan en yüksek faiz oranı verisi henüz sisteme tanımlanmamış. Lütfen faiz oranı verisi eklendikten sonra hesaplama yapınız.",
      };
    }
    const depositResult = calculateFromPeriods({
      principal,
      startDate,
      endDate,
      periods: activeDepositRates,
    });
    return { ok: true, ...depositResult };
  }

  const totalDays = diffDaysUtc(startDate, endDate);
  if (totalDays === 0) {
    return { ok: true, totalDays: 0, totalInterest: 0, periods: [] };
  }

  const legalResult = calculateFromPeriods({
    principal,
    startDate,
    endDate,
    periods: legalInterestRates,
  });
  return { ok: true, ...legalResult };
}
