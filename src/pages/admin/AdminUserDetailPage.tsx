import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/utils/apiClient";
import { getStatusLabel, getModuleTypeLabel, getSubscriptionTypeLabel } from "@/utils/labelMappings";
import {
  ChevronLeft,
  User,
  FileText,
  Ticket,
  Calendar,
  Key,
  Zap,
  Clock3,
  Activity,
  BarChart3,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import DeviceManagerModal from "@/components/modals/DeviceManagerModal";

type TabKey = "genel" | "abonelikLisans" | "kullanim" | "girisCihaz" | "demoTakibi" | "islemGecmisi" | "destek";

interface AuditLogItem {
  id: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  admin: { name: string; email: string } | null;
}

interface UserDetailData {
  user: { id: number; name: string; email: string; phone: string | null; company: string | null; role: string; status: string; createdAt: string };
  subscription: { type: string; startDate: string | null; endDate: string | null; remainingDays: number | null; status: string };
  license: { licenseId: string | null; licenseKey: string; status: string; baslangic: string | null; bitis: string | null; sonGorulme: string | null; sonIP: string | null; supheli: boolean; deviceCount: number; remainingDays: number | null } | null;
  usageStats: { totalCalculations: number; last30DaysCalculations: number; mostUsedModule: { name: string; type: string } | null; lastCalculationDate: string | null };
  loginStats: { totalLogins: number; lastLoginDate: string | null; lastLoginIP: string | null };
  demoOnboarding?: {
    shown: boolean;
    closed: boolean;
    modalSelection: string | null;
    firstCalculationCompleted: boolean;
    firstCalculationType: string | null;
    firstCalculationAt: string | null;
  };
  tickets: Array<{ id: number; subject: string; status: string; priority: string; createdAt: string }>;
  ipLoginHistory: Array<{ ip: string | null; at: string; userAgent?: string | null }>;
}

type MailTemplateKey = "demo" | "license" | "video" | "custom";

const MAIL_TEMPLATES: Record<MailTemplateKey, { label: string; subject: string; message: string }> = {
  demo: {
    label: "Demo Hatırlatma",
    subject: "Demo süreniz ve hızlı başlangıç önerileri",
    message:
      "Merhaba,\n\nDemo hesabınızı daha verimli kullanabilmeniz için hızlı başlangıç adımlarını hatırlatmak istedik.\n\nİyi çalışmalar dileriz.",
  },
  license: {
    label: "Lisans Bitiş Hatırlatma",
    subject: "Lisans süreniz yakında sona eriyor",
    message:
      "Merhaba,\n\nLisans sürenizin yakında sona ereceğini hatırlatmak isteriz. Kesintisiz kullanım için lisansınızı uzatabilirsiniz.\n\nİyi çalışmalar dileriz.",
  },
  video: {
    label: "Kullanım Videosu",
    subject: "Program kullanım videosu",
    message:
      "Merhaba,\n\nProgramı daha hızlı kullanabilmeniz için eğitim videosunu paylaşmak isteriz:\nhttps://www.youtube.com/@bilirkisihesap\n\nİyi çalışmalar dileriz.",
  },
  custom: {
    label: "Özel Mesaj",
    subject: "",
    message: "",
  },
};

const NO_DATA = "Bilgi henüz oluşmadı";
const ACTION_LABELS: Record<string, string> = {
  user_create: "Kullanıcı oluşturma",
  license_extend: "Lisans uzatma",
  subscription_change: "Abonelik değişikliği",
  manual_intervention: "Manuel müdahale",
  tenant_create: "Şirket oluşturma",
  user_status_change: "Kullanıcı durum değişikliği",
  device_slot_added: "Cihaz hakkı eklendi",
  device_removed: "Cihaz kaldırıldı",
  email_sent_to_user: "Kullanıcıya e-posta gönderildi",
  admin_note: "Admin Notu",
};
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : NO_DATA;
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("tr-TR") : NO_DATA);

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("genel");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmType, setConfirmType] = useState<null | "demo3" | "status" | "trial" | "subscription" | "convertPro">(null);
  const [trialDays, setTrialDays] = useState("3");
  const [extendDays, setExtendDays] = useState("30");
  const [convertProType, setConvertProType] = useState<"professional_monthly" | "professional_annual">("professional_monthly");
  const [convertProEndDate, setConvertProEndDate] = useState("");
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailSending, setMailSending] = useState(false);
  const [mailTemplate, setMailTemplate] = useState<MailTemplateKey>("demo");
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState(MAIL_TEMPLATES.demo.subject);
  const [mailMessage, setMailMessage] = useState(MAIL_TEMPLATES.demo.message);
  const [activityLogs, setActivityLogs] = useState<AuditLogItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityReloadKey, setActivityReloadKey] = useState(0);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const selectedUserId = useMemo(() => {
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient(`/api/admin/users/${id}/detail`, { headers: { "x-user-role": "admin" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || "Kullanıcı detayı alınamadı");
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Kullanıcı detayı alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    const loadActivityLogs = async () => {
      if (activeTab !== "islemGecmisi") return;
      if (!selectedUserId) {
        setActivityLogs([]);
        setActivityError(null);
        return;
      }
      setActivityLoading(true);
      setActivityError(null);
      setActivityLogs([]);
      try {
        const params = new URLSearchParams({
          targetType: "user",
          targetId: selectedUserId,
          limit: "50",
        });
        const res = await apiClient(`/api/admin/audit-logs?${params.toString()}`, {
          headers: { "x-user-role": "admin" },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "İşlem geçmişi alınamadı");
        const items = Array.isArray(json?.items) ? (json.items as AuditLogItem[]) : [];
        const strictlyFiltered = items.filter(
          (log) => String(log?.targetType || "").toLowerCase() === "user" && String(log?.targetId || "") === selectedUserId
        );
        setActivityLogs(strictlyFiltered);
      } catch (e) {
        setActivityLogs([]);
        setActivityError(e instanceof Error ? e.message : "İşlem geçmişi alınamadı");
      } finally {
        setActivityLoading(false);
      }
    };
    loadActivityLogs();
  }, [activeTab, selectedUserId, activityReloadKey]);

  const sub = data?.subscription ?? { type: "standard", startDate: null, endDate: null, remainingDays: null, status: "active" };
  const usage = data?.usageStats ?? { totalCalculations: 0, last30DaysCalculations: 0, mostUsedModule: null, lastCalculationDate: null };
  const login = data?.loginStats ?? { totalLogins: 0, lastLoginDate: null, lastLoginIP: null };
  const user = data?.user;
  const license = data?.license;
  const tickets = data?.tickets ?? [];
  const ipLoginHistory = data?.ipLoginHistory ?? [];
  const demo = data?.demoOnboarding;
  const subscriptionType = String(sub.type || "").toLowerCase();
  const isDemoUser = subscriptionType.includes("demo");
  const isProfessionalUser = subscriptionType.includes("professional") || subscriptionType.includes("annual");
  const canManageDevices = !!license?.licenseId;

  const userStatusBadge = useMemo(() => {
    const s = (user?.status || "").toLowerCase();
    if (s === "active") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (s === "suspended") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }, [user?.status]);

  const interventionReasons = useMemo(() => {
    if (!data) return [];
    const reasons: string[] = [];
    const isDemoUser = String(sub.type || "").includes("demo");
    const totalLogins = login.totalLogins ?? 0;
    const totalCalcs = usage.totalCalculations ?? 0;
    const remainingDays = sub.remainingDays ?? null;

    if (isDemoUser && totalLogins === 0) {
      reasons.push("Demo kullanıcısı giriş yapmadı");
    }
    if (totalLogins > 0 && totalCalcs === 0) {
      reasons.push("Giriş yaptı ancak hesaplama yapmadı");
    }
    if (isDemoUser && remainingDays != null && remainingDays > 0 && remainingDays <= 3) {
      reasons.push(`Demo süresi ${remainingDays} gün içinde bitiyor`);
    }
    if (isDemoUser && (remainingDays != null && remainingDays <= 0)) {
      reasons.push("Demo süresi dolmuş");
    }
    if (login.lastLoginDate) {
      const lastLogin = new Date(login.lastLoginDate);
      const diffMs = Date.now() - lastLogin.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 30) {
        reasons.push("Uzun süredir giriş yapmadı");
      }
    }
    if (!isDemoUser && String(user?.status || "").toLowerCase() === "active" && totalCalcs === 0) {
      reasons.push("Aktif kullanıcı ama kullanım yok");
    }
    if (license?.supheli) {
      reasons.push("Şüpheli kullanım işareti var");
    }
    return reasons;
  }, [data, sub.type, sub.remainingDays, login.totalLogins, login.lastLoginDate, usage.totalCalculations, user?.status, license?.supheli]);

  const riskLabel = interventionReasons.length > 0 ? "Müdahale Gerekli" : "Normal";
  const interventionSummary =
    interventionReasons.length > 0 ? interventionReasons.join(" · ") : "Kullanıcıda takip gerektiren bir durum yok.";

  const toggleUserStatus = async () => {
    if (!id || !user) return;
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    setUpdatingStatus(true);
    try {
      const res = await apiClient(`/api/admin/users/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Durum güncellenemedi");
      success(nextStatus === "suspended" ? "Kullanıcı pasife alındı" : "Kullanıcı aktifleştirildi");
      await load();
    } catch {
      toastError("İşlem başarısız", "Kullanıcı durumu güncellenemedi");
    } finally {
      setUpdatingStatus(false);
      setConfirmType(null);
    }
  };

  const openMailModal = () => {
    setMailTo(user?.email || "");
    setMailTemplate("demo");
    setMailSubject(MAIL_TEMPLATES.demo.subject);
    setMailMessage(MAIL_TEMPLATES.demo.message);
    setMailModalOpen(true);
  };

  const applyMailTemplate = (tpl: MailTemplateKey) => {
    setMailTemplate(tpl);
    setMailSubject(MAIL_TEMPLATES[tpl].subject);
    setMailMessage(MAIL_TEMPLATES[tpl].message);
  };

  const sendSingleMail = async () => {
    const to = mailTo.trim();
    if (!to || !to.includes("@")) {
      toastError("Geçersiz e-posta", "Alıcı e-posta adresini kontrol edin");
      return;
    }
    if (!mailSubject.trim() || !mailMessage.trim()) {
      toastError("Eksik alan", "Konu ve mesaj alanları zorunludur");
      return;
    }
    setMailSending(true);
    try {
      const res = await apiClient("/api/email-notifications/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({
          recipientType: "custom",
          customEmails: [to],
          subject: mailSubject.trim(),
          message: mailMessage,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || "Mail gönderimi başarısız");
      }
      success("Mail başarıyla gönderildi");
      setMailModalOpen(false);
    } catch (e: any) {
      toastError("Gönderim başarısız", e?.message || "Mail gönderilemedi");
    } finally {
      setMailSending(false);
    }
  };

  const addDaysToDate = (dateStr: string | null | undefined, days: number) => {
    const base = dateStr ? new Date(dateStr) : new Date();
    const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
    const next = new Date(safeBase);
    next.setDate(next.getDate() + days);
    return next;
  };

  const addDaysFromToday = (days: number) => {
    const today = new Date();
    const next = new Date(today.getTime());
    next.setDate(next.getDate() + days);
    return next.toISOString().split("T")[0];
  };

  const getActivityActionLabel = (action: string) => ACTION_LABELS[action] || action;

  const getActivityDetailSummary = (details: Record<string, unknown> | null) => {
    if (!details || typeof details !== "object") return "Detay yok";

    const keyLabels: Record<string, string> = {
      newExpiresAt: "Yeni bitiş tarihi",
      oldExpiresAt: "Eski bitiş tarihi",
      subscriptionType: "Paket",
      oldStatus: "Eski durum",
      newStatus: "Yeni durum",
      userEmail: "Kullanıcı e-postası",
      userName: "Kullanıcı adı",
      deviceId: "Cihaz ID",
      oldMaxDevices: "Eski cihaz hakkı",
      newMaxDevices: "Yeni cihaz hakkı",
      licenseId: "Lisans ID",
      recipientEmail: "Alıcı e-postası",
      subject: "Konu",
      days: "Gün",
      trialEndsAt: "Trial bitiş tarihi",
      description: "Açıklama",
      note: "Not",
      template: "Şablon",
      recipientType: "Alıcı tipi",
    };

    const packageValueLabels: Record<string, string> = {
      professional_monthly: "Profesyonel Aylık",
      annual: "Yıllık",
      demo: "Deneme",
    };

    const statusValueLabels: Record<string, string> = {
      active: "Aktif",
      suspended: "Pasif",
      deleted: "Silinmiş",
    };

    const isIsoDateString = (value: string) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime());

    const formatValue = (key: string, value: unknown): string => {
      if (value == null) return "";
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return "";
        if (isIsoDateString(trimmed)) return fmtDate(trimmed);
        if (key === "subscriptionType") return packageValueLabels[trimmed] || getSubscriptionTypeLabel(trimmed) || trimmed;
        if (key === "oldStatus" || key === "newStatus") return statusValueLabels[trimmed] || getStatusLabel(trimmed);
        return trimmed;
      }
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return "";
    };

    const preferredOrder = [
      "description",
      "note",
      "newExpiresAt",
      "oldExpiresAt",
      "subscriptionType",
      "trialEndsAt",
      "days",
      "oldStatus",
      "newStatus",
      "userEmail",
      "deviceId",
      "oldMaxDevices",
      "newMaxDevices",
      "licenseId",
      "recipientEmail",
      "subject",
      "template",
      "recipientType",
    ];

    const items = preferredOrder
      .filter((key) => details[key] !== undefined && details[key] !== null)
      .map((key) => {
        const formatted = formatValue(key, details[key]);
        if (!formatted) return "";
        const label = keyLabels[key] || key;
        if (key === "description") return formatted;
        return `${label}: ${formatted}`;
      })
      .filter(Boolean);

    return items.length > 0 ? items.join(" · ") : "Detay yok";
  };

  const saveAdminNote = async () => {
    if (!selectedUserId || !user) return;
    const note = noteText.trim();
    if (!note) {
      toastError("Eksik alan", "Not metni boş bırakılamaz");
      return;
    }
    setNoteSaving(true);
    try {
      const res = await apiClient(`/api/admin/users/${selectedUserId}/notes`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || "Admin notu kaydedilemedi");
      }
      success("Admin notu kaydedildi");
      setNoteText("");
      setNoteModalOpen(false);
      setActivityReloadKey((v) => v + 1);
    } catch (e: any) {
      toastError("İşlem başarısız", e?.message || "Admin notu kaydedilemedi");
    } finally {
      setNoteSaving(false);
    }
  };

  const runDemoPlus3 = async () => {
    if (!user?.id || !id) return;
    const oldEnd = sub.endDate;
    const nextEnd = addDaysToDate(oldEnd, 3);
    setActionBusy("demo3");
    try {
      const res = await apiClient(`/api/admin/users/${id}/subscription`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionType: sub.type || "standard",
          subscriptionEndsAt: nextEnd.toISOString(),
        }),
      });
      const body = await res.json().catch(() => null);
      const newEnd = body?.subscriptionEndsAt ? String(body.subscriptionEndsAt) : null;
      if (!res.ok || !newEnd) throw new Error("Demo uzatma başarısız");
      const oldText = fmtDate(oldEnd);
      const newText = fmtDate(newEnd);
      success(`+3 gün uygulandı: ${oldText} -> ${newText}`);
      await load();
    } catch {
      toastError("İşlem başarısız", "Demo süresi uzatılamadı");
    } finally {
      setActionBusy(null);
      setConfirmType(null);
    }
  };

  const runAddTrial = async () => {
    if (!id) return;
    const days = Number(trialDays);
    if (!Number.isFinite(days) || days < 1) {
      toastError("Geçersiz gün", "Trial gün değeri 1 veya daha büyük olmalı");
      return;
    }
    setActionBusy("trial");
    try {
      const res = await apiClient(`/api/admin/users/${id}/trial`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const body = await res.json().catch(() => null);
      const newTrialEnd = body?.trialEndsAt ? String(body.trialEndsAt) : null;
      if (!res.ok || !newTrialEnd) throw new Error("Trial eklenemedi");
      success(`Trial süresi eklendi: yeni deneme bitişi ${fmtDate(newTrialEnd)}`);
      await load();
    } catch {
      toastError("İşlem başarısız", "Trial gün eklenemedi");
    } finally {
      setActionBusy(null);
      setConfirmType(null);
    }
  };

  const runExtendSubscription = async () => {
    if (!id) return;
    const days = Number(extendDays);
    if (!Number.isFinite(days) || days < 1) {
      toastError("Geçersiz gün", "Lisans uzatma gün değeri 1 veya daha büyük olmalı");
      return;
    }
    const oldEnd = sub.endDate;
    const base = oldEnd ? new Date(oldEnd) : new Date();
    const nextEnd = new Date(base.getTime());
    if (base < new Date()) nextEnd.setTime(Date.now());
    nextEnd.setDate(nextEnd.getDate() + days);
    setActionBusy("subscription");
    try {
      const res = await apiClient(`/api/admin/users/${id}/subscription`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionType: sub.type || "standard",
          subscriptionEndsAt: nextEnd.toISOString(),
        }),
      });
      const body = await res.json().catch(() => null);
      const newEnd = body?.subscriptionEndsAt ? String(body.subscriptionEndsAt) : null;
      if (!res.ok || !newEnd) throw new Error("Lisans uzatılamadı");
      success(`Lisans uzatıldı: ${fmtDate(oldEnd)} -> ${fmtDate(newEnd)}`);
      await load();
    } catch {
      toastError("İşlem başarısız", "Lisans uzatma başarısız");
    } finally {
      setActionBusy(null);
      setConfirmType(null);
    }
  };

  const openConvertProModal = () => {
    setConvertProType("professional_monthly");
    setConvertProEndDate(addDaysFromToday(30));
    setConfirmType("convertPro");
  };

  const runConvertToProfessional = async () => {
    if (!id || !user) return;
    if (!convertProEndDate) {
      toastError("Eksik alan", "Bitiş tarihi zorunludur");
      return;
    }
    setActionBusy("convertPro");
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(convertProEndDate);
      end.setHours(23, 59, 59, 999);

      const res = await apiClient(`/api/admin/users/${id}/subscription`, {
        method: "POST",
        headers: { "x-user-role": "admin", "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionType: convertProType,
          subscriptionStartsAt: start.toISOString(),
          subscriptionEndsAt: end.toISOString(),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.subscriptionType) throw new Error(body?.error || "Profesyonel dönüşüm başarısız");
      success(`Kullanıcı profesyonel pakete geçirildi: ${getSubscriptionTypeLabel(convertProType)}`);
      await load();
      setConfirmType(null);
    } catch (e: any) {
      toastError("İşlem başarısız", e?.message || "Profesyonel dönüşüm başarısız");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="w-full px-4 py-5 md:px-6 md:py-7 space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data || !user) {
    return (
      <div className="w-full px-4 py-5 md:px-6 md:py-7 space-y-4">
        <Link to="/admin/users"><Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-red-700 dark:text-red-300 font-medium">{error || "Kullanıcı detayı yüklenemedi"}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3">Tekrar dene</Button>
        </div>
      </div>
    );
  }

  const topCards = [
    {
      title: "Abonelik",
      value: getSubscriptionTypeLabel(sub.type),
      subValue: sub.remainingDays != null ? `${Math.max(0, sub.remainingDays)} gün kaldı` : NO_DATA,
      icon: Calendar,
    },
    {
      title: "Lisans / Cihaz",
      value: license ? getStatusLabel(license.status) : "Lisans yok",
      subValue: license ? `${license.deviceCount} cihaz kayıtlı` : NO_DATA,
      icon: Key,
    },
    {
      title: "Kullanım",
      value: `${usage.totalCalculations} hesaplama`,
      subValue: `Son 30 gün: ${usage.last30DaysCalculations}`,
      icon: BarChart3,
    },
    {
      title: "Giriş",
      value: `${login.totalLogins} giriş`,
      subValue: `Son giriş: ${fmtDateTime(login.lastLoginDate)}`,
      icon: Activity,
    },
  ];

  return (
    <div className="w-full px-4 py-5 md:px-6 md:py-7 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Link to="/admin/users"><Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
          <div className="space-y-1">
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <User className="h-5 w-5" />
              {user.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${userStatusBadge}`}>
                {getStatusLabel(user.status)}
              </span>
              <Badge variant="outline">{getSubscriptionTypeLabel(sub.type)}</Badge>
              <Badge variant="outline">{sub.remainingDays != null ? `${Math.max(0, sub.remainingDays)} gün` : NO_DATA}</Badge>
              <Badge variant="outline">Son giriş: {fmtDateTime(login.lastLoginDate)}</Badge>
              <Badge
                variant="outline"
                title={interventionSummary}
                className={riskLabel === "Müdahale Gerekli" ? "border-rose-300 text-rose-600" : ""}
              >
                {riskLabel}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {topCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.title}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{item.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.subValue}</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800/80">
                    <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-base">Hızlı İşlemler</CardTitle>
          <CardDescription>Mevcut çalışan admin işlemlerini bu kullanıcı için tek yerden çalıştır.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isDemoUser && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmType("demo3")}
                disabled={actionBusy != null}
                title="Bu işlem yalnızca deneme kullanıcıları için kullanılabilir."
              >
                +3 Gün Ver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmType("trial")}
                disabled={actionBusy != null}
                title="Bu işlem yalnızca deneme kullanıcıları için kullanılabilir."
              >
                Trial Süresi Ekle
              </Button>
              <Button size="sm" variant="outline" onClick={openConvertProModal} disabled={actionBusy != null}>
                Profesyonel'e Çevir
              </Button>
              {canManageDevices && (
                <Button size="sm" variant="outline" onClick={() => setDeviceModalOpen(true)} disabled={actionBusy != null}>
                  Cihazları Yönet
                </Button>
              )}
            </>
          )}
          {isProfessionalUser && (
            <>
              <Button size="sm" variant="outline" onClick={() => setConfirmType("subscription")} disabled={actionBusy != null}>
                Lisans Uzat
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeviceModalOpen(true)} disabled={actionBusy != null}>
                Cihazları Yönet
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={openMailModal} disabled={actionBusy != null}>
            Mail Gönder
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNoteModalOpen(true)} disabled={actionBusy != null}>
            Admin Notu Ekle
          </Button>
          <Button size="sm" variant="outline" className="border-rose-200 text-rose-600" onClick={() => setConfirmType("status")} disabled={actionBusy != null}>
            {user.status === "suspended" ? "Aktife Al" : "Pasife Al"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { key: "genel" as TabKey, label: "Genel", icon: User },
          { key: "abonelikLisans" as TabKey, label: "Abonelik & Lisans", icon: ShieldCheck },
          { key: "kullanim" as TabKey, label: "Kullanım Geçmişi", icon: FileText },
          { key: "girisCihaz" as TabKey, label: "Giriş & Cihaz", icon: Key },
          { key: "demoTakibi" as TabKey, label: "Demo Takibi", icon: Zap },
          { key: "islemGecmisi" as TabKey, label: "İşlem Geçmişi", icon: Clock3 },
          { key: "destek" as TabKey, label: "Destek Talepleri", icon: Ticket },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "genel" && (
        <Card className="border-slate-200/80 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base">Genel Özet</CardTitle>
            <CardDescription>Kullanıcı kim, ne kadar aktif, müdahale gerekiyor mu?</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500">Ad Soyad</p><p className="font-medium">{user.name}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500">E-posta</p><p className="font-medium">{user.email}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500">Şirket</p><p className="font-medium">{user.company || NO_DATA}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500">Durum</p><p className="font-medium">{getStatusLabel(user.status)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500">Abonelik</p><p className="font-medium">{getSubscriptionTypeLabel(sub.type)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500">Müdahale durumu</p>
              <p className={`font-medium ${riskLabel === "Müdahale Gerekli" ? "text-rose-600" : ""}`}>{riskLabel}</p>
              {interventionReasons.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                  {interventionReasons.slice(0, 3).map((reason, idx) => (
                    <li key={`${reason}-${idx}`}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Kullanıcıda takip gerektiren bir durum yok.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "abonelikLisans" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Abonelik</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-slate-500">Tip:</span> {getSubscriptionTypeLabel(sub.type)}</p>
              <p><span className="text-slate-500">Durum:</span> {sub.status === "active" ? "Aktif" : "Süresi dolmuş"}</p>
              <p><span className="text-slate-500">Başlangıç:</span> {fmtDate(sub.startDate)}</p>
              <p><span className="text-slate-500">Bitiş:</span> {fmtDate(sub.endDate)}</p>
              <p><span className="text-slate-500">Kalan gün:</span> {sub.remainingDays != null ? Math.max(0, sub.remainingDays) : NO_DATA}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Lisans</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {license ? (
                <>
                  <p className="font-mono text-xs break-all">{license.licenseKey}</p>
                  <p><span className="text-slate-500">Durum:</span> {getStatusLabel(license.status)}</p>
                  <p><span className="text-slate-500">Bitiş:</span> {fmtDate(license.bitis)}</p>
                  <p><span className="text-slate-500">Kalan gün:</span> {license.remainingDays != null ? Math.max(0, license.remainingDays) : NO_DATA}</p>
                  <p><span className="text-slate-500">Cihaz:</span> {license.deviceCount}</p>
                  <p><span className="text-slate-500">Son görülme:</span> {fmtDateTime(license.sonGorulme)}</p>
                  <p><span className="text-slate-500">Son IP:</span> {license.sonIP ?? NO_DATA}</p>
                  {license.supheli && <Badge variant="outline" className="border-rose-300 text-rose-600">Şüpheli kullanım işareti var</Badge>}
                </>
              ) : (
                <p className="text-slate-500">Bu kullanıcı için aktif lisans kaydı bulunmuyor.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "kullanim" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Kullanım Geçmişi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Toplam hesaplama</p><p className="font-semibold">{usage.totalCalculations}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Son 30 gün</p><p className="font-semibold">{usage.last30DaysCalculations}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">En çok kullanılan modül</p><p className="font-semibold">{usage.mostUsedModule ? getModuleTypeLabel(usage.mostUsedModule.type) || usage.mostUsedModule.name : NO_DATA}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Son hesaplama</p><p className="font-semibold">{fmtDateTime(usage.lastCalculationDate)}</p></div>
          </CardContent>
        </Card>
      )}

      {activeTab === "girisCihaz" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Giriş Özeti</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Toplam giriş</p><p className="font-semibold">{login.totalLogins}</p></div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Son giriş</p><p className="font-semibold">{fmtDateTime(login.lastLoginDate)}</p></div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Son IP</p><p className="font-semibold">{login.lastLoginIP || NO_DATA}</p></div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Lisans cihaz</p><p className="font-semibold">{license?.deviceCount ?? 0}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">IP Giriş Geçmişi</CardTitle></CardHeader>
            <CardContent>
              {ipLoginHistory.length === 0 ? (
                <p className="text-sm text-slate-500">Bu kullanıcı için henüz IP giriş geçmişi oluşmamış.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2">IP</th>
                        <th className="text-left px-3 py-2">Tarih</th>
                        <th className="text-left px-3 py-2">User Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ipLoginHistory.slice(0, 20).map((h, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                          <td className="px-3 py-2">{h.ip || NO_DATA}</td>
                          <td className="px-3 py-2">{fmtDateTime(h.at)}</td>
                          <td className="px-3 py-2 truncate max-w-[420px]">{h.userAgent || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "demoTakibi" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Demo Hızlı Başlangıç Takibi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Modal gösterildi mi?</p><p className="font-semibold">{demo?.shown ? "Evet" : "Hayır"}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Modal kapatıldı mı?</p><p className="font-semibold">{demo?.closed ? "Evet" : "Hayır"}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">Modal seçimi</p><p className="font-semibold">{demo?.modalSelection || NO_DATA}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">İlk hesaplama yapıldı mı?</p><p className="font-semibold">{demo?.firstCalculationCompleted ? "Evet" : "Hayır"}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">İlk hesaplama türü</p><p className="font-semibold">{demo?.firstCalculationType || NO_DATA}</p></div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><p className="text-slate-500">İlk hesaplama tarihi</p><p className="font-semibold">{fmtDateTime(demo?.firstCalculationAt)}</p></div>
          </CardContent>
        </Card>
      )}

      {activeTab === "islemGecmisi" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">İşlem Geçmişi</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setNoteModalOpen(true)}>
                Admin Notu Ekle
              </Button>
            </div>
            <CardDescription>Bu kullanıcıya ait admin işlemlerinin son 50 kaydı</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((n) => (
                  <Skeleton key={n} className="h-10 w-full" />
                ))}
              </div>
            ) : activityError ? (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
                {activityError}
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                Bu kullanıcı için henüz işlem kaydı bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Tarih/Saat</th>
                      <th className="text-left px-3 py-2">İşlem</th>
                      <th className="text-left px-3 py-2">Açıklama</th>
                      <th className="text-left px-3 py-2">Admin</th>
                      <th className="text-left px-3 py-2">Detay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                        <td className="px-3 py-2">{getActivityActionLabel(log.action)}</td>
                        <td className="px-3 py-2">{typeof log.details?.description === "string" ? log.details.description : getActivityActionLabel(log.action)}</td>
                        <td className="px-3 py-2">{log.admin ? `${log.admin.name} (${log.admin.email})` : "-"}</td>
                        <td className="px-3 py-2 max-w-[420px] truncate">{getActivityDetailSummary(log.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "destek" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Destek Talepleri</CardTitle></CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                Bu kullanıcıya ait destek talebi bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-3 py-2">Konu</th>
                      <th className="text-left px-3 py-2">Durum</th>
                      <th className="text-left px-3 py-2">Öncelik</th>
                      <th className="text-left px-3 py-2">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                        <td className="px-3 py-2">{t.subject}</td>
                        <td className="px-3 py-2">{getStatusLabel(t.status)}</td>
                        <td className="px-3 py-2">{t.priority}</td>
                        <td className="px-3 py-2">{fmtDateTime(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmType === "demo3"} onOpenChange={(o) => !o && setConfirmType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Demo +3 Gün</DialogTitle>
            <DialogDescription>
              Bu işlem görünen abonelik bitiş tarihini +3 gün uzatır.
              <br />
              Mevcut: <strong>{fmtDate(sub.endDate)}</strong>
              <br />
              Yeni: <strong>{fmtDate(addDaysToDate(sub.endDate, 3).toISOString())}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmType(null)} disabled={actionBusy === "demo3"}>İptal</Button>
            <Button size="sm" onClick={runDemoPlus3} disabled={actionBusy === "demo3"}>
              {actionBusy === "demo3" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmType === "trial"} onOpenChange={(o) => !o && setConfirmType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Trial Gün Ekle</DialogTitle>
            <DialogDescription>Mevcut endpoint ile kullanıcıya trial günü eklenir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="trial-days">Gün</Label>
            <Input id="trial-days" type="number" min={1} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmType(null)} disabled={actionBusy === "trial"}>İptal</Button>
            <Button size="sm" onClick={runAddTrial} disabled={actionBusy === "trial"}>
              {actionBusy === "trial" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmType === "subscription"} onOpenChange={(o) => !o && setConfirmType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Lisans Uzat</DialogTitle>
            <DialogDescription>Abonelik bitiş tarihi mevcut endpoint ile ileri alınır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="extend-days">Kaç gün?</Label>
            <Input id="extend-days" type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmType(null)} disabled={actionBusy === "subscription"}>İptal</Button>
            <Button size="sm" onClick={runExtendSubscription} disabled={actionBusy === "subscription"}>
              {actionBusy === "subscription" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmType === "convertPro"} onOpenChange={(o) => !o && setConfirmType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Profesyonel'e Çevir</DialogTitle>
            <DialogDescription>Deneme hesabını profesyonel pakete geçirin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-1">
              <p><span className="text-slate-500">Kullanıcı:</span> {user?.name || NO_DATA}</p>
              <p><span className="text-slate-500">E-posta:</span> {user?.email || NO_DATA}</p>
              <p><span className="text-slate-500">Mevcut paket:</span> Deneme</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="convert-pro-type">Geçilecek paket</Label>
              <select
                id="convert-pro-type"
                value={convertProType}
                onChange={(e) => {
                  const nextType = e.target.value as "professional_monthly" | "professional_annual";
                  setConvertProType(nextType);
                  setConvertProEndDate(addDaysFromToday(nextType === "professional_monthly" ? 30 : 365));
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="professional_monthly">Profesyonel Aylık</option>
                <option value="professional_annual">Profesyonel Yıllık</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Başlangıç tarihi</Label>
                <Input value={new Date().toISOString().split("T")[0]} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="convert-pro-end-date">Bitiş tarihi</Label>
                <Input
                  id="convert-pro-end-date"
                  type="date"
                  value={convertProEndDate}
                  onChange={(e) => setConvertProEndDate(e.target.value)}
                />
              </div>
            </div>
            <p><span className="text-slate-500">Cihaz hakkı:</span> 1 cihaz</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmType(null)} disabled={actionBusy === "convertPro"}>İptal</Button>
            <Button size="sm" onClick={runConvertToProfessional} disabled={actionBusy === "convertPro"}>
              {actionBusy === "convertPro" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmType === "status"} onOpenChange={(o) => !o && setConfirmType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{user.status === "suspended" ? "Kullanıcıyı Aktifleştir" : "Kullanıcıyı Pasife Al"}</DialogTitle>
            <DialogDescription>
              Bu işlem mevcut kullanıcı durum endpointi ile gerçekleştirilecek.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmType(null)} disabled={updatingStatus}>İptal</Button>
            <Button size="sm" onClick={toggleUserStatus} disabled={updatingStatus}>
              {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mailModalOpen} onOpenChange={(o) => !o && !mailSending && setMailModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mail Gönder</DialogTitle>
            <DialogDescription>Seçili kullanıcıya mevcut mail endpointi ile tekil gönderim yapılır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mail-to">Alıcı e-posta</Label>
              <Input id="mail-to" value={mailTo} onChange={(e) => setMailTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-template">Şablon</Label>
              <select
                id="mail-template"
                value={mailTemplate}
                onChange={(e) => applyMailTemplate(e.target.value as MailTemplateKey)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="demo">{MAIL_TEMPLATES.demo.label}</option>
                <option value="license">{MAIL_TEMPLATES.license.label}</option>
                <option value="video">{MAIL_TEMPLATES.video.label}</option>
                <option value="custom">{MAIL_TEMPLATES.custom.label}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-subject">Konu</Label>
              <Input id="mail-subject" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-message">Mesaj</Label>
              <Textarea id="mail-message" rows={8} value={mailMessage} onChange={(e) => setMailMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMailModalOpen(false)} disabled={mailSending}>İptal</Button>
            <Button size="sm" onClick={sendSingleMail} disabled={mailSending}>
              {mailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gönder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={noteModalOpen}
        onOpenChange={(o) => {
          if (!o && !noteSaving) {
            setNoteModalOpen(false);
            setNoteText("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Admin Notu Ekle</DialogTitle>
            <DialogDescription>Bu not sadece seçili kullanıcı için işlem geçmişine kaydedilir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
              <p><span className="text-slate-500">Kullanıcı:</span> {user?.name || NO_DATA}</p>
              <p><span className="text-slate-500">E-posta:</span> {user?.email || NO_DATA}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-note-text">Not metni</Label>
              <Textarea
                id="admin-note-text"
                rows={6}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Örn: Telefonla görüştük. 1 ay sonra yıllık pakete geçeceğini söyledi."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNoteModalOpen(false);
                setNoteText("");
              }}
              disabled={noteSaving}
            >
              İptal
            </Button>
            <Button size="sm" onClick={saveAdminNote} disabled={noteSaving}>
              {noteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Notu Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deviceModalOpen && license?.licenseId ? (
        <DeviceManagerModal
          licenseId={license.licenseId}
          licenseKey={license.licenseKey}
          onClose={() => setDeviceModalOpen(false)}
          onDeviceUpdate={load}
        />
      ) : null}

      <Dialog open={deviceModalOpen && !license?.licenseId} onOpenChange={(o) => !o && setDeviceModalOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cihaz Yönetimi</DialogTitle>
            <DialogDescription>
              Bu kullanıcıya ait aktif lisans bulunamadığı için cihaz yönetimi yapılamıyor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setDeviceModalOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
