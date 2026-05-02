import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/utils/apiClient";
import { calcWorkPeriodBilirKisi } from "@/utils/dateUtils";
import { Button } from "@/components/ui/button";
import { getAsgariUcretByDate } from "@/pages/davaci-ucreti/utils";
import { usePageStyle } from "@/hooks/usePageStyle";
import { useToast } from "@/context/ToastContext";
import {
  getAllExclusionSets,
  saveExclusionSet,
  deleteExclusionSet,
  type ExcludedDay,
  type SavedExclusionSet,
} from "@/shared/utils/exclusionStorage";

type UsedRow = { id: string; start: string; end: string; days: string };

const createEmptyRow = (): UsedRow => ({
  id: Math.random().toString(36).slice(2),
  start: "",
  end: "",
  days: "",
});

const createInitialRows = (count = 7): UsedRow[] =>
  Array.from({ length: count }, () => createEmptyRow());

const toDays = (value: string) =>
  Number(String(value ?? "").replace(/\./g, "").replace(",", ".")) || 0;

function exclusionRowsToUsedRows(data: ExcludedDay[]): UsedRow[] {
  if (!data.length) return createInitialRows(7);
  return data.map((row) => ({
    id: row.id || Math.random().toString(36).slice(2),
    start: row.start || "",
    end: row.end || "",
    days: row.days != null ? String(row.days) : "",
  }));
}

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n || 0
  );

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded-xl h-11 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "text-sm font-semibold text-gray-700 dark:text-gray-300";
const tableDateCls =
  "w-full rounded-xl h-10 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-indigo-500";

const BASIN_KANUNU_NOTLARI: Array<{ icon: string; text: string }> = [
  {
    icon: "📰",
    text: 'Basın Mesleğinde Çalışanlarla Çalıştıranlar Arasındaki Münasebetlerin Tanzimi Hakkında Kanun (Basın İş Kanunu) nun "Yıllık ücretli izin" başlıklı 21. Maddesi "(Değişik: 4/1/1961 - 212/1 md.)',
  },
  {
    icon: "⏱️",
    text: "Günlük bir mevkutede çalışan bir gazeteciye, en az bir yıl çalışmış olmak şartiyle, yılda dört hafta tam ücretli izin verilir. Gazetecilik mesleğindeki hizmeti on yıldan yukarı olan bir gazeteciye, altı hafta ücretli izin verilir. Gazetecinin kıdemi aynı gazetedeki hizmetine göre değil, meslekteki hizmet süresine göre hesaplanır.",
  },
  {
    icon: "📅",
    text: 'Günlük olmayan mevkutelerde çalışan gazetecilere her altı aylık çalışma devresi için iki hafta ücretli izin verilir. Yıllık ücretli izinlerin hesabında bu Kanunun 1 inci maddesindeki "Gazeteci" tabirine girenlerin kıdemleri, iş akdinin devam etmiş veya fasılalarla yeniden inikat etmiş olmasına bakılmaksızın, gazetecilik mesleğinde geçirdikleri hizmet süresi nazara alınmak suretiyle tesbit edilir.',
  },
  {
    icon: "✅",
    text: 'İzin hakkından feragat edilemez." Şeklinde düzenlenmiştir.',
  },
];

