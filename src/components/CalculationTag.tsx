import { X } from "lucide-react";

interface CalculationTagProps {
  id: string;
  color: string;
  label: string;
  onDelete: (id: string) => void;
}

export default function CalculationTag({ id, color, label, onDelete }: CalculationTagProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {label}
      <button
        onClick={() => onDelete(id)}
        className="hover:opacity-75 transition-opacity ml-0.5"
        aria-label="Etiketi sil"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
