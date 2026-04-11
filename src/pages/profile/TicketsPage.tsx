import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  MessageSquare, Plus, Send, Clock, CheckCircle, XCircle, AlertCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/utils/apiClient";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface TicketReply {
  id: number;
  ticketId: number;
  userId?: number;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Ticket {
  id: number;
  tenantId?: number;
  userId?: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt?: string;
  user?: { id: number; name: string; email: string };
  replies: TicketReply[];
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Açık", in_progress: "İşlemde", resolved: "Çözüldü", closed: "Kapalı",
};
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Düşük", medium: "Orta", high: "Yüksek", urgent: "Acil",
};

function statusIcon(s: TicketStatus) {
  switch (s) {
    case "open": return <Clock className="h-4 w-4 text-blue-500" />;
    case "in_progress": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "resolved": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "closed": return <XCircle className="h-4 w-4 text-gray-400" />;
  }
}

function priorityColor(p: TicketPriority) {
  switch (p) {
    case "low": return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    case "medium": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "urgent": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", description: "", priority: "medium" as TicketPriority });
  const [replyMessage, setReplyMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tenantId = useMemo(() => Number(localStorage.getItem("tenant_id") || "1"), []);
  const userId = useMemo(() => user?.id || Number(localStorage.getItem("user_id") || "0"), [user]);

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await apiClient("/api/tickets", {
        headers: { "x-tenant-id": String(tenantId), "x-user-id": String(userId) },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (_e) {
      error("Destek talepleri yüklenemedi");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      error("Konu ve açıklama zorunludur"); return;
    }
    try {
      setSubmitting(true);
      const res = await apiClient("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId), "x-user-id": String(userId) },
        body: JSON.stringify(newTicket),
      });
      if (!res.ok) throw new Error();
      success("Destek talebi başarıyla oluşturuldu");
      setNewTicket({ subject: "", description: "", priority: "medium" });
      setShowNewForm(false);
      await loadTickets();
    } catch (_e) {
      error("Destek talebi oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (ticketId: number) => {
    if (!replyMessage.trim()) { error("Mesaj zorunludur"); return; }
    try {
      setSubmitting(true);
      const res = await apiClient(`/api/tickets/${ticketId}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: replyMessage }),
      });
      if (!res.ok) throw new Error();
      success("Yanıt gönderildi");
      setReplyMessage("");
      // Yanıt sonrası ticket'ı yenile
      const updated: Ticket | null = await res.json().catch(() => null);
      if (updated) setSelectedTicket(updated);
      await loadTickets();
    } catch (_e) {
      error("Yanıt gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId: number, status: TicketStatus) => {
    try {
      setSubmitting(true);
      const res = await apiClient(`/api/tickets/${ticketId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      success("Durum güncellendi");
      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        const updated: Ticket | null = await res.json().catch(() => null);
        if (updated) setSelectedTicket(updated);
        else setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }
    } catch (_e) {
      error("Durum güncellenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (_e) { return s; }
  };

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Destek Talepleri</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Destek taleplerinizi buradan yönetebilirsiniz</p>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="h-4 w-4 mr-1.5" /> Yeni Talep
        </Button>
      </div>

      {/* Yeni talep formu */}
      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle>Yeni Destek Talebi</CardTitle>
            <CardDescription>Yardıma ihtiyacınız mı var? Bize ulaşın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Konu *</Label>
              <Input id="subject" value={newTicket.subject}
                onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                placeholder="Örn: Hesaplama hatası" />
            </div>
            <div>
              <Label htmlFor="priority">Öncelik</Label>
              <Select id="priority" value={newTicket.priority}
                onChange={e => setNewTicket({ ...newTicket, priority: e.target.value as TicketPriority })}>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="desc">Açıklama *</Label>
              <Textarea id="desc" value={newTicket.description}
                onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Sorununuzu detaylı açıklayın..." rows={5} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Gönderiliyor..." : "Gönder"}
              </Button>
              <Button variant="outline" onClick={() => setShowNewForm(false)}>İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {loading ? (
        <Card><CardContent className="p-6 text-center text-gray-500">Yükleniyor...</CardContent></Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-600 dark:text-gray-400">Henüz destek talebiniz yok</p>
            <p className="text-sm text-gray-500 mt-1">Yeni talep oluşturmak için "Yeni Talep" butonuna tıklayın</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Konu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Öncelik</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Durum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tickets.map(t => {
                    const responseStatus = t.status === "closed"
                      ? "Kapatıldı"
                      : (t.replies?.length || 0) > 0 ? "Yanıtlandı" : "Cevap Bekliyor";
                    const responseColor = t.status === "closed"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      : (t.replies?.length || 0) > 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{t.subject}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
                          {(t.replies?.length || 0) > 0 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{t.replies.length} yanıt</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn("text-xs px-2 py-0.5", priorityColor(t.priority))}>
                            {PRIORITY_LABELS[t.priority]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                              {statusIcon(t.status)} {STATUS_LABELS[t.status]}
                            </span>
                            <Badge className={cn("text-xs px-2 py-0.5", responseColor)}>{responseStatus}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedTicket(t); setReplyMessage(""); }}
                            className="text-xs h-7">Detay</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Detay Modal ───────────────────────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedTicket(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-gray-900 w-full sm:w-[640px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            {/* Başlık */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{selectedTicket.subject}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    {statusIcon(selectedTicket.status)} {STATUS_LABELS[selectedTicket.status]}
                  </span>
                  <Badge className={cn("text-xs px-2 py-0.5", priorityColor(selectedTicket.priority))}>
                    {PRIORITY_LABELS[selectedTicket.priority]}
                  </Badge>
                  <span className="text-xs text-gray-400">{fmtDate(selectedTicket.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedTicket.status !== "closed" && (
                  <Select
                    value={selectedTicket.status}
                    onChange={e => handleUpdateStatus(selectedTicket.id, e.target.value as TicketStatus)}
                    className="text-xs h-7 w-32"
                    disabled={submitting}
                  >
                    <option value="open">Açık</option>
                    <option value="in_progress">İşlemde</option>
                    <option value="resolved">Çözüldü</option>
                    <option value="closed">Kapalı</option>
                  </Select>
                )}
                <button onClick={() => setSelectedTicket(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* İçerik */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Açıklama */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Açıklama</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Yanıtlar */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Yanıtlar ({selectedTicket.replies?.length || 0})
                </p>
                {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                  <p className="text-sm text-gray-400 italic">Henüz yanıt yok</p>
                ) : (
                  <div className="space-y-3">
                    {selectedTicket.replies.map(reply => (
                      <div key={reply.id}
                        className={cn(
                          "p-3 rounded-xl text-sm",
                          reply.isAdmin
                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                            : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                        )}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                            {reply.isAdmin ? "Destek Ekibi" : (selectedTicket.user?.name || "Siz")}
                          </span>
                          <span className="text-xs text-gray-400">{fmtDate(reply.createdAt)}</span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {reply.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Yanıt formu */}
              {selectedTicket.status !== "closed" && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Yanıt Ekle</p>
                  <Textarea
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    placeholder="Yanıtınızı yazın..."
                    rows={4}
                    className="text-sm"
                  />
                  <Button
                    onClick={() => handleAddReply(selectedTicket.id)}
                    disabled={submitting || !replyMessage.trim()}
                    className="mt-2 gap-1.5" size="sm">
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Gönderiliyor..." : "Gönder"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
