import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/context/ToastContext";
import { clearTokens } from "@/utils/authToken";
import { apiClient } from "@/utils/apiClient";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [notifications, setNotifications] = useState({ email: true, login: true });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") || "light";
      const root = document.documentElement;
      if (saved === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
      return saved;
    }
    return "light";
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event("theme-changed"));
  }, [theme]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const email = localStorage.getItem("email");
      if (!email) return;
      const res = await apiClient(`/api/auth/me?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications({
          email: data.emailNotifications ?? true,
          login: data.loginAlerts ?? true,
        });
      }
    } catch {
      // Backend yoksa varsayılan
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      error("Yeni şifreler eşleşmiyor");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      error("Yeni şifre en az 8 karakter olmalıdır");
      return;
    }
    const token = localStorage.getItem("access_token");
    if (!token) {
      error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await apiClient("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre değiştirilemedi");
      success("Şifre başarıyla değiştirildi! Yeni şifrenizle giriş yapın.");
      setTimeout(() => {
        clearTokens();
        navigate("/login", { replace: true });
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Şifre değiştirilirken bir hata oluştu";
      error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    success(`Tema ${value === "light" ? "açık" : "koyu"} moda değiştirildi`);
  };

  const handleNotificationChange = async (type: "email" | "login", value: boolean) => {
    const newNotifications = { ...notifications, [type]: value };
    setNotifications(newNotifications);
    setLoadingNotifications(true);
    try {
      const res = await apiClient("/api/auth/update-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNotifications: newNotifications.email,
          loginAlerts: newNotifications.login,
        }),
      });
      if (!res.ok) throw new Error("Ayarlar kaydedilemedi");
      success("Bildirim ayarları güncellendi");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ayarlar kaydedilirken bir hata oluştu";
      error(msg);
      setNotifications(notifications);
    } finally {
      setLoadingNotifications(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ayarlar</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hesap ve görünüm tercihlerinizi yönetin</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Şifre Değiştir</CardTitle>
          <CardDescription>Hesap güvenliğiniz için şifrenizi güncelleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="oldPassword">Eski Şifre</Label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                value={passwordData.oldPassword}
                onChange={handlePasswordChange}
                placeholder="Mevcut şifrenizi girin"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newPassword">Yeni Şifre</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Yeni şifrenizi girin"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Yeni Şifre Tekrar</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Yeni şifrenizi tekrar girin"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bildirim Ayarları</CardTitle>
          <CardDescription>Bildirim tercihlerinizi yönetin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Email Bildirimleri</Label>
              <p className="text-sm text-gray-500 mt-0.5">Önemli güncellemeler için email alın</p>
            </div>
            <Switch
              id="email-notifications"
              checked={notifications.email}
              onCheckedChange={(checked) => handleNotificationChange("email", checked)}
              disabled={loadingNotifications}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="login-alerts">Giriş Uyarıları</Label>
              <p className="text-sm text-gray-500 mt-0.5">Yeni cihazdan giriş yapıldığında bildirim alın</p>
            </div>
            <Switch
              id="login-alerts"
              checked={notifications.login}
              onCheckedChange={(checked) => handleNotificationChange("login", checked)}
              disabled={loadingNotifications}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tema Ayarı</CardTitle>
          <CardDescription>Görünüm tercihlerinizi seçin</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="theme">Tema</Label>
            <Select id="theme" value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
              <option value="light">Açık</option>
              <option value="dark">Koyu</option>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
