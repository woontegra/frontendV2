import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FaBriefcase,
  FaBullhorn,
  FaClock,
  FaCalendarAlt,
  FaUmbrellaBeach,
  FaWallet,
  FaAward,
  FaRegCalendarCheck,
  FaBalanceScale,
  FaGavel,
  FaExclamationTriangle,
  FaUserCheck,
  FaHourglassHalf,
} from "react-icons/fa";

export type PageKey =
  | "kidem-tazminati"
  | "ihbar-tazminati"
  | "fazla-mesai"
  | "ubgt"
  | "hafta-tatili"
  | "yillik-izin"
  | "bakiye-ucret"
  | "prim"
  | "kotu-niyet"
  | "ayrimcilik"
  | "haksiz-fesih"
  | "bosta-gecen-sure"
  | "ise-almama"
  | "ucret"
  | "ise-iade";

export interface PageStyle {
  color: string;
  icon: IconType;
  pageKey: PageKey;
}

const PAGE_STYLES: Record<PageKey, PageStyle> = {
  "kidem-tazminati": {
    color: "#1E88E5",
    icon: FaBriefcase,
    pageKey: "kidem-tazminati",
  },
  "ihbar-tazminati": {
    color: "#FB8C00",
    icon: FaBullhorn,
    pageKey: "ihbar-tazminati",
  },
  "fazla-mesai": {
    color: "#8E24AA",
    icon: FaClock,
    pageKey: "fazla-mesai",
  },
  ubgt: {
    color: "#43A047",
    icon: FaCalendarAlt,
    pageKey: "ubgt",
  },
  "hafta-tatili": {
    color: "#8D6E63",
    icon: FaUmbrellaBeach,
    pageKey: "hafta-tatili",
  },
  "yillik-izin": {
    color: "#5E35B1",
    icon: FaRegCalendarCheck,
    pageKey: "yillik-izin",
  },
  "bakiye-ucret": {
    color: "#E53935",
    icon: FaWallet,
    pageKey: "bakiye-ucret",
  },
  prim: {
    color: "#00897B",
    icon: FaAward,
    pageKey: "prim",
  },
  "kotu-niyet": {
    color: "#6D4C41",
    icon: FaExclamationTriangle,
    pageKey: "kotu-niyet",
  },
  "ayrimcilik": {
    color: "#6A1B9A",
    icon: FaBalanceScale,
    pageKey: "ayrimcilik" as PageKey,
  },
  "haksiz-fesih": {
    color: "#3949AB",
    icon: FaGavel,
    pageKey: "haksiz-fesih",
  },
  "bosta-gecen-sure": {
    color: "#004D40",
    icon: FaHourglassHalf,
    pageKey: "bosta-gecen-sure",
  },
  "ise-almama": {
    color: "#C62828",
    icon: FaUserCheck,
    pageKey: "ise-almama",
  },
  "ise-iade": {
    color: "#C62828",
    icon: FaUserCheck,
    pageKey: "ise-iade",
  },
  ucret: {
    color: "#1E88E5",
    icon: FaWallet,
    pageKey: "ucret",
  },
};

/**
 * Sayfa yoluna göre renk ve ikon bilgisini döndürür
 */
export function usePageStyle(pageKey?: PageKey): PageStyle {
  const location = useLocation();

  return useMemo(() => {
    // Eğer pageKey verilmişse direkt kullan
    if (pageKey && PAGE_STYLES[pageKey]) {
      return PAGE_STYLES[pageKey];
    }

    // Path'e göre otomatik tespit
    const path = location.pathname.toLowerCase();

    if (path.includes("/kidem-tazminati") || path.includes("/kidem")) {
      return PAGE_STYLES["kidem-tazminati"];
    }
    if (path.includes("/ihbar-tazminati") || path.includes("/ihbar")) {
      return PAGE_STYLES["ihbar-tazminati"];
    }
    if (path.includes("/fazla-mesai") || path.includes("/fazla-mesai")) {
      return PAGE_STYLES["fazla-mesai"];
    }
    if (path.includes("/ubgt-alacagi") || path.includes("/ubgt")) {
      return PAGE_STYLES["ubgt"];
    }
    if (path.includes("/hafta-tatili") || path.includes("/hafta-tatili-alacagi")) {
      return PAGE_STYLES["hafta-tatili"];
    }
    if (path.includes("/yillik-izin") || path.includes("/yillik-ucretli-izin")) {
      return PAGE_STYLES["yillik-izin"];
    }
    if (path.includes("/bakiye-ucret") || path.includes("/bakiye-ucret-alacagi")) {
      return PAGE_STYLES["bakiye-ucret"];
    }
    if (path.includes("/prim-alacagi") || path.includes("/prim")) {
      return PAGE_STYLES["prim"];
    }
    if (path.includes("/kotu-niyet") || path.includes("/kotuniyet")) {
      return PAGE_STYLES["kotu-niyet"];
    }
    if (path.includes("/ayrimcilik-tazminati") || path.includes("/ayrimcilik")) {
      return PAGE_STYLES["ayrimcilik"];
    }
    if (path.includes("/haksiz-fesih")) {
      return PAGE_STYLES["haksiz-fesih"];
    }
    if (path.includes("/bosta-gecen-sure")) {
      return PAGE_STYLES["bosta-gecen-sure"];
    }
    if (path.includes("/ise-almama")) {
      return PAGE_STYLES["ise-almama"];
    }
    if (path.includes("/ucret-alacagi") || path.includes("/ucret")) {
      return PAGE_STYLES["ucret"];
    }

    // Varsayılan
    return PAGE_STYLES["fazla-mesai"];
  }, [location.pathname, pageKey]);
}

/**
 * Renk kodunu rgba formatına çevirir
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

