import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  UBGT_HOLIDAY_TYPES,
  UBGT_HOLIDAY_DAYS,
  getYearsFromDateRange,
  filterExcludedUbgtHolidaysByRules,
  type UbgtHolidayType,
  type UbgtExclusionRule,
  type UbgtDayEntry,
} from "@/pages/ubgt/utils/filterExcludedUbgtHolidays";
import { ChevronDown, X } from "lucide-react";
import {
  calcSectionBoxCls,
  calcSectionTitleCls,
  calcHelperTextCls,
} from "@/shared/calcPageFormStyles";

const DROPDOWN_Z = 1100;

const GROUPS: { title: string; values: UbgtHolidayType[] }[] = [
  { title: "Ulusal bayramlar", values: ["OCT_28_HALF", "OCT_29"] },
  {
    title: "Genel tatiller",
    values: ["APR_23", "MAY_19", "AUG_30", "JAN_1", "MAY_1", "JUL_15"],
  },
  {
    title: "Dini bayramlar",
    values: [
      "RAMADAN_AREFE_HALF",
      "RAMADAN_1",
      "RAMADAN_2",
      "RAMADAN_3",
      "KURBAN_AREFE_HALF",
      "KURBAN_1",
      "KURBAN_2",
      "KURBAN_3",
      "KURBAN_4",
    ],
  },
];

const labelByType: Record<UbgtHolidayType, string> = Object.fromEntries(
  UBGT_HOLIDAY_TYPES.map((t) => [t.value, t.label])
) as Record<UbgtHolidayType, string>;

function shortLabel(type: UbgtHolidayType): string {
  return labelByType[type].replace(/\s*-\s*0\.5 gün|\s*-\s*1 gün/g, "").trim();
}

