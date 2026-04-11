import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { apiClient } from "@/utils/apiClient";
import { getStatusLabel, getSubscriptionTypeLabel } from "@/utils/labelMappings";
import {
  pageTitleCls,
  pageSubtitleCls,
  cardTitleCls,
  cardDescriptionCls,
  statValueCls,
  statLabelCls,
  inputCls,
  selectCls,
  tableHeadCls,
  tableCellCls,
  tableCellMutedCls,
  badgeCls,
  cardContentTightCls,
} from "./adminStyles";

interface User {
  id: number;
  tenantId?: number;
  name: string;
  email: string;
  subscriptionType: string | null;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  status: string;
  licenseKey?: string | null;
  licenseExpiresAt?: string | null;
}

interface ExpiringLicense {
  id: string;
  licenseKey: string;
  userId: number | null;
  expiresAt: string;
  user: { id: number; name: string; email: string } | null;
}

const PAGE_SIZE = 20;

export default function AdminSubscriptionsPage() {
  const { error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [expiringLicenses, setExpiringLicenses] = useState<ExpiringLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const errorRef = useRef(error);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", String(PAGE_SIZE));
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter !== "all") params.append("status", statusFilter);

      let url = `/api/admin/subscriptions?${params.toString()}`;
      let res = await apiClient(url, { headers: { "x-user-role": "admin" } });

      if (res.status === 404) {
        const fallbackParams = new URLSearchParams();
        if (statusFilter !== "all") fallbackParams.append("status", statusFilter);
        if (search.trim()) fallbackParams.append("search", search.trim());
        url = `/api/admin/users${fallbackParams.toString() ? `?${fallbackParams}` : ""}`;
        res = await apiClient(url, { headers: { "x-user-role": "admin" } });
      }

      if (!res.ok) {
        throw new Error(`Abonelikler yüklenemedi: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const list = Array.isArray(json) ? json : (json?.data ?? []);
      const parsed = Array.isArray(list) ? list : [];
      setUsers(parsed);
      setTotal(typeof json?.total === "number" ? json.total : parsed.length);
      setTotalPages(typeof json?.totalPages === "number" ? json.totalPages : 1);
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
      errorRef.current("Abonelikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const loadExpiringLicenses = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/licenses/expiring?days=7`, {
        headers: { "x-user-role": "admin" },
      });
      if (res.ok) {
        const data = await res.json();
        setExpiringLicenses(data?.licenses ?? []);
      } else {
        setExpiringLicenses([]);
      }
    } catch {
      setExpiringLicenses([]);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadExpiringLicenses();
  }, [loadSubscriptions, loadExpiringLicenses]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  useEffect(() => {
    let isMounted = true;
    let lastLoadTime = 0;
    const MIN_LOAD_INTERVAL = 2000;

    const handleFocus = () => {
      const now = Date.now();
      if (isMounted && now - lastLoadTime > MIN_LOAD_INTERVAL) {
        lastLoadTime = now;
        loadSubscriptions();
        loadExpiringLicenses();
      }
    };
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (!document.hidden && isMounted && now - lastLoadTime > MIN_LOAD_INTERVAL) {
        lastLoadTime = now;
        loadSubscriptions();
        loadExpiringLicenses();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadSubscriptions, loadExpiringLicenses]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const expiry = new Date(dateStr);
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string }> = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      suspended: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
      deleted: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
      expired: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    };
    const variant = variants[status?.toLowerCase()] ?? variants.active;
    return <Badge className={`${variant.color} ${badgeCls}`}>{getStatusLabel(status)}</Badge>;
  };

  const getSubscriptionTypeBadge = (type: string | null) => {
    const variants: Record<string, { color: string }> = {
      annual: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      yearly: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      monthly: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      standard: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      user: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      pro: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
      enterprise: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
      trial: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      demo: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      "1_day_demo": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      "3_day_demo": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      "7_day_demo": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    };
    const lower = (type || "").toLowerCase();
    const variant = variants[lower] ?? { color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" };
    return <Badge className={`${variant.color} ${badgeCls}`}>{getSubscriptionTypeLabel(type)}</Badge>;
  };

  const expired = users.filter((user) => {
    if (!user.subscriptionEndsAt || user.status !== "active") return false;
    const days = getDaysUntilExpiry(user.subscriptionEndsAt);
    return days !== null && days < 0;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className={pageTitleCls}>Abonelik Yönetimi</h1>
        <p className={pageSubtitleCls}>Tüm abonelikleri görüntüleyin ve yönetin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={statLabelCls}>Toplam Abonelik</p>
                <p className={`${statValueCls} mt-0.5`}>
                  {users.filter((u) => u.status === "active").length}
                </p>
              </div>
              <Calendar className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={statLabelCls}>Yakında Bitecek</p>
                <p className={`${statValueCls} mt-0.5 text-orange-600 dark:text-orange-400`}>
                  {expiringLicenses.length}
                </p>
              </div>
              <Clock className="h-5 w-5 text-orange-500 dark:text-orange-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={statLabelCls}>Süresi Dolmuş</p>
                <p className={`${statValueCls} mt-0.5 text-red-600 dark:text-red-400`}>{expired.length}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {expiringLicenses.length > 0 && (
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className={`${cardTitleCls} flex items-center gap-1.5`}>
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Yakında Bitecekler (7 gün içinde)
            </CardTitle>
            <CardDescription className={cardDescriptionCls}>Bu lisanslar yakında sona erecek</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {expiringLicenses.map((lic) => {
                const days = getDaysUntilExpiry(lic.expiresAt);
                return (
                  <div
                    key={lic.id}
                    className="flex items-center justify-between py-2.5 px-3 border border-orange-200 dark:border-orange-900/50 rounded-md bg-orange-50/80 dark:bg-orange-900/10"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {lic.user?.name ?? "Atanmamış"}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                        {lic.user?.email ?? lic.licenseKey}
                      </p>
                    </div>
                    <div className="text-right mr-3 shrink-0">
                      <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                        {days === 0 ? "Bugün" : `${days} gün`}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDate(lic.expiresAt)}
                      </p>
                    </div>
                    {lic.userId ? (
                      <Link to={`/admin/users/${lic.userId}/edit`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs px-2.5">
                          Düzenle
                        </Button>
                      </Link>
                    ) : (
                      <Link to="/admin/licenses">
                        <Button variant="outline" size="sm" className="h-8 text-xs px-2.5">
                          Lisanslar
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardContent className={cardContentTightCls}>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Ara (ad, email, kullanıcı/tenant ID)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className={`${inputCls} flex-1 min-w-[180px] max-w-xs`}
            />
            <Button onClick={handleSearch} variant="outline" size="sm" className="h-8 text-xs px-3">
              Ara
            </Button>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={selectCls}
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="suspended">Askıya Alındı</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className={cardTitleCls}>Tüm Abonelikler</CardTitle>
          <CardDescription className={cardDescriptionCls}>Toplam {total} abonelik bulundu</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">Abonelik bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Kullanıcı
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Kullanıcı ID
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Tenant ID
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Lisans ID
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Abonelik Tipi
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Başlangıç
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Bitiş
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Deneme Bitiş
                    </th>
                    <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Durum
                    </th>
                    <th className="text-right py-2 px-3 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const days = getDaysUntilExpiry(user.subscriptionEndsAt);
                    const isExpiringSoon = days !== null && days >= 0 && days <= 7;
                    const isExpired = days !== null && days < 0;

                    return (
                      <tr
                        key={user.id}
                        className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          isExpired ? "bg-red-50 dark:bg-red-900/10" : ""
                        } ${isExpiringSoon ? "bg-orange-50 dark:bg-orange-900/10" : ""}`}
                      >
                        <td className="py-2 px-3">
                          <div className="text-xs font-normal text-gray-800 dark:text-gray-200">{user.name}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{user.email}</div>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">{user.id}</td>
                        <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                          {user.tenantId ?? "-"}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {user.licenseKey ?? "-"}
                        </td>
                        <td className="py-2 px-3">{getSubscriptionTypeBadge(user.subscriptionType)}</td>
                        <td className="py-2 px-3">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {formatDate(user.subscriptionStartsAt)}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {formatDate(user.subscriptionEndsAt)}
                          </div>
                          {days !== null && days >= 0 && days <= 7 && (
                            <div className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">
                              {days} gün kaldı
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Süresi doldu</div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                          {formatDate(user.trialEndsAt)}
                        </td>
                        <td className="py-2 px-3">{getStatusBadge(user.status)}</td>
                        <td className="py-2 px-3">
                          <div className="flex justify-end">
                            <Link to={`/admin/users/${user.id}/edit`}>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-gray-600 dark:text-gray-400">
                                Düzenle
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Sayfa {page} / {totalPages} ({total} kayıt)
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
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
