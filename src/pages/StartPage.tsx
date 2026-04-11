import { Link } from "react-router-dom";
import { Clock, Umbrella, Briefcase, Calendar, Bell, CalendarDays } from "lucide-react";

const cards = [
  { title: "Kıdem Tazminatı", to: "/kidem-tazminati/30isci", icon: Briefcase, color: "amber" },
  { title: "İhbar Tazminatı", to: "/ihbar-tazminati/30isci", icon: Bell, color: "orange" },
  { title: "Fazla Mesai Hesabı", to: "/fazla-mesai/standart", icon: Clock, color: "indigo" },
  { title: "Yıllık İzin Alacağı", to: "/yillik-izin/standart", icon: Calendar, color: "sky" },
  { title: "UBGT Hesabı", to: "/ubgt-alacagi", icon: Umbrella, color: "emerald" },
  { title: "Hafta Tatili Alacağı", to: "/hafta-tatili/standard", icon: CalendarDays, color: "violet" },
];

const cardStyles: Record<string, { card: string; icon: string; accent: string }> = {
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 ring-1 ring-amber-200/60 dark:ring-amber-800/40 group-hover:ring-amber-400/80",
    icon: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg",
    accent: "group-hover:text-amber-700 dark:group-hover:text-amber-400",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-50 to-rose-50 dark:from-orange-950/30 dark:to-rose-950/30 ring-1 ring-orange-200/60 dark:ring-orange-800/40 group-hover:ring-orange-400/80",
    icon: "bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg",
    accent: "group-hover:text-orange-700 dark:group-hover:text-orange-400",
  },
  indigo: {
    card: "bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 ring-1 ring-indigo-200/60 dark:ring-indigo-800/40 group-hover:ring-indigo-400/80",
    icon: "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg",
    accent: "group-hover:text-indigo-700 dark:group-hover:text-indigo-400",
  },
  sky: {
    card: "bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 ring-1 ring-sky-200/60 dark:ring-sky-800/40 group-hover:ring-sky-400/80",
    icon: "bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg",
    accent: "group-hover:text-sky-700 dark:group-hover:text-sky-400",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 group-hover:ring-emerald-400/80",
    icon: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg",
    accent: "group-hover:text-emerald-700 dark:group-hover:text-emerald-400",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 ring-1 ring-violet-200/60 dark:ring-violet-800/40 group-hover:ring-violet-400/80",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg",
    accent: "group-hover:text-violet-700 dark:group-hover:text-violet-400",
  },
};

export default function StartPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10 sm:mb-14">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Hangi hesabı yapmak istiyorsunuz?
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600 dark:text-gray-400">
            Hesap türünü seçerek hesaplamaya başlayın
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {cards.map(({ title, to, icon: Icon, color }) => {
            const style = cardStyles[color] || cardStyles.indigo;
            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-lg hover:shadow-xl ${style.card}`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${style.icon}`}>
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white text-center">{title}</h2>
                <span className={`mt-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors ${style.accent}`}>
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
