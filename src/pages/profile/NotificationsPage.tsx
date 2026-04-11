import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

interface Notif {
  id: number;
  title: string;
  message?: string;
  created_at?: string;
  createdAt?: string;
  read?: boolean;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = useMemo(() => Number(localStorage.getItem("user_id") || "0"), []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient("/api/notifications", {
          headers: { "x-user-id": String(userId) },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (_e) {
        // sessiz
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const fmtDate = (s?: string) => {
    if (!s) return "";
    try { return new Date(s).toLocaleString("tr-TR"); }
    catch (_e) { return ""; }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="w-5 h-5" /> Bildirimler
          </h1>
          <Link to="/profile" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
            ← Profile Dön
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">Yükleniyor...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Henüz bildiriminiz yok</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map(n => (
                <li key={n.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!n.read ? "bg-blue-50/40 dark:bg-blue-900/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm ${!n.read ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}>
                        {n.title}
                      </p>
                      {n.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {fmtDate(n.createdAt || n.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
