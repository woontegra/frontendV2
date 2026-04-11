import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Send, Clock, CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/utils/apiClient";
import { pageTitleCls, pageSubtitleCls, cardContentTightCls, tableHeadCompactCls, badgeCls } from "./adminStyles";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface TicketReply {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Ticket {
  id: number;
  tenantId: number;
  userId: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string; email: string };
  replies: TicketReply[];
}

interface Tenant {
  id: number;
  name: string;
  email: string;
}

export default function AdminTicketsPage() {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [resolvedUserId, setResolvedUserId] = useState<number | null>(null);

  useEffect(() => {
    const resolveUserId = async () => {
      if (user?.id) {
        setResolvedUserId(user.id);
        return;
      }
      const currentUser = localStorage.getItem("current_user");
      if (currentUser) {
        try {
          const parsed = JSON.parse(currentUser);
          if (parsed.id) {
            setResolvedUserId(parsed.id);
            return;
          }
        } catch {}
      }
      const email = user?.email || localStorage.getItem("email");
      if (email) {
        try {
          const userRes = await apiClient(
            `/api/admin/users/email/${encodeURIComponent(email)}`,
            { headers: { "x-user-role": "admin" } }
          );
          if (userRes.ok) {
            const userData = await userRes.json();
            setResolvedUserId(userData.id);
            return;
          }
        } catch {}
      }
      const userIdFromStorage = Number(localStorage.getItem("user_id") || "0");
      if (userIdFromStorage > 0) setResolvedUserId(userIdFromStorage);
    };
    resolveUserId();
  }, [user]);

  useEffect(() => {
    if (resolvedUserId) {
      loadTickets();
      loadTenants();
    }
  }, [statusFilter, priorityFilter, resolvedUserId]);

  const loadTenants = async () => {
    try {
      const res = await apiClient("/api/admin/tenants", { headers: { "x-user-role": "admin" } });
      if (res.ok) {
        const data = await res.json();
        setTenants(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const loadTickets = async () => {
    if (!resolvedUserId) {
      error("Kullanıcı kimliği bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient("/api/tickets", {
        headers: { "x-user-id": String(resolvedUserId) },
      });
      if (!res.ok) {
        if (res.status === 401) error("Yetkilendirme hatası. Lütfen tekrar giriş yapın.");
        else throw new Error("Ticketlar yüklenemedi");
        return;
      }
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      error("Destek talepleri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleAddReply = async (ticketId: number) => {
    if (!replyMessage.trim()) {
      error("Mesaj zorunludur");
      return;
    }
    if (!resolvedUserId) {
      error("Kullanıcı kimliği bulunamadı");
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiClient(`/api/tickets/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": String(resolvedUserId) },
        body: JSON.stringify({ message: replyMessage }),
      });
      if (!res.ok) throw new Error("Yanıt eklenemedi");
      success("Yanıt başarıyla eklendi");
      setReplyMessage("");
      const updatedTicket = await res.json();
      setSelectedTicket(updatedTicket);
      await loadTickets();
    } catch {
      error("Yanıt eklenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId: number, status: TicketStatus) => {
    if (!resolvedUserId) {
      error("Kullanıcı kimliği bulunamadı");
      return;
    }
    try {
      setSubmitting(true);
      const response = await apiClient(`/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": String(resolvedUserId) },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Ticket güncellenemedi");
      success("Durum güncellendi");
      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        const updatedTicket = await response.json();
        setSelectedTicket(updatedTicket);
      }
    } catch {
      error("Durum güncellenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case "open": return <Clock className="h-4 w-4 text-blue-500" />;
      case "in_progress": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "resolved": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "closed": return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: TicketStatus) => {
    const labels: Record<TicketStatus, string> = {
      open: "Açık", in_progress: "İşlemde", resolved: "Çözüldü", closed: "Kapalı",
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    const labels: Record<TicketPriority, string> = {
      low: "Düşük", medium: "Orta", high: "Yüksek", urgent: "Acil",
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colors: Record<TicketPriority, string> = {
      low: "bg-gray-100 text-gray-800", medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800", urgent: "bg-red-100 text-red-800",
    };
    return colors[priority] || "";
  };

  const getStatusColor = (status: TicketStatus) => {
    const colors: Record<TicketStatus, string> = {
      open: "bg-blue-100 text-blue-800", in_progress: "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "";
  };

  const getTenantName = (tenantId: number) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant?.name || `Tenant ${tenantId}`;
  };

  const getResponseStatus = (ticket: Ticket) => {
    if (ticket.status === "closed") return "Kapatıldı";
    if (ticket.replies.length > 0) return "Yanıtlandı";
    return "Cevap Bekliyor";
  };

  const getResponseStatusColor = (ticket: Ticket) => {
    if (ticket.status === "closed") return "bg-gray-100 text-gray-800";
    if (ticket.replies.length > 0) return "bg-green-100 text-green-800";
    return "bg-orange-100 text-orange-800";
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      search === "" ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.description.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user.name.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const openTicketsCount = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={pageTitleCls}>Destek Talepleri Yönetimi</h2>
          <p className={pageSubtitleCls}>
            Tüm kullanıcıların destek taleplerini buradan yönetebilirsiniz
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-2.5 py-1">
          <AlertCircle className="h-3 w-3 mr-1.5" />
          {openTicketsCount} Açık Talep
        </Badge>
      </div>

      <Card className="border-gray-200/80 dark:border-gray-700/80 shadow-sm">
        <CardContent className={cardContentTightCls}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ara (konu, açıklama, kullanıcı)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tüm Durumlar</option>
              <option value="open">Açık</option>
              <option value="in_progress">İşlemde</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapalı</option>
            </Select>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">Tüm Öncelikler</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500 dark:text-gray-400">Yükleniyor...</CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500 dark:text-gray-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Henüz destek talebi yok.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b">
                  <tr>
                    <th className={`text-left ${tableHeadCompactCls}`}>Tenant</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Konu</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Tarih</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Öncelik</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Durum</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-xs text-gray-800 dark:text-gray-200">
                        {getTenantName(ticket.tenantId)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <div className="text-xs font-normal text-gray-900 dark:text-gray-100">{ticket.subject}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {ticket.user.name} • {ticket.user.email}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(ticket.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={cn(badgeCls, getPriorityColor(ticket.priority))}>
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(ticket.status)}
                            <Badge className={cn(badgeCls, getStatusColor(ticket.status))}>
                              {getStatusLabel(ticket.status)}
                            </Badge>
                          </div>
                          <Badge className={cn(badgeCls, getResponseStatusColor(ticket))}>
                            {getResponseStatus(ticket)}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1.5">
                          {ticket.status !== "closed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => handleUpdateStatus(ticket.id, "closed")}
                              disabled={submitting}
                            >
                              Kapat
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setSelectedTicket(ticket)}>
                            Detay
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="mb-2">{selectedTicket.subject}</CardTitle>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <span className="font-medium">{selectedTicket.user.name}</span>
                    <span>{selectedTicket.user.email}</span>
                    <span>•</span>
                    <span>{getTenantName(selectedTicket.tenantId)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      {getStatusIcon(selectedTicket.status)}
                      <Badge className={cn("px-2 py-0.5", getStatusColor(selectedTicket.status))}>
                        {getStatusLabel(selectedTicket.status)}
                      </Badge>
                    </span>
                    <Badge className={cn("px-2 py-0.5", getPriorityColor(selectedTicket.priority))}>
                      {getPriorityLabel(selectedTicket.priority)}
                    </Badge>
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(selectedTicket.createdAt).toLocaleString("tr-TR")}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)} className="ml-4">
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Açıklama</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                  {selectedTicket.description}
                </p>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-4">Yanıtlar ({selectedTicket.replies.length})</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedTicket.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={cn(
                        "p-3 rounded-lg",
                        reply.isAdmin
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                          : "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                      )}
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">
                          {reply.isAdmin ? (
                            <span className="flex items-center gap-1">
                              <Badge className="bg-blue-600 text-white text-xs">Admin</Badge>
                              Destek Ekibi
                            </span>
                          ) : (
                            selectedTicket.user.name
                          )}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(reply.createdAt).toLocaleString("tr-TR")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              </div>
              {selectedTicket.status !== "closed" && (
                <div className="border-t pt-4">
                  <Label htmlFor="reply">Yanıt Ekle</Label>
                  <Textarea
                    id="reply"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Yanıtınızı yazın..."
                    rows={4}
                    className="mt-2"
                  />
                  <Button
                    onClick={() => handleAddReply(selectedTicket.id)}
                    disabled={submitting || !replyMessage.trim()}
                    className="mt-2 flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? "Gönderiliyor..." : "Yanıt Gönder"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
