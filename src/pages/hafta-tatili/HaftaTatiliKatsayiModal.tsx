import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface HaftaTatiliKatsayiModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (katsayi: number) => void;
}

export default function HaftaTatiliKatsayiModal({ open, onClose, onApply }: HaftaTatiliKatsayiModalProps) {
  const [bilinenUcret, setBilinenUcret] = useState<string>("");
  const [asgariUcret, setAsgariUcret] = useState<string>("");
  const result = useMemo(() => {
    const b = Number(bilinenUcret);
    const a = Number(asgariUcret);
    if (!a || isNaN(a) || isNaN(b)) return 0;
    return b / a;
  }, [bilinenUcret, asgariUcret]);

  useEffect(() => {
    if (!open) {
      setBilinenUcret("");
      setAsgariUcret("");
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-[min(480px,95vw)] rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-4"
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Kat Sayı Hesapla</div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Bilinen Ücret</Label>
            <Input type="number" value={bilinenUcret} onChange={(e) => setBilinenUcret(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Asgari Ücret</Label>
            <Input type="number" value={asgariUcret} onChange={(e) => setAsgariUcret(e.target.value)} />
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200">
            Katsayı: <b>{result.toFixed(4)}</b>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button onClick={() => { onApply(Number.isFinite(result) ? result : 0); onClose(); }} className="bg-blue-600 hover:bg-blue-700 text-white">Uygula</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}


