/**
 * Mahsuplaşma Ekle Modal - Ay/yıl bazında giriş
 */
import { useState, useMemo, useEffect } from "react";

const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function parseDate(periodStr: string): { year: number } | null {
  const m = periodStr.match(/(\d{4})-\d{2}-\d{2}/);
  return m ? { year: parseInt(m[1], 10) } : null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (total: number) => void;
  /** Dönem etiketleri (örn. 2020-01-01 – 2020-12-31) - yılları çıkarmak için */
  periodLabels: string[];
}

const inputCls = "w-full px-2 py-1 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-right";

export function MahsuplasamaModal({ open, onClose, onSave, periodLabels }: Props) {
  const years = useMemo(() => {
    const set = new Set<number>();
    periodLabels.forEach((p) => {
      const info = parseDate(p.trim().split(/[\s–-]+/)[0] || "");
      if (info) set.add(info.year);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [periodLabels]);

  const [values, setValues] = useState<Record<number, Record<number, number>>>({});

  useEffect(() => {
    if (!open) setValues({});
  }, [open]);

  const handleChange = (year: number, month: number, v: string) => {
    const n = parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
    setValues((prev) => ({
      ...prev,
      [year]: { ...(prev[year] || {}), [month]: n },
    }));
  };

  const getValue = (year: number, month: number): string => {
    const v = values[year]?.[month];
    return v != null ? String(v) : "";
  };

  const total = useMemo(() => {
    let s = 0;
    Object.values(values).forEach((byMonth) => {
      Object.values(byMonth).forEach((v) => { s += v; });
    });
    return s;
  }, [values]);

  const handleSave = () => {
    onSave(total);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-600" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold">Mahsuplaşma Ekle</h3>
          <p className="text-sm text-gray-500 mt-1">Ay ve yıl bazında mahsuplaşma miktarlarını girin.</p>
        </div>
        <div className="p-4 overflow-x-auto">
          {years.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">Hesaplama tablosunda veri bulunamadı. Önce hesaplama yapın.</p>
          ) : (
            <table className="w-full text-xs border-collapse text-gray-900 dark:text-gray-100">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-left">Ay</th>
                  {years.map((y) => (
                    <th key={y} className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-center">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthNames.map((name, idx) => {
                  const month = idx + 1;
                  return (
                    <tr key={month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 font-medium">{name}</td>
                      {years.map((year) => (
                        <td key={year} className="border border-gray-200 dark:border-gray-600 px-1 py-0.5">
                          <input
                            type="text"
                            value={getValue(year, month)}
                            onChange={(e) => handleChange(year, month, e.target.value)}
                            placeholder="0"
                            className={inputCls}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
          <span className="text-sm font-medium">Toplam: {total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 dark:hover:bg-gray-700">İptal</button>
            <button type="button" onClick={handleSave} disabled={years.length === 0} className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">Uygula</button>
          </div>
        </div>
      </div>
    </div>
  );
}
