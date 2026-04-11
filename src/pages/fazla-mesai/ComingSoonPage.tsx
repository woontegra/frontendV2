import { Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  description?: string;
}

export default function FazlaMesaiComingSoon({ title, description }: Props) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-lg mx-auto">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
            <Clock className="w-12 h-12 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            ÇOK YAKINDA
          </h1>
          <div className="h-1 w-24 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full" />
        </div>

        <div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</p>
          {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Bu sayfa üzerinde yoğun çalışmalarımız devam ediyor. En kısa sürede hizmetinize sunulacaktır.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full border border-blue-200 dark:border-blue-700">
          <div className="flex gap-1">
            {[0, 0.1, 0.2].map((d, i) => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ animationDelay: `${d}s`, background: ["#3b82f6", "#a855f7", "#ec4899"][i] }} />
            ))}
          </div>
          <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Geliştirme Aşamasında
          </span>
        </div>

        <div>
          <Link to="/fazla-mesai" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Fazla Mesai Seçimine Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
