import { useState, useEffect, useMemo, useCallback } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Görsel URL'ini önizleme için normalize eder. Form gönderimine dokunmaz. */
function normalizeImageUrl(value: string): string {
  if (!value) return "";
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/")) return v;
  return `/${v}`;
}
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/context/ToastContext";
import { Mail, Send, Users, Clock, CheckCircle, XCircle, Image, Code, ListX, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL, apiClient } from "@/utils/apiClient";
export default function AdminEmailNotifications() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    recipientType: "all",
    customEmails: "",
    subject: "",
    message: "",
    logoUrl: "",
    headerImageUrl: "",
    useCustomTemplate: false,
  });
  const [sendResult, setSendResult] = useState<any>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [logoPreviewError, setLogoPreviewError] = useState<string | null>(null);
  const [headerPreviewError, setHeaderPreviewError] = useState<string | null>(null);
  const [unsubscribes, setUnsubscribes] = useState<{ id: number; email: string; unsubscribedAt: string; source: string | null }[]>([]);
  const [unsubscribesLoading, setUnsubscribesLoading] = useState(false);
  const [blacklistedEmails, setBlacklistedEmails] = useState<string[]>([]);
  const [blacklistCheckLoading, setBlacklistCheckLoading] = useState(false);

  const recipientTypes = [
    { value: "all", label: "Tüm Kullanıcılar", icon: Users },
    { value: "active", label: "Aktif Aboneler", icon: CheckCircle },
    { value: "trial", label: "Deneme Kullanıcıları", icon: Clock },
    { value: "expired", label: "Süresi Dolmuş Kullanıcılar", icon: XCircle },
    { value: "custom", label: "Özel Email Listesi", icon: Mail },
  ];

  const templates: {
    name: string;
    subject: string;
    message: string;
    description?: string;
    recipientType?: string;
    templateId?: string;
  }[] = [
    {
      name: "Yeni Özellik Duyurusu",
      subject: "🎉 Yeni Özellikler Eklendi!",
      message: "Sistemimize yeni özellikler ekledik. Detayları görmek için panele giriş yapabilirsiniz."
    },
    {
      name: "Sistem Bakımı",
      subject: "⚙️ Planlı Sistem Bakımı",
      message: "Sistemimiz [TARIH] tarihinde bakıma girecektir. Bu süre zarfında hizmetlerimize erişemeyebilirsiniz."
    },
    {
      name: "Abonelik Hatırlatması",
      subject: "⏰ Abonelik Yenileme Hatırlatması",
      message: "Aboneliğinizin süresi yakında dolacak. Kesintisiz hizmet için lütfen yenileme yapın."
    },
    {
      name: "Barolara Özel Teklif",
      description: "Baro avukatlarına özel %25 indirim teklifi",
      templateId: "baro",
      subject: "Baronuz Avukatlarına Özel %25 İndirim – İşçilik Alacaklarını 30 Saniyede Hesaplayın",
      recipientType: "custom",
      message: `Sayın Baro Yetkilisi,

İşçilik alacakları hesaplamaları birçok avukat için zaman alan ve hata riski taşıyan bir süreçtir.

Excel ile yapılan bir kıdem tazminatı hesaplaması ortalama 30 dakika sürerken, Bilirkişi Hesaplama Programı ile aynı hesaplama yaklaşık 30 saniye içinde tamamlanabilir.

Program ile hesaplanabilen başlıca işçilik alacakları:

• Kıdem Tazminatı
• İhbar Tazminatı
• Fazla Mesai Alacağı
• UBGT Alacağı
• Hafta Tatili Alacağı
• Yıllık İzin Alacağı
• Ücret Alacağı
• Ayrımcılık Tazminatı
• Kötü Niyet Tazminatı
• İşe Başlatmama Tazminatı
• Boşta Geçen Süre Ücreti

Baronuz avukatlarına özel olarak programımız için %25 indirim tanımlamak isteriz.

Programımız ile ilgili videolara ulaşmak için aşağıdaki bağlantıya tıklayabilirsiniz: https://www.youtube.com/@bilirkisihesap`
    },
  ];

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

    setLoading(true);
    setSendResult(null);

    try {
      const requestBody: any = {
        recipientType: formData.recipientType,
        subject: formData.subject,
        message: formData.message,
        logoUrl: formData.logoUrl,
        headerImageUrl: formData.headerImageUrl,
        useCustomTemplate: formData.useCustomTemplate,
        ...(appliedTemplateId && { template: appliedTemplateId }),
      };

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

      const response = await apiClient(`/api/email-notifications/send-bulk`, {
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
        throw new Error(data.error || "Email gönderilemedi");
      }

      const results = data.results ?? { sent: 0, total: 0 };
      setSendResult(results);
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

  const BARO_LOGO_URL = "https://panel.bilirkisihesap.com/logo.png";
  const BARO_CAMPAIGN_IMAGE_URL = "https://panel.bilirkisihesap.com/baromailsablon.png";

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
    setBlacklistCheckLoading(true);
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
      .catch(() => setBlacklistedEmails([]))
      .finally(() => setBlacklistCheckLoading(false));
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
    const isBaro = template.templateId === "baro";
    setFormData((prev) => ({
      ...prev,
      ...(template.recipientType != null && { recipientType: template.recipientType }),
      subject: template.subject,
      message: template.message,
      ...(isBaro && {
        logoUrl: BARO_LOGO_URL,
        headerImageUrl: BARO_CAMPAIGN_IMAGE_URL,
      }),
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Bildirimleri</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Kullanıcılara toplu email gönderin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Email Gönder</CardTitle>
              <CardDescription>Toplu email bildirimi oluşturun</CardDescription>
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
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Email Gönder
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
              <CardTitle>Hazır Şablonlar</CardTitle>
              <CardDescription>Hızlı kullanım için şablonlar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template)}
                  className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
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
              <CardTitle>💡 İpuçları</CardTitle>
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

      {/* Abonelikten Çıkanlar / Kara Liste */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListX className="w-5 h-5" />
                Abonelikten Çıkanlar (Kara Liste)
              </CardTitle>
              <CardDescription>
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
    </div>
  );
}

