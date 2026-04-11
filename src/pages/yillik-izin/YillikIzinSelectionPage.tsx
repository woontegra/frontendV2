import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Briefcase, Scale, Ship, Sun, Newspaper, Clock, FileCheck } from "lucide-react";

const cards: Array<{
  title: string;
  to?: string;
  icon: LucideIcon;
  color: string;
  comingSoon?: boolean;
}> = [
  { title: "İş Kanununa Göre Yıllık İzin Hesaplama", to: "/yillik-izin/standart", icon: Briefcase, color: "amber" },
  { title: "Borçlar Kanunu Yıllık İzin Hesaplama", to: "/yillik-izin/borclar", icon: Scale, color: "slate" },
  {
    title: "Gemi Adamları Yıllık İzin Hesaplama",
    to: "/yillik-izin/gemi",
    icon: Ship,
    color: "sky",
  },
  {
    title: "Mevsimlik İşçi Yıllık İzin Hesaplama",
    to: "/yillik-izin/mevsim",
    icon: Sun,
    color: "orange",
  },
  { title: "Basın İşçileri Yıllık İzin Hesaplama", to: "/yillik-izin/basin", icon: Newspaper, color: "rose" },
  { title: "Kısmi Süreli / Part Time Yıllık İzin Hesaplama", to: "/yillik-izin/kismi", icon: Clock, color: "violet" },
  { title: "Belirli Süreli Yıllık İzin Hesaplama", to: "/yillik-izin/belirli", icon: FileCheck, color: "emerald" },
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
  sky: {
    card: "bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/25 ring-1 ring-sky-200/70 dark:ring-sky-800/40 group-hover:ring-sky-400/80 dark:group-hover:ring-cyan-600/50",
    icon: "bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg",
    accent: "group-hover:text-sky-800 dark:group-hover:text-sky-300",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-50 to-rose-50 dark:from-orange-950/30 dark:to-rose-950/30 ring-1 ring-orange-200/60 dark:ring-orange-800/40 group-hover:ring-orange-400/80 dark:group-hover:ring-orange-600/60",
    icon: "bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg",
    accent: "group-hover:text-orange-700 dark:group-hover:text-orange-400",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/25 ring-1 ring-rose-200/70 dark:ring-rose-800/40 group-hover:ring-rose-400/70 dark:group-hover:ring-pink-600/50",
    icon: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg",
    accent: "group-hover:text-rose-800 dark:group-hover:text-rose-300",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 ring-1 ring-violet-200/60 dark:ring-violet-800/40 group-hover:ring-violet-400/80 dark:group-hover:ring-violet-600/60",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg",
    accent: "group-hover:text-violet-700 dark:group-hover:text-violet-400",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/25 ring-1 ring-emerald-200/70 dark:ring-emerald-800/40 group-hover:ring-emerald-400/80 dark:group-hover:ring-teal-600/50",
    icon: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg",
    accent: "group-hover:text-emerald-800 dark:group-hover:text-emerald-300",
  },
};

export default function YillikIzinSelectionPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Yıllık Ücretli İzin Alacağı</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Hesaplama türünü seçin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {cards.map((card) => {
            const style = cardStyles[card.color] || cardStyles.amber;
            const { title, to, icon: Icon, comingSoon } = card;

            if (comingSoon || !to) {
              return (
                <div
                  key={title}
                  className={`group relative flex flex-col items-center text-center gap-2 p-4 rounded-2xl opacity-75 cursor-not-allowed ${style.card}`}
                >
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center ${style.icon}`}>
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Çok yakında</span>
                </div>
              );
            }

            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-col items-center text-center gap-2 p-4 rounded-2xl transition-shadow duration-200 shadow-md hover:shadow-lg ${style.card}`}
              >
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${style.icon}`}>
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{title}</h2>
                <span className={`text-xs text-gray-500 dark:text-gray-400 transition-colors ${style.accent}`}>
                  Hesaplamaya git →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