export default function YillikIzinBasinGunlukOlmayanPage() {
  const navigate = useNavigate();
  const pageStyle = usePageStyle("yillik-izin");
  const { success, error: showToastError } = useToast();
  const [meslegeBaslangic, setMeslegeBaslangic] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brutUcret, setBrutUcret] = useState("");
  const [rows, setRows] = useState<UsedRow[]>(() => createInitialRows(7));
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [employerPayment, setEmployerPayment] = useState("");
  const [showExclusionSaveModal, setShowExclusionSaveModal] = useState(false);
  const [showExclusionLoadModal, setShowExclusionLoadModal] = useState(false);
  const [exclusionSaveName, setExclusionSaveName] = useState("");
  const [savedExclusionSets, setSavedExclusionSets] = useState<SavedExclusionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

  const [izinHesaplama, setIzinHesaplama] = useState({
    izinGun: 0,
    devre: 0,
    toplamAy: 0,
    hafta: 0,
  });
  const [usedTotal, setUsedTotal] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [brutIzin, setBrutIzin] = useState(0);
  const [sgk, setSgk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelirVergisi, setGelirVergisi] = useState(0);
  const [damgaVergisi, setDamgaVergisi] = useState(0);
  const [netIzin, setNetIzin] = useState(0);

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const setRow = (rowId: string, patch: Partial<UsedRow>) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  const removeRow = (rowId: string) => setRows((prev) => prev.filter((r) => r.id !== rowId));
  const usedTotalFromRows = useMemo(() => rows.reduce((acc, row) => acc + toDays(row.days), 0), [rows]);
  const rowsToExcludedDays = (): ExcludedDay[] =>
    rows
      .filter((r) => r.start && r.end)
      .map((r) => ({
        id: r.id,
        type: "Kullanılan İzin",
        start: r.start,
        end: r.end,
        days: toDays(r.days),
      }));

  const openLoadModal = async () => {
    const sets = await getAllExclusionSets();
    const setsWithCalculatedDays = sets.map((set) => ({
      ...set,
      data: set.data.map((row) => {
        if (row.start && row.end && (!row.days || row.days === 0)) {
          const startDate = new Date(row.start);
          const endDate = new Date(row.end);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return { ...row, days: diffDays };
          }
        }
        return row;
      }),
    }));
    setSavedExclusionSets(setsWithCalculatedDays);
    setShowExclusionLoadModal(true);
  };

  const clampYearInput = (value: string) => {
    if (!value) return value;
    const parts = value.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].substring(0, 4);
      return parts.join("-");
    }
    return value;
  };

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(meslegeBaslangic, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [meslegeBaslangic, istenCikis]);

  const selectedYear = useMemo(() => {
    if (istenCikis) {
      const year = new Date(istenCikis).getFullYear();
      if (!isNaN(year) && year >= 2010 && year <= 2030) return year;
    }
    return new Date().getFullYear();
  }, [istenCikis]);

  const asgariUcretHatasi = useMemo(() => {
    if (!istenCikis || !brutUcret) return null;
    const girilenUcret = parseFloat(String(brutUcret).replace(/\./g, "").replace(",", "."));
    if (isNaN(girilenUcret) || girilenUcret <= 0) return null;
    const asgariUcret = getAsgariUcretByDate(istenCikis);
    if (!asgariUcret) return null;
    if (girilenUcret < asgariUcret) {
      const yil = new Date(istenCikis).getFullYear();
      return `Girilen ücret, ${yil} yılı asgari brüt ücretinden düşük olamaz (${asgariUcret.toLocaleString(
        "tr-TR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}₺).`;
    }
    return null;
  }, [istenCikis, brutUcret]);

  useEffect(() => {
    document.title = "Bilirkişi Hesap | Basın Yıllık Ücretli İzin (Günlük Olmayan)";
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!meslegeBaslangic || !istenCikis || toDays(brutUcret) <= 0) {
        setCalcError("");
        setIzinHesaplama({ izinGun: 0, devre: 0, toplamAy: 0, hafta: 0 });
        setUsedTotal(0);
        setRemainingDays(0);
        setBrutIzin(0);
        setSgk(0);
        setIssizlik(0);
        setGelirVergisi(0);
        setDamgaVergisi(0);
        setNetIzin(0);
        return;
      }

      setLoading(true);
      setCalcError("");
      try {
        const usedDays = rows.reduce((acc, row) => acc + toDays(row.days), 0);
        const response = await apiClient("/api/yillik-izin-basin-gunluk-olmayan/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meslegeBaslangic,
            istenCikis,
            brutUcret: toDays(brutUcret),
            usedDays,
            year: selectedYear,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success || !result?.data) {
          setCalcError(result?.error || `Hesaplama başarısız (HTTP ${response.status})`);
          return;
        }
        setIzinHesaplama({
          izinGun: result.data.izinGun || 0,
          devre: result.data.devre || 0,
          toplamAy: result.data.toplamAy || 0,
          hafta: result.data.hafta || 0,
        });
        setUsedTotal(result.data.usedDays || 0);
        setRemainingDays(result.data.remainingDays || 0);
        setBrutIzin(result.data.brutIzin || 0);
        setSgk(result.data.sgk || 0);
        setIssizlik(result.data.issizlik || 0);
        setGelirVergisi(result.data.gelirVergisi || 0);
        setDamgaVergisi(result.data.damgaVergisi || 0);
        setNetIzin(result.data.netIzin || 0);
      } catch (e) {
        setCalcError(e instanceof Error ? e.message : "Hesaplama hatası");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [meslegeBaslangic, istenCikis, brutUcret, rows, selectedYear]);

  const accent = pageStyle.color || "#5E35B1";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 pb-24 lg:pb-8">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden">
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
          <div className="p-4 sm:p-6 space-y-5">
            <div>
              <label className={labelCls}>Gazeteci türü</label>
              <select
                className={`${inputCls} mt-1`}
                value="gunlukOlmayan"
                onChange={(e) => {
                  if (e.target.value === "gunluk") navigate("/yillik-izin/basin");
                }}
              >
                <option value="gunluk">Günlük gazete</option>
                <option value="gunlukOlmayan">Günlük olmayan gazete</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Mesleğe başlangıç tarihi</label>
                <input
                  className={`${inputCls} mt-1`}
                  type="date"
                  max="9999-12-31"
                  value={meslegeBaslangic}
                  onChange={(e) => setMeslegeBaslangic(clampYearInput(e.target.value))}
                />
              </div>
              <div>
                <label className={labelCls}>İşten çıkış tarihi</label>
                <input
                  className={`${inputCls} mt-1`}
                  type="date"
                  max="9999-12-31"
                  value={istenCikis}
                  onChange={(e) => setIstenCikis(clampYearInput(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Çalışma süresi</label>
                <input readOnly value={diff.label} className={`${inputCls} mt-1 bg-gray-100 dark:bg-gray-900/50`} />
              </div>
              <div>
                <label className={labelCls}>Çıplak brüt ücret</label>
                <input
                  value={brutUcret}
                  onChange={(e) => setBrutUcret(e.target.value)}
                  placeholder="Örn: 25.000,00"
                  className={`${inputCls} mt-1 ${
                    asgariUcretHatasi ? "border-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/20" : ""
                  }`}
                />
                {asgariUcretHatasi && <p className="text-red-600 text-xs mt-1">{asgariUcretHatasi}</p>}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/20">
              <div className={labelCls + " mb-2"}>Yıllık izin hakkı (günlük olmayan)</div>
              <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                <div>Toplam ay: {izinHesaplama.toplamAy}</div>
                <div>6 aylık devre: {izinHesaplama.devre}</div>
                <div className="font-semibold pt-2 border-t border-gray-200 dark:border-gray-600">
                  İzin hakkı: {izinHesaplama.hafta} hafta ({izinHesaplama.izinGun} gün)
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-900/30">
                <button
                  type="button"
                  onClick={() => setAccordionOpen((s) => !s)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
                >
                  Kullanılan izinleri dışla
                  <span className={`inline-block transition ${accordionOpen ? "rotate-180" : ""}`}>▼</span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExclusionSaveName("");
                      setShowExclusionSaveModal(true);
                    }}
                    disabled={rows.every((r) => !r.start || !r.end)}
                  >
                    Kaydet
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={openLoadModal}>
                    İçe aktar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRows(createInitialRows(7))}
                    disabled={rows.every((r) => !r.start && !r.end && !r.days)}
                    className="text-red-600 border-red-200 dark:border-red-900"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1 inline" />
                    Tümünü sil
                  </Button>
                </div>
              </div>
              {accordionOpen && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-700 dark:text-gray-300">
                          <th className="py-2 pr-2 font-semibold">İzin başlangıç</th>
                          <th className="py-2 pr-2 font-semibold">İzin bitiş</th>
                          <th className="py-2 pr-2 font-semibold">Gün</th>
                          <th className="py-2 pr-2 font-semibold" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={r.start}
                                onChange={(e) => setRow(r.id, { start: clampYearInput(e.target.value) })}
                                className={tableDateCls}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={r.end}
                                onChange={(e) => setRow(r.id, { end: clampYearInput(e.target.value) })}
                                className={tableDateCls}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                value={r.days}
                                onChange={(e) => setRow(r.id, { days: e.target.value })}
                                placeholder="Örn: 5"
                                className={tableDateCls}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRow(r.id)}
                                disabled={rows.length <= 1}
                                className="text-red-600 h-9 w-9"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                            Toplam
                          </td>
                          <td className="py-2 font-semibold">{usedTotalFromRows} gün</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Satır ekle
                  </button>
                  <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    Kalan izin hakkı: {remainingDays} gün
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/25 dark:to-indigo-950/20 border-l-4 border-purple-500">
              <h3 className="text-base font-bold text-purple-900 dark:text-purple-300 mb-3">Yıllık ücretli izin hesaplama</h3>
              {loading && <p className="text-sm text-gray-500 mb-2">Hesaplanıyor...</p>}
              {calcError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{calcError}</p>}
              <div className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                <div className="flex justify-between gap-2 border-b border-purple-200/50 dark:border-purple-900/40 pb-2">
                  <span>Kalan izin süresi</span>
                  <span className="font-semibold">{remainingDays} gün</span>
                </div>
                <div className="flex justify-between gap-2 border-b border-purple-200/50 dark:border-purple-900/40 pb-2">
                  <span>Günlük ücret (toplam/30)</span>
                  <span className="font-medium text-right">
                    ({fmt(toDays(brutUcret))}₺ / 30 × {remainingDays} gün)
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="font-semibold">Yıllık ücretli izin alacağı</span>
                  <span className="font-bold text-lg text-purple-700 dark:text-purple-400">{fmt(brutIzin)}₺</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-l-4 border-amber-500">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-300 mb-3">Brütten nete çevir</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Brüt yıllık izin ücreti", brutIzin, false],
                  ["SGK primi (%14)", -sgk, true],
                  ["İşsizlik primi (%1)", -issizlik, true],
                  ["Gelir vergisi", -gelirVergisi, true],
                  ["Damga vergisi (binde 7,59)", -damgaVergisi, true],
                ].map(([label, val, neg]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between gap-2 border-b border-amber-200/50 dark:border-amber-900/40 pb-2"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{label}</span>
                    <span
                      className={
                        neg ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-gray-900 dark:text-white"
                      }
                    >
                      {neg ? "-" : ""}
                      {fmt(Math.abs(Number(val)))}₺
                    </span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 pt-2">
                  <span className="font-semibold text-gray-900 dark:text-white">Net yıllık izin ücreti</span>
                  <span className="font-bold text-green-700 dark:text-green-400">{fmt(netIzin)}₺</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-amber-200/60 dark:border-amber-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Davalı tarafından iş akdinin sonlanması ile yıllık ücretli izin bedeli adı altında yapılan ödeme
                  </span>
                  <input
                    value={employerPayment}
                    onChange={(e) => setEmployerPayment(e.target.value)}
                    placeholder="Örn: 10.000"
                    className="w-full sm:w-40 rounded-xl h-10 border border-gray-200 dark:border-gray-600 px-3 text-sm font-semibold text-right bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-900/50 bg-blue-100/50 dark:bg-blue-900/20">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-600 dark:text-blue-400">ⓘ</span>
                  Notlar
                </h3>
              </div>
              <div className="p-4">
                <div className="font-semibold text-[13px] text-gray-900 dark:text-gray-100 mb-2.5">Not: Basın İş Kanunu – Yıllık İzin 21. Madde</div>
                <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {BASIN_KANUNU_NOTLARI.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0">{item.icon}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExclusionSaveModal &&
        createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Kullanılan izinleri kaydet</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Liste adı</label>
            <input
              type="text"
              value={exclusionSaveName}
              onChange={(e) => setExclusionSaveName(e.target.value)}
              placeholder="Örn: Davacı A - kullanılan izinler"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm dark:bg-slate-700 dark:text-white"
            />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowExclusionSaveModal(false)}>
                İptal
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!exclusionSaveName.trim()) {
                    showToastError("Lütfen bir isim girin.");
                    return;
                  }
                  const saved = await saveExclusionSet(exclusionSaveName.trim(), rowsToExcludedDays());
                  if (saved) {
                    success(`"${exclusionSaveName.trim()}" olarak kaydedildi.`);
                    setShowExclusionSaveModal(false);
                    setExclusionSaveName("");
                  } else {
                    showToastError("Kaydetme başarısız oldu.");
                  }
                }}
                disabled={!exclusionSaveName.trim()}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showExclusionLoadModal &&
        createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Kayıtlı kullanılan izinler</h3>
              <Button type="button" variant="outline" onClick={() => setShowExclusionLoadModal(false)}>
                Kapat
              </Button>
            </div>
            {savedExclusionSets.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">Henüz kayıtlı bir liste yok.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {savedExclusionSets.map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{set.data.length} kayıt</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRows(exclusionRowsToUsedRows(set.data));
                          success(`"${set.name}" yüklendi.`);
                          setShowExclusionLoadModal(false);
                        }}
                      >
                        Yükle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 dark:text-red-400 px-2"
                        onClick={async () => {
                          if (window.confirm(`"${set.name}" listesini silmek istediğinize emin misiniz?`)) {
                            const deleted = await deleteExclusionSet(set.id);
                            if (deleted) {
                              success("Liste silindi.");
                              setSavedExclusionSets(await getAllExclusionSets());
                            } else {
                              showToastError("Silme işlemi başarısız oldu.");
                            }
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
