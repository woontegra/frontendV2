export function normalizeLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split(/[.\-\/]/).map(Number);
  let day: number | undefined, month: number | undefined, year: number | undefined;

  // "02.04.2019" veya "2019-04-02" desteği
  if (parts[0] > 1900) {
    [year, month, day] = parts as [number, number, number];
  } else {
    [day, month, year] = parts as [number, number, number];
  }

  // UTC farkı olmadan yerel saatli tarih oluştur
  return new Date((year as number), (month as number) - 1, (day as number));
}

export function normalizeInterval(startStr: string, endStr: string) {
  const start = normalizeLocalDate(startStr);
  const end = normalizeLocalDate(endStr);
  end.setHours(23, 59, 59, 999); // gün sonunu dahil et
  return { start, end };
}
