import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  ChevronLeft,
  RefreshCw,
  Send,
  UserCheck,
  XCircle,
  Circle,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/utils/apiClient";

const POLL_INTERVAL = 5000;
const PRESENCE_HEARTBEAT = 60 * 1000;

interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  userId: number;
  tenantId: number;
  assignedTo: number | null;
  status: string;
  lastMessageAt: string | null;
  user: { id: number; name: string; email: string };
  assignedAdmin: { id: number; name: string; email: string } | null;
  unreadCount: number;
}

export default function AdminChatPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const loadMyPresence = useCallback(async () => {
    try {
      const res = await apiClient("/api/admin/presence/me");
      if (res.ok) {
        const data = await res.json();
        setIsOnline(!!data?.isOnline);
      }
    } catch {
      setIsOnline(false);
    }
  }, []);

  const togglePresence = useCallback(async () => {
    try {
      const res = await apiClient("/api/admin/presence/toggle", {
        method: "POST",
        body: JSON.stringify({ isOnline: !isOnline }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsOnline(!!data?.isOnline);
      }
    } catch {
      // ignore
    }
  }, [isOnline]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const q = filter !== "all" ? `?filter=${filter}` : "";
      const res = await apiClient(`/api/admin/chat/conversations${q}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data?.conversations || []);
      }
    } catch {
      setConversations([]);
    }
  }, [token, filter]);

  const loadMessages = useCallback(async () => {
    if (!selected || !token) return;
    try {
      const res = await apiClient(`/api/admin/chat/messages/${selected.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data?.messages || []);
      }
    } catch {
      setMessages([]);
    }
  }, [selected, token]);

  useEffect(() => {
    loadMyPresence();
  }, [loadMyPresence]);

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (selected) {
      loadMessages();
      const t = setInterval(loadMessages, POLL_INTERVAL);
      return () => clearInterval(t);
    }
  }, [selected, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (!isOnline || !token) return;
    const heartbeat = () => {
      apiClient("/api/admin/presence/toggle", {
        method: "POST",
        body: JSON.stringify({ isOnline: true }),
      }).catch(() => {});
    };
    const t = setInterval(heartbeat, PRESENCE_HEARTBEAT);
    return () => clearInterval(t);
  }, [isOnline, token]);

  const handleAssign = async () => {
    if (!selected || !token) return;
    try {
      const res = await apiClient(`/api/admin/chat/assign/${selected.id}`, {
        method: "POST",
      });
      if (res.ok) {
        loadConversations();
        setSelected((s) => (s ? { ...s, assignedTo: 1 } : null));
      }
    } catch {
      // ignore
    }
  };

  const handleClose = async () => {
    if (!selected || !token) return;
    try {
      const res = await apiClient(`/api/admin/chat/close/${selected.id}`, {
        method: "POST",
      });
      if (res.ok) {
        setSelected(null);
        loadConversations();
      }
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    const text = input.trim().slice(0, 1000);
    if (!text || !selected || sending || !token) return;
    setSending(true);
    try {
      const res = await apiClient("/api/admin/chat/message", {
        method: "POST",
        body: JSON.stringify({ conversationId: selected.id, message: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInput("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/80 dark:bg-gray-950/50">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                <MessageCircle className="h-8 w-8 text-indigo-600" />
                Canlı Sohbet
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Konuşmaları yönetin, kullanıcılara yanıt verin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={togglePresence}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                isOnline
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {isOnline ? (
                <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500 animate-pulse" />
              ) : (
                <CircleDot className="h-2.5 w-2.5 text-gray-500" />
              )}
              {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
            </button>
            <Button variant="outline" size="sm" onClick={loadConversations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[400px]">
          <div className="lg:col-span-1 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filter === "all"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilter("unassigned")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filter === "unassigned"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Atanmamış
              </button>
              <button
                onClick={() => setFilter("assigned")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filter === "assigned"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Bana atanan
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {conversations.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Açık konuşma yok
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      selected?.id === c.id
                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {c.user?.name || "Kullanıcı"}
                      </span>
                      {c.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {c.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {c.user?.email}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {c.lastMessageAt
                        ? new Date(c.lastMessageAt).toLocaleString("tr-TR")
                        : "Henüz mesaj yok"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                Bir konuşma seçin
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {selected.user?.name || "Kullanıcı"}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selected.user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {!selected.assignedTo && (
                      <Button size="sm" onClick={handleAssign} variant="outline">
                        <UserCheck className="h-4 w-4 mr-2" />
                        Sahiplen
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={handleClose}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Kapat
                    </Button>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.senderType === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                          m.senderType === "admin"
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <p>{m.message}</p>
                        <p className="text-[10px] opacity-80 mt-0.5">
                          {new Date(m.createdAt).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Yanıt yazın..."
                      maxLength={1000}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
