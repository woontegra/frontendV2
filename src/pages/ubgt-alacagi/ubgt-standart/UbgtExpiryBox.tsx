import React, { useCallback, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, subDays, subYears, format } from "date-fns";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calcInputCls, calcLabelCls } from "@/shared/calcPageFormStyles";

function toUTC(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function toISODateUTC(date: Date | null): string {
  if (!date) return "";
  try {
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export interface UbgtExpiryBoxProps {
  ubgtExpiryStart: string | null;
  onUbgtExpiryStartChange: (date: string | null) => void;
  onUbgtExpiryCancel?: () => void;
  iseGiris?: string;
}

function useZamanasimiPreview(
  dava: string,
  bas: string,
  bit: string,
  iseGiris?: string
) {
  return useMemo(() => {
    const davaD = dava ? toUTC(dava) : null;
    const basD = bas ? toUTC(bas) : null;
    const bitD = bit ? toUTC(bit) : null;
    const gun = basD && bitD ? Math.max(0, differenceInCalendarDays(bitD, basD) + 1) : null;
    const limit = davaD ? subYears(davaD, 5) : null;

    const pandemiBas = new Date("2020-03-13");
    const pandemiBit = new Date("2020-06-15");
    const iseD = iseGiris ? toUTC(iseGiris) : null;
    let pandemiGun = 0;
    if (iseD) {
      if (iseD < pandemiBas) pandemiGun = 94;
      else if (iseD >= pandemiBas && iseD <= pandemiBit) {
        pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBit, iseD) + 1);
      }
    }
    const pandemiEklendi = pandemiGun > 0;
    let nihai = limit ? (gun != null ? subDays(limit, gun) : limit) : null;
    if (pandemiEklendi && nihai) nihai = subDays(nihai, pandemiGun);
    return { davaD, gun, limit, nihai, pandemiEklendi, pandemiGun };
  }, [dava, bas, bit, iseGiris]);
}

export default React.memo(function UbgtExpiryBox({
  ubgtExpiryStart,
  onUbgtExpiryStartChange,
  onUbgtExpiryCancel,
  iseGiris,
}: UbgtExpiryBoxProps) {
  const { error: showToastError } = useToast();
  const [open, setOpen] = useState(false);
  const [zForm, setZForm] = useState({ dava: "", bas: "", bit: "" });
  const prevRef = useRef<string | null>(null);

  const preview = useZamanasimiPreview(zForm.dava, zForm.bas, zForm.bit, iseGiris);

  const apply = useCallback(() => {
    try {
      const basUTC = zForm.bas ? toUTC(zForm.bas) : null;
      const bitUTC = zForm.bit ? toUTC(zForm.bit) : null;
      const arabuluculukGun =
        basUTC && bitUTC ? Math.max(0, differenceInCalendarDays(bitUTC, basUTC) + 1) : 0;
      const davaUTC = zForm.dava ? toUTC(zForm.dava) : null;
      const limitTarihi = davaUTC ? subYears(davaUTC, 5) : null;
      let nihai = limitTarihi ? subDays(limitTarihi, arabuluculukGun) : null;

      const pandemiBas = new Date("2020-03-13");
      const pandemiBit = new Date("2020-06-15");
      const iseD = iseGiris ? toUTC(iseGiris) : null;
      let pandemiGun = 0;
      if (iseD) {
        if (iseD < pandemiBas) pandemiGun = 94;
        else if (iseD >= pandemiBas && iseD <= pandemiBit) {
          pandemiGun = Math.max(0, differenceInCalendarDays(pandemiBit, iseD) + 1);
        }
      }
      if (pandemiGun > 0 && nihai) nihai = subDays(nihai, pandemiGun);

      if (nihai) {
        prevRef.current = null;
        onUbgtExpiryStartChange(toISODateUTC(nihai));
      }
      setOpen(false);
    } catch {
      setOpen(false);
    }
  }, [zForm, iseGiris, onUbgtExpiryStartChange]);

  const cancel = useCallback(() => {
    setOpen(false);
    if (prevRef.current != null) onUbgtExpiryStartChange(prevRef.current);
    prevRef.current = null;
  }, [onUbgtExpiryStartChange]);

  const openModal = useCallback(() => {
    prevRef.current = ubgtExpiryStart ?? null;
    if (ubgtExpiryStart) onUbgtExpiryStartChange(null);
    setOpen(true);
  }, [ubgtExpiryStart, onUbgtExpiryStartChange]);

  const remove = useCallback(() => {
    onUbgtExpiryStartChange(null);
    prevRef.current = null;
    onUbgtExpiryCancel?.();
  }, [onUbgtExpiryStartChange, onUbgtExpiryCancel]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
          ubgtExpiryStart
            ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-indigo-400"
        }`}
      >
        {ubgtExpiryStart ? "Zamanaşımı" : "Zamanaşımı İtirazı"}
      </button>
      {ubgtExpiryStart ? (
        <button
          type="button"
          onClick={remove}
          className="text-xs text-gray-600 dark:text-gray-400 hover:text-red-600"
          title="Kaldır"
        >
          Kaldır
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={(v) => !v && cancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Zamanaşımı hesaplama</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className={calcLabelCls}>Dava tarihi</label>
              <input
                type="date"
                className={calcInputCls}
                value={zForm.dava}
                onChange={(e) => setZForm((p) => ({ ...p, dava: e.target.value }))}
                max="9999-12-31"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={calcLabelCls}>Arabuluculuk başlangıç</label>
                <input
                  type="date"
                  className={calcInputCls}
                  value={zForm.bas}
                  max="9999-12-31"
                  onChange={(e) => setZForm((p) => ({ ...p, bas: e.target.value }))}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v && zForm.bit && /^\d{4}-\d{2}-\d{2}$/.test(v) && /^\d{4}-\d{2}-\d{2}$/.test(zForm.bit)) {
                      if (new Date(v) > new Date(zForm.bit)) showToastError("Başlangıç, bitişten sonra olamaz.");
                    }
                  }}
                />
              </div>
              <div>
                <label className={calcLabelCls}>Arabuluculuk bitiş</label>
                <input
                  type="date"
                  className={calcInputCls}
                  value={zForm.bit}
                  max="9999-12-31"
                  onChange={(e) => setZForm((p) => ({ ...p, bit: e.target.value }))}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v && zForm.bas && /^\d{4}-\d{2}-\d{2}$/.test(v) && /^\d{4}-\d{2}-\d{2}$/.test(zForm.bas)) {
                      if (new Date(v) < new Date(zForm.bas)) showToastError("Bitiş, başlangıçtan önce olamaz.");
                    }
                  }}
                />
              </div>
            </div>
            <div className="rounded-md border border-gray-200 dark:border-gray-600 p-2 space-y-1 text-gray-700 dark:text-gray-300">
              <div>
                Dava: <b>{preview.davaD ? format(preview.davaD, "dd.MM.yyyy") : "—"}</b>
              </div>
              <div>
                5 yıl
                {preview.pandemiEklendi ? ` + ${preview.pandemiGun} gün (pandemi)` : ""}:{" "}
                <b>{preview.limit ? format(preview.limit, "dd.MM.yyyy") : "—"}</b>
              </div>
              <div>
                Arabuluculuk: <b>{preview.gun != null ? `${preview.gun} gün` : "—"}</b>
              </div>
              <div className="text-indigo-700 dark:text-indigo-300 font-medium pt-1">
                Nihai başlangıç: <b>{preview.nihai ? format(preview.nihai, "dd.MM.yyyy") : "—"}</b>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={cancel}>
              İptal
            </Button>
            <Button type="button" size="sm" className="text-xs h-8" onClick={apply}>
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
