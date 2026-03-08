import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Menu, FolderOpen, User } from "lucide-react";

const ITEMS = [
  { to: "/dashboard", label: "Ana Sayfa", icon: LayoutDashboard },
  { to: "#menu", label: "Menü", icon: Menu },
  { to: "/profile/saved-calculations", label: "Kayıtlılar", icon: FolderOpen },
  { to: "/profile", label: "Profil", icon: User },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 lg:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)] pt-2"
      role="navigation"
      aria-label="Alt menü"
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {ITEMS.map(({ to, label, icon: Icon }) =>
          to === "#menu" ? (
            <button
              key={to}
              type="button"
              onClick={() => {
                try {
                  window.dispatchEvent(new Event("mobile-sidebar:toggle"));
                } catch {}
              }}
              className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 gap-0.5 text-gray-500 dark:text-gray-400 active:opacity-70"
              aria-label="Hesaplama menüsünü aç"
            >
              <Icon className="w-6 h-6" strokeWidth={1.75} />
              <span className="text-[10px] sm:text-xs font-medium">{label}</span>
            </button>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 min-w-0 py-1 gap-0.5 transition-colors ${
                  isActive || location.pathname.startsWith(to + "/")
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-gray-400 active:opacity-70"
                }`
              }
              aria-label={label}
            >
              <Icon className="w-6 h-6" strokeWidth={1.75} />
              <span className="text-[10px] sm:text-xs font-medium truncate max-w-full px-0.5">
                {label}
              </span>
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
