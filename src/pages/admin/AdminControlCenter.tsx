import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import {
  ChevronLeft,
  LayoutGrid,
  FlaskConical,
  BarChart2,
  Heart,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Users,
  KeyRound,
  CalendarClock,
  Calculator,
  LogIn,
  TrendingUp,
  Clock3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pageTitleCls, pageSubtitleCls, statValueCls, statLabelCls, tableHeadCompactCls } from "./adminStyles";

const TAB_KEYS = ["genel", "demo", "kullanim", "saglik", "bakim"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "genel", label: "Genel", icon: LayoutGrid },
  { key: "demo", label: "Demo Yönetimi", icon: FlaskConical },
  { key: "kullanim", label: "Kullanım Analizi", icon: BarChart2 },
  { key: "saglik", label: "Sistem Sağlığı", icon: Heart },
  { key: "bakim", label: "Sistem Bakım Modu", icon: Wrench },
];

interface GenelData {
  totalUsers?: number;
  activeLicenses?: number;
  activeDemos?: number;
  expiringIn7Days?: number;
  usersWithoutCalculations?: number;
  loggedInToday?: number;
}

interface DemoLicenseItem {
  licenseId: string | null;
  userId: number | null;
  tenantId: string | null;
  email: string | null;
  expiresAt: string | null;
  remainingDays: number;
  calculationCount: number;
  lastLoginAt: string | null;
  lastCalculationAt?: string | null;
}

interface KullanimData {
  top5Modules?: Array<{ name: string; count: number }>;
  totalCalculationsLast7Days?: number;
  totalCalculationsLast30Days?: number;
  top5Users?: Array<{ userId: number | null; email: string; count: number }>;
}

interface SaglikData {
  ok?: boolean;
  status?: string;
  uptime?: number;
  dbConnected?: boolean;
  errorsLast24h?: number;
  avgResponseMs?: number | null;
  timestamp?: string;
  _lastCheckMs?: number;
}

interface BakimData {
  isActive?: boolean;
  message?: string;
  endsAt?: string | null;
}

