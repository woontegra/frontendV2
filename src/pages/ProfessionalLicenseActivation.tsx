import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Key, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

function formatLicenseKey(value: string): string {
  const raw = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  let formatted = "";
  for (let i = 0; i < raw.length && i < 16; i++) {
    if (i > 0 && i % 4 === 0) formatted += "-";
    formatted += raw[i];
  }
  return formatted;
}

async function getDeviceId(): Promise<string> {
  let id = localStorage.getItem("professional_device_id");
  if (!id) {
    const components = [
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.platform,
      String(navigator.hardwareConcurrency || 0),
      navigator.userAgent,
    ];
    let hash = 0;
    const str = components.join("|");
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    id = "DEV-" + Math.abs(hash).toString(36).toUpperCase();
    localStorage.setItem("professional_device_id", id);
  }
  return id;
}

export default function ProfessionalLicenseActivation() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [done, setDone] = useState(false);

  const handleActivate = async () => {
    if (licenseKey.length !== 19) { setErrorMessage("Lisans anahtarı 16 karakter olmalıdır"); return; }
    setLoading(true);
    setErrorMessage("");

    try {
      const deviceId = await getDeviceId();
      const stored = localStorage.getItem("current_user");
      let userId: number | null = null;
      if (stored) {
        try { userId = JSON.parse(stored).id; } catch (_e) { /* ignore */ }
      }
      if (!userId) {
        const s = localStorage.getItem("user_id");
        if (s) userId = parseInt(s, 10);
      }
      if (!userId) {
        setErrorMessage("Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
        error("Kullanıcı bilgisi bulunamadı");
        return;
      }

      const res = await apiClient("/api/license/activate", {
        method: "POST",
        body: JSON.stringify({ license_key: licenseKey, user_id: userId, device_id: deviceId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || d.error || "Lisans aktive edilemedi");
      }
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("licenseValid", "true");
        localStorage.setItem("professionalLicenseKey", licenseKey);
        localStorage.setItem("licenseExpiry", data.license?.expires_at || "");
        setDone(true);
        success("Lisans başarıyla aktive edildi!");
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        const msgs: Record<string, string> = {
          INVALID_FORMAT: "Geçersiz lisans formatı",
          NOT_FOUND: "Lisans bulunamadı",
          EXPIRED: "Lisansın süresi dolmuş",
          DEVICE_LIMIT: "Bu lisans maksimum cihaz sayısına ulaştı.",
          LICENSE_ALREADY_IN_USE: "Bu lisans başka bir kullanıcıya ait.",
          SERVER_ERROR: "Sunucu hatası. Lütfen tekrar deneyin.",
        };
        const msg = msgs[data.error] || data.message || "Lisans aktive edilemedi";
        setErrorMessage(msg);
        error(msg);
        localStorage.setItem("licenseValid", "false");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sunucu hatası. Lütfen tekrar deneyin.";
      setErrorMessage(msg);
      error(msg);
      localStorage.setItem("licenseValid", "false");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-t-4 border-t-blue-600 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lisans Aktivasyonu</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
            Uygulamayı kullanmaya devam etmek için profesyonel lisans anahtarınızı giriniz.
          </p>
        </div>

        {done ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-800 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">Lisans başarıyla aktive edildi! Dashboard'a yönlendiriliyorsunuz...</span>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lisans Anahtarı</label>
              <input
                type="text"
                placeholder="A12B-128J-14KM-GFR3"
                value={licenseKey}
                onChange={(e) => { setLicenseKey(formatLicenseKey(e.target.value)); setErrorMessage(""); }}
                onKeyDown={(e) => e.key === "Enter" && !loading && licenseKey.length === 19 && handleActivate()}
                disabled={loading}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                maxLength={19}
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                Format: A12B-128J-14KM-GFR3 ({licenseKey.replace(/-/g, "").length}/16 karakter)
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleActivate}
              disabled={loading || licenseKey.length !== 19}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" />Aktive Ediliyor...</>
              ) : (
                <><Key className="h-5 w-5" />Aktive Et</>
              )}
            </button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
              Lisans anahtarınız hakkında bilgi almak için sistem yöneticinizle iletişime geçin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
