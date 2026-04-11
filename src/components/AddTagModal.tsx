import { useState } from "react";
import { X } from "lucide-react";

interface AddTagModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (color: string, label: string) => void;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#64748b", "#78716c",
];

export default function AddTagModal({ open, onClose, onAdd }: AddTagModalProps) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[5]);

  if (!open) return null;

  const handleAdd = () => {
    if (!label.trim()) return;
    onAdd(color, label.trim());
    setLabel("");
    setColor(PRESET_COLORS[5]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Kategori Etiketi Ekle</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-5 space-y-4">
          {/* Etiket adı */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Etiket Adı
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="ör: Acil, Revize gerekli…"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Renk seçimi */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Renk
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                    color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {/* Önizleme */}
          {label.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Önizleme:</span>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                style={{ backgroundColor: color }}
              >
                {label}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleAdd}
            disabled={!label.trim()}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
