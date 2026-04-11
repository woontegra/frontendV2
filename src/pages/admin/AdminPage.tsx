import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CreditCard,
  MessageSquare,
  MessageCircle,
  BarChart2,
  ArrowRight,
  FileText,
  History,
  Key,
  Mail,
  Smartphone,
  Star,
} from "lucide-react";

const ADMIN_CARDS = [
  { to: "/admin/control-center", label: "Kontrol Merkezi", icon: LayoutDashboard },
  { to: "/admin/users", label: "Kullanıcı Yönetimi", icon: Users },
  { to: "/admin/users/new", label: "Yeni Kullanıcı", icon: UserPlus },
  { to: "/admin/subscriptions", label: "Abonelik Yönetimi", icon: CreditCard },
  { to: "/admin/tickets", label: "Destek Talepleri", icon: MessageSquare },
  { to: "/admin/chat", label: "Canlı Sohbet", icon: MessageCircle },
  { to: "/admin/analytics", label: "Tenant İstatistikleri", icon: BarChart2 },
  { to: "/admin/demo-conversion", label: "Demo → Satış Dönüşüm", icon: ArrowRight },
  { to: "/admin/logs", label: "Sistem Logları", icon: FileText },
  { to: "/admin/audit-logs", label: "Admin Denetim Kayıtları", icon: History },
  { to: "/admin/licenses", label: "Lisans Yönetimi", icon: Key },
  { to: "/admin/device-management", label: "Cihaz Yönetimi", icon: Smartphone },
  { to: "/admin/email-notifications", label: "Email Bildirimleri", icon: Mail },
  { to: "/admin/feedback", label: "Kullanıcı Geri Bildirimleri", icon: Star },
];

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900/50 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Admin Paneli
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sistem yönetim araçları
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {ADMIN_CARDS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center flex-1">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition-colors mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  {label}
                </h2>
                <span className="mt-2 text-xs text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Yönetim sayfasına git
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
