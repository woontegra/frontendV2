import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import {
  Trash2, Edit, FileText, Search, X, Copy,
  CheckSquare, Square, Download, Upload,
} from "lucide-react";
import { apiClient } from "@/utils/apiClient";

type SavedCase = {
  id: number;
  hesaplama_tipi: string;
  kayit_adi?: string | null;
  ise_giris: string | null;
  isten_cikis: string | null;
  net_toplam: number | null;
  created_at?: string;
  data?: any;
};

const fmt = new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY",
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function getRouteForType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("tanikli") && t.includes("standart")) return "/fazla-mesai/tanikli-standart";
  if (t.includes("haftalik") && t.includes("karma")) return "/fazla-mesai/haftalik-karma";
  if (t.includes("donemsel") && t.includes("haftalik")) return "/fazla-mesai/donemsel-haftalik";
  if (t.includes("donemsel")) return "/fazla-mesai/donemsel";
  if (t.includes("yeralti")) return "/fazla-mesai/yeralti-isci";
  if (t.includes("vardiya_24") || t.includes("vardiya-24") || t.includes("vardiya_48") || t.includes("vardiya-48")) return "/fazla-mesai/vardiya-24-48";
  if (t.includes("fazla_mesai_gemi") || (t.includes("gemi") && t.includes("fazla"))) return "/fazla-mesai/gemi-adami";
  if (t.includes("fazla_mesai") || t === "fazla_mesai") return "/fazla-mesai/standart";
  if (t.includes("ubgt") && t.includes("bilirkisi")) return "/ubgt-bilirkisi";
  if (t.includes("ubgt")) return "/ubgt-alacagi";
  if (t.includes("kidem_gemi")) return "/kidem-tazminati/gemi";
  if (t.includes("kidem_basin")) return "/kidem-tazminati/basin";
  if (t.includes("kidem_mevsim")) return "/kidem-tazminati/mevsimlik";
  if (t.includes("kidem_borclar")) return "/kidem-tazminati/borclar";
  if (t.includes("kismi_sureli") || t.includes("kidem_kismi") || t.includes("part_time")) return "/kidem-tazminati/kismi-sureli";
  if (t.includes("belirli_sureli") || t.includes("kidem_belirli")) return "/kidem-tazminati/belirli-sureli";
  if (t.includes("kidem")) return "/kidem-tazminati/30isci";
  if (t.includes("ihbar_belirli")) return "/ihbar-tazminati/belirli";
  if (t.includes("ihbar_kismi")) return "/ihbar-tazminati/kismi";
  if (t.includes("ihbar_basin")) return "/ihbar-tazminati/basin";
  if (t.includes("ihbar_mevsim")) return "/ihbar-tazminati/mevsim";
  if (t.includes("ihbar_gemi")) return "/ihbar-tazminati/gemi";
  if (t.includes("ihbar_borclar")) return "/ihbar-tazminati/borclar";
  if (t.includes("ihbar")) return "/ihbar-tazminati/30isci";
  if (t.includes("hafta_tatili") && t.includes("basin")) return "/hafta-tatili/basin-is";
  if (t.includes("hafta_tatili") && t.includes("gemi")) return "/hafta-tatili/gemi-adami";
  if (t.includes("hafta_tatili")) return "/hafta-tatili/standard";
  if (t.includes("yillik_izin") && t.includes("borclar")) return "/yillik-izin/borclar";
  if (t.includes("yillik_izin") && t.includes("gemi")) return "/yillik-izin/gemi";
  if (t.includes("yillik_izin") && t.includes("mevsim")) return "/yillik-izin/mevsim";
  if (t.includes("yillik_izin") && t.includes("basin")) return "/yillik-izin/basin";
  if (t.includes("yillik_izin") && t.includes("belirli")) return "/yillik-izin/belirli";
  if (t.includes("yillik_izin") && t.includes("kismi")) return "/yillik-izin/kismi";
  if (t.includes("yillik_izin")) return "/yillik-izin/standart";
  if (t.includes("davaci")) return "/davaci-ucreti";
  if (t.includes("ise_almama") || t.includes("almama")) return "/ise-almama-tazminati";
  if (t.includes("ayrimcilik")) return "/ayrimcilik-tazminati";
  if (t.includes("haksiz_fesih")) return "/haksiz-fesih-tazminati";
  if (t.includes("kotu_niyet")) return "/kotu-niyet-tazminati";
  if (t.includes("bosta_gecen")) return "/bosta-gecen-sure-ucreti";
  if (t.includes("bakiye")) return "/bakiye-ucret-alacagi";
  if (t.includes("ucret_alacagi") || t === "ucret alacagi") return "/ucret-alacagi";
  if (t.includes("is_arama")) return "/is-arama-izni-ucreti";
  if (t.includes("prim")) return "/prim-alacagi";
  return "/fazla-mesai/standart";
}

