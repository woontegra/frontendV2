import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/utils/apiClient";
import { getStatusLabel, getModuleTypeLabel, getSubscriptionTypeLabel } from "@/utils/labelMappings";
import { ChevronLeft, User, FileText, Ticket, Calendar, Key, Zap } from "lucide-react";

interface UserDetailData {
  user: { id: number; name: string; email: string; phone: string | null; company: string | null; role: string; status: string; createdAt: string };
  subscription: { type: string; startDate: string | null; endDate: string | null; remainingDays: number | null; status: string };
  license: { licenseKey: string; status: string; baslangic: string | null; bitis: string | null; sonGorulme: string | null; sonIP: string | null; supheli: boolean; deviceCount: number; remainingDays: number | null } | null;
  usageStats: { totalCalculations: number; last30DaysCalculations: number; mostUsedModule: { name: string; type: string } | null; lastCalculationDate: string | null };
  loginStats: { totalLogins: number; lastLoginDate: string | null; lastLoginIP: string | null };
  tickets: Array<{ id: number; subject: string; status: string; priority: string; createdAt: string }>;
  ipLoginHistory: Array<{ ip: string | null; at: string; userAgent?: string | null }>;
}

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "Veri bulunamadı");
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("tr-TR") : "Veri bulunamadı");
const NO_DATA = "Veri bulunamadı";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient(`/api/admin/users/${id}/detail`, { headers: { "x-user-role": "admin" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || "Veri yüklenemedi");
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading && !data) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Link to="/admin/users"><Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-red-700 dark:text-red-300 font-medium">{error || "Kullanıcı detayı yüklenemedi"}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3">Tekrar dene</Button>
        </div>
      </div>
    );
  }

  const { user, subscription, license, usageStats, loginStats, tickets, ipLoginHistory } = data;
  const sub = subscription ?? { type: "standard", startDate: null, endDate: null, remainingDays: null, status: "active" };
  const usage = usageStats ?? { totalCalculations: 0, last30DaysCalculations: 0, mostUsedModule: null, lastCalculationDate: null };
  const login = loginStats ?? { totalLogins: 0, lastLoginDate: null, lastLoginIP: null };
  const subStatusLabel = sub.status === "active" ? "Aktif" : "Süresi Dolmuş";
  const licenseStatusLabel = license ? getStatusLabel(license.status) : NO_DATA;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/users"><Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
            <User className="h-7 w-7" /> Kullanıcı Detayı – {user.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Abonelik</CardTitle>
          <CardDescription>Tip, başlangıç, bitiş, durum</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={sub.status === "active" ? "default" : "secondary"}>{getSubscriptionTypeLabel(sub.type)}</Badge>
            <Badge variant="outline" className={sub.status === "expired" ? "border-red-500 text-red-600" : ""}>{subStatusLabel}</Badge>
          </div>
          <p className="text-sm"><span className="text-gray-500">Başlangıç:</span> {fmt(sub.startDate)}</p>
          <p className="text-sm"><span className="text-gray-500">Bitiş:</span> {fmt(sub.endDate)}</p>
          {sub.remainingDays != null && sub.remainingDays >= 0 && <p className="text-sm font-medium"><span className="text-gray-500">Kalan gün:</span> {sub.remainingDays}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> Lisans</CardTitle>
          <CardDescription>Lisans anahtarı, durum, cihaz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {license ? (
            <>
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{license.licenseKey}</p>
              <p className="text-sm"><span className="text-gray-500">Durum:</span> {licenseStatusLabel}</p>
              <p className="text-sm"><span className="text-gray-500">Bitiş:</span> {fmt(license.bitis)}</p>
              {license.remainingDays != null && license.remainingDays >= 0 && <p className="text-sm font-medium"><span className="text-gray-500">Kalan gün:</span> {license.remainingDays}</p>}
              <p className="text-sm"><span className="text-gray-500">Cihaz sayısı:</span> {license.deviceCount}</p>
              <p className="text-sm"><span className="text-gray-500">Son görülme:</span> {fmtDateTime(license.sonGorulme)}</p>
              <p className="text-sm"><span className="text-gray-500">Son IP:</span> {license.sonIP ?? NO_DATA}</p>
              {license.supheli && <Badge variant="outline" className="border-red-500 text-red-600">Şüpheli IP tespit edildi</Badge>}
            </>
          ) : (
            <p className="text-sm text-gray-500">{NO_DATA}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Kullanım</CardTitle>
          <CardDescription>Toplam hesaplama, son 30 gün</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{usage.totalCalculations}</p>
          <p className="text-sm text-gray-500">Toplam hesaplama</p>
          <p className="text-sm"><span className="text-gray-500">Son 30 gün:</span> {usage.last30DaysCalculations}</p>
          <p className="text-sm"><span className="text-gray-500">En çok kullanılan:</span> {usage.mostUsedModule ? getModuleTypeLabel(usage.mostUsedModule.type) || usage.mostUsedModule.name : NO_DATA}</p>
          <p className="text-sm"><span className="text-gray-500">Son hesaplama:</span> {fmt(usage.lastCalculationDate)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Giriş</CardTitle>
          <CardDescription>Toplam giriş, son giriş tarihi ve IP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm"><span className="text-gray-500">Toplam giriş:</span> {login.totalLogins ?? NO_DATA}</p>
          <p className="text-sm"><span className="text-gray-500">Son giriş:</span> {fmtDateTime(login.lastLoginDate)}</p>
          <p className="text-sm"><span className="text-gray-500">Son IP:</span> {login.lastLoginIP ?? NO_DATA}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Ticket className="h-4 w-4" /> Destek talepleri</CardTitle>
          <CardDescription>Son talepler</CardDescription>
        </CardHeader>
        <CardContent>
          {(tickets?.length ?? 0) === 0 ? (
            <p className="text-gray-500 text-sm">{NO_DATA}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(tickets ?? []).slice(0, 5).map((t) => (
                <li key={t.id} className="flex justify-between">
                  <span className="truncate">{t.subject}</span>
                  <span className="text-gray-500">{getStatusLabel(t.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {(ipLoginHistory?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IP giriş geçmişi</CardTitle>
            <CardDescription>Son giriş kayıtları</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {(ipLoginHistory ?? []).slice(0, 10).map((h, i) => (
                <li key={i}>{h.ip ?? NO_DATA} – {fmtDateTime(h.at)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Link to={`/admin/users/${id}/edit`}><Button variant="outline">Düzenle</Button></Link>
      </div>
    </div>
  );
}
