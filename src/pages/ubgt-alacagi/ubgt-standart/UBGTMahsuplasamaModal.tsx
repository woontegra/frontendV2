import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { calcTableInputCls } from "@/shared/calcPageFormStyles";

export interface UbgtMahsuplasamaTableRow {
  period: string;
  wage?: number;
  coefficient?: number;
  dailyWage?: number;
  ubgtDays?: number;
  ubgtTotal?: number;
  startISO?: string;
  endISO?: string;
  manual?: boolean;
}

interface UBGTMahsuplasamaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableData: UbgtMahsuplasamaTableRow[];
  onSave: (total: number, data: { [year: number]: { [holidayName: string]: number } }) => void;
  initialData?: { [year: number]: { [holidayName: string]: number } };
}

const OFFICIAL_HOLIDAYS = [
  "1 Ocak",
  "23 Nisan",
  "1 Mayıs",
  "19 Mayıs",
  "15 Temmuz",
  "30 Ağustos",
  "29 Ekim",
  "Ramazan Bayramı",
  "Kurban Bayramı",
];

function parseTurkishDate(dateStr: string): Date | null {
  try {
    const parts = dateStr.split(".");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function addYearsFromIso(iso: string | undefined, yearSet: Set<number>) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  const d = new Date(iso + "T12:00:00");
  if (!isNaN(d.getTime())) yearSet.add(d.getFullYear());
}

export default function UBGTMahsuplasamaModal({
  open,
  onOpenChange,
  tableData,
  onSave,
  initialData,
}: UBGTMahsuplasamaModalProps) {
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    for (const row of tableData) {
      addYearsFromIso(row.startISO, yearSet);
      addYearsFromIso(row.endISO, yearSet);
      const parts = row.period.split(" - ");
      if (parts.length === 2) {
        const startDate = parseTurkishDate(parts[0].trim());
        const endDate = parseTurkishDate(parts[1].trim());
        if (startDate) yearSet.add(startDate.getFullYear());
        if (endDate) yearSet.add(endDate.getFullYear());
      }
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [tableData]);

  const [values, setValues] = useState<{ [year: number]: { [holidayName: string]: number } }>({});

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setValues(initialData);
    }
  }, [initialData]);

  const handleValueChange = (year: number, holidayName: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setValues((prev) => ({
      ...prev,
      [year]: {
        ...(prev[year] || {}),
        [holidayName]: numValue,
      },
    }));
  };

  const getValue = (year: number, holidayName: string): string => {
    return values[year]?.[holidayName] ? String(values[year][holidayName]) : "";
  };

  const total = useMemo(() => {
    let sum = 0;
    for (const yearStr of Object.keys(values)) {
      const year = parseInt(yearStr, 10);
      const byHoliday = values[year];
      if (!byHoliday) continue;
      for (const holidayName of Object.keys(byHoliday)) {
        sum += byHoliday[holidayName] || 0;
      }
    }
    return sum;
  }, [values]);

  const handleSave = () => {
    onSave(total, values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">UBGT Mahsuplaşma Ekle</DialogTitle>
          <DialogDescription className="text-xs">
            Resmi tatil ve yıl bazında mahsuplaşma miktarlarını girin. Tüm değerler toplanarak ana ekrana yazılacaktır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {years.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">
              Hesaplama tablosunda veri bulunamadı. Lütfen önce hesaplama yapın.
            </p>
          ) : (
            <>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs text-gray-900 dark:text-gray-100">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300">
                          Resmi Tatil
                        </th>
                        {years.map((year) => (
                          <th
                            key={year}
                            className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300"
                          >
                            {year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {OFFICIAL_HOLIDAYS.map((holidayName) => (
                        <tr key={holidayName} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40">
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 font-medium text-gray-700 dark:text-gray-300">
                            {holidayName}
                          </td>
                          {years.map((year) => (
                            <td
                              key={`${year}-${holidayName}`}
                              className="border border-gray-200 dark:border-gray-600 px-1 py-0.5"
                            >
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={getValue(year, holidayName)}
                                onChange={(e) => handleValueChange(year, holidayName, e.target.value)}
                                className={`${calcTableInputCls} text-center`}
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Toplam:</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {total.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" size="sm" className="text-xs h-8" onClick={handleSave} disabled={years.length === 0}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
