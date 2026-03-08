/** Zamanaşımı Modal */
import { useMemo, useCallback } from "react";
import { subYears, subDays, differenceInCalendarDays } from "date-fns";

function toUTC(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (p: { davaTarihi: string; arabuluculukBaslangic: string; arabuluculukBitis: string; arabuluculukGun: number; nihaiBaslangic: string }) => void;
  form: { dava: string; bas: string; bit: string };
  setForm: React.Dispatch<React.SetStateAction<{ dava: string; bas: string; bit: string }>>;
  showToastError?: (msg: string) => void;
  iseGiris?: string;
}

const inputCls = "w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800";

export function ZamanasimiModal({ isOpen, onClose, onApply, form, setForm, showToastError, iseGiris }: Props) {
  const calc = useMemo(() => {
    const dava = form.dava ? toUTC(form.dava) : null;
    const bas = form.bas ? toUTC(form.bas) : null;
    const bit = form.bit ? toUTC(form.bit) : null;
    const gun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : 0;
    const limit = dava ? subYears(dava, 5) : null;
    const pandemiB = new Date("2020-03-13");
    const pandemiE = new Date("2020-06-15");
    const iseDate = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    if (iseDate) {
      if (iseDate < pandemiB) pandemiGun = 94;
      else if (iseDate >= pandemiB && iseDate <= pandemiE) pandemiGun = Math.max(0, differenceInCalendarDays(pandemiE, iseDate) + 1);
    }
    let nihai = limit ? subDays(limit, gun) : null;
    if (nihai && pandemiGun > 0) nihai = subDays(nihai, pandemiGun);
    return { limit, nihai, gun, pandemiGun };
  }, [form.dava, form.bas, form.bit, iseGiris]);

  const handleApply = useCallback(() => {
    const bas = form.bas ? toUTC(form.bas) : null;
    const bit = form.bit ? toUTC(form.bit) : null;
    const arabuluculukGun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : 0;
    const dava = form.dava ? toUTC(form.dava) : null;
    let nihai = dava ? subDays(subYears(dava, 5), arabuluculukGun) : null;
    const iseDate = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    if (iseDate) {
      const pandemiB = new Date("2020-03-13");
      const pandemiE = new Date("2020-06-15");
      if (iseDate < pandemiB) pandemiGun = 94;
      else if (iseDate >= pandemiB && iseDate <= pandemiE) pandemiGun = Math.max(0, differenceInCalendarDays(pandemiE, iseDate) + 1);
    }
    if (nihai && pandemiGun > 0) nihai = subDays(nihai, pandemiGun);
    if (!nihai) { showToastError?.("Dava tarihi giriniz."); return; }
    onApply({ davaTarihi: form.dava || "", arabuluculukBaslangic: form.bas || "", arabuluculukBitis: form.bit || "", arabuluculukGun, nihaiBaslangic: toISODate(nihai) });
    onClose();
  }, [form, iseGiris, onApply, onClose, showToastError]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-600" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-600"><h3 className="text-lg font-semibold">Zamanaşımı Hesaplama</h3></div>
        <div className="p-4 space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Dava Tarihi</label><input type="date" value={form.dava} onChange={(e) => setForm((p) => ({ ...p, dava: e.target.value }))} className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Arabuluculuk Başlangıç</label><input type="date" value={form.bas} onChange={(e) => setForm((p) => ({ ...p, bas: e.target.value }))} className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Arabuluculuk Bitiş</label><input type="date" value={form.bit} onChange={(e) => setForm((p) => ({ ...p, bit: e.target.value }))} className={inputCls} /></div>
          {calc.limit && (
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 pt-1">
              <div>Dava tarihi: <strong>{form.dava ? new Date(form.dava).toLocaleDateString("tr-TR") : "-"}</strong></div>
              <div>Zamanaşımı süresi (5 yıl): <strong>{calc.limit.toLocaleDateString("tr-TR")}</strong></div>
              <div>Arabuluculuk süresi: <strong>{calc.gun} gün</strong></div>
              {calc.pandemiGun > 0 && (
                <div className="text-amber-800 dark:text-amber-200 text-xs mt-2 p-2 rounded border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30">
                  <strong>Pandemi Dönemi:</strong> 13 Mart 2020 - 15 Haziran 2020 arası pandemi hak kaybı süresi nedeniyle +{calc.pandemiGun} gün eklendi.
                </div>
              )}
              {calc.nihai && (
                <div className="text-blue-600 dark:text-blue-400 font-medium mt-1">
                  Nihai zamanaşımı başlangıç tarihi: <strong>{calc.nihai.toLocaleDateString("tr-TR")}</strong>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-600">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50">İptal</button>
          <button type="button" onClick={handleApply} className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700">Uygula</button>
        </div>
      </div>
    </div>
  );
}
