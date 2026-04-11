/**
 * Borçlar Kanunu — Kıdem Tazminatı bilgilendirme (v1 ile aynı içerik, v2 kabuğu).
 */
import { Youtube } from "lucide-react";
import { getVideoLink } from "@/config/videoLinks";
import { usePageStyle } from "@/hooks/usePageStyle";
import KidemBorclarNoteCard from "./KidemBorclarNoteCard";

const KIDEM_GRADIENT = "linear-gradient(90deg, #1E88E5, #42A5F5)";

export default function KidemBorclarPage() {
  const pageStyle = usePageStyle();
  const videoLink = getVideoLink("kidem-borclar");

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#1E88E5" }} />
      <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-gray-900 pb-12">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {videoLink ? (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => window.open(videoLink, "_blank")}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Youtube className="w-4 h-4" />
                Kullanım Videosu İzle
              </button>
            </div>
          ) : null}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="h-1 w-full rounded-t-xl" style={{ background: KIDEM_GRADIENT }} />
            <div id="kidem-borclar-print" className="p-4 sm:p-6">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Borçlar Kanunu İşçi Alacağı
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Bu sayfada BK kapsamında kıdem tazminatı yerine geçen düzenlemelere ilişkin özet bilgi yer alır.
              </p>
              <KidemBorclarNoteCard />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
