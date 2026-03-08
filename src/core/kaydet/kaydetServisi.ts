/**
 * Merkezi Kayıt Servisi
 * Tüm hesaplama türleri için tek kayıt noktası
 */

import { apiClient } from '@/utils/apiClient';

// Hesap türleri için type tanımı
export type HesapTuru =
  | "kidem_30isci"
  | "kidem_gemi"
  | "kidem_mevsimlik"
  | "kidem_basin"
  | "kidem_kismi_sureli"
  | "kidem_belirli_sureli"
  | "kidem_borclar"
  | "kidem_part_time"
  | "kidem_parca_basi"
  | "kidem_toplu_sozlesme"
  | "ihbar_tazminati"
  | "fazla_mesai"
  | "ucret_alacagi"
  | "prim_alacagi"
  | "ubgt_alacagi"
  | "davaci_ucreti"
  | string;

export interface KayitVerisi {
  // Standart payload formatı
  tenant_id?: number;
  aciklama: string; // Modal'dan gelen kayıt adı
  calculation_type: string; // Hesaplama türü
  brut_total: number; // Ekranda hesaplanan brüt toplam
  net_total: number; // Ekranda hesaplanan net toplam
  ise_giris?: string | null; // İşe giriş tarihi
  isten_cikis?: string | null; // İşten çıkış tarihi
  detay: any; // Detaylı hesap tablosu JSON
  // Geriye dönük uyumluluk için eski alanlar (opsiyonel)
  start_date?: string | null;
  end_date?: string | null;
  total?: number;
  notes?: string;
  kayit_adi?: string;
  data?: any;
}

export interface KayitSonucu {
  id: number;
  success: boolean;
  message?: string;
  name?: string; // Kayıt adı (modal'dan girilen veya mevcut)
}

/**
 * Tek kayıt fonksiyonu - Tüm hesaplama türleri için
 * @param kayitAdi - Kullanıcının verdiği kayıt adı
 * @param hesapTuru - Hesaplama türü (kidem_30isci, fazla_mesai, vb.)
 * @param veri - Hesaplama sayfasından gelen veri objesi
 * @param mevcutId - Varsa güncelleme için mevcut kayıt ID'si
 * @returns Kayıt sonucu
 */
