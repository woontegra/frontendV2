import { useEffect, useState, useCallback, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/utils/apiClient";

const POLL_INTERVAL = 5000;

interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: number;
  message: string;
  imageUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [hasOnlineAdmin, setHasOnlineAdmin] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  // ── Admin çevrimiçi durumunu kontrol et ────────────────────────────────────
  const loadPresence = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient("/api/admin/presence/status");
      if (res.ok) {
        const data = await res.json();
        setHasOnlineAdmin(!!data?.hasOnlineAdmin);
      }
    } catch (_e) {
      setHasOnlineAdmin(false);
    }
  }, [token]);

  // ── Konuşmayı yükle ────────────────────────────────────────────────────────
  const loadConversation = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient("/api/chat/conversation");
      if (res.ok) {
        const data = await res.json();
        setMessages(data?.messages || []);
        setConversationId(data?.conversation?.id || null);
      }
    } catch (_e) { /* sessiz */ }
  }, [token]);

  // ── Mesajları yenile ───────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!token || !open) return;
    try {
      const url = conversationId
        ? `/api/chat/messages?conversationId=${conversationId}`
        : "/api/chat/conversation";
      const res = await apiClient(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data?.messages || []);
        if (!conversationId && data?.conversation?.id) {
          setConversationId(data.conversation.id);
        }
      }
    } catch (_e) { /* sessiz */ }
  }, [token, open, conversationId]);

  // Presence 5 sn'de bir kontrol
  useEffect(() => {
    loadPresence();
    const t = setInterval(loadPresence, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [loadPresence]);

  // Panel açılınca konuşmayı yükle
  useEffect(() => {
    if (open) {
      setLoading(true);
      loadConversation().finally(() => setLoading(false));
    }
  }, [open, loadConversation]);

  // Açıkken mesajları 5 sn'de bir yenile
  useEffect(() => {
    if (!open) return;
    const t = setInterval(loadMessages, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [open, loadMessages]);

  // Yeni mesajda aşağı kaydır
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  // ── Mesaj gönder ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim().slice(0, 1000);
    if (!text || sending) return;

    let cid = conversationId;
    if (!cid) {
      try {
        const r = await apiClient("/api/chat/conversation");
        if (!r.ok) return;
        const d = await r.json();
        cid = d?.conversation?.id || null;
        if (cid) setConversationId(cid);
      } catch (_e) { return; }
    }
    if (!cid) return;

    setSending(true);
    try {
      const res = await apiClient("/api/chat/message", {
        method: "POST",
        body: JSON.stringify({ conversationId: cid, message: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setInput("");
      }
    } finally {
      setSending(false);
    }
  };

  // Token yoksa veya çevrimiçi admin yoksa gösterme
  if (!token || !hasOnlineAdmin) return null;

  return (
    <>
      {/* Sağ alt köşe - Canlı Destek butonu */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-50 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all active:scale-95"
          aria-label="Canlı destek"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-[9px] font-semibold leading-none">Aktif</span>
        </button>
      )}

      {/* Sohbet penceresi */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={() => setOpen(false)}
          />
          <div className="relative pointer-events-auto w-full max-w-sm h-[70vh] max-h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-indigo-600">
              <div>
                <h3 className="font-semibold text-white text-sm">Canlı Destek</h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Şu an çevrimiçi · Hemen yanıtlıyoruz
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-indigo-500 transition-colors"
                aria-label="Kapat"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Mesaj alanı */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <p className="text-xs text-gray-400 text-center py-8">Yükleniyor...</p>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <MessageCircle className="w-10 h-10 text-gray-200 mx-auto" />
                  <p className="text-xs text-gray-400">
                    Merhaba! Size nasıl yardımcı olabiliriz?
                  </p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.senderType === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm space-y-1 ${
                      m.senderType === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
                    }`}>
                      {m.senderType === "admin" && (
                        <p className="text-[10px] font-semibold opacity-70">Bilirkişi Hesap</p>
                      )}
                      {m.imageUrl && (
                        <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="block rounded overflow-hidden">
                          <img src={m.imageUrl} alt="Görsel" className="max-w-full max-h-40 object-contain" />
                        </a>
                      )}
                      {m.message && m.message !== "[Görsel]" && <p>{m.message}</p>}
                      <p className="text-[10px] opacity-60 mt-0.5">
                        {new Date(m.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mesaj giriş alanı */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value.slice(0, 1000))}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Mesajınızı yazın..."
                  maxLength={1000}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
