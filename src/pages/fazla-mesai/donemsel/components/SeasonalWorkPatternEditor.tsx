/**
 * Dönemsel Fazla Mesai — Davacı Yaz/Kış deseni
 * variant "simple": tek giriş/çıkış + sezon başına haftalık gün ve (7 günde) tatilli/tatilsiz
 * variant "haftalik": v1 ile aynı — Grup1/Grup2 (önce gün sayısı), toplam 7 günde hafta tatili
 */
import type { SeasonalPattern } from "../types";
import { MONTHS, SEASONAL_WEEKLY_HOLIDAY_GETDAY_OPTIONS } from "../types";

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
            <>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hafta tatili</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => update({ ...pattern, hasWeeklyHoliday: false })}
                    disabled={isReadOnly}
                    className={`flex-1 min-w-0 sm:flex-none px-3 py-2 text-xs rounded border ${
                      !(pattern.hasWeeklyHoliday ?? false)
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    Hafta tatilsiz
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        ...pattern,
                        hasWeeklyHoliday: true,
                        weeklyHolidayWeekday:
                          pattern.weeklyHolidayWeekday != null &&
                          pattern.weeklyHolidayWeekday >= 0 &&
                          pattern.weeklyHolidayWeekday <= 6
                            ? pattern.weeklyHolidayWeekday
                            : 0,
                      })
                    }
                    disabled={isReadOnly}
                    className={`flex-1 min-w-0 sm:flex-none px-3 py-2 text-xs rounded border ${
                      pattern.hasWeeklyHoliday
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    Hafta tatilli
                  </button>
                </div>
              </div>
              {pattern.hasWeeklyHoliday && (
                <div className="mt-3 space-y-3">
                  <div>
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
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Hafta tatili hangi gün?
                    </label>
                    <select
                      value={
                        pattern.weeklyHolidayWeekday != null &&
                        pattern.weeklyHolidayWeekday >= 0 &&
                        pattern.weeklyHolidayWeekday <= 6
                          ? String(pattern.weeklyHolidayWeekday)
                          : "0"
                      }
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(6, parseInt(e.target.value, 10)));
                        update({
                          ...pattern,
                          weeklyHolidayWeekday: Number.isFinite(v) ? v : 0,
                        });
                      }}
                      disabled={isReadOnly}
                      className={inputCls}
                    >
                      {SEASONAL_WEEKLY_HOLIDAY_GETDAY_OPTIONS.map((o) => (
                        <option key={o.value} value={String(o.value)}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Yıllık izin / UBGT takviminde bu takvim günü sayılmaz (0 Pazar … 6 Cumartesi).
                    </p>
                  </div>
                </div>
              )}
            </>
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
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Haftada çalışılan gün</label>
          <input
            type="number"
            min={1}
            max={7}
            value={pattern.workDays ?? 6}
            onChange={(e) => {
              const n = Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 6));
              update({
                ...pattern,
                workDays: n,
                ...(n !== 7 ? { sevenDayMode: "tatilsiz" as const } : {}),
              });
            }}
            disabled={isReadOnly}
            className={inputCls}
          />
        </div>
        {(pattern.workDays ?? 6) === 7 && (
          <div className="flex flex-col justify-end">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hafta tatili</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => update({ ...pattern, sevenDayMode: "tatilsiz" })}
                disabled={isReadOnly}
                className={`flex-1 min-w-0 sm:flex-none px-3 py-2 text-xs rounded border ${
                  (pattern.sevenDayMode ?? "tatilsiz") === "tatilsiz"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Hafta tatilsiz
              </button>
              <button
                type="button"
                onClick={() =>
                  update({
                    ...pattern,
                    sevenDayMode: "tatilli",
                    weeklyHolidayWeekday:
                      pattern.weeklyHolidayWeekday != null &&
                      pattern.weeklyHolidayWeekday >= 0 &&
                      pattern.weeklyHolidayWeekday <= 6
                        ? pattern.weeklyHolidayWeekday
                        : 0,
                  })
                }
                disabled={isReadOnly}
                className={`flex-1 min-w-0 sm:flex-none px-3 py-2 text-xs rounded border ${
                  pattern.sevenDayMode === "tatilli"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Hafta tatilli
              </button>
            </div>
          </div>
        )}
      </div>
      {(pattern.workDays ?? 6) === 7 && pattern.sevenDayMode === "tatilli" && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Hafta tatili hangi gün?
          </label>
          <select
            value={
              pattern.weeklyHolidayWeekday != null &&
              pattern.weeklyHolidayWeekday >= 0 &&
              pattern.weeklyHolidayWeekday <= 6
                ? String(pattern.weeklyHolidayWeekday)
                : "0"
            }
            onChange={(e) => {
              const v = Math.max(0, Math.min(6, parseInt(e.target.value, 10)));
              update({
                ...pattern,
                weeklyHolidayWeekday: Number.isFinite(v) ? v : 0,
              });
            }}
            disabled={isReadOnly}
            className={inputCls}
          >
            {SEASONAL_WEEKLY_HOLIDAY_GETDAY_OPTIONS.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            0 Pazar, 1 Pazartesi, … 6 Cumartesi (takvim, JavaScript ile aynı).
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Yaz ve kış için hangi aylarda hangi çalışma saatlerinin geçerli olduğunu seçin; her ay en fazla bir sezonda olabilir. Tüm yılı
        kapsamanız gerekmez. Hiçbir sezonda seçilmeyen aylar hesaplamada <strong>kış</strong> deseniyle işlenir.
      </p>
      <div className="rounded-lg border border-blue-200 dark:border-blue-700 p-4 bg-blue-50/50 dark:bg-blue-900/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">İşe Giriş Tarihi</label>
            <input
              type="date"
              value={dateIn}
              onChange={(e) => onDateInChange(e.target.value)}
              disabled={isReadOnly}
              className={`${inputCls} min-w-[11rem] w-full max-w-full`}
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">İşten Çıkış Tarihi</label>
            <input
              type="date"
              value={dateOut}
              onChange={(e) => onDateOutChange(e.target.value)}
              disabled={isReadOnly}
              className={`${inputCls} min-w-[11rem] w-full max-w-full`}
            />
          </div>
        </div>
      </div>
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
