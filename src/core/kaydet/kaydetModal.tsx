/**
 * Merkezi Kayıt Modal'ı
 * Tüm hesaplama sayfaları için ortak modal – varsayılan isim yok, kibar görünüm
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Footer (Önizleme, Kaydet, Kayıtlar, Profil) ile aynı stil: beyaz zemin, renkli border
const modalBtnBase =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-11";

type KaydetModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
  hesapTuru: string;
  defaultName?: string;
  isLoading?: boolean;
};

export default function KaydetModal({
  open,
  onClose,
  onSave,
  hesapTuru: _hesapTuru,
  defaultName: _defaultName,
  isLoading = false,
}: KaydetModalProps) {
  const [name, setName] = useState("");

  // Modal her açıldığında alan boş; varsayılan isim yazılmaz
  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  const handleSave = async () => {
    if (name.trim()) {
      await onSave(name.trim());
      setName("");
    }
  };

  const handleClose = () => {
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] rounded-2xl border border-gray-200 dark:border-gray-600 shadow-xl bg-white dark:bg-gray-800">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Hesaplamayı Kaydet
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
            Kaydedilen hesaplamalarınızda görünecek bir isim girin.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Label
            htmlFor="kayit-adi"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Hesaplama Adı
          </Label>
          <Input
            id="kayit-adi"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !isLoading) {
                handleSave();
              }
            }}
            placeholder="Örn: Hesaplama adı"
            className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500/50"
            autoFocus
            disabled={isLoading}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0 flex-row justify-end mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className={`${modalBtnBase} bg-white dark:bg-gray-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50`}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
            className={`${modalBtnBase} bg-white dark:bg-gray-800 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30`}
          >
            {isLoading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
