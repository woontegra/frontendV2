/**
 * Teknik enum değerlerini kullanıcı dostu Türkçe etiketlere çevirir.
 * Backend değerleri değişmez, sadece UI mapping.
 */

/** Plan / abonelik tipi */
export const SUBSCRIPTION_TYPE_LABELS: Record<string, string> = {
  user: "Kullanıcı",
  annual: "Yıllık",
  yearly: "Yıllık",
  yillik: "Yıllık",
  "Yıllık Abonelik": "Yıllık",
  monthly: "Aylık",
  aylik: "Aylık",
  "Aylık Abonelik": "Aylık",
  standard: "Deneme",
  trial: "Deneme",
  demo: "Deneme",
  "1_day_demo": "1 Günlük Deneme",
  "3_day_demo": "3 Günlük Deneme",
  "7_day_demo": "7 Günlük Deneme",
  paid: "Ücretli",
  subscription: "Abonelik",
  pro: "Pro",
  enterprise: "Enterprise",
};

/** Kullanıcı / lisans durumu */
export const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Pasif",
  expired: "Süresi Dolmuş",
  suspended: "Askıya Alındı",
  deleted: "Silindi",
  open: "Açık",
  closed: "Kapatıldı",
  pending: "Beklemede",
};

/** Lisans tipi (demo / paid) */
export const LICENSE_TYPE_LABELS: Record<string, string> = {
  demo: "Deneme",
  paid: "Ücretli",
  professional: "Profesyonel",
};

/** Mesaj gönderen tipi (chat) */
export const SENDER_TYPE_LABELS: Record<string, string> = {
  user: "Kullanıcı",
  admin: "Destek",
};

/** Hesaplama modülü tipi (kıdem, ihbar, hafta tatili vb.) */
export const MODULE_TYPE_LABELS: Record<string, string> = {
  kidem: "Kıdem Tazminatı",
  kidem_standart: "Kıdem Tazminatı",
  kidem_30isci: "Kıdem Tazminatı (30+ İşçi)",
  kidem_gemi: "Gemi Adamı Kıdem Tazminatı",
  kidem_basin: "Basın İşçisi Kıdem Tazminatı",
  kidem_mevsim: "Mevsimlik İşçi Kıdem Tazminatı",
  kidem_kismi: "Kısmi Süreli Kıdem Tazminatı",
  kidem_belirli: "Belirli Süreli Kıdem Tazminatı",
  kidem_borclar: "Borçlar Kanunu Kıdem Tazminatı",
  ihbar: "İhbar Tazminatı",
  ihbar_standart: "İhbar Tazminatı",
  ihbar_30isci: "İhbar Tazminatı (30+ İşçi)",
  ihbar_gemi: "Gemi Adamı İhbar Tazminatı",
  ihbar_basin: "Basın İşçisi İhbar Tazminatı",
  ihbar_mevsim: "Mevsimlik İşçi İhbar Tazminatı",
  ihbar_kismi: "Kısmi Süreli İhbar Tazminatı",
  ihbar_belirli: "Belirli Süreli İhbar Tazminatı",
  ihbar_borclar: "Borçlar Kanunu İhbar Tazminatı",
  yillik_izin: "Yıllık İzin Ücreti",
  yillik_izin_standart: "Yıllık İzin Ücreti",
  yillik_izin_gemi: "Gemi Adamı Yıllık İzin",
  yillik_izin_basin: "Basın İşçisi Yıllık İzin",
  yillik_izin_mevsim: "Mevsimlik Yıllık İzin",
  yillik_izin_kismi: "Kısmi Süreli Yıllık İzin",
  yillik_izin_belirli: "Belirli Süreli Yıllık İzin",
  fazla_mesai: "Fazla Mesai Alacağı",
  fazla_mesai_standart: "Fazla Mesai Alacağı",
  fazla_mesai_bilirkisi_1: "Fazla Mesai (Bilirkişi-1)",
  fazla_mesai_bilirkisi_2: "Fazla Mesai (Bilirkişi-2)",
  fazla_mesai_gemi: "Gemi Adamı Fazla Mesai",
  fazla_mesai_gece: "Gece Fazla Mesai",
  fazla_mesai_vardiya: "Vardiya Fazla Mesai",
  ubgt: "UBGT Alacağı",
  ubgt_alacagi: "UBGT Alacağı",
  ubgt_bilirkisi: "Bilirkişi UBGT Alacağı",
  hafta_tatili: "Hafta Tatili Alacağı",
  hafta_tatili_standart: "Hafta Tatili Alacağı",
  hafta_tatili_alacagi_standart: "Hafta Tatili Alacağı",
  hafta_tatili_gemi: "Gemi Adamı Hafta Tatili",
  hafta_tatili_basin: "Basın İşçisi Hafta Tatili",
  ucret: "Ücret Alacağı",
  ucret_alacagi: "Ücret Alacağı",
  bakiye_ucret: "Bakiye Ücret Alacağı",
  prim: "Prim Alacağı",
  prim_alacagi: "Prim Alacağı",
  kidem_mevsimlik: "Mevsimlik İşçi Kıdem Tazminatı",
  haftalik_karma_fazla_mesai: "Haftalık Karma Fazla Mesai",
  donemsel_fazla_mesai: "Dönemsel Fazla Mesai",
  donemsel_haftalik_fazla_mesai: "Dönemsel Haftalık Fazla Mesai",
  tanikli_standart_fazla_mesai: "Tanıklı Standart Fazla Mesai",
  fazla_mesai_vardiya_24: "Vardiya 24 Fazla Mesai",
  fazla_mesai_gemi_gunluk: "Gemi Adamı Günlük Fazla Mesai",
  fazla_mesai_yeralti_isci: "Yeraltı İşçisi Fazla Mesai",
  "kismi-sureli": "Kısmi Süreli",
  temel_profil: "Temel Profil",
  davaci_ucreti: "Davacı Ücreti",
};

export function getSubscriptionTypeLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const v = value.trim();
  const lower = v.toLowerCase();
  return SUBSCRIPTION_TYPE_LABELS[lower] ?? SUBSCRIPTION_TYPE_LABELS[v] ?? v;
}

export function getStatusLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const lower = value.toLowerCase();
  return STATUS_LABELS[lower] ?? STATUS_LABELS[value] ?? value;
}

export function getLicenseTypeLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const lower = value.toLowerCase();
  return LICENSE_TYPE_LABELS[lower] ?? LICENSE_TYPE_LABELS[value] ?? value;
}

export function getSenderTypeLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const lower = value.toLowerCase();
  return SENDER_TYPE_LABELS[lower] ?? SENDER_TYPE_LABELS[value] ?? value;
}

export function getModuleTypeLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const lower = value.toLowerCase();
  return MODULE_TYPE_LABELS[lower] ?? MODULE_TYPE_LABELS[value] ?? value;
}
