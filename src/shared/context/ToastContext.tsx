import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: "success" | "error" | "info";
  durationMs?: number;
};

type ToastContextType = {
  toasts: ToastItem[];
  show: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, durationMs: 1000, variant: "info", ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs && item.durationMs > 0) {
      setTimeout(() => dismiss(id), item.durationMs);
    }
  }, [dismiss]);

  // Opsiyonel: Backend'de notifications endpoint'i varsa senkronize et
  // Şu anda endpoint mevcut değil, bu yüzden sessizce yok sayıyoruz
  const syncNotification = async (title?: string, variant?: string) => {
    // Endpoint mevcut değil, bu yüzden çağrıyı atlıyoruz
    // Gelecekte backend'de endpoint eklendiğinde bu kodu aktif edebilirsiniz
    return;
    
    /* 
    // Future: When backend endpoint is ready, uncomment and use apiClient
    import { apiClient } from "@/utils/apiClient";
    try {
      const response = await apiClient("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ title: title || "Bildirim", type: variant || "info" }),
      });
      if (!response.ok) {
        return;
      }
    } catch (error) {
      // Sessizce yok say
      return;
    }
    */
  };

  const success = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "success", durationMs: 3000 });
    // syncNotification(title, "success"); // Endpoint mevcut değil
  }, [show]);
  const error = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "error", durationMs: 4000 });
    // syncNotification(title, "error"); // Endpoint mevcut değil
  }, [show]);
  const info = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "info", durationMs: 3000 });
    // syncNotification(title, "info"); // Endpoint mevcut değil
  }, [show]);

  const value = useMemo(() => ({ toasts, show, dismiss, success, error, info }), [toasts, show, dismiss, success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/**
 * ZARİF TOASTER COMPONENT
 * Modern gradient tasarımı, animasyonlar ve dark mode desteği ile
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[92%] max-w-md pointer-events-auto">
      {toasts.map((t) => {
        const progressDuration = t.durationMs || 3000;
        return (
          <div
            key={t.id}
            className={`
              relative overflow-hidden rounded-xl shadow-lg backdrop-blur-sm
              animate-in slide-in-from-right-5 fade-in duration-300
              ${t.variant === "success" 
                ? "bg-white/95 dark:bg-gray-800/95 border-l-4 border-green-500" 
                : t.variant === "error" 
                ? "bg-white/95 dark:bg-gray-800/95 border-l-4 border-red-500" 
                : "bg-white/95 dark:bg-gray-800/95 border-l-4 border-blue-500"
              }
            `}
          >
            {/* Gradient accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              t.variant === "success" 
                ? "bg-gradient-to-r from-emerald-400 to-teal-500" 
                : t.variant === "error" 
                ? "bg-gradient-to-r from-red-400 to-rose-500" 
                : "bg-gradient-to-r from-blue-400 to-cyan-500"
            }`} />
            
            <div className="p-4 flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 ${
                t.variant === "success" ? "text-green-500" : t.variant === "error" ? "text-red-500" : "text-blue-500"
              }`}>
                {t.variant === "success" ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : t.variant === "error" ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                {t.title && (
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t.title}
                  </div>
                )}
                {t.description && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t.description}
                  </div>
                )}
              </div>
              
              {/* Close button */}
              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
              <div 
                className={`h-full ${
                  t.variant === "success" 
                    ? "bg-green-500" 
                    : t.variant === "error" 
                    ? "bg-red-500" 
                    : "bg-blue-500"
                }`}
                style={{
                  animation: `shrink ${progressDuration}ms linear forwards`
                }}
              />
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
