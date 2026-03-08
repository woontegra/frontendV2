import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../toast";
import { saveCalculation } from "../save";
import KaydetModal from "@/core/kaydet/kaydetModal";

interface KaydetOptions {
  hesapTuru: string;
  veri: any;
  mevcutId?: string | number | null;
  mevcutKayitAdi?: string | null;
  varsayilanIsim?: string;
  redirectPath?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export function useKaydet() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<KaydetOptions | null>(null);
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const performKaydetInternal = useCallback(
    async (kayitAdi: string, options: KaydetOptions) => {
      setIsSaving(true);
      try {
        const result = await saveCalculation(kayitAdi, options.hesapTuru, options.veri, options.mevcutId);

        setIsModalOpen(false);
        success(result.message || "Kayıt başarıyla kaydedildi");

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        if (options.redirectPath && result.id) {
          const redirectUrl = options.redirectPath.includes(":id")
            ? options.redirectPath.replace(":id", String(result.id))
            : `${options.redirectPath}/${result.id}`;

          setTimeout(() => {
            navigate(redirectUrl, { replace: false });
          }, 300);
        }
      } catch (err: any) {
        const errorMessage = err.message || "Kayıt sırasında bir hata oluştu";
        showError(errorMessage);
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

  const kaydetAc = useCallback(
    (options: KaydetOptions) => {
      if (options.mevcutId && options.mevcutKayitAdi) {
        performKaydetInternal(options.mevcutKayitAdi, options);
        return;
      }

      setCurrentOptions(options);
      setIsModalOpen(true);
    },
    [performKaydetInternal]
  );

  const kaydetKapat = useCallback(() => {
    setIsModalOpen(false);
    setCurrentOptions(null);
  }, []);

  const performKaydet = useCallback(
    async (kayitAdi: string) => {
      if (!currentOptions) return;
      await performKaydetInternal(kayitAdi, currentOptions);
    },
    [currentOptions, performKaydetInternal]
  );

  const KaydetModalComponent = useCallback(() => {
    if (!currentOptions) return null;

    return (
      <KaydetModal
        open={isModalOpen}
        onClose={kaydetKapat}
        onSave={performKaydet}
        hesapTuru={currentOptions.hesapTuru}
        defaultName={currentOptions.mevcutKayitAdi || currentOptions.varsayilanIsim || undefined}
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
