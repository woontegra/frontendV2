/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  hesapTuru,
  defaultName,
  isLoading = false,
}: KaydetModalProps) {
  const [name, setName] = useState(defaultName || "");

  useEffect(() => {
    if (open) {
      if (defaultName) {
        setName(defaultName);
      } else {
        const today = new Date();
        const formattedDate = today.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const hesapTuruLabel = hesapTuru
          ? hesapTuru.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          : "Hesaplama";
        setName(`${hesapTuruLabel} - ${formattedDate}`);
      }
    }
  }, [open, defaultName, hesapTuru]);

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Hesaplamayı Kaydet</DialogTitle>
          <DialogDescription>
            Hesaplamanızı kaydetmek için bir isim giriniz.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="kayit-adi" className="block text-sm font-medium mb-2">
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
            placeholder="Örn: Ahmet Yılmaz - Kıdem Tazminatı"
            className="w-full"
            autoFocus
            disabled={isLoading}
          />
          <p className="mt-2 text-xs text-gray-500">
            Bu isim kaydedilen hesaplamalarınız sayfasında görünecektir.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isLoading}>
            {isLoading ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
