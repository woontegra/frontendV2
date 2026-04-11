/**
 * v2’de henüz taşınmamış kıdem alt türleri için kısa bilgilendirme.
 */
import { Construction } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageStyle } from "@/hooks/usePageStyle";

type Props = {
  title: string;
  description?: string;
};

export default function KidemSubpagePlaceholderPage({ title, description }: Props) {
  const pageStyle = usePageStyle();

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#1E88E5" }} />
      <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6 text-center">
            <Construction className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {description ?? "Bu hesaplama türü v2 arayüzüne taşınıyor. Şimdilik v1’deki sürüm kullanılabilir."}
            </p>
            <Link
              to="/kidem-tazminati"
              className="inline-block mt-6 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Kıdem türlerine dön
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
