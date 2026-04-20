/**
 * Fazla mesai — UBGT günleri: backend kataloğundan çoklu seçim, exclusions (type UBGT) ile kayıt.
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import type { ExcludedDay } from "@/utils/exclusionStorage";
import { fetchUbgtFmCatalog, type UbgtFmCatalogRow } from "./ubgtFmCatalog";

const PREFIX = "ubgt-fm-";

const boxCls =
  "rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50/50 dark:bg-gray-900/30 shadow-sm";

function stripPickerUbgt(rows: ExcludedDay[]): ExcludedDay[] {
  // UBGT picker tek kaynak olsun: her seçimde mevcut tüm UBGT girdilerini temizleyip
  // yalnızca işaretli günleri yeniden yazarız. Eski/ghost UBGT kayıtları böylece kalmaz.
  return rows.filter((e) => e.type !== "UBGT");
}

function selectedIsoSetFromExclusions(exclusions: ExcludedDay[]): Set<string> {
  const s = new Set<string>();
  for (const e of exclusions) {
    if (e.type !== "UBGT") continue;
    const start = (e.start || "").slice(0, 10);
    const end = (e.end || "").slice(0, 10);
    if (!start || !end || start !== end) continue;
    s.add(start);
  }
  return s;
}

function formatTrDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

export interface UbgtFmDayPickerProps {
  rangeStart: string;
  rangeEnd: string;
  exclusions: ExcludedDay[];
  setExclusions: React.Dispatch<React.SetStateAction<ExcludedDay[]>>;
  showToastError: (msg: string) => void;
}

export function UbgtFmDayPicker({
  rangeStart,
  rangeEnd,
  exclusions,
  setExclusions,
  showToastError,
}: UbgtFmDayPickerProps) {
  const [catalog, setCatalog] = useState<UbgtFmCatalogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchUbgtFmCatalog(rangeStart, rangeEnd)
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setCatalog([]);
          showToastError(e?.message || "UBGT gün listesi yüklenemedi");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, showToastError]);

  const byYear = useMemo(() => {
    const m = new Map<number, UbgtFmCatalogRow[]>();
    for (const r of catalog) {
      const y = Number(r.date.slice(0, 4));
      if (!Number.isFinite(y)) continue;
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [catalog]);

  const selected = useMemo(() => selectedIsoSetFromExclusions(exclusions), [exclusions]);

  const applySelection = useCallback(
    (next: Set<string>) => {
      const meta = new Map(catalog.map((r) => [r.date, r]));
      const newUbgt: ExcludedDay[] = [...next].sort().map((date) => {
        const row = meta.get(date);
        const dnum = row && Number(row.days) > 0 ? Math.max(1, Math.round(Number(row.days))) : 1;
        return {
          id: `${PREFIX}${date}`,
          type: "UBGT",
          start: date,
          end: date,
          days: dnum,
        };
      });
      setExclusions((prev) => [...stripPickerUbgt(prev), ...newUbgt]);
    },
    [catalog, setExclusions]
  );

  const toggle = (iso: string) => {
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    applySelection(next);
  };

  const selectAllCatalog = () => {
    applySelection(new Set(catalog.map((r) => r.date)));
  };

  const clearPickerUbgt = () => {
    setExclusions((prev) => stripPickerUbgt(prev));
  };

  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
    return (
      <section className={boxCls}>
        <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          UBGT gün seçimi için hesap döneminin başlangıç ve bitiş tarihlerini girin (sayfada tanımlanan aralık
          kullanılır).
        </div>
      </section>
    );
  }

  return (
    <section className={boxCls}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">UBGT günleri (FM düşümü)</h2>
        <p className="text-[11px] font-normal text-gray-500 dark:text-gray-400 mt-1 leading-snug">
          Aşağıda, seçilen dönemdeki kayıtlı UBGT günleri listelenir. İşaretlediğiniz günler yıllık izin dışlamasıyla aynı
          mantıkla haftaya oturtulup FM yeniden hesaplanır. (Manuel UBGT satırlarınız varsa korunur.)
        </p>
      </div>
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-xs text-gray-500">UBGT günleri yükleniyor…</p>
        ) : catalog.length === 0 ? (
          <p className="text-xs text-gray-500">Bu dönem için listelenecek UBGT günü bulunamadı.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllCatalog}
                className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Tümünü seç
              </button>
              <button
                type="button"
                onClick={clearPickerUbgt}
                className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Seçimi temizle
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {byYear.map(([year, days]) => (
                <div key={year}>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{year}</div>
                  <ul className="space-y-1">
                    {days.map((d) => {
                      const on = selected.has(d.date);
                      return (
                        <li key={d.date}>
                          <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={on}
                              onChange={() => toggle(d.date)}
                            />
                            <span className="tabular-nums">{formatTrDate(d.date)}</span>
                            <span className="text-gray-500 dark:text-gray-400">— {d.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
