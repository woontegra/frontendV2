/**
 * Borçlar Kanunu kıdem bilgilendirme metni — v1 NoteCard ile aynı içerik.
 */
export default function KidemBorclarNoteCard() {
  return (
    <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
        </div>
      </div>
      <div className="p-4 text-[11px] font-light leading-relaxed space-y-4 notes-content">
        <div>
          <div className="font-semibold mb-3 text-slate-800 dark:text-slate-200">
            6098 s. Türk Borçlar Kanuna Tâbi Çalışan İşçilerde Kıdem Tazminatı Alacağı Hesaplanamaz.
          </div>
          <p className="text-slate-500 dark:text-slate-400 mb-3">
            Koşulları Oluşur İse Haksız Fesih Tazminatı Alacağı Talep Edilebilir; Borçlar Kanununda Kıdem Tazminatı adı altında herhangi bir tazminata yer verilmemiştir.
            Ancak BK. Madde; 434., 437. ve 438&apos;inci maddelerinde, işçi veya işveren tarafından yapılan iş akdinin fesih durumuna göre &quot;işçinin işten çıkma veya çıkarılma sebeplerine göre&quot; fesih tazminat şekillerine yer verilmiştir.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">III. Feshe karşı koruma</div>
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">MADDE 434</div>
              <p className="text-slate-500 dark:text-slate-400">
                Hizmet sözleşmesinin fesih hakkının kötüye kullanılarak sona erdirildiği durumlarda işveren, işçiye fesih bildirim süresine ait ücretin üç katı tutarında tazminat ödemekle yükümlüdür.
              </p>
            </div>

            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">a. Haklı sebeple fesihte</div>
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">MADDE 437</div>
              <p className="text-slate-500 dark:text-slate-400">
                Haklı fesih sebepleri, taraflardan birinin sözleşmeye uymamasından doğmuşsa o taraf, sebep olduğu zararı, hizmet ilişkisine dayanan bütün haklar göz önünde tutularak, tamamen gidermekle yükümlüdür.
                Diğer durumlarda hâkim, bütün durum ve koşulları göz önünde tutarak haklı sebeple feshin maddi sonuçlarını serbestçe değerlendirir.
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Borçlar Kanunu&apos;na tabi olarak belirsiz süreli sözleşmesi ile çalışan, iş akdi haksız fesih edilen işçi BK. 438. m. gereğince bildirim sürelerine ilişkin bir tazminatı ve hâkimin takdirine bağlı olarak altı aylık ücretinden fazla olamayacak şekilde tazminat talep edebilir.
                BK. 438./3 f. en fazla altı aylık ücret tutarındaki tazminat, doktrinde haksız fesih tazminatı olarak sınıflandırılmaktadır.
              </p>
            </div>

            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">b. Haklı sebebe dayanmayan fesihte</div>
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">MADDE 438</div>
              <p className="text-slate-500 dark:text-slate-400">
                İşveren, haklı sebep olmaksızın hizmet sözleşmesini derhâl feshederse işçi, belirsiz süreli sözleşmelerde, fesih bildirim süresine; belirli süreli sözleşmelerde ise, sözleşme süresine uyulmaması durumunda, bu sürelere uyulmuş olsaydı kazanabileceği miktarı, tazminat olarak isteyebilir.
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Belirli süreli hizmet sözleşmesinde işçinin hizmet sözleşmesinin sona ermesi yüzünden tasarruf ettiği miktar ile başka bir işten elde ettiği veya bilerek elde etmekten kaçındığı gelir, tazminattan indirilir.
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Hâkim, bütün durum ve koşulları göz önünde tutarak, ayrıca miktarını serbestçe belirleyeceği bir tazminatın işçiye ödenmesine karar verebilir; ancak belirlenecek tazminat miktarı, işçinin altı aylık ücretinden fazla olamaz.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
