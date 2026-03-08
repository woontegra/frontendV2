/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import { apiClient } from "@/utils/apiClient";

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
  tenant_id?: number;
  aciklama: string;
  calculation_type: string;
  brut_total: number;
  net_total: number;
  ise_giris?: string | null;
  isten_cikis?: string | null;
  detay: any;
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
  name?: string;
}

export async function kaydetHesap(
  kayitAdi: string,
  hesapTuru: HesapTuru,
  veri: any,
  mevcutId?: string | number | null
): Promise<KayitSonucu> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    let dataPayload = {};
    
    if (veri.data) {
      dataPayload = {
        ...veri.data,
        net_total: veri.net_total || veri.data.results?.net || veri.data.net_total,
        brut_total: veri.brut_total || veri.data.results?.brut || veri.data.brut_total,
        ise_giris: veri.data.form?.iseGiris || veri.data.form?.startDate || veri.ise_giris || veri.data.ise_giris || veri.start_date || veri.data.start_date,
        isten_cikis: veri.data.form?.istenCikis || veri.data.form?.endDate || veri.data.form?.exitDate || veri.isten_cikis || veri.data.isten_cikis || veri.end_date || veri.data.end_date,
        start_date: veri.data.form?.iseGiris || veri.data.form?.startDate || veri.start_date || veri.data.start_date,
        end_date: veri.data.form?.istenCikis || veri.data.form?.endDate || veri.data.form?.exitDate || veri.end_date || veri.data.end_date,
        total: veri.total || veri.data.total || veri.data.results?.brut || veri.data.results?.totals?.toplam,
      };
    } else {
      const iseGiris = veri.ise_giris || veri.start_date || veri.startDate || veri.formValues?.startDate || veri.formValues?.iseGiris || null;
      const istenCikis = veri.isten_cikis || veri.end_date || veri.endDate || veri.exitDate || veri.formValues?.endDate || veri.formValues?.exitDate || veri.formValues?.istenCikis || null;
      const brutTotal = veri.brut_total || veri.brutTazminat || veri.totalBrut || veri.brut || 0;
      const netTotal = veri.net_total || veri.netTazminat || veri.totalNet || veri.net || 0;
      
      dataPayload = {
        form: veri.formValues || veri.form || {},
        results: {
          totals: veri.totals || {},
          brut: brutTotal,
          net: netTotal
        },
        appliedEklenti: veri.appliedEklenti,
        ise_giris: iseGiris,
        isten_cikis: istenCikis,
        brut_total: brutTotal,
        net_total: netTotal,
      };
    }
    
    const payload = {
      name: kayitAdi || "",
      type: hesapTuru,
      data: dataPayload,
    };

    const validId = mevcutId && mevcutId !== "" && mevcutId !== "undefined" && !isNaN(Number(mevcutId)) && Number(mevcutId) > 0 ? Number(mevcutId) : null;
    const endpoint = validId ? `/api/saved-cases/${validId}` : "/api/saved-cases";
    const method = validId ? "PUT" : "POST";

    const response = await apiClient(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `Backend'den beklenmeyen yanıt alındı (Status: ${response.status}). ` +
        `Lütfen backend'in çalıştığından ve endpoint'in doğru olduğundan emin olun.`
      );
    }

    const result = await response.json();

    if (!response.ok) {
      const errorMessage = result.message || result.error || `Kayıt işlemi başarısız oldu (${response.status})`;
      throw new Error(errorMessage);
    }

    const savedId = result.id;
    const savedName = result.name || kayitAdi;

    return {
      id: savedId || Number(mevcutId) || 0,
      success: true,
      message: mevcutId ? "Güncellemeler kaydedildi" : "Kayıt başarıyla kaydedildi",
      name: savedName,
    };
  } catch (error: any) {
    console.error("Kayıt hatası:", error);
    throw new Error(error.message || "Kayıt sırasında bir hata oluştu");
  }
}

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
    
    if (beklenenTur && result.type !== beklenenTur) {
      console.warn(`[yukleHesap] Tür uyuşmazlığı: Beklenen=${beklenenTur}, Gelen=${result.type}`);
      return {
        success: false,
        error: `Bu kayıt farklı bir hesap türüne ait (${result.type})`,
      };
    }
    
    return {
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
