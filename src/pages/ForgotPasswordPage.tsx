import React, { useState } from "react";
import { Mail, ArrowLeft, Shield, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
        success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
      } else {
        const data = await res.json();
        error(data.error || "Bir hata oluştu. Lütfen tekrar deneyin.");
      }
    } catch (_e) {
      error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl text-center">
            <div className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full p-4 border border-emerald-500/30 inline-flex mb-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">E-posta Gönderildi</h1>
            <p className="text-slate-400 mb-2 text-sm">Şifre sıfırlama bağlantısı gönderildi:</p>
            <p className="text-emerald-400 font-medium mb-6 break-all">{email}</p>
            <p className="text-slate-500 text-sm mb-8">Lütfen e-posta kutunuzu kontrol edin ve bağlantıya tıklayın.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm transition-all">
              <ArrowLeft className="w-4 h-4" />
              Giriş Sayfasına Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-amber-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: "1s" }} />

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500 rounded-3xl opacity-20 blur" />
        <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-amber-500/20 to-cyan-500/20 rounded-full p-4 border border-amber-500/30 inline-flex mb-6">
              <Mail className="h-10 w-10 text-amber-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">Şifre Sıfırlama</h1>
            <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Güvenli Kurtarma Sistemi
            </p>
            <p className="text-xs text-slate-500 mt-2">E-posta adresinize şifre sıfırlama bağlantısı göndereceğiz</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                E-posta Adresi
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300"
                placeholder="ornek@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-cyan-600 hover:from-amber-500 hover:to-cyan-500 text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Sıfırlama Bağlantısı Gönder
                </>
              )}
            </button>

            <Link to="/login" className="block text-center text-slate-400 hover:text-cyan-400 text-sm flex items-center justify-center gap-2 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Giriş sayfasına dön
            </Link>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Güvenli Bağlantı</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
