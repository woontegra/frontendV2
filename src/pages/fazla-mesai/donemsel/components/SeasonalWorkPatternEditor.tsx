/**
 * Dönemsel Fazla Mesai — Davacı Yaz/Kış deseni
 * variant "simple": tek giriş/çıkış + sayfa üstünde haftalık gün
 * variant "haftalik": v1 ile aynı — Grup1/Grup2 (önce gün sayısı), toplam 7 günde hafta tatili
 */
import type { SeasonalPattern } from "../types";
import { MONTHS } from "../types";

interface Props {
  summerPattern: SeasonalPattern;
  winterPattern: SeasonalPattern;
  onSummerUpdate: (p: SeasonalPattern) => void;
  onWinterUpdate: (p: SeasonalPattern) => void;
  dateIn: string;
  dateOut: string;
  onDateInChange: (v: string) => void;
  onDateOutChange: (v: string) => void;
  isReadOnly?: boolean;
  variant?: "simple" | "haftalik";
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function SeasonalWorkPatternEditor({
  summerPattern,
  winterPattern,
  onSummerUpdate,
  onWinterUpdate,
  dateIn,
  dateOut,
  onDateInChange,
  onDateOutChange,
  isReadOnly = false,
  variant = "simple",
}: Props) {
  const toggleMonth = (season: "summer" | "winter", month: number) => {
    if (isReadOnly) return;
    const pattern = season === "summer" ? summerPattern : winterPattern;
    const other = season === "summer" ? winterPattern : summerPattern;
    const update = season === "summer" ? onSummerUpdate : onWinterUpdate;
    if (other.months.includes(month)) {
      const label = MONTHS.find((m) => m.value === month)?.label || "";
      alert(`${label} ayı diğer sezonda seçili. Bir ay sadece bir sezonda olabilir.`);
      return;
    }
    const next = pattern.months.includes(month)
      ? pattern.months.filter((m) => m !== month)
      : [...pattern.months, month].sort((a, b) => a - b);
    update({ ...pattern, months: next });
  };

  const renderHaftalikSeasonBlock = (
    title: string,
    pattern: SeasonalPattern,
    season: "summer" | "winter",
    update: (p: SeasonalPattern) => void
  ) => {
    const d1 = pattern.days1 ?? 0;
    const d2 = pattern.days2 ?? 0;
    const sum = d1 + d2;

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 bg-white dark:bg-gray-800">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{title}</h4>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Aylar</label>
          <div className="flex flex-wrap gap-1.5">
            {MONTHS.map((m) => {
              const sel = pattern.months.includes(m.value);
              const dis = (season === "summer" ? winterPattern : summerPattern).months.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={isReadOnly || dis}
                  onClick={() => toggleMonth(season, m.value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    sel
                      ? season === "summer"
                        ? "bg-orange-500 text-white"
                        : "bg-blue-500 text-white"
                      : dis
                        ? "bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  } ${isReadOnly ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Grup 1</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gün Sayısı</label>
                <input
                  type="number"
                  min={0}
                  max={7 - d2}
                  value={pattern.days1 != null ? String(pattern.days1) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      update({
                        ...pattern,
                        days1: undefined,
                        ...(d2 !== 7 ? { hasWeeklyHoliday: false } : {}),
                      });
                      return;
                    }
                    const parsed = parseInt(raw, 10);
                    if (Number.isNaN(parsed)) return;
                    const n = Math.min(7 - d2, Math.max(0, parsed));
                    const newSum = n + d2;
                    update({
                      ...pattern,
                      days1: n,
                      ...(newSum !== 7 ? { hasWeeklyHoliday: false } : {}),
                    });
                  }}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Giriş Saati</label>
                <input
                  type="time"
                  value={pattern.startTime}
                  onChange={(e) => update({ ...pattern, startTime: e.target.value })}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Çıkış Saati</label>
                <input
                  type="time"
                  value={pattern.endTime}
                  onChange={(e) => update({ ...pattern, endTime: e.target.value })}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Grup 2</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gün Sayısı</label>
                <input
                  type="number"
                  min={0}
                  max={7 - d1}
                  value={pattern.days2 != null ? String(pattern.days2) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      update({
                        ...pattern,
                        days2: undefined,
                        ...(d1 !== 7 ? { hasWeeklyHoliday: false } : {}),
                      });
                      return;
                    }
                    const parsed = parseInt(raw, 10);
                    if (Number.isNaN(parsed)) return;
                    const n = Math.min(7 - d1, Math.max(0, parsed));
                    const newSum = d1 + n;
                    update({
                      ...pattern,
                      days2: n,
                      ...(newSum !== 7 ? { hasWeeklyHoliday: false } : {}),
                    });
                  }}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Giriş Saati</label>
                <input
                  type="time"
                  value={pattern.startTime2 ?? ""}
                  onChange={(e) => update({ ...pattern, startTime2: e.target.value })}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Çıkış Saati</label>
                <input
                  type="time"
                  value={pattern.endTime2 ?? ""}
                  onChange={(e) => update({ ...pattern, endTime2: e.target.value })}
                  disabled={isReadOnly}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {sum > 7 && (
            <p className="text-xs text-red-600 dark:text-red-400">Toplam gün sayısı 7&apos;yi geçemez.</p>
          )}

          {sum === 7 && (
            <div className="mt-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`weeklyHoliday-${season}`}
                  checked={pattern.hasWeeklyHoliday ?? false}
                  onChange={(e) => update({ ...pattern, hasWeeklyHoliday: e.target.checked })}
                  disabled={isReadOnly}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor={`weeklyHoliday-${season}`} className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                  Hafta Tatili Var mı?
                </label>
              </div>
              {pattern.hasWeeklyHoliday && (
                <div className="mt-2 ml-6">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Hangi Gruba Dahil?</label>
                  <select
                    value={pattern.weeklyHolidayRow ?? 2}
                    onChange={(e) =>
                      update({ ...pattern, weeklyHolidayRow: e.target.value === "1" ? 1 : 2 })
                    }
                    disabled={isReadOnly}
                    className={inputCls}
                  >
                    <option value={1}>Grup 1</option>
                    <option value={2}>Grup 2</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSimpleBlock = (
    title: string,
    pattern: SeasonalPattern,
    season: "summer" | "winter",
    update: (p: SeasonalPattern) => void
  ) => (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 bg-white dark:bg-gray-800">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{title}</h4>
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Aylar</label>
        <div className="grid grid-cols-6 gap-1">
          {MONTHS.map((m) => {
            const sel = pattern.months.includes(m.value);
            const dis = (season === "summer" ? winterPattern : summerPattern).months.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                disabled={isReadOnly || dis}
                onClick={() => toggleMonth(season, m.value)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  sel
                    ? season === "summer"
                      ? "bg-orange-500 text-white"
                      : "bg-blue-500 text-white"
                    : dis
                      ? "bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                } ${isReadOnly ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Giriş Saati</label>
          <input
            type="time"
            value={pattern.startTime}
            onChange={(e) => update({ ...pattern, startTime: e.target.value })}
            disabled={isReadOnly}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Çıkış Saati</label>
          <input
            type="time"
            value={pattern.endTime}
            onChange={(e) => update({ ...pattern, endTime: e.target.value })}
            disabled={isReadOnly}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );

  const totalMonths = summerPattern.months.length + winterPattern.months.length;
  const warn = totalMonths < 12;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Yaz ve kış aylarında farklı çalışma saatleri belirleyin. Her ay sadece bir sezonda olabilir.
      </p>
      <div className="rounded-lg border border-blue-200 dark:border-blue-700 p-4 bg-blue-50/50 dark:bg-blue-900/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">İşe Giriş Tarihi</label>
            <input type="date" value={dateIn} onChange={(e) => onDateInChange(e.target.value)} disabled={isReadOnly} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">İşten Çıkış Tarihi</label>
            <input type="date" value={dateOut} onChange={(e) => onDateOutChange(e.target.value)} disabled={isReadOnly} className={inputCls} />
          </div>
        </div>
      </div>
      {warn && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700 p-3 text-xs text-amber-800 dark:text-amber-200 bg-amber-50/50 dark:bg-amber-900/20">
          Tüm ayları seçmelisiniz. Şu an {12 - totalMonths} ay seçilmedi.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {variant === "haftalik" ? (
          <>
            {renderHaftalikSeasonBlock("🌞 Yaz Dönemi", summerPattern, "summer", onSummerUpdate)}
            {renderHaftalikSeasonBlock("❄️ Kış Dönemi", winterPattern, "winter", onWinterUpdate)}
          </>
        ) : (
          <>
            {renderSimpleBlock("Yaz Dönemi", summerPattern, "summer", onSummerUpdate)}
            {renderSimpleBlock("Kış Dönemi", winterPattern, "winter", onWinterUpdate)}
          </>
        )}
      </div>
    </div>
  );
}
