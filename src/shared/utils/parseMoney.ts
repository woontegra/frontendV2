export const parseMoney = (value: string | number): number => {
  if (typeof value === "number") {
    // NaN kontrolü
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
    return value;
  }
  
  if (!value || typeof value !== "string") return 0;
  
  // Boş string kontrolü
  const trimmed = String(value).trim();
  if (!trimmed) return 0;

  // Noktaları sil, virgülü noktaya çevir → sayıya dönüştür
  const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  
  // NaN veya Infinity kontrolü
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  
  return parsed;
};

