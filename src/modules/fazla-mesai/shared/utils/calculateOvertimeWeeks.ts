// ============================================================================
// calculateOvertimeWeeks.ts - TEK DOĞRU 270 SAAT DÜŞÜM FONKSİYONU
// ============================================================================
//
// KURALLAR:
// 1) 270 saat düşümü İŞE GİRİŞ YILI bazlıdır (satır bazlı DEĞİL)
// 2) dropWeeks = Math.round(270 / weeklyOvertimeHour) - DİNAMİK
// 3) limitationDate öncesi haftalar hesaba GİRMEZ ama 270 başlangıcını DEĞİŞTİRMEZ
// 4) Sıra: hire-year havuzları → 270 düşüm → kronolojik dağıtım → yıllık izin /7
// 5) Yıllık izin: sadece ilgili satır, /7, round, satırlar arası taşıma YOK
// 6) Negatif hafta ÇIKAMAZ
//
// ============================================================================

import { normalizeLocalDate } from "./dateHelpers";

export type TableRow = {
  start: Date;
  end: Date;
};

export type AnnualLeave = {
  start: Date;
  end: Date;
  days: number;
};

export type OvertimeWeekResult = {
  start: Date;
  end: Date;
  week: number;
};

export type CalculateOvertimeWeeksParams = {
  hireDate: Date;
  terminationDate: Date;
  limitationDate: Date;
  weeklyOvertimeHour: number;
  tableRows: TableRow[];
  annualLeaves: AnnualLeave[];
};

/**
 * TEK DOĞRU 270 SAAT DÜŞÜM FONKSİYONU
 * Tüm projede bu fonksiyon kullanılacak, başka 270 hesabı OLMAYACAK
 */
export function calculateOvertimeWeeks(
  params: CalculateOvertimeWeeksParams
): OvertimeWeekResult[] {
  const {
    hireDate,
    terminationDate,
    limitationDate,
    weeklyOvertimeHour,
    tableRows,
    annualLeaves = [],
  } = params;

  if (!hireDate || !terminationDate || !weeklyOvertimeHour || weeklyOvertimeHour <= 0) {
    return tableRows.map((r) => ({ ...r, week: 0 }));
  }

  // KURAL 2: dropWeeks dinamik hesaplama
  const dropWeeks = Math.round(270 / weeklyOvertimeHour);

  // KURAL 1: İşe giriş yılı bazlı havuzlar oluştur
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();
  const hireDay = hireDate.getDate();

  const pools: Array<{
    start: Date;
    end: Date;
    remainingDropWeeks: number;
    weeks: Array<{
      originalRow: TableRow;
      weeks: number;
      start: Date;
      end: Date;
      afterDrop?: number;
    }>;
  }> = [];

  let currentYearStart = new Date(hireYear, hireMonth, hireDay);

  while (currentYearStart < terminationDate) {
    const nextYearStart = new Date(currentYearStart);
    nextYearStart.setFullYear(nextYearStart.getFullYear() + 1);

    const poolEnd = nextYearStart < terminationDate ? nextYearStart : terminationDate;

    pools.push({
      start: new Date(currentYearStart),
      end: new Date(poolEnd),
      remainingDropWeeks: dropWeeks,
      weeks: [],
    });

    currentYearStart = nextYearStart;
  }

  // KURAL 4a: Tablo satırlarını haftalara çevir ve havuzlara ata
  for (const row of tableRows) {
    const rowStart = new Date(row.start);
    const rowEnd = new Date(row.end);

    // Satırın kaç hafta olduğunu hesapla
    const days = Math.floor((rowEnd.getTime() - rowStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalWeeks = Math.floor(days / 7);

    if (totalWeeks <= 0) continue;

    // Bu satırı ilgili havuza/havuzlara dağıt
    for (const pool of pools) {
      if (rowEnd < pool.start || rowStart >= pool.end) continue;

      const overlapStart = rowStart > pool.start ? rowStart : pool.start;
      const overlapEnd = rowEnd < pool.end ? rowEnd : pool.end;

      if (overlapStart >= overlapEnd) continue;

      const overlapDays =
        Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const overlapWeeks = Math.floor(overlapDays / 7);

      if (overlapWeeks > 0) {
        pool.weeks.push({
          originalRow: row,
          weeks: overlapWeeks,
          start: new Date(overlapStart),
          end: new Date(overlapEnd),
        });
      }
    }
  }

  // KURAL 4b: Her havuzda ilk dropWeeks haftayı düş
  for (const pool of pools) {
    pool.weeks.sort((a, b) => a.start.getTime() - b.start.getTime());

    let dropped = 0;
    for (const w of pool.weeks) {
      if (dropped >= pool.remainingDropWeeks) {
        w.afterDrop = w.weeks;
        continue;
      }

      const canDrop = Math.min(w.weeks, pool.remainingDropWeeks - dropped);
      dropped += canDrop;
      w.afterDrop = w.weeks - canDrop;
    }
  }

  // KURAL 4c: Kronolojik olarak frontend satırlarına dağıt
  const resultMap = new Map<string, OvertimeWeekResult>();

  for (const pool of pools) {
    for (const w of pool.weeks) {
      const key = `${w.originalRow.start.getTime()}_${w.originalRow.end.getTime()}`;

      if (!resultMap.has(key)) {
        resultMap.set(key, {
          start: w.originalRow.start,
          end: w.originalRow.end,
          week: 0,
        });
      }

      const current = resultMap.get(key)!;
      current.week += w.afterDrop || 0;
    }
  }

  // KURAL 3: limitationDate öncesi satırları filtrele (hafta = 0)
  const limitDate = limitationDate || hireDate;

  for (const [key, result] of resultMap.entries()) {
    if (result.end < limitDate) {
      result.week = 0;
    }
  }

  // KURAL 4d: Yıllık izin düşümü (satır bazlı, /7, round)
  for (const [key, result] of resultMap.entries()) {
    if (result.week <= 0) continue;

    // Bu satırdaki yıllık izin günlerini bul
    let totalLeaveDays = 0;

    for (const leave of annualLeaves) {
      if (leave.end < result.start || leave.start > result.end) continue;

      const overlapStart = leave.start > result.start ? leave.start : result.start;
      const overlapEnd = leave.end < result.end ? leave.end : result.end;

      if (overlapStart <= overlapEnd) {
        totalLeaveDays += leave.days || 0;
      }
    }

    if (totalLeaveDays > 0) {
      const leaveWeeks = Math.round(totalLeaveDays / 7);
      result.week = Math.max(0, result.week - leaveWeeks);
    }
  }

  // KURAL 6: Negatif hafta kontrolü
  const finalResults = Array.from(resultMap.values()).map((r) => ({
    start: r.start,
    end: r.end,
    week: Math.max(0, Math.round(r.week)),
  }));

  // Orijinal sırayla döndür
  return tableRows.map((row) => {
    const found = finalResults.find(
      (r) => r.start.getTime() === row.start.getTime() && r.end.getTime() === row.end.getTime()
    );
    return found || { start: row.start, end: row.end, week: 0 };
  });
}
