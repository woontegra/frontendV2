/**
 * Yıllık izin / çalışılmayan günler dışlaması paneli.
 * Hesaplama tablosundan ayrı bir çerçevede, akordiyon ile açılıp kapatılabilir.
 * Tüm yıllık izin dışlaması yapan fazla mesai sayfalarında import edilerek kullanılır.
 * Tür seçenekleri: Yıllık İzin, Rapor, Diğer, UBGT.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import {
  saveExclusionSet,
  getAllExclusionSets,
  deleteExclusionSet,
} from "@/utils/exclusionStorage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const EXCLUSION_TYPES = ["Yıllık İzin", "Rapor", "Diğer", "UBGT"] as const;
type ExclusionType = (typeof EXCLUSION_TYPES)[number];

// Bolt tasarım stilleri (Kıdem/İhbar ile aynı)
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-gray-900";
const inputClassCompact = "w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white text-gray-900";
const btnOval = "px-4 py-2.5 rounded-full font-medium text-sm bg-white border border-gray-200 text-gray-700 hover:border-blue-400 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const btnOvalDestructive = "px-4 py-2.5 rounded-full font-medium text-sm bg-white border border-gray-200 text-red-600 hover:border-red-400 hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

/** API'den gelen dışlama kayıtlarını backend'in beklediği forma çevirir (start/end YYYY-MM-DD). */
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

export interface YillikIzinDislamalariPanelProps {
  exclusions: ExcludedDay[];
  setExclusions: React.Dispatch<React.SetStateAction<ExcludedDay[]>>;
  success?: (msg: string) => void;
  showToastError?: (msg: string) => void;
}

