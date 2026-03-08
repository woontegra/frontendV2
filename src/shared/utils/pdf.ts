/**
 * PDF Report Utility
 * Backend'e PDF üretim isteği gönderir ve indirir
 */

import { API_BASE_URL, apiClient } from "@/utils/apiClient";

interface GenerateReportParams {
  type: string;
  form: Record<string, any>;
  results?: Record<string, any> | number | null;
  userId?: number;
}

/**
 * PDF rapor üret ve indir
 */
export async function generateReport({
  type,
  form,
  results = null,
  userId,
}: GenerateReportParams): Promise<void> {
  try {
    const tenantId = Number(localStorage.getItem("tenant_id") || "1");
    const token = localStorage.getItem("access_token");
    
    // userId yoksa localStorage'dan al veya varsayılan olarak 1 kullan
    let currentUserId = userId;
    
    if (!currentUserId) {
      try {
        const currentUserStr = localStorage.getItem("current_user");
        if (currentUserStr) {
          const currentUser = JSON.parse(currentUserStr);
          currentUserId = currentUser?.id ? Number(currentUser.id) : 1;
        } else {
          currentUserId = 1; // Varsayılan kullanıcı ID
        }
      } catch {
        currentUserId = 1; // Parse hatası durumunda varsayılan
      }
    }
    
    // Eğer hala geçersizse 1 yap
    if (!currentUserId || isNaN(currentUserId) || currentUserId < 1) {
      currentUserId = 1;
    }

    // Backend'e istek gönder
    const payload = {
      type,
      userId: currentUserId,
      form,
      results,
    };
    const response = await apiClient(`/api/reports/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
      throw new Error(errorData.error || `PDF oluşturulamadı: ${response.status}`);
    }

    // PDF blob'unu al
    const blob = await response.blob();
    
    // Dosya adı oluştur
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `aktüerya-raporu-${type}-${timestamp}.pdf`;

    // Blob URL oluştur ve indir
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // URL'i temizle
    window.URL.revokeObjectURL(url);
    
  } catch (error: any) {
    console.error("PDF generation error:", error);
    throw error;
  }
}

/**
 * Hesaplama tipi label'ını al
 */
export function getCalculationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    "kidem": "Kıdem Tazminatı",
    "ihbar": "İhbar Tazminatı",
    "ubgt": "UBGT Alacağı",
    "hafta-tatili": "Hafta Tatili Alacağı",
    "ucret-alacagi": "Ücret Alacağı",
    "bakiye-ucret-alacagi": "Bakiye Ücret Alacağı",
    "prim-alacagi": "Prim Alacağı",
    "kotu-niyet-tazminati": "Kötü Niyet Tazminatı",
    "bosta-gecen-sure-ucreti": "Boşta Geçen Süre Ücreti",
    "ise-almama-tazminati": "İşe Başlatmama Tazminatı",
    "ayrimcilik-tazminati": "Ayrımcılık Tazminatı",
    "haksiz-fesih-tazminati": "Haksız Fesih Tazminatı",
    "fazla-mesai": "Fazla Mesai Alacağı",
    "yillik-izin": "Yıllık İzin Alacağı",
  };
  
  return labels[type] || type;
}

