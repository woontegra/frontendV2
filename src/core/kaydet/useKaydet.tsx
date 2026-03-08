/**
 * Merkezi Kayıt Hook'u
 * Tüm sayfalar bu hook'u kullanarak kayıt işlemi yapacak
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { kaydetHesap, type HesapTuru, type KayitSonucu } from "./kaydetServisi";
import KaydetModal from "./kaydetModal";

interface KaydetOptions {
  hesapTuru: HesapTuru;
  veri: any;
  mevcutId?: string | number | null;
  mevcutKayitAdi?: string | null; // Mevcut kaydın ismi (güncelleme için)
  varsayilanIsim?: string; // Yeni kayıt için varsayılan isim (opsiyonel)
  redirectPath?: string; // Kayıt sonrası yönlendirme yolu (opsiyonel)
  onSuccess?: (result: KayitSonucu) => void; // Başarılı kayıt sonrası callback
  onError?: (error: Error) => void; // Hata durumunda callback
}

export function useKaydet() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<KaydetOptions | null>(null);
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  /**
   * Gerçek kayıt işlemini yapar (hem modal'dan hem direkt çağrılabilir)
   */
  const performKaydetInternal = useCallback(
    async (kayitAdi: string, options: KaydetOptions) => {
      setIsSaving(true);
      try {
        const result = await kaydetHesap(
          kayitAdi,
          options.hesapTuru,
          options.veri,
          options.mevcutId
        );

        setIsModalOpen(false);
        success(result.message || "Kayıt başarıyla kaydedildi");

        // Callback varsa çağır
        if (options.onSuccess) {
          options.onSuccess(result);
        }

        // Redirect varsa yap
        if (options.redirectPath && result.id) {
          const redirectUrl = options.redirectPath.includes(":id")
            ? options.redirectPath.replace(":id", String(result.id))
            : `${options.redirectPath}/${result.id}`;
          
          console.log('[useKaydet] Redirecting to:', redirectUrl);
          
          // replace: false kullan ki component kesin yeniden mount olsun
          setTimeout(() => {
            console.log('[useKaydet] Navigating now');
            navigate(redirectUrl, { replace: false });
          }, 300);
        }
      } catch (err: any) {
        console.error("Kayıt hatası:", err);
        const errorMessage = err.message || "Kayıt sırasında bir hata oluştu";
        showError(errorMessage);

        // Error callback varsa çağır
        if (options.onError) {
          options.onError(err);
        }
      } finally {
        setIsSaving(false);
        setCurrentOptions(null);
      }
    },
    [navigate, success, showError]
  );

  /**
   * Kayıt modal'ını açar veya direkt kayıt yapar
   * @param options - Kayıt seçenekleri
   */
  const kaydetAc = useCallback((options: KaydetOptions) => {
    // Eğer mevcutId varsa ve mevcut kayıt adı varsa, modal açmadan direkt güncelleme yap
    if (options.mevcutId && options.mevcutKayitAdi) {
      // Direkt kayıt yap (güncelleme)
      performKaydetInternal(options.mevcutKayitAdi, options);
      return;
    }
    
    // Yeni kayıt veya isim yoksa modal aç
    setCurrentOptions(options);
    setIsModalOpen(true);
  }, [performKaydetInternal]);

  /**
   * Modal'ı kapatır
   */
  const kaydetKapat = useCallback(() => {
    setIsModalOpen(false);
    setCurrentOptions(null);
  }, []);

  /**
   * Modal'dan çağrılan kayıt işlemi
   */
  const performKaydet = useCallback(
    async (kayitAdi: string) => {
      if (!currentOptions) return;
      await performKaydetInternal(kayitAdi, currentOptions);
    },
    [currentOptions, performKaydetInternal]
  );

  /**
   * Modal component'ini render eder
   */
  const KaydetModalComponent = useCallback(() => {
    if (!currentOptions) return null;

    return (
      <KaydetModal
        open={isModalOpen}
        onClose={kaydetKapat}
        onSave={performKaydet}
        hesapTuru={currentOptions.hesapTuru}
        defaultName={currentOptions.mevcutKayitAdi || currentOptions.varsayilanIsim || undefined} // Mevcut kayıt adı veya varsayılan isim
        isLoading={isSaving}
      />
    );
  }, [isModalOpen, isSaving, currentOptions, kaydetKapat, performKaydet]);

  return {
    kaydetAc,
    kaydetKapat,
    isModalOpen,
    isSaving,
    KaydetModal: KaydetModalComponent,
  };
}