function mapItem(item: any, tenantId: number): SavedCase {
  let pd: any = {};
  if (item.data) {
    pd = typeof item.data === "string"
      ? (() => { try { return JSON.parse(item.data); } catch (_e) { return {}; } })()
      : item.data;
  }
  const inner = pd.data || pd;

  // Mevsimlik dönem tarihleri
  let mevsimStart: string | null = null;
  let mevsimEnd: string | null = null;
  if (pd.form?.periods && Array.isArray(pd.form.periods) && pd.form.periods.length > 0) {
    const sorted = [...pd.form.periods].sort((a: any, b: any) =>
      new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime()
    );
    mevsimStart = sorted[0]?.start || null;
    const sortedByEnd = [...pd.form.periods].sort((a: any, b: any) =>
      new Date(b.end || 0).getTime() - new Date(a.end || 0).getTime()
    );
    mevsimEnd = sortedByEnd[0]?.end || null;
  }

  return {
    id: item.id,
    hesaplama_tipi: (item.type || item.hesaplama_tipi || "").toLowerCase(),
    kayit_adi: item.name || item.kayit_adi || null,
    ise_giris:
      mevsimStart ||
      pd.form?.iseGiris || pd.form?.startDate ||
      inner.form?.iseGiris || inner.form?.startDate ||
      pd.ise_giris || pd.start_date ||
      inner.ise_giris || inner.start_date ||
      item.ise_giris || null,
    isten_cikis:
      mevsimEnd ||
      pd.form?.istenCikis || pd.form?.endDate ||
      inner.form?.istenCikis || inner.form?.endDate ||
      pd.isten_cikis || pd.end_date ||
      inner.isten_cikis || inner.end_date ||
      item.isten_cikis || null,
    net_toplam:
      inner.results?.net ?? pd.results?.net ??
      pd.net_total ?? inner.net_total ??
      item.net_total ?? null,
    created_at: item.createdAt || item.created_at || null,
    data: pd,
  };
  void tenantId;
}

