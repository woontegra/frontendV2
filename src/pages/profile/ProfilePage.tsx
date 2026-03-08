import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileInfoPage from "./ProfileInfoPage";
import SavedCalculationsPage from "./SavedCalculationsPage";
import SubscriptionPage from "./SubscriptionPage";
import TicketsPage from "./TicketsPage";
import SubUsersPage from "./SubUsersPage";
import SettingsPage from "./SettingsPage";
import { User, Bookmark, CreditCard, MessageSquare, Users, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_MENU_ITEMS = [
  { key: "info", label: "Profilim", icon: User, tenantFilter: "all" as const },
  { key: "saved", label: "Kayıtlı Hesaplamalar", icon: Bookmark, tenantFilter: "all" as const },
  { key: "subscription", label: "Abonelik Bilgilerim", icon: CreditCard, tenantFilter: "all" as const },
  { key: "tickets", label: "Destek Talepleri", icon: MessageSquare, tenantFilter: "all" as const },
  { key: "subusers", label: "Alt Kullanıcılar", icon: Users, tenantFilter: 1 as const },
  { key: "settings", label: "Ayarlar", icon: SettingsIcon, tenantFilter: "all" as const },
];

export default function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  const MENU_ITEMS = useMemo(() => {
    return ALL_MENU_ITEMS.filter((item) => {
      if (item.tenantFilter === "all") return true;
      return tenantId === item.tenantFilter;
    });
  }, [tenantId]);

  const urlTab = params.get("tab");
  const isValidTab = (tab: string | null) =>
    tab && MENU_ITEMS.some((item) => item.key === tab);

  const [activeTab, setActiveTab] = useState<string>(() =>
    isValidTab(urlTab) ? urlTab! : "info"
  );

  useEffect(() => {
    if (location.pathname === "/profile/saved-calculations") {
      setActiveTab("saved");
      navigate("/profile?tab=saved", { replace: true });
      return;
    }
    const tab = params.get("tab");
    if (tab && !isValidTab(tab)) {
      navigate("/profile?tab=info", { replace: true });
      setActiveTab("info");
    } else if (tab) {
      setActiveTab(tab);
    }
  }, [location.pathname, location.search, navigate, tenantId]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/profile?tab=${tab}`, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "info":
        return <ProfileInfoPage />;
      case "saved":
        return <SavedCalculationsPage />;
      case "subscription":
        return <SubscriptionPage />;
      case "tickets":
        return <TicketsPage />;
      case "subusers":
        return <SubUsersPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <ProfileInfoPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-[99%] mx-auto px-2 sm:px-4 lg:px-6 py-4 lg:py-6">
        <ProfileHeader />
        <div className="mb-6 overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          <div className="flex gap-2 pb-2 flex-wrap">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleTabChange(item.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors border",
                    isActive
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="w-full min-w-0">{renderContent()}</div>
      </div>
    </div>
  );
}
