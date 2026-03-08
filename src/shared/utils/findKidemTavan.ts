import { KIDEM_TAVAN_DONEMLERI } from "@/constants/kidemTavan";

export function findKidemTavan(exitDate: Date): number | null {
  // Tarihi sadece gün/ay/yıl olarak normalize et (saat bilgisini sıfırla)
  const normalizedExitDate = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate());
  
  for (const d of KIDEM_TAVAN_DONEMLERI) {
    // Tarih formatı: "DD.MM.YYYY" -> "YYYY-MM-DD"
    const startParts = d.start.split(".");
    const endParts = d.end.split(".");
    
    const start = new Date(
      parseInt(startParts[2], 10), // Yıl
      parseInt(startParts[1], 10) - 1, // Ay (0-indexed)
      parseInt(startParts[0], 10) // Gün
    );
    
    const end = new Date(
      parseInt(endParts[2], 10), // Yıl
      parseInt(endParts[1], 10) - 1, // Ay (0-indexed)
      parseInt(endParts[0], 10) // Gün
    );

    // Tarih aralığını kontrol et (başlangıç ve bitiş dahil)
    if (normalizedExitDate >= start && normalizedExitDate <= end) {
      return d.tavan;
    }
  }
  return null;
}

