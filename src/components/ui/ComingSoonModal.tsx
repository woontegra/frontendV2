import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ComingSoonModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[420px] mx-auto my-auto space-y-3">
        <DialogHeader>
          <DialogTitle>Yakında Hizmete Girecek</DialogTitle>
          <DialogDescription>
            Bu bölüm şu anda geliştirme aşamasındadır.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 text-sm font-medium"
          >
            Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