export async function kaydetHesap(
  kayitAdi: string,
  hesapTuru: HesapTuru,
  veri: any,
  mevcutId?: string | number | null
): Promise<KayitSonucu> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");

    // Yeni backend formatı: { name, type, data }
    // Eğer veri.data varsa (yeni format), direkt kullan
    // Yoksa eski formatı yeni formata çevir
    let dataPayload = {};
    
    if (veri.data) {
      // Yeni format: veri.data zaten doğru formatta
      // Ama üst seviyedeki net_total, brut_total gibi alanları da ekle
      dataPayload = {
        ...veri.data,
        // Üst seviyedeki alanları da ekle (geriye dönük uyumluluk için)
        // Öncelik: veri.data.form > veri.data > veri (üst seviye)
        net_total: veri.net_total || veri.data.results?.net || veri.data.net_total,
        brut_total: veri.brut_total || veri.data.results?.brut || veri.data.brut_total,
        ise_giris: veri.data.form?.iseGiris || veri.data.form?.startDate || veri.ise_giris || veri.data.ise_giris || veri.start_date || veri.data.start_date,
        isten_cikis: veri.data.form?.istenCikis || veri.data.form?.endDate || veri.data.form?.exitDate || veri.isten_cikis || veri.data.isten_cikis || veri.end_date || veri.data.end_date,
        start_date: veri.data.form?.iseGiris || veri.data.form?.startDate || veri.start_date || veri.data.start_date,
        end_date: veri.data.form?.istenCikis || veri.data.form?.endDate || veri.data.form?.exitDate || veri.end_date || veri.data.end_date,
        total: veri.total || veri.data.total || veri.data.results?.brut || veri.data.results?.totals?.toplam,
      };
    } else {
      // Eski format: yeni formata çevir
      const iseGiris = veri.ise_giris || veri.start_date || veri.startDate || veri.formValues?.startDate || veri.formValues?.iseGiris || null;
      const istenCikis = veri.isten_cikis || veri.end_date || veri.endDate || veri.exitDate || veri.formValues?.endDate || veri.formValues?.exitDate || veri.formValues?.istenCikis || null;
      const brutTotal = veri.brut_total || veri.brutTazminat || veri.totalBrut || veri.brut || 0;
      const netTotal = veri.net_total || veri.netTazminat || veri.totalNet || veri.net || 0;
      
      // Eski formatı yeni formata çevir
      dataPayload = {
        form: veri.formValues || veri.form || {},
        results: {
          totals: veri.totals || {},
          brut: brutTotal,
          net: netTotal
        },
        // Geriye dönük uyumluluk için eski alanlar
        appliedEklenti: veri.appliedEklenti,
        ise_giris: iseGiris,
        isten_cikis: istenCikis,
        brut_total: brutTotal,
        net_total: netTotal,
      };
    }
    
    // Backend'in beklediği format: { name, type, data }
    const payload = {
      name: kayitAdi || "", // Modal'dan gelen kayıt adı
      type: hesapTuru, // Hesaplama türü
      data: dataPayload,
    };
    
    // Debug: Basın İş için payload'ı kontrol et
    if (hesapTuru === 'kidem_basin') {
      console.log('[kaydetServisi] Basın İş payload:', JSON.stringify(payload, null, 2));
      console.log('[kaydetServisi] dataPayload.net_total:', dataPayload.net_total);
      console.log('[kaydetServisi] dataPayload.results?.net:', dataPayload.results?.net);
    }

    // ID varsa PUT, yoksa POST
    // mevcutId'nin geçerli bir sayı olduğundan emin ol
    const validId = mevcutId && mevcutId !== "" && mevcutId !== "undefined" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
    const endpoint = validId ? `/api/saved-cases/${validId}` : "/api/saved-cases";
    const method = validId ? "PUT" : "POST";

    console.log("[kaydetHesap] Sending request to:", endpoint);
    console.log("[kaydetHesap] Method:", method);
    console.log("[kaydetHesap] mevcutId:", mevcutId, "validId:", validId);
    console.log("[kaydetHesap] Payload:", { name: payload.name, type: payload.type, data: payload.data ? "present" : "missing" });
    console.log("[kaydetHesap] Full payload.data:", JSON.stringify(payload.data, null, 2));

    const response = await apiClient(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    console.log("[kaydetHesap] Response status:", response.status);

    // Response'un JSON olup olmadığını kontrol et
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `Backend'den beklenmeyen yanıt alındı (Status: ${response.status}). ` +
        `Lütfen backend'in çalıştığından ve endpoint'in doğru olduğundan emin olun.`
      );
    }

    const result = await response.json();
    console.log("[kaydetHesap] Response body:", result);
    console.log("[kaydetHesap] Result.id:", result.id);

    if (!response.ok) {
      const errorMessage = result.message || result.error || `Kayıt işlemi başarısız oldu (${response.status})`;
      console.error("[kaydetHesap] Backend error:", {
        status: response.status,
        error: result.error,
        message: result.message,
        endpoint,
        method,
        mevcutId
      });
      throw new Error(errorMessage);
    }

    // Backend'den dönen response: { id, name, type, data, createdAt }
    const savedId = result.id;
    const savedName = result.name || kayitAdi; // Backend'den dönen veya girilen isim

    return {
      id: savedId || Number(mevcutId) || 0,
      success: true,
      message: mevcutId ? "Kayıt başarıyla güncellendi" : "Kayıt başarıyla kaydedildi",
      name: savedName, // Kayıt adını da döndür
    };
  } catch (error: any) {
    console.error("Kayıt hatası:", error);
    throw new Error(error.message || "Kayıt sırasında bir hata oluştu");
  }
}

/**
 * Kayıtlı hesabı yükle
 * @param kayitId - Kayıt ID'si
 * @param beklenenTur - Beklenen hesap türü (doğrulama için)
 * @returns Yükleme sonucu
 */
export async function yukleHesap(
  kayitId: string | number,
  beklenenTur?: string
): Promise<{
  success: boolean;
  data?: any;
  name?: string;
  error?: string;
}> {
  try {
    const response = await apiClient(`/api/saved-cases/${kayitId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Hesap türü kontrolü
    if (beklenenTur && result.type !== beklenenTur) {
      console.warn(`[yukleHesap] Tür uyuşmazlığı: Beklenen=${beklenenTur}, Gelen=${result.type}`);
      return {
        success: false,
        error: `Bu kayıt farklı bir hesap türüne ait (${result.type})`,
      };
    }    return {
      success: true,
      data: result.data || result,
      name: result.name,
    };
  } catch (error: any) {
    console.error("[yukleHesap] Yükleme hatası:", error);
    return {
      success: false,
      error: error.message || "Kayıt yüklenirken bir hata oluştu",
    };
  }
}