export function YillikIzinDislamalariPanel({
  exclusions,
  setExclusions,
  success = () => {},
  showToastError = () => {},
}: YillikIzinDislamalariPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [yilStart, setYilStart] = useState("");
  const [yilEnd, setYilEnd] = useState("");
  const [yilDays, setYilDays] = useState("");
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<
    { id: number; name: string; data: ExcludedDay[]; createdAt: string }[]
  >([]);

  const handleAdd = () => {
    setExclusions((a) => [
      ...a,
      {
        id: Math.random().toString(36).slice(2),
        type: "Yıllık İzin",
        start: yilStart,
        end: yilEnd,
        days: Number(yilDays) || 0,
      },
    ]);
    setYilStart("");
    setYilEnd("");
    setYilDays("");
  };

  const handleTypeChange = (idx: number, value: string) => {
    setExclusions((arr) =>
      arr.map((r, i) => (i === idx ? { ...r, type: value } : r))
    );
  };

  const handleClearAll = () => {
    setExclusions([]);
    setYilStart("");
    setYilEnd("");
    setYilDays("");
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden">
      {/* Akordiyon başlığı */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span>Yıllık izin / Çalışılmayan raporlu günler dışlanabilir.</span>
        <span className="text-gray-500" aria-hidden>
          {isOpen ? "▼" : "▶"}
        </span>
      </button>

      {/* İçerik */}
      {isOpen && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100">
          <div className="flex items-center justify-between pt-3">
            <div className="text-xs text-gray-600">
              Dışlama ekleyin; düşüm, girdiğiniz gün sayısına göre yapılır.
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setExclusionSaveName("");
                  setShowExclusionSaveModal(true);
                }}
                disabled={exclusions.length === 0}
                className={btnOval}
                title="Girdiğiniz dışlama günlerini bir isim vererek kaydedin."
              >
                Kaydet ⓘ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const sets = await getAllExclusionSets();
                  setSavedExclusionSets(sets);
                  setShowExclusionLoadModal(true);
                }}
                className={btnOval}
                title="Daha önce kaydettiğiniz dışlama günlerini yükleyin."
              >
                İçe Aktar ⓘ
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={exclusions.length === 0}
                className={btnOvalDestructive}
              >
                Tümünü Sil
              </button>
            </div>
          </div>

          {/* Kaydet modal */}
          {showExclusionSaveModal &&
            createPortal(
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
                onClick={() => setShowExclusionSaveModal(false)}
              >
                <div
                  className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-4">
                    Dışlanabilir Günleri Kaydet
                  </h3>
                  <div className="mb-4">
                    <Label htmlFor="exclusion-name" className="text-sm font-medium">
                      Kayıt Adı
                    </Label>
                    <input
                      id="exclusion-name"
                      type="text"
                      placeholder="Örn: Davacı A - Yıllık İzinler"
                      value={exclusionSaveName}
                      onChange={(e) => setExclusionSaveName(e.target.value)}
                      className={`mt-1 ${inputClass}`}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowExclusionSaveModal(false)}
                    >
                      İptal
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!exclusionSaveName.trim()) {
                          showToastError("Lütfen bir isim girin.");
                          return;
                        }
                        const saved = await saveExclusionSet(
                          exclusionSaveName.trim(),
                          exclusions
                        );
                        if (saved) {
                          success(`"${exclusionSaveName.trim()}" olarak kaydedildi!`);
                          setShowExclusionSaveModal(false);
                        } else {
                          showToastError("Kaydetme başarısız oldu.");
                        }
                      }}
                      disabled={!exclusionSaveName.trim()}
                    >
                      Kaydet
                    </Button>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* İçe aktar modal */}
          {showExclusionLoadModal &&
            createPortal(
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
                onClick={() => setShowExclusionLoadModal(false)}
              >
                <div
                  className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-4">
                    Kayıtlı Dışlanabilir Günler
                  </h3>
                  {savedExclusionSets.length === 0 ? (
                    <p className="text-gray-500 text-sm mb-4">
                      Henüz kayıtlı bir liste yok.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                      {savedExclusionSets.map((set) => (
                        <div
                          key={set.name}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                        >
                          <div>
                            <div className="font-medium text-sm">{set.name}</div>
                            <div className="text-xs text-gray-500">
                              {set.data.length} kayıt
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
onClick={() => {
                                  if (set.data?.length) {
                                    setExclusions(normalizeLoadedExclusions(set.data));
                                    success(`"${set.name}" içe aktarıldı!`);
                                    setShowExclusionLoadModal(false);
                                  }
                                }}
                            >
                              Yükle
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                if (confirm(`"${set.name}" silinsin mi?`)) {
                                  await deleteExclusionSet(set.id);
                                  const newSets = await getAllExclusionSets();
                                  setSavedExclusionSets(newSets);
                                  success("Silindi!");
                                }
                              }}
                            >
                              Sil
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowExclusionLoadModal(false)}
                    >
                      Kapat
                    </Button>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* Form: Başlangıç, Bitiş, Gün, Ekle */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <input
              type="date"
              className={`col-span-4 ${inputClass}`}
              placeholder="Başlangıç"
              value={yilStart}
              onChange={(e) => setYilStart(e.target.value)}
            />
            <input
              type="date"
              className={`col-span-4 ${inputClass}`}
              placeholder="Bitiş"
              value={yilEnd}
              onChange={(e) => setYilEnd(e.target.value)}
            />
            <input
              className={`col-span-3 ${inputClass}`}
              placeholder="Gün"
              value={yilDays}
              onChange={(e) => setYilDays(e.target.value)}
            />
            <button
              type="button"
              className="col-span-1 px-4 py-2.5 rounded-full font-medium text-sm text-blue-600 border border-dashed border-gray-200 hover:border-blue-400 transition-all"
              onClick={handleAdd}
            >
              + Ekle
            </button>
          </div>

          {/* Liste */}
          {exclusions.length > 0 && (
            <div className="mt-2">
              <div className="grid grid-cols-12 text-xs text-gray-600 font-medium px-2">
                <div className="col-span-3">Tür</div>
                <div className="col-span-3">Başlangıç</div>
                <div className="col-span-3">Bitiş</div>
                <div className="col-span-2">Gün</div>
                <div className="col-span-1" />
              </div>
              {exclusions.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="grid grid-cols-12 gap-2 items-center mt-2"
                >
                  <select
                    value={ex.type}
                    onChange={(e) =>
                      handleTypeChange(idx, e.target.value as ExclusionType)
                    }
                    className={`col-span-3 ${inputClassCompact}`}
                  >
                    {EXCLUSION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={ex.start}
                    onChange={(e) =>
                      setExclusions((arr) =>
                        arr.map((r, i) =>
                          i === idx ? { ...r, start: e.target.value } : r
                        )
                      )}
                    className={`col-span-3 ${inputClassCompact}`}
                  />
                  <input
                    type="date"
                    value={ex.end}
                    onChange={(e) =>
                      setExclusions((arr) =>
                        arr.map((r, i) =>
                          i === idx ? { ...r, end: e.target.value } : r
                        )
                      )}
                    className={`col-span-3 ${inputClassCompact}`}
                  />
                  <input
                    value={String(ex.days)}
                    onChange={(e) =>
                      setExclusions((arr) =>
                        arr.map((r, i) =>
                          i === idx
                            ? { ...r, days: Number(e.target.value) || 0 }
                            : r
                        )
                      )}
                    className={`col-span-2 ${inputClassCompact}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExclusions((arr) => arr.filter((_, i) => i !== idx))
                    }
                    className="col-span-1 text-sm text-red-600 hover:underline"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-600 flex items-center gap-1">
            <span
              className="cursor-help"
              title="Düşüm, girdiğiniz gün sayısına göre yapılır. Tarih aralığından otomatik hesaplanan değil."
            >
              ℹ️
            </span>
            <span>Düşüm, girdiğiniz gün sayısına göre yapılır.</span>
          </div>
        </div>
      )}
    </div>
  );
}
