import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Calculator, Activity, Download, Calendar, Radio } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

interface TenantStat {
  tenantId: number;
  tenantName: string;
  tenantEmail: string | null;
  totalCalculations: number;
  userCount: number;
  mostUsedType: string;
  lastCalculation: string | null;
  typeDistribution: Record<string, number>;
}

interface AnalyticsData {
  summary: {
    totalTenants: number;
    activeTenants: number;
    totalCalculations: number;
    usersWithActivity?: number;
    overallTypeDistribution: Record<string, number>;
  };
  tenants: TenantStat[];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f97316", "#a855f7", "#84cc16", "#14b8a6", "#f43f5e", "#6366f1"];

const formatTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    kidem: "Kıdem", kidem_30isci: "Kıdem (30+)", kidem_tazminati: "Kıdem Tazminatı",
    ihbar: "İhbar", ihbar_30isci: "İhbar (30+)", ihbar_tazminati: "İhbar Tazminatı",
    fazla_mesai: "Fazla Mesai", fazla_mesai_standart: "Fazla Mesai",
    yillik_izin: "Yıllık İzin", yillik_izin_standart: "Yıllık İzin",
    hafta_tatili: "Hafta Tatili", hafta_tatili_standart: "Hafta Tatili", hafta_tatili_alacagi: "Hafta Tatili",
    ubgt: "UBGT", ubgt_alacagi: "UBGT", ubgt_bilirkisi: "UBGT Bilirkişi",
    ucret_alacagi: "Ücret Alacağı", prim_alacagi: "Prim Alacağı",
    bakiye_ucret_alacagi: "Bakiye Ücret", davaci_ucreti: "Davacı Ücreti",
    is_arama_izni: "İş Arama İzni",
    haksiz_fesih: "Haksız Fesih", haksiz_fesih_tazminati: "Haksız Fesih",
    kotu_niyet_tazminati: "Kötü Niyet",
    ise_almama_tazminati: "İşe Almama",
    ayrimcilik_tazminati: "Ayrımcılık",
    bosta_gecen_sure_ucreti: "Boşta Geçen Süre",
  };
  return typeMap[type] || type;
};

