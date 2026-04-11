import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  subscriptionType: string | null;
  subscriptionEndsAt: string | null;
  subscriptionStartsAt?: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
  status: string;
  createdAt: string;
}

interface EditForm {
  subscriptionType: string;
  subscriptionStartsAt: string;
  subscriptionEndsAt: string;
  autoRenew: boolean;
}

export default function AdminUserEditPage() {
  const { id } = useParams<{ id: string }>();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [trialDays, setTrialDays] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<EditForm>();
  const autoRenew = watch("autoRenew", false);

  useEffect(() => {
    if (id) loadUser();
  }, [id]);

  const loadUser = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiClient(`/api/admin/users/${id}`, { headers: { "x-user-role": "admin" } });
      if (!res.ok) {
        if (res.status === 403) { error("Admin erişimi gerekli"); navigate("/admin-access-denied"); return; }
        throw new Error("Kullanıcı bulunamadı");
      }
      const data = await res.json();
      setUser(data);
      setSuspended(data.status === "suspended");
      setValue("subscriptionType", data.subscriptionType || "annual");
      setValue("subscriptionStartsAt", data.subscriptionStartsAt ? new Date(data.subscriptionStartsAt).toISOString().split("T")[0] : "");
      setValue("subscriptionEndsAt", data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt).toISOString().split("T")[0] : "");
      setValue("autoRenew", data.autoRenew || false);
    } catch (err) {
      error(err instanceof Error ? err.message : "Kullanıcı yüklenemedi");
      navigate("/admin/users");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EditForm) => {
    if (!id) return;
    try {
      setIsSaving(true);
      const res = await apiClient(`/api/admin/users/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({
          subscriptionType: data.subscriptionType,
          subscriptionStartsAt: data.subscriptionStartsAt || null,
          subscriptionEndsAt: data.subscriptionEndsAt || null,
          autoRenew: data.autoRenew || false,
        }),
      });
      if (!res.ok) throw new Error("Güncelleme başarısız");
      success("Abonelik bilgileri güncellendi");
      await loadUser();
    } catch (err) {
      error(err instanceof Error ? err.message : "Güncelleme başarısız");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTrial = async () => {
    if (!id || !trialDays || parseInt(trialDays, 10) < 1) { error("Geçerli gün sayısı girin"); return; }
    try {
      const res = await apiClient(`/api/admin/users/${id}/trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({ days: parseInt(trialDays, 10) }),
      });
      if (!res.ok) throw new Error("Deneme süresi eklenemedi");
      success(`${trialDays} günlük deneme süresi eklendi`);
      setTrialDays("");
      await loadUser();
    } catch (err) {
      error(err instanceof Error ? err.message : "Deneme süresi eklenemedi");
    }
  };

  const handleSuspend = async () => {
    if (!id) return;
    const newStatus = suspended ? "active" : "suspended";
    try {
      const res = await apiClient(`/api/admin/users/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Durum güncellenemedi");
      success(newStatus === "suspended" ? "Hesap askıya alındı" : "Hesap aktifleştirildi");
      setSuspended(!suspended);
      await loadUser();
    } catch (err) {
      error(err instanceof Error ? err.message : "Durum güncellenemedi");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setIsDeleting(true);
      const res = await apiClient(`/api/admin/users/${id}`, { method: "DELETE", headers: { "x-user-role": "admin" } });
      if (!res.ok) throw new Error("Kullanıcı silinemedi");
      success("Kullanıcı silindi");
      navigate("/admin/users");
    } catch (err) {
      error(err instanceof Error ? err.message : "Kullanıcı silinemedi");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try { return new Date(dateStr).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return dateStr; }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card><CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-48 mt-2" /></CardHeader><CardContent><div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div></CardContent></Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Kullanıcı bulunamadı</p>
        <Link to="/admin/users"><Button variant="outline">Geri Dön</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/users">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Geri</Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Kullanıcı Düzenle</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user.name} - Abonelik yönetimi</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Bilgileri</CardTitle>
          <CardDescription>Bu bilgiler salt okunurdur</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-sm text-gray-500">Ad Soyad</Label><p className="mt-1 font-medium">{user.name}</p></div>
            <div><Label className="text-sm text-gray-500">Email</Label><p className="mt-1 font-medium">{user.email}</p></div>
            <div><Label className="text-sm text-gray-500">Rol</Label><p className="mt-1 font-medium">{user.role}</p></div>
            <div><Label className="text-sm text-gray-500">Oluşturulma</Label><p className="mt-1 font-medium">{formatDate(user.createdAt)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abonelik Yönetimi</CardTitle>
          <CardDescription>Abonelik bilgilerini güncelleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subscriptionType">Abonelik Tipi *</Label>
                <Select id="subscriptionType" {...register("subscriptionType", { required: true })}>
                  <option value="annual">Yıllık Abonelik</option>
                  <optgroup label="Demo">
                    <option value="demo_1day">1 Günlük Demo</option>
                    <option value="demo_3days">3 Günlük Demo</option>
                    <option value="demo_7days">7 Günlük Demo</option>
                  </optgroup>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionStartsAt">Başlangıç Tarihi</Label>
                <Input id="subscriptionStartsAt" type="date" max="9999-12-31" {...register("subscriptionStartsAt")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionEndsAt">Bitiş Tarihi</Label>
                <Input id="subscriptionEndsAt" type="date" max="9999-12-31" {...register("subscriptionEndsAt")} />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label htmlFor="autoRenew">Otomatik Yenileme</Label><p className="text-sm text-gray-500">Abonelik otomatik yenilenecek</p></div>
              <Switch id="autoRenew" checked={autoRenew} onCheckedChange={(checked) => setValue("autoRenew", checked)} />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" />{isSaving ? "Kaydediliyor..." : "Kaydet"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deneme Süresi Ekle</CardTitle>
          <CardDescription>Kullanıcıya deneme süresi ekleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[120px] space-y-2">
              <Label htmlFor="trialDays">Gün Sayısı</Label>
              <Input id="trialDays" type="number" min={1} max={30} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="7" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1, 3, 7, 14].map((d) => <Button key={d} type="button" variant="outline" size="sm" onClick={() => setTrialDays(String(d))}>{d} Gün</Button>)}
            </div>
            <Button type="button" onClick={handleAddTrial} disabled={!trialDays}>Ekle</Button>
          </div>
          {user.trialEndsAt && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Mevcut deneme bitiş: {formatDate(user.trialEndsAt)}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hesap Durumu</CardTitle>
          <CardDescription>Hesabı askıya alın veya aktifleştirin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div><Label>Hesap Durumu</Label><p className="text-sm text-gray-500">{suspended ? "Askıya alınmış" : "Aktif"}</p></div>
            <Button type="button" variant={suspended ? "default" : "destructive"} onClick={handleSuspend}>{suspended ? "Aktifleştir" : "Askıya Al"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Kullanıcıyı Sil</CardTitle>
          <CardDescription>Bu işlem geri alınamaz.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Kullanıcıyı silmek istediğinize emin misiniz?</p>
            <Button type="button" variant="destructive" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="h-4 w-4 mr-2" />Sil</Button>
          </div>
        </CardContent>
      </Card>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">Kullanıcıyı Sil</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              <strong>{user.name}</strong> ({user.email}) silinsin mi? Bu işlem <strong>geri alınamaz</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>İptal</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Siliniyor..." : "Evet, Sil"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
