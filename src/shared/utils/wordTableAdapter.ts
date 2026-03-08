/**
 * Dinamik Word tablo adaptörü
 * Farklı veri formatlarını headers + rows formatına çevirir
 */

export function adaptToWordTable(data: any): { headers: string[]; rows: any[][] } {
  // Eğer data zaten { headers, rows } formatındaysa
  if (data && data.headers && data.rows) {
    return data;
  }

  // Eğer label-value listesi ise (array of objects'tan önce kontrol et)
  if (Array.isArray(data) && data.length > 0 && data[0]?.label !== undefined) {
    return {
      headers: ["Kalem", "Tutar"],
      rows: data.map((item) => [item.label, item.value]),
    };
  }

  // Eğer array of objects ise
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers.map((key) => item[key]));
    return { headers, rows };
  }

  // Fallback
  return {
    headers: [],
    rows: [],
  };
}
