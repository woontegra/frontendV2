import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Breadcrumb from "./Breadcrumb";

type Props = {
  showLayout?: boolean;
};

export default function AppShell({ showLayout = true }: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true"
  );
  const location = useLocation();

  const isStandalone =
    location.pathname === "/login" ||
    location.pathname.startsWith("/forgot-password") ||
    location.pathname.startsWith("/reset-password");

  if (!showLayout || isStandalone) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarCollapsed(false)}
      />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed((s) => {
          const next = !s;
          localStorage.setItem("sidebarCollapsed", String(next));
          return next;
        })}
      />

      <main
        className={`pt-14 pb-20 lg:pb-6 min-h-screen transition-[margin] duration-300 bg-white dark:bg-gray-900 ${
          sidebarCollapsed ? "lg:ml-0" : "lg:ml-56"
        }`}
        style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumb />
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
