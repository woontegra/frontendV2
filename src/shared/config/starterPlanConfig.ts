/**
 * Starter Plan Configuration
 * 
 * Starter Monthly planına sahip kullanıcıların erişebileceği modülleri tanımlar.
 * Veritabanı değişikliği gerektirmez, sadece frontend filtreleme için kullanılır.
 */

export interface StarterAllowedModule {
  path: string;
  name: string;
  category: string;
}

/**
 * Starter planında erişilebilir modüller
 */
export const STARTER_ALLOWED_MODULES: StarterAllowedModule[] = [
  // 1. Kıdem Tazminatı (30 İşçi)
  {
    path: '/kidem-tazminati/30isci',
    name: 'İş Kanununa Göre Kıdem Tazminatı',
    category: 'Kıdem Tazminatı',
  },
  
  // 2. İhbar Tazminatı (30 İşçi)
  {
    path: '/ihbar-tazminati/30isci',
    name: 'İş Kanununa Göre İhbar Tazminatı',
    category: 'İhbar Tazminatı',
  },
  
  // 3. Fazla Mesai (Standart)
  {
    path: '/fazla-mesai/standart',
    name: 'Standart Fazla Mesai',
    category: 'Fazla Mesai',
  },
  
  // 4. Yıllık İzin (Standart)
  {
    path: '/yillik-izin/standart',
    name: 'İş Kanununa Göre Yıllık İzin',
    category: 'Yıllık İzin',
  },
  
  // 5. UBGT Alacağı
  {
    path: '/ubgt-alacagi',
    name: 'Standart UBGT Alacağı',
    category: 'UBGT',
  },
  
  // 6. Hafta Tatili Alacağı (Standard)
  {
    path: '/hafta-tatili-alacagi/standard',
    name: 'Hafta Tatili Alacağı',
    category: 'Hafta Tatili',
  },
];

/**
 * Starter planında erişilebilir path'ler (exact matching için)
 */
export const STARTER_ALLOWED_PATHS = [
  '/kidem-tazminati/30isci',
  '/ihbar-tazminati/30isci',
  '/fazla-mesai/standart',
  '/yillik-izin/standart',
  '/ubgt-alacagi',
  '/hafta-tatili-alacagi/standard',
];

/**
 * Path'i normalize eder (lowercase, trailing slash kaldır, query/hash at)
 */
function normalizePath(path: string): string {
  if (!path) return '';
  
  // Query string ve hash'i kaldır
  const noQuery = path.split('?')[0].split('#')[0];
  
  // Lowercase yap
  const lower = noQuery.toLowerCase();
  
  // Trailing slash varsa kaldır
  return lower.endsWith('/') ? lower.slice(0, -1) : lower;
}

/**
 * Verilen path'in Starter planında erişilebilir olup olmadığını kontrol eder
 * EXACT MATCHING - Sadece tam eşleşen route'lar izin verilir
 */
export function isPathAllowedForStarter(path: string): boolean {
  const normalized = normalizePath(path);
  const isAllowed = STARTER_ALLOWED_PATHS.includes(normalized);
  
  if (import.meta.env.DEV) {
    console.log('[StarterPlanConfig] Path check:', {
      original: path,
      normalized,
      isAllowed,
      allowedPaths: STARTER_ALLOWED_PATHS
    });
  }
  
  return isAllowed;
}

/**
 * Kullanıcının planının Starter olup olmadığını kontrol eder
 */
export function isStarterPlan(plan: string | null | undefined): boolean {
  return plan === 'starter';
}

/**
 * Menü item'ının Starter planında gösterilip gösterilmeyeceğini kontrol eder
 */
export function shouldShowInStarterMenu(itemPath: string, userPlan: string | null | undefined): boolean {
  // Starter plan değilse tüm menüleri göster
  if (!isStarterPlan(userPlan)) {
    return true;
  }
  
  // Starter planındaysa sadece izin verilen modülleri göster
  return isPathAllowedForStarter(itemPath);
}
