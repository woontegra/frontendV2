// Kayıtlı hesaplamanın type'ına göre frontendV2 route'u döner
export function getRouteForCalculationType(type: string, data?: Record<string, unknown>): string {
  const t = (type || "").toLowerCase().replace(/[\s-]/g, "_");

  // Bağımsız sayfalar
  if (t.includes("davaci")) return "/davaci-ucreti";
  if (t.includes("ucret_alacagi") || t === "ucret") return "/ucret-alacagi";
  if (t.includes("bakiye")) return "/bakiye-ucret-alacagi";
  if (t.includes("prim")) return "/prim-alacagi";
  if (t.includes("is_arama") || t.includes("iş_arama")) return "/is-arama-izni-ucreti";
  if (t.includes("kotu_niyet") || t.includes("kötü_niyet")) return "/kotu-niyet-tazminati";
  if (t.includes("bosta_gecen") || t.includes("boşta")) return "/bosta-gecen-sure-ucreti";
  if (t.includes("ise_almama") || t.includes("işe_almama")) return "/ise-almama-tazminati";
  if (t.includes("ayrimcilik") || t.includes("ayrımcılık")) return "/ayrimcilik-tazminati";
  if (t.includes("haksiz_fesih") || t.includes("haksız_fesih")) return "/haksiz-fesih-tazminati";

  // Hafta tatili
  if (t.includes("hafta_tatili")) {
    if (t.includes("gemi")) return "/hafta-tatili/gemi-adami";
    if (t.includes("basin") || t.includes("basın")) return "/hafta-tatili/basin-is";
    return "/hafta-tatili/standard";
  }

  // UBGT
  if (t.includes("ubgt") && t.includes("bilirkisi")) return "/ubgt-bilirkisi";
  if (t.includes("ubgt")) return "/ubgt-alacagi";

  // Kıdem
  if (t.includes("kidem") || t.includes("kıdem")) {
    if (t.includes("borclar") || t.includes("borçlar")) return "/kidem-tazminati/borclar";
    if (t.includes("gemi")) return "/kidem-tazminati/gemi";
    if (t.includes("mevsimlik")) return "/kidem-tazminati/mevsimlik";
    if (t.includes("basin") || t.includes("basın")) return "/kidem-tazminati/basin";
    if (t.includes("kismi") || t.includes("kısmi") || t.includes("part")) return "/kidem-tazminati/kismi-sureli";
    if (t.includes("belirli")) return "/kidem-tazminati/belirli-sureli";
    return "/kidem-tazminati/30isci";
  }

  // İhbar
  if (t.includes("ihbar")) {
    if (t.includes("borclar") || t.includes("borçlar")) return "/ihbar-tazminati/borclar";
    if (t.includes("gemi")) return "/ihbar-tazminati/gemi";
    if (t.includes("mevsim")) return "/ihbar-tazminati/mevsim";
    if (t.includes("basin") || t.includes("basın")) return "/ihbar-tazminati/basin";
    if (t.includes("kismi") || t.includes("kısmi")) return "/ihbar-tazminati/kismi";
    if (t.includes("belirli")) return "/ihbar-tazminati/belirli";
    return "/ihbar-tazminati/30isci";
  }

  // Yıllık izin
  if (t.includes("yillik") || t.includes("yıllık")) {
    if (t.includes("borclar") || t.includes("borçlar")) return "/yillik-izin/borclar";
    if (t.includes("gemi")) return "/yillik-izin/gemi";
    if (t.includes("mevsim")) return "/yillik-izin/mevsim";
    if (t.includes("basin") || t.includes("basın")) {
      const pageType = String((data as Record<string, unknown> | undefined)?.pageType || "").toLowerCase();
      if (pageType.includes("gunluk_olmayan") || pageType.includes("günlük_olmayan")) return "/yillik-izin/basin/gunluk-olmayan";
      return "/yillik-izin/basin";
    }
    if (t.includes("kismi") || t.includes("kısmi")) return "/yillik-izin/kismi";
    if (t.includes("belirli")) return "/yillik-izin/belirli";
    return "/yillik-izin/standart";
  }

  // Fazla mesai
  if (t.includes("fazla_mesai")) {
    const pageType = String((data as Record<string, unknown> | undefined)?.pageType || (data as Record<string, unknown> | undefined)?.route || "").toLowerCase();
    if (t.includes("donemsel_haftalik") || pageType.includes("donemsel-haftalik")) return "/fazla-mesai/donemsel-haftalik";
    if (t.includes("donemsel") || pageType.includes("donemsel")) return "/fazla-mesai/donemsel";
    if (t.includes("haftalik_karma") || pageType.includes("haftalik-karma")) return "/fazla-mesai/haftalik-karma";
    if (t.includes("tanikli") || pageType.includes("tanikli")) return "/fazla-mesai/tanikli-standart";
    if (t.includes("yeralti") || t.includes("yeraltı")) return "/fazla-mesai/yeralti-isci";
    if (t.includes("vardiya")) {
      if (t.includes("48") || t.includes("24")) return "/fazla-mesai/vardiya-24-48";
      if (t.includes("12")) return "/fazla-mesai/vardiya12";
      return "/fazla-mesai/vardiya-24-48";
    }
    if (t.includes("gemi")) return "/fazla-mesai/gemi-adami";
    if (t.includes("ev")) return "/fazla-mesai/ev";
    if (t.includes("basin") || t.includes("basın")) return "/fazla-mesai/basin-is-fazla-mesai";
    if (t.includes("fazla_sure") || t.includes("fazla_süre")) return "/fazla-mesai/fazla-surelerle-calisma";
    return "/fazla-mesai/standart";
  }

  return "/dashboard";
}
