import { useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StarterWelcomeModalProps {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

const STARTER_MODULES = [
  "İş Kanununa Göre Kıdem Tazminatı",
  "İş Kanununa Göre İhbar Tazminatı",
  "Standart Fazla Mesai",
  "İş Kanununa Göre Yıllık İzin",
  "Standart UBGT Alacağı",
  "Standart Hafta Tatili Alacağı",
];

export default function StarterWelcomeModal({ open, onClose }: StarterWelcomeModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-start gap-3 mb-1">
            <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Starter Paket Rehberi</DialogTitle>
              <DialogDescription className="mt-1">
                İlk kullanımda hızlı başlamak için erişebildiğiniz modüller:
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200/80 dark:border-blue-800/70 bg-blue-50/60 dark:bg-blue-900/10 p-4">
          <ul className="space-y-2.5">
            {STARTER_MODULES.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4.5 h-4.5 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-800 dark:text-gray-200">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="mt-1 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
          />
          Kapat, bir daha gösterme
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Kapat
          </Button>
          <Button
            onClick={() => {
              window.location.href = "https://www.bilirkisihesap.com/satin-al";
            }}
          >
            Paketi Yükselt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
