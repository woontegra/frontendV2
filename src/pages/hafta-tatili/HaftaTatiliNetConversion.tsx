/**
 * Brütten Nete Çeviri + Hakkaniyet + Mahsuplaşma — Hafta Tatili Standart
 * Kompakt, backend API ile hesaplama
 */

import { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { apiPost } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import MahsuplasamaModal from "./MahsuplasamaModal";
import { fmtTR } from "./calculations";
import type { HaftaTatiliTableRow } from "./state";

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5";
const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200";

interface NetSummary {
  brut: number;
  ssk: number;
  gelir: number;
  damga: number;
  net: number;
  hakkaniyet: number;
  settleAmount: string;
}

interface Props {
  brutTotal?: number;
  haftaTatiliBrutTotal?: number;
  tableData?: HaftaTatiliTableRow[];
  dateRanges?: { id: string; start: string; end: string }[];
  onSummaryChange?: (summary: NetSummary) => void;
}

export default function HaftaTatiliNetConversion(props: Props) {
  const brutTotal = props.brutTotal ?? props.haftaTatiliBrutTotal ?? 0;
  const { tableData = [], dateRanges = [], onSummaryChange } = props;
  const { error: showError } = useToast();
  const [brutInput, setBrutInput] = useState("");
  const [brut, setBrut] = useState(0);
  const [ssk, setSsk] = useState(0);
  const [issizlik, setIssizlik] = useState(0);
  const [gelir, setGelir] = useState(0);
  const [gelirLabel, setGelirLabel] = useState("");
  const [damga, setDamga] = useState(0);
  const [net, setNet] = useState(0);
  const [settleAmount, setSettleAmount] = useState("");
  const [showMahsup, setShowMahsup] = useState(false);

  const selectedYear = useMemo(() => {
    const exits = dateRanges
      .map((r) => r.end)
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));
    if (exits.length > 0) {
      const yr = exits.reduce((a, b) => (b > a ? b : a)).getFullYear();
      if (yr >= 2010 && yr <= 2035) return yr;
    }
    return new Date().getFullYear();
  }, [dateRanges]);

  // brutTotal değişince input'u güncelle
  useEffect(() => {
    const rounded = Math.round(brutTotal * 100) / 100;
    setBrut(rounded);
    setBrutInput(rounded > 0 ? fmtTR(rounded) + " ₺" : "");
  }, [brutTotal]);

  // Backend'den net hesapla
  useEffect(() => {
    if (brut <= 0) {
      setSsk(0); setIssizlik(0); setGelir(0); setGelirLabel(""); setDamga(0); setNet(0);
      return;
    }
    let cancelled = false;
    apiPost("/api/hafta-tatili/calculate-net", { brutAmount: brut, year: selectedYear })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled || !result.success || !result.data) return;
        const { ssk: s, issizlik: is, gelirVergisi: g, gelirVergisiDilimleri: gd, damgaVergisi: d, netAmount: n } = result.data;
        setSsk(s || 0);
        setIssizlik(is || 0);
        setGelir(g || 0);
        setGelirLabel(typeof gd === "string" ? gd : (gd?.summary ?? ""));
        setDamga(d || 0);
        setNet(n || 0);
      })
      .catch(() => {
        if (!cancelled) showError("Net hesaplama sırasında hata oluştu");
      });
    return () => { cancelled = true; };
  }, [brut, selectedYear]);

  const hakkaniyet = brut / 3;
  const mahsupNum =
    Number(settleAmount.replace(/\./g, "").replace(",", ".").replace("₺", "").trim()) || 0;
  const mahsupSonuc = Math.max(0, brut - hakkaniyet - mahsupNum);

  useEffect(() => {
    onSummaryChange?.({
      brut,
      ssk: ssk + issizlik,
      gelir,
      damga,
      net,
      hakkaniyet,
      settleAmount,
    });
  }, [brut, ssk, issizlik, gelir, damga, net, hakkaniyet, settleAmount]);

  const handleBrutChange = (val: string) => {
    setBrutInput(val);
    const clean = val.replace(/₺/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    setBrut(Number(clean) || 0);
  };

  return (
    <section className="space-y-3">
      <h2 className={sectionTitleCls}>Brüt'ten Net'e</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Sol: Net hesaplama */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          <div className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-600">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Brüt Hafta Tatili Ücreti (₺)
            </label>
            <input
              type="text"
              value={brutInput}
              onChange={(e) => handleBrutChange(e.target.value)}
              placeholder="Otomatik doldurulur"
              className={`${inputCls} mt-0.5`}
            />
          </div>
          <div className="p-2.5 space-y-1 text-xs">
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Brüt Hafta Tatili Ücreti</span>
              <span className="font-medium">{fmtTR(brut)} ₺</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
              <span>SGK İşçi Primi (%14)</span>
              <span>-{fmtTR(ssk)} ₺</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
              <span>İşsizlik Primi (%1)</span>
              <span>-{fmtTR(issizlik)} ₺</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
              <span>Gelir Vergisi {gelirLabel}</span>
              <span>-{fmtTR(gelir)} ₺</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
              <span>Damga Vergisi (Binde 7,59)</span>
              <span>-{fmtTR(damga)} ₺</span>
            </div>
            <div className="flex justify-between pt-1.5 font-semibold text-green-700 dark:text-green-400">
              <span>Net Hafta Tatili Ücreti</span>
              <span>{fmtTR(net)} ₺</span>
            </div>
          </div>
        </div>

        {/* Sağ: Hakkaniyet + Mahsuplaşma */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          <div className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-600">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Hakkaniyet & Mahsuplaşma</span>
          </div>
          <div className="p-2.5 space-y-3 text-xs">
            <div>
              <label className={labelCls}>1/3 Hakkaniyet İndirimi (₺)</label>
              <input
                type="text"
                readOnly
                value={fmtTR(hakkaniyet) + " ₺"}
                className={`${inputCls} bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400`}
              />
              <p className="mt-0.5 text-gray-500 dark:text-gray-400 text-xs">
                {fmtTR(brut)} − {fmtTR(hakkaniyet)} = {fmtTR(brut - hakkaniyet)} ₺
              </p>
            </div>
            <div>
              <label className={labelCls}>Mahsuplaşma Miktarı (₺)</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={settleAmount ? settleAmount + " ₺" : ""}
                  onChange={(e) => setSettleAmount(e.target.value.replace(/₺/g, "").trim())}
                  placeholder="0,00 ₺"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setShowMahsup(true)}
                  className="shrink-0 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  title="Mahsuplaşma Ekle"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="pt-1.5 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between font-semibold text-indigo-700 dark:text-indigo-400">
                <span>Mahsuplaşma Sonucu</span>
                <span>{fmtTR(mahsupSonuc)} ₺</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MahsuplasamaModal
        open={showMahsup}
        onOpenChange={setShowMahsup}
        tableData={tableData}
        onSave={(total, _data) => {
          setSettleAmount(fmtTR(total));
        }}
      />
    </section>
  );
}
