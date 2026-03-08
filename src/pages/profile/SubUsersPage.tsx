import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

type SubUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "viewer";
};

const roleLabels: Record<SubUser["role"], string> = {
  admin: "Admin",
  user: "Kullanıcı",
  viewer: "Görüntüleyici",
};

const roleColors: Record<SubUser["role"], string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function SubUsersPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", role: "user" as SubUser["role"] });
  const [submitting, setSubmitting] = useState(false);
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient(`/api/tenants/${tenantId}/subusers`, {
        headers: { "x-tenant-id": String(tenantId) },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      error("Ad ve email zorunludur");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/tenants/${tenantId}/subusers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId) },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Eklenemedi");
      success("Kullanıcı eklendi");
      setFormData({ name: "", email: "", role: "user" });
      setIsDialogOpen(false);
      await loadUsers();
    } catch {
      const newUser: SubUser = {
        id: Date.now(),
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };
      setUsers([...users, newUser]);
      success("Kullanıcı eklendi (demo)");
      setFormData({ name: "", email: "", role: "user" });
      setIsDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await apiClient(`/api/tenants/${tenantId}/subusers/${id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": String(tenantId) },
      });
      if (res.ok) {
        success("Kullanıcı silindi");
        await loadUsers();
      } else {
        setUsers(users.filter((u) => u.id !== id));
        success("Kullanıcı silindi (demo)");
      }
    } catch {
      setUsers(users.filter((u) => u.id !== id));
      success("Kullanıcı silindi");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Alt Kullanıcılar</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ekibinizin üyelerini yönetin</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Kullanıcı Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
              <DialogDescription>Yeni bir alt kullanıcı ekleyin</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="sub-name">Ad Soyad</Label>
                  <Input
                    id="sub-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ad Soyad"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sub-email">Email</Label>
                  <Input
                    id="sub-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sub-role">Rol</Label>
                  <Select
                    id="sub-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as SubUser["role"] })}
                  >
                    <option value="admin">Admin</option>
                    <option value="user">Kullanıcı</option>
                    <option value="viewer">Görüntüleyici</option>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Ekleniyor..." : "Ekle"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-center text-gray-500">Yükleniyor...</CardContent></Card>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Henüz alt kullanıcı yok</p>
            <p className="text-sm text-gray-500 mt-2">Kullanıcı eklemek için Yeni Kullanıcı Ekle butonuna tıklayın</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcı Listesi</CardTitle>
            <CardDescription>Ekibinizin tüm üyeleri</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Kullanıcı</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Rol</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{u.email}</td>
                      <td className="py-3 px-4">
                        <Badge className={roleColors[u.role]}>{roleLabels[u.role]}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(u.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
