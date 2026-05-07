import { useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackDemoOnboardingEvent } from "@/shared/utils/demoOnboarding";
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
  { label: "İş Kanununa Göre Kıdem Tazminatı", type: "kidem", path: "/kidem-tazminati/30isci" },
  { label: "İş Kanununa Göre İhbar Tazminatı", type: "ihbar", path: "/ihbar-tazminati/30isci" },
  { label: "Standart Fazla Mesai", type: "fazla_mesai", path: "/fazla-mesai/standart" },
  { label: "İş Kanununa Göre Yıllık İzin", type: "yillik_izin", path: "/yillik-izin/standart" },
  { label: "Standart UBGT Alacağı", type: "ubgt", path: "/ubgt-alacagi" },
  { label: "Standart Hafta Tatili Alacağı", type: "hafta_tatili", path: "/hafta-tatili/standard" },
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
                Demo kullanımda hızlı başlamak için aşağıdaki hesaplamalardan birini seçebilirsiniz:
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200/80 dark:border-blue-800/70 bg-blue-50/60 dark:bg-blue-900/10 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STARTER_MODULES.map((item) => (
              <button
                key={item.type}
                type="button"
                className="text-left rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-slate-900/40 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                onClick={async () => {
                  await trackDemoOnboardingEvent("modal_selection", {
                    calculationType: item.type,
                    targetPath: item.path,
                  });
                  window.location.href = item.path;
                }}
              >
                <span className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-gray-800 dark:text-gray-200">{item.label}</span>
                </span>
              </button>
            ))}
          </div>
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
