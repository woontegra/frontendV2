import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { calculateSubscription } from "@/utils/subscriptionUtils";
import { apiClient } from "@/utils/apiClient";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { error } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<{
    subscriptionType: string | null;
    subscriptionEndsAt: string | null;
    subscriptionStartsAt?: string | null;
    autoRenew: boolean;
  } | null>(null);

  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    loadSubscriptionData();
    const handleFocus = () => loadSubscriptionData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user?.email]);

  const loadSubscriptionData = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      const email = encodeURIComponent(user.email);
      let response = await apiClient(`/api/auth/me?email=${email}`, {
        headers: { "x-tenant-id": String(tenantId), Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        response = await apiClient(`/api/admin/users/email/${email}`, {
          headers: { "x-tenant-id": String(tenantId), Authorization: `Bearer ${token}`, "x-user-role": "admin" },
        });
      }
      if (!response.ok) throw new Error("Abonelik bilgileri yüklenemedi");
      const data = await response.json();
      setSubscriptionData({
        subscriptionType: data.subscriptionType || null,
        subscriptionEndsAt: data.subscriptionEndsAt || null,
        subscriptionStartsAt: data.subscriptionStartsAt || null,
        autoRenew: data.autoRenew || false,
      });
    } catch {
      error("Abonelik bilgileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return String(dateStr);
    }
  };

  const getSubscriptionTypeLabel = (type: string | null) => {
    if (!type) return "Abonelik Yok";
    const labels: Record<string, string> = {
      starter: "Starter",
      professional: "Professional",
      demo: "Demo",
      annual: "Yıllık Standart",
      monthly: "Aylık Standart",
      trial: "Deneme",
      premium: "Professional",
    };
    return labels[type] || type;
  };

  const getProgress = () => {
    const calc = calculateSubscription(
      subscriptionData?.subscriptionStartsAt,
      subscriptionData?.subscriptionEndsAt
    );
    if (!calc.hasSubscription)
      return { daysRemaining: null, percentage: 0, totalDays: 0, elapsedDays: 0 };
    return {
      daysRemaining: calc.daysRemaining > 0 ? calc.daysRemaining : 0,
      percentage: calc.remainingPct,
      totalDays: calc.totalDays,
      elapsedDays: calc.daysUsed,
    };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Abonelik Bilgileri</CardTitle>
          <CardDescription>Mevcut abonelik planınız</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-gray-500">Abonelik Tipi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {user?.licenseType
                      ? getSubscriptionTypeLabel(user.licenseType)
                      : subscriptionData
                        ? getSubscriptionTypeLabel(subscriptionData.subscriptionType)
                        : "Abonelik Yok"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Başlangıç Tarihi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {subscriptionData?.subscriptionStartsAt ? formatDate(subscriptionData.subscriptionStartsAt) : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Bitiş Tarihi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {subscriptionData?.subscriptionEndsAt ? formatDate(subscriptionData.subscriptionEndsAt) : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Yenileme Tarihi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {subscriptionData?.subscriptionEndsAt ? formatDate(subscriptionData.subscriptionEndsAt) : "-"}
                  </p>
                </div>
              </div>

              {subscriptionData?.subscriptionEndsAt && (() => {
                const progress = getProgress();
                if (progress.daysRemaining === null) return null;
                const isExpiringSoon = progress.daysRemaining <= 30;
                const isExpired = progress.daysRemaining <= 0;
                const remaining = progress.percentage;
                const elapsed = 100 - remaining;
                return (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-gray-500">
                        {isExpired ? "Abonelik Süresi Doldu" : `Kalan Süre: ${progress.daysRemaining} gün`}
                      </Label>
                      <span
                        className={`text-sm font-semibold ${
                          isExpired ? "text-red-600" : isExpiringSoon ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {remaining.toFixed(1)}% kaldı
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden relative">
                      {elapsed > 0 && (
                        <div
                          className="h-full bg-gray-400 absolute left-0 top-0 transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, elapsed))}%` }}
                        />
                      )}
                      {remaining > 0 && (
                        <div
                          className={`h-full absolute right-0 top-0 transition-all ${
                            isExpired || isExpiringSoon ? "bg-red-500" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, remaining))}%` }}
                        />
                      )}
                    </div>
                    {progress.daysRemaining > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {progress.elapsedDays} gün geçti, {progress.daysRemaining} gün kaldı
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
