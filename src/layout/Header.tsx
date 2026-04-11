import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Sun, Moon, Ticket, Video, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import UserMenu from "@/components/UserMenu";
import { apiClient } from "@/utils/apiClient";

// ─── Sayfa başlıkları ────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Yönetim Paneli",
  "/davaci-ucreti": "Davacı Ücreti Hesaplama",
  "/ucret-alacagi": "Ücret Alacağı Hesaplama",
  "/is-arama-izni-ucreti": "İş Arama İzni Ücreti Hesaplama",
  "/prim-alacagi": "Prim Alacağı Hesaplama",
  "/bakiye-ucret-alacagi": "Bakiye Ücret Alacağı Hesaplama",
  "/ubgt-alacagi": "UBGT Alacağı Hesaplama",
  "/ubgt-bilirkisi": "Bilirkişi UBGT Alacağı Hesaplama",
  "/kotu-niyet-tazminati": "Kötü Niyet Tazminatı Hesaplama",
  "/bosta-gecen-sure-ucreti": "Boşta Geçen Süre Ücreti Hesaplama",
  "/ise-almama-tazminati": "İşe Başlatmama Tazminatı Hesaplama",
  "/ayrimcilik-tazminati": "Ayrımcılık Tazminatı Hesaplama",
  "/haksiz-fesih-tazminati": "Haksız Fesih Tazminatı Hesaplama",
  "/profile": "Profil",
  "/profile/saved-calculations": "Kayıtlı Hesaplamalar",
  "/profile/notifications": "Bildirimler",
  "/admin": "Admin Paneli",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const prefixMap: [string, string][] = [
    ["/davaci-ucreti/", "Davacı Ücreti Hesaplama"],
    ["/prim-alacagi/", "Prim Alacağı Hesaplama"],
    ["/is-arama-izni-ucreti/", "İş Arama İzni Ücreti Hesaplama"],
    ["/bakiye-ucret-alacagi/", "Bakiye Ücret Alacağı Hesaplama"],
    ["/ucret-alacagi/", "Ücret Alacağı Hesaplama"],
    ["/kotu-niyet-tazminati/", "Kötü Niyet Tazminatı Hesaplama"],
    ["/bosta-gecen-sure-ucreti/", "Boşta Geçen Süre Ücreti Hesaplama"],
    ["/ise-almama-tazminati/", "İşe Başlatmama Tazminatı Hesaplama"],
    ["/ayrimcilik-tazminati/", "Ayrımcılık Tazminatı Hesaplama"],
    ["/haksiz-fesih-tazminati/", "Haksız Fesih Tazminatı Hesaplama"],
    ["/ubgt-alacagi", "UBGT Alacağı Hesaplama"],
    ["/ubgt-bilirkisi", "Bilirkişi UBGT Alacağı Hesaplama"],
  ];
  for (const [prefix, title] of prefixMap) {
    if (pathname.startsWith(prefix)) return title;
  }

  const subMap: [string, Record<string, string>, string][] = [
    ["/kidem-tazminati", {
      "gemi": "Gemi Adamları Kıdem Tazminatı",
      "basin": "Basın İş Kıdem Tazminatı",
      "mevsimlik": "Mevsimlik İşçi Kıdem Tazminatı",
      "borclar": "Borçlar Kanunu Kıdem Tazminatı",
      "kismi-sureli": "Kısmi Süreli Kıdem Tazminatı",
      "belirli-sureli": "Belirli Süreli Kıdem Tazminatı",
      "30isci": "İş Kanununa Göre Kıdem Tazminatı",
    }, "Kıdem Tazminatı"],
    ["/ihbar-tazminati", {
      "belirli": "Belirli Süreli İhbar Tazminatı",
      "kismi": "Kısmi Süreli İhbar Tazminatı",
      "basin": "Basın İşçileri İhbar Tazminatı",
      "mevsim": "Mevsimlik İşçi İhbar Tazminatı",
      "gemi": "Gemi Adamları İhbar Tazminatı",
      "borclar": "Borçlar Kanunu İhbar Tazminatı",
      "30isci": "İş Kanununa Göre İhbar Tazminatı",
    }, "İhbar Tazminatı"],
    ["/yillik-izin", {
      "standart": "İş Kanununa Göre Yıllık İzin",
      "borclar": "Borçlar Kanunu Yıllık İzin",
      "gemi": "Gemi Adamları Yıllık İzin",
      "mevsim": "Mevsimlik İşçi Yıllık İzin",
      "basin": "Basın İşçileri Yıllık İzin",
      "kismi": "Kısmi Süreli Yıllık İzin",
      "belirli": "Belirli Süreli Yıllık İzin",
    }, "Yıllık İzin Alacağı"],
    ["/hafta-tatili", {
      "standard": "Standart Hafta Tatili Alacağı",
      "basin-is": "Basın İş Hafta Tatili Alacağı",
      "gemi-adami": "Gemi Adamları Hafta Tatili Alacağı",
    }, "Hafta Tatili Alacağı"],
    ["/fazla-mesai", {
      "standart": "Standart Fazla Mesai",
      "tanikli-standart": "Tanıklı Standart Fazla Mesai",
      "haftalik-karma": "Haftalık Karma Fazla Mesai",
      "donemsel-haftalik": "Dönemsel Haftalık Fazla Mesai",
      "donemsel": "Dönemsel Fazla Mesai",
      "yeralti-isci": "Yeraltı İşçileri Fazla Mesai",
      "vardiya-24-48": "24/48 Saat Vardiya Fazla Mesai",
      "gemi-adami": "Gemi Adamı Fazla Mesai",
      "ev": "Ev İşçileri Fazla Mesai",
    }, "Fazla Mesai Alacağı"],
  ];

  for (const [base, map, fallback] of subMap) {
    if (pathname.startsWith(base)) {
      const parts = pathname.split("/");
      let sub = parts[parts.length - 1];
      if (!isNaN(Number(sub)) && parts.length > 2) sub = parts[parts.length - 2];
      return map[sub] || fallback;
    }
  }

  if (pathname.startsWith("/profile")) return "Profil";
  if (pathname.startsWith("/admin")) return "Admin Paneli";
  return "";
}

