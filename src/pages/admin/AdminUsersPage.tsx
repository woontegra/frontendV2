import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { Plus, Search, Edit, Filter, BarChart2 } from "lucide-react";
import { apiClient } from "@/utils/apiClient";
import { getStatusLabel, getSubscriptionTypeLabel } from "@/utils/labelMappings";
import {
  pageTitleCls,
  pageSubtitleCls,
  cardTitleCls,
  cardDescriptionCls,
  inputCls,
  selectCls,
  tableHeadCompactCls,
  badgeCls,
  cardContentTightCls,
} from "./adminStyles";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  subscriptionType: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
  status: string;
  createdAt: string;
  licenseKey?: string | null;
  licenseExpiresAt?: string | null;
  licenseMaxDevices?: number;
  licenseDeviceCount?: number;
}

export default function AdminUsersPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (search) {
        params.append("search", search);
      }

      const url = `/api/admin/users${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiClient(url, {
        headers: { "x-user-role": "admin" },
      });

      if (!res.ok) {
        if (res.status === 403) {
          error("Admin erişimi gerekli");
          navigate("/admin-access-denied");
          return;
        }
        throw new Error(`Failed to load users: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load users:", err);
      error("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadUsers();
  };

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

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      admin: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", label: "Admin" },
      user: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Kullanıcı" },
    };
    const variant = variants[role] || variants.user;
    return <Badge className={`${variant.color} ${badgeCls}`}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={pageTitleCls}>Kullanıcı Yönetimi</h1>
          <p className={pageSubtitleCls}>Tüm kullanıcıları görüntüleyin ve yönetin</p>
        </div>
        <Link to="/admin/users/new">
          <Button size="sm" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Yeni Üyelik Aç
          </Button>
        </Link>
      </div>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardContent className={cardContentTightCls}>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                placeholder="İsim veya email ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className={`${inputCls} pl-8`}
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">Tüm Durumlar</option>
                <option value="active">Aktif</option>
                <option value="suspended">Askıya Alındı</option>
                <option value="trial">Deneme Süresi</option>
              </select>
              <Button onClick={handleSearch} variant="outline" size="sm" className="h-8 text-xs px-3">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filtrele
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className={cardTitleCls}>Kullanıcı Listesi</CardTitle>
          <CardDescription className={cardDescriptionCls}>Toplam {users.length} kullanıcı bulundu</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Kullanıcı bulunamadı</p>
              <Link to="/admin/users/new">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  İlk Kullanıcıyı Oluştur
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                    <th className={`text-left ${tableHeadCompactCls}`}>Kullanıcı</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Email</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Rol</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Abonelik</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Bitiş</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Durum</th>
                    <th className={`text-right ${tableHeadCompactCls}`}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-2 px-3 text-xs font-normal text-gray-800 dark:text-gray-200">{user.name}</td>
                      <td className="py-2 px-3 text-[11px] text-gray-600 dark:text-gray-400">{user.email}</td>
                      <td className="py-2 px-3">{getRoleBadge(user.role)}</td>
                      <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                        {getSubscriptionTypeLabel(user.subscriptionType)}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                        {formatDate(user.subscriptionEndsAt)}
                      </td>
                      <td className="py-2 px-3">{getStatusBadge(user.status)}</td>
                      <td className="py-2 px-3">
                        <div className="flex justify-end gap-1">
                          <Link to={`/admin/users/${user.id}/detail`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-gray-600 dark:text-gray-400">
                              <BarChart2 className="h-3 w-3 mr-1" />
                              Detay
                            </Button>
                          </Link>
                          <Link to={`/admin/users/${user.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-gray-600 dark:text-gray-400">
                              <Edit className="h-3 w-3 mr-1" />
                              Düzenle
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
