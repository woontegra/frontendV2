/**
 * Abonelik hesaplama utility fonksiyonları
 * Dashboard ve Profil sayfası için ortak kullanım
 */

export interface SubscriptionCalculation {
  // Tarihler
  startDate: Date | null;
  endDate: Date | null;
  today: Date;
  
  // Gün hesaplamaları
  totalDays: number;
  daysUsed: number;
  daysRemaining: number;
  
  // Yüzdeler
  usedPct: number;
  remainingPct: number;
  
  // Durum
  hasSubscription: boolean;
  isActive: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean; // 7 günden az
}

/**
 * Abonelik bilgilerini hesapla
 * @param subscriptionStartsAt - Başlangıç tarihi (ISO string)
 * @param subscriptionEndsAt - Bitiş tarihi (ISO string)
 * @returns SubscriptionCalculation
 */
export function calculateSubscription(
  subscriptionStartsAt: string | null | undefined,
  subscriptionEndsAt: string | null | undefined
): SubscriptionCalculation {
  // Varsayılan değerler
  const defaultResult: SubscriptionCalculation = {
    startDate: null,
    endDate: null,
    today: new Date(),
    totalDays: 0,
    daysUsed: 0,
    daysRemaining: 0,
    usedPct: 0,
    remainingPct: 0,
    hasSubscription: false,
    isActive: false,
    isExpired: true,
    isExpiringSoon: false,
  };

  // Bitiş tarihi yoksa abonelik yok
  if (!subscriptionEndsAt) {
    return defaultResult;
  }

  try {
    const endDate = new Date(subscriptionEndsAt);
    const startDate = subscriptionStartsAt ? new Date(subscriptionStartsAt) : new Date();
    const today = new Date();

    // Sadece tarih kısmını kullan (saat/dakika farkını kaldır)
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    // Geçersiz tarih kontrolü
    if (isNaN(endDate.getTime()) || isNaN(startDate.getTime())) {
      return defaultResult;
    }

    // Toplam abonelik süresi (gün)
    const totalMs = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));

    // Kalan gün sayısı
    const remainingMs = endDate.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    // Kullanılan gün sayısı
    const daysUsed = Math.max(0, totalDays - daysRemaining);

    // Yüzdeler (1 ondalık basamak)
    const remainingPct = totalDays > 0 ? Math.round((daysRemaining / totalDays) * 1000) / 10 : 0;
    const usedPct = totalDays > 0 ? Math.round((daysUsed / totalDays) * 1000) / 10 : 0;

    // Durum kontrolleri
    const isActive = daysRemaining > 0;
    const isExpired = daysRemaining <= 0;
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;

    return {
      startDate,
      endDate,
      today,
      totalDays,
      daysUsed,
      daysRemaining,
      usedPct,
      remainingPct,
      hasSubscription: true,
      isActive,
      isExpired,
      isExpiringSoon,
    };
  } catch (error) {
    console.error('Subscription calculation error:', error);
    return defaultResult;
  }
}

/**
 * Tarihi Türkçe formatla
 * @param date - Tarih string veya Date objesi
 * @returns Formatlanmış tarih (örn: "15 Kasım 2025")
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Sayıyı Türkçe formatla (1.234 formatında)
 * @param num - Sayı
 * @returns Formatlanmış sayı
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('tr-TR');
}

/**
 * Renk sınıfı döndür (durum bazlı)
 * @param daysRemaining - Kalan gün
 * @returns Tailwind class
 */
export function getStatusColor(daysRemaining: number): {
  text: string;
  bg: string;
  badge: 'default' | 'secondary' | 'destructive';
} {
  if (daysRemaining > 30) {
    return {
      text: 'text-green-600 dark:text-green-400',
      bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
      badge: 'default',
    };
  } else if (daysRemaining > 7) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-gradient-to-r from-amber-500 to-orange-600',
      badge: 'secondary',
    };
  } else {
    return {
      text: 'text-red-600 dark:text-red-400',
      bg: 'bg-gradient-to-r from-red-500 to-rose-600',
      badge: 'destructive',
    };
  }
}
















