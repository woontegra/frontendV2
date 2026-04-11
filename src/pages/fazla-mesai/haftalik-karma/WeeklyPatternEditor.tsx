/**
 * Haftalık Karma Desen Editörü - Gün grupları (in/out saatleri)
 */

import { Trash2 } from "lucide-react";
import type { PatternDay } from "./types";

interface WeeklyPatternEditorProps {
  days: PatternDay[];
  onUpdate: (days: PatternDay[]) => void;
  isReadOnly?: boolean;
}

const inputCls =
  "w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function WeeklyPatternEditor({ days, onUpdate, isReadOnly }: WeeklyPatternEditorProps) {
  const handleRemoveDay = (index: number) => {
    onUpdate(days.filter((_, i) => i !== index));
  };

  const handleUpdateDay = (index: number, updates: Partial<PatternDay>) => {
    if (updates.dayCount !== undefined) {
      const otherSum = days.reduce((s, d, i) => (i !== index ? s + (d.dayCount || 0) : s), 0);
      const maxForThis = Math.max(0, 7 - otherSum);
      updates = { ...updates, dayCount: Math.min(Math.max(0, updates.dayCount), maxForThis) };
    }
    onUpdate(days.map((d, i) => (i === index ? { ...d, ...updates } : d)));
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Haftalık Karma Desen</span>
      </div>

      {days.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-600">
          Henüz gün grubu eklenmedi. &quot;Gün Grubu Ekle&quot; ile başlayın.
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 min-w-0">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Gün Sayısı</label>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={day.dayCount === 0 ? "" : day.dayCount}
                    onChange={(e) => handleUpdateDay(index, { dayCount: e.target.value === "" ? 0 : (parseInt(e.target.value, 10) || 1) })}
                    className={inputCls}
                    readOnly={!!isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Giriş</label>
                  <input
                    type="time"
                    value={day.startTime || ""}
                    onChange={(e) => handleUpdateDay(index, { startTime: e.target.value })}
                    className={inputCls}
                    readOnly={!!isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Çıkış</label>
                  <input
                    type="time"
                    value={day.endTime || ""}
                    onChange={(e) => handleUpdateDay(index, { endTime: e.target.value })}
                    className={inputCls}
                    readOnly={!!isReadOnly}
                  />
                </div>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveDay(index)}
                  className="self-start sm:self-center shrink-0 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
