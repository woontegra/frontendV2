/**
 * v1 breadcrumbUtils ile uyumlu — Ana Sayfa v2’de /dashboard.
 */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Yönetim Paneli",
  profile: "Profil",
  admin: "Yönetim Paneli",

  "kidem-tazminati": "Kıdem Tazminatı",
  "ihbar-tazminati": "İhbar Tazminatı",
  "fazla-mesai": "Fazla Mesai Alacağı",
  "yillik-izin": "Yıllık Ücretli İzin Alacağı",
  "hafta-tatili": "Hafta Tatili Alacağı",
  ubgt: "UBGT Alacağı",
  "ubgt-alacagi": "Standart UBGT",
  "ubgt-bilirkisi": "Bilirkişi UBGT",
  "hafta-tatili-alacagi": "Hafta Tatili Alacağı",
  "ucret-alacagi": "Ücret Alacağı",
  "davaci-ucreti": "Davacı Ücreti",
  "bakiye-ucret-alacagi": "Bakiye Ücret Alacağı",
  "is-arama-izni-ucreti": "İş Arama İzni Ücreti",
  "prim-alacagi": "Prim Alacağı",
  "kotu-niyet-tazminati": "Kötü Niyet Tazminatı",
  "bosta-gecen-sure-ucreti": "Boşta Geçen Süre Ücreti",
  "ise-almama-tazminati": "İşe Başlatmama Tazminatı",
  "ayrimcilik-tazminati": "Ayrımcılık Tazminatı",
  "haksiz-fesih-tazminati": "Haksız Fesih Tazminatı",

  "30isci": "İş Kanununa Göre",
  borclar: "Borçlar Kanunu",
  gemi: "Gemi Adamları",
  mevsimlik: "Mevsimlik İşçi",
  basin: "Basın İş",
  "kismi-sureli": "Kısmi Süreli",
  "belirli-sureli": "Belirli Süreli",
  standart: "Standart",
  standard: "Standart",
  "tanikli-standart": "Tanıklı Standart",
  "haftalik-karma": "Haftalık Karma",
  donemsel: "Dönemsel",
  "donemsel-haftalik": "Dönemsel Haftalık",
  "yeralti-isci": "Yeraltı İşçileri",
  "vardiya-24-48": "24 / 48 Saat Vardiya",
  "gemi-adami": "Gemi Adamı",
  ev: "Ev İşçileri",
  "gunluk-olmayan": "Günlük Olmayan Gazete",
  "saved-calculations": "Kayıtlı Hesaplamalarım",
  settings: "Ayarlar",
  tickets: "Destek Talepleri",
  subscription: "Abonelik",
};

export interface BreadcrumbItem {
  label: string;
  to?: string;
  isCurrent?: boolean;
}

function getSegmentLabel(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

const HIDE_BREADCRUMB_PATHS = ["/login"];

export function shouldShowBreadcrumb(pathname: string): boolean {
  return !HIDE_BREADCRUMB_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  const normalized = pathname.replace(/^\//, "").replace(/\/$/, "");
  if (!normalized) {
    return [{ label: "Yönetim Paneli", to: "/dashboard", isCurrent: true }];
  }

  const segments = normalized.split("/").filter(Boolean);

  if (pathname === "/dashboard") {
    return [{ label: "Yönetim Paneli", isCurrent: true }];
  }

  const isAppRoute =
    pathname.startsWith("/kidem-tazminati") ||
    pathname.startsWith("/ihbar-tazminati") ||
    pathname.startsWith("/fazla-mesai") ||
    pathname.startsWith("/yillik-izin") ||
    pathname.startsWith("/ucret-") ||
    pathname.startsWith("/davaci-") ||
    pathname.startsWith("/bakiye-") ||
    pathname.startsWith("/is-arama-") ||
    pathname.startsWith("/prim-") ||
    pathname.startsWith("/kotu-") ||
    pathname.startsWith("/bosta-") ||
    pathname.startsWith("/ise-almama") ||
    pathname.startsWith("/ayrimcilik") ||
    pathname.startsWith("/haksiz-fesih") ||
    pathname.startsWith("/ubgt") ||
    pathname.startsWith("/hafta-tatili") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  if (isAppRoute && pathname !== "/dashboard") {
    items.push({ label: "Ana Sayfa", to: "/dashboard" });
  }

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const isNumericId = /^\d+$/.test(seg);

    if (isNumericId && i > 0) {
      items.push({
        label: `Hesaplama #${seg}`,
        to: currentPath ? `${currentPath}/${seg}` : `/${seg}`,
        isCurrent: true,
      });
      break;
    }

    currentPath = currentPath ? `${currentPath}/${seg}` : `/${seg}`;
    let label = getSegmentLabel(seg);
    if (seg === "standart" && segments[i - 1] === "yillik-izin") {
      label = "İş Kanununa Göre";
    }
    if (seg === "borclar" && segments[i - 1] === "yillik-izin") {
      label = "Borçlar Kanunu";
    }
    if (seg === "gemi" && segments[i - 1] === "yillik-izin") {
      label = "Gemi Adamları";
    }
    if (seg === "mevsim" && segments[i - 1] === "yillik-izin") {
      label = "Mevsimlik İşçi";
    }
    if (seg === "basin" && segments[i - 1] === "yillik-izin") {
      label = "Basın İşçileri";
    }
    if (seg === "kismi" && segments[i - 1] === "yillik-izin") {
      label = "Kısmi Süreli / Part Time";
    }
    if (seg === "belirli" && segments[i - 1] === "yillik-izin") {
      label = "Belirli Süreli Sözleşme";
    }
    if (seg === "standard" && segments[i - 1] === "hafta-tatili") {
      label = "Standart";
    }
    if (seg === "standart" && segments[i - 1] === "hafta-tatili") {
      label = "Standart";
    }
    if (seg === "basin-is" && segments[i - 1] === "hafta-tatili") {
      label = "Basın İşçileri";
    }
    if (seg === "basin" && segments[i - 1] === "hafta-tatili") {
      label = "Basın İşçileri";
    }
    if (seg === "gemi-adami" && segments[i - 1] === "hafta-tatili") {
      label = "Gemi Adamları";
    }
    if (seg === "gemi" && segments[i - 1] === "hafta-tatili") {
      label = "Gemi Adamları";
    }

    items.push({
      label,
      to: isLast ? undefined : currentPath,
      isCurrent: isLast,
    });
  }

  return items;
}
