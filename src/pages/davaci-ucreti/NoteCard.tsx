export default function NoteCard() {
  return (
    <div className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notlar</h3>
        </div>
      </div>
      <div className="p-4 text-[11px] font-light leading-relaxed space-y-4 notes-content">
        <div>
          <div className="font-semibold mb-2 text-slate-800 dark:text-slate-200">NOT: Çıplak Brüt Ücret işçinin işi yapmak için aldığı eklentisiz maaşından ibarettir.</div>
          <p className="text-slate-500 dark:text-slate-400">
            Prim, İkramiye gibi ücretlerin hesaplamasında son 12 aylık bordroda yer alan tüm kalemler toplanır.
            Toplam 360'a bölünür, 30 ile çarpılır, çıkan bedeli hesaplama kutucuğuna yazınız.
          </p>
        </div>
      </div>
    </div>
  );
}
