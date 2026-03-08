import { useToast } from "@/context/ToastContext";

export default function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="space-y-2 w-[92%] max-w-sm pointer-events-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-md shadow-lg border px-3 py-2 bg-white ${
            t.variant === "success" ? "border-green-300" : t.variant === "error" ? "border-red-300" : "border-gray-200"
          }`}
        >
          {t.title && <div className="text-sm font-semibold text-gray-900">{t.title}</div>}
          {t.description && <div className="text-sm text-gray-700 mt-0.5">{t.description}</div>}
          <div className="mt-2 flex justify-end">
            <button onClick={() => dismiss(t.id)} className="text-xs text-gray-500 hover:text-gray-700">Kapat</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
