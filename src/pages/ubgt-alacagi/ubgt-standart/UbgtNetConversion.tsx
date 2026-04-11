import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/utils/apiClient";
import UBGTMahsuplasamaModal, { type UbgtMahsuplasamaTableRow } from "./UBGTMahsuplasamaModal";
import {
  calcInputCls,
  calcLabelCls,
  calcSectionBoxCls,
  calcSectionTitleCls,
  calcHelperTextCls,
} from "@/shared/calcPageFormStyles";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface DateRange {
  id: string;
  start: string;
  end: string;
}

export interface UbgtNetConversionProps {
  ubgtBrutTotal: number;
  tableData?: UbgtMahsuplasamaTableRow[];
  dateRanges?: DateRange[];
  initialMahsuplasamaData?: { [year: number]: { [holidayName: string]: number } };
  onSummaryChange?: (summary: {
    brut: number;
    ssk: number;
    gelir: number;
    damga: number;
    net: number;
    hakkaniyet: number;
    settleAmount: string;
  }) => void;
  onMahsuplasamaDataChange?: (data: { [year: number]: { [holidayName: string]: number } }) => void;
}

export default function UbgtNetConversion({
  ubgtBrutTotal,
  tableData = [],
  dateRanges = [],
  initialMahsuplasamaData,
  onSummaryChange,
  onMahsuplasamaDataChange,
}: UbgtNetConversionProps) {
  const [ubgtBrut, setUbgtBrut] = useState(0);
  const [brutInputValue, setBrutInputValue] = useState("");
  const [ubgtSettleAmount, setUbgtSettleAmount] = useState("");
  const [showMahsuplasamaModal, setShowMahsuplasamaModal] = useState(false);
  const [mahsuplasamaData, setMahsuplasamaData] = useState<{ [year: number]: { [holidayName: string]: number } }>(
    () => initialMahsuplasamaData || {}
  );

  useEffect(() => {
    if (initialMahsuplasamaData && Object.keys(initialMahsuplasamaData).length > 0) {
      setMahsuplasamaData(initialMahsuplasamaData);
      let total = 0;
      for (const yearStr of Object.keys(initialMahsuplasamaData)) {
        const year = parseInt(yearStr, 10);
        const row = initialMahsuplasamaData[year];
        if (!row) continue;
        for (const holidayName of Object.keys(row)) {
          total += row[holidayName] || 0;
        }
      }
      setUbgtSettleAmount(total.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [initialMahsuplasamaData]);

  useEffect(() => {
    const roundedTotal = round2(ubgtBrutTotal);
    setUbgtBrut(roundedTotal);
    setBrutInputValue(
      roundedTotal > 0 ? roundedTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺" : ""
    );
  }, [ubgtBrutTotal]);

  const handleBrutInputChange = (value: string) => {
    setBrutInputValue(value);
    let cleanValue = value.replace(/₺/g, "").replace(/\s/g, "").trim();
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
    const numValue = Number(cleanValue) || 0;
    setUbgtBrut(numValue);
  };

  const handleBrutKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const selectedYear = useMemo(() => {
    if (dateRanges.length > 0) {
      const exitDates = dateRanges
        .map((r) => r.end)
        .filter((d) => d && d.trim() !== "")
        .map((d) => new Date(d))
        .filter((d) => !isNaN(d.getTime()));
      if (exitDates.length > 0) {
        const latestExit = exitDates.reduce((latest, current) => (current > latest ? current : latest));
        const year = latestExit.getFullYear();
        if (year >= 2010 && year <= 2100) return year;
      }
    }
    return new Date().getFullYear();
  }, [dateRanges]);

  const [ubgtBrutYillik, setUbgtBrutYillik] = useState(0);
  const [ubgtSgkPrim, setUbgtSgkPrim] = useState(0);
  const [ubgtIssizlikPrim, setUbgtIssizlikPrim] = useState(0);
  const [ubgtGelirVergisi, setUbgtGelirVergisi] = useState(0);
  const [gelirVergisiDilimleri, setGelirVergisiDilimleri] = useState("");
  const [ubgtDamgaVergisi, setUbgtDamgaVergisi] = useState(0);
  const [ubgtNetYillik, setUbgtNetYillik] = useState(0);
  const [ubgtSskPrimCombined, setUbgtSskPrimCombined] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (ubgtBrut <= 0) {
        setUbgtBrutYillik(0);
        setUbgtSgkPrim(0);
        setUbgtIssizlikPrim(0);
        setUbgtGelirVergisi(0);
        setUbgtDamgaVergisi(0);
        setUbgtNetYillik(0);
        setUbgtSskPrimCombined(0);
        setGelirVergisiDilimleri("");
        return;
      }
      try {
        const response = await apiPost("/api/ubgt/calculate-net", {
          brutAmount: ubgtBrut,
          year: selectedYear,
        });
        if (cancelled) return;
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
          const { ssk, issizlik, gelirVergisi, gelirVergisiDilimleri: dilim, damgaVergisi, netAmount } = result.data;
          setUbgtBrutYillik(ubgtBrut);
          setUbgtSgkPrim(ssk || 0);
          setUbgtIssizlikPrim(issizlik || 0);
          setUbgtGelirVergisi(gelirVergisi || 0);
          setGelirVergisiDilimleri(dilim || "");
          setUbgtDamgaVergisi(damgaVergisi || 0);
          setUbgtNetYillik(netAmount || 0);
          setUbgtSskPrimCombined((ssk || 0) + (issizlik || 0));
        }
      } catch (e) {
        console.error("[UbgtNetConversion]", e);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [ubgtBrut, selectedYear]);

  const ubgtHakkaniyetIndirimi = useMemo(() => ubgtBrutYillik / 3, [ubgtBrutYillik]);

  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      brut: ubgtBrutYillik,
      ssk: ubgtSskPrimCombined,
      gelir: ubgtGelirVergisi,
      damga: ubgtDamgaVergisi,
      net: ubgtNetYillik,
      hakkaniyet: ubgtHakkaniyetIndirimi,
      settleAmount: ubgtSettleAmount,
    });
  }, [
    onSummaryChange,
    ubgtBrutYillik,
    ubgtSskPrimCombined,
    ubgtGelirVergisi,
    ubgtDamgaVergisi,
    ubgtNetYillik,
    ubgtHakkaniyetIndirimi,
    ubgtSettleAmount,
  ]);

  const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full min-w-0">
      <section className={`${calcSectionBoxCls} lg:col-span-2`}>
        <h3 className={calcSectionTitleCls}>Brütten nete çevir</h3>
        <p className={calcHelperTextCls}>Tablodaki brüt UBGT toplamının nete çevrimi (işten çıkış yılına göre vergi).</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className={calcLabelCls}>Brüt UBGT ücreti</label>
            <input
              type="text"
              placeholder="Örn: 25000"
              value={brutInputValue}
              onChange={(e) => handleBrutInputChange(e.target.value)}
              onKeyDown={handleBrutKeyDown}
              className={calcInputCls}
            />
          </div>
          <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/80">
              <span className="text-gray-600 dark:text-gray-400">Brüt UBGT ücreti</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(ubgtBrutYillik)}₺</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/80">
              <span className="text-gray-600 dark:text-gray-400">SGK primi (%14)</span>
              <span className="font-medium text-red-600 dark:text-red-400">-{fmt(ubgtSgkPrim)}₺</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/80">
              <span className="text-gray-600 dark:text-gray-400">İşsizlik primi (%1)</span>
              <span className="font-medium text-red-600 dark:text-red-400">-{fmt(ubgtIssizlikPrim)}₺</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/80">
              <span className="text-gray-600 dark:text-gray-400">Gelir vergisi {gelirVergisiDilimleri}</span>
              <span className="font-medium text-red-600 dark:text-red-400">-{fmt(ubgtGelirVergisi)}₺</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/80">
              <span className="text-gray-600 dark:text-gray-400">Damga vergisi (binde 7,59)</span>
              <span className="font-medium text-red-600 dark:text-red-400">-{fmt(ubgtDamgaVergisi)}₺</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Net UBGT ücreti</span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{fmt(ubgtNetYillik)}₺</span>
            </div>
          </div>
        </div>
      </section>

      <section className={calcSectionBoxCls}>
        <h3 className={calcSectionTitleCls}>Hakkaniyet ve mahsuplaşma</h3>
        <div className="mt-3 space-y-4">
          <div>
            <label className={calcLabelCls}>1/3 hakkaniyet indirimi (brüt üzerinden)</label>
            <input
              type="text"
              readOnly
              value={`${fmt(ubgtHakkaniyetIndirimi)}₺`}
              className={`${calcInputCls} bg-gray-100 dark:bg-gray-800/80 cursor-not-allowed`}
            />
            <p className={calcHelperTextCls}>
              Brüt {fmt(ubgtBrutYillik)}₺ − 1/3 ={" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {fmt(ubgtBrutYillik - ubgtHakkaniyetIndirimi)}₺
              </span>
            </p>
          </div>
          <div>
            <label className={calcLabelCls}>Mahsuplaşma miktarı</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={
                  ubgtSettleAmount
                    ? (() => {
                        const numValue =
                          parseFloat(ubgtSettleAmount.replace(/\./g, "").replace(/,/g, ".").replace(/₺/g, "")) || 0;
                        return numValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "₺";
                      })()
                    : ""
                }
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/₺/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
                  const numValue = parseFloat(cleaned) || 0;
                  setUbgtSettleAmount(
                    numValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  );
                }}
                placeholder="0,00₺"
                className={`${calcInputCls} flex-1 min-w-[8rem]`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 shrink-0"
                onClick={() => setShowMahsuplasamaModal(true)}
              >
                Mahsuplaşma ekle
              </Button>
            </div>
          </div>
        </div>
      </section>

      <UBGTMahsuplasamaModal
        open={showMahsuplasamaModal}
        onOpenChange={setShowMahsuplasamaModal}
        tableData={tableData}
        initialData={mahsuplasamaData}
        onSave={(total, data) => {
          setUbgtSettleAmount(total.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setMahsuplasamaData(data);
          onMahsuplasamaDataChange?.(data);
        }}
      />
    </div>
  );
}
