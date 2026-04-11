import { Link } from "react-router-dom";
import { CalendarDays, Ship, Newspaper } from "lucide-react";

const cards = [
  { title: "Standart", to: "/hafta-tatili/standard", icon: CalendarDays, color: "violet" },
  { title: "Gemi Adamları", to: "/hafta-tatili/gemi-adami", icon: Ship, color: "sky" },
  { title: "Basın İş", to: "/hafta-tatili/basin-is", icon: Newspaper, color: "rose" },
];

const cardStyles: Record<string, { card: string; icon: string; accent: string }> = {
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 ring-1 ring-violet-200/60 dark:ring-violet-800/40 group-hover:ring-violet-400/80 dark:group-hover:ring-violet-600/60",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg",
    accent: "group-hover:text-violet-700 dark:group-hover:text-violet-400",
  },
  sky: {
    card: "bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 ring-1 ring-sky-200/60 dark:ring-sky-800/40 group-hover:ring-sky-400/80 dark:group-hover:ring-sky-600/60",
    icon: "bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg",
    accent: "group-hover:text-sky-700 dark:group-hover:text-sky-400",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 ring-1 ring-rose-200/60 dark:ring-rose-800/40 group-hover:ring-rose-400/80 dark:group-hover:ring-rose-600/60",
    icon: "bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg",
    accent: "group-hover:text-rose-700 dark:group-hover:text-rose-400",
  },
};

export default function HaftaTatiliSelectionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 sm:mb-14 h-20 sm:h-24" aria-hidden="true" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {cards.map(({ title, to, icon: Icon, color }) => {
            const style = cardStyles[color] || cardStyles.violet;
            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-col items-center text-center gap-2 p-4 rounded-2xl transition-shadow duration-200 shadow-lg hover:shadow-xl ${style.card}`}
              >
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${style.icon}`}>
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h2>
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
