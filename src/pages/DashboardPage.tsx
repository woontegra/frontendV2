import { useMemo, useState, useEffect } from "react";
import {
  FileText, Scale, Calendar, RefreshCw,
  CheckCircle2, AlertCircle, TrendingUp, Clock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend as ReLegend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/utils/apiClient";
import { getSubscriptionTypeLabel } from "@/utils/labelMappings";
import {
  calculateSubscription,
  subscriptionProgressColor,
  subscriptionTextColor,
} from "@/utils/subscriptionUtils";

// ─── Tipler ────────────────────────────────────────────────────────────────────

interface SavedCase {
  id: number;
  name?: string;
  aciklama?: string;
  kayit_adi?: string;
  type: string;
  hesaplama_tipi?: string;
  data?: Record<string, unknown>;
  detay?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
  updatedAt?: string;
  brut_total?: number;
  net_total?: number;
  brut_toplam?: number;
  net_toplam?: number;
}

interface DemoLicense {
  expiresAt: string;
  createdAt: string;
  activatedAt: string;
  type: string;
}

interface UserInfo {
  id: number;
  email: string;
  name?: string;
  subscriptionType?: string;
  subscriptionStartsAt?: string;
  subscriptionEndsAt?: string;
  status?: string;
  demoLicense?: DemoLicense;
}

interface FinancialSummary {
  activeSubscriptionCount: number;
  annualPlanCount: number;
  monthlyPlanCount: number;
  averageLicenseDurationDays: number;
  demoUserCount: number;
  demoToSaleConversionRate: number;
  newSubscriptionsLast30Days: number;
  licensesExpiringIn7Days: number;
  estimatedMRR: number | null;
  hasPriceConfig: boolean;
}

// ─── Yardımcılar ───────────────────────────────────────────────────────────────

const num = (n: number) => n.toLocaleString("tr-TR");

const TYPE_MAP: Record<string, string> = {
  kidem: "Kıdem Tazminatı", kidem_standart: "Kıdem Tazminatı",
  kidem_30isci: "Kıdem Tazminatı (30+ İşçi)", kidem_gemi: "Gemi Adamı Kıdem",
  kidem_basin: "Basın İşçisi Kıdem", kidem_mevsim: "Mevsimlik Kıdem",
  kidem_kismi: "Kısmi Süreli Kıdem", kidem_belirli: "Belirli Süreli Kıdem",
  kidem_borclar: "Borçlar K. Kıdem",
  ihbar: "İhbar Tazminatı", ihbar_standart: "İhbar Tazminatı",
  ihbar_30isci: "İhbar Tazminatı (30+ İşçi)", ihbar_gemi: "Gemi Adamı İhbar",
  ihbar_basin: "Basın İşçisi İhbar", ihbar_mevsim: "Mevsimlik İhbar",
  ihbar_kismi: "Kısmi Süreli İhbar", ihbar_belirli: "Belirli Süreli İhbar",
  ihbar_borclar: "Borçlar K. İhbar",
  yillik_izin: "Yıllık İzin", yillik_izin_standart: "Yıllık İzin",
  yillik_izin_gemi: "Gemi Adamı Yıllık İzin", yillik_izin_basin: "Basın İşçisi Yıllık İzin",
  yillik_izin_mevsim: "Mevsimlik Yıllık İzin", yillik_izin_kismi: "Kısmi Yıllık İzin",
  yillik_izin_belirli: "Belirli Süreli Yıllık İzin",
  fazla_mesai: "Fazla Mesai", fazla_mesai_standart: "Fazla Mesai",
  fazla_mesai_gemi: "Gemi Adamı Fazla Mesai", fazla_mesai_vardiya: "Vardiya Fazla Mesai",
  ubgt: "UBGT Alacağı", ubgt_alacagi: "UBGT Alacağı",
  hafta_tatili: "Hafta Tatili", hafta_tatili_standart: "Hafta Tatili",
  hafta_tatili_gemi: "Gemi Adamı Hafta Tatili", hafta_tatili_basin: "Basın İşçisi Hafta Tatili",
  ucret: "Ücret Alacağı", ucret_alacagi: "Ücret Alacağı",
  bakiye_ucret: "Bakiye Ücret", prim: "Prim Alacağı", prim_alacagi: "Prim Alacağı",
  kotu_niyet: "Kötü Niyet Tazminatı", bosta_gecen_sure: "Boşta Geçen Süre",
  ise_almama: "İşe Başlatmama Tazminatı", ayrimcilik: "Ayrımcılık Tazminatı",
  haksiz_fesih: "Haksız Fesih Tazminatı", is_arama_izni: "İş Arama İzni",
  davaci_ucreti: "Davacı Ücreti",
};

function formatTypeName(raw: string): string {
  if (!raw || raw === "-") return raw;
  if (TYPE_MAP[raw]) return TYPE_MAP[raw];
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return raw.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function normalizePieType(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes("kıdem") || l.includes("kidem")) return "Kıdem";
  if (l.includes("ihbar")) return "İhbar";
  if (l.includes("izin") || l.includes("yıllık")) return "Yıllık İzin";
  if (l.includes("ücret") || l.includes("ucret")) return "Ücret";
  if (l.includes("fazla") || l.includes("mesai")) return "Fazla Mesai";
  if (l.includes("hafta")) return "Hafta Tatili";
  if (l.includes("ubgt")) return "UBGT";
  return formatTypeName(raw);
}

const PIE_COLORS = ["#60A5FA", "#FBBF24", "#34D399", "#F87171", "#A78BFA", "#F472B6", "#38BDF8"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

type Period = "haftalik" | "aylik" | "yillik" | "tum";

// ─── Bileşen ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const tenantId = localStorage.getItem("tenant_id") || "1";

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("current_user") || "null"); }
    catch { return null; }
  })();
  const isAdmin = currentUser?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [savedCases, setSavedCases] = useState<SavedCase[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [period, setPeriod] = useState<Period>("aylik");
  const [detailRow, setDetailRow] = useState<null | ReturnType<typeof buildRecentRows>[number]>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Kayıtlı hesaplamalar
      const res = await apiClient("/api/saved-cases", {
        headers: { "x-tenant-id": tenantId },
      });
      if (res.ok) {
        const d = await res.json();
        setSavedCases(Array.isArray(d) ? d : []);
      }

      // Kullanıcı bilgisi (abonelik)
      const emailRaw = localStorage.getItem("email") || currentUser?.email;
      if (emailRaw) {
        let uRes = await apiClient(`/api/auth/me?email=${encodeURIComponent(emailRaw)}`);
        if (!uRes.ok) {
          uRes = await apiClient(
            `/api/admin/users/email/${encodeURIComponent(emailRaw)}`,
            { headers: { "x-user-role": "admin" } },
          );
        }
        if (uRes.ok) setUserInfo(await uRes.json());
      }

      // Finansal özet (sadece admin)
      if (isAdmin) {
        try {
          const fRes = await apiClient("/api/admin/financial-summary", {
            headers: { "x-user-role": "admin" },
          });
          if (fRes.ok) setFinancial(await fRes.json());
        } catch { /* finansal özet opsiyonel */ }
      }
    } catch {
      // sessiz bırak
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tenantId]);

  // ── Abonelik ─────────────────────────────────────────────────────────────────
  const sub = useMemo(() => {
    const start = userInfo?.demoLicense?.activatedAt ?? userInfo?.subscriptionStartsAt;
    const end   = userInfo?.demoLicense?.expiresAt   ?? userInfo?.subscriptionEndsAt;
    return calculateSubscription(start, end);
  }, [userInfo]);

  const subTypeLabel = useMemo(() => {
    if (userInfo?.demoLicense) return "Deneme";
    const raw = getSubscriptionTypeLabel(userInfo?.subscriptionType);
    if (!raw || raw === "-") return userInfo ? "Kullanıcı" : "-";
    return raw;
  }, [userInfo]);

  // ── Ortalama hesaplama süresi ─────────────────────────────────────────────
  const avgSpeed = useMemo(() => {
    const recent = savedCases.slice(0, 10);
    let total = 0, count = 0;
    recent.forEach(c => {
      if (c.createdAt && c.updatedAt) {
        const ms = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
        if (ms > 0 && ms < 300_000) { total += ms / 1000; count++; }
      }
    });
    if (count === 0) return "Çok Hızlı ⚡";
    const avg = total / count;
    if (avg < 60) return `${avg.toFixed(1)} sn`;
    return `${Math.floor(avg / 60)}dk ${Math.floor(avg % 60)}sn`;
  }, [savedCases]);

  // ── Son giriş ─────────────────────────────────────────────────────────────
  const lastLogin = useMemo(() => {
    const v = localStorage.getItem("last_login_date");
    if (!v) return "İlk Giriş";
    return new Date(v).toLocaleDateString("tr-TR", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }, []);

  // ── Son kayıt adı ──────────────────────────────────────────────────────────
  const lastRecordName = savedCases[0]?.name ?? "-";

  // ── Pasta grafik verisi ───────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    savedCases.forEach(c => {
      const key = normalizePieType(c.type || c.hesaplama_tipi || "Diğer");
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [savedCases]);

  // ── Bar grafik verisi ─────────────────────────────────────────────────────
  const barData = useMemo(() => {
    const now = new Date();
    const getDateStr = (c: SavedCase) => c.created_at || c.createdAt || "";

    if (period === "haftalik") {
      const getWeekStart = (d: Date) => {
        const day = d.getDay() || 7;
        const mon = new Date(d);
        mon.setDate(d.getDate() - day + 1);
        return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
      };
      const keys: string[] = [];
      const counts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - 7 * i);
        const k = getWeekStart(d); keys.push(k); counts[k] = 0;
      }
      savedCases.forEach(c => {
        const s = getDateStr(c); if (!s) return;
        try { const k = getWeekStart(new Date(s)); if (k in counts) counts[k]++; } catch {}
      });
      return keys.map(k => {
        const [, m, d] = k.split("-").map(Number);
        return { name: `${d}.${m}`, Adet: counts[k] };
      });
    }

    if (period === "yillik") {
      const year = now.getFullYear();
      const counts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) counts[String(year - i)] = 0;
      savedCases.forEach(c => {
        const s = getDateStr(c); if (!s) return;
        try { const k = String(new Date(s).getFullYear()); if (k in counts) counts[k]++; } catch {}
      });
      return Object.keys(counts).sort().map(k => ({ name: k, Adet: counts[k] }));
    }

    if (period === "tum") {
      const map: Record<string, number> = {};
      savedCases.forEach(c => {
        const s = getDateStr(c); if (!s) return;
        try {
          const d = new Date(s);
          const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          map[k] = (map[k] || 0) + 1;
        } catch {}
      });
      return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).slice(-12)
        .map(([k, adet]) => {
          const [, m] = k.split("-").map(Number);
          return { name: `${MONTHS[m-1]} ${k.slice(0,4)}`, Adet: adet };
        });
    }

    // aylık (varsayılan)
    const months: Array<{key: string; month: number}> = [];
    const counts: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      let m = now.getMonth() - i, y = now.getFullYear();
      while (m < 0) { m += 12; y -= 1; }
      const k = `${y}-${String(m+1).padStart(2,"0")}`;
      months.push({ key: k, month: m }); counts[k] = 0;
    }
    savedCases.forEach(c => {
      const s = getDateStr(c); if (!s) return;
      try {
        const d = new Date(s);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        if (k in counts) counts[k]++;
      } catch {}
    });
    return months.map(({ key, month }) => ({ name: MONTHS[month], Adet: counts[key] }));
  }, [savedCases, period]);

  // ── Son kayıtlar ──────────────────────────────────────────────────────────
  function buildRecentRows(cases: SavedCase[]) {
    return cases.slice(0, 10).map(c => {
      let brut = Number(c.brut_total || c.brut_toplam || 0);
      let net  = Number(c.net_total  || c.net_toplam  || 0);

      const tryParse = (raw: unknown) => {
        if (!raw) return null;
        try { return typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>; }
        catch { return null; }
      };

      if (!brut) {
        const src = tryParse(c.detay) ?? tryParse(c.data);
        if (src) {
          brut = Number(
            src.brutTazminat ?? src.brutTazminatTutari ?? src.brut_tazminat ??
            src.toplamBrut ?? src.brutTotal ?? src.brut_total ?? 0
          );
          net = Number(
            src.netTazminat ?? src.netTazminatTutari ?? src.net_tazminat ??
            src.toplamNet ?? src.netTotal ?? src.net_total ?? 0
          );
        }
      }

      const dateStr = c.created_at || c.createdAt;
      return {
        id: c.id,
        type: formatTypeName(c.type || c.hesaplama_tipi || "Hesaplama"),
        name: c.name || c.aciklama || c.kayit_adi || "",
        date: dateStr ? new Date(dateStr).toLocaleDateString("tr-TR") : "-",
        brut,
        net,
        data: tryParse(c.data) ?? tryParse(c.detay),
      };
    });
  }
  const recentRows = useMemo(() => buildRecentRows(savedCases), [savedCases]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-sm">Yükleniyor…</span>
        </div>
      </div>
    );
  }

  const progressColor = subscriptionProgressColor(sub.daysRemaining);
  const textColor     = subscriptionTextColor(sub.daysRemaining);

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-3 sm:p-5">

      {/* ── 1. İstatistik Kartları ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Toplam hesaplama */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Toplam Hesaplama</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{num(savedCases.length)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Ortalama süre */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex-shrink-0">
              <Clock className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Ort. Hesaplama Süresi</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{avgSpeed}</p>
            </div>
          </CardContent>
        </Card>

        {/* Son giriş */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
              <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Son Giriş</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{lastLogin}</p>
            </div>
          </CardContent>
        </Card>

        {/* Son kayıt adı */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex-shrink-0">
              <Scale className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Son Kayıt Adı</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{lastRecordName}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Finansal Özet (sadece admin) ───────────────────────────── */}
      {isAdmin && financial && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Finansal Özet</CardTitle>
                <CardDescription className="text-xs">Abonelik ve lisans metrikleri</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[
                { label: "Aktif Abonelik",      value: num(financial.activeSubscriptionCount) },
                { label: "Yıllık Plan",          value: num(financial.annualPlanCount) },
                { label: "Aylık Plan",           value: num(financial.monthlyPlanCount) },
                { label: "Ort. Lisans Süresi",   value: `${num(financial.averageLicenseDurationDays)} gün` },
                { label: "Demo Kullanıcı",       value: num(financial.demoUserCount) },
                { label: "Demo → Satış %",       value: `%${financial.demoToSaleConversionRate.toFixed(1)}` },
                { label: "Son 30 Gün Yeni",      value: num(financial.newSubscriptionsLast30Days) },
                { label: "7 Gün İçinde Dolacak", value: num(financial.licensesExpiringIn7Days), warn: true },
              ].map(({ label, value, warn }) => (
                <div
                  key={label}
                  className={`p-3 rounded-xl border ${
                    warn
                      ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30"
                  }`}
                >
                  <p className={`text-xs mb-0.5 ${warn ? "text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>{label}</p>
                  <p className={`text-base font-bold ${warn ? "text-amber-800 dark:text-amber-300" : "text-gray-900 dark:text-gray-100"}`}>{value}</p>
                </div>
              ))}
              {financial.hasPriceConfig && financial.estimatedMRR != null && (
                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 col-span-2">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-0.5">Tahmini MRR</p>
                  <p className="text-base font-bold text-emerald-800 dark:text-emerald-300">{num(financial.estimatedMRR)} ₺</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 3. Abonelik Durumu ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Abonelik Bilgileri</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    subTypeLabel === "Deneme"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : subTypeLabel.toLowerCase().includes("yıllık")
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : subTypeLabel.toLowerCase().includes("aylık")
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    {subTypeLabel}
                  </span>
                </div>
              </div>
            </div>
            <Badge
              variant={sub.daysRemaining > 0 ? "default" : "destructive"}
              className={sub.daysRemaining > 0
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
                : ""}
            >
              {sub.daysRemaining > 0 ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" />{sub.daysRemaining} gün kaldı</>
              ) : (
                <><AlertCircle className="w-3 h-3 mr-1" />Süresi doldu</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Başlangıç / Bitiş */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 font-medium">Başlangıç Tarihi</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {sub.startDate
                  ? sub.startDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 font-medium">Bitiş Tarihi</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {sub.endDate
                  ? sub.endDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                  : "-"}
              </p>
            </div>
          </div>

          {/* 4 mini istatistik */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Toplam Süre", value: sub.totalDays, unit: "gün", color: "text-gray-900 dark:text-gray-100" },
              { label: "Kullanılan",  value: sub.daysUsed,    unit: "gün", color: "text-blue-600 dark:text-blue-400" },
              { label: "Kalan",       value: sub.daysRemaining, unit: "gün", color: textColor },
              { label: "Kullanım",    value: `%${sub.usedPct.toFixed(1)}`, unit: "tamamlandı", color: "text-indigo-600 dark:text-indigo-400" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="text-center p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400">{unit}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>Abonelik İlerlemesi</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                %{sub.remainingPct.toFixed(1)} kaldı
              </span>
            </div>
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                style={{ width: `${sub.remainingPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {!sub.hasSubscription
                ? "⚠️ Abonelik bilgisi bulunamadı"
                : sub.daysRemaining > 0
                  ? `🎯 ${sub.daysUsed} gün tamamlandı • ${sub.daysRemaining} gün kaldı`
                  : "❌ Aboneliğinizin süresi doldu"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Grafikler ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pasta grafik */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Hesaplama Türlerine Göre Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={({ name }) => name}
                    labelLine
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                  <ReLegend wrapperStyle={{ fontSize: "11px" }} iconSize={9} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                Henüz hesaplama kaydı yok
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar grafik */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Hesaplama Sayısı</CardTitle>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as Period)}
                className="h-7 px-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="haftalik">Haftalık</option>
                <option value="aylik">Aylık</option>
                <option value="yillik">Yıllık</option>
                <option value="tum">Tümü</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -15, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  height={55}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <ReTooltip contentStyle={{ fontSize: "12px" }} cursor={{ fill: "rgba(96,165,250,0.1)" }} />
                <Bar dataKey="Adet" fill="#60A5FA" name="Hesaplama" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Son Hesaplamalar ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Son Kayıtlar</CardTitle>
          <CardDescription className="text-xs">En son yapılan hesaplamaların listesi</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tür</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Kayıt Adı</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Tarih</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Brüt</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Net</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentRows.map((r, i) => (
                    <tr key={r.id ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{r.type}</td>
                      <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">{r.name || "-"}</td>
                      <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">{r.date}</td>
                      <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{r.brut > 0 ? `₺${num(r.brut)}` : "-"}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm hidden sm:table-cell">{r.net > 0 ? `₺${num(r.net)}` : "-"}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setDetailRow(r)}
                          className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              Henüz kayıtlı hesaplama bulunmuyor.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 6. Detay Modal ────────────────────────────────────────────── */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setDetailRow(null)}
        >
          {/* Arka plan */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal kutusu — mobilde bottom sheet, masaüstünde ortalanmış */}
          <div
            className="relative bg-white dark:bg-gray-900 w-full sm:w-[460px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[70vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Başlık */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Kayıt Detayı</h3>
              <button
                onClick={() => setDetailRow(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors text-base"
              >×</button>
            </div>

            {/* İçerik */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {/* Temel bilgiler */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Temel Bilgiler</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">Tür</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{detailRow.type}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Kayıt Adı</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{detailRow.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Tarih</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{detailRow.date}</p>
                  </div>
                </div>
              </div>

              {/* Hesaplama detayları */}
              {detailRow.data && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Hesaplama Detayları</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {(detailRow.data.iseGiris || detailRow.data.ise_giris) && (
                      <div>
                        <span className="text-xs text-gray-500">İşe Giriş</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                          {new Date(String(detailRow.data.iseGiris ?? detailRow.data.ise_giris)).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                    )}
                    {(detailRow.data.istenCikis || detailRow.data.isten_cikis) && (
                      <div>
                        <span className="text-xs text-gray-500">İşten Çıkış</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                          {new Date(String(detailRow.data.istenCikis ?? detailRow.data.isten_cikis)).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                    )}
                    {(detailRow.data.ucret || detailRow.data.brut || detailRow.data.brutUcret) && (
                      <div>
                        <span className="text-xs text-gray-500">Brüt Ücret</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                          {num(Number(detailRow.data.ucret ?? detailRow.data.brut ?? detailRow.data.brutUcret))} ₺
                        </p>
                      </div>
                    )}
                    {(detailRow.data.calismaSuresi || detailRow.data.workPeriod) && (
                      <div>
                        <span className="text-xs text-gray-500">Çalışma Süresi</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                          {String(detailRow.data.calismaSuresi ?? detailRow.data.workPeriod)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sonuçlar */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Sonuçlar</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">Brüt Tutar</span>
                    <p className="font-semibold text-base text-gray-900 dark:text-gray-100 mt-0.5">
                      {detailRow.brut > 0 ? `₺${num(detailRow.brut)}` : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Net Tutar</span>
                    <p className="font-semibold text-base text-green-600 dark:text-green-400 mt-0.5">
                      {detailRow.net > 0 ? `₺${num(detailRow.net)}` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex justify-end">
              <button
                onClick={() => setDetailRow(null)}
                className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
