export interface Interval {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
}

export interface SalaryPeriod {
  year: number;
  half?: 1 | 2;
  amount: number;
}

export interface OvertimeResult {
  start: string;
  end: string;
  weeklyOvertime: number;
  totalWeeks: number;
  hourlyRate: number;
  overtimePay: number;
}

export function calculateOvertime(
  intervals: Interval[],
  salaries: SalaryPeriod[],
  baseWeeklyHours = 45
): OvertimeResult[] {
  const results: OvertimeResult[] = [];

  for (const interval of intervals) {
    const startDate = new Date(interval.start);
    const endDate = new Date(interval.end);
    const weeks = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));

    // 1️⃣ Saat farkını dakika bazında hesapla
    const [sh, sm] = interval.startTime.split(":").map(Number);
    const [eh, em] = interval.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let diff = endMins - startMins;
    // Gece yarısı devri için düzeltme
    if (diff < 0) diff += 24 * 60;
    let totalHours = diff / 60;

    // 2️⃣ Ara dinlenme – 4857/68 + Yargıtay: 7.5–10:59→1h, 11–13:59→1.5h, 14–14:59→2h, 15+→3h
    const getBreakHours = (dailyHours: number): number => {
      if (dailyHours <= 4) return 0.25;
      if (dailyHours <= 7.5) return 0.5;
      if (dailyHours < 11) return 1;
      if (dailyHours < 14) return 1.5;
      if (dailyHours < 15) return 2;
      return 3;
    };
    totalHours -= getBreakHours(totalHours);

    // 3️⃣ Haftalık saat = günlük saat * 6
    const weeklyHours = totalHours * 6;

    // 4️⃣ Haftalık fazla mesai
    const weeklyOvertime = Math.max(0, weeklyHours - baseWeeklyHours);

    // 5️⃣ Ücret hesaplama (döneme göre)
    const year = startDate.getFullYear();
    const salary = salaries.find(s => s.year === year);
    const hourlyRate = salary ? salary.amount / 225 : 0;
    const overtimePay = weeklyOvertime * weeks * hourlyRate * 1.5;

    results.push({
      start: interval.start,
      end: interval.end,
      weeklyOvertime: parseFloat(weeklyOvertime.toFixed(2)),
      totalWeeks: weeks,
      hourlyRate: parseFloat(hourlyRate.toFixed(2)),
      overtimePay: parseFloat(overtimePay.toFixed(2))
    });
  }

  return results;
}
