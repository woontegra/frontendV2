import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  CalendarClock,
  CalendarRange,
  HardHat,
  Home,
  Layers,
  Newspaper,
  Ship,
  Sun,
  Timer,
  Users,
  Watch,
} from "lucide-react";

const cards: Array<{
  title: string;
  to?: string;
  icon: LucideIcon;
  color: string;
  cta?: string;
  comingSoon?: boolean;
}> = [
  { title: "Standart Fazla Mesai", to: "/fazla-mesai/standart", icon: Calculator, color: "amber" },
  { title: "Tanıklı Standart", to: "/fazla-mesai/tanikli-standart", icon: Users, color: "slate" },
  { title: "Haftalık Karma", to: "/fazla-mesai/haftalik-karma", icon: CalendarRange, color: "violet" },
  { title: "Dönemsel", to: "/fazla-mesai/donemsel", icon: Layers, color: "orange" },
  { title: "Dönemsel Haftalık", to: "/fazla-mesai/donemsel-haftalik", icon: CalendarClock, color: "cyan" },
  { title: "Yeraltı İşçileri", to: "/fazla-mesai/yeralti-isci", icon: HardHat, color: "stone" },
  { title: "24 / 48 Saat Vardiya", to: "/fazla-mesai/vardiya-24-48", icon: Sun, color: "yellow" },
  { title: "Gemi Adamı", to: "/fazla-mesai/gemi-adami", icon: Ship, color: "sky" },
  { title: "Ev İşçileri", to: "/fazla-mesai/ev", icon: Home, color: "emerald", cta: "Bilgilendirmeyi oku →" },
  {
    title: "12 Saat Vardiya Usulü",
    icon: Watch,
    color: "violet",
    comingSoon: true,
  },
  {
    title: "Fazla Sürelerle Çalışma",
    icon: Timer,
    color: "indigo",
    comingSoon: true,
  },
  {
    title: "Basın İş",
    icon: Newspaper,
    color: "rose",
    comingSoon: true,
  },
];

const cardStyles: Record<string, { card: string; icon: string; accent: string }> = {
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 ring-1 ring-amber-200/60 dark:ring-amber-800/40 group-hover:ring-amber-400/80 dark:group-hover:ring-amber-600/60",
    icon: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg",
    accent: "group-hover:text-amber-700 dark:group-hover:text-amber-400",
  },
  slate: {
    card: "bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 ring-1 ring-slate-200/60 dark:ring-slate-700/40 group-hover:ring-slate-400/80 dark:group-hover:ring-slate-600/60",
    icon: "bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg",
    accent: "group-hover:text-slate-700 dark:group-hover:text-slate-400",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 ring-1 ring-violet-200/60 dark:ring-violet-800/40 group-hover:ring-violet-400/80 dark:group-hover:ring-violet-600/60",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg",
    accent: "group-hover:text-violet-700 dark:group-hover:text-violet-400",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-50 to-rose-50 dark:from-orange-950/30 dark:to-rose-950/30 ring-1 ring-orange-200/60 dark:ring-orange-800/40 group-hover:ring-orange-400/80 dark:group-hover:ring-orange-600/60",
    icon: "bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg",
    accent: "group-hover:text-orange-700 dark:group-hover:text-orange-400",
  },
  cyan: {
    card: "bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/25 ring-1 ring-cyan-200/70 dark:ring-cyan-800/40 group-hover:ring-cyan-400/80 dark:group-hover:ring-teal-600/50",
    icon: "bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg",
    accent: "group-hover:text-cyan-800 dark:group-hover:text-cyan-300",
  },
  stone: {
    card: "bg-gradient-to-br from-stone-50 to-neutral-50 dark:from-stone-950/30 dark:to-neutral-950/30 ring-1 ring-stone-200/60 dark:ring-stone-700/40 group-hover:ring-stone-400/80 dark:group-hover:ring-stone-500/60",
    icon: "bg-gradient-to-br from-stone-500 to-neutral-600 text-white shadow-lg",
    accent: "group-hover:text-stone-800 dark:group-hover:text-stone-300",
  },
  yellow: {
    card: "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/25 dark:to-amber-950/25 ring-1 ring-yellow-200/70 dark:ring-yellow-800/40 group-hover:ring-yellow-400/80 dark:group-hover:ring-amber-600/50",
    icon: "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg",
    accent: "group-hover:text-amber-800 dark:group-hover:text-amber-300",
  },
  sky: {
    card: "bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/25 ring-1 ring-sky-200/70 dark:ring-sky-800/40 group-hover:ring-sky-400/80 dark:group-hover:ring-cyan-600/50",
    icon: "bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg",
    accent: "group-hover:text-sky-800 dark:group-hover:text-sky-300",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/25 ring-1 ring-emerald-200/70 dark:ring-emerald-800/40 group-hover:ring-emerald-400/80 dark:group-hover:ring-teal-600/50",
    icon: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg",
    accent: "group-hover:text-emerald-800 dark:group-hover:text-emerald-300",
  },
  indigo: {
    card: "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/25 ring-1 ring-indigo-200/70 dark:ring-indigo-800/40 group-hover:ring-indigo-400/70 dark:group-hover:ring-blue-600/50",
    icon: "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg",
    accent: "group-hover:text-indigo-800 dark:group-hover:text-indigo-300",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/25 ring-1 ring-rose-200/70 dark:ring-rose-800/40 group-hover:ring-rose-400/70 dark:group-hover:ring-pink-600/50",
    icon: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg",
    accent: "group-hover:text-rose-800 dark:group-hover:text-rose-300",
  },
};

export default function FazlaMesaiSelectionPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Fazla Mesai Alacağı</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Hesaplama türünü seçin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-5xl mx-auto">
          {cards.map(({ title, to, icon: Icon, color, cta, comingSoon }) => {
            const style = cardStyles[color] || cardStyles.amber;
            const body = (
              <>
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${style.icon}`}>
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h2>
                <span
                  className={`text-xs transition-colors ${
                    comingSoon
                      ? "font-medium text-amber-700 dark:text-amber-400"
                      : `text-gray-500 dark:text-gray-400 ${style.accent}`
                  }`}
                >
                  {comingSoon ? "Çok yakında" : (cta ?? "Hesaplamaya git →")}
                </span>
              </>
            );

            if (comingSoon) {
              return (
                <div
                  key={title}
                  role="status"
                  aria-label={`${title} — çok yakında`}
                  className={`relative flex flex-col items-center text-center gap-2 p-4 rounded-2xl shadow-md opacity-[0.88] cursor-not-allowed select-none ${style.card}`}
                >
                  <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                    Yakında
                  </span>
                  {body}
                </div>
              );
            }

            return (
              <Link
                key={to}
                to={to!}
                className={`group relative flex flex-col items-center text-center gap-2 p-4 rounded-2xl transition-shadow duration-200 shadow-lg hover:shadow-xl ${style.card}`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
