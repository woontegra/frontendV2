import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FooterActions from "@/components/FooterActions";
import { useToast } from "@/context/ToastContext";
import { useKaydetContext } from "@/core/kaydet/KaydetProvider";
import { copySectionForWord } from "@/utils/copyTableForWord";
import { apiClient } from "@/utils/apiClient";
import { hasTwoPeriods } from "@/pages/davaci-ucreti/utils";
import { calculateIncomeTaxWithBrackets, computeNetFromGrossSingle } from "@/pages/ucret-alacagi/UcretIndependent/localUtils/incomeTaxCore";
import { calculateInterest, type DepositInterestRateInput, type InterestType } from "@/utils/interestCalculator";

type NetFromGrossResult = {
  gross: number;
  sgk: number;
  issizlik: number;
  gelirVergisi: number;
  gelirVergisiBrut: number;
  gelirVergisiIstisna: number;
  gelirVergisiDilimleri: string;
  damgaVergisi: number;
  damgaVergisiBrut: number;
  damgaVergisiIstisna: number;
  net: number;
};

const defaultNetFromGross: NetFromGrossResult = {
  gross: 0,
  sgk: 0,
  issizlik: 0,
  gelirVergisi: 0,
  gelirVergisiBrut: 0,
  gelirVergisiIstisna: 0,
  gelirVergisiDilimleri: "",
  damgaVergisi: 0,
  damgaVergisiBrut: 0,
  damgaVergisiIstisna: 0,
  net: 0,
};

const parseNum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fmtDateTR = (isoDate: string) => {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-");
  return y && m && d ? `${d}.${m}.${y}` : isoDate;
};
const RECORD_TYPE = "icra_takip_istisnali_full_kesintili";
const REDIRECT_PATH = "/icra-takip-brutten-nete/istisnali-full-kesintili";

export default function IstisnaliFullKesintiliPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveId = id || searchParams.get("caseId") || undefined;
  const { success, error: showToastError } = useToast();
  const { kaydetAc, isSaving } = useKaydetContext();
  const [grossForNet, setGrossForNet] = useState("");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 2>(2);
  const [faizBaslangicTarihi, setFaizBaslangicTarihi] = useState("");
  const [icraTakipTarihi, setIcraTakipTarihi] = useState("");
  const [faizTuru, setFaizTuru] = useState<"yasal" | "en_yuksek_mevduat">("yasal");
  const [depositInterestPeriods, setDepositInterestPeriods] = useState<DepositInterestRateInput[]>([]);
  const [depositInterestError, setDepositInterestError] = useState<string | null>(null);
  const [netFromGross, setNetFromGross] = useState<NetFromGrossResult>(defaultNetFromGross);

  const grossVal = useMemo(() => parseNum(grossForNet), [grossForNet]);
  const hasTwoPeriodsForYear = useMemo(() => hasTwoPeriods(selectedYear), [selectedYear]);

  useEffect(() => {
    if (grossVal <= 0) {
      setNetFromGross({ ...defaultNetFromGross });
      return;
    }

    const result = computeNetFromGrossSingle(grossVal, selectedYear, selectedPeriod);
    const matrah = result.totalGross - result.totalSgk - result.totalIssizlik;
    const bracketResult = calculateIncomeTaxWithBrackets(selectedYear, matrah);

    setNetFromGross({
      gross: result.totalGross,
      sgk: result.totalSgk,
      issizlik: result.totalIssizlik,
      gelirVergisi: result.totalGelirVergisi,
      gelirVergisiBrut: result.totalGelirVergisiBrut,
      gelirVergisiIstisna: result.totalGelirVergisiIstisna,
      gelirVergisiDilimleri: bracketResult.summary,
      damgaVergisi: result.totalDamgaVergisi,
      damgaVergisiBrut: result.totalDamgaVergisiBrut,
      damgaVergisiIstisna: result.totalDamgaVergisiIstisna,
      net: result.totalNet,
    });
  }, [grossVal, selectedYear, selectedPeriod]);

  const interestType: InterestType = faizTuru === "yasal" ? "LEGAL_INTEREST" : "HIGHEST_DEPOSIT_INTEREST";

  useEffect(() => {
    if (interestType !== "HIGHEST_DEPOSIT_INTEREST") {
      setDepositInterestPeriods([]);
      setDepositInterestError(null);
      return;
    }

    if (!faizBaslangicTarihi || !icraTakipTarihi || grossVal <= 0 || netFromGross.net <= 0) {
      setDepositInterestPeriods([]);
      setDepositInterestError(null);
      return;
    }

    let cancelled = false;
    apiClient(
      `/api/interest-rates/deposit?startDate=${encodeURIComponent(faizBaslangicTarihi)}&endDate=${encodeURIComponent(icraTakipTarihi)}`
    )
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setDepositInterestPeriods([]);
          setDepositInterestError(
            data?.message ||
              "Bankalarca mevduatlara uygulanan en yüksek faiz oranı verisi henüz sisteme tanımlanmamış. Lütfen faiz oranı verisi eklendikten sonra hesaplama yapınız."
          );
          return;
        }
        setDepositInterestPeriods(Array.isArray(data?.data?.periods) ? data.data.periods : []);
        setDepositInterestError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setDepositInterestPeriods([]);
        setDepositInterestError(
          "Bankalarca mevduatlara uygulanan en yüksek faiz oranı verisi henüz sisteme tanımlanmamış. Lütfen faiz oranı verisi eklendikten sonra hesaplama yapınız."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [interestType, faizBaslangicTarihi, icraTakipTarihi, grossVal, netFromGross.net]);

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await apiClient(`/api/saved-cases/${effectiveId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const raw = await response.json();
        if (cancelled) return;

        const payload =
          raw?.data && typeof raw.data === "object"
            ? raw.data
            : typeof raw?.data === "string"
              ? (() => {
                  try {
                    return JSON.parse(raw.data);
                  } catch {
                    return {};
                  }
                })()
              : {};

        const form = payload?.form && typeof payload.form === "object" ? payload.form : {};

        if (form.grossForNet != null) setGrossForNet(String(form.grossForNet));
        if (form.selectedYear != null) setSelectedYear(Number(form.selectedYear) || currentYear);
        if (form.selectedPeriod != null) {
          const period = Number(form.selectedPeriod);
          setSelectedPeriod(period === 1 ? 1 : 2);
        }
        if (form.faizBaslangicTarihi != null) setFaizBaslangicTarihi(String(form.faizBaslangicTarihi));
        if (form.icraTakipTarihi != null) setIcraTakipTarihi(String(form.icraTakipTarihi));
        if (form.faizTuru === "yasal" || form.faizTuru === "en_yuksek_mevduat") {
          setFaizTuru(form.faizTuru);
        }
      } catch {
        if (!cancelled) {
          showToastError("Kayıt yüklenemedi");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveId, currentYear, showToastError]);

  const interestResult = useMemo(() => {
    if (grossVal <= 0 || netFromGross.net <= 0) return null;
    if (!faizBaslangicTarihi || !icraTakipTarihi) return null;
    if (interestType === "HIGHEST_DEPOSIT_INTEREST" && depositInterestError) {
      return { ok: false as const, message: depositInterestError };
    }
    return calculateInterest({
      principal: netFromGross.net,
      startDate: faizBaslangicTarihi,
      endDate: icraTakipTarihi,
      interestType,
      depositInterestRates: interestType === "HIGHEST_DEPOSIT_INTEREST" ? depositInterestPeriods : undefined,
    });
  }, [
    grossVal,
    netFromGross.net,
    faizBaslangicTarihi,
    icraTakipTarihi,
    interestType,
    depositInterestPeriods,
    depositInterestError,
  ]);

  const isInterestSuccess = !!interestResult && interestResult.ok;
  const interestWarning = interestResult && !interestResult.ok ? interestResult.message : null;
  const totalInterest = isInterestSuccess ? interestResult.totalInterest : 0;
  const takipToplami = isInterestSuccess ? netFromGross.net + interestResult.totalInterest : netFromGross.net;

  const handleNew = () => {
    setGrossForNet("");
    setSelectedYear(currentYear);
    setSelectedPeriod(2);
    setFaizBaslangicTarihi("");
    setIcraTakipTarihi("");
    setFaizTuru("yasal");
    setDepositInterestPeriods([]);
    setDepositInterestError(null);
    setNetFromGross(defaultNetFromGross);
    if (effectiveId) navigate(REDIRECT_PATH);
  };

  const handleSave = () => {
    if (!isInterestSuccess) {
      showToastError("Önce geçerli bir faiz hesaplaması yapın");
      return;
    }
    try {
      kaydetAc({
        hesapTuru: RECORD_TYPE,
        veri: {
          data: {
            form: {
              grossForNet,
              selectedYear,
              selectedPeriod,
              faizBaslangicTarihi,
              icraTakipTarihi,
              faizTuru,
            },
            results: {
              gross: netFromGross.gross,
              sgk: netFromGross.sgk,
              issizlik: netFromGross.issizlik,
              gelirVergisi: netFromGross.gelirVergisi,
              damgaVergisi: netFromGross.damgaVergisi,
              net: netFromGross.net,
              totalDays: interestResult.totalDays,
              totalInterest,
              takipToplami,
              periods: interestResult.periods,
            },
          },
          start_date: faizBaslangicTarihi || null,
          end_date: icraTakipTarihi || null,
          brut_total: Number((netFromGross.gross || 0).toFixed(2)),
          net_total: Number((takipToplami || 0).toFixed(2)),
          total: Number((takipToplami || 0).toFixed(2)),
        },
        mevcutId: effectiveId,
        redirectPath: REDIRECT_PATH,
      });
    } catch {
      showToastError("Kayıt yapılamadı");
    }
  };

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-2 sm:px-3 py-2 sm:py-3 space-y-3">
          <div className="rounded-xl border border-violet-200/70 dark:border-violet-800/50 bg-white dark:bg-gray-800 shadow-sm p-3 sm:p-4">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">İstisnalı Full Kesintili</h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Brütten nete çeviri (asgari ücret gelir/damga vergi istisnası dahil) hesaplaması.
          </p>
          </div>

          <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Brütten Nete Çevir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Brüt Ücret</Label>
                  <Input
                    value={grossForNet}
                    onChange={(e) => setGrossForNet(e.target.value)}
                    placeholder="Örn: 25.000,00"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Yıl</Label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const nextYear = Number(e.target.value);
                      setSelectedYear(nextYear);
                      if (!hasTwoPeriods(nextYear)) setSelectedPeriod(2);
                    }}
                    className="h-9 text-sm mt-1 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                {hasTwoPeriodsForYear ? (
                  <div>
                    <Label className="text-xs">Dönem</Label>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(Number(e.target.value) as 1 | 2)}
                      className="h-9 text-sm mt-1 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value={1}>Oca-Haz</option>
                      <option value={2}>Tem-Ara</option>
                    </select>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-gray-700 text-xs">
                <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">Brüt ücret</span>
                  <span className="font-semibold">{fmtCurrency(netFromGross.gross)} ₺</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400">
                  <span>SGK primi (%14)</span>
                  <span>-{fmtCurrency(netFromGross.sgk)} ₺</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400">
                  <span>İşsizlik primi (%1)</span>
                  <span>-{fmtCurrency(netFromGross.issizlik)} ₺</span>
                </div>

                {(netFromGross.gelirVergisiIstisna ?? 0) > 0 ? (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400">
                      <span>Gelir vergisi (brüt)</span>
                      <span>-{fmtCurrency(netFromGross.gelirVergisiBrut ?? 0)} ₺</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-green-600 dark:text-green-400">
                      <span>Asg. üc. gel. vergi ist.</span>
                      <span>+{fmtCurrency(netFromGross.gelirVergisiIstisna ?? 0)} ₺</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-600 dark:text-gray-400">Net gelir vergisi</span>
                      <span>-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400">
                    <span className="pr-1">Gelir vergisi {netFromGross.gelirVergisiDilimleri}</span>
                    <span className="shrink-0">-{fmtCurrency(netFromGross.gelirVergisi)} ₺</span>
                  </div>
                )}

                {(netFromGross.damgaVergisiIstisna ?? 0) > 0 ? (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400">
                      <span>Damga vergisi (brüt)</span>
                      <span>-{fmtCurrency(netFromGross.damgaVergisiBrut ?? 0)} ₺</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-green-600 dark:text-green-400">
                      <span>Asg. üc. damga vergi ist.</span>
                      <span>+{fmtCurrency(netFromGross.damgaVergisiIstisna ?? 0)} ₺</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-600 dark:text-gray-400">Net damga vergisi</span>
                      <span>-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400">
                    <span>Damga vergisi (binde 7,59)</span>
                    <span>-{fmtCurrency(netFromGross.damgaVergisi)} ₺</span>
                  </div>
                )}

                <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
                  <span>Net ücret</span>
                  <span>{fmtCurrency(netFromGross.net)} ₺</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs">Faiz Hesaplama</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px]">Faiz Başlangıç Tarihi</Label>
                  <Input
                    type="date"
                    value={faizBaslangicTarihi}
                    onChange={(e) => setFaizBaslangicTarihi(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">İcra Takip Tarihi</Label>
                  <Input
                    type="date"
                    value={icraTakipTarihi}
                    onChange={(e) => setIcraTakipTarihi(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">Faiz Türü</Label>
                  <select
                    value={faizTuru}
                    onChange={(e) => setFaizTuru(e.target.value as "yasal" | "en_yuksek_mevduat")}
                    className="h-8 text-xs mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="yasal">Yasal Faiz</option>
                    <option value="en_yuksek_mevduat">Bankalarca mevduatlara uygulanan en yüksek faiz</option>
                  </select>
                </div>
              </div>
              {interestWarning ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-2 py-1.5">
                  {interestWarning}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {isInterestSuccess ? (
            <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="space-y-2 pb-2">
                <CardTitle className="text-xs">Faiz Sonuç Özeti</CardTitle>
                <div className="space-y-1.5 border-b border-gray-200 dark:border-gray-700 pb-2.5 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                  <p>
                    <span className="font-medium text-gray-600 dark:text-gray-300">Hesaplama şekli:</span> Ana Para × Yıllık Faiz Oranı × Gün Sayısı / 36500 = Faiz
                  </p>
                  {faizTuru === "en_yuksek_mevduat" ? (
                    <p>
                      Bankalarca mevduatlara uygulanan en yüksek faiz hesaplamasında faiz oranları{" "}
                      <span className="font-mono text-gray-600 dark:text-gray-300">evds3.tcmb.gov.tr</span> güncel verileridir.
                    </p>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 text-xs">
                    {[
                      { label: "Brüt Alacak Tutarı", value: `${fmtCurrency(grossVal)} TL` },
                      { label: "SGK Primi", value: `-${fmtCurrency(netFromGross.sgk)} TL` },
                      { label: "İşsizlik Primi", value: `-${fmtCurrency(netFromGross.issizlik)} TL` },
                      { label: "Gelir Vergisi", value: `-${fmtCurrency(netFromGross.gelirVergisi)} TL` },
                      { label: "Damga Vergisi", value: `-${fmtCurrency(netFromGross.damgaVergisi)} TL` },
                      { label: "Net Tutar (Anapara)", value: `${fmtCurrency(netFromGross.net)} TL`, emphasize: true },
                      { label: "Faiz Başlangıç Tarihi", value: fmtDateTR(faizBaslangicTarihi) },
                      { label: "İcra Takip Tarihi", value: fmtDateTR(icraTakipTarihi) },
                      { label: "Gün Sayısı", value: `${interestResult.totalDays} gün` },
                      {
                        label: "Faiz Türü",
                        value: faizTuru === "yasal" ? "Yasal Faiz" : "Bankalarca Mevduatlara Uygulanan En Yüksek Faiz",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 dark:border-gray-800 md:[&:nth-last-child(-n+2)]:border-b-0 [&:last-child]:border-b-0 ${
                          row.emphasize ? "bg-green-50/60 dark:bg-green-900/20" : "bg-white dark:bg-gray-900"
                        }`}
                      >
                        <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
                        <span className={`text-right ${row.emphasize ? "font-semibold text-green-700 dark:text-green-400" : "font-medium text-gray-900 dark:text-gray-100"}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Faiz Dönemleri</p>
                  <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                    <table className="w-full min-w-[640px] text-xs border-collapse">
                      <thead className="bg-gray-50 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold border-b border-gray-200 dark:border-gray-700">Başlangıç Tarihi</th>
                          <th className="px-3 py-2 text-left font-semibold border-b border-gray-200 dark:border-gray-700">Bitiş Tarihi</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-gray-200 dark:border-gray-700">Gün</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-gray-200 dark:border-gray-700">Oran</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-gray-200 dark:border-gray-700">Faiz Tutarı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interestResult.periods.length > 0 ? (
                          interestResult.periods.map((period, index) => (
                            <tr key={`${period.startDate}-${period.endDate}-${index}`} className={index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-800/40"}>
                              <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">{fmtDateTR(period.startDate)}</td>
                              <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">{fmtDateTR(period.endDate)}</td>
                              <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-right">{period.days}</td>
                              <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-right">%{period.rate}</td>
                              <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-right font-medium">{fmtCurrency(period.interest)} TL</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">
                              Dönem bulunmuyor (gün sayısı 0).
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold text-indigo-700 dark:text-indigo-300">
                    <span>Toplam Faiz Tutarı</span>
                    <span className="text-right">{fmtCurrency(totalInterest)} TL</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-green-700 dark:text-green-400">
                    <span>Takip Toplamı</span>
                    <span className="text-right">{fmtCurrency(takipToplami)} TL</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Link
            to="/icra-takip-brutten-nete"
            className="inline-flex text-sm font-medium text-violet-700 dark:text-violet-400 hover:underline"
          >
            ← Kartlara geri dön
          </Link>
        </div>
      </div>

      <FooterActions
        replacePrintWith={{ label: "Yeni Hesapla", onClick: handleNew }}
        previewButton={{
          title: "İstisnalı Full Kesintili Önizleme",
          copyTargetId: "icra-istisnali-preview-copy",
          hideWordDownload: true,
          renderContent: () => (
            <div id="icra-istisnali-preview-copy" style={{ background: "white", padding: 16, color: "#111827" }}>
              <style>{`
                .report-section-copy { margin-bottom: 14px; }
                .report-section-copy .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
                .report-section-copy .section-title { font-weight: 700; font-size: 12px; }
                .report-section-copy .copy-icon-btn { background: transparent; border: none; cursor: pointer; opacity: 0.7; padding: 2px; }
                .report-section-copy .copy-icon-btn:hover { opacity: 1; }
              `}</style>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>İstisnalı Full Kesintili</h3>

              <div className="report-section-copy report-section" data-section="icra-ozet-bilgiler">
                <div className="section-header">
                  <span className="section-title">Brütten Nete Çeviri</span>
                  <button
                    type="button"
                    className="copy-icon-btn"
                    onClick={async () => {
                      const ok = await copySectionForWord("icra-ozet-bilgiler");
                      if (ok) success("Kopyalandı");
                    }}
                    title="Word'e kopyala"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="section-content">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                    <tbody>
                      {[
                        ["Brüt Alacak Tutarı", `${fmtCurrency(grossVal)} TL`],
                        ["SGK Primi", `-${fmtCurrency(netFromGross.sgk)} TL`],
                        ["İşsizlik Primi", `-${fmtCurrency(netFromGross.issizlik)} TL`],
                        ["Gelir Vergisi", `-${fmtCurrency(netFromGross.gelirVergisi)} TL`],
                        ["Damga Vergisi", `-${fmtCurrency(netFromGross.damgaVergisi)} TL`],
                        ["Net Tutar (Anapara)", `${fmtCurrency(netFromGross.net)} TL`],
                      ].map(([label, value], idx) => (
                        <tr key={`${label}-${idx}`}>
                          <td style={{ border: "1px solid #d1d5db", padding: "6px 8px", color: "#4b5563", width: "45%" }}>{label}</td>
                          <td
                            style={{
                              border: "1px solid #d1d5db",
                              padding: "6px 8px",
                              textAlign: "right",
                              fontWeight: label === "Net Tutar (Anapara)" ? 700 : 500,
                              color: label === "Net Tutar (Anapara)" ? "#166534" : "#111827",
                            }}
                          >
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="report-section-copy report-section" data-section="icra-faiz-donemleri">
                <div className="section-header">
                  <span className="section-title">Faiz Hesaplama Verileri</span>
                  <button
                    type="button"
                    className="copy-icon-btn"
                    onClick={async () => {
                      const ok = await copySectionForWord("icra-faiz-donemleri");
                      if (ok) success("Kopyalandı");
                    }}
                    title="Word'e kopyala"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="section-content">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12 }}>
                    <tbody>
                      {[
                        ["Faiz Başlangıç Tarihi", fmtDateTR(faizBaslangicTarihi)],
                        ["İcra Takip Tarihi", fmtDateTR(icraTakipTarihi)],
                        ["Gün Sayısı", isInterestSuccess ? `${interestResult.totalDays} gün` : "-"],
                        [
                          "Faiz Türü",
                          faizTuru === "yasal" ? "Yasal Faiz" : "Bankalarca Mevduatlara Uygulanan En Yüksek Faiz",
                        ],
                      ].map(([label, value], idx) => (
                        <tr key={`meta-${label}-${idx}`}>
                          <td colSpan={2} style={{ border: "1px solid #d1d5db", padding: "6px 8px", color: "#4b5563", width: "45%" }}>
                            {label}
                          </td>
                          <td colSpan={3} style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>
                            {value}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "left" }}>Başlangıç Tarihi</th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "left" }}>Bitiş Tarihi</th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right" }}>Gün</th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right" }}>Oran</th>
                        <th style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right" }}>Faiz Tutarı</th>
                      </tr>
                      {isInterestSuccess && interestResult.periods.length > 0 ? (
                        interestResult.periods.map((period, index) => (
                          <tr key={`${period.startDate}-${period.endDate}-${index}`} style={{ background: index % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                            <td style={{ border: "1px solid #d1d5db", padding: "6px 8px" }}>{fmtDateTR(period.startDate)}</td>
                            <td style={{ border: "1px solid #d1d5db", padding: "6px 8px" }}>{fmtDateTR(period.endDate)}</td>
                            <td style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right" }}>{period.days}</td>
                            <td style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right" }}>%{period.rate}</td>
                            <td style={{ border: "1px solid #d1d5db", padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>
                              {fmtCurrency(period.interest)} TL
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "center", color: "#6b7280" }}>
                            Dönem bulunmuyor (gün sayısı 0).
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={4} style={{ border: "1px solid #d1d5db", padding: "7px 8px", fontWeight: 700, color: "#4338ca" }}>
                          Toplam Faiz Tutarı
                        </td>
                        <td style={{ border: "1px solid #d1d5db", padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#4338ca" }}>
                          {fmtCurrency(totalInterest)} TL
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ border: "1px solid #d1d5db", padding: "7px 8px", fontWeight: 800, color: "#166534" }}>
                          Takip Toplamı
                        </td>
                        <td style={{ border: "1px solid #d1d5db", padding: "7px 8px", textAlign: "right", fontWeight: 800, color: "#166534" }}>
                          {fmtCurrency(takipToplami)} TL
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ),
        }}
        onSave={handleSave}
        saveButtonProps={{ disabled: isSaving }}
        saveLabel={isSaving ? "Kaydediliyor..." : effectiveId ? "Güncelle" : "Kaydet"}
      />
    </>
  );
}
