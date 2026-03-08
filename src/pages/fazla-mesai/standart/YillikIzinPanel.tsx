/**
 * Yıllık izin / Çalışılmayan raporlu günler - mobil uyumlu özel panel
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import {
  saveExclusionSet,
  getAllExclusionSets,
  deleteExclusionSet,
} from "@/utils/exclusionStorage";

const EXCLUSION_TYPES = ["Yıllık İzin", "Rapor", "Diğer", "UBGT"] as const;
type ExclusionType = (typeof EXCLUSION_TYPES)[number];

const inputCls = "w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const btnCls = "px-3 py-2 text-sm font-medium rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors";

function normalizeLoadedExclusions(raw: unknown): ExcludedDay[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((item: Record<string, unknown>, index: number) => {
      const startRaw = (item?.start ?? item?.startDate ?? "") as string;
      const endRaw = (item?.end ?? item?.endDate ?? "") as string;
      const start = toYYYYMMDD(startRaw);
      const end = toYYYYMMDD(endRaw);
      return {
        id: typeof item?.id === "string" ? item.id : `import-${index}-${Math.random().toString(36).slice(2)}`,
        type: (item?.type as string) ?? "Yıllık İzin",
        start,
        end,
        days: Number(item?.days) ?? 0,
      };
    })
    .filter((e: ExcludedDay) => e.start && e.end);
}

function toYYYYMMDD(value: string): string {
  if (!value || typeof value !== "string") return "";
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ddmmyy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) {
    const y = iso.getFullYear();
    const m = String(iso.getMonth() + 1).padStart(2, "0");
    const day = String(iso.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return "";
}

export interface YillikIzinPanelProps {
  exclusions: ExcludedDay[];
  setExclusions: React.Dispatch<React.SetStateAction<ExcludedDay[]>>;
  success?: (msg: string) => void;
  showToastError?: (msg: string) => void;
}

export function YillikIzinPanel({ exclusions, setExclusions, success = () => {}, showToastError = () => {} }: YillikIzinPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [yilStart, setYilStart] = useState("");
  const [yilEnd, setYilEnd] = useState("");
  const [yilDays, setYilDays] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<{ id: number; name: string; data: ExcludedDay[]; createdAt: string }[]>([]);

  const handleAdd = () => {
    setExclusions((a) => [
      ...a,
      { id: Math.random().toString(36).slice(2), type: "Yıllık İzin", start: yilStart, end: yilEnd, days: Number(yilDays) || 0 },
    ]);
    setYilStart("");
    setYilEnd("");
    setYilDays("");
  };

  const handleClearAll = () => {
    setExclusions([]);
    setYilStart("");
    setYilEnd("");
    setYilDays("");
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span>Yıllık izin / Çalışılmayan raporlu günler dışlanabilir.</span>
        <span className="text-gray-500" aria-hidden>{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-600 dark:text-gray-400 pt-3">
            Dışlama ekleyin; düşüm, girdiğiniz gün sayısına göre yapılır.
          </p>

          {/* Butonlar - mobilde flex-wrap ile */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setSaveName(""); setShowSaveModal(true); }} disabled={exclusions.length === 0} className={btnCls}>
              Kaydet
            </button>
            <button
              type="button"
              onClick={async () => { const s = await getAllExclusionSets(); setSavedSets(s); setShowLoadModal(true); }}
              className={btnCls}
            >
              İçe Aktar
            </button>
            <button type="button" onClick={handleClearAll} disabled={exclusions.length === 0} className={`${btnCls} text-red-600 dark:text-red-400`}>
              Tümünü Sil
            </button>
          </div>

          {/* Form - mobilde stack */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
            <div className="flex-1 min-w-[120px] sm:min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-0.5">Başlangıç</label>
              <input type="date" value={yilStart} onChange={(e) => setYilStart(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1 min-w-[120px] sm:min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-0.5">Bitiş</label>
              <input type="date" value={yilEnd} onChange={(e) => setYilEnd(e.target.value)} className={inputCls} />
            </div>
            <div className="w-full sm:w-20">
              <label className="block text-xs text-gray-500 mb-0.5">Gün</label>
              <input type="number" placeholder="0" value={yilDays} onChange={(e) => setYilDays(e.target.value)} className={inputCls} />
            </div>
            <button type="button" onClick={handleAdd} className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700">
              + Ekle
            </button>
          </div>

          {/* Liste */}
          {exclusions.length > 0 && (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-1 text-xs text-gray-600 dark:text-gray-400 font-medium">
                <div className="col-span-3 sm:col-span-2">Tür</div>
                <div className="col-span-3">Başlangıç</div>
                <div className="col-span-3">Bitiş</div>
                <div className="col-span-2">Gün</div>
                <div className="col-span-1" />
              </div>
              {exclusions.map((ex, idx) => (
                <div key={ex.id} className="grid grid-cols-12 gap-1 items-center">
                  <select
                    value={ex.type}
                    onChange={(e) => setExclusions((arr) => arr.map((r, i) => (i === idx ? { ...r, type: e.target.value } : r)))}
                    className={`col-span-3 sm:col-span-2 ${inputCls} py-1.5 text-xs`}
                  >
                    {EXCLUSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    type="date"
                    value={ex.start}
                    onChange={(e) => setExclusions((arr) => arr.map((r, i) => (i === idx ? { ...r, start: e.target.value } : r)))}
                    className={`col-span-3 ${inputCls} py-1.5 text-xs`}
                  />
                  <input
                    type="date"
                    value={ex.end}
                    onChange={(e) => setExclusions((arr) => arr.map((r, i) => (i === idx ? { ...r, end: e.target.value } : r)))}
                    className={`col-span-3 ${inputCls} py-1.5 text-xs`}
                  />
                  <input
                    type="number"
                    value={ex.days || ""}
                    onChange={(e) => setExclusions((arr) => arr.map((r, i) => (i === idx ? { ...r, days: Number(e.target.value) || 0 } : r)))}
                    className={`col-span-2 ${inputCls} py-1.5 text-xs`}
                  />
                  <button type="button" onClick={() => setExclusions((arr) => arr.filter((_, i) => i !== idx))} className="col-span-1 text-red-600 text-sm">Sil</button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Düşüm, girdiğiniz gün sayısına göre yapılır.
          </p>
        </div>
      )}

      {showSaveModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Dışlanabilir Günleri Kaydet</h3>
              <input type="text" placeholder="Kayıt adı" value={saveName} onChange={(e) => setSaveName(e.target.value)} className={`${inputCls} mb-4`} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowSaveModal(false)} className={btnCls}>İptal</button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!saveName.trim()) { showToastError("Lütfen bir isim girin."); return; }
                    const ok = await saveExclusionSet(saveName.trim(), exclusions);
                    if (ok) { success(`"${saveName.trim()}" kaydedildi.`); setShowSaveModal(false); } else { showToastError("Kaydetme başarısız."); }
                  }}
                  disabled={!saveName.trim()}
                  className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showLoadModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLoadModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Kayıtlı Dışlanabilir Günler</h3>
              {savedSets.length === 0 ? (
                <p className="text-gray-500 text-sm">Henüz kayıtlı liste yok.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {savedSets.map((s) => (
                    <div key={s.name} className="flex justify-between items-center p-2 border rounded">
                      <span className="font-medium text-sm">{s.name} ({s.data.length} kayıt)</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setExclusions(normalizeLoadedExclusions(s.data)); success(`"${s.name}" yüklendi.`); setShowLoadModal(false); }} className={btnCls}>Yükle</button>
                        <button type="button" onClick={async () => { if (confirm(`"${s.name}" silinsin mi?`)) { await deleteExclusionSet(s.id); setSavedSets(await getAllExclusionSets()); success("Silindi."); } }} className={`${btnCls} text-red-600`}>Sil</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setShowLoadModal(false)} className={btnCls}>Kapat</button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
