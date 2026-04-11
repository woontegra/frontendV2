import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("access_token")) navigate("/login");
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!newPassword || !confirmPassword) { setErrorMessage("Lütfen tüm alanları doldurun"); return; }
    if (newPassword.length < 8) { setErrorMessage("Şifre en az 8 karakter olmalıdır"); return; }
    if (newPassword !== confirmPassword) { setErrorMessage("Şifreler eşleşmiyor"); return; }

    setLoading(true);
    try {
      const res = await apiClient("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Şifre değiştirilemedi");
      }
      const data = await res.json();
      if (data.success) {
        success("Şifre başarıyla değiştirildi");
        setTimeout(() => navigate("/dashboard"), 1000);
      } else {
        throw new Error(data.error || "Şifre değiştirilemedi");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Şifre değiştirilirken bir hata oluştu";
      setErrorMessage(msg);
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Şifre Değiştirme Zorunlu</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 text-center">
            Güvenliğiniz için lütfen şifrenizi değiştirin
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Yeni Şifre</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" tabIndex={-1}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Yeni Şifre (Tekrar)</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Şifreyi tekrar girin"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" tabIndex={-1}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
          >
            {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
          </button>
        </form>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
          Bu adımı tamamlamadan devam edemezsiniz
        </p>
      </div>
    </div>
  );
}
