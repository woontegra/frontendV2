/**
 * Local toast hook - standalone implementation
 */

import { useState, useCallback, useMemo } from "react";

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

export function useToast(): ToastContextType {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, durationMs: 3000, variant: "info", ...t };
    setToasts((prev) => [...prev, item]);
    if (item.durationMs && item.durationMs > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, item.durationMs);
    }
  }, []);

  const success = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "success", durationMs: 4000 });
  }, [show]);
  
  const error = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "error", durationMs: 4000 });
  }, [show]);
  
  const info = useCallback((title: string, description?: string) => {
    show({ title, description, variant: "info", durationMs: 3000 });
  }, [show]);

  // CRITICAL: Only include toasts in dependencies, not the callback functions
  // Including callbacks causes infinite re-creation and stale closures
  return useMemo(() => ({ toasts, show, dismiss, success, error, info }), [toasts, show, dismiss]);
}
