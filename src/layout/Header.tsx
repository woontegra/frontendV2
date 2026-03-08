import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Sun, Moon, Ticket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import UserMenu from "@/components/UserMenu";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Yönetim Paneli",
  "/davaci-ucreti": "Davacı Ücreti Hesaplama",
  "/ucret-alacagi": "Ücret Alacağı Hesaplama",
  "/prim-alacagi": "Prim Alacağı Hesaplama",
  "/ubgt-alacagi": "UBGT Alacağı Hesaplama",
  "/profile": "Profil",
  "/profile/saved-calculations": "Kayıtlı Hesaplamalar",
};

const KIDEM_PAGE_TITLES: Record<string, string> = {
  "/kidem-tazminati/30isci": "İş Kanununa Göre Kıdem Tazminatı",
};

const IHBAR_PAGE_TITLES: Record<string, string> = {
  "/ihbar-tazminati/30isci": "İş Kanununa Göre İhbar Tazminatı",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/davaci-ucreti/")) return "Davacı Ücreti Hesaplama";
  for (const [path, title] of Object.entries(KIDEM_PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + "/")) return title;
  }
  for (const [path, title] of Object.entries(IHBAR_PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + "/")) return title;
  }
  if (pathname.startsWith("/kidem-tazminati")) return "Kıdem Tazminatı";
  if (pathname.startsWith("/ihbar-tazminati")) return "İhbar Tazminatı";
  if (pathname === "/fazla-mesai/standart" || pathname.startsWith("/fazla-mesai/standart/")) return "Standart Fazla Mesai Hesaplama";
  if (pathname.startsWith("/fazla-mesai")) return "Fazla Mesai Hesaplama";
  return "";
}

type Props = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
};

export default function Header({ sidebarCollapsed, onSidebarToggle }: Props) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("theme") === "dark"
  );

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 relative">
      {/* Sol: Hamburger + Logo */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <button
          onClick={() => {
            if (window.innerWidth < 1024) {
              try {
                window.dispatchEvent(new Event("mobile-sidebar:toggle"));
              } catch {}
            } else {
              onSidebarToggle();
            }
          }}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Menü"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <Link
          to="/dashboard"
          className="hidden sm:block flex-shrink-0"
          aria-label="Ana sayfa"
        >
          <span className="font-semibold text-gray-800 dark:text-white whitespace-nowrap">
            Bilirkişi Hesaplama
          </span>
        </Link>
      </div>

      {/* Orta: Sayfa başlığı – mobilde ikonlara binmez */}
      <div className="absolute left-14 right-28 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto sm:max-w-[50%] flex items-center justify-center pointer-events-none px-1">
        {pageTitle && (
          <h1 className="truncate text-sm sm:text-base font-medium text-gray-800 dark:text-white max-w-full">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Sağ: Actions */}
      <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
        <Link
          to="/profile?tab=tickets"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Destek"
        >
          <Ticket className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </Link>
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={isDark ? "Açık mod" : "Koyu mod"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {user ? (
          <UserMenu user={user} logout={logout} />
        ) : (
          <Link
            to="/login"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Giriş
          </Link>
        )}
      </div>
    </header>
  );
}
