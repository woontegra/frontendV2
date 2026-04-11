import { useRef, useState, useEffect } from "react";
import { X, GripVertical } from "lucide-react";

interface DraggableNoteProps {
  id: string;
  x: number;
  y: number;
  text: string;
  onChange: (id: string, text: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
}

export default function DraggableNote({
  id, x, y, text, onChange, onDragEnd, onDelete,
}: DraggableNoteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const dragging = useRef(false);
  const offset = useRef({ dx: 0, dy: 0 });

  useEffect(() => { setPos({ x, y }); }, [x, y]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    offset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: ev.clientX - offset.current.dx, y: ev.clientY - offset.current.dy });
    };
    const onUp = (ev: MouseEvent) => {
      dragging.current = false;
      const nx = ev.clientX - offset.current.dx;
      const ny = ev.clientY - offset.current.dy;
      setPos({ x: nx, y: ny });
      onDragEnd(id, nx, ny);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={ref}
      className="fixed z-40 w-52 bg-amber-50 dark:bg-amber-900/80 border border-amber-300 dark:border-amber-700 rounded-xl shadow-lg flex flex-col"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Başlık / sürükleme alanı */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 cursor-grab active:cursor-grabbing bg-amber-200/60 dark:bg-amber-800/60 rounded-t-xl select-none"
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
          <GripVertical className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Not</span>
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onDelete(id)}
          className="p-0.5 hover:bg-amber-300/60 dark:hover:bg-amber-700/60 rounded transition-colors"
        >
          <X className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        </button>
      </div>

      {/* Metin alanı */}
      <textarea
        value={text}
        onChange={e => onChange(id, e.target.value)}
        placeholder="Notunuzu yazın…"
        className="flex-1 resize-none p-2.5 text-xs bg-transparent text-amber-900 dark:text-amber-100 placeholder:text-amber-400 dark:placeholder:text-amber-600 focus:outline-none rounded-b-xl min-h-[80px]"
        onMouseDown={e => e.stopPropagation()}
      />
    </div>
  );
}
