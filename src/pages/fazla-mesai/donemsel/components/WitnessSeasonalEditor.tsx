/**
 * Dönemsel Fazla Mesai — Tanık Yaz/Kış deseni
 * variant "haftalik": Grup1/Grup2 + hafta tatili (v1 ile uyumlu)
 */
import { useRef } from "react";
import type { DonemselWitness, SeasonalPattern } from "../types";
import {
  MONTHS,
  DEFAULT_SUMMER_PATTERN,
  DEFAULT_WINTER_PATTERN,
  DEFAULT_SUMMER_PATTERN_HAFTALIK,
  DEFAULT_WINTER_PATTERN_HAFTALIK,
} from "../types";

interface Props {
  witnesses: DonemselWitness[];
  onUpdate: (w: DonemselWitness[]) => void;
  isReadOnly?: boolean;
  variant?: "simple" | "haftalik";
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function createWitness(id: number, haftalik: boolean): DonemselWitness {
  return {
    id,
    name: `Tanık ${id}`,
    dateIn: "",
    dateOut: "",
    summerPattern: haftalik
      ? { ...DEFAULT_SUMMER_PATTERN_HAFTALIK, months: [6, 7, 8] }
      : { ...DEFAULT_SUMMER_PATTERN, months: [6, 7, 8] },
    winterPattern: haftalik
      ? { ...DEFAULT_WINTER_PATTERN_HAFTALIK, months: [1, 2, 12] }
      : { ...DEFAULT_WINTER_PATTERN, months: [1, 2, 12] },
  };
}

function patchPattern(
  w: DonemselWitness,
  season: "summer" | "winter",
  patch: Partial<SeasonalPattern>
): DonemselWitness {
  const p = season === "summer" ? w.summerPattern : w.winterPattern;
  const next = { ...p, ...patch };
  return season === "summer" ? { ...w, summerPattern: next } : { ...w, winterPattern: next };
}

export default function WitnessSeasonalEditor({
  witnesses,
  onUpdate,
  isReadOnly = false,
  variant = "simple",
}: Props) {
  const haftalik = variant === "haftalik";
  const witnessesRef = useRef(witnesses);
  witnessesRef.current = witnesses;

  const add = () => {
    const list = witnessesRef.current;
    const maxId = list.reduce((m, w) => {
      const id = typeof w.id === "number" && Number.isFinite(w.id) ? w.id : 0;
      return Math.max(m, id);
    }, 0);
    onUpdate([...list, createWitness(maxId + 1, haftalik)]);
  };

  const remove = (idx: number) => {
    const list = witnessesRef.current;
    if (list.length <= 1) return;
    onUpdate(list.filter((_, i) => i !== idx));
  };

  /** Güncel tanık satırı ile birleştir — onChange içindeki eski `w` closure yüzünden dateIn silinmesin. */
  const mergeWitness = (idx: number, patch: Partial<DonemselWitness>) => {
    const list = witnessesRef.current;
    const cur = list[idx];
    if (!cur) return;
    onUpdate(list.map((x, i) => (i === idx ? { ...cur, ...patch } : x)));
  };

  const replaceWitnessRow = (idx: number, row: DonemselWitness) => {
    const list = witnessesRef.current;
    onUpdate(list.map((x, i) => (i === idx ? row : x)));
  };

  const toggleMonth = (idx: number, season: "summer" | "winter", month: number) => {
    if (isReadOnly) return;
    const w = witnessesRef.current[idx];
    if (!w) return;
    const pattern = season === "summer" ? w.summerPattern : w.winterPattern;
    const other = season === "summer" ? w.winterPattern : w.summerPattern;
    if (other.months.includes(month)) {
      const label = MONTHS.find((m) => m.value === month)?.label || "";
      alert(`${label} ayı diğer sezonda seçili.`);
      return;
    }
    const next = pattern.months.includes(month)
      ? pattern.months.filter((m) => m !== month)
      : [...pattern.months, month].sort((a, b) => a - b);
    replaceWitnessRow(idx, patchPattern(w, season, { months: next }));
  };

  const renderHaftalikSeason = (idx: number, w: DonemselWitness, season: "summer" | "winter") => {
    const p = season === "summer" ? w.summerPattern : w.winterPattern;
    const other = season === "summer" ? w.winterPattern : w.summerPattern;
    const title = season === "summer" ? "Yaz Dönemi" : "Kış Dönemi";
    const d1 = p.days1 ?? 0;
    const d2 = p.days2 ?? 0;
    const sum = d1 + d2;
    const setP = (patch: Partial<SeasonalPattern>) => {
      const base = witnessesRef.current[idx];
      if (!base) return;
      replaceWitnessRow(idx, patchPattern(base, season, patch));
    };

    return (
      <div key={season} className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-white dark:bg-gray-800">
        <h4 className="text-xs font-semibold mb-2">{title}</h4>
        <div className="grid grid-cols-6 gap-1 mb-2">
          {MONTHS.map((m) => {
            const sel = p.months.includes(m.value);
            const dis = other.months.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                disabled={isReadOnly || dis}
                onClick={() => toggleMonth(idx, season, m.value)}
                className={`px-1.5 py-0.5 rounded text-[11px] ${sel ? (season === "summer" ? "bg-orange-500 text-white" : "bg-blue-500 text-white") : dis ? "bg-gray-200 dark:bg-gray-600 text-gray-400" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Grup 1</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] mb-0.5">Gün Sayısı</label>
                <input
                  type="number"
                  min={0}
                  max={7 - d2}
                  value={p.days1 != null ? String(p.days1) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setP({
                        days1: undefined,
                        ...(d2 !== 7 ? { hasWeeklyHoliday: false } : {}),
                      });
                      return;
                    }
                    const parsed = parseInt(raw, 10);
                    if (Number.isNaN(parsed)) return;
                    const n = Math.min(7 - d2, Math.max(0, parsed));
                    const newSum = n + d2;
                    setP({
                      days1: n,
                      ...(newSum !== 7 ? { hasWeeklyHoliday: false } : {}),
                    });
                  }}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] mb-0.5">Giriş</label>
                <input type="time" value={p.startTime} onChange={(e) => setP({ startTime: e.target.value })} disabled={isReadOnly} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] mb-0.5">Çıkış</label>
                <input type="time" value={p.endTime} onChange={(e) => setP({ endTime: e.target.value })} disabled={isReadOnly} className={inputCls} />
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
            <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Grup 2</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] mb-0.5">Gün Sayısı</label>
                <input
                  type="number"
                  min={0}
                  max={7 - d1}
                  value={p.days2 != null ? String(p.days2) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setP({
                        days2: undefined,
                        ...(d1 !== 7 ? { hasWeeklyHoliday: false } : {}),
                      });
                      return;
                    }
                    const parsed = parseInt(raw, 10);
                    if (Number.isNaN(parsed)) return;
                    const n = Math.min(7 - d1, Math.max(0, parsed));
                    const newSum = d1 + n;
                    setP({
                      days2: n,
                      ...(newSum !== 7 ? { hasWeeklyHoliday: false } : {}),
                    });
                  }}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] mb-0.5">Giriş</label>
                <input
                  type="time"
                  value={p.startTime2 ?? ""}
                  onChange={(e) => setP({ startTime2: e.target.value })}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] mb-0.5">Çıkış</label>
                <input
                  type="time"
                  value={p.endTime2 ?? ""}
                  onChange={(e) => setP({ endTime2: e.target.value })}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
          {sum > 7 && <p className="text-[11px] text-red-500">Toplam gün 7&apos;yi geçemez.</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {haftalik ? (
          <>
            Dönemsel haftalıkta her tanık için yaz/kış aylarında Grup 1 ve Grup 2 gün sayıları ile çalışma saatlerini girin. Hafta tatilli
            / tatilsiz beyanı yalnızca davacı kutusundadır; tanığın gün toplamı davacının beyanı ile sınırlanır, hafta tatili FM’si davacı
            seçimine göre hesaplanır. Tüm ayları seçmek zorunlu değildir; seçilmeyen aylar kış deseniyle hesaplanır.
          </>
        ) : (
          <>
            Her tanık için yaz ve kış aylarında ayrı çalışma saatleri ve klasik dönemselde haftalık çalışma günü belirleyin. Tüm ayları
            seçmek zorunlu değildir; seçilmeyen aylar kış deseniyle hesaplanır. Bu kartta tarih ve saat alanları davacıya göre otomatik
            değiştirilmez (beyanınız olduğu gibi kalır). Cetvel, özet metin ve FM hesabında davacı süresi ve kutusuna göre kırpma ile kesişim
            uygulanır. Haftada 7 gün seçerseniz hafta tatilli / tatilsiz hesabı davacı kutusundaki seçime göre yapılır (tanık kartında ayrı
            düğme yok).
          </>
        )}
      </p>
      {witnesses.length === 0 && (
        <p className="text-center py-6 text-sm text-gray-500">Henüz tanık yok. &quot;Tanık Ekle&quot; ile ekleyin.</p>
      )}
      {witnesses.map((w, idx) => {
        return (
          <div key={`donemsel-tanik-${idx}-${w.id}`} className="rounded-xl border-2 border-gray-200 dark:border-gray-600 p-4 bg-gray-50/50 dark:bg-gray-900/30">
            <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
              <input
                type="text"
                value={w.name || `Tanık ${idx + 1}`}
                onChange={(e) => mergeWitness(idx, { name: e.target.value })}
                disabled={isReadOnly}
                className="min-w-0 flex-1 text-sm font-semibold bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none px-2 py-1"
              />
              {!isReadOnly && witnesses.length > 1 && (
                <button type="button" onClick={() => remove(idx)} className="shrink-0 px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600">
                  Sil
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 rounded-lg border border-blue-200 dark:border-blue-700 p-3 bg-blue-50/50 dark:bg-blue-900/20">
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1">İşe Giriş</label>
                <input
                  type="date"
                  value={w.dateIn}
                  onChange={(e) => mergeWitness(idx, { dateIn: e.target.value })}
                  disabled={isReadOnly}
                  className={`${inputCls} min-w-[11rem] w-full max-w-full`}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1">İşten Çıkış</label>
                <input
                  type="date"
                  value={w.dateOut}
                  onChange={(e) => mergeWitness(idx, { dateOut: e.target.value })}
                  disabled={isReadOnly}
                  className={`${inputCls} min-w-[11rem] w-full max-w-full`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {haftalik ? (
                <>
                  {renderHaftalikSeason(idx, w, "summer")}
                  {renderHaftalikSeason(idx, w, "winter")}
                </>
              ) : (
                (["summer", "winter"] as const).map((season) => {
                  const p = season === "summer" ? w.summerPattern : w.winterPattern;
                  const other = season === "summer" ? w.winterPattern : w.summerPattern;
                  const title = season === "summer" ? "Yaz Dönemi" : "Kış Dönemi";
                  return (
                    <div key={season} className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-white dark:bg-gray-800">
                      <h4 className="text-xs font-semibold mb-2">{title}</h4>
                      <div className="grid grid-cols-6 gap-1 mb-2">
                        {MONTHS.map((m) => {
                          const sel = p.months.includes(m.value);
                          const dis = other.months.includes(m.value);
                          return (
                            <button
                              key={m.value}
                              type="button"
                              disabled={isReadOnly || dis}
                              onClick={() => toggleMonth(idx, season, m.value)}
                              className={`px-1.5 py-0.5 rounded text-[11px] ${sel ? (season === "summer" ? "bg-orange-500 text-white" : "bg-blue-500 text-white") : dis ? "bg-gray-200 dark:bg-gray-600 text-gray-400" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs mb-0.5">Giriş</label>
                          <input
                            type="time"
                            value={p.startTime}
                            onChange={(e) => {
                              const base = witnessesRef.current[idx];
                              if (!base) return;
                              replaceWitnessRow(idx, patchPattern(base, season, { startTime: e.target.value }));
                            }}
                            disabled={isReadOnly}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-0.5">Çıkış</label>
                          <input
                            type="time"
                            value={p.endTime}
                            onChange={(e) => {
                              const base = witnessesRef.current[idx];
                              if (!base) return;
                              replaceWitnessRow(idx, patchPattern(base, season, { endTime: e.target.value }));
                            }}
                            disabled={isReadOnly}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="block text-xs mb-0.5">Haftada çalışılan gün</label>
                        <input
                          type="number"
                          min={1}
                          max={7}
                          value={p.workDays ?? 6}
                          onChange={(e) => {
                            const n = Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 6));
                            const base = witnessesRef.current[idx];
                            if (!base) return;
                            replaceWitnessRow(idx, patchPattern(base, season, { workDays: n }));
                          }}
                          disabled={isReadOnly}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      {!isReadOnly && (
        <button type="button" onClick={add} className="w-full py-3 text-sm font-medium rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
          + Tanık Ekle
        </button>
      )}
    </div>
  );
}
