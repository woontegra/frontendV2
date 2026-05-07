import { Link } from "react-router-dom";
import { BadgePercent, Calculator, ShieldCheck, ShieldOff } from "lucide-react";

const cards = [
  {
    title: "Damga Vergisi Kesintili",
    to: "/icra-takip-brutten-nete/damga-vergisi-kesintili",
    icon: BadgePercent,
    color: "emerald",
  },
  {
    title: "Gelir Vergisi ve Damga Vergisi Kesintili",
    to: "/icra-takip-brutten-nete/gelir-ve-damga-vergisi-kesintili",
    icon: Calculator,
    color: "blue",
  },
  {
    title: "İstisnalı Full Kesintili",
    to: "/icra-takip-brutten-nete/istisnali-full-kesintili",
    icon: ShieldCheck,
    color: "violet",
  },
  {
    title: "İstisnasız Full Kesintili",
    to: "/icra-takip-brutten-nete/istisnasiz-full-kesintili",
    icon: ShieldOff,
    color: "amber",
  },
];

const cardStyles: Record<string, { card: string; icon: string; accent: string }> = {
  emerald: {
    card: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 group-hover:ring-emerald-400/80 dark:group-hover:ring-emerald-600/60",
    icon: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg",
    accent: "group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
  },
  blue: {
    card: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 ring-1 ring-blue-200/60 dark:ring-blue-800/40 group-hover:ring-blue-400/80 dark:group-hover:ring-blue-600/60",
    icon: "bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg",
    accent: "group-hover:text-blue-700 dark:group-hover:text-blue-400",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 ring-1 ring-violet-200/60 dark:ring-violet-800/40 group-hover:ring-violet-400/80 dark:group-hover:ring-violet-600/60",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg",
    accent: "group-hover:text-violet-700 dark:group-hover:text-violet-400",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 ring-1 ring-amber-200/60 dark:ring-amber-800/40 group-hover:ring-amber-400/80 dark:group-hover:ring-amber-600/60",
    icon: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg",
    accent: "group-hover:text-amber-700 dark:group-hover:text-amber-400",
  },
};

export default function IcraTakipSelectionPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">İcra Takip Brütten Nete</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Hesaplama türünü seçin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {cards.map(({ title, to, icon: Icon, color }) => {
            const style = cardStyles[color] || cardStyles.emerald;
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
