/**
 * Dışlanabilir Günler — Hafta Tatili (UBGT ile aynı kart ve form düzeni)
 */

import { useState, useEffect } from "react";
import { differenceInCalendarDays } from "date-fns";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveExclusionSet, getAllExclusionSets, deleteExclusionSet } from "@/utils/exclusionStorage";
import {
  calcInputCls,
  calcLabelCls,
  calcSectionTitleCls,
  calcSectionBoxCls,
  calcHelperTextCls,
} from "@/shared/calcPageFormStyles";

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
  onImport?: () => void;
}

function toUTC(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function HaftaTatiliExcludeDays(props: Props) {
  const excludedDays = props.excludedDays ?? props.haftaTatiliExcludedDays ?? [];
  const onChange = props.onChange ?? props.onHaftaTatiliExcludedDaysChange ?? (() => {});
  const { error, success } = useToast();

  const [htQuickStart, setHtQuickStart] = useState("");
  const [htQuickEnd, setHtQuickEnd] = useState("");
  const [htQuickDays, setHtQuickDays] = useState("");

  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<
    { id: number; name: string; data: ExcludeDay[]; createdAt: string }[]
  >([]);

  useEffect(() => {
    if (htQuickStart && htQuickEnd) {
      const s = toUTC(htQuickStart);
      const e = toUTC(htQuickEnd);
      if (s && e) {
        const days = Math.max(0, differenceInCalendarDays(e, s) + 1);
        setHtQuickDays(String(days));
      }
    }
  }, [htQuickStart, htQuickEnd]);

  const handleHtAddYil = () => {
    if (!htQuickStart || !htQuickEnd) return;
    const newExclude: ExcludeDay = {
      id: Math.random().toString(36).slice(2),
      type: "Yıllık İzin",
      start: htQuickStart,
      end: htQuickEnd,
      days: Number(htQuickDays) || 0,
    };
    onChange([...excludedDays, newExclude]);
    setHtQuickStart("");
    setHtQuickEnd("");
    setHtQuickDays("");
  };

  const handleHtRemoveExclude = (id: string) => {
    onChange(excludedDays.filter((ex) => ex.id !== id));
  };

  const handleHtUpdateExclude = (id: string, field: keyof ExcludeDay, value: string | number) => {
    onChange(excludedDays.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)));
  };

  return (
    <section className={calcSectionBoxCls}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className={calcSectionTitleCls}>Dışlanabilir günler</h2>
          <p className={calcHelperTextCls}>Yıllık izin ve rapor günlerini dışlayın.</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              setExclusionSaveName("");
              setShowExclusionSaveModal(true);
            }}
            disabled={excludedDays.length === 0}
          >
            Kaydet
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={async () => {
              const sets = await getAllExclusionSets();
              setSavedExclusionSets(sets as { id: number; name: string; data: ExcludeDay[]; createdAt: string }[]);
              setShowExclusionLoadModal(true);
            }}
          >
            İçe aktar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              onChange([]);
              setHtQuickStart("");
              setHtQuickEnd("");
              setHtQuickDays("");
            }}
            disabled={excludedDays.length === 0}
          >
            Tümünü sil
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className={calcLabelCls}>Yıllık izin / çalışılmayan raporlu günler</label>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <input
            type="date"
            className={`${calcInputCls} sm:col-span-4`}
            value={htQuickStart}
            onChange={(e) => setHtQuickStart(e.target.value)}
            onBlur={(e) => {
              const newValue = e.target.value;
              if (
                newValue &&
                /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                htQuickEnd &&
                /^\d{4}-\d{2}-\d{2}$/.test(htQuickEnd)
              ) {
                const newDate = new Date(newValue);
                const endDate = new Date(htQuickEnd);
                if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                  error("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                }
              }
            }}
            max="9999-12-31"
          />
          <input
            type="date"
            className={`${calcInputCls} sm:col-span-4`}
            value={htQuickEnd}
            onChange={(e) => setHtQuickEnd(e.target.value)}
            onBlur={(e) => {
              const newValue = e.target.value;
              if (
                newValue &&
                /^\d{4}-\d{2}-\d{2}$/.test(newValue) &&
                htQuickStart &&
                /^\d{4}-\d{2}-\d{2}$/.test(htQuickStart)
              ) {
                const newDate = new Date(newValue);
                const startDate = new Date(htQuickStart);
                if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                  error("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                }
              }
            }}
            max="9999-12-31"
          />
          <input
            className={`${calcInputCls} sm:col-span-3`}
            placeholder="Gün"
            value={htQuickDays}
            onChange={(e) => setHtQuickDays(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" className="text-xs h-9 sm:col-span-1 w-full sm:w-auto" onClick={handleHtAddYil}>
            + Ekle
          </Button>
        </div>
      </div>

      {excludedDays.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-0.5">
            <div className="col-span-3">Tür</div>
            <div className="col-span-3">Başlangıç</div>
            <div className="col-span-3">Bitiş</div>
            <div className="col-span-2">Gün</div>
            <div className="col-span-1" />
          </div>
          {excludedDays.map((ex) => (
            <div key={ex.id} className="grid grid-cols-12 gap-2 items-center">
              <select
                value={ex.type}
                onChange={(e) => handleHtUpdateExclude(ex.id, "type", e.target.value as ExcludeType)}
                className={`${calcInputCls} col-span-12 sm:col-span-3 text-xs py-1.5`}
              >
                <option>Yıllık İzin</option>
                <option>Rapor</option>
                <option>Diğer</option>
              </select>
              <input
                type="date"
                value={ex.start}
                onChange={(e) => handleHtUpdateExclude(ex.id, "start", e.target.value)}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && ex.end && /^\d{4}-\d{2}-\d{2}$/.test(ex.end)) {
                    const newDate = new Date(newValue);
                    const endDate = new Date(ex.end);
                    if (!isNaN(newDate.getTime()) && !isNaN(endDate.getTime()) && newDate > endDate) {
                      error("Başlangıç tarihi, bitiş tarihinden sonra olamaz.");
                    }
                  }
                }}
                className={`${calcInputCls} col-span-6 sm:col-span-3 text-xs py-1.5`}
                max="9999-12-31"
              />
              <input
                type="date"
                value={ex.end}
                onChange={(e) => handleHtUpdateExclude(ex.id, "end", e.target.value)}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && ex.start && /^\d{4}-\d{2}-\d{2}$/.test(ex.start)) {
                    const newDate = new Date(newValue);
                    const startDate = new Date(ex.start);
                    if (!isNaN(newDate.getTime()) && !isNaN(startDate.getTime()) && newDate < startDate) {
                      error("Bitiş tarihi, başlangıç tarihinden önce olamaz.");
                    }
                  }
                }}
                className={`${calcInputCls} col-span-6 sm:col-span-3 text-xs py-1.5`}
                max="9999-12-31"
              />
              <input
                value={String(ex.days)}
                onChange={(e) => handleHtUpdateExclude(ex.id, "days", Number(e.target.value) || 0)}
                className={`${calcInputCls} col-span-8 sm:col-span-2 text-xs py-1.5`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="col-span-4 sm:col-span-1 text-xs text-red-600 h-9"
                onClick={() => handleHtRemoveExclude(ex.id)}
              >
                Sil
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showExclusionSaveModal} onOpenChange={setShowExclusionSaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Dışlanabilir günleri kaydet</DialogTitle>
          </DialogHeader>
          <div>
            <label className={calcLabelCls}>Kayıt adı</label>
            <input
              type="text"
              placeholder="Örn: Davacı A - yıllık izinler"
              value={exclusionSaveName}
              onChange={(e) => setExclusionSaveName(e.target.value)}
              className={calcInputCls}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowExclusionSaveModal(false)}>
              İptal
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs h-8"
              disabled={!exclusionSaveName.trim()}
              onClick={async () => {
                if (!exclusionSaveName.trim()) {
                  error("Lütfen bir isim girin.");
                  return;
                }
                const saved = await saveExclusionSet(exclusionSaveName.trim(), excludedDays);
                if (saved) {
                  success(`"${exclusionSaveName.trim()}" olarak kaydedildi.`);
                  setShowExclusionSaveModal(false);
                } else {
                  error("Kaydetme başarısız oldu.");
                }
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExclusionLoadModal} onOpenChange={setShowExclusionLoadModal}>
        <DialogContent className="max-w-md max-h-[min(90vh,32rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Kayıtlı dışlanabilir günler</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-2">
            {savedExclusionSets.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Henüz kayıtlı liste yok.</p>
            ) : (
              savedExclusionSets.map((set) => (
                <div
                  key={set.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{set.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{set.data.length} kayıt</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => {
                        if (set.data?.length > 0) {
                          onChange(set.data as ExcludeDay[]);
                          success(`"${set.name}" içe aktarıldı.`);
                          setShowExclusionLoadModal(false);
                          if (props.onImport) setTimeout(() => props.onImport?.(), 100);
                        }
                      }}
                    >
                      Yükle
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="text-xs h-8"
                      onClick={async () => {
                        if (window.confirm(`"${set.name}" silinsin mi?`)) {
                          await deleteExclusionSet(set.id);
                          const newSets = await getAllExclusionSets();
                          setSavedExclusionSets(
                            newSets as { id: number; name: string; data: ExcludeDay[]; createdAt: string }[]
                          );
                          success("Silindi.");
                        }
                      }}
                    >
                      Sil
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowExclusionLoadModal(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
