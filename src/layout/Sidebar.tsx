import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, ChevronRight, ChevronDown, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/** Sıra: v1 Sidebar employmentItems ile uyumlu (v2’de olan sayfalar) */
const MENU_ITEMS = [
  { id: "davaci-ucreti", label: "Davacı Ücreti", to: "/davaci-ucreti" },
  /** v1 ile aynı: alt menü yok; tıklanınca kart sayfasına gider, sağda ok (alt sayfa olduğunu gösterir) */
  { id: "kidem-tazminati", label: "Kıdem Tazminatı", to: "/kidem-tazminati", hasSubPages: true },
  /** Kıdem ile aynı: tıklanınca kart seçim sayfası (/ihbar-tazminati) */
  { id: "ihbar-tazminati", label: "İhbar Tazminatı", to: "/ihbar-tazminati", hasSubPages: true },
  /** Kıdem / İhbar ile aynı: tıklanınca kart seçim sayfası (/fazla-mesai) */
  { id: "fazla-mesai", label: "Fazla Mesai Alacağı", to: "/fazla-mesai", hasSubPages: true },
  { id: "yillik-izin", label: "Yıllık Ücretli İzin Alacağı", to: "/yillik-izin", hasSubPages: true },
  { id: "ucret", label: "Ücret Alacağı", to: "/ucret-alacagi" },
  { id: "is-arama-izni", label: "İş Arama İzni Ücreti", to: "/is-arama-izni-ucreti" },
  { id: "bakiye-ucret", label: "Bakiye Ücret Alacağı", to: "/bakiye-ucret-alacagi" },
  { id: "prim", label: "Prim Alacağı", to: "/prim-alacagi" },
  { id: "kotu-niyet", label: "Kötü Niyet Tazminatı", to: "/kotu-niyet-tazminati" },
  { id: "bosta-gecen-sure", label: "Boşta Geçen Süre Ücreti", to: "/bosta-gecen-sure-ucreti" },
  { id: "ubgt", label: "UBGT Alacağı", to: "/ubgt" },
  { id: "hafta-tatili", label: "Hafta Tatili Alacağı", to: "/hafta-tatili", hasSubPages: true },
  { id: "ise-almama", label: "İşe Başlatmama Tazminatı", to: "/ise-almama-tazminati" },
  { id: "ayrimcilik", label: "Ayrımcılık Tazminatı", to: "/ayrimcilik-tazminati" },
  { id: "haksiz-fesih", label: "Haksız Fesih Tazminatı", to: "/haksiz-fesih-tazminati" },
];

type Props = {
  collapsed: boolean;
  onClose?: () => void;
};

export default function Sidebar({ collapsed, onClose }: Props) {
  const location = useLocation();
  const { user } = useAuth();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const isAdmin = user?.role === "admin" || tenantId === 1 || (user as { tenantId?: number })?.tenantId === 1;

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const onToggle = () => setMobileOpen((s) => !s);
    const onCloseEvt = () => setMobileOpen(false);
    window.addEventListener("mobile-sidebar:toggle", onToggle);
    window.addEventListener("mobile-sidebar:close", onCloseEvt);
    return () => {
      window.removeEventListener("mobile-sidebar:toggle", onToggle);
      window.removeEventListener("mobile-sidebar:close", onCloseEvt);
    };
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleNavClick = () => {
    onClose?.();
    if (window.innerWidth < 1024) setMobileOpen(false);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 text-white"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 py-2 px-2 rounded text-[12px] ${isActive ? "text-indigo-600 dark:text-indigo-400 font-medium" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`;

  const sidebarContent = (
    <div className="flex flex-col h-full pt-14 lg:pt-3 px-2.5 pb-20 lg:pb-6 overflow-y-auto">
      <NavLink to="/dashboard" className={linkClass} onClick={handleNavClick}>
        <Menu className="w-4 h-4 flex-shrink-0" />
        <span>Yönetim Paneli</span>
      </NavLink>

      {isAdmin && (
        <div className="mt-3 space-y-1">
          <p className="px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
            Admin Paneli
          </p>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`
            }
            onClick={handleNavClick}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>Admin Paneli</span>
          </NavLink>
        </div>
      )}

      <div className="mt-3 space-y-1">
        <p className="px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
          Hesaplamalar
        </p>
        {MENU_ITEMS.map((item) =>
          item.to === "#" && item.children?.length ? (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => toggleMenu(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  openMenus[item.id]
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span className="text-left">{item.label}</span>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${
                    openMenus[item.id] ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openMenus[item.id] && (
                <ul className="mt-1 ml-2 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-2">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 py-2 px-2 rounded text-[12px] ${
                            isActive
                              ? "text-indigo-600 dark:text-indigo-400 font-medium"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                          }`
                        }
                        onClick={handleNavClick}
                      >
                        <ChevronRight className="w-3 h-3" />
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : "hasSubPages" in item && item.hasSubPages ? (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`
              }
              onClick={handleNavClick}
            >
              {({ isActive }) => (
                <div className="flex items-center min-w-0 w-full justify-between">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Menu className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                      isActive
                        ? "text-white/90"
                        : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-400"
                    }`}
                  />
                </div>
              )}
            </NavLink>
          ) : (
            <NavLink key={item.id} to={item.to} className={linkClass} onClick={handleNavClick}>
              <Menu className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed top-0 left-0 z-30 h-screen transition-transform duration-300 ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 w-72 max-w-[85vw] h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
