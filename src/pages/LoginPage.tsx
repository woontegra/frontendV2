import React, { useState, useEffect } from "react";
import { Lock, Shield, Sparkles, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { login as authLogin } from "@/utils/authToken";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { success, error } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await authLogin(email, password);

      setUser({
        ...data.user,
        licenseType: data.licenseType ?? null,
        hasValidLicense: data.professionalLicenseValid ?? false,
      });

      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }

      localStorage.setItem("last_login_date", new Date().toISOString());
      window.dispatchEvent(new Event("auth-changed"));
      success("Başarıyla giriş yapıldı");

      if (data.requirePasswordChange === true) {
        navigate("/change-password");
        return;
      }

      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const licenseValid = localStorage.getItem("licenseValid") === "true";

      if (tenantId === 1) {
        navigate("/dashboard");
        return;
      }
      if (!licenseValid) {
        navigate("/professional-license-activation");
        return;
      }

      navigate("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      error(
        err instanceof Error ? err.message : "Giriş başarısız. Lütfen bilgilerinizi kontrol edin."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("remember_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500 rounded-3xl opacity-20 group-hover:opacity-30 blur transition duration-1000" />

            <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
              <div className="text-center mb-8">
                <img
                  src="/logo_beyaz.png"
                  alt="Bilirkişi Hesaplama"
                  className="h-16 sm:h-20 w-auto mx-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <h1 className="mt-6 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent tracking-tight">
                  Bilirkişi Hesaplama
                </h1>
                <p className="mt-2 text-sm text-slate-400 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Güvenli Erişim Portalı
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    E-Posta
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                    placeholder="ornek@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3.5 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800/50 text-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    />
                    <span className="text-slate-400">Beni Hatırla</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full overflow-hidden rounded-xl p-[2px] transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500 opacity-80" />
                  <div className="relative bg-gradient-to-r from-amber-600 to-cyan-600 px-6 py-3.5 rounded-xl">
                    <span className="font-semibold text-white text-sm flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Giriş yapılıyor...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          GİRİŞ YAP
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span>Sistem Aktif • Sürüm 1.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
