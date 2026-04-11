import React, { useState, useEffect } from "react";
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { success, error } = useToast();

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!token || !email) {
      error("Geçersiz şifre sıfırlama bağlantısı");
      setTimeout(() => navigate("/login"), 2000);
    }
  }, [token, email, navigate, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { error("Şifre en az 6 karakter olmalıdır"); return; }
    if (password !== confirmPassword) { error("Şifreler eşleşmiyor"); return; }

    setLoading(true);
    try {
      const res = await apiClient("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, email, newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        success("Şifreniz başarıyla güncellendi!");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        error(data.error || "Şifre güncellenemedi. Lütfen tekrar deneyin.");
      }
    } catch (_e) {
      error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) return null;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-8 w-full max-w-md text-center">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4 inline-flex mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Şifre Güncellendi</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Giriş sayfasına yönlendiriliyorsunuz...</p>
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Yeni Şifre Oluştur</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm text-center">Hesabınız için yeni bir şifre belirleyin.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">E-posta</label>
            <input
              type="email"
              value={decodeURIComponent(email || "")}
              disabled
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Yeni Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                placeholder="En az 6 karakter"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Yeni Şifre (Tekrar)</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                placeholder="Şifrenizi tekrar girin"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" tabIndex={-1}>
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && confirmPassword && (
              <p className={`text-xs mt-1 ${password === confirmPassword ? "text-green-500" : "text-red-500"}`}>
                {password === confirmPassword ? "✓ Şifreler eşleşiyor" : "Şifreler eşleşmiyor"}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || password !== confirmPassword}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </button>

          <Link to="/login" className="block text-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Giriş sayfasına dön
          </Link>
        </form>
      </div>
    </div>
  );
}
