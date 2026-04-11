/**
 * Dışlanabilir Günler Editörü — Hafta Tatili Standart
 * Kompakt, inline panel (modal değil)
 */

import { useState, useEffect } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const inputCls =
  "w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";

export type ExcludeType = "Yıllık İzin" | "Rapor" | "Diğer";

export interface ExcludeDay {
  id: string;
  type: ExcludeType;
  start: string;
  end: string;
  days: number;
}

interface Props {
  excludedDays?: ExcludeDay[];
  onChange?: (days: ExcludeDay[]) => void;
  haftaTatiliExcludedDays?: ExcludeDay[];
  onHaftaTatiliExcludedDaysChange?: (days: ExcludeDay[]) => void;
}

function toUTC(s: string): Date | null {
  if (!s) return null;
  try {
    const d = new Date(s + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const TYPES: ExcludeType[] = ["Yıllık İzin", "Rapor", "Diğer"];

function newRow(type: ExcludeType = "Yıllık İzin"): ExcludeDay {
  return { id: Date.now().toString() + Math.random(), type, start: "", end: "", days: 0 };
}

export default function HaftaTatiliExcludeDays(props: Props) {
  const excludedDays = props.excludedDays ?? props.haftaTatiliExcludedDays ?? [];
  const onChange = props.onChange ?? props.onHaftaTatiliExcludedDaysChange ?? (() => {});
  const { error } = useToast();
  const [draft, setDraft] = useState<ExcludeDay>(newRow());

  // Gün sayısını otomatik hesapla
  useEffect(() => {
    if (draft.start && draft.end) {
      const s = toUTC(draft.start);
      const e = toUTC(draft.end);
      if (s && e) {
        const days = Math.max(0, differenceInCalendarDays(e, s) + 1);
        setDraft((p) => ({ ...p, days }));
      }
    }
  }, [draft.start, draft.end]);

  const handleAdd = () => {
    if (!draft.start || !draft.end) {
      error("Başlangıç ve bitiş tarihi giriniz");
      return;
    }
    const s = toUTC(draft.start);
    const e = toUTC(draft.end);
    if (!s || !e || s > e) {
      error("Geçerli bir tarih aralığı girin");
      return;
    }
    onChange([...excludedDays, { ...draft, id: Date.now().toString() }]);
    setDraft(newRow(draft.type));
  };

  const handleRemove = (id: string) => {
    onChange(excludedDays.filter((d) => d.id !== id));
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Dışlanabilir Günler</h2>

      {/* Eklenmiş günler listesi */}
      {excludedDays.length > 0 && (
        <div className="mb-3 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_2.5rem_2rem] text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
            <span>Tür</span>
            <span>Başlangıç</span>
            <span>Bitiş</span>
            <span className="text-right">Gün</span>
            <span />
          </div>
          {excludedDays.map((d) => (
            <div
              key={d.id}
              className="grid grid-cols-[1fr_1fr_1fr_2.5rem_2rem] items-center px-2 py-1.5 border-b last:border-b-0 border-gray-100 dark:border-gray-700/50 text-xs text-gray-700 dark:text-gray-300"
            >
              <span>{d.type}</span>
              <span>{d.start ? new Date(d.start).toLocaleDateString("tr-TR") : "-"}</span>
              <span>{d.end ? new Date(d.end).toLocaleDateString("tr-TR") : "-"}</span>
              <span className="text-right font-medium">{d.days}</span>
              <button
                type="button"
                onClick={() => handleRemove(d.id)}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                aria-label="Sil"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Yeni ekle formu */}
      <div className="p-2.5 rounded border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label className={labelCls}>Tür</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as ExcludeType }))}
              className={inputCls}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Başlangıç</label>
            <input
              type="date"
              value={draft.start}
              onChange={(e) => setDraft((p) => ({ ...p, start: e.target.value }))}
              className={inputCls}
              max="9999-12-31"
            />
          </div>
          <div>
            <label className={labelCls}>Bitiş</label>
            <input
              type="date"
              value={draft.end}
              onChange={(e) => setDraft((p) => ({ ...p, end: e.target.value }))}
              className={inputCls}
              max="9999-12-31"
            />
          </div>
          <div>
            <label className={labelCls}>Gün (otomatik)</label>
            <input
              type="number"
              value={draft.days || ""}
              onChange={(e) => setDraft((p) => ({ ...p, days: Math.max(0, Number(e.target.value)) }))}
              placeholder="0"
              min="0"
              className={inputCls}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          <Plus className="w-3 h-3" />
          Ekle
        </button>
      </div>
    </section>
  );
}
