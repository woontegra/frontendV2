/**
 * Video Linkleri Yapılandırma Dosyası
 *
 * Sidebar'daki tüm hesaplama sayfaları burada listelenir.
 * Her sayfa için YouTube video linkini buraya ekleyin.
 * Link BOŞ bırakılırsa, o sayfada "Kullanım Videosu İzle" butonu GÖRÜNMEZ.
 *
 * Kullanım:
 * 1. YouTube'a videonuzu yükleyin
 * 2. Video linkini kopyalayın (örn: https://www.youtube.com/watch?v=abc123XYZ)
 * 3. İlgili sayfa için buraya yapıştırın
 * 4. Kaydedin - buton otomatik olarak aktif olacak!
 */

export const VIDEO_LINKS: Record<string, string> = {
  // ==========================================
  // DAVACI ÜCRETİ
  // ==========================================
  "davaci-ucreti": "", // Davacı Ücreti

  // ==========================================
  // KIDEM TAZMİNATI SAYFALARI
  // ==========================================
  "kidem-30isci": "", // İş Kanununa Göre
  "kidem-borclar": "", // Borçlar Kanunu İşçi Alacağı
  "kidem-gemi": "", // Gemi Adamları
  "kidem-mevsimlik": "", // Mevsimlik İşçi
  "kidem-basin": "", // Basın İş
  "kidem-kismi": "", // Kısmi Süreli / Part Time
  "kidem-belirli": "", // Belirli Süreli İş Sözleşmesi
  "kidem-part-time": "", // (alias) Part Time
  "kidem-kismi-sureli": "", // (alias) Kısmi Süreli
  "kidem-belirli-sureli": "", // (alias) Belirli Süreli
  "kidem-parca-basi": "", // Parça Başı
  "kidem-toplu-sozlesme": "", // Toplu Sözleşme

  // ==========================================
  // İHBAR TAZMİNATI SAYFALARI
  // ==========================================
  "ihbar-30isci": "", // İş Kanununa Göre
  "ihbar-borclar": "", // Borçlar Kanunu İşçi Alacağı
  "ihbar-gemi": "", // Gemi Adamları
  "ihbar-mevsim": "", // Mevsimlik İşçi
  "ihbar-basin": "", // Basın İşçileri
  "ihbar-kismi": "", // Kısmi Süreli / Part Time
  "ihbar-belirli": "", // Belirli Süreli İş Sözleşmesi
  "ihbar-parca": "",
  "ihbar-part": "",
  "ihbar-toplu": "",

  // ==========================================
  // FAZLA MESAİ SAYFALARI
  // ==========================================
  "fazla-standart": "", // Standart Fazla Mesai
  "fazla-tanikli-standart": "", // Tanıklı Standart
  "fazla-haftalik-karma": "", // Haftalık Karma
  "fazla-donemsel": "", // Dönemsel
  "fazla-donemsel-haftalik": "", // Dönemsel Haftalık
  "fazla-yeralti-isci": "", // Yeraltı İşçileri
  "fazla-vardiya12": "", // 12 Saat Usulü Vardiya
  "fazla-vardiya24": "", // 24 Saat Usulü Vardiya
  "fazla-vardiya48": "", // 48 Saat Usulü Vardiya
  "fazla-gemi": "", // Gemi Adamı (Günlük)
  "fazla-gemi-7-24": "", // Gemi Adamı (7/24)
  "fazla-ev": "", // Ev İşçileri
  "fazla-surelerle-calisma": "", // Fazla Sürelerle Çalışma
  "fazla-basin-is": "", // Basın İş
  "fazla-bilirkisi-1": "", // (alias) Bilirkişi 1
  "fazla-bilirkisi-2": "", // Bilirkişi 2

  // ==========================================
  // YILLIK ÜCRETLİ İZİN ALACAĞI SAYFALARI
  // ==========================================
  "yillik-standart": "", // İş Kanununa Göre
  "yillik-borclar": "", // Borçlar Kanunu İşçileri
  "yillik-gemi": "", // Gemi Adamları
  "yillik-mevsim": "", // Mevsimlik İşçiler (sidebar id)
  "yillik-mevsimlik": "", // Mevsimlik (sayfa bu key'i kullanıyor)
  "yillik-basin": "", // Basın İşçileri
  "yillik-kismi": "", // Kısmi Süreli / Part Time
  "yillik-belirli": "", // Belirli Süreli Sözleşme
  "yillik-basin-gunluk-olmayan": "",

  // ==========================================
  // UBGT ALACAĞI SAYFALARI
  // ==========================================
  "ubgt": "", // UBGT (Bilirkişi / Standart ortak key)
  "ubgt-standart": "", // Standart UBGT
  "ubgt-bilirkisi": "https://www.youtube.com/watch?v=fc1KZXWxMhk", // Bilirkişi UBGT

  // ==========================================
  // HAFTA TATİLİ ALACAĞI SAYFALARI
  // ==========================================
  "hafta-standard": "", // Standart (İngilizce key - sayfa kullanıyor)
  "hafta-standart": "", // Standart (Türkçe)
  "hafta-gemi": "", // Gemi Adamları
  "hafta-gemi-adami": "", // (alias - sayfa kullanıyor)
  "hafta-basin-is": "", // Basın İş
  "hafta-toplu-sozlesme": "", // Toplu Sözleşme

  // ==========================================
  // DİĞER HESAPLAMALAR (TEK SAYFA)
  // ==========================================
  "ucret-alacagi": "", // Ücret Alacağı
  "is-arama-izni": "", // İş Arama İzni Ücreti
  "bakiye-ucret": "", // Bakiye Ücret Alacağı
  "prim-alacagi": "", // Prim Alacağı
  "kotu-niyet": "", // Kötü Niyet Tazminatı
  "bosta-gecen-sure": "", // Boşta Geçen Süre Ücreti
  "ise-almama": "", // İşe Başlatmama Tazminatı
  "ayrimcilik": "", // Ayrımcılık Tazminatı
  "haksiz-fesih": "", // Haksız Fesih Tazminatı
};

/**
 * Helper function: Video linkini al
 * @param pageKey - Sayfa anahtarı (örn: "kidem-30isci")
 * @returns Video linki varsa string, yoksa undefined
 */
export function getVideoLink(pageKey: string): string | undefined {
  const link = VIDEO_LINKS[pageKey];
  return link && link.trim() !== "" ? link : undefined;
}
