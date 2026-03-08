import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { MessageSquare, Plus, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: number;
  tenantId?: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  replies?: { id: number; message: string; isAdmin?: boolean }[];
}

const statusLabels: Record<TicketStatus, string> = {
  open: "Açık",
  in_progress: "İşlemde",
  resolved: "Çözüldü",
  closed: "Kapalı",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

export default function TicketsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", description: "", priority: "medium" as TicketPriority });
  const [submitting, setSubmitting] = useState(false);

  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const userId = user?.id || Number(localStorage.getItem("user_id") || "0");

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await apiClient("/api/tickets", {
        headers: { "x-tenant-id": String(tenantId), "x-user-id": String(userId) },
      });
      if (!res.ok) throw new Error("Yüklenemedi");
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      error("Destek talepleri yüklenemedi");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      error("Konu ve açıklama zorunludur");
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiClient("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": String(tenantId), "x-user-id": String(userId) },
        body: JSON.stringify(newTicket),
      });
      if (!res.ok) throw new Error("Oluşturulamadı");
      success("Destek talebi oluşturuldu");
      setNewTicket({ subject: "", description: "", priority: "medium" });
      setShowNewForm(false);
      await loadTickets();
    } catch {
      error("Destek talebi oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return s;
    }
  };

  const getStatusIcon = (s: TicketStatus) => {
    switch (s) {
      case "open": return <Clock className="h-4 w-4 text-blue-500" />;
      case "in_progress": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "resolved": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "closed": return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const getPriorityColor = (p: TicketPriority) => {
    switch (p) {
      case "low": return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      case "medium": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "urgent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Destek Talepleri</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Destek taleplerinizi buradan yönetebilirsiniz</p>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Talep
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle>Yeni Destek Talebi</CardTitle>
            <CardDescription>Yardıma ihtiyacınız mı var? Bize ulaşın</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Konu *</Label>
              <Input
                id="subject"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                placeholder="Örn: Hesaplama hatası"
              />
            </div>
            <div>
              <Label htmlFor="priority">Öncelik</Label>
              <Select
                id="priority"
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as TicketPriority })}
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="desc">Açıklama *</Label>
              <Textarea
                id="desc"
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Sorununuzu detaylı açıklayın..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={submitting}>{submitting ? "Gönderiliyor..." : "Gönder"}</Button>
              <Button variant="outline" onClick={() => setShowNewForm(false)}>İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card><CardContent className="p-6 text-center text-gray-500">Yükleniyor...</CardContent></Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Henüz destek talebiniz yok</p>
            <p className="text-sm text-gray-500 mt-2">Yeni talep oluşturmak için &quot;Yeni Talep&quot; butonuna tıklayın</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Konu</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Tarih</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Öncelik</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]">{t.subject}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge className={getPriorityColor(t.priority)}>{priorityLabels[t.priority]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {getStatusIcon(t.status)}
                          {statusLabels[t.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