function formatDayValue(d: number): string {
  return d.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function formatRuleSummary(rule: UbgtExclusionRule): string {
  const yearStr =
    rule.startYear === rule.endYear ? String(rule.startYear) : `${rule.startYear}–${rule.endYear}`;
  const types = rule.excludedHolidayTypes;
  if (types.length === 0) return `${yearStr}`;
  const total = types.reduce((s, t) => s + (UBGT_HOLIDAY_DAYS[t] ?? 1), 0);
  if (types.length === 1) {
    const d = UBGT_HOLIDAY_DAYS[types[0]] ?? 1;
    return `${yearStr} – ${shortLabel(types[0])} (${formatDayValue(d)} gün)`;
  }
  const parts = types.map((t) => `${shortLabel(t)} (${formatDayValue(UBGT_HOLIDAY_DAYS[t] ?? 1)})`);
  return `${yearStr} – ${parts.join(" + ")} = ${formatDayValue(total)} gün`;
}

interface UbgtExclusionCompactUIProps {
  dateRanges: Array<{ start: string; end: string }>;
  ubgtDayEntries: UbgtDayEntry[];
  ubgtExclusionRules: UbgtExclusionRule[];
  setUbgtExclusionRules: React.Dispatch<React.SetStateAction<UbgtExclusionRule[]>>;
}

export default function UbgtExclusionCompactUI({
  dateRanges = [],
  ubgtDayEntries = [],
  ubgtExclusionRules,
  setUbgtExclusionRules,
}: UbgtExclusionCompactUIProps) {
  const { rangeStart, rangeEnd, yearsForDropdown } = useMemo(() => {
    const ranges = dateRanges ?? [];
    const valid = ranges.filter((r) => r.start && r.end);
    if (valid.length === 0) {
      return { rangeStart: "", rangeEnd: "", yearsForDropdown: [] as number[] };
    }
    const starts = valid.map((r) => r.start);
    const ends = valid.map((r) => r.end);
    const rs = starts.sort()[0];
    const re = ends.sort().reverse()[0];
    return { rangeStart: rs, rangeEnd: re, yearsForDropdown: getYearsFromDateRange(rs, re) };
  }, [dateRanges]);

  const [draftYearState, setDraftYearState] = useState<number | null>(null);
  const draftYear =
    draftYearState ?? (yearsForDropdown.length > 0 ? yearsForDropdown[0] : new Date().getFullYear());
  const setDraftYear = (y: number) => setDraftYearState(y);

  const finalUbgtDays = useMemo(
    () => filterExcludedUbgtHolidaysByRules(ubgtDayEntries, ubgtExclusionRules),
    [ubgtDayEntries, ubgtExclusionRules]
  );

  const hasUbgtDaysForSelectedYear = useMemo(
    () =>
      finalUbgtDays.some(
        (d) =>
          d.date.length >= 4 &&
          parseInt(d.date.slice(0, 4), 10) === draftYear &&
          (d.days ?? 0) > 0
      ),
    [finalUbgtDays, draftYear]
  );

  const availableTypesForYear = useMemo(() => {
    if (!finalUbgtDays.length) return [];
    const types = new Set<UbgtHolidayType>();
    for (const day of finalUbgtDays) {
      const year = day.date.length >= 4 ? parseInt(day.date.slice(0, 4), 10) : 0;
      if (year !== draftYear || (day.days ?? 0) <= 0) continue;
      if (rangeStart && day.date < rangeStart) continue;
      if (rangeEnd && day.date > rangeEnd) continue;
      types.add(day.holidayType);
    }
    return UBGT_HOLIDAY_TYPES.map((t) => t.value).filter((v) => types.has(v as UbgtHolidayType)) as UbgtHolidayType[];
  }, [finalUbgtDays, draftYear, rangeStart, rangeEnd]);

  useEffect(() => {
    if (yearsForDropdown.length > 0 && (draftYearState === null || !yearsForDropdown.includes(draftYear))) {
      setDraftYearState(yearsForDropdown[0]);
    }
  }, [yearsForDropdown, draftYearState, draftYear]);

  const [draftTypes, setDraftTypes] = useState<UbgtHolidayType[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setDraftTypes((prev) => prev.filter((t) => availableTypesForYear.includes(t)));
  }, [availableTypesForYear]);

  const updateDropdownRect = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      });
    }
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    updateDropdownRect();
    const onScrollOrResize = () => updateDropdownRect();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [dropdownOpen]);

  const toggleType = (t: UbgtHolidayType) => {
    setDraftTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const removeDraftType = (t: UbgtHolidayType, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTypes((prev) => prev.filter((x) => x !== t));
  };

  const onDisla = () => {
    if (draftTypes.length === 0) return;
    setUbgtExclusionRules((prev) => [
      ...prev,
      { startYear: draftYear, endYear: draftYear, excludedHolidayTypes: [...draftTypes] },
    ]);
    setDraftTypes([]);
  };

  const removeRule = (index: number) => {
    setUbgtExclusionRules((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <section className={calcSectionBoxCls}>
      <h2 className={calcSectionTitleCls}>UBGT hesabından dışlanacak günler</h2>
      <p className={calcHelperTextCls}>Seçilen yıl için işaretlenen UBGT günleri hesaba dahil edilmez.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Yıl</span>
          <select
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm w-[5.5rem] text-gray-900 dark:text-gray-100 disabled:opacity-60"
            value={yearsForDropdown.includes(draftYear) ? draftYear : (yearsForDropdown[0] ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setDraftYear(parseInt(v, 10));
            }}
            disabled={yearsForDropdown.length === 0}
          >
            {yearsForDropdown.length === 0 ? (
              <option value="">—</option>
            ) : (
              yearsForDropdown.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex-1 min-w-0 relative min-h-9">
          <div
            ref={triggerRef}
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-disabled={yearsForDropdown.length === 0 || !hasUbgtDaysForSelectedYear}
            className="min-h-9 flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 focus-within:ring-1 focus-within:ring-indigo-500/40 w-full min-w-[140px]"
            onClick={() =>
              yearsForDropdown.length > 0 && hasUbgtDaysForSelectedYear && setDropdownOpen((o) => !o)
            }
          >
            {draftTypes.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {yearsForDropdown.length === 0
                  ? "Önce tarih aralığı girin"
                  : hasUbgtDaysForSelectedYear
                    ? "UBGT günleri"
                    : `${draftYear} için bu aralıkta UBGT günü yok`}
              </span>
            ) : (
              draftTypes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 text-xs"
                >
                  {labelByType[t].replace(/\s*-\s*0\.5 gün|\s*-\s*1 gün/g, "").trim()}
                  <button
                    type="button"
                    className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    onClick={(e) => removeDraftType(t, e)}
                    aria-label="Kaldır"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-auto shrink-0" />
          </div>

          {dropdownOpen &&
            createPortal(
              <div className="fixed inset-0" style={{ zIndex: DROPDOWN_Z }} aria-hidden="true">
                <div role="presentation" className="absolute inset-0 bg-black/10" onClick={() => setDropdownOpen(false)} />
                <div
                  className="absolute rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2 max-h-64 overflow-y-auto min-w-[280px] max-w-md"
                  style={{
                    top: dropdownRect.top,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {GROUPS.map((g) => {
                    const visibleInGroup = g.values.filter((v) => availableTypesForYear.includes(v));
                    if (visibleInGroup.length === 0) return null;
                    return (
                      <div key={g.title} className="px-3 py-1">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                          {g.title}
                        </div>
                        {visibleInGroup.map((value) => {
                          const label = labelByType[value];
                          const selected = draftTypes.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => toggleType(value)}
                            >
                              <span
                                className={`inline-block w-4 h-4 rounded border shrink-0 ${
                                  selected
                                    ? "bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500"
                                    : "border-gray-400 dark:border-gray-500"
                                }`}
                              >
                                {selected && (
                                  <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 12 12">
                                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                                  </svg>
                                )}
                              </span>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>,
              document.body
            )}
        </div>

        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 text-xs bg-indigo-600 hover:bg-indigo-700"
          onClick={onDisla}
          disabled={draftTypes.length === 0 || yearsForDropdown.length === 0}
        >
          Dışla
        </Button>
      </div>

      {ubgtExclusionRules.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
          <span className="text-xs text-gray-500 dark:text-gray-400">{ubgtExclusionRules.length} kural:</span>
          {ubgtExclusionRules.map((rule, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs"
            >
              {formatRuleSummary(rule)}
              <button
                type="button"
                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => removeRule(idx)}
                aria-label="Kuralı kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
