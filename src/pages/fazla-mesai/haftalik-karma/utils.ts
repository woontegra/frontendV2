/**
 * Haftalık Karma - Haftalık FM hesaplama (dayGroups'tan)
 * 4857/68 + Yargıtay: ara dinlenme süreleri
 */

import type { PatternDay } from "./types";

const WEEKLY_WORK_LIMIT = 45;

function calculateLegalBreak(dailyHours: number): number {
  if (dailyHours <= 4) return 0.25;
  if (dailyHours <= 7.5) return 0.5;
  if (dailyHours < 11) return 1;
  if (dailyHours < 14) return 1.5;
  if (dailyHours < 15) return 2;
  return 3;
}

/**
 * dayGroups'tan haftalık fazla mesai saati hesaplar
 */
export function calculateWeeklyFMFromDayGroups(
  dayGroups: PatternDay[],
  hasWeeklyHoliday = false,
  weeklyHolidayGroup = 1
): number {
  if (!dayGroups?.length) return 0;

  const groupTotals: number[] = [];

  dayGroups.forEach((group, groupIdx) => {
    const days = (group as { dayCount?: number; days?: number }).dayCount ?? (group as { dayCount?: number; days?: number }).days ?? 0;
    if (!group.startTime || !group.endTime || days === 0) return;

    const [girH, girM] = group.startTime.split(":").map(Number);
    const [cikH, cikM] = group.endTime.split(":").map(Number);
    const dailyMinutes = (cikH || 0) * 60 + (cikM || 0) - ((girH || 0) * 60 + (girM || 0));
    const dailyHours = dailyMinutes / 60;

    const breakPerDay = calculateLegalBreak(dailyHours);
    const netDaily = dailyHours - breakPerDay;

    const isHolidayGroup = hasWeeklyHoliday && groupIdx + 1 === weeklyHolidayGroup;

    if (isHolidayGroup && days > 0) {
      const normalDays = days - 1;
      const normalTotal = netDaily * normalDays;
      const holidayOvertime = Math.max(0, netDaily - 7.5);
      groupTotals.push(normalTotal + holidayOvertime);
    } else {
      groupTotals.push(netDaily * days);
    }
  });

  const totalNet = groupTotals.reduce((s, v) => s + v, 0);
  const roundedWeekly = Math.round(totalNet);
  return Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
}

/** Metin Hesaplaması için gün gruplarından metin üretir */
export function generateWeeklyText(
  dayGroups: Array<{ dayCount?: number; days?: number; startTime: string; endTime: string }>,
  title: string,
  hasWeeklyHoliday = false,
  weeklyHolidayGroup = 1
): { label: string; text: string; weeklyFMHours: number } | null {
  if (!dayGroups?.length) return null;

  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  const textLines: string[] = [];
  const groupTotals: number[] = [];

  textLines.push(`${title}:`);

  dayGroups.forEach((group, groupIdx) => {
    const days = group.dayCount ?? group.days ?? 0;
    if (!group.startTime || !group.endTime || days === 0) return;

    const [girH, girM] = group.startTime.split(":").map(Number);
    const [cikH, cikM] = group.endTime.split(":").map(Number);
    const dailyMinutes = (cikH || 0) * 60 + (cikM || 0) - ((girH || 0) * 60 + (girM || 0));
    const dailyHours = dailyMinutes / 60;
    const breakPerDay = calculateLegalBreak(dailyHours);
    const netDaily = dailyHours - breakPerDay;
    const isHolidayGroup = hasWeeklyHoliday && groupIdx + 1 === weeklyHolidayGroup;

    if (isHolidayGroup && days > 0) {
      const normalDays = days - 1;
      const normalTotal = netDaily * normalDays;
      const holidayOvertime = Math.max(0, netDaily - 7.5);
      const groupTotal = normalTotal + holidayOvertime;
      groupTotals.push(groupTotal);
      if (normalDays > 0) {
        textLines.push(`${normalDays} gün ${group.startTime} - ${group.endTime} = ${dailyHours.toFixed(2)} saat çalışma ${fmt(breakPerDay)} saat ara dinlenme = ${fmt(netDaily)} saat,`);
        textLines.push(`${normalDays} gün X ${fmt(netDaily)} saat = ${fmt(normalTotal)} saat`);
      }
      textLines.push(`${fmt(netDaily)} - 7,5 saat (hafta tatili) = ${fmt(holidayOvertime)} saat hafta tatili fazla mesai,`);
      textLines.push(`${fmt(normalTotal)} saat + ${fmt(holidayOvertime)} saat (hafta tatili) = ${fmt(groupTotal)} saat`);
      textLines.push("");
    } else {
      const groupTotal = netDaily * days;
      groupTotals.push(groupTotal);
      textLines.push(`${days} gün ${group.startTime} - ${group.endTime} = ${dailyHours.toFixed(2)} saat çalışma ${fmt(breakPerDay)} saat ara dinlenme = ${fmt(netDaily)} saat,`);
      textLines.push(`${days} Gün X ${fmt(netDaily)} saat = ${fmt(groupTotal)} saat,`);
      textLines.push("");
    }
  });

  if (groupTotals.length === 0 && !hasWeeklyHoliday) return null;

  const totalNet = groupTotals.reduce((s, v) => s + v, 0);
  const roundedWeekly = Math.round(totalNet);
  const weeklyOvertime = Math.max(0, roundedWeekly - WEEKLY_WORK_LIMIT);
  const groupSums = groupTotals.map((g) => `${fmt(g)} saat`).join(" + ");
  textLines.push(`Toplam çalışma = ${groupSums} = ${roundedWeekly} saat`);
  textLines.push(`Net haftalık çalışma = ${roundedWeekly} saat,`);
  textLines.push(`${roundedWeekly} – 45 saat yasal haftalık çalışma = ${weeklyOvertime} saat haftalık fazla mesai`);

  return {
    label: title,
    text: textLines.join("\n"),
    weeklyFMHours: weeklyOvertime,
  };
}
