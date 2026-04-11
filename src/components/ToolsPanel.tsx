import { useState } from "react";
import { X, ChevronLeft } from "lucide-react";

interface ToolsPanelProps {
  onAddNote?: () => void;
  onAddTag?: () => void;
  calculationId?: string;
}

/** Basın İş Günlük %5 Faiz Modal */
function PressDailyInterestModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [result, setResult] = useState<{
    amount: number;
    days: number;
    dailyInterest: number;
    totalInterest: number;
    total: number;
    startDate: string;
    endDate: string;
  } | null>(null);

  const calculateDaysBetween = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startD = new Date(start);
    const endD = new Date(end);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return 0;
    const diffTime = endD.getTime() - startD.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const days = calculateDaysBetween(startDate, endDate);

  const calculate = () => {
    const a = Number(amount.replace(/\./g, "").replace(",", ".")) || 0;
    if (!a || !days) return;

    const dailyInterest = a * 0.05;
    const totalInterest = dailyInterest * days;
    const total = a + totalInterest;

    setResult({
      amount: a,
      days,
      dailyInterest,
      totalInterest,
      total,
      startDate,
      endDate,
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("tr-TR");
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[480px] max-w-[95vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">₺</span>
            Basın İş - Günlük %5 Faiz Hesaplama
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Alacak Tutarı (TL)
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ör: 20.000,00"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Gecikme Başlangıcı
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Gecikme Sonu
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {days > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg text-center">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                📅 Gecikme süresi: <strong>{days} gün</strong>
              </span>
            </div>
          )}

          <button
            onClick={calculate}
            disabled={!amount || days <= 0}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            Hesapla
          </button>

          {result && (
            <div className="bg-gradient-to-br from-gray-50 to-orange-50 dark:from-gray-700 dark:to-gray-700 p-4 rounded-xl border border-orange-200 dark:border-orange-800 space-y-2">
              <p className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>📅 Gecikme dönemi:</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {formatDate(result.startDate)} - {formatDate(result.endDate)}
                </span>
              </p>
              <p className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>🧮 Günlük faiz (%5):</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(result.dailyInterest)} ₺
                </span>
              </p>
              <p className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>📌 Toplam faiz ({result.days} gün):</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(result.totalInterest)} ₺
                </span>
              </p>
              <hr className="border-orange-200 dark:border-orange-700" />
              <p className="flex justify-between text-base">
                <span className="font-semibold text-gray-700 dark:text-gray-200">💰 Genel toplam:</span>
                <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                  {formatCurrency(result.total)} ₺
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-2.5 rounded-xl transition-all"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ToolsPanel({ onAddNote, onAddTag }: ToolsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPressDailyInterestModal, setShowPressDailyInterestModal] = useState(false);

  return (
    <>
      <div
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {!isOpen && (
          <div className="bg-gradient-to-b from-violet-500 via-purple-500 to-orange-400 hover:from-violet-600 hover:via-purple-600 hover:to-orange-500 text-white rounded-l-xl shadow-lg px-2 py-5 transition-all hover:px-3 group">
            <div className="flex flex-col items-center gap-1">
              <ChevronLeft className="w-5 h-5 group-hover:animate-pulse" />
              <div className="w-1 h-1 bg-white rounded-full opacity-60" />
              <div className="w-1 h-1 bg-white rounded-full opacity-40" />
            </div>
          </div>
        )}
      </div>

      <div
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl rounded-l-2xl border border-r-0 border-gray-200/50 dark:border-gray-700/50 p-5 min-w-[220px]">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100 tracking-wide">
                Hızlı Araçlar
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all hover:rotate-90 duration-200"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {onAddNote && (
              <button
                onClick={() => {
                  onAddNote();
                  setIsOpen(false);
                }}
                className="group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:shadow-lg hover:shadow-orange-500/25 hover:-translate-y-0.5 text-white"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <div className="relative z-10 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-200">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col items-start">
                  <span className="font-semibold text-sm">Hesaplama Notu</span>
                  <span className="text-[10px] opacity-80">Açıklama ekleyin</span>
                </div>
              </button>
            )}

            {onAddTag && (
              <button
                onClick={() => {
                  onAddTag();
                  setIsOpen(false);
                }}
                className="group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 overflow-hidden bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 text-white"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <div className="relative z-10 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform duration-200">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col items-start">
                  <span className="font-semibold text-sm">Kategori Etiketi</span>
                  <span className="text-[10px] opacity-80">Sınıflandırın</span>
                </div>
              </button>
            )}

            <button
              onClick={() => {
                setShowPressDailyInterestModal(true);
                setIsOpen(false);
              }}
              className="group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5 text-white"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <div className="relative z-10 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="relative z-10 flex flex-col items-start">
                <span className="font-semibold text-sm">Faiz Hesaplayıcı</span>
                <span className="text-[10px] opacity-80">Basın İş %5 Günlük</span>
              </div>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
              Hesaplama araçlarınız
            </p>
          </div>
        </div>
      </div>

      {showPressDailyInterestModal && (
        <PressDailyInterestModal onClose={() => setShowPressDailyInterestModal(false)} />
      )}
    </>
  );
}
