import { useState, useEffect } from "react";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import { X, Loader2, Trash2, Plus, Monitor, AlertCircle } from "lucide-react";

interface Device {
  id: number;
  device_id: string;
  created_at: string;
  last_used: string;
}

interface Props {
  licenseId: string;
  licenseKey: string;
  onClose: () => void;
  onDeviceUpdate: () => void;
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "-"; }
}

export default function DeviceManagerModal({ licenseId, licenseKey, onClose, onDeviceUpdate }: Props) {
  const { success, error } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    setErrMsg("");
    try {
      const res = await apiClient(`/api/admin/licenses/${licenseId}/devices`);
      const data = await res.json();
      if (data.success) setDevices(data.devices || []);
      else setErrMsg(data.error || "Cihazlar yüklenemedi");
    } catch { setErrMsg("Cihazlar yüklenirken hata oluştu"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDevices(); }, [licenseId]);

  const handleRemove = async (deviceId: number) => {
    if (!confirm("Bu cihazı silmek istediğinize emin misiniz?")) return;
    setProcessingId(deviceId);
    try {
      const res = await apiClient(`/api/admin/licenses/${licenseId}/devices/${deviceId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { success(data.message || "Cihaz silindi"); loadDevices(); onDeviceUpdate(); }
      else error(data.error || "Cihaz silinemedi");
    } catch { error("Hata oluştu"); }
    finally { setProcessingId(null); }
  };

  const handleAddSlot = async () => {
    setAddingSlot(true);
    try {
      const res = await apiClient(`/api/admin/licenses/${licenseId}/devices/add-slot`, { method: "POST" });
      const data = await res.json();
      if (data.success) { success(data.message || "Yeni cihaz hakkı eklendi"); onDeviceUpdate(); }
      else error(data.error || "Eklenemedi");
    } catch { error("Hata oluştu"); }
    finally { setAddingSlot(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Cihaz Yönetimi</h2>
              <code className="text-xs text-blue-600 dark:text-blue-400">{licenseKey}</code>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {errMsg && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errMsg}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm">Cihazlar yükleniyor...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
              <AlertCircle className="w-4 h-4" /> Henüz kayıtlı cihaz bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700 mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Cihaz</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">UUID</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Kayıt Tarihi</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Son Kullanım</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-400">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device, i) => (
                    <tr key={device.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                          <Monitor className="w-3.5 h-3.5 text-gray-400" />
                          Cihaz {i + 1}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                          {device.device_id.length > 8 ? `${device.device_id.slice(0, 8)}...` : device.device_id}
                        </code>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{fmtDate(device.created_at)}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{fmtDate(device.last_used)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemove(device.id)}
                          disabled={processingId === device.id}
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                          title="Cihazı Sil"
                        >
                          {processingId === device.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">Toplam {devices.length} cihaz kayıtlı</span>
            <button
              onClick={handleAddSlot}
              disabled={addingSlot}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {addingSlot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Yeni Cihaz Hakkı Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
