// src/utils/currencyNormalizeCore.ts

/**
 * Eski TL → Yeni TL dönüşüm motoru
 *
 * KURAL:
 * - 01.01.2005'ten önceki tüm ücretler için 6 sıfır atılır.
 * - Çarpan: 0.000001
 * 
 * Bu fonksiyon asgariUcretler dizisini alır,
 * gerekli dönemlerde ücretleri otomatik olarak dönüştürür.
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

    // 01.01.2005'ten önce biten tüm dönemlerde 6 sıfır at
    if (endDate < cutoff) {
      return {
        ...item,
        brut: item.brut * 0.000001
      };
    }

    // Modern dönem → dokunma
    return { ...item };
  });
}
