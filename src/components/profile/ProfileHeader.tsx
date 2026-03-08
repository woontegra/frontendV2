import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { API_BASE_URL } from "@/utils/apiClient";
import UploadAvatarDialog from "./UploadAvatarDialog";
import { Camera } from "lucide-react";

function formatSubscriptionDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function getSubscriptionTypeLabel(type: string | null): string {
  if (!type) return "Abonelik Yok";
  const labels: Record<string, string> = {
    annual: "Yıllık Standart Abonelik",
    monthly: "Aylık Standart Abonelik",
    trial: "Deneme Aboneliği",
    starter: "Starter",
    professional: "Professional",
    demo: "Demo",
  };
  return labels[type] || type;
}

export default function ProfileHeader() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }
    try {
      const base64Avatar = localStorage.getItem(`avatar_base64_${user.id}`);
      if (base64Avatar && base64Avatar.startsWith("data:image/")) {
        setAvatarUrl(base64Avatar);
        return;
      }
    } catch {
      // ignore
    }
    if (user?.profilePicture) {
      let profilePath = user.profilePicture;
      if (!profilePath.startsWith("/")) profilePath = "/" + profilePath;
      setAvatarUrl(`${API_BASE_URL}${profilePath}`);
    } else {
      setAvatarUrl(null);
    }
  }, [user?.id, user?.profilePicture]);

  useEffect(() => {
    if (!user?.email) {
      setSubscriptionEndsAt(null);
      setSubscriptionType(null);
      return;
    }
    const load = async () => {
      try {
        const { apiClient } = await import("@/utils/apiClient");
        const tenantId = localStorage.getItem("tenant_id") || "1";
        const token = localStorage.getItem("access_token");
        let res = await apiClient(`/api/auth/me?email=${encodeURIComponent(user.email!)}`, {
          headers: { "x-tenant-id": tenantId, Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          res = await apiClient(`/api/admin/users/email/${encodeURIComponent(user.email!)}`, {
            headers: { "x-tenant-id": tenantId, Authorization: `Bearer ${token}`, "x-user-role": "admin" },
          });
        }
        if (!res.ok) return;
        const data = await res.json();
        setSubscriptionEndsAt(data.subscriptionEndsAt || null);
        setSubscriptionType(data.subscriptionType || null);
      } catch {
        setSubscriptionEndsAt(null);
        setSubscriptionType(null);
      }
    };
    load();
  }, [user?.email]);

  const initials = (user?.name || user?.email || "U?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const displayName = user?.name || user?.email || "Kullanıcı";

  return (
    <>
      <Card className="mb-6 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative group">
              <Avatar
                className="h-16 w-16 border-2 border-white dark:border-gray-700 shadow-md ring-2 ring-blue-100 dark:ring-gray-700 cursor-pointer transition-all duration-200 group-hover:ring-blue-300 group-hover:scale-105"
                onClick={() => setIsDialogOpen(true)}
              >
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xl font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => setIsDialogOpen(true)}
              >
                <div className="flex flex-col items-center gap-1">
                  <Camera className="h-5 w-5 text-white" />
                  <span className="text-xs text-white font-medium">Profil resmi yükle</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
              {user?.email && (
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">{user.email}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getSubscriptionTypeLabel(subscriptionType || user?.licenseType || null)}
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Yenileme: {formatSubscriptionDate(subscriptionEndsAt)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <UploadAvatarDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        currentAvatarUrl={avatarUrl}
        onAvatarChange={setAvatarUrl}
        userName={displayName}
      />
    </>
  );
}
