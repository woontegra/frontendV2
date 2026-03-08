import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isPathAllowedForStarter, isStarterPlan } from '@/config/starterPlanConfig';

interface StarterPlanCheckResult {
  isStarter: boolean;
  isAllowed: boolean;
  shouldShowUpgradeModal: boolean;
  currentPath: string;
}

/**
 * Starter Plan kontrolü yapan hook
 * 
 * Kullanıcının planını ve mevcut route'u kontrol ederek
 * erişim izni olup olmadığını belirler.
 */
export function useStarterPlanCheck(): StarterPlanCheckResult {
  const { user } = useAuth();
  const location = useLocation();
  const [shouldShowUpgradeModal, setShouldShowUpgradeModal] = useState(false);

  const currentPath = location.pathname;
  const userPlan = user?.licenseType || null;
  const isStarter = isStarterPlan(userPlan);
  const isAllowed = !isStarter || isPathAllowedForStarter(currentPath);

  useEffect(() => {
    // Starter kullanıcı ve izin verilmeyen bir route'a gittiyse modal göster
    if (isStarter && !isAllowed) {
      setShouldShowUpgradeModal(true);
    } else {
      setShouldShowUpgradeModal(false);
    }
  }, [isStarter, isAllowed, currentPath]);

  return {
    isStarter,
    isAllowed,
    shouldShowUpgradeModal,
    currentPath,
  };
}

/**
 * Menü item'larını Starter planına göre filtreler
 */
export function useStarterMenuFilter() {
  const { user } = useAuth();
  const userPlan = user?.licenseType || null;
  const isStarter = isStarterPlan(userPlan);

  const filterMenuItem = (itemPath: string): boolean => {
    if (!isStarter) {
      return true; // Starter değilse tüm menüleri göster
    }
    return isPathAllowedForStarter(itemPath);
  };

  return {
    isStarter,
    filterMenuItem,
  };
}
