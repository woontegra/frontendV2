import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import LicenseEditModal, { type LicenseRow } from "@/components/modals/LicenseEditModal";
import {
  Key,
  RefreshCw,
  Loader2,
  Search,
  Users,
  FlaskConical,
  AlertCircle,
  Package,
  Clock,
  Settings2,
} from "lucide-react";
import {
  pageTitleCls,
  pageSubtitleCls,
  cardTitleCls,
  cardDescriptionCls,
  statValueCls,
  statLabelCls,
  inputCls,
  selectCls,
  tableHeadCompactCls,
  cardContentTightCls,
} from "./adminStyles";

const PACKAGE_FILTER_OPTIONS = [
  { value: "all", label: "Tüm paketler" },
  { value: "demo", label: "Demo" },
  { value: "starter", label: "Starter" },
  { value: "professional_monthly", label: "Aylık" },
  { value: "professional_yearly", label: "Yıllık" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "aktif", label: "Aktif" },
  { value: "pasif", label: "Pasif" },
  { value: "süresi_dolmuş", label: "Süresi dolmuş" },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function packageBadge(packageType: string | null) {
  const p = (packageType || "").toLowerCase();
  const label =
    p === "demo"
      ? "Demo"
      : p === "starter"
        ? "Starter"
        : p === "professional_monthly" || p === "pro_monthly"
          ? "Aylık"
          : p === "professional_yearly" || p === "pro_yearly"
            ? "Yıllık"
            : packageType || "—";
  const className =
    p === "demo"
      ? "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      : p === "starter" || p.includes("yearly") || p === "pro_yearly"
        ? "bg-blue-600 text-white border-transparent"
        : "border border-gray-300 dark:border-gray-600";
  return <Badge variant="outline" className={`${className} text-[10px] font-medium px-1.5 py-0 rounded`}>{label}</Badge>;
}

function statusBadge(status: string) {
  const label = status === "aktif" ? "Aktif" : status === "pasif" ? "Pasif" : "Süresi dolmuş";
  const className =
    status === "aktif"
      ? "bg-blue-600 text-white"
      : status === "pasif"
        ? "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
  return <Badge variant="outline" className={`${className} text-[10px] font-medium px-1.5 py-0 rounded`}>{label}</Badge>;
}

function remainingDaysCell(days: number | null | undefined, status: string) {
  const d = days ?? 0;
  const isExpired = status === "süresi_dolmuş" || d < 0;
  const isWarning = d >= 0 && d <= 30;
  const color = isExpired
    ? "text-red-600 dark:text-red-400 font-medium"
    : isWarning
      ? "text-amber-600 dark:text-amber-400 font-medium"
      : "text-emerald-600 dark:text-emerald-400 font-medium";
  const displayVal = isExpired && d < 0 ? d : isExpired ? 0 : d;
  return <span className={color}>{displayVal} gün</span>;
}

export default function AdminLicensesPage() {
  const { success, error } = useToast();
  const [list, setList] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<LicenseRow | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (packageFilter && packageFilter !== "all") params.set("packageType", packageFilter);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiClient(`/api/admin/license-management/list?${params.toString()}`, {
        headers: { "x-user-role": "admin" },
      });
      if (!res.ok) throw new Error("Liste alınamadı");
      const data = await res.json();
      setList(data.list || []);
    } catch (e) {
      console.error(e);
      error("Lisans listesi yüklenemedi");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [search, packageFilter, statusFilter, error]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const metrics = useMemo(() => {
    const active = list.filter((r) => r.status === "aktif").length;
    const demo = list.filter((r) => r.packageType === "demo").length;
    const expired = list.filter((r) => r.status === "süresi_dolmuş").length;
    return { active, demo, expired };
  }, [list]);

  const doChangePackage = async (userId: number, newPackage: string) => {
    setActioningId(userId);
    try {
      const res = await apiClient("/api/admin/license-management/change-package", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({ userId, newPackage }),
      });
      const data = await res.json();
      if (data.success) {
        success("Paket güncellendi");
        loadList();
      } else {
        error(data.error || "Güncellenemedi");
      }
    } catch (e) {
      error("İşlem başarısız");
    } finally {
      setActioningId(null);
    }
  };

  const doAddDays = async (userId: number, days: number) => {
    setActioningId(userId);
    try {
      const res = await apiClient("/api/admin/license-management/add-days", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({ userId, days }),
      });
      const data = await res.json();
      if (data.success) {
        success(`+${days} gün eklendi`);
        loadList();
      } else {
        error(data.error || "Eklenemedi");
      }
    } catch (e) {
      error("İşlem başarısız");
    } finally {
      setActioningId(null);
    }
  };

  const saveLicense = async (payload: {
    userId: number;
    newPackage?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await apiClient("/api/admin/license-management/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-role": "admin" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { success: !!data.success, error: data.error };
  };

  const openEditModal = (row: LicenseRow) => {
    setEditRow(row);
    setEditModalOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Aktif kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={statValueCls}>{metrics.active}</div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Demo kullanıcı</CardTitle>
            <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={statValueCls}>{metrics.demo}</div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Süresi dolan</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={`${statValueCls} text-red-600 dark:text-red-400`}>{metrics.expired}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-gray-200/80 dark:border-gray-700/80 shadow-sm bg-white dark:bg-gray-900/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4">
          <div>
            <CardTitle className={`${cardTitleCls} flex items-center gap-2`}>
              <Key className="h-4 w-4" />
              Lisans Yönetimi
            </CardTitle>
            <CardDescription className={cardDescriptionCls}>
              Kullanıcı lisanslarını yönetin. Paket değiştirme, süre ekleme ve detaylı düzenleme.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={loadList} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </CardHeader>
        <CardContent className={cardContentTightCls + " space-y-3"}>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              <input
                placeholder="E-posta veya ad ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadList()}
                className={inputCls + " pl-8"}
              />
            </div>
            <select value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)} className={selectCls + " w-[140px]"}>
              {PACKAGE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls + " w-[120px]"}>
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button onClick={loadList} variant="secondary" size="sm" className="h-8 text-xs px-3">
              Filtrele
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className={`text-left ${tableHeadCompactCls}`}>E-posta</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Paket</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Kalan Gün</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Durum</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    list.map((row) => (
                      <tr key={row.userId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="text-xs font-normal text-gray-800 dark:text-gray-200">{row.email}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-y-0.5">
                            <span>Tenant ID: {row.tenantId}</span>
                            <span className="mx-1.5">·</span>
                            <span>Son giriş: {formatDateTime(row.lastLoginAt)}</span>
                            <span className="mx-1.5">·</span>
                            <span>Hesaplama: {row.calculationCount ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">{packageBadge(row.packageType)}</td>
                        <td className="py-2 px-3 text-xs">{remainingDaysCell(row.remainingDays, row.status)}</td>
                        <td className="py-2 px-3">{statusBadge(row.status)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={actioningId === row.userId}>
                                  <Package className="h-3.5 w-3 mr-1" />
                                  Paket
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => doChangePackage(row.userId, "demo")} disabled={actioningId === row.userId}>
                                  Demo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => doChangePackage(row.userId, "starter")} disabled={actioningId === row.userId}>
                                  Starter
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => doChangePackage(row.userId, "professional_monthly")} disabled={actioningId === row.userId}>
                                  Aylık
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => doChangePackage(row.userId, "professional_yearly")} disabled={actioningId === row.userId}>
                                  Yıllık
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={actioningId === row.userId}>
                                  <Clock className="h-3 w-3 mr-1" />
                                  Süre
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => doAddDays(row.userId, 7)} disabled={actioningId === row.userId}>
                                  +7 Gün
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => doAddDays(row.userId, 30)} disabled={actioningId === row.userId}>
                                  +30 Gün
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => doAddDays(row.userId, 365)} disabled={actioningId === row.userId}>
                                  +1 Yıl
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openEditModal(row)}>
                              <Settings2 className="h-3 w-3 mr-1" />
                              Lisans Yönet
                            </Button>
                            {actioningId === row.userId && (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <LicenseEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        row={editRow}
        onSaved={loadList}
        saveLicense={saveLicense}
      />
    </div>
  );
}
