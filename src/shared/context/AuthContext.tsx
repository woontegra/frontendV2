import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, apiClient } from "@/utils/apiClient";

export type AuthUser = { 
  id?: number; 
  name?: string; 
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  tenantId?: number;
  profilePicture?: string;  // Avatar URL
  hasValidLicense?: boolean; // License status
  licenseType?: string | null; // 'starter' | 'professional' | 'demo' | null
  licenseActive?: boolean;   // false ise "Lisansınız pasif durumda" uyarısı
  licenseStatus?: string;   // 'OK' | 'EXPIRED' | 'INACTIVE' | 'NOT_ACTIVATED' | 'NO_LICENSE'
} | null;

type AuthContextType = {
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>; // Backend'den güncel kullanıcı bilgilerini çek
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);

  // Backend'den güncel kullanıcı bilgilerini çek
  const refreshUserData = async () => {
    const token = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("current_user");
    
    if (!token) return;

    try {
      // Eğer storedUser yoksa, email'i token'dan veya başka bir yerden al
      let email = null;
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          email = parsedUser.email;
        } catch {
          // JSON parse hatası, devam et
        }
      }
      
      // Email yoksa, token'dan veya başka bir kaynaktan al
      if (!email) {
        // Token'dan email çıkarılamazsa, mevcut user state'inden al
        if (user?.email) {
          email = user.email;
        } else {
          console.warn("Email bulunamadı, refreshUserData atlanıyor");
          return;
        }
      }

      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      
      // Backend'den güncel kullanıcı bilgilerini al
      const response = await apiClient(`/api/auth/me?email=${encodeURIComponent(email)}`);

      if (response.ok) {
        const data = await response.json();
        
        // Mevcut localStorage'daki profil resmini koru (eğer backend'den gelmiyorsa)
        // Base64 localStorage'da ayrı tutulduğu için burada sadece path'i kontrol ediyoruz
        let profilePicture = data.profilePicture;
        if (!profilePicture && storedUser) {
          try {
            const parsedStored = JSON.parse(storedUser);
            // Backend'den profil resmi gelmediyse, localStorage'dakini kullan
            if (parsedStored.profilePicture) {
              profilePicture = parsedStored.profilePicture;
            }
          } catch {
            // Hata durumunda backend'den geleni kullan (null/undefined)
          }
        }
        
        // Base64'i koru (eğer varsa) - backend refresh'te base64 kaybolmasın
        // Base64 localStorage'da ayrı key olarak saklandığı için burada özel bir işlem yapmaya gerek yok
        
        const updatedUser = {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          role: data.role,
          tenantId: data.tenantId,
          profilePicture: profilePicture || undefined, // null yerine undefined kullan
          hasValidLicense: data.licenseStatus === "OK",
          licenseType: data.licenseType ?? undefined, // 'starter' | 'professional' | 'demo' - Starter menü filtresi için gerekli
          licenseActive: data.licenseActive !== false, // false ise "Lisansınız pasif durumda" gösterilir
          licenseStatus: data.licenseStatus ?? undefined,
        };
        
        // State ve localStorage'ı güncelle
        setUser(updatedUser);
        localStorage.setItem("current_user", JSON.stringify(updatedUser));
        
        // User state değiştiğinde component'ler otomatik güncellenecek
      } else {
        console.warn("Failed to refresh user data: Response not OK", response.status);
        // Backend'den veri alınamazsa, localStorage'dakini koru
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } catch {
            // Hata durumunda sessizce devam et
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  useEffect(() => {
    // İlk yüklemede localStorage'dan al
    const stored = localStorage.getItem("current_user");
    let initialProfilePicture: string | undefined = undefined;
    
    if (stored) {
      try { 
        const parsedUser = JSON.parse(stored);
        initialProfilePicture = parsedUser.profilePicture; // İlk profil resmini sakla
        setUser(parsedUser);
      } catch {
        localStorage.removeItem("current_user");
      }
    }

    // Backend'den güncel veriyi çek (profil resmi korunarak)
    const refreshWithProfilePicture = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        let email = null;
        if (stored) {
          try {
            const parsedUser = JSON.parse(stored);
            email = parsedUser.email;
          } catch {}
        }
        
        // Email yoksa, stored'dan tekrar dene
        if (!email && stored) {
          try {
            const parsedUser = JSON.parse(stored);
            email = parsedUser.email;
          } catch {}
        }
        
        if (!email) return;

        const tenantId = Number(localStorage.getItem("tenant_id") || "1");
        
        const response = await apiClient(`/api/auth/me?email=${encodeURIComponent(email)}`);

        if (response.ok) {
          const data = await response.json();
          
          // Backend'den profil resmi gelmediyse, localStorage'dakini kullan
          const profilePicture = data.profilePicture || initialProfilePicture;
          
          const updatedUser = {
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            company: data.company,
            role: data.role,
            tenantId: data.tenantId,
            profilePicture: profilePicture || undefined,
            hasValidLicense: data.licenseStatus === "OK",
            licenseType: data.licenseType || null,
            licenseActive: data.licenseActive !== false,
            licenseStatus: data.licenseStatus || undefined,
          };
          
          setUser(updatedUser);
          localStorage.setItem("current_user", JSON.stringify(updatedUser));
        }
      } catch (error) {
        console.error("Failed to refresh user data:", error);
      }
    };
    
    refreshWithProfilePicture();
  }, []);

  // Profil resmi değiştiğinde localStorage'ı da güncelle
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem("current_user");
      if (stored) {
        try {
          const parsedUser = JSON.parse(stored);
          // Sadece profil resmi değiştiyse güncelle
          if (parsedUser.profilePicture !== user.profilePicture) {
            parsedUser.profilePicture = user.profilePicture;
            localStorage.setItem("current_user", JSON.stringify(parsedUser));
          }
        } catch {
          // Hata durumunda sessizce devam et
        }
      }
    }
  }, [user?.profilePicture]);

  const logout = () => {
    localStorage.removeItem("access_token");
    window.dispatchEvent(new Event("auth-changed"));
    window.location.href = "/login";
  };

  const value = useMemo(() => ({ user, setUser, logout, refreshUser: refreshUserData }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