export default function AdminControlCenter() {
  const [activeTab, setActiveTab] = useState<TabKey>("genel");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genelData, setGenelData] = useState<GenelData | null>(null);
  const [demosList, setDemosList] = useState<DemoLicenseItem[]>([]);
  const [extendingUserId, setExtendingUserId] = useState<number | null>(null);
  const [convertUserId, setConvertUserId] = useState<number | null>(null);
  const [convertingUserId, setConvertingUserId] = useState<number | null>(null);
  const [deactivateLicenseId, setDeactivateLicenseId] = useState<string | null>(null);
  const [deactivatingLicenseId, setDeactivatingLicenseId] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();
  const [kullanimData, setKullanimData] = useState<KullanimData | null>(null);
  const [saglikData, setSaglikData] = useState<SaglikData | null>(null);
  const [bakimData, setBakimData] = useState<BakimData | null>(null);
  const [bakimSaving, setBakimSaving] = useState(false);
  const [bakimLocalMessage, setBakimLocalMessage] = useState("");
  const [bakimLocalEndsAt, setBakimLocalEndsAt] = useState("");
  const [bakimLocalActive, setBakimLocalActive] = useState(false);

  const formatDate = (v?: string | null) => {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "—";
    }
  };

  const loadGenel = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/control-center/general`, { headers: { "x-user-role": "admin" } });
      setGenelData(res.ok ? await res.json() : null);
    } catch {
      setGenelData(null);
    }
  }, []);

  const loadDemo = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/control-center/demos`, { headers: { "x-user-role": "admin" } });
      const json = res.ok ? await res.json() : [];
      setDemosList(Array.isArray(json) ? json : []);
    } catch {
      setDemosList([]);
    }
  }, []);

  const loadKullanim = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/control-center/usage`, { headers: { "x-user-role": "admin" } });
      setKullanimData(res.ok ? await res.json() : null);
    } catch {
      setKullanimData(null);
    }
  }, []);

  const loadBakim = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/maintenance`, { headers: { "x-user-role": "admin" } });
      if (res.ok) {
        const json = await res.json();
        setBakimData(json);
        setBakimLocalMessage(json.message ?? "");
        setBakimLocalEndsAt(json.endsAt ? json.endsAt.slice(0, 16) : "");
        setBakimLocalActive(json.isActive ?? false);
      } else {
        setBakimData(null);
      }
    } catch {
      setBakimData(null);
    }
  }, []);

  const saveBakim = useCallback(async () => {
    setBakimSaving(true);
    try {
      const res = await apiClient(`/api/admin/maintenance`, {
        method: "PUT",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: bakimLocalActive,
          message: bakimLocalMessage || undefined,
          endsAt: bakimLocalEndsAt || null,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setBakimData(json);
        toastSuccess("Bakım ayarları kaydedildi");
      } else {
        const err = await res.json().catch(() => ({}));
        toastError("Kayıt başarısız", (err as { error?: string })?.error ?? "Beklenmeyen hata");
      }
    } catch {
      toastError("Kayıt başarısız", "Bağlantı hatası");
    } finally {
      setBakimSaving(false);
    }
  }, [bakimLocalActive, bakimLocalMessage, bakimLocalEndsAt, toastSuccess, toastError]);

  const loadSaglik = useCallback(async () => {
    try {
      const res = await apiClient(`/api/admin/control-center/health`, { headers: { "x-user-role": "admin" } });
      if (res.ok) setSaglikData(await res.json());
      else setSaglikData({ ok: false, status: "error", dbConnected: false, errorsLast24h: 0, avgResponseMs: null });
    } catch {
      setSaglikData({ ok: false, status: "error", dbConnected: false, errorsLast24h: 0, avgResponseMs: null });
    }
  }, []);

  const handleConvertDemo = useCallback(async (userId: number) => {
    setConvertingUserId(userId);
    try {
      const res = await apiClient(`/api/admin/control-center/demos/${userId}/convert`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
      });
      if (res.ok) {
        toastSuccess("Kullanıcı yıllık lisansa geçirildi");
        setConvertUserId(null);
        await loadDemo();
      } else {
        const json = await res.json().catch(() => ({}));
        toastError("Dönüştürme başarısız", json?.error || json?.details || "Beklenmeyen hata");
      }
    } catch {
      toastError("Dönüştürme başarısız", "Bağlantı hatası");
    } finally {
      setConvertingUserId(null);
    }
  }, [loadDemo, toastSuccess, toastError]);

  const handleExtendDemo = useCallback(async (userId: number) => {
    setExtendingUserId(userId);
    try {
      const res = await apiClient(`/api/admin/control-center/demos/${userId}/extend`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
      });
      if (res.ok) {
        toastSuccess("Demo süresi 3 gün uzatıldı");
        await loadDemo();
      } else {
        const json = await res.json().catch(() => ({}));
        toastError("Uzatma başarısız", json?.error || json?.details || "Beklenmeyen hata");
      }
    } catch {
      toastError("Uzatma başarısız", "Bağlantı hatası");
    } finally {
      setExtendingUserId(null);
    }
  }, [loadDemo, toastSuccess, toastError]);

  const handleDeactivateLicense = useCallback(async (licenseId: string) => {
    setDeactivatingLicenseId(licenseId);
    try {
      const res = await apiClient(`/api/admin/control-center/licenses/${licenseId}/deactivate`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
      });
      if (res.ok) {
        toastSuccess("Lisans pasife alındı");
        setDeactivateLicenseId(null);
        await loadDemo();
      } else {
        const json = await res.json().catch(() => ({}));
        toastError("Pasife alma başarısız", json?.error || json?.details || "Beklenmeyen hata");
      }
    } catch {
      toastError("Pasife alma başarısız", "Bağlantı hatası");
    } finally {
      setDeactivatingLicenseId(null);
    }
  }, [loadDemo, toastSuccess, toastError]);

  const loadTabData = useCallback(() => {
    setLoading(true);
    setError(null);
    const loaders: Record<TabKey, () => Promise<void>> = {
      genel: async () => Promise.all([loadGenel(), loadSaglik()]).then(() => undefined),
      demo: loadDemo,
      kullanim: loadKullanim,
      saglik: loadSaglik,
      bakim: loadBakim,
    };
    loaders[activeTab]().catch(() => setError("Veri yüklenemedi")).finally(() => setLoading(false));
  }, [activeTab, loadGenel, loadDemo, loadKullanim, loadSaglik, loadBakim]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const getLastActivity = (d: DemoLicenseItem) => {
    const a = d.lastLoginAt ? new Date(d.lastLoginAt).getTime() : 0;
    const b = d.lastCalculationAt ? new Date(d.lastCalculationAt).getTime() : 0;
    const ts = Math.max(a, b);
    return ts > 0 ? new Date(ts).toISOString() : null;
  };

  const getDemoStatus = (d: DemoLicenseItem) => {
    if ((d.remainingDays ?? 0) < 0) return { label: "Süresi Bitti", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" };
    if (!d.lastLoginAt) return { label: "Giriş Yapmadı", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
    if ((d.calculationCount ?? 0) === 0) {
      if ((d.remainingDays ?? 0) <= 2) return { label: "Pasif Demo", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
      return { label: "Giriş Yaptı / Hesaplama Yok", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" };
    }
    const last = getLastActivity(d);
    const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)) : 999;
    if ((d.calculationCount ?? 0) >= 5 && daysSince <= 2) return { label: "Sıcak Demo", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    if (daysSince > 7) return { label: "Pasif Demo", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
    return { label: "Hesaplama Yaptı", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
  };

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950/40">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6 md:py-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className={pageTitleCls}>Kontrol Merkezi</h1>
              <p className={pageSubtitleCls}>Yönetim öncelikleri, demo akışı, kullanım ve sistem sağlığı tek ekranda.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs px-3 rounded-lg shadow-sm" onClick={loadTabData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200/80 dark:border-rose-800/40 bg-rose-50/60 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {activeTab === "genel" && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[
                    { key: "totalUsers", label: "Toplam Kullanıcı", value: genelData?.totalUsers ?? 0, icon: Users },
                    { key: "activeLicenses", label: "Aktif Lisans", value: genelData?.activeLicenses ?? 0, icon: KeyRound },
                    { key: "activeDemos", label: "Aktif Demo", value: genelData?.activeDemos ?? 0, icon: FlaskConical },
                    { key: "expiring", label: "7 Gün İçinde Bitecek", value: genelData?.expiringIn7Days ?? 0, icon: CalendarClock },
                    { key: "noCalc", label: "Hiç Hesaplama Yapmamış", value: genelData?.usersWithoutCalculations ?? 0, icon: Calculator },
                    { key: "todayLogin", label: "Bugün Giriş Yapan", value: genelData?.loggedInToday ?? 0, icon: LogIn },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card key={item.key} className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/45">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={statLabelCls}>{item.label}</p>
                              <p className={`${statValueCls} mt-1 tabular-nums`}>{item.value.toLocaleString("tr-TR")}</p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Güncel canlı metrik</p>
                            </div>
                            <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800/80">
                              <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/45">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Bugün dikkat edilmesi gerekenler</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                      {(genelData?.usersWithoutCalculations ?? 0).toLocaleString("tr-TR")} kullanıcı hiç hesaplama yapmamış
                    </div>
                    <div className="rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                      {(genelData?.activeDemos ?? 0).toLocaleString("tr-TR")} aktif demo var
                    </div>
                    <div className="rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                      {(genelData?.expiringIn7Days ?? 0).toLocaleString("tr-TR")} lisans 7 gün içinde bitecek
                    </div>
                    <div className="rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                      Sistem sağlığı: {saglikData?.ok === false ? "Dikkat gerekiyor" : "Normal"}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {activeTab === "demo" && (
          <>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                        <th className={`text-left ${tableHeadCompactCls}`}>Kullanıcı</th>
                        <th className={`text-left ${tableHeadCompactCls}`}>Demo Durumu</th>
                        <th className={`text-left ${tableHeadCompactCls}`}>Kalan Gün</th>
                        <th className={`text-left ${tableHeadCompactCls}`}>Son Giriş</th>
                        <th className={`text-left ${tableHeadCompactCls}`}>Hesaplama Sayısı</th>
                        <th className={`text-left ${tableHeadCompactCls}`}>Son Aktivite</th>
                        <th className={`text-left ${tableHeadCompactCls}`}>Aksiyonlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demosList.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">Aktif demo lisansı bulunamadı</td></tr>
                      ) : (
                        demosList.map((d, i) => (
                          <tr key={d.licenseId ?? `demo-${i}`} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">
                              <div className="font-medium">{d.email ?? "—"}</div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">Tenant: {d.tenantId ?? "—"}</div>
                            </td>
                            <td className="py-2 px-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getDemoStatus(d).cls}`}>{getDemoStatus(d).label}</span></td>
                            <td className="py-2 px-3 tabular-nums">{d.remainingDays}</td>
                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{formatDate(d.lastLoginAt)}</td>
                            <td className="py-2 px-3 tabular-nums text-gray-700 dark:text-gray-300">{d.calculationCount}</td>
                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{formatDate(getLastActivity(d))}</td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap gap-1">
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] rounded border-slate-200 dark:border-slate-700 min-w-[52px]" disabled={d.userId == null || extendingUserId === d.userId} onClick={() => d.userId != null && handleExtendDemo(d.userId)}>
                                  {extendingUserId === d.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : "+3 Gün"}
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] rounded border-slate-200 dark:border-slate-700" disabled={d.userId == null || convertingUserId === d.userId} onClick={() => d.userId != null && setConvertUserId(d.userId)}>
                                  {convertingUserId === d.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yıllığa Çevir"}
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] rounded border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400" disabled={d.licenseId == null || deactivatingLicenseId === d.licenseId} onClick={() => d.licenseId != null && setDeactivateLicenseId(d.licenseId)}>
                                  {deactivatingLicenseId === d.licenseId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pasife Al"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "kullanim" && (
          <>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-44 rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/45">
                    <CardContent className="p-4">
                      <p className={statLabelCls}>Son 7 gün hesaplama sayısı</p>
                      <p className={`${statValueCls} mt-1 tabular-nums`}>{(kullanimData?.totalCalculationsLast7Days ?? 0).toLocaleString("tr-TR")}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/45">
                    <CardContent className="p-4">
                      <p className={statLabelCls}>Son 30 gün hesaplama sayısı</p>
                      <p className={`${statValueCls} mt-1 tabular-nums`}>{(kullanimData?.totalCalculationsLast30Days ?? 0).toLocaleString("tr-TR")}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/45">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />En çok kullanılan 5 modül</CardTitle></CardHeader>
                    <CardContent>
                      {(kullanimData?.top5Modules?.length ?? 0) > 0 ? (
                        <ol className="space-y-2">
                          {(kullanimData?.top5Modules ?? []).map((m, i) => (
                            <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3 py-2 dark:border-slate-700/70">
                              <span className="text-sm text-slate-700 dark:text-slate-200">{i + 1}. {m.name}</span>
                              <span className="text-sm font-medium tabular-nums">{(m.count ?? 0).toLocaleString("tr-TR")}</span>
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-sm text-gray-500 dark:text-gray-400">Veri yok</p>}
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/45">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />En aktif 5 kullanıcı</CardTitle></CardHeader>
                    <CardContent>
                      {(kullanimData?.top5Users?.length ?? 0) > 0 ? (
                        <ol className="space-y-2">
                          {(kullanimData?.top5Users ?? []).map((u, i) => (
                            <li key={`${u.userId ?? "x"}-${i}`} className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3 py-2 dark:border-slate-700/70">
                              <span className="text-sm text-slate-700 dark:text-slate-200 truncate max-w-[70%]">{i + 1}. {u.email}</span>
                              <span className="text-sm font-medium tabular-nums">{(u.count ?? 0).toLocaleString("tr-TR")}</span>
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-sm text-gray-500 dark:text-gray-400">Veri yok</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "saglik" && (
          <>
            {loading ? (
              <Skeleton className="h-48 rounded-2xl" />
            ) : (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Sistem durumu</CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">API, DB, hata ve yanıt metrikleri</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {saglikData?.ok === false ? (
                    <div className="flex items-center gap-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 p-4">
                      <AlertTriangle className="h-10 w-10 text-rose-600 flex-shrink-0" />
                      <div><p className="font-medium text-rose-800 dark:text-rose-200">Bağlantı sorunu</p><p className="text-sm text-rose-600/80 dark:text-rose-400/80 mt-0.5">API sağlık kontrolü başarısız</p></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 p-4">
                      <CheckCircle2 className="h-10 w-10 text-emerald-600 flex-shrink-0" />
                      <div><p className="font-medium text-emerald-800 dark:text-emerald-200">Sistem sağlığı normal</p><p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{saglikData?.status ?? "healthy"}</p></div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 pt-2">
                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/50"><p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">API durumu</p><p className={`text-lg font-semibold ${saglikData?.ok === false ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{saglikData?.ok === false ? "Sorunlu" : "Normal"}</p></div>
                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/50"><p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">DB bağlantı durumu</p><p className={`text-lg font-semibold ${saglikData?.dbConnected ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{saglikData?.dbConnected ? "Bağlı" : "Bağlı değil"}</p></div>
                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/50"><p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Son 24 saat hata sayısı</p><p className="text-lg font-semibold tabular-nums">{(saglikData?.errorsLast24h ?? 0).toLocaleString("tr-TR")}</p></div>
                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/50"><p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Ortalama response süresi</p><p className="text-lg font-semibold tabular-nums">{saglikData?.avgResponseMs != null ? `${saglikData.avgResponseMs} ms` : "Ölçülmüyor"}</p></div>
                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/50"><p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Son kontrol zamanı</p><p className="text-sm font-medium flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDate(saglikData?.timestamp)}</p></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "bakim" && (
          <>
            {loading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : (
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Sistem bakım modu</CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bakım modu aktifken normal kullanıcılar bakım ekranı görür. Adminler etkilenmez.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/50">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Bakım modu</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{bakimLocalActive ? "Açık" : "Kapalı"}</p>
                    </div>
                    <button type="button" role="switch" aria-checked={bakimLocalActive} onClick={() => setBakimLocalActive(!bakimLocalActive)} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors ${bakimLocalActive ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}`}>
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${bakimLocalActive ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kullanıcıya gösterilecek mesaj</label>
                    <textarea value={bakimLocalMessage} onChange={(e) => setBakimLocalMessage(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tahmini bitiş tarihi</label>
                    <input type="datetime-local" value={bakimLocalEndsAt} onChange={(e) => setBakimLocalEndsAt(e.target.value)} className="w-full max-w-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm" />
                  </div>
                  <Button onClick={saveBakim} disabled={bakimSaving} className="rounded-xl">{bakimSaving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Kaydediliyor...</>) : "Kaydet"}</Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog open={deactivateLicenseId != null} onOpenChange={(o) => !o && !deactivatingLicenseId && setDeactivateLicenseId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Pasife Al</DialogTitle><DialogDescription>Bu lisans pasife alınacak. Emin misiniz?</DialogDescription></DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeactivateLicenseId(null)} disabled={deactivatingLicenseId != null}>İptal</Button>
              <Button size="sm" variant="destructive" onClick={() => deactivateLicenseId != null && handleDeactivateLicense(deactivateLicenseId)} disabled={deactivatingLicenseId != null}>
                {deactivatingLicenseId != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pasife Al"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={convertUserId != null} onOpenChange={(o) => !o && setConvertUserId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Yıllığa çevir</DialogTitle><DialogDescription>Demo lisans yıllığa çevrilsin mi?</DialogDescription></DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConvertUserId(null)} disabled={convertingUserId != null}>İptal</Button>
              <Button size="sm" onClick={() => convertUserId != null && handleConvertDemo(convertUserId)} disabled={convertingUserId != null}>
                {convertingUserId != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Devam"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
