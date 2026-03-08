/**
 * Kat Sayı Hesapla Modal - Bilinen ücret / asgari ücret
 */
import { useMemo, useEffect, useState } from "react";

const parseTR = (s: string): number => {
  const n = parseFloat(String(s || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (katsayi: number) => void;
}

const inputCls = "w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800";

export function KatsayiModal({ open, onClose, onApply }: Props) {
  const [bilinenUcret, setBilinenUcret] = useState("");
  const [asgariUcret, setAsgariUcret] = useState("");

  const result = useMemo(() => {
    const known = parseTR(bilinenUcret);
    const min = parseTR(asgariUcret);
    if (!min || !known) return 0;
    return Number((known / min).toFixed(4));
  }, [bilinenUcret, asgariUcret]);

  useEffect(() => {
    if (!open) {
      setBilinenUcret("");
      setAsgariUcret("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-600" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold">Kat Sayı Hesapla</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bilinen Ücret</label>
            <input type="text" value={bilinenUcret} onChange={(e) => setBilinenUcret(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Asgari Ücret</label>
            <input type="text" value={asgariUcret} onChange={(e) => setAsgariUcret(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Katsayı: <strong>{result.toFixed(4)}</strong></p>
        </div>
        <div className="p-4 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-600">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">İptal</button>
          <button type="button" onClick={() => { onApply(result); onClose(); }} className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700">Uygula</button>
        </div>
      </div>
    </div>
  );
}
