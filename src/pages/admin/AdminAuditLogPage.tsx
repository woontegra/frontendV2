import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/apiClient";
import { History, Filter, ChevronLeft } from "lucide-react";
import { pageTitleCls, pageSubtitleCls, cardTitleCls, cardDescriptionCls, selectCls, inputCls, tableHeadCompactCls, cardContentTightCls } from "./adminStyles";

interface AuditLogItem {
  id: number;
  adminId: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  admin: { name: string; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  user_create: "Kullanıcı oluşturma",
  license_extend: "Lisans uzatma",
  subscription_change: "Abonelik değişikliği",
  manual_intervention: "Manuel müdahale",
  tenant_create: "Şirket oluşturma",
};

export default function AdminAuditLogPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadLogs = async (offsetOverride?: number) => {
    setLoading(true);
    const o = offsetOverride !== undefined ? offsetOverride : offset;
    try {
      const params = new URLSearchParams();
      if (action) params.append("action", action);
      if (targetType) params.append("targetType", targetType);
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      params.append("limit", String(limit));
      params.append("offset", String(o));
      const res = await apiClient(`/api/admin/audit-logs?${params}`, {
        headers: { "x-user-role": "admin" },
      });
      if (!res.ok) throw new Error("Denetim kayıtları yüklenemedi");
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [offset]);

  const handleFilter = () => {
    setOffset(0);
    loadLogs(0);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className={`${pageTitleCls} flex items-center gap-2`}>
            <History className="h-5 w-5" />
            Admin Denetim Kayıtları
          </h1>
          <p className={pageSubtitleCls}>
            Kullanıcı oluşturma, lisans uzatma, abonelik değişikliği ve manuel müdahaleler
          </p>
        </div>
      </div>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className={cardTitleCls}>Filtreler</CardTitle>
          <CardDescription className={cardDescriptionCls}>İşlem türü ve tarih aralığı ile filtreleyin</CardDescription>
        </CardHeader>
        <CardContent className={cardContentTightCls + " flex flex-wrap gap-2"}>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
            <option value="">Tüm işlemler</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={selectCls}>
            <option value="">Tüm hedefler</option>
            <option value="user">Kullanıcı</option>
            <option value="tenant">Şirket</option>
            <option value="license">Lisans</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + " w-36"} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + " w-36"} />
          <Button onClick={handleFilter} size="sm" className="h-8 text-xs px-3">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Uygula
          </Button>
        </CardContent>
      </Card>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
              Kayıt bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className={`text-left ${tableHeadCompactCls}`}>Tarih</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>İşlem</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Hedef</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Admin</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Detay</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                      <td className="py-2 px-3 font-normal text-gray-900 dark:text-gray-100">{ACTION_LABELS[log.action] || log.action}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{log.targetType && log.targetId ? `${log.targetType}#${log.targetId}` : "-"}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{log.admin ? `${log.admin.name} (${log.admin.email})` : `ID: ${log.adminId}`}</td>
                      <td className="py-2 px-3 max-w-xs truncate text-gray-600 dark:text-gray-400">{log.details ? JSON.stringify(log.details) : "-"}</td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{log.ipAddress || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > limit && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Toplam {total} kayıt</span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
                  Önceki
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" disabled={offset + limit >= total} onClick={() => setOffset((o) => o + limit)}>
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
