import { Link } from "react-router-dom";
import { Calculator, Gavel } from "lucide-react";

const cards = [
  {
    title: "Standart UBGT",
    to: "/ubgt-alacagi",
    icon: Calculator,
    color: "indigo" as const,
    desc: "Ulusal bayram ve genel tatil alacağı",
  },
  {
    title: "Bilirkişi UBGT",
    to: "/ubgt-bilirkisi",
    icon: Gavel,
    color: "violet" as const,
    desc: "Bilirkişi raporuna göre hesaplama",
  },
];

const cardStyles: Record<
  (typeof cards)[number]["color"],
  { card: string; icon: string; accent: string }
> = {
  indigo: {
    card: "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 ring-1 ring-indigo-200/60 dark:ring-indigo-800/40 group-hover:ring-indigo-400/80 dark:group-hover:ring-indigo-600/60",
    icon: "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg",
    accent: "group-hover:text-indigo-700 dark:group-hover:text-indigo-400",
  },
  violet: {
    card: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 ring-1 ring-violet-200/60 dark:ring-violet-800/40 group-hover:ring-violet-400/80 dark:group-hover:ring-violet-600/60",
    icon: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg",
    accent: "group-hover:text-violet-700 dark:group-hover:text-violet-400",
  },
};

export default function UbgtSelectionPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">UBGT alacağı</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Hesaplama türünü seçin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {cards.map(({ title, to, icon: Icon, color, desc }) => {
            const style = cardStyles[color];
            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-col items-center text-center gap-2 p-5 rounded-2xl transition-shadow duration-200 shadow-lg hover:shadow-xl ${style.card}`}
              >
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${style.icon}`}>
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[14rem]">{desc}</p>
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
