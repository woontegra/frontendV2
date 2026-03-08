import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, ChevronRight, ChevronDown } from "lucide-react";

const MENU_ITEMS = [
  { id: "davaci-ucreti", label: "Davacı Ücreti", to: "/davaci-ucreti" },
  {
    id: "kidem-tazminati",
    label: "Kıdem Tazminatı",
    to: "#",
    children: [
      { id: "kidem-30isci", label: "İş Kanununa Göre", to: "/kidem-tazminati/30isci" },
      { id: "kidem-borclar", label: "Borçlar Kanunu", to: "/kidem-tazminati/borclar" },
      { id: "kidem-gemi", label: "Gemi Adamları", to: "/kidem-tazminati/gemi" },
    ],
  },
  {
    id: "ihbar-tazminati",
    label: "İhbar Tazminatı",
    to: "#",
    children: [
      { id: "ihbar-30isci", label: "İş Kanununa Göre", to: "/ihbar-tazminati/30isci" },
    ],
  },
  {
    id: "fazla-mesai",
    label: "Fazla Mesai Alacağı",
    to: "#",
    children: [
      { id: "fm-standart", label: "Standart Fazla Mesai", to: "/fazla-mesai/standart" },
      { id: "fm-tanikli", label: "Tanıklı Standart", to: "/fazla-mesai/tanikli-standart" },
    ],
  },
  { id: "ucret", label: "Ücret Alacağı", to: "/ucret-alacagi" },
  { id: "prim", label: "Prim Alacağı", to: "/prim-alacagi" },
  { id: "ubgt", label: "UBGT Alacağı", to: "/ubgt-alacagi" },
  { id: "hafta-tatili", label: "Hafta Tatili Alacağı", to: "/hafta-tatili-alacagi/standard" },
];

type Props = {
  collapsed: boolean;
  onClose?: () => void;
};

export default function Sidebar({ collapsed, onClose }: Props) {
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const sidebarContent = (
    <div className="flex flex-col h-full pt-14 lg:pt-3 px-2.5 pb-20 lg:pb-6 overflow-y-auto">
      <NavLink to="/dashboard" className={linkClass} onClick={handleNavClick}>
        <Menu className="w-4 h-4 flex-shrink-0" />
        <span>Yönetim Paneli</span>
      </NavLink>

      <div className="mt-3 space-y-1">
        <p className="px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
          Hesaplamalar
        </p>
        {MENU_ITEMS.map((item) =>
          item.children ? (
            <div key={item.id}>
              <button
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
          ) : (
            <NavLink
              key={item.id}
              to={item.to}
              className={linkClass}
              onClick={handleNavClick}
            >
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
