/**
 * Standart hafta tatili — kayıt payload'ı v1 prepareSaveData ile aynı yapı (backend uyumu).
 */

export function prepareHaftaTatiliStandardSave(
  dateRanges: unknown[],
  selectedHolidayIds: string[],
  haftaTatiliExcludedDays: unknown[],
  haftaTatiliExpiryStart: string | null,
  haftaTatiliKullanimBaslangic: string,
  haftaTatiliKullanimBitis: string,
  haftaTatiliKullanimGunSayisi: number,
  haftaTatiliRows: unknown[],
  haftaTatiliTotalBrutFromRows: number,
  haftaTatiliNetSummary: {
    net: number;
    brut: number;
    hakkaniyet: number;
    settleAmount: string;
    [k: string]: unknown;
  },
  totalDays: number,
  katsayi: number
) {
  const startDate = dateRanges
    .filter((r: { start?: string }) => r.start)
    .map((r: { start: string }) => new Date(r.start).getTime())
    .sort((a, b) => a - b)[0];
  const endDate = dateRanges
    .filter((r: { end?: string }) => r.end)
    .map((r: { end: string }) => new Date(r.end).getTime())
    .sort((a, b) => b - a)[0];

  const startDateStr = startDate ? new Date(startDate).toISOString().slice(0, 10) : null;
  const endDateStr = endDate ? new Date(endDate).toISOString().slice(0, 10) : null;

  const mapExcluded = (day: any) => {
    const originalType = day.type ?? (day as any).type;
    let typeValue = "Diğer";
    if (originalType !== undefined && originalType !== null && String(originalType).trim() !== "") {
      typeValue = String(originalType).trim();
    }
    return {
      id: day.id || Math.random().toString(36).slice(2),
      type: typeValue,
      start: day.start || "",
      end: day.end || "",
      days: day.days || 0,
    };
  };

  const haftaTatiliData = {
    periods: haftaTatiliRows,
    totalBrut: haftaTatiliTotalBrutFromRows,
    totalNet: haftaTatiliNetSummary.net,
    netConversion: haftaTatiliNetSummary,
    settlement: {
      hakkaniyet: haftaTatiliNetSummary.hakkaniyet,
      settleAmount: haftaTatiliNetSummary.settleAmount,
      sonuc: Math.max(0, haftaTatiliNetSummary.brut - haftaTatiliNetSummary.hakkaniyet),
    },
    workerPeriods: dateRanges,
    selectedHolidays: selectedHolidayIds,
    calculatedHaftaTatiliDays: totalDays,
    katsayi,
    zamanasimi: { active: !!haftaTatiliExpiryStart, start: haftaTatiliExpiryStart },
    excludedDays: haftaTatiliExcludedDays.map(mapExcluded),
    haftaTatiliKullanim: {
      baslangic: haftaTatiliKullanimBaslangic,
      bitis: haftaTatiliKullanimBitis,
      gunSayisi: haftaTatiliKullanimGunSayisi,
    },
    startDate: startDateStr,
    endDate: endDateStr,
    notes: "",
  };

  return {
    data: {
      form: {
        workerPeriods: dateRanges,
        selectedHolidays: selectedHolidayIds,
        excludedDays: haftaTatiliExcludedDays.map(mapExcluded),
        zamanasimi: { active: !!haftaTatiliExpiryStart, start: haftaTatiliExpiryStart },
        haftaTatiliKullanim: {
          baslangic: haftaTatiliKullanimBaslangic,
          bitis: haftaTatiliKullanimBitis,
          gunSayisi: haftaTatiliKullanimGunSayisi,
        },
        periods: haftaTatiliRows,
        katsayi,
        calculatedHaftaTatiliDays: totalDays,
        settlement: haftaTatiliData.settlement,
      },
      results: {
        totals: { brut: haftaTatiliTotalBrutFromRows, net: haftaTatiliNetSummary.net },
        brut: haftaTatiliTotalBrutFromRows,
        net: haftaTatiliNetSummary.net,
        netConversion: haftaTatiliNetSummary,
      },
    },
    start_date: startDateStr,
    end_date: endDateStr,
    brut_total: haftaTatiliTotalBrutFromRows,
    net_total: haftaTatiliNetSummary.net,
    notes: "",
    ...haftaTatiliData,
  };
}
