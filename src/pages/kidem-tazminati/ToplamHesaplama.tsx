/**
 * Kıdem Tazminatı - toplam hesaplama kartı
 */

type Props = {
  toplam: number;
  yil: number;
  ay: number;
  gun: number;
  warnings?: string[];
  customFormatter?: (n: number) => string;
};

const fmtDefault = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ToplamHesaplama({
  toplam,
  yil,
  ay,
  gun,
  warnings = [],
  customFormatter,
}: Props) {
  const hesap1 = toplam * (yil || 0);
  const hesap2 = (toplam / 12) * (ay || 0);
  const hesap3 = (toplam / 365) * (gun || 0);
  const sonuc = hesap1 + hesap2 + hesap3;
  const formatValue = customFormatter || fmtDefault;
  const formatForDisplay = (n: number) => `${fmtDefault(n)}₺`;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border border-indigo-100 dark:border-gray-600 shadow-sm max-w-full">
      <div className="p-4 pb-2">
        <h3 className="text-sm md:text-base font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Kıdem Tazminatı Hesaplaması
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Detaylı hesaplama sonuçları</p>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between py-1.5 border-b border-indigo-100 dark:border-gray-600">
            <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{formatValue(toplam)} × {yil} yıl</span>
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">{formatForDisplay(hesap1)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-indigo-100 dark:border-gray-600">
            <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{formatValue(toplam)} / 12 × {ay} ay</span>
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">{formatForDisplay(hesap2)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-indigo-100 dark:border-gray-600">
            <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{formatValue(toplam)} / 365 × {gun} gün</span>
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">{formatForDisplay(hesap3)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">Toplam Kıdem Tazminatı</span>
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{formatForDisplay(sonuc)}</span>
          </div>
        </div>
        {warnings?.length > 0 && (
          <div className="mt-3 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
            {warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
