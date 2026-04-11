/**
 * Zamanaşımı İtirazı Modalı — Hafta Tatili Standart
 */

import { useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { differenceInCalendarDays, subYears, subDays, format } from "date-fns";
import { X } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";

function toUTC(s: string): Date | null {
  if (!s) return null;
  try {
    const d = new Date(s + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function toISODateUTC(d: Date | null): string {
  if (!d) return "";
  try {
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

interface Props {
  // Yeni prop isimleri
  expiryStart?: string | null;
  onChange?: (date: string | null) => void;
  onCancel?: () => void;
  // Eski prop isimleri (geriye dönük uyumluluk)
  haftaTatiliExpiryStart?: string | null;
  onHaftaTatiliExpiryStartChange?: (date: string | null) => void;
  onHaftaTatiliExpiryCancel?: () => void;
  iseGiris?: string;
}

export default function HaftaTatiliExpiryBox(props: Props) {
  const expiryStart = props.expiryStart ?? props.haftaTatiliExpiryStart ?? null;
  const onChange = props.onChange ?? props.onHaftaTatiliExpiryStartChange ?? (() => {});
  const onCancel = props.onCancel ?? props.onHaftaTatiliExpiryCancel;
  const { iseGiris } = props;
  const { error: showError } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ dava: "", bas: "", bit: "" });
  const prevRef = useRef<string | null>(null);

  const calc = useMemo(() => {
    const dava = form.dava ? toUTC(form.dava) : null;
    const bas = form.bas ? toUTC(form.bas) : null;
    const bit = form.bit ? toUTC(form.bit) : null;
    const gun = bas && bit ? Math.max(0, differenceInCalendarDays(bit, bas) + 1) : null;
    const limit = dava ? subYears(dava, 5) : null;

    const pandemiStart = new Date("2020-03-13");
    const pandemiEnd = new Date("2020-06-15");
    const iseGirisDate = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    if (iseGirisDate) {
      if (iseGirisDate < pandemiStart) pandemiGun = 94;
      else if (iseGirisDate >= pandemiStart && iseGirisDate <= pandemiEnd)
        pandemiGun = Math.max(0, differenceInCalendarDays(pandemiEnd, iseGirisDate) + 1);
    }

    let nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : null;
    if (pandemiGun > 0 && nihai) nihai = subDays(nihai, pandemiGun);

    return { dava, bas, bit, gun, limit, nihai, pandemiGun };
  }, [form.dava, form.bas, form.bit, iseGiris]);

  const handleOpen = useCallback(() => {
    prevRef.current = expiryStart ?? null;
    if (expiryStart) onChange(null);
    setOpen(true);
  }, [expiryStart, onChange]);

  const handleApply = useCallback(() => {
    if (calc.nihai) {
      prevRef.current = null;
      onChange(toISODateUTC(calc.nihai));
    }
    setOpen(false);
  }, [calc.nihai, onChange]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    if (prevRef.current) onChange(prevRef.current);
    prevRef.current = null;
  }, [onChange]);

  const handleRemove = useCallback(() => {
    onChange(null);
    prevRef.current = null;
    onCancel?.();
  }, [onChange, onCancel]);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleOpen}
          className="px-3 py-1.5 text-xs font-medium rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700"
        >
          Zamanaşımı İtirazı
        </button>
        {expiryStart && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-400">
            <span>Zamanaşımı: {new Date(expiryStart).toLocaleDateString("tr-TR")}</span>
            <button type="button" onClick={handleRemove} title="Kaldır">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40" onClick={handleCancel}>
            <div
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Zamanaşımı Hesaplama</h3>
                <button type="button" onClick={handleCancel} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className={labelCls}>Dava Tarihi</label>
                  <input
                    type="date"
                    value={form.dava}
                    onChange={(e) => setForm((p) => ({ ...p, dava: e.target.value }))}
                    className={inputCls}
                    max="9999-12-31"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Arabuluculuk Başlangıç</label>
                    <input
                      type="date"
                      value={form.bas}
                      onChange={(e) => setForm((p) => ({ ...p, bas: e.target.value }))}
                      onBlur={(e) => {
                        if (e.target.value && form.bit && new Date(e.target.value) > new Date(form.bit))
                          showError("Başlangıç tarihi bitiş tarihinden sonra olamaz");
                      }}
                      className={inputCls}
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Arabuluculuk Bitiş</label>
                    <input
                      type="date"
                      value={form.bit}
                      onChange={(e) => setForm((p) => ({ ...p, bit: e.target.value }))}
                      className={inputCls}
                      max="9999-12-31"
                    />
                  </div>
                </div>

                {calc.dava && (
                  <div className="mt-2 p-2.5 rounded bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span>Dava tarihi</span>
                      <span className="font-medium">{format(calc.dava, "dd.MM.yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Zamanaşımı süresi ({calc.pandemiGun > 0 ? `5 yıl + ${calc.pandemiGun} gün` : "5 yıl"})</span>
                      <span className="font-medium">{calc.limit ? format(calc.limit, "dd.MM.yyyy") : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Arabuluculuk süresi</span>
                      <span className="font-medium">{calc.gun != null ? `${calc.gun} gün` : "-"}</span>
                    </div>
                    {calc.pandemiGun > 0 && (
                      <div className="mt-1 p-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
                        Pandemi dönemi: +{calc.pandemiGun} gün eklendi
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600 font-medium text-blue-700 dark:text-blue-400">
                      <span>Nihai zamanaşımı başlangıcı</span>
                      <span>{calc.nihai ? format(calc.nihai, "dd.MM.yyyy") : "-"}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!calc.nihai}
                  className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Uygula
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
