/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

export function normalizeCurrency(asgariUcretler: Array<{
  start: string;
  end: string;
  brut: number;
  [key: string]: any;
}>) {
  const cutoff = new Date("2005-01-01T00:00:00");

  return asgariUcretler.map((item) => {
    const endDate = new Date(item.end + "T00:00:00");

    if (endDate < cutoff) {
      return {
        ...item,
        brut: item.brut * 0.000001
      };
    }

    return { ...item };
  });
}
