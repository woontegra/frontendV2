import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { Trash2, Edit, FileText, Search, X, Copy } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

type SavedCase = {
  id: number;
  hesaplama_tipi: string;
  kayit_adi?: string | null;
  notes?: string | null;
  ise_giris: string | null;
  isten_cikis: string | null;
  net_toplam: number | null;
  created_at?: string;
  data?: any;
};

const fmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getRouteForType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("tanikli") && t.includes("standart")) return "/fazla-mesai/tanikli-standart";
  if (t.includes("fazla_mesai_standart") || t === "fazla_mesai") return "/fazla-mesai/standart";
  if (t.includes("davaci")) return "/davaci-ucreti";
  if (t.includes("kidem")) return "/kidem-tazminati/30isci";
  if (t.includes("ihbar")) return "/ihbar-tazminati/30isci";
  return "/fazla-mesai/standart";
}

export default function SavedCalculationsPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  useEffect(() => { loadCases(); }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await apiClient("/api/saved-cases", { headers: { "x-tenant-id": String(tenantId) } });
      if (!res.ok) throw new Error("Yüklenemedi");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setCases(arr.map((item: any) => {
        let pd: any = {};
        if (item.data) pd = typeof item.data === "string" ? (() => { try { return JSON.parse(item.data); } catch { return {}; } })() : item.data;
        const inner = pd.data || pd;
        return {
          id: item.id,
          hesaplama_tipi: (item.type || "").toLowerCase(),
          kayit_adi: item.name || null,
          notes: item.name || null,
          ise_giris: pd.form?.iseGiris || pd.ise_giris || null,
          isten_cikis: pd.form?.istenCikis || pd.isten_cikis || null,
          net_toplam: inner.results?.net ?? pd.net_total ?? null,
          created_at: item.createdAt || null,
          data: pd,
        };
      }));
    } catch { error("Hesaplamalar yüklenemedi"); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu hesaplamayı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await apiClient(`/api/saved-cases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      success("Hesaplama silindi");
      setCases((p) => p.filter((c) => c.id !== id));
    } catch (e: any) { error(e.message || "Silme başarısız"); }
  };

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter((c) =>
      (c.kayit_adi || "").toLowerCase().includes(q) ||
      (c.hesaplama_tipi || "").includes(q) ||
      (c.net_toplam?.toString() || "").includes(q)
    );
  }, [cases, searchQuery]);

  const formatDate = (s?: string | null) => {
    if (!s) return "-";
    try { return new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return "-"; }
  };

  if (loading) return <Card><CardContent className="p-6 text-center text-gray-500">Yükleniyor...</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıtlı Hesaplamalar</CardTitle>
        <CardDescription>Kaydettiğiniz hesaplamaları görüntüleyin ve yönetin</CardDescription>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4" /></button>}
        </div>
      </CardHeader>
      <CardContent>
        {filteredCases.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="font-semibold mb-2">{searchQuery ? "Sonuç bulunamadı" : "Henüz kayıtlı hesaplama yok"}</h3>
            {searchQuery && <Button variant="outline" onClick={() => setSearchQuery("")}>Temizle</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-2 text-left">Kayıt Adı</th>
                  <th className="px-2 py-2 text-left">Tarih</th>
                  <th className="px-2 py-2 text-left">Başlangıç</th>
                  <th className="px-2 py-2 text-left">Bitiş</th>
                  <th className="px-2 py-2 text-left">Net</th>
                  <th className="px-2 py-2 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCases.map((c) => {
                  const route = getRouteForType(c.hesaplama_tipi);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-2 py-2 truncate">{c.kayit_adi || "—"}</td>
                      <td className="px-2 py-2">{formatDate(c.created_at)}</td>
                      <td className="px-2 py-2">{formatDate(c.ise_giris)}</td>
                      <td className="px-2 py-2">{formatDate(c.isten_cikis)}</td>
                      <td className="px-2 py-2 font-semibold">{c.net_toplam != null ? fmt.format(Number(c.net_toplam)) : "-"}</td>
                      <td className="px-2 py-2 text-right">
                        <Button variant="outline" size="icon" className="h-8 w-8 mr-1" onClick={() => navigate(`${route}/${c.id}`)} title="Düzenle"><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 mr-1" onClick={async () => {
                          try {
                            const r = await apiClient(`/api/saved-cases/${c.id}`);
                            if (!r.ok) throw new Error();
                            const item = await r.json();
                            const name = (item.name || c.kayit_adi || "Kopya").startsWith("Kopya") ? `${item.name} (2)` : `Kopya - ${item.name || c.kayit_adi}`;
                            const p = await apiClient("/api/saved-cases", { method: "POST", body: JSON.stringify({ name, type: item.type, data: item.data }) });
                            if (!p.ok) throw new Error();
                            success("Kopyalandı"); loadCases();
                          } catch { error("Kopyalama başarısız"); }
                        }} title="Kopyala"><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(c.id)} title="Sil"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