// ─── Bildirim tipi ───────────────────────────────────────────────────────────

interface Notif {
  id: number;
  title: string;
  created_at?: string;
  createdAt?: string;
  read?: boolean;
}

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
};

export default function Header({ sidebarCollapsed, onSidebarToggle }: Props) {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Dark mode
  const [isDark, setIsDark] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("theme") === "dark"
  );
  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("theme-changed"));
  };

  // Bildirimler
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unread = notifs.filter(n => !n.read).length;

  const loadNotifs = useCallback(async () => {
    const userId = user?.id || Number(localStorage.getItem("user_id") || "0");
    if (!userId) return;
    try {
      setNotifLoading(true);
      const res = await apiClient("/api/notifications", {
        headers: { "x-user-id": String(userId) },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: Notif[] = Array.isArray(data) ? data.slice(0, 8) : [];
      setNotifs(list);
    } catch (_e) { /* sessiz */ }
    finally { setNotifLoading(false); }
  }, [user]);

  // 30 saniyede bir otomatik yenile
  useEffect(() => {
    if (!user) return;
    loadNotifs();
    const timer = setInterval(loadNotifs, 30_000);
    return () => clearInterval(timer);
  }, [user, loadNotifs]);

  const handleNotifOpen = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      await loadNotifs();
      try {
        await apiClient("/api/notifications/mark-read", { method: "POST" });
        setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      } catch (_e) { /* sessiz */ }
    }
  };

  const pageTitle = getPageTitle(location.pathname);

  // Sayfa title güncelle
  useEffect(() => {
    const t = getPageTitle(location.pathname);
    document.title = t ? `Bilirkişi Hesaplama | ${t}` : "Bilirkişi Hesaplama | Mercan Danışmanlık";
  }, [location.pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm flex items-center">
      {/* ── Sol: Hamburger / Sidebar toggle + Logo alanı ─────────────────── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 lg:w-56 flex-shrink-0">
        {/* Desktop sidebar daralt/genişlet */}
        <button
          onClick={() => {
            if (window.innerWidth < 1024) {
              try { window.dispatchEvent(new Event("mobile-sidebar:toggle")); } catch (_e) { /* sessiz */ }
            } else {
              onSidebarToggle();
            }
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={sidebarCollapsed ? "Kenar çubuğunu aç" : "Kenar çubuğunu kapat"}
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <Link to="/dashboard" className="hidden sm:block flex-shrink-0 ml-1" aria-label="Ana sayfa">
          <span className="font-semibold text-gray-800 dark:text-white whitespace-nowrap text-sm">
            Bilirkişi Hesaplama
          </span>
        </Link>
      </div>

      {/* ── Eğitim Videoları (orta-sol, md ve üstü) ───────────────────────── */}
      <a
        href="https://www.youtube.com/@bilirkisihesap"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg ml-6 border border-red-300 dark:border-red-700/50 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex-shrink-0"
        title="Eğitim Videoları"
      >
        <Video className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs font-medium">Eğitim Videoları</span>
      </a>

      {/* ── Ortada sayfa başlığı ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-2 min-w-0 pointer-events-none">
        {pageTitle && (
          <h1 className="truncate text-sm font-medium text-gray-800 dark:text-white max-w-full">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* ── Sağ: Aksiyonlar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 flex-shrink-0">

        {/* Destek / Ticket */}
        <Link
          to="/profile?tab=tickets"
          className="relative flex items-center gap-1.5 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors group"
          aria-label="Destek Al" title="Destek Talebi Aç"
        >
          <span className="hidden md:inline text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Ticket Aç
          </span>
          <Ticket className="w-4 h-4 text-blue-500 group-hover:text-blue-600 transition-colors" strokeWidth={1.75} />
        </Link>

        {/* Dark mode */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isDark ? "Açık moda geç" : "Koyu moda geç"}
        >
          {isDark
            ? <Sun className="w-4 h-4 text-amber-500" />
            : <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
        </button>

        {/* ── Bildirimler ─────────────────────────────────────────────────── */}
        <div
          className="relative"
          onMouseEnter={() => { if (notifCloseTimer.current) { clearTimeout(notifCloseTimer.current); notifCloseTimer.current = null; } }}
          onMouseLeave={() => { if (notifOpen) { notifCloseTimer.current = setTimeout(() => setNotifOpen(false), 1000); } }}
        >
          <button
            onClick={handleNotifOpen}
            className="relative p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors group"
            aria-label="Bildirimler"
          >
            <Bell className="w-4 h-4 text-amber-500 group-hover:text-amber-600 transition-colors" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none shadow border border-white dark:border-gray-900">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Bildirim dropdown */}
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bildirimler</p>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {notifLoading ? (
                  <div className="p-4 text-xs text-gray-500 text-center">Yükleniyor...</div>
                ) : notifs.length === 0 ? (
                  <div className="p-6 text-xs text-gray-400 text-center">Henüz bildiriminiz yok</div>
                ) : (
                  notifs.map(n => {
                    const d = n.createdAt || n.created_at;
                    return (
                      <div key={n.id}
                        className={`px-4 py-2.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!n.read ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                        <p className={`text-gray-900 dark:text-gray-100 ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
                        {d && <p className="text-gray-400 mt-0.5">{new Date(d).toLocaleString("tr-TR")}</p>}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <Link
                  to="/profile/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Tümünü Gör →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Kullanıcı menüsü */}
        {user ? (
          <UserMenu user={user} logout={logout} />
        ) : (
          <Link to="/login" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Giriş
          </Link>
        )}
      </div>
    </header>
  );
}
