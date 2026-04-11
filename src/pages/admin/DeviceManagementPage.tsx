import { useState, useEffect } from "react";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import DeviceManagerModal from "@/components/modals/DeviceManagerModal";
import {
  Key,
  Plus,
  Loader2,
  Copy,
  AlertCircle,
  RefreshCw,
  Monitor,
} from "lucide-react";

interface License {
  id?: string;
  license_id?: string;
  license_key: string;
  type?: string;
  expires_at: string;
  status: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  device_id?: string | null;
  activated_at?: string | null;
  last_seen_at?: string | null;
  created_at: string;
  is_expired?: boolean;
  max_devices?: number;
  used_devices?: number;
  last_login_ip?: string | null;
  distinct_ip_count?: number;
  suspicious_usage?: boolean;
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("tr-TR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "-"; }
}

function statusBadge(isExpired: boolean, status: string) {
  if (isExpired) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Süresi Dolmuş</span>;
  if (status === "active") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Aktif</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{status}</span>;
}

function typeBadge(type: string | undefined) {
  const t = (type || "").toLowerCase();
  if (t === "demo") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Deneme</span>;
  if (t === "annual") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">annual</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Profesyonel</span>;
}

export default function DeviceManagementPage() {
  const { success, error } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");

  // Device modal
  const [deviceModal, setDeviceModal] = useState<{ licenseId: string; licenseKey: string } | null>(null);

  const loadLicenses = async () => {
    setLoading(true);
    setErrMsg("");
    try {
      const res = await apiClient("/api/admin/licenses");
      if (res.status === 401) {
        setErrMsg("Yetkisiz erişim.");
        setLoading(false);
        return;
      }
      if (!res.ok) { setErrMsg(`Sunucu hatası: ${res.status}`); setLoading(false); return; }
      const data = await res.json();
      setLicenses(Array.isArray(data) ? data : data.licenses || []);
    } catch { setErrMsg("Lisanslar yüklenirken hata oluştu"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLicenses(); }, []);

  const createLicense = async () => {
    if (!expiresAt) { error("Lütfen son kullanma tarihi seçin"); return; }
    setCreating(true);
    try {
      const res = await apiClient("/api/admin/licenses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_devices: Number(maxDevices), expires_at: expiresAt }),
      });
      const data = await res.json();
      if (data.success) {
        success(data.message || "Lisans oluşturuldu!");
        setMaxDevices(1);
        setExpiresAt("");
        loadLicenses();
      } else { setErrMsg(data.error || "Lisans oluşturulamadı"); }
    } catch { setErrMsg("Lisans oluşturma sırasında hata oluştu"); }
    finally { setCreating(false); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    success("Lisans anahtarı kopyalandı");
  };

  const filteredLicenses = licenses.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.license_key.toLowerCase().includes(q) ||
      (l.user_email?.toLowerCase().includes(q) ?? false) ||
      (l.user_name?.toLowerCase().includes(q) ?? false);
  });

  const inputCls = "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="p-4 sm:p-6 max-w-full space-y-4">

      {/* ── LISANS OLUŞTURMA ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Yeni Profesyonel Lisans Oluştur</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">Format: A12B-128J-14KM-GFR3</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Maksimum Cihaz Sayısı</label>
            <select
              className={inputCls}
              value={maxDevices}
              onChange={(e) => setMaxDevices(Number(e.target.value))}
              disabled={creating}
            >
              <option value="1">1 cihaz</option>
              <option value="2">2 cihaz</option>
              <option value="3">3 cihaz</option>
              <option value="5">5 cihaz</option>
              <option value="10">10 cihaz</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Son Kullanma Tarihi *</label>
            <input
              type="date"
              className={inputCls}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={creating}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>

        <button
          onClick={createLicense}
          disabled={creating || !expiresAt}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? "Oluşturuluyor..." : "Lisans Oluştur"}
        </button>
      </div>

      {/* ── LİSANS LİSTESİ ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Lisanslar ve Aktif Cihazlar</h2>
            <p className="text-xs text-gray-500 mt-0.5">Toplam {licenses.length} lisans</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Email veya lisans anahtarı ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 pr-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
              />
            </div>
            <button onClick={loadLicenses} className="p-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700" title="Yenile">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {errMsg && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errMsg}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center py-16 gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm">Lisanslar yükleniyor...</span>
            </div>
          ) : filteredLicenses.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              {searchQuery ? "Arama sonucu bulunamadı." : "Henüz lisans bulunmuyor."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                    {["Kullanıcı Email", "Lisans Anahtarı", "Tip", "Cihaz ID", "Aktif Edildi", "Son Görülme", "Aktif Cihaz", "Son Login IP", "Farklı IP", "Şüpheli", "Bitiş Tarihi", "Durum", "İşlem"].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((license) => {
                    const isExpired = license.is_expired ?? (license.expires_at && new Date(license.expires_at) < new Date());
                    const lid = license.id ?? license.license_id;
                    return (
                      <tr
                        key={lid ?? license.license_key}
                        className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isExpired ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                      >
                        <td className="px-2 py-2 text-gray-800 dark:text-gray-200">
                          {license.user_email || <span className="text-gray-400 italic">Atanmamış</span>}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <code className="text-xs font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300">
                              {license.license_key}
                            </code>
                            <button onClick={() => copyKey(license.license_key)} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Kopyala">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">{typeBadge(license.type)}</td>
                        <td className="px-2 py-2">
                          {license.device_id
                            ? <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">{license.device_id.slice(0, 8)}...</code>
                            : <span className="text-gray-400 italic">Aktif değil</span>}
                        </td>
                        <td className="px-2 py-2 text-gray-600 dark:text-gray-400">{fmtDate(license.activated_at ?? null)}</td>
                        <td className="px-2 py-2 text-gray-600 dark:text-gray-400">{fmtDate(license.last_seen_at ?? null)}</td>
                        <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">
                          {license.used_devices != null && license.max_devices != null
                            ? `${license.used_devices}/${license.max_devices}` : "-"}
                        </td>
                        <td className="px-2 py-2 font-mono text-gray-600 dark:text-gray-400">{license.last_login_ip || "-"}</td>
                        <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400">{license.distinct_ip_count ?? "-"}</td>
                        <td className="px-2 py-2 text-center">
                          {license.suspicious_usage
                            ? <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Evet</span>
                            : <span className="text-gray-400">Hayır</span>}
                        </td>
                        <td className="px-2 py-2">
                          <span className={isExpired ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-700 dark:text-gray-300"}>
                            {fmtDate(license.expires_at)}
                          </span>
                        </td>
                        <td className="px-2 py-2">{statusBadge(!!isExpired, license.status || "active")}</td>
                        <td className="px-2 py-2 text-center">
                          {lid != null && license.license_key && (
                            <button
                              onClick={() => setDeviceModal({ licenseId: String(lid), licenseKey: license.license_key })}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                            >
                              <Monitor className="w-3 h-3" /> Cihazlar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Device Manager Modal */}
      {deviceModal && (
        <DeviceManagerModal
          licenseId={deviceModal.licenseId}
          licenseKey={deviceModal.licenseKey}
          onClose={() => setDeviceModal(null)}
          onDeviceUpdate={loadLicenses}
        />
      )}
    </div>
  );
}
