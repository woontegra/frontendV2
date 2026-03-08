/**
 * toast.tsx
 * Lokal toast sistemi - SADECE bu sayfa için
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

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
    const item: ToastItem = { id, durationMs: 3000, variant: "info", ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs && item.durationMs > 0) {
      setTimeout(() => dismiss(id), item.durationMs);
    }
  }, [dismiss]);

  const success = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "success", durationMs: 3000 });
  }, [show]);
  
  const error = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "error", durationMs: 4000 });
  }, [show]);
  
  const info = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "info", durationMs: 3000 });
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

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none max-w-md">
      {toasts.map((t) => {
        const isSuccess = t.variant === "success";
        const isError = t.variant === "error";
        const isInfo = t.variant === "info";
        
        const gradientClass = isSuccess 
          ? "from-green-400 to-emerald-600" 
          : isError 
          ? "from-red-400 to-rose-600" 
          : "from-blue-400 to-indigo-600";
        
        const borderClass = isSuccess 
          ? "border-green-200/50 dark:border-green-700" 
          : isError 
          ? "border-red-200/50 dark:border-red-700" 
          : "border-blue-200/50 dark:border-blue-700";
        
        const iconBgClass = isSuccess 
          ? "bg-green-100 dark:bg-green-900/30" 
          : isError 
          ? "bg-red-100 dark:bg-red-900/30" 
          : "bg-blue-100 dark:bg-blue-900/30";
        
        const iconColorClass = isSuccess 
          ? "text-green-600 dark:text-green-400" 
          : isError 
          ? "text-red-600 dark:text-red-400" 
          : "text-blue-600 dark:text-blue-400";
        
        const titleColorClass = isSuccess 
          ? "text-green-900 dark:text-green-300" 
          : isError 
          ? "text-red-900 dark:text-red-300" 
          : "text-blue-900 dark:text-blue-300";
        
        return (
          <div
            key={t.id}
            className={`relative overflow-hidden pointer-events-auto backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border ${borderClass} rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 animate-in slide-in-from-right fade-in`}
          >
            {/* Gradient bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradientClass}`} />
            
            <div className="flex items-start gap-3 p-4 pl-5">
              {/* Icon */}
              <div className={`w-6 h-6 rounded-full ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
                {isSuccess && (
                  <svg className={`w-4 h-4 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isError && (
                  <svg className={`w-4 h-4 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {isInfo && (
                  <svg className={`w-4 h-4 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                {t.title && <div className={`font-semibold text-sm ${titleColorClass}`}>{t.title}</div>}
                {t.description && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t.description}</div>}
              </div>
              
              {/* Close */}
              <button 
                onClick={() => dismiss(t.id)} 
                className="w-5 h-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Progress bar */}
            <div className={`h-1 bg-gradient-to-r ${gradientClass} opacity-30`}>
              <div className={`h-full bg-gradient-to-r ${gradientClass}`} style={{ animation: `shrink ${t.durationMs || 3000}ms linear forwards` }} />
            </div>
          </div>
        );
      })}
      
      <style>{`
        @keyframes slide-in-from-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        .animate-in {
          animation: slide-in-from-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