export default function SavedCalculationsPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [savingNameId, setSavingNameId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadCases(); }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await apiClient("/api/saved-cases", {
        headers: { "x-tenant-id": String(tenantId) },
      });
      if (!res.ok) throw new Error("Yüklenemedi");
      const data = await res.json();
      setCases((Array.isArray(data) ? data : []).map((item: any) => mapItem(item, tenantId)));
    } catch (_e) {
      error("Hesaplamalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  // ── Yedekleme ────────────────────────────────────────────────────────────────
  const handleExportBackup = async () => {
    if (cases.length === 0) { error("Yedeklenecek hesaplama bulunamadı"); return; }
    try {
      setIsExporting(true);
      const token = localStorage.getItem("access_token");
      const res = await apiClient("/api/backups/export", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-tenant-id": String(tenantId) },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Bilinmeyen hata" }));
        throw new Error(d.message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition");
      let fname = `bilirkisi-${new Date().toISOString().split("T")[0]}.bhbackup`;
      if (cd) { const m = cd.match(/filename="?(.+?)"?$/); if (m) fname = m[1]; }
      a.download = fname;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
      success("Yedek başarıyla oluşturuldu ve indirildi");
    } catch (e: any) {
      error(e.message || "Yedek oluşturulurken hata oluştu");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    if (!file.name.endsWith(".bhbackup")) {
      error("Geçersiz dosya. Sadece .bhbackup dosyaları yüklenebilir."); return;
    }
    try {
      setIsImporting(true);
      const token = localStorage.getItem("access_token");
      const form = new FormData(); form.append("backup", file);
      const res = await apiClient("/api/backups/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-tenant-id": String(tenantId) },
        body: form,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Yedek geri yüklenemedi");
      success(d.message || "Yedek başarıyla geri yüklendi");
      await loadCases();
    } catch (e: any) {
      error(e.message || "Geri yüklenirken hata oluştu");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Silme işlemleri ──────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu hesaplamayı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await apiClient(`/api/saved-cases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      success("Hesaplama silindi");
      setCases(p => p.filter(c => c.id !== id));
      setSelectedIds(p => p.filter(sid => sid !== id));
    } catch (e: any) { error(e.message || "Silme başarısız"); }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) { error("Lütfen silmek istediğiniz hesaplamaları seçin"); return; }
    if (!window.confirm(`${selectedIds.length} hesaplama silinecek. Emin misiniz?`)) return;
    setIsDeleting(true);
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await apiClient(`/api/saved-cases/${id}`, { method: "DELETE" });
        if (res.ok) { ok++; setCases(p => p.filter(c => c.id !== id)); }
        else fail++;
      } catch (_e) { fail++; }
    }
    setIsDeleting(false);
    setSelectedIds([]);
    if (ok > 0) success(`${ok} hesaplama silindi`);
    if (fail > 0) error(`${fail} hesaplama silinemedi`);
  };

  const handleDeleteAll = async () => {
    if (filteredCases.length === 0) { error("Silinecek hesaplama yok"); return; }
    if (!window.confirm(`Tüm hesaplamalar (${filteredCases.length} adet) silinecek. Bu işlem geri alınamaz!`)) return;
    setIsDeleting(true);
    let ok = 0, fail = 0;
    for (const c of filteredCases) {
      try {
        const res = await apiClient(`/api/saved-cases/${c.id}`, { method: "DELETE" });
        if (res.ok) { ok++; setCases(p => p.filter(x => x.id !== c.id)); }
        else fail++;
      } catch (_e) { fail++; }
    }
    setIsDeleting(false);
    setSelectedIds([]);
    if (ok > 0) success(`${ok} hesaplama silindi`);
    if (fail > 0) error(`${fail} hesaplama silinemedi`);
  };

  // ── Kopyala ──────────────────────────────────────────────────────────────────
  const handleCopy = async (c: SavedCase) => {
    setCopyingId(c.id);
    try {
      const r = await apiClient(`/api/saved-cases/${c.id}`);
      if (!r.ok) throw new Error("Kayıt yüklenemedi");
      const item = await r.json();
      const name = (item.name || c.kayit_adi || "Kopya").trim();
      const copyName = name.startsWith("Kopya") ? `${name} (2)` : `Kopya - ${name}`;
      const p = await apiClient("/api/saved-cases", {
        method: "POST",
        body: JSON.stringify({ name: copyName, type: item.type, data: item.data }),
      });
      if (!p.ok) { const d = await p.json().catch(() => ({})); throw new Error(d.error || "Kopyalama başarısız"); }
      const created = await p.json();
      success("Hesaplama kopyalandı");
      await loadCases();
      setCases(prev => {
        const newItem = prev.find(x => x.id === created.id);
        if (!newItem) return prev;
        const without = prev.filter(x => x.id !== created.id);
        const idx = without.findIndex(x => x.id === c.id);
        if (idx === -1) return prev;
        return [...without.slice(0, idx + 1), newItem, ...without.slice(idx + 1)];
      });
    } catch (e: any) { error(e.message || "Kopyalama başarısız"); }
    finally { setCopyingId(null); }
  };

  // ── İsim düzenleme ───────────────────────────────────────────────────────────
  const handleSaveName = async (id: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) { setEditingNameId(null); return; }
    setSavingNameId(id);
    try {
      const r = await apiClient(`/api/saved-cases/${id}`);
      if (!r.ok) throw new Error();
      const item = await r.json();
      const p = await apiClient(`/api/saved-cases/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed, type: item.type, data: item.data }),
      });
      if (!p.ok) throw new Error("Güncellenemedi");
      setCases(prev => prev.map(c => c.id === id ? { ...c, kayit_adi: trimmed } : c));
      success("Kayıt adı güncellendi");
    } catch (e: any) { error(e.message || "Kayıt adı güncellenemedi"); }
    finally { setSavingNameId(null); setEditingNameId(null); }
  };

  // ── Seçim ────────────────────────────────────────────────────────────────────
  const toggleSelectId = (id: number) =>
    setSelectedIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === filteredCases.length ? [] : filteredCases.map(c => c.id));

  // ── Filtre ───────────────────────────────────────────────────────────────────
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase().trim();
    const fmtD = (s: string | null) => {
      if (!s) return "";
      try {
        const d = new Date(s);
        return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
      } catch (_e) { return s; }
    };
    return cases.filter(c =>
      (c.kayit_adi || "").toLowerCase().includes(q) ||
      (c.hesaplama_tipi || "").includes(q) ||
      fmtD(c.ise_giris).includes(q) ||
      fmtD(c.isten_cikis).includes(q) ||
      (c.net_toplam?.toString() || "").includes(q)
    );
  }, [cases, searchQuery]);

  const fmtDate = (s?: string | null) => {
    if (!s) return "-";
    try { return new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch (_e) { return "-"; }
  };

  if (loading) return <Card><CardContent className="p-6 text-center text-gray-500">Yükleniyor...</CardContent></Card>;

  return (
    <Card className="w-full">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Kaydedilen Hesaplamalar</CardTitle>
            <CardDescription>Daha önce kaydettiğiniz hesaplamaları görüntüleyin ve yönetin</CardDescription>
          </div>

          {/* Yedekleme butonları */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleExportBackup}
              disabled={isExporting || cases.length === 0}
              variant="outline" size="sm" className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? "Yedekleniyor..." : "Yedekle"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".bhbackup"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportBackup(f); }}
              className="hidden" />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="outline" size="sm" className="gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {isImporting ? "Geri Yükleniyor..." : "Geri Yükle"}
            </Button>
          </div>
        </div>

        {/* Bilgi notu */}
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-200 flex gap-2">
          <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Yedek dosyaları yalnızca bu uygulama ile geri yüklenebilir. Kişiye özeldir, başka kullanıcılar tarafından kullanılamaz.</span>
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-4 lg:px-6">
        {/* Arama + toplu işlemler */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Kayıt adı, tip, tarih veya tutar ile ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-sm">
            {searchQuery && <span className="text-gray-500">{filteredCases.length} sonuç</span>}
            {selectedIds.length > 0 && <span className="font-medium text-blue-600">{selectedIds.length} kayıt seçildi</span>}
            <div className="flex-1" />
            {selectedIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeleteSelected} disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Seçilenleri Sil ({selectedIds.length})
              </Button>
            )}
            {filteredCases.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Tümünü Sil
              </Button>
            )}
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              {searchQuery ? <Search className="h-7 w-7 text-gray-400" /> : <FileText className="h-7 w-7 text-gray-400" />}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {searchQuery ? "Sonuç bulunamadı" : "Henüz kayıtlı hesaplama yok"}
            </h3>
            {searchQuery
              ? <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-3">Aramayı Temizle</Button>
              : <p className="text-sm text-gray-500">Hesaplama yaptığınızda sonuçları burada saklayabilirsiniz</p>
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 text-[11px] sm:text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-1 py-2 w-8 text-center">
                    <button onClick={toggleSelectAll}
                      className="inline-flex items-center justify-center hover:text-blue-600 transition-colors"
                      title={selectedIds.length === filteredCases.length ? "Tümünü Kaldır" : "Tümünü Seç"}>
                      {selectedIds.length === filteredCases.length && filteredCases.length > 0
                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="px-1 py-2 w-6 text-left font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[26%]">Kayıt Adı</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[12%]">Tarih</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[12%]">Başlangıç</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[12%]">Bitiş</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase w-[13%]">Net Toplam</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500 dark:text-gray-400 uppercase w-[120px]">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCases.map((c, idx) => {
                  const isSelected = selectedIds.includes(c.id);
                  const route = getRouteForType(c.hesaplama_tipi);
                  return (
                    <tr key={c.id}
                      className={isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"}>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => toggleSelectId(c.id)}
                          className="inline-flex items-center justify-center hover:text-blue-600 transition-colors">
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-blue-600" />
                            : <Square className="h-4 w-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{idx + 1}</td>

                      {/* İsim — inline düzenleme */}
                      <td className="px-2 py-2 min-w-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {editingNameId === c.id ? (
                          <Input
                            className="h-7 text-[11px] max-w-full"
                            value={editingNameValue}
                            onChange={e => setEditingNameValue(e.target.value)}
                            onBlur={() => handleSaveName(c.id, editingNameValue)}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleSaveName(c.id, editingNameValue);
                              if (e.key === "Escape") { setEditingNameId(null); setEditingNameValue(""); }
                            }}
                            autoFocus
                            disabled={savingNameId === c.id}
                          />
                        ) : (
                          <button type="button"
                            className="text-left font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-1 py-0.5 w-full truncate block"
                            title={c.kayit_adi || undefined}
                            onClick={() => { setEditingNameId(c.id); setEditingNameValue((c.kayit_adi || "").trim()); }}>
                            {savingNameId === c.id ? "Kaydediliyor..." : (c.kayit_adi || "—")}
                          </button>
                        )}
                      </td>

                      <td className="px-2 py-2 text-gray-500 dark:text-gray-400 truncate">{fmtDate(c.created_at)}</td>
                      <td className="px-2 py-2 text-gray-500 dark:text-gray-400 truncate">{fmtDate(c.ise_giris)}</td>
                      <td className="px-2 py-2 text-gray-500 dark:text-gray-400 truncate">{fmtDate(c.isten_cikis)}</td>
                      <td className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {c.net_toplam != null ? fmt.format(Number(c.net_toplam)) : "-"}
                      </td>

                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" variant="outline" size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                            onClick={e => { e.stopPropagation(); navigate(`${route}/${c.id}`); }} title="Düzenle">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button type="button" variant="outline" size="icon"
                            className="h-7 w-7 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                            onClick={e => { e.stopPropagation(); handleCopy(c); }}
                            disabled={copyingId === c.id} title="Kopyala">
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button type="button" variant="outline" size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={e => { e.stopPropagation(); handleDelete(c.id); }} title="Sil">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