export default function AdminTenantAnalytics() {
  const { error: showToastError } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeUsersCount, setActiveUsersCount] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [topN, setTopN] = useState(10);

  const loadActiveUsersCount = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/analytics/active-users-count`, { headers: { "x-user-role": "admin" } });
      if (res.ok) {
        const result = await res.json();
        setActiveUsersCount(result.data?.activeUsersCount ?? 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadActiveUsersCount();
    const interval = setInterval(loadActiveUsersCount, 15000);
    return () => clearInterval(interval);
  }, [loadActiveUsersCount]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange.start) params.append("startDate", dateRange.start);
      if (dateRange.end) params.append("endDate", dateRange.end);
      const url = `/api/admin/analytics/tenant-usage${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiClient(url, { headers: { "x-user-role": "admin" } });
      if (!res.ok) throw new Error("İstatistikler yüklenemedi");
      const result = await res.json();
      setData(result.data);
    } catch (err) {
      showToastError(err instanceof Error ? err.message : "İstatistikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilter = () => loadData();

  const handleExport = () => {
    if (!data) return;
    let csv = "\uFEFFTenant Adı,Email,Kullanıcı Sayısı,Toplam Hesaplama,Hesaplama Dağılımı,Son Hesaplama,Durum\n";
    data.tenants.forEach((t) => {
      const distributionText = Object.entries(t.typeDistribution)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => `${formatTypeName(type)}: ${count}`)
        .join("; ");
      csv += `${t.tenantName},${t.tenantEmail || "-"},${t.userCount},${t.totalCalculations},"${distributionText || "-"}",${t.lastCalculation || "-"},${t.totalCalculations > 0 ? "Aktif" : "Pasif"}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenant-istatistikleri-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try { return new Date(dateStr).toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return dateStr; }
  };

  const pieData = data
    ? Object.entries(data.summary.overallTypeDistribution)
        .map(([type, count]) => ({ name: formatTypeName(type), value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  const barData = data
    ? data.tenants
        .filter((t) => t.totalCalculations > 0)
        .slice(0, topN)
        .map((t) => ({
          name: t.tenantName.length > 20 ? t.tenantName.slice(0, 20) + "…" : t.tenantName,
          fullName: t.tenantName,
          hesaplamalar: t.totalCalculations,
        }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Tenant Kullanım İstatistikleri</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tüm tenant'ların hesaplama kullanımlarını izleyin</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" /> CSV İndir
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Başlangıç Tarihi</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bitiş Tarihi</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <Button onClick={handleFilter}>
              <Calendar className="w-4 h-4 mr-2" /> Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Users className="h-6 w-6 text-blue-600 dark:text-blue-400" /></div><div><p className="text-sm text-gray-500 dark:text-gray-400">Toplam Tenant</p><p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{data.summary.totalTenants}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg"><Activity className="h-6 w-6 text-green-600 dark:text-green-400" /></div><div><p className="text-sm text-gray-500 dark:text-gray-400">Aktif Tenant</p><p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{data.summary.activeTenants}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><Calculator className="h-6 w-6 text-purple-600 dark:text-purple-400" /></div><div><p className="text-sm text-gray-500 dark:text-gray-400">Toplam Hesaplama</p><p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{data.summary.totalCalculations.toLocaleString("tr-TR")}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-4"><div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg"><TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" /></div><div><p className="text-sm text-gray-500 dark:text-gray-400">Ortalama/Tenant</p><p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{data.summary.activeTenants > 0 ? Math.round(data.summary.totalCalculations / data.summary.activeTenants) : 0}</p></div></div></CardContent></Card>
        <Card className="border-green-200 dark:border-green-800/50"><CardContent className="p-4"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg"><Radio className="h-6 w-6 text-green-600 dark:text-green-400" /></div><div><p className="text-sm text-gray-500 dark:text-gray-400">Canlı Kullanıcı</p><p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{activeUsersCount !== null ? activeUsersCount.toLocaleString("tr-TR") : "–"}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Şu an program açık</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div><CardTitle>Tenant Bazlı Kullanım</CardTitle><CardDescription>En çok hesaplama yapan tenant'lar</CardDescription></div>
              <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100">
                <option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option><option value={50}>Top 50</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={({ active, payload }) => active && payload?.[0] && (
                  <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{payload[0].payload.fullName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Hesaplama: {payload[0].value}</p>
                  </div>
                )} />
                <Bar dataKey="hesaplamalar" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hesaplama Tipi Dağılımı</CardTitle>
            <CardDescription>En çok kullanılan tipler</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={(e) => `${e.name}: ${e.value}`} outerRadius={90} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant Detayları</CardTitle>
          <CardDescription>Tüm tenant'ların detaylı kullanım bilgileri</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Tenant</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Kullanıcı</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Hesaplama</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Dağılım</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Son Hesaplama</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Durum</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((tenant) => (
                  <tr key={tenant.tenantId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="py-3 px-4"><p className="font-medium text-gray-900 dark:text-gray-100">{tenant.tenantName}</p>{tenant.tenantEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{tenant.tenantEmail}</p>}</td>
                    <td className="py-3 px-4 text-center text-gray-900 dark:text-gray-100">{tenant.userCount}</td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-900 dark:text-gray-100">{tenant.totalCalculations.toLocaleString("tr-TR")}</td>
                    <td className="py-3 px-4"><div className="flex flex-wrap gap-1">{tenant.totalCalculations > 0 ? Object.entries(tenant.typeDistribution).sort(([,a],[,b]) => b - a).map(([type, count]) => <Badge key={type} variant="secondary" className="text-xs">{formatTypeName(type)}: {count}</Badge>) : <span className="text-xs text-gray-400">-</span>}</div></td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(tenant.lastCalculation)}</td>
                    <td className="py-3 px-4 text-center">{tenant.totalCalculations > 0 ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Aktif</Badge> : <Badge variant="secondary">Pasif</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
