import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

type BarStatus = "ACTIVE" | "PASSIVE";

type BarAssociation = {
  id: number;
  name: string;
  city: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  kepEmail: string | null;
  discountRate: number;
  campaignCode: string | null;
  status: BarStatus;
  lastEmailSentAt: string | null;
  _count?: { emailCampaignLogs: number };
  emailCampaignLogs?: Array<{ status: string; errorMessage: string | null; createdAt: string }>;
  protocolFiles?: Array<{
    id: number;
    originalFileName: string;
    extension: string;
    sizeBytes: number;
    createdAt: string;
    fileUrl?: string | null;
  }>;
};

const emptyForm = {
  name: "",
  city: "",
  primaryEmail: "",
  secondaryEmail: "",
  kepEmail: "",
  website: "",
  phone: "",
  presidentName: "",
  contactPerson: "",
  discountRate: "40",
  campaignCode: "",
  status: "ACTIVE" as BarStatus,
  notes: "",
};

export default function AdminBarAssociationsPage() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BarAssociation[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [hasEmail, setHasEmail] = useState("all");
  const [hasKep, setHasKep] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [protocolFile, setProtocolFile] = useState<File | null>(null);
  const [protocolUploading, setProtocolUploading] = useState(false);
  const [protocolInfo, setProtocolInfo] = useState<BarAssociation["protocolFiles"][number] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search.trim()) p.set("search", search.trim());
      if (status !== "all") p.set("status", status);
      if (hasEmail !== "all") p.set("hasEmail", hasEmail);
      if (hasKep !== "all") p.set("hasKep", hasKep);
      const res = await apiClient(`/api/admin/bar-associations?${p.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Barolar yüklenemedi");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      error(e?.message || "Barolar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [search, status, hasEmail, hasKep, error]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
    setProtocolFile(null);
    setProtocolInfo(null);
  };

  const openEdit = (row: BarAssociation) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      city: row.city || "",
      primaryEmail: row.primaryEmail || "",
      secondaryEmail: row.secondaryEmail || "",
      kepEmail: row.kepEmail || "",
      website: "",
      phone: "",
      presidentName: "",
      contactPerson: "",
      discountRate: String(row.discountRate || 40),
      campaignCode: row.campaignCode || "",
      status: row.status || "ACTIVE",
      notes: "",
    });
    setIsModalOpen(true);
    setProtocolFile(null);
    setProtocolInfo(row.protocolFiles?.[0] || null);
    apiClient(`/api/admin/bar-associations/${row.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          const item = data.item;
          setForm({
            name: item.name || "",
            city: item.city || "",
            primaryEmail: item.primaryEmail || "",
            secondaryEmail: item.secondaryEmail || "",
            kepEmail: item.kepEmail || "",
            website: item.website || "",
            phone: item.phone || "",
            presidentName: item.presidentName || "",
            contactPerson: item.contactPerson || "",
            discountRate: String(item.discountRate || 40),
            campaignCode: item.campaignCode || "",
            status: item.status || "ACTIVE",
            notes: item.notes || "",
          });
          setProtocolInfo(item.protocolFiles?.[0] || null);
        }
      })
      .catch(() => {});
  };

  const uploadProtocol = async () => {
    try {
      if (!editingId) {
        error("Protokol dosyası yüklemek için önce baroyu kaydedin.");
        return;
      }
      if (!protocolFile) {
        error("Lütfen dosya seçin");
        return;
      }
      const ext = `.${(protocolFile.name.split(".").pop() || "").toLowerCase()}`;
      if (![".pdf", ".docx", ".udf"].includes(ext)) {
        error("Sadece .pdf, .docx, .udf dosyaları yüklenebilir");
        return;
      }
      setProtocolUploading(true);
      const fd = new FormData();
      fd.append("file", protocolFile);
      const res = await apiClient(`/api/admin/bar-associations/${editingId}/protocol-file`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Yükleme başarısız");
      success("Protokol dosyası yüklendi");
      setProtocolInfo(data.item || null);
      setProtocolFile(null);
      load();
    } catch (e: any) {
      error(e?.message || "Yükleme başarısız");
    } finally {
      setProtocolUploading(false);
    }
  };

  const removeProtocol = async () => {
    try {
      if (!editingId) return;
      const res = await apiClient(`/api/admin/bar-associations/${editingId}/protocol-file`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Dosya silinemedi");
      success("Protokol dosyası kaldırıldı");
      setProtocolInfo(null);
      load();
    } catch (e: any) {
      error(e?.message || "Dosya silinemedi");
    }
  };

  const submit = async () => {
    try {
      if (!form.name.trim()) {
        error("Baro adı zorunludur");
        return;
      }
      const payload = { ...form, discountRate: Number(form.discountRate) || 40 };
      const url = editingId ? `/api/admin/bar-associations/${editingId}` : "/api/admin/bar-associations";
      const method = editingId ? "PUT" : "POST";
      const res = await apiClient(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Kayıt başarısız");
      success(editingId ? "Baro güncellendi" : "Baro eklendi");
      setIsModalOpen(false);
      load();
    } catch (e: any) {
      error(e?.message || "Kayıt başarısız");
    }
  };

  const deactivate = async (id: number) => {
    try {
      const res = await apiClient(`/api/admin/bar-associations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "İşlem başarısız");
      success("Baro pasife alındı");
      load();
    } catch (e: any) {
      error(e?.message || "İşlem başarısız");
    }
  };

  const rows = useMemo(() => items, [items]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, hasEmail, hasKep]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Baro Yönetimi</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Baro listesi, email ve kampanya kodu yönetimi</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
          <CardDescription>Arama ve durum filtreleri</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input placeholder="Baro / şehir / email ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Tüm Durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
          </Select>
          <Select value={hasEmail} onChange={(e) => setHasEmail(e.target.value)}>
            <option value="all">Mail filtresi yok</option>
            <option value="true">Maili olanlar</option>
            <option value="false">Maili olmayanlar</option>
          </Select>
          <Select value={hasKep} onChange={(e) => setHasKep(e.target.value)}>
            <option value="all">KEP filtresi yok</option>
            <option value="true">KEP olanlar</option>
            <option value="false">KEP olmayanlar</option>
          </Select>
          <Button onClick={openCreate}>Yeni Baro Ekle</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Baro Listesi</CardTitle>
          <CardDescription>Toplam {rows.length} kayıt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  {["Baro", "Şehir", "Mail", "2. Mail", "KEP", "İndirim", "Kampanya Kodu", "Protokol", "Durum", "Son Mail Gönderimi", "İşlemler"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-3 py-3" colSpan={11}>Yükleniyor...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="px-3 py-3" colSpan={11}>Kayıt bulunamadı.</td></tr>
                ) : pagedRows.map((r) => {
                  const lastLog = r.emailCampaignLogs?.[0];
                  const protocol = r.protocolFiles?.[0];
                  return (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">{r.city || "-"}</td>
                      <td className="px-3 py-2">{r.primaryEmail || "-"}</td>
                      <td className="px-3 py-2">{r.secondaryEmail || "-"}</td>
                      <td className="px-3 py-2">{r.kepEmail || "-"}</td>
                      <td className="px-3 py-2">%{r.discountRate}</td>
                      <td className="px-3 py-2">{r.campaignCode || "-"}</td>
                      <td className="px-3 py-2">
                        {protocol ? <Badge variant="secondary">Hazır</Badge> : <Badge variant="destructive">Yok</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.lastEmailSentAt ? new Date(r.lastEmailSentAt).toLocaleString("tr-TR") : "-"}</div>
                        <div className="text-xs text-gray-500">Gönderim: {r._count?.emailCampaignLogs ?? 0}</div>
                        <div className="text-xs text-gray-500">
                          Son durum: {lastLog?.status || "-"} {lastLog?.errorMessage ? `(${lastLog.errorMessage.slice(0, 40)})` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Düzenle</Button>
                          <Button size="sm" variant="destructive" onClick={() => deactivate(r.id)}>Pasife Al</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && rows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span>Sayfa başına</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  Toplam {rows.length} kayıt · Sayfa {currentPage}/{totalPages}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Baro Düzenle" : "Yeni Baro"}</DialogTitle>
            <DialogDescription>Baro iletişim ve kampanya bilgilerini düzenleyin.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries({
              name: "Baro Adı",
              city: "Şehir",
              primaryEmail: "Mail",
              secondaryEmail: "2. Mail",
              kepEmail: "KEP",
              discountRate: "İndirim Oranı",
              campaignCode: "Kampanya Kodu",
            }).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          {editingId && (
            <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 space-y-2">
              <Label className="text-base font-semibold">Protokol Dosyası</Label>
              <p className="text-xs text-gray-500">Desteklenen formatlar: .pdf, .docx, .udf</p>
              <Input type="file" accept=".pdf,.docx,.udf" onChange={(e) => setProtocolFile(e.target.files?.[0] || null)} />
              {protocolFile ? (
                <p className="text-xs text-gray-600">
                  Seçilen: {protocolFile.name} · {(protocolFile.size / 1024).toFixed(1)} KB · {protocolFile.type || "application/octet-stream"}
                </p>
              ) : null}
              {protocolInfo ? (
                <div className="rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">
                  <p><strong>Mevcut:</strong> {protocolInfo.originalFileName}</p>
                  <p><strong>Tip:</strong> {protocolInfo.extension}</p>
                  <p><strong>Boyut:</strong> {(Number(protocolInfo.sizeBytes || 0) / 1024).toFixed(1)} KB</p>
                  <p><strong>Yüklenme:</strong> {new Date(protocolInfo.createdAt).toLocaleString("tr-TR")}</p>
                </div>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">Durum: Yüklenmedi</p>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={uploadProtocol} disabled={protocolUploading || !protocolFile}>
                  {protocolUploading ? "Yükleniyor..." : "Dosya Yükle"}
                </Button>
                {protocolInfo?.fileUrl ? (
                  <Button type="button" variant="outline" onClick={() => window.open(protocolInfo.fileUrl || "", "_blank")}>Dosyayı İndir</Button>
                ) : null}
                {protocolInfo ? (
                  <Button type="button" variant="destructive" onClick={removeProtocol}>Dosyayı Kaldır</Button>
                ) : null}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>İptal</Button>
            <Button onClick={submit}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
