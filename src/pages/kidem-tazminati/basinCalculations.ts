/**
 * Basın İş kıdem — v1 KidemBasinIndependent ile uyumlu (date-fns farkları, 365 günlük yıl, 5 yıl / 6 ay kuralları).
 */
import { differenceInYears, differenceInMonths, differenceInDays } from "date-fns";

export type YilAyGun = { yil: number; ay: number; gun: number };

export function computePeriodYilAyGunBasin(startISO: string, endISO: string): YilAyGun {
  if (!startISO || !endISO) return { yil: 0, ay: 0, gun: 0 };
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return { yil: 0, ay: 0, gun: 0 };
    }
    const yil = differenceInYears(end, start);
    const afterYears = new Date(start);
    afterYears.setFullYear(afterYears.getFullYear() + yil);
    const ay = differenceInMonths(end, afterYears);
    const afterMonths = new Date(afterYears);
    afterMonths.setMonth(afterMonths.getMonth() + ay);
    const gun = differenceInDays(end, afterMonths);
    return { yil, ay, gun };
  } catch {
    return { yil: 0, ay: 0, gun: 0 };
  }
}

/** Kıdem süresi: (mesleğe başlangıç || işe giriş) + deneme günü → işten çıkış */
export function computeKidemSuresiBasin(
  meslegeBaslangic: string,
  iseGiris: string,
  endDate: string,
  denemeSuresiGunRaw: string
): YilAyGun {
  const baslangicTarihi = (meslegeBaslangic || "").trim() || (iseGiris || "").trim();
  if (!baslangicTarihi || !endDate) return { yil: 0, ay: 0, gun: 0 };
  const start = new Date(baslangicTarihi);
  if (Number.isNaN(start.getTime())) return { yil: 0, ay: 0, gun: 0 };
  const den = Math.min(90, Math.max(0, Math.floor(Number(denemeSuresiGunRaw) || 0)));
  if (den > 0) start.setDate(start.getDate() + den);
  const startISO = start.toISOString().split("T")[0];
  return computePeriodYilAyGunBasin(startISO, endDate);
}

/** Çalışma süresi: işe giriş → işten çıkış */
export function computeCalismaSuresiBasin(startDate: string, endDate: string): YilAyGun {
  if (!startDate || !endDate) return { yil: 0, ay: 0, gun: 0 };
  return computePeriodYilAyGunBasin(startDate, endDate);
}

/** Mesleğe başlangıç girilmişse ve kıdem yılı 5’ten az ise hak yok sayılır */
export function kidemTazminatiHakkiYokBasin(meslegeBaslangic: string, kidemYil: number): boolean {
  if ((meslegeBaslangic || "").trim() !== "") return kidemYil < 5;
  return false;
}

/**
 * Tam 5 yıl sonrası: 6 aydan az kalan süre yıl/ay/gün hesabına dahil edilmez (v1 ile aynı).
 */
export function computeHesaplanacakDegerler(kidem: YilAyGun, hakYok: boolean): YilAyGun {
  if (hakYok) return { yil: 0, ay: 0, gun: 0 };
  let { yil, ay, gun } = kidem;
  if (yil === 5 && ay < 6) {
    ay = 0;
    gun = 0;
  }
  return { yil, ay, gun };
}

/** Günlük pay 365 (Basın İş v1) */
export function computeBrutKidemBasin(toplamBrut: number, h: YilAyGun): number {
  if (!toplamBrut || toplamBrut <= 0) return 0;
  return Math.max(
    0,
    toplamBrut * h.yil + (toplamBrut / 12) * h.ay + (toplamBrut / 365) * h.gun
  );
}
