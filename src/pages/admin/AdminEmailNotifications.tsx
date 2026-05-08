import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/context/ToastContext";
import { Mail, Send, Users, Clock, CheckCircle, XCircle, ListX, RotateCcw, Image, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/utils/apiClient";

type BarAssociation = {
  id: number;
  name: string;
  city: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  kepEmail: string | null;
  discountRate: number;
  campaignCode: string | null;
  offerToken: string;
  status: "ACTIVE" | "PASSIVE";
  protocolFiles?: Array<{
    id: number;
    originalFileName: string;
    extension: string;
    sizeBytes: number;
    createdAt: string;
    fileUrl?: string | null;
  }>;
};

type BaroTracking = {
  id: number;
  recipientEmail: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED";
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  contractDownloadedAt: string | null;
  errorMessage: string | null;
  barAssociation: { id: number; name: string; city: string | null } | null;
};

function normalizeImageUrl(value: string): string {
  if (!value) return "";
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/")) return v;
  return `/${v}`;
}

export default function AdminEmailNotifications() {
  const [searchParams] = useSearchParams();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [bars, setBars] = useState<BarAssociation[]>([]);
  const [barSearch, setBarSearch] = useState("");
  const [barSelectionMode, setBarSelectionMode] = useState<"all" | "selected">("all");
  const [selectedBarIds, setSelectedBarIds] = useState<number[]>([]);
  const [includeSecondaryEmail, setIncludeSecondaryEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [trackingSummary, setTrackingSummary] = useState<any>(null);
  const [trackingRows, setTrackingRows] = useState<BaroTracking[]>([]);
  const [selectedTrackingIds, setSelectedTrackingIds] = useState<number[]>([]);
  const [currentTrackingPage, setCurrentTrackingPage] = useState(1);
  const [trackingPageSize, setTrackingPageSize] = useState(10);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingSearch, setTrackingSearch] = useState("");
  const [trackingEventsOpen, setTrackingEventsOpen] = useState(false);
  const [trackingEvents, setTrackingEvents] = useState<any[]>([]);
  const [trackingEventsTitle, setTrackingEventsTitle] = useState("");
  const [protocolUploadFile, setProtocolUploadFile] = useState<File | null>(null);
  const [protocolUploading, setProtocolUploading] = useState(false);
  const [applySameProtocolToAll, setApplySameProtocolToAll] = useState(false);
  const [protocolWarningState, setProtocolWarningState] = useState<{ open: boolean; missing: string[] }>({ open: false, missing: [] });

  const [formData, setFormData] = useState({
    recipientType: "all",
    customEmails: "",
    subject: "",
    message: "",
    logoUrl: "",
    headerImageUrl: "",
    demoUsername: "",
    demoPassword: "",
    demoLicenseKey: "",
    demoLicenseType: "1 Aylık Ücretsiz Deneme",
    demoLicenseExpiresAt: "",
    demoLoginUrl: "https://panel.bilirkisihesap.com/login",
    demoVideoUrl: "https://www.youtube.com/@bilirkisihesap",
  });
  const [sendResult, setSendResult] = useState<any>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [logoPreviewError, setLogoPreviewError] = useState<string | null>(null);
  const [headerPreviewError, setHeaderPreviewError] = useState<string | null>(null);
  const [unsubscribes, setUnsubscribes] = useState<{ id: number; email: string; unsubscribedAt: string; source: string | null }[]>([]);
  const [unsubscribesLoading, setUnsubscribesLoading] = useState(false);
  const [blacklistedEmails, setBlacklistedEmails] = useState<string[]>([]);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email")?.trim();
    if (!emailFromQuery) return;
    setFormData((prev) => ({
      ...prev,
      recipientType: "custom",
      customEmails: emailFromQuery,
    }));
    setTestEmail(emailFromQuery);
  }, [searchParams]);

  const recipientTypes = [
    { value: "all", label: "Tüm Kullanıcılar", icon: Users },
    { value: "active", label: "Aktif Aboneler", icon: CheckCircle },
    { value: "trial", label: "Deneme Kullanıcıları", icon: Clock },
    { value: "expired", label: "Süresi Dolmuş Kullanıcılar", icon: XCircle },
    { value: "custom", label: "Özel Email Listesi", icon: Mail },
    { value: "bar_associations", label: "Barolar", icon: Mail },
  ];

  const templates = [
    { name: "Yeni Özellik Duyurusu", subject: "Yeni Özellikler Eklendi", message: "Sistemimize yeni özellikler ekledik." },
    { name: "Sistem Bakımı", subject: "Planlı Sistem Bakımı", message: "Sistemimiz [TARIH] tarihinde bakıma girecektir." },
    {
      name: "Barolara Özel Teklif",
      templateId: "baro",
      recipientType: "bar_associations",
      subject: "Baro Üyelerinize Özel Bilirkişi Hesaplama Programı Teklifi",
      message: `Sayın {{baro_adi}},

Woontegra Teknoloji Yazılım ve Dijital Hizmetler Ltd. Şti. olarak, avukatların işçilik alacakları hesaplamalarını daha hızlı, düzenli ve pratik şekilde yapabilmeleri için geliştirdiğimiz Bilirkişi Hesaplama Programı’nı baro üyelerinize özel avantajlı koşullarla sunmak isteriz.

Bu kapsamda {{baro_adi}} üyelerine özel %{{indirim_orani}} indirim tanımlanmıştır.

Üyeleriniz aşağıdaki bağlantı üzerinden özel teklif sayfasına ulaşabilir:
{{teklif_linki}}

Sözleşme/protokol önizleme bağlantısı:
{{sozlesme_linki}}

Sözleşme indirme bağlantısı:
{{sozlesme_indirme_linki}}

Dilerseniz iş birliği ve üye avantaj protokolü taslağını da tarafınıza iletebiliriz.

Saygılarımızla,
Woontegra Teknoloji Yazılım ve Dijital Hizmetler Ltd. Şti.

{{open_tracking_pixel}}`,
    },
  ];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parseCustomEmails = (text: string) => {
    const raw = text.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const unique = [...new Set(raw)];
    const valid: string[] = [];
    const invalid: string[] = [];
    unique.forEach((e) => (emailRegex.test(e) ? valid.push(e) : invalid.push(e)));
    return { total: unique.length, valid, invalid };
  };

  const customParsed = useMemo(() => {
    if (formData.recipientType !== "custom" || !formData.customEmails.trim()) return null;
    return parseCustomEmails(formData.customEmails);
  }, [formData.recipientType, formData.customEmails]);

  const loadBars = useCallback(async () => {
    try {
      const res = await apiClient("/api/admin/bar-associations?status=ACTIVE");
      const data = await res.json();
      if (res.ok && data.success) setBars(data.items || []);
    } catch {
      setBars([]);
    }
  }, []);

  const loadTracking = useCallback(async () => {
    setTrackingLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        apiClient("/api/admin/baro-email-trackings/summary"),
        apiClient(`/api/admin/baro-email-trackings${trackingSearch ? `?search=${encodeURIComponent(trackingSearch)}` : ""}`),
      ]);
      const summaryData = await summaryRes.json();
      const listData = await listRes.json();
      if (summaryRes.ok && summaryData.success) setTrackingSummary(summaryData.summary);
      if (listRes.ok && listData.success) {
        const items = listData.items || [];
        setTrackingRows(items);
        setSelectedTrackingIds((prev) => prev.filter((id) => items.some((x: BaroTracking) => x.id === id)));
        setCurrentTrackingPage(1);
      }
    } catch {
      setTrackingRows([]);
      setSelectedTrackingIds([]);
      setCurrentTrackingPage(1);
    } finally {
      setTrackingLoading(false);
    }
  }, [trackingSearch]);

  useEffect(() => {
    loadBars();
  }, [loadBars]);

  useEffect(() => {
    loadTracking();
  }, [loadTracking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject || !formData.message) {
      error("Konu ve mesaj alanlarını doldurun");
      return;
    }

    if (formData.recipientType === "custom" && !formData.customEmails) {
      error("Özel email listesi için en az bir email adresi girin");
      return;
    }

    if (formData.recipientType === "bar_associations" && bars.length === 0) {
      error("Gönderim için aktif baro bulunamadı");
      return;
    }
    setIsPreviewOpen(true);
  };

  const submitConfirmed = async (options?: { allowWithoutProtocol?: boolean }) => {
    setLoading(true);
    setSendResult(null);

    try {
      const requestBody: any = {
        recipientType: formData.recipientType,
        subject: formData.subject,
        message: formData.message,
        logoUrl: formData.logoUrl,
        headerImageUrl: formData.headerImageUrl,
        includeSecondaryEmail,
        barSelectionMode,
        barAssociationIds: selectedBarIds,
        ...(appliedTemplateId && { template: appliedTemplateId }),
        allowWithoutProtocol: Boolean(options?.allowWithoutProtocol),
      };
      if (formData.recipientType === "bar_associations") {
        requestBody.demoAccess = {
          username: formData.demoUsername,
          password: formData.demoPassword,
          license_key: formData.demoLicenseKey,
          license_type: formData.demoLicenseType,
          license_expires_at: formData.demoLicenseExpiresAt,
          login_url: formData.demoLoginUrl,
          video_url: formData.demoVideoUrl,
        };
      }

      // Parse custom emails: dedupe, valid only
      if (formData.recipientType === "custom") {
        const parsed = parseCustomEmails(formData.customEmails);
        if (parsed.valid.length === 0) {
          error("Geçerli email adresi bulunamadı");
          setLoading(false);
          return;
        }
        requestBody.customEmails = parsed.valid;
      }

      if (formData.recipientType === "bar_associations" && barSelectionMode === "selected") {
        requestBody.barAssociationIds = selectedBarIds;
      }

      const response = await apiClient("/api/email-notifications/send-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      let data: { results?: { sent?: number; total?: number }; error?: string } = {};
      try {
        const text = await response.text();
        if (text) data = JSON.parse(text);
      } catch (_) {
        if (!response.ok) throw new Error("Sunucu yanıtı işlenemedi.");
      }

      if (!response.ok) {
        if ((data as any)?.code === "MISSING_PROTOCOL_FILES") {
          setProtocolWarningState({ open: true, missing: (data as any).missingProtocolBarNames || [] });
          return;
        }
        throw new Error(data.error || "Email gönderilemedi");
      }

      const results = data.results ?? { sent: 0, total: 0 };
      setSendResult(results);
      setIsPreviewOpen(false);
      success(
        results.total != null && results.sent != null
          ? `Email başarıyla gönderildi: ${results.sent}/${results.total}`
          : "Email başarıyla gönderildi."
      );
      setAppliedTemplateId(null);
      setFormData((prev) => ({
        ...prev,
        recipientType: "all",
        customEmails: "",
        subject: "",
        message: "",
      }));
    } catch (err: any) {
      console.error("Email gönderme hatası:", err);
      error(err?.message || "Email gönderilirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const uploadProtocolForBars = async () => {
    try {
      if (!protocolUploadFile) {
        error("Lütfen protokol dosyası seçin");
        return;
      }
      const ext = `.${(protocolUploadFile.name.split(".").pop() || "").toLowerCase()}`;
      if (![".pdf", ".docx", ".udf"].includes(ext)) {
        error("Sadece .pdf, .docx, .udf dosyaları yüklenebilir");
        return;
      }
      const targetBars = barSelectionMode === "selected" ? selectedBars : bars;
      if (targetBars.length === 0) {
        error("Önce baro seçin");
        return;
      }
      if (targetBars.length > 1 && !applySameProtocolToAll) {
        error("Birden fazla baro seçildi. Aynı dosyayı göndermek için onay kutusunu işaretleyin.");
        return;
      }
      setProtocolUploading(true);
      const ids = targetBars.length > 1 ? targetBars.map((b) => b.id) : [targetBars[0].id];
      for (const id of ids) {
        const fd = new FormData();
        fd.append("file", protocolUploadFile);
        const res = await apiClient(`/api/admin/bar-associations/${id}/protocol-file`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `Baro #${id} için yükleme başarısız`);
      }
      success(ids.length > 1 ? "Dosya seçili barolara yüklendi" : "Dosya baro için yüklendi");
      setProtocolUploadFile(null);
      loadBars();
    } catch (e: any) {
      error(e?.message || "Protokol dosyası yüklenemedi");
    } finally {
      setProtocolUploading(false);
    }
  };

  const loadUnsubscribes = useCallback(async () => {
    setUnsubscribesLoading(true);
    try {
      const res = await apiClient("/api/email-notifications/unsubscribes");
      const data = await res.json();
      // Backend { success: true, list: [...] }; bazen list/data/unsubscribes veya snake_case alanlar gelir
      const rawList = data.list ?? data.data ?? data.unsubscribes;
      const arr = Array.isArray(rawList) ? rawList : [];
      const list = arr.map((u: { id: number; email: string; unsubscribedAt?: string; unsubscribed_at?: string; source?: string | null }) => ({
        id: u.id,
        email: u.email,
        unsubscribedAt: u.unsubscribedAt ?? u.unsubscribed_at ?? "",
        source: u.source ?? null,
      }));
      if (data.success) {
        setUnsubscribes(list);
      } else if (data.error) {
        error(data.error);
      }
    } catch (e: unknown) {
      error((e as Error)?.message ?? "Kara liste yüklenemedi");
    } finally {
      setUnsubscribesLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadUnsubscribes();
  }, [loadUnsubscribes]);

  useEffect(() => {
    if (formData.recipientType !== "custom" || !customParsed || customParsed.valid.length === 0) {
      setBlacklistedEmails([]);
      return;
    }
    apiClient("/api/email-notifications/check-blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: customParsed.valid }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.blacklisted)) setBlacklistedEmails(data.blacklisted);
        else setBlacklistedEmails([]);
      })
      .catch(() => setBlacklistedEmails([]));
  }, [formData.recipientType, customParsed?.valid.join(",") ?? ""]);

  const toSendCount = customParsed
    ? customParsed.valid.length - blacklistedEmails.length
    : null;
  const preSendSummary =
    formData.recipientType === "custom" &&
    customParsed &&
    customParsed.valid.length > 0 &&
    { total: customParsed.total, valid: customParsed.valid.length, invalid: customParsed.invalid.length, blacklisted: blacklistedEmails.length, toSend: Math.max(0, toSendCount ?? 0) };

  const handleReactivate = async (id: number) => {
    try {
      const res = await apiClient(`/api/email-notifications/unsubscribes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setUnsubscribes((prev) => prev.filter((u) => u.id !== id));
        success("Email yeniden aktif edildi");
      } else {
        error(data.error || "İşlem yapılamadı");
      }
    } catch (e: any) {
      error(e?.message || "İşlem yapılamadı");
    }
  };

  const applyTemplate = (template: (typeof templates)[0]) => {
    setAppliedTemplateId(template.templateId ?? null);
    setFormData((prev) => ({
      ...prev,
      ...(template.recipientType != null && { recipientType: template.recipientType }),
      subject: template.subject,
      message: template.message,
    }));
  };

  const filteredBars = useMemo(
    () => bars.filter((b) => b.name.toLowerCase().includes(barSearch.toLowerCase()) || (b.city || "").toLowerCase().includes(barSearch.toLowerCase())),
    [bars, barSearch]
  );
  const selectedBars = useMemo(() => bars.filter((b) => selectedBarIds.includes(b.id)), [bars, selectedBarIds]);
  const barsForSend = formData.recipientType !== "bar_associations" ? [] : barSelectionMode === "all" ? bars : selectedBars;
  const barsMissingProtocol = useMemo(
    () => barsForSend.filter((b) => !(b.protocolFiles && b.protocolFiles.length > 0)),
    [barsForSend]
  );
  const protocolReadyBars = useMemo(
    () => barsForSend.filter((b) => b.protocolFiles && b.protocolFiles.length > 0),
    [barsForSend]
  );
  const protocolStatusText = useMemo(() => {
    if (protocolUploadFile) return "Seçildi (henüz yüklenmedi)";
    if (barsForSend.length === 0) return "Baro seçilmedi";
    if (barsMissingProtocol.length === 0) return "Yüklü";
    if (protocolReadyBars.length === 0) return "Yüklenmedi";
    return `Kısmi (${protocolReadyBars.length}/${barsForSend.length} baroda yüklü)`;
  }, [protocolUploadFile, barsForSend.length, barsMissingProtocol.length, protocolReadyBars.length]);
  const missingEmailBars = useMemo(
    () =>
      barsForSend.filter((b) => !b.primaryEmail && (!includeSecondaryEmail || !b.secondaryEmail)).map((b) => b.name),
    [barsForSend, includeSecondaryEmail]
  );
  const barRecipientEmailCount = useMemo(
    () =>
      barsForSend.reduce((acc, b) => {
        const emails = new Set<string>();
        if (b.primaryEmail) emails.add(b.primaryEmail.toLowerCase());
        if (includeSecondaryEmail && b.secondaryEmail) emails.add(b.secondaryEmail.toLowerCase());
        return acc + emails.size;
      }, 0),
    [barsForSend, includeSecondaryEmail]
  );

  const sendTestMail = async () => {
    try {
      if (!testEmail) {
        error("Test email adresi girin");
        return;
      }
      setSendingTest(true);
      const res = await apiClient("/api/email-notifications/send-test", {
        method: "POST",
        body: JSON.stringify({
          testEmail,
          barAssociationId: selectedBars[0]?.id || null,
          subject: formData.subject,
          message: formData.message,
          template: appliedTemplateId || undefined,
          logoUrl: formData.logoUrl,
          headerImageUrl: formData.headerImageUrl,
          demoAccess:
            formData.recipientType === "bar_associations"
              ? {
                  username: formData.demoUsername,
                  password: formData.demoPassword,
                  license_key: formData.demoLicenseKey,
                  license_type: formData.demoLicenseType,
                  license_expires_at: formData.demoLicenseExpiresAt,
                  login_url: formData.demoLoginUrl,
                  video_url: formData.demoVideoUrl,
                }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Test email gönderilemedi");
      success("Test email gönderildi");
      loadTracking();
    } catch (e: any) {
      error(e?.message || "Test email gönderilemedi");
    } finally {
      setSendingTest(false);
    }
  };

  const openEvents = async (row: BaroTracking) => {
    try {
      const res = await apiClient(`/api/admin/baro-email-trackings/${row.id}/events`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Event listesi alınamadı");
      setTrackingEvents(data.events || []);
      setTrackingEventsTitle(`${row.barAssociation?.name || "Baro"} - ${row.recipientEmail}`);
      setTrackingEventsOpen(true);
    } catch (e: any) {
      error(e?.message || "Event listesi alınamadı");
    }
  };

  const deleteTrackingRow = async (row: BaroTracking) => {
    try {
      const ok = window.confirm(`${row.recipientEmail} için takip kaydı silinsin mi?`);
      if (!ok) return;
      const res = await apiClient(`/api/admin/baro-email-trackings/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Takip kaydı silinemedi");
      success("Takip kaydı silindi");
      await loadTracking();
    } catch (e: any) {
      error(e?.message || "Takip kaydı silinemedi");
    }
  };

  const deleteSelectedTrackings = async () => {
    try {
      if (selectedTrackingIds.length === 0) {
        error("Silmek için en az bir kayıt seçin");
        return;
      }
      const ok = window.confirm(`${selectedTrackingIds.length} takip kaydı silinsin mi?`);
      if (!ok) return;
      const res = await apiClient("/api/admin/baro-email-trackings/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTrackingIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Takip kayıtları silinemedi");
      success(`${data.deletedCount ?? selectedTrackingIds.length} kayıt silindi`);
      setSelectedTrackingIds([]);
      await loadTracking();
    } catch (e: any) {
      error(e?.message || "Takip kayıtları silinemedi");
    }
  };

  const trackingTotalPages = Math.max(1, Math.ceil(trackingRows.length / trackingPageSize));
  const pagedTrackingRows = useMemo(() => {
    const start = (currentTrackingPage - 1) * trackingPageSize;
    return trackingRows.slice(start, start + trackingPageSize);
  }, [trackingRows, currentTrackingPage, trackingPageSize]);
  const allSelectedOnPage =
    pagedTrackingRows.length > 0 && pagedTrackingRows.every((r) => selectedTrackingIds.includes(r.id));

  useEffect(() => {
    if (currentTrackingPage > trackingTotalPages) setCurrentTrackingPage(trackingTotalPages);
  }, [currentTrackingPage, trackingTotalPages]);

  return (
    <div className="space-y-6 p-6 font-sans text-[13px] font-normal text-gray-700 dark:text-gray-300">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Email Bildirimleri</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Kullanıcılara toplu email gönderin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Email Gönder</CardTitle>
              <CardDescription className="text-sm font-normal">Toplu email bildirimi oluşturun</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Recipient Type */}
                <div className="space-y-2">
                  <Label htmlFor="recipientType">Alıcı Grubu</Label>
                  <Select
                    id="recipientType"
                    value={formData.recipientType}
                    onChange={(e) => setFormData({ ...formData, recipientType: e.target.value })}
                  >
                    {recipientTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Custom Emails */}
                {formData.recipientType === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="customEmails">Email Adresleri</Label>
                    <Textarea
                      id="customEmails"
                      placeholder="ornek1@email.com, ornek2@email.com&#10;Her satıra bir email veya virgül/noktalı virgül ile ayırın"
                      value={formData.customEmails}
                      onChange={(e) => setFormData({ ...formData, customEmails: e.target.value })}
                      rows={5}
                    />
                    <p className="text-sm text-gray-500">
                      Her satıra bir email veya virgül/noktalı virgül ile ayırın. Tekrarlar ve kara listedekiler otomatik filtrelenir.
                    </p>
                    {customParsed && customParsed.invalid.length > 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Geçersiz format ({customParsed.invalid.length}): {customParsed.invalid.slice(0, 5).join(", ")}
                        {customParsed.invalid.length > 5 && "..."}
                      </p>
                    )}
                    {preSendSummary && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
                        <p className="font-medium text-gray-700 dark:text-gray-300">Gönderim özeti</p>
                        <p>Toplam girilen: {preSendSummary.total} · Geçerli: {preSendSummary.valid} · Kara listede: {preSendSummary.blacklisted} · Gönderilecek: {preSendSummary.toSend}</p>
                        {preSendSummary.blacklisted > 0 && (
                          <p className="text-amber-600 dark:text-amber-400">
                            {preSendSummary.blacklisted} email kara listede olduğu için gönderime dahil edilmedi.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {formData.recipientType === "bar_associations" && (
                  <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <Label>Baro seçimi</Label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={barSelectionMode === "all"} onChange={() => setBarSelectionMode("all")} />
                        Tüm aktif barolar
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={barSelectionMode === "selected"} onChange={() => setBarSelectionMode("selected")} />
                        Sadece seçili barolar
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={includeSecondaryEmail} onChange={(e) => setIncludeSecondaryEmail(e.target.checked)} />
                      İkinci mail adreslerini de dahil et
                    </label>
                    {barSelectionMode === "selected" && (
                      <div className="space-y-2">
                        <Input placeholder="Baro ara..." value={barSearch} onChange={(e) => setBarSearch(e.target.value)} />
                        <div className="max-h-48 overflow-auto rounded border border-gray-200 p-2 dark:border-gray-700">
                          {filteredBars.map((b) => (
                            <label key={b.id} className="flex items-center gap-2 py-1 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedBarIds.includes(b.id)}
                                onChange={(e) =>
                                  setSelectedBarIds((prev) => (e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)))
                                }
                              />
                              <span>{b.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Seçilen baro: {barsForSend.length} · Geçerli email: {barRecipientEmailCount}
                      {missingEmailBars.length > 0 ? ` · Eksik mail: ${missingEmailBars.length}` : ""}
                    </div>
                    {missingEmailBars.length > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Mail alanı eksik: {missingEmailBars.slice(0, 6).join(", ")}
                        {missingEmailBars.length > 6 ? "..." : ""}
                      </p>
                    )}
                  </div>
                )}

                {formData.recipientType === "bar_associations" && (
                  <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <Label className="text-base font-semibold">Baroya Özel Protokol Dosyası</Label>
                    <p className="text-xs text-gray-500">
                      Her baroya özel hazırlanmış protokol dosyasını buradan yükleyebilirsiniz. E-imza için UDF dosyası yüklenebilir.
                    </p>
                    <Input type="file" accept=".pdf,.docx,.udf" onChange={(e) => setProtocolUploadFile(e.target.files?.[0] || null)} />
                    {protocolUploadFile ? (
                      <div className="text-xs text-gray-600">
                        <p>Dosya adı: {protocolUploadFile.name}</p>
                        <p>Dosya boyutu: {(protocolUploadFile.size / 1024).toFixed(1)} KB</p>
                        <p>Dosya tipi: {protocolUploadFile.type || "application/octet-stream"}</p>
                        <p>Durum: {protocolStatusText}</p>
                      </div>
                    ) : (
                      <p
                        className={`text-xs ${
                          barsForSend.length > 0 && barsMissingProtocol.length === 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        Durum: {protocolStatusText}
                      </p>
                    )}
                    {barsForSend.length > 1 && (
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={applySameProtocolToAll} onChange={(e) => setApplySameProtocolToAll(e.target.checked)} />
                        Aynı protokol dosyasını seçili tüm barolara gönder
                      </label>
                    )}
                    {barsForSend.length > 1 && !applySameProtocolToAll ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Birden fazla baro seçildi. Her baroya özel protokol göndermek için Baro Yönetimi sayfasından ilgili baroya protokol dosyası yükleyin veya tek baro seçerek gönderim yapın.
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={uploadProtocolForBars} disabled={protocolUploading || !protocolUploadFile}>
                        {protocolUploading ? "Yükleniyor..." : "Dosya Yükle"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setProtocolUploadFile(null)} disabled={!protocolUploadFile}>
                        Dosyayı Kaldır
                      </Button>
                    </div>
                  </div>
                )}

                {formData.recipientType === "bar_associations" && (
                  <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <Label className="text-base font-semibold">Demo Erişim Bilgileri</Label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="demoUsername">{"Kullanıcı Adı ({{username}})"}</Label>
                        <Input id="demoUsername" value={formData.demoUsername} onChange={(e) => setFormData({ ...formData, demoUsername: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="demoPassword">{"Geçici Şifre ({{password}})"}</Label>
                        <Input id="demoPassword" value={formData.demoPassword} onChange={(e) => setFormData({ ...formData, demoPassword: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="demoLicenseKey">{"Lisans Kodu ({{license_key}})"}</Label>
                        <Input id="demoLicenseKey" value={formData.demoLicenseKey} onChange={(e) => setFormData({ ...formData, demoLicenseKey: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="demoLicenseType">{"Lisans Türü ({{license_type}})"}</Label>
                        <Input id="demoLicenseType" value={formData.demoLicenseType} onChange={(e) => setFormData({ ...formData, demoLicenseType: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="demoLicenseExpiresAt">{"Geçerlilik Bitişi ({{license_expires_at}})"}</Label>
                        <Input id="demoLicenseExpiresAt" value={formData.demoLicenseExpiresAt} onChange={(e) => setFormData({ ...formData, demoLicenseExpiresAt: e.target.value })} placeholder="31.12.2026" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="demoLoginUrl">{"Giriş Linki ({{login_url}})"}</Label>
                        <Input id="demoLoginUrl" value={formData.demoLoginUrl} onChange={(e) => setFormData({ ...formData, demoLoginUrl: e.target.value })} />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="demoVideoUrl">{"Eğitim Videoları Linki ({{video_url}})"}</Label>
                        <Input id="demoVideoUrl" value={formData.demoVideoUrl} onChange={(e) => setFormData({ ...formData, demoVideoUrl: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Konu</Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="Email konusu..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Mesaj</Label>
                  <Textarea
                    id="message"
                    placeholder="Email mesajınızı buraya yazın..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={8}
                    required
                  />
                  <p className="text-sm text-gray-500">
                    Mesajınız otomatik olarak email şablonuna yerleştirilecektir
                  </p>
                </div>

                {/* Custom Design Options */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Image className="w-4 h-4 text-gray-600" />
                    <Label className="text-base font-semibold">Email Tasarımı (Opsiyonel)</Label>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Logo URL */}
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">Logo URL</Label>
                      <Input
                        id="logoUrl"
                        type="text"
                        placeholder="logo.png"
                        value={formData.logoUrl}
                        onChange={(e) => {
                          setFormData({ ...formData, logoUrl: e.target.value });
                          setLogoPreviewError(null);
                        }}
                      />
                      <p className="text-xs text-gray-500">
                        Logo URL'si girerseniz email'de görünür (varsayılan: ⚖️ emoji)
                      </p>
                    </div>

                    {/* Header Image URL */}
                    <div className="space-y-2">
                      <Label htmlFor="headerImageUrl">Header Görsel URL</Label>
                      <Input
                        id="headerImageUrl"
                        type="text"
                        placeholder="baromailsablon.png"
                        value={formData.headerImageUrl}
                        onChange={(e) => {
                          setFormData({ ...formData, headerImageUrl: e.target.value });
                          setHeaderPreviewError(null);
                        }}
                      />
                      <p className="text-xs text-gray-500">
                        Email başlığında görünecek banner görsel (opsiyonel)
                      </p>
                    </div>

                    {/* Önizleme: normalize edilmiş URL ile; logo ve header ayrı ayrı */}
                    {(formData.logoUrl.trim() || formData.headerImageUrl.trim()) && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-4">
                        <p className="text-sm font-medium">Önizleme</p>
                        {formData.logoUrl.trim() && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Logo</p>
                            {logoPreviewError === normalizeImageUrl(formData.logoUrl) ? (
                              <div className="text-red-500 text-sm">
                                <p>Görsel yüklenemedi</p>
                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                  Denenen URL: {normalizeImageUrl(formData.logoUrl)}
                                </p>
                              </div>
                            ) : (
                              <img
                                src={normalizeImageUrl(formData.logoUrl)}
                                alt="Logo önizleme"
                                className="max-w-[150px] h-auto block"
                                onLoad={() => setLogoPreviewError(null)}
                                onError={() => setLogoPreviewError(normalizeImageUrl(formData.logoUrl))}
                              />
                            )}
                          </div>
                        )}
                        {formData.headerImageUrl.trim() && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Header görsel</p>
                            {headerPreviewError === normalizeImageUrl(formData.headerImageUrl) ? (
                              <div className="text-red-500 text-sm">
                                <p>Görsel yüklenemedi</p>
                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                  Denenen URL: {normalizeImageUrl(formData.headerImageUrl)}
                                </p>
                              </div>
                            ) : (
                              <img
                                src={normalizeImageUrl(formData.headerImageUrl)}
                                alt="Header önizleme"
                                className="max-w-full h-auto rounded block"
                                onLoad={() => setHeaderPreviewError(null)}
                                onError={() => setHeaderPreviewError(normalizeImageUrl(formData.headerImageUrl))}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Önizleme ve Onay
                      </>
                    )}
                  </Button>
                </div>

                {/* Send Result */}
                {sendResult && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                      Gönderim Tamamlandı
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-green-800 dark:text-green-200">
                        ✅ Başarılı: {sendResult.sent}/{sendResult.total}
                      </p>
                      {sendResult.failed > 0 && (
                        <p className="text-red-600 dark:text-red-400">
                          ❌ Başarısız: {sendResult.failed}
                        </p>
                      )}
                    </div>
                    {sendResult.errors && sendResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                          Hata Detayları
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {sendResult.errors.slice(0, 5).map((err: any, idx: number) => (
                            <li key={idx} className="text-red-600 dark:text-red-400">
                              {err.recipient}: {err.error}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Templates Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Hazır Şablonlar</CardTitle>
              <CardDescription className="text-sm font-normal">Hızlı kullanım için şablonlar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template)}
                  className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {template.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {template.description ?? template.subject}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">💡 İpuçları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Email'ler 10'ar 10'ar gönderilir</p>
              <p>• Her kullanıcının adı otomatik eklenir</p>
              <p>• Özel listede virgül veya satır sonu kullanabilirsiniz</p>
              <p>• Kara listedeki adreslere otomatik gönderilmez</p>
              <p>• Email ayarları .env dosyasında yapılmalıdır</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Test Mail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Test Maili</CardTitle>
          <CardDescription className="text-sm font-normal">Gönderimden önce yalnızca test adresine mail gönderin</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:flex-row">
          <Input placeholder="test@ornek.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <Button onClick={sendTestMail} disabled={sendingTest || !formData.subject || !formData.message}>
            {sendingTest ? "Gönderiliyor..." : "Test Maili Gönder"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Baro Mail Takipleri</CardTitle>
          <CardDescription className="text-sm font-normal">
            Mail açılma verisi, alıcının mail uygulamasındaki görsel engelleme ve gizlilik ayarlarına bağlı olarak kesin sonuç vermeyebilir.
            En güvenilir takip verileri programa giriş ve sözleşme indirme kayıtlarıdır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {[
              ["Gönderilen", trackingSummary?.sentCount ?? 0],
              ["Açılan", trackingSummary?.openedCount ?? 0],
              ["Programa Giriş Yapıldı", trackingSummary?.clickedCount ?? 0],
              ["Sözleşme İndirilen", trackingSummary?.contractDownloadedCount ?? 0],
              ["Hatalı", trackingSummary?.failedCount ?? 0],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                <div className="text-xs text-gray-500">{k}</div>
                <div className="font-semibold">{v as any}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Baro / mail / konu ara..." value={trackingSearch} onChange={(e) => setTrackingSearch(e.target.value)} />
            <Button variant="outline" onClick={deleteSelectedTrackings} disabled={selectedTrackingIds.length === 0}>
              Seçilenleri Sil ({selectedTrackingIds.length})
            </Button>
            <Button variant="outline" onClick={loadTracking}>Yenile</Button>
          </div>
          <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={(e) =>
                        setSelectedTrackingIds(
                          e.target.checked
                            ? [...new Set([...selectedTrackingIds, ...pagedTrackingRows.map((r) => r.id)])]
                            : selectedTrackingIds.filter((id) => !pagedTrackingRows.some((r) => r.id === id))
                        )
                      }
                    />
                  </th>
                  {["Baro", "Alıcı Mail", "Konu", "Gönderildi", "Açıldı", "Programa Giriş", "Sözleşme İndirildi", "Durum", "İşlemler"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium tracking-tight text-gray-600 dark:text-gray-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trackingLoading ? (
                  <tr><td colSpan={10} className="px-3 py-2">Yükleniyor...</td></tr>
                ) : trackingRows.length === 0 ? (
                  <tr><td colSpan={10} className="px-3 py-2">Kayıt yok.</td></tr>
                ) : pagedTrackingRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 text-[13px] font-normal text-gray-700 dark:border-gray-800 dark:text-gray-300">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedTrackingIds.includes(r.id)}
                        onChange={(e) =>
                          setSelectedTrackingIds((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">{r.barAssociation?.name || "-"}</td>
                    <td className="px-3 py-2">{r.recipientEmail}</td>
                    <td className="px-3 py-2">{r.subject}</td>
                    <td className="px-3 py-2">{r.sentAt ? "Evet" : "-"}</td>
                    <td className="px-3 py-2">{r.openedAt ? "Evet" : "-"}</td>
                    <td className="px-3 py-2">{r.clickedAt ? "Evet" : "-"}</td>
                    <td className="px-3 py-2">{r.contractDownloadedAt ? "Evet" : "-"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "FAILED" ? "destructive" : "secondary"}>
                        {r.status === "SENT" ? "Gönderildi" : r.status === "FAILED" ? "Hatalı" : "Bekliyor"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEvents(r)}>Event Detayı</Button>
                        {r.barAssociation?.id ? (
                          <Button size="sm" variant="outline" onClick={() => window.open(`/admin/bar-associations?search=${encodeURIComponent(r.barAssociation?.name || "")}`, "_self")}>Baro Detayı</Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => deleteTrackingRow(r)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!trackingLoading && trackingRows.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span>Sayfa başına</span>
                <select
                  value={trackingPageSize}
                  onChange={(e) => {
                    setTrackingPageSize(Number(e.target.value));
                    setCurrentTrackingPage(1);
                  }}
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  Toplam {trackingRows.length} kayıt · Sayfa {currentTrackingPage}/{trackingTotalPages}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentTrackingPage((p) => Math.max(1, p - 1))}
                  disabled={currentTrackingPage <= 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentTrackingPage((p) => Math.min(trackingTotalPages, p + 1))}
                  disabled={currentTrackingPage >= trackingTotalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abonelikten Çıkanlar / Kara Liste */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ListX className="w-5 h-5" />
                Abonelikten Çıkanlar (Kara Liste)
              </CardTitle>
              <CardDescription className="text-sm font-normal">
                Bu listedeki adreslere toplu mail gönderilmez. İstenirse yeniden aktif edebilirsiniz. Listeyi güncellemek için yenileyin.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadUnsubscribes}
              disabled={unsubscribesLoading}
              className="shrink-0"
            >
              <RotateCcw className={`w-4 h-4 mr-1 ${unsubscribesLoading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unsubscribesLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</p>
          ) : unsubscribes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Henüz abonelikten çıkan email adresi bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80">
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Çıkış Tarihi
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Kaynak
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unsubscribes.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {u.email}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(u.unsubscribedAt).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="font-normal">
                          {u.source || "—"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivate(u.id)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Yeniden Aktif Et
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Önizleme ve Onay</DialogTitle>
            <DialogDescription>Toplu mail gönderimi bu onay sonrası başlatılır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Alıcı grubu:</strong> {recipientTypes.find((r) => r.value === formData.recipientType)?.label}</p>
            {formData.recipientType === "bar_associations" && (
              <>
                <p><strong>Toplam baro:</strong> {barsForSend.length}</p>
                <p><strong>Toplam e-posta alıcısı:</strong> {barRecipientEmailCount}</p>
                <p><strong>Eksik mail adresi olan barolar:</strong> {missingEmailBars.length ? missingEmailBars.join(", ") : "Yok"}</p>
                <div className="max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">
                  {barsForSend.map((bar) => {
                    const p = bar.protocolFiles?.[0];
                    return (
                      <p key={bar.id}>
                        Baro: {bar.name} · Protokol Dosyası: {p?.originalFileName || "-"} · Durum: {p ? "Hazır" : "Protokol dosyası yok"}
                      </p>
                    );
                  })}
                </div>
                {barsMissingProtocol.length > 0 ? (
                  <p className="text-amber-600 dark:text-amber-400">
                    Seçili barolardan bazılarında protokol dosyası bulunmuyor. Protokolü İndir butonu bu barolarda çalışmayacaktır.
                  </p>
                ) : null}
              </>
            )}
            <p><strong>Konu:</strong> {formData.subject}</p>
            <p><strong>Şablon:</strong> {appliedTemplateId || "Özel"}</p>
            <p><strong>Logo URL:</strong> {formData.logoUrl || "-"}</p>
            <p><strong>Header görsel URL:</strong> {formData.headerImageUrl || "-"}</p>
            {formData.recipientType === "bar_associations" && (
              <>
                <p><strong>Demo Kullanıcı Adı:</strong> {formData.demoUsername || "-"}</p>
                <p><strong>Demo Lisans Kodu:</strong> {formData.demoLicenseKey || "-"}</p>
                <p><strong>Demo Lisans Türü:</strong> {formData.demoLicenseType || "-"}</p>
                <p><strong>Demo Geçerlilik:</strong> {formData.demoLicenseExpiresAt || "-"}</p>
                <p><strong>Login URL:</strong> {formData.demoLoginUrl || "-"}</p>
                <p><strong>Video URL:</strong> {formData.demoVideoUrl || "-"}</p>
              </>
            )}
            <div>
              <strong>Mesaj önizlemesi:</strong>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">{formData.message}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={sendTestMail} disabled={sendingTest}>{sendingTest ? "Test gönderiliyor..." : "Test maili gönder"}</Button>
            <Button onClick={submitConfirmed} disabled={loading}>{loading ? "Gönderiliyor..." : "Gönderimi Onayla"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={protocolWarningState.open} onOpenChange={(open) => setProtocolWarningState((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eksik Protokol Dosyaları</DialogTitle>
            <DialogDescription>
              Seçili barolardan bazılarında protokol dosyası bulunmuyor.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            {protocolWarningState.missing.length > 0 ? protocolWarningState.missing.join(", ") : "Bilinmiyor"}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtocolWarningState({ open: false, missing: [] })}>Gönderimi İptal Et</Button>
            <Button variant="outline" onClick={() => { setProtocolWarningState({ open: false, missing: [] }); submitConfirmed({ allowWithoutProtocol: true }); }}>Protokolsüz Gönder</Button>
            <Button onClick={() => setProtocolWarningState({ open: false, missing: [] })}>Eksik Dosyaları Tamamla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trackingEventsOpen} onOpenChange={setTrackingEventsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event Geçmişi</DialogTitle>
            <DialogDescription>{trackingEventsTitle}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-2">
            {trackingEvents.length === 0 ? (
              <p className="text-sm text-gray-500">Event kaydı yok.</p>
            ) : trackingEvents.map((ev) => (
              <div key={ev.id} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                <div className="font-medium">{ev.eventType}</div>
                <div className="text-xs text-gray-500">{new Date(ev.createdAt).toLocaleString("tr-TR")}</div>
                {ev.eventData ? <pre className="mt-1 whitespace-pre-wrap text-xs">{JSON.stringify(ev.eventData, null, 2)}</pre> : null}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

