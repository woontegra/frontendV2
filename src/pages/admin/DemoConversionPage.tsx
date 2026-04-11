import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TrendingUp, Users, Clock, Percent } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { apiGet } from "@/utils/apiClient";
import { pageTitleCls, pageSubtitleCls, cardTitleCls, cardDescriptionCls, statValueCls, statLabelCls, tableHeadCompactCls, badgeCls, cardContentTightCls } from "./adminStyles";

interface CalculationItem {
  type: string;
  count: number;
}

interface Conversion {
  user_id: number;
  user_email: string;
  demo_activated_at: string;
  paid_activated_at: string;
  days_to_convert: number;
  calculations?: CalculationItem[];
}

interface DemoUserCalculation {
  user_id: number;
  tenant_id: number | null;
  user_email: string;
  demo_activated_at: string | null;
  calculations: CalculationItem[];
}

interface ConversionMetrics {
  total_demos: number;
  total_converted: number;
  conversion_rate: number;
  avg_conversion_time_days: number;
  conversions: Conversion[];
  demo_user_calculations?: DemoUserCalculation[];
}

export default function DemoConversionPage() {
  const { error } = useToast();
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30" | "90">("all");

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiGet("/api/admin/demo-conversion");

      if (!response.ok) {
        throw new Error("Dönüşüm metrikleri yüklenemedi");
      }

      const data = await response.json();
      if (data.success) {
        setMetrics(data);
      } else {
        throw new Error(data.error || "Metrikler yüklenemedi");
      }
    } catch (err: unknown) {
      console.error("Failed to load conversion metrics:", err);
      error(err instanceof Error ? err.message : "Metrikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const filterConversions = (conversions: Conversion[]) => {
    if (dateFilter === "all") return conversions;
    const days = parseInt(dateFilter);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return conversions.filter((conv) => {
      const paidDate = new Date(conv.paid_activated_at);
      return paidDate >= cutoffDate;
    });
  };

  const filteredConversions = metrics ? filterConversions(metrics.conversions) : [];

  const formatCalculations = (calculations: CalculationItem[] | undefined) => {
    if (!calculations || calculations.length === 0) return "—";
    return calculations.map((c) => `${c.type} (${c.count})`).join(", ");
  };

  if (loading) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-full">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-xs text-gray-600 dark:text-gray-400">Metrikler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-full">
        <Alert variant="destructive">
          <AlertDescription className="text-xs">Metrikler yüklenemedi.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-3 max-w-full space-y-4">
      <div>
        <h1 className={pageTitleCls}>Demo → Satış Dönüşüm Metrikleri</h1>
        <p className={pageSubtitleCls}>
          Demo kullanıcılarının satın alma dönüşüm oranlarını ve sürelerini görüntüleyin
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Toplam Demo Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={statValueCls}>{metrics.total_demos}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Demo lisansı olan kullanıcı sayısı</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Dönüşen Kullanıcı</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={statValueCls}>{metrics.total_converted}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Satın alan demo kullanıcı sayısı</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Dönüşüm Oranı</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={statValueCls}>{metrics.conversion_rate.toFixed(2)}%</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Demo'dan satışa dönüşüm yüzdesi</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className={statLabelCls}>Ort. Dönüşüm Süresi</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={statValueCls}>{metrics.avg_conversion_time_days.toFixed(1)}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gün cinsinden ortalama süre</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cardTitleCls}>Dönüşüm Detayları</CardTitle>
              <CardDescription className={cardDescriptionCls}>{filteredConversions.length} dönüşüm gösteriliyor</CardDescription>
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "7" | "30" | "90")}
              className="px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
                <option value="all">Tüm Zamanlar</option>
                <option value="7">Son 7 Gün</option>
                <option value="30">Son 30 Gün</option>
                <option value="90">Son 90 Gün</option>
              </select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredConversions.length === 0 ? (
            <Alert>
              <AlertDescription>
                {dateFilter === "all"
                  ? "Henüz dönüşüm kaydı bulunmuyor."
                  : "Seçilen tarih aralığında dönüşüm bulunamadı."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                    <th className={`text-left ${tableHeadCompactCls}`}>Email</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Demo Başlangıç</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Satın Alma</th>
                    <th className={`text-center ${tableHeadCompactCls}`}>Dönüşüm</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Hesaplamalar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConversions.map((conversion, index) => {
                    const isFastConversion = conversion.days_to_convert <= 3;
                    return (
                      <tr
                        key={`${conversion.user_id}-${index}`}
                        className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          isFastConversion ? "bg-green-50 dark:bg-green-900/20" : ""
                        }`}
                      >
                        <td className="py-2 px-3 text-xs font-normal text-gray-900 dark:text-gray-100">{conversion.user_email}</td>
                        <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">{formatDate(conversion.demo_activated_at)}</td>
                        <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">{formatDate(conversion.paid_activated_at)}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge className={`${isFastConversion ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"} ${badgeCls}`}>
                            {conversion.days_to_convert} gün
                            {isFastConversion && " ⚡"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400 max-w-xs">{formatCalculations(conversion.calculations)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {metrics.total_demos > 0 && (
        <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className={cardTitleCls}>Demo kullanıcıları ve hesaplamalar</CardTitle>
            <CardDescription className={cardDescriptionCls}>Demo talep eden tüm kullanıcılar ve kaydettikleri hesaplama türleri</CardDescription>
          </CardHeader>
          <CardContent className={cardContentTightCls}>
            {metrics.demo_user_calculations && metrics.demo_user_calculations.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                      <th className={`text-left ${tableHeadCompactCls}`}>Tenant No</th>
                      <th className={`text-left ${tableHeadCompactCls}`}>Email</th>
                      <th className={`text-left ${tableHeadCompactCls}`}>Demo başlangıç</th>
                      <th className={`text-left ${tableHeadCompactCls}`}>Hesaplamalar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.demo_user_calculations.map((row, index) => (
                      <tr key={`demo-${row.user_id}-${index}`} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300 tabular-nums">{row.tenant_id ?? "—"}</td>
                        <td className="py-2 px-3 font-normal text-gray-900 dark:text-gray-100">{row.user_email}</td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{row.demo_activated_at ? formatDate(row.demo_activated_at) : "—"}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400 max-w-md">{formatCalculations(row.calculations)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Alert>
                <AlertDescription className="text-xs">
                  Hesaplama listesi alınamadı. Backend'in güncel sürümü çalışıyor mu kontrol edin; sunucuyu yeniden başlattıktan sonra sayfayı yenileyin.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
