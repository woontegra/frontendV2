import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/apiClient";
import { AlertCircle, AlertTriangle, Info, RefreshCw, Trash2, Eye, Filter, Download } from "lucide-react";
import {
  pageTitleCls,
  pageSubtitleCls,
  statValueCls,
  statLabelCls,
  selectCls,
  inputCls,
  tableHeadCompactCls,
  badgeCls,
  cardContentTightCls,
} from "./adminStyles";

interface Log {
  id: number;
  tenantId: number;
  userId: number | null;
  userEmail: string | null;
  level: string;
  type: string;
  action: string;
  message: string | null;
  details: unknown;
  stack: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface LogStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  last24hLogs: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    loadStats();
    loadLogs();
  }, [pagination.page, levelFilter, typeFilter, tenantFilter, searchQuery]);

  const loadStats = async () => {
    try {
      const res = await apiClient("/api/logs/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (levelFilter) params.append("level", levelFilter);
      if (typeFilter) params.append("type", typeFilter);
      if (tenantFilter) params.append("tenantFilter", tenantFilter);
      if (searchQuery) params.append("search", searchQuery);

      const res = await apiClient(`/api/logs/all?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const clearOldLogs = async () => {
    if (!confirm("90 günden eski logları silmek istediğinize emin misiniz?")) return;
    try {
      const res = await apiClient(`/api/logs/clear-old`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 90 }),
      });
      if (res.ok) {
        alert("Eski loglar başarıyla silindi");
        loadStats();
        loadLogs();
      }
    } catch {
      alert("Log silme işlemi başarısız oldu");
    }
  };

  const exportLogs = () => {
    const csv = [
      ["Tarih", "Seviye", "Tip", "Aksiyon", "Mesaj", "Tenant ID", "Email"].join(","),
      ...logs.map((log) =>
        [
          new Date(log.createdAt).toLocaleString("tr-TR"),
          log.level,
          log.type,
          log.action,
          `"${log.message || ""}"`,
          log.tenantId,
          log.userEmail || "",
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const getLevelIcon = (level: string) => {
    if (!level) return <Info className="w-4 h-4 text-gray-500" />;
    switch (level.toLowerCase()) {
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info": return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    if (!level) return <Badge variant="secondary" className={badgeCls}>UNKNOWN</Badge>;
    const levelLower = level.toLowerCase();
    const cls =
      levelLower === "error"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200"
        : levelLower === "warning"
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200";
    return (
      <Badge variant="outline" className={`${badgeCls} ${cls}`}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className={pageTitleCls}>Sistem Logları</h1>
          <p className={pageSubtitleCls}>Tüm tenant'ların sistem loglarını görüntüleyin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadLogs} variant="outline" size="sm" className="h-8 text-xs px-3">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Yenile
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm" className="h-8 text-xs px-3">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            CSV İndir
          </Button>
          <Button onClick={clearOldLogs} variant="destructive" size="sm" className="h-8 text-xs px-3">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Eski Logları Sil
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Card className="p-4 border-gray-200/80 dark:border-gray-700/80 shadow-sm">
            <div className={statLabelCls}>Toplam Log</div>
            <div className={`${statValueCls} mt-0.5`}>{stats.totalLogs}</div>
          </Card>
          <Card className="p-4 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
            <div className="text-xs text-red-600 dark:text-red-400">Hatalar</div>
            <div className={`${statValueCls} mt-0.5 text-red-700 dark:text-red-300`}>{stats.errorCount}</div>
          </Card>
          <Card className="p-4 border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30">
            <div className="text-xs text-yellow-600 dark:text-yellow-400">Uyarılar</div>
            <div className={`${statValueCls} mt-0.5 text-yellow-700 dark:text-yellow-300`}>{stats.warningCount}</div>
          </Card>
          <Card className="p-4 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
            <div className="text-xs text-blue-600 dark:text-blue-400">Bilgiler</div>
            <div className={`${statValueCls} mt-0.5 text-blue-700 dark:text-blue-300`}>{stats.infoCount}</div>
          </Card>
          <Card className="p-4 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30">
            <div className="text-xs text-green-600 dark:text-green-400">Son 24 Saat</div>
            <div className={`${statValueCls} mt-0.5 text-green-700 dark:text-green-300`}>{stats.last24hLogs}</div>
          </Card>
        </div>
      )}

      <Card className={cardContentTightCls + " border-gray-200/80 dark:border-gray-700/80 shadow-sm"}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Filtreler</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 block">Seviye</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className={selectCls + " w-full"}
            >
              <option value="">Tümü</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 block">Tip</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={selectCls + " w-full"}
            >
              <option value="">Tümü</option>
              <option value="api">API</option>
              <option value="auth">Auth</option>
              <option value="frontend">Frontend</option>
              <option value="calculation">Calculation</option>
              <option value="payment">Payment</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 block">Tenant</label>
            <input placeholder="Tenant ID" value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 block">Ara</label>
            <input placeholder="Mesaj, email, aksiyon..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={inputCls} />
          </div>
        </div>
      </Card>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b">
              <tr>
                <th className={`text-left ${tableHeadCompactCls}`}>Tarih</th>
                <th className={`text-left ${tableHeadCompactCls}`}>Seviye</th>
                <th className={`text-left ${tableHeadCompactCls}`}>Tip</th>
                <th className={`text-left ${tableHeadCompactCls}`}>Aksiyon</th>
                <th className={`text-left ${tableHeadCompactCls}`}>Mesaj</th>
                <th className={`text-left ${tableHeadCompactCls}`}>Tenant</th>
                <th className={`text-left ${tableHeadCompactCls}`}>Email</th>
                <th className={`text-left ${tableHeadCompactCls}`}>İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3" colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : logs.length === 0
                  ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={8}>
                        Log bulunamadı
                      </td>
                    </tr>
                  )
                  : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-xs">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          {getLevelIcon(log.level)}
                          {getLevelBadge(log.level)}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <Badge variant="outline" className={badgeCls}>{log.type}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono">{log.action}</td>
                      <td className="py-2 px-3 text-xs max-w-xs truncate">{log.message}</td>
                      <td className="py-2 px-3 text-xs">
                        <Badge variant="secondary" className={badgeCls}>T{log.tenantId}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">{log.userEmail || "-"}</td>
                      <td className="py-2 px-3">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedLog(log)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Toplam {pagination.total} kayıt (Sayfa {pagination.page} / {pagination.totalPages})
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <Card className="max-w-3xl w-full max-h-[80vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold">Log Detayı</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>✕</Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tarih:</span>
                  <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString("tr-TR")}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Seviye:</span>
                  <p className="font-medium mt-1">{getLevelBadge(selectedLog.level)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tip:</span>
                  <p className="font-medium">{selectedLog.type}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tenant ID:</span>
                  <p className="font-medium">{selectedLog.tenantId}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">User ID:</span>
                  <p className="font-medium">{selectedLog.userId || "-"}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Email:</span>
                  <p className="font-medium">{selectedLog.userEmail || "-"}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Aksiyon:</span>
                <p className="font-mono text-sm mt-1">{selectedLog.action}</p>
              </div>
              {selectedLog.message && (
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Mesaj:</span>
                  <p className="mt-1">{selectedLog.message}</p>
                </div>
              )}
              {selectedLog.details && (
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Detaylar:</span>
                  <pre className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.stack && (
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Stack Trace:</span>
                  <pre className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                    {selectedLog.stack}
                  </pre>
                </div>
              )}
              {selectedLog.ipAddress && (
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">IP Adresi:</span>
                  <p className="font-mono text-sm mt-1">{selectedLog.ipAddress}</p>
                </div>
              )}
              {selectedLog.userAgent && (
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">User Agent:</span>
                  <p className="text-sm mt-1 break-all">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
