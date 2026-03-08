/**
 * KidemTazminatiForm.tsx
 * Lokal KidemTazminatiForm componenti - SADECE bu sayfa için
 */

import { useEffect, useMemo, useState, useRef } from "react";
import { calcWorkPeriodBilirKisi, parseMoney } from "./utils";
import { useToast } from "@/context/ToastContext";
import {
  getAllExtraCalculationsSets,
  saveExtraCalculationsSet,
  loadExtraCalculationsSet,
  deleteExtraCalculationsSet,
  type SavedExtraCalculationsSet,
} from "./storage";
import { Save, Download, Trash2 } from "lucide-react";
import type { ExtraItem } from "./contract";

// Asgari ücret tablosu (2005 - 2025)
const ASGARI_UCRET_BRUT: Record<string, number> = {
  "2005-1": 488.7, "2005-2": 488.7,
  "2006-1": 531, "2006-2": 531,
  "2007-1": 562.5, "2007-2": 585,
  "2008-1": 608.4, "2008-2": 638.7,
  "2009-1": 666, "2009-2": 693,
  "2010-1": 729, "2010-2": 760.5,
  "2011-1": 796.5, "2011-2": 837,
  "2012-1": 886.5, "2012-2": 940.5,
  "2013-1": 978.6, "2013-2": 1021.5,
  "2014-1": 1071, "2014-2": 1134,
  "2015-1": 1201.5, "2015-2": 1273.5,
  "2016-1": 1647, "2016-2": 1647,
  "2017-1": 1777.5, "2017-2": 1777.5,
  "2018-1": 2029.5, "2018-2": 2029.5,
  "2019-1": 2558.4, "2019-2": 2558.4,
  "2020-1": 2943, "2020-2": 2943,
  "2021-1": 3577.5, "2021-2": 3577.5,
  "2022-1": 5004, "2022-2": 6471,
  "2023-1": 10008, "2023-2": 13414.5,
  "2024-1": 20002.5, "2024-2": 20002.5,
  "2025-1": 26005.5, "2025-2": 26005.5,
};

function getAsgariUcretByDate(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const period = month <= 6 ? "1" : "2";
  const key = `${year}-${period}`;
  
  if (!ASGARI_UCRET_BRUT[key]) {
    const maxYear = Math.max(...Object.keys(ASGARI_UCRET_BRUT).map(k => parseInt(k.split('-')[0])));
    const maxPeriod = year > maxYear ? "2" : period;
    const fallbackKey = `${maxYear}-${maxPeriod}`;
    return ASGARI_UCRET_BRUT[fallbackKey] || null;
  }
  
  return ASGARI_UCRET_BRUT[key];
}

type Props = {
  onTotalsChange: (totals: { toplam: number; yil: number; ay: number; gun: number }) => void;
  appliedEklenti?: number | { field: string; value: number } | null;
  onRequestEklenti?: (fieldKey: string, title: string, apply: (v: number) => void) => void;
  onExitDateChange?: (date: string) => void;
  hideEmploymentDates?: boolean;
  onValuesChange?: (values: {
    iseGiris: string;
    istenCikis: string;
    brut: string;
    prim: string;
    ikramiye: string;
    yol: string;
    yemek: string;
    extras: ExtraItem[];
    toplam: number;
  }) => void;
  initialBrut?: string;
  showIhbarShortcut?: boolean;
  ihbarRoute?: string;
  initialIseGiris?: string;
  initialIstenCikis?: string;
  initialPrim?: string;
  initialIkramiye?: string;
  initialYol?: string;
  initialYemek?: string;
  initialExtras?: ExtraItem[];
  customTitle?: string;
  customIseGirisLabel?: string;
  customIstenCikisLabel?: string;
  denemeSuresiGun?: number;
  customTotalFormatter?: (n: number) => string;
  headerAction?: React.ReactNode;
  extraCalculationsLabel?: string;
  showEmploymentDates?: boolean;
  showBrutInput?: boolean;
  showPrimInput?: boolean;
  showIkramiyeInput?: boolean;
  showYolInput?: boolean;
  showYemekInput?: boolean;
  showExtras?: boolean;
  /** true ise dış kart render edilmez (üst sayfa kartına gömülü) */
  embedInCard?: boolean;
};

export default function KidemTazminatiForm({ 
  onTotalsChange, 
  appliedEklenti, 
  onRequestEklenti, 
  onExitDateChange, 
  onValuesChange, 
  initialBrut, 
  showIhbarShortcut = true, 
  ihbarRoute = "30isci", 
  hideEmploymentDates = false, 
  initialIseGiris, 
  initialIstenCikis, 
  initialPrim, 
  initialIkramiye, 
  initialYol, 
  initialYemek, 
  initialExtras, 
  customTitle, 
  customIseGirisLabel, 
  customIstenCikisLabel, 
  denemeSuresiGun = 0, 
  customTotalFormatter, 
  headerAction, 
  extraCalculationsLabel = "Ekstra Hesaplamalar (Prim, İkramiye, Yol, Yemek vb.)",
  showEmploymentDates = true,
  showBrutInput = true,
  showPrimInput = true,
  showIkramiyeInput = true,
  showYolInput = true,
  showYemekInput = true,
  showExtras = true,
  embedInCard = false,
}: Props) {
  const { error, success } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedSets, setSavedSets] = useState<SavedExtraCalculationsSet[]>([]);
  const [iseGiris, setIseGiris] = useState("");
  const [istenCikis, setIstenCikis] = useState("");
  const [brut, setBrut] = useState("");
  const [prim, setPrim] = useState("");
  const [ikramiye, setIkramiye] = useState("");
  const [yol, setYol] = useState("");
  const [yemek, setYemek] = useState("");
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [asgariHata, setAsgariHata] = useState<string | null>(null);
  
  const prevInitialsRef = useRef({
    initialBrut: "",
    initialIseGiris: "",
    initialIstenCikis: "",
    initialPrim: "",
    initialIkramiye: "",
    initialYol: "",
    initialYemek: "",
    initialExtras: [] as ExtraItem[],
  });
  
  const prevValuesRef = useRef({
    iseGiris: "",
    istenCikis: "",
    brut: "",
    prim: "",
    ikramiye: "",
    yol: "",
    yemek: "",
    toplam: 0,
    extras: [] as ExtraItem[],
  });

  const adjustedIseGiris = useMemo(() => {
    if (!iseGiris || denemeSuresiGun <= 0) return iseGiris;
    
    try {
      const startDate = new Date(iseGiris);
      if (isNaN(startDate.getTime())) return iseGiris;
      
      const adjustedDate = new Date(startDate);
      adjustedDate.setDate(adjustedDate.getDate() + denemeSuresiGun);
      
      return adjustedDate.toISOString().split('T')[0];
    } catch {
      return iseGiris;
    }
  }, [iseGiris, denemeSuresiGun]);

  const diff = useMemo(() => {
    const wp = calcWorkPeriodBilirKisi(adjustedIseGiris, istenCikis);
    return { yil: wp.years, ay: wp.months, gun: wp.days, label: wp.label };
  }, [adjustedIseGiris, istenCikis]);

  const toplam = useMemo(() => {
    const base = parseMoney(brut) + parseMoney(prim) + parseMoney(ikramiye) + parseMoney(yol) + parseMoney(yemek);
    const ex = extras.reduce((acc, it) => acc + parseMoney(it.value), 0);
    return base + ex;
  }, [brut, prim, ikramiye, yol, yemek, extras]);

  useEffect(() => {
    if (appliedEklenti === undefined || appliedEklenti === null) return;

    if (typeof appliedEklenti === "number") {
      const v = Number(appliedEklenti) || 0;
      const formatted = String(v.toFixed(2)).replace(".", ",");
      setIkramiye(formatted);
      return;
    }

    const { field, value } = appliedEklenti;
    const formatted = String(value.toFixed(2)).replace(".", ",");

    if (field === "prim") setPrim(formatted);
    if (field === "ikramiye") setIkramiye(formatted);
    if (field === "yemek") setYemek(formatted);

    if (field.startsWith("extra:")) {
      const id = field.split(":")[1];
      setExtras((prev) =>
        prev.map((x) => (x.id === id ? { ...x, value: formatted } : x))
      );
    }
  }, [appliedEklenti]);

  useEffect(() => {
    if (initialBrut && initialBrut !== prevInitialsRef.current.initialBrut) {
      prevInitialsRef.current.initialBrut = initialBrut;
      setBrut(initialBrut);
    }
  }, [initialBrut]);

  const asgariHataMessage = useMemo(() => {
    if (!istenCikis || !brut) {
      return null;
    }
    
    const minUcretRaw = getAsgariUcretByDate(istenCikis);
    if (!minUcretRaw) {
      return null;
    }
    
    const minUcret = typeof minUcretRaw === "number" ? minUcretRaw : parseMoney(String(minUcretRaw));
    if (!minUcret || minUcret === 0) {
      return null;
    }
    
    const brutValue = parseMoney(brut);
    
    if (!brutValue || brutValue === 0) {
      return null;
    }
    
    if (brutValue < minUcret) {
      const year = new Date(istenCikis).getFullYear();
      const formattedMin = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minUcret);
      return `Girilen ücret, ${year} yılı asgari brüt ücretinden düşük olamaz (${formattedMin}₺).`;
    }
    
    return null;
  }, [istenCikis, brut]);

  useEffect(() => {
    setAsgariHata(asgariHataMessage);
  }, [asgariHataMessage]);

  const currentStateRef = useRef({
    iseGiris: "",
    istenCikis: "",
  });
  
  const skipOnValuesChangeRef = useRef(false);
  
  useEffect(() => {
    currentStateRef.current.iseGiris = iseGiris;
  }, [iseGiris]);
  useEffect(() => {
    currentStateRef.current.istenCikis = istenCikis;
  }, [istenCikis]);
  
  useEffect(() => { 
    if (initialIseGiris && 
        initialIseGiris !== prevInitialsRef.current.initialIseGiris &&
        initialIseGiris !== currentStateRef.current.iseGiris) {
      prevInitialsRef.current.initialIseGiris = initialIseGiris;
      skipOnValuesChangeRef.current = true;
      setIseGiris(initialIseGiris);
    }
  }, [initialIseGiris]);
  useEffect(() => { 
    if (initialIstenCikis && 
        initialIstenCikis !== prevInitialsRef.current.initialIstenCikis &&
        initialIstenCikis !== currentStateRef.current.istenCikis) {
      prevInitialsRef.current.initialIstenCikis = initialIstenCikis;
      skipOnValuesChangeRef.current = true;
      setIstenCikis(initialIstenCikis);
    }
  }, [initialIstenCikis]);
  useEffect(() => { 
    if (initialPrim !== undefined && initialPrim !== prevInitialsRef.current.initialPrim) {
      prevInitialsRef.current.initialPrim = initialPrim;
      setPrim(initialPrim); 
    }
  }, [initialPrim]);
  useEffect(() => { 
    if (initialIkramiye !== undefined && initialIkramiye !== prevInitialsRef.current.initialIkramiye) {
      prevInitialsRef.current.initialIkramiye = initialIkramiye;
      setIkramiye(initialIkramiye); 
    }
  }, [initialIkramiye]);
  useEffect(() => { 
    if (initialYol !== undefined && initialYol !== prevInitialsRef.current.initialYol) {
      prevInitialsRef.current.initialYol = initialYol;
      setYol(initialYol); 
    }
  }, [initialYol]);
  useEffect(() => { 
    if (initialYemek !== undefined && initialYemek !== prevInitialsRef.current.initialYemek) {
      prevInitialsRef.current.initialYemek = initialYemek;
      setYemek(initialYemek); 
    }
  }, [initialYemek]);
  // initialExtras sadece harici yükleme (kayıt açma vb.) durumunda uygula.
  // Kullanıcı +Ekle ile eklemişse (bizim extras daha fazla) parent'ın geri yansıması bizi silmesin.
  useEffect(() => { 
    if (initialExtras === undefined) return;
    const prevStr = JSON.stringify(prevInitialsRef.current.initialExtras);
    const initStr = JSON.stringify(initialExtras);
    if (initStr === prevStr) return;
    setExtras((current) => {
      // Harici yükleme: initialExtras daha fazla içerik getiriyor
      if (initialExtras.length > current.length) {
        prevInitialsRef.current.initialExtras = initialExtras;
        return initialExtras;
      }
      // Kullanıcı eklemiş (current daha fazla veya eşit) - override etme
      if (current.length > initialExtras.length) return current;
      // Aynı uzunluk, içerik farklı (örn. düzenleme) - uygula
      prevInitialsRef.current.initialExtras = initialExtras;
      return initialExtras;
    });
  }, [initialExtras]);

  useEffect(() => {
    onTotalsChange({ toplam, yil: diff.yil, ay: diff.ay, gun: diff.gun });
  }, [toplam, diff.yil, diff.ay, diff.gun, onTotalsChange]);
  
  useEffect(() => {
    if (skipOnValuesChangeRef.current) {
      prevValuesRef.current = {
        iseGiris,
        istenCikis,
        brut,
        prim,
        ikramiye,
        yol,
        yemek,
        toplam,
        extras,
      };
      skipOnValuesChangeRef.current = false;
      return;
    }
    
    const extrasChanged = JSON.stringify(prevValuesRef.current.extras) !== JSON.stringify(extras);
    
    const valuesChanged = 
      prevValuesRef.current.iseGiris !== iseGiris ||
      prevValuesRef.current.istenCikis !== istenCikis ||
      prevValuesRef.current.brut !== brut ||
      prevValuesRef.current.prim !== prim ||
      prevValuesRef.current.ikramiye !== ikramiye ||
      prevValuesRef.current.yol !== yol ||
      prevValuesRef.current.yemek !== yemek ||
      prevValuesRef.current.toplam !== toplam ||
      extrasChanged;
    
    if (valuesChanged && onValuesChange) {
      prevValuesRef.current = {
        iseGiris,
        istenCikis,
        brut,
        prim,
        ikramiye,
        yol,
        yemek,
        toplam,
        extras,
      };
      onValuesChange({ iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, extras, toplam });
    }
  }, [iseGiris, istenCikis, brut, prim, ikramiye, yol, yemek, toplam, extras, onValuesChange]);

  const addExtra = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    setExtras((prev) => [...prev, { id, label: "Eklenti", value: "" }]);
  };

  const setExtra = (id: string, patch: Partial<ExtraItem>) => {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeExtra = (id: string) => {
    setExtras((prev) => prev.filter((x) => x.id !== id));
  };

  useEffect(() => {
    if (showImportModal) {
      getAllExtraCalculationsSets().then(setSavedSets);
    }
  }, [showImportModal]);

  const FIXED_EXTRA_IDS = ["prim", "ikramiye", "yol", "yemek"];
  const handleSave = async () => {
    if (!saveName.trim()) {
      error("Lütfen bir isim girin");
      return;
    }

    const items: { id: string; name: string; value: string }[] = [];
    if (prim?.trim()) items.push({ id: "prim", name: "Prim", value: prim.trim() });
    if (ikramiye?.trim()) items.push({ id: "ikramiye", name: "İkramiye", value: ikramiye.trim() });
    if (yol?.trim()) items.push({ id: "yol", name: "Yol", value: yol.trim() });
    if (yemek?.trim()) items.push({ id: "yemek", name: "Yemek", value: yemek.trim() });
    extras.forEach(item => items.push({ id: item.id, name: item.label, value: item.value }));

    if (items.length === 0) {
      error("Kaydedilecek ekstra hesaplama bulunamadı");
      return;
    }

    const successResult = await saveExtraCalculationsSet(saveName.trim(), items);
    if (successResult) {
      success("Ekstra hesaplamalar kaydedildi");
      setShowSaveModal(false);
      setSaveName("");
    } else {
      error("Kaydetme başarısız");
    }
  };

  const handleImport = async (setName: string) => {
    const data = await loadExtraCalculationsSet(setName);
    if (data.length > 0) {
      const primItem = data.find((x: { id: string }) => x.id === "prim");
      const ikramiyeItem = data.find((x: { id: string }) => x.id === "ikramiye");
      const yolItem = data.find((x: { id: string }) => x.id === "yol");
      const yemekItem = data.find((x: { id: string }) => x.id === "yemek");
      const extrasData = data.filter((x: { id: string }) => !FIXED_EXTRA_IDS.includes(x.id));
      if (primItem?.value) setPrim(primItem.value);
      if (ikramiyeItem?.value) setIkramiye(ikramiyeItem.value);
      if (yolItem?.value) setYol(yolItem.value);
      if (yemekItem?.value) setYemek(yemekItem.value);
      setExtras(extrasData.map((item: { id: string; name: string; value: string }) => ({ id: item.id, label: item.name, value: item.value })));
      success("Ekstra hesaplamalar yüklendi");
      setShowImportModal(false);
    } else {
      error("Yüklenecek veri bulunamadı");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu seti silmek istediğinize emin misiniz?")) return;

    const successResult = await deleteExtraCalculationsSet(id);
    if (successResult) {
      success("Set silindi");
      await getAllExtraCalculationsSets().then(setSavedSets);
    } else {
      error("Silme başarısız");
    }
  };

  const wrapperClassName = embedInCard ? "space-y-4" : "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 md:p-4 mb-4";
  const wrapperStyle = embedInCard ? undefined : { maxWidth: '100%', boxSizing: 'border-box' as const };
  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {!embedInCard && (
      <div className="border-b border-gray-200 dark:border-gray-600 pb-2 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-center gap-2">
          <div className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200 text-center sm:text-left" style={{ minWidth: 0, wordBreak: 'break-word' }}>{customTitle || "KIDEM TAZMİNATI HESAPLAMA"}</div>
          {headerAction && <div className="flex gap-2 justify-center w-full sm:w-auto" style={{ flexShrink: 0 }}>{headerAction}</div>}
        </div>
      </div>
      )}
      {!hideEmploymentDates && showEmploymentDates && (
        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1" style={{ minWidth: 0 }}>
              <span style={{ wordBreak: 'break-word' }}>{customIseGirisLabel || "İşe Giriş Tarihi"}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
            </label>
            <input
              type="date"
              max="9999-12-31"
              value={iseGiris}
              onChange={(e) => setIseGiris(e.target.value)}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && istenCikis && /^\d{4}-\d{2}-\d{2}$/.test(istenCikis)) {
                  const newDate = new Date(newValue);
                  const exitDate = new Date(istenCikis);
                  if (!isNaN(newDate.getTime()) && !isNaN(exitDate.getTime()) && newDate > exitDate) {
                    error("İşe giriş tarihi, işten çıkış tarihinden sonra olamaz.");
                  }
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1" style={{ minWidth: 0 }}>
              <span style={{ wordBreak: 'break-word' }}>{customIstenCikisLabel || "İşten Çıkış Tarihi"}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs" title="Tarih alanına GG.AA.YYYY formatında giriş yapınız.">ℹ️</span>
            </label>
            <input
              type="date"
              max="9999-12-31"
              value={istenCikis}
              onChange={(e) => {
                setIstenCikis(e.target.value);
                onExitDateChange?.(e.target.value);
              }}
              onBlur={(e) => {
                const newValue = e.target.value;
                if (newValue && /^\d{4}-\d{2}-\d{2}$/.test(newValue) && iseGiris && /^\d{4}-\d{2}-\d{2}$/.test(iseGiris)) {
                  const newDate = new Date(newValue);
                  const entryDate = new Date(iseGiris);
                  if (!isNaN(newDate.getTime()) && !isNaN(entryDate.getTime()) && newDate < entryDate) {
                    error("İşten çıkış tarihi, işe giriş tarihinden önce olamaz.");
                    setIstenCikis(iseGiris);
                    onExitDateChange?.(iseGiris);
                  }
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ minWidth: 0 }}>
              <span style={{ wordBreak: 'break-word' }}>Çalışma Süresi</span>
            </label>
            <input disabled value={diff.label} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
      )}

      {showBrutInput && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            <span>Çıplak Brüt Ücret *</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs" title="TL cinsinden brüt ücret.">ℹ️</span>
          </label>
          <input value={brut} onChange={(e) => setBrut(e.target.value)} placeholder="Örn: 25.000,00" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          {asgariHata && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{asgariHata}</p>
          )}
        </div>
      )}

      {/* Ekstra Hesaplamalar - Davacı Ücreti ile aynı düzen */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">₺</div>
            Ekstra Hesaplamalar
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              İçe Aktar
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={!(extras.length > 0 || (prim && prim.trim()) || (ikramiye && ikramiye.trim()) || (yol && yol.trim()) || (yemek && yemek.trim()))}
              className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Kaydet
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          {extraCalculationsLabel}
          <span className="cursor-help text-orange-500 ml-1" title="Çıplak brüt ücrete ek olarak prim, ikramiye, yemek gibi düzenli ödemeleri buraya ekleyebilirsiniz.">ⓘ</span>
        </p>
        <div className="space-y-2">
          {showPrimInput && (
            <div className="flex items-center gap-2">
              <input disabled value="Prim" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input value={prim} onChange={(e) => setPrim(e.target.value)} placeholder="Örn: 2.500,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500" onClick={() => onRequestEklenti?.("prim", "Prim için eklenti hesapla", (v) => setPrim(String(v.toFixed(2)).replace('.', ',')))}>
                  Eklenti Hesapla
                  <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın prim değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                </button>
              </div>
              <button type="button" onClick={() => setPrim("")} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {showIkramiyeInput && (
            <div className="flex items-center gap-2">
              <input disabled value="İkramiye" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input value={ikramiye} onChange={(e) => setIkramiye(e.target.value)} placeholder="Örn: 1.000,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500" onClick={() => onRequestEklenti?.("ikramiye", "İkramiye için eklenti hesapla", (v) => setIkramiye(String(v.toFixed(2)).replace('.', ',')))}>
                  Eklenti Hesapla
                  <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın ikramiye değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                </button>
              </div>
              <button type="button" onClick={() => setIkramiye("")} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {showYemekInput && (
            <div className="flex items-center gap-2">
              <input disabled value="Yemek" className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300" />
              <div className="flex-1 flex items-center gap-2">
                <input value={yemek} onChange={(e) => setYemek(e.target.value)} placeholder="Örn: 1.200,00" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500" onClick={() => onRequestEklenti?.("yemek", "Yemek için eklenti hesapla", (v) => setYemek(String(v.toFixed(2)).replace('.', ',')))}>
                  Eklenti Hesapla
                  <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın yemek bedeli değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                </button>
              </div>
              <button type="button" onClick={() => setYemek("")} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Temizle">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {showExtras && extras.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <input value={it.label} onChange={(e) => setExtra(it.id, { label: e.target.value })} className="w-40 sm:w-56 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Kalem Adı" />
              <div className="flex-1 flex items-center gap-2">
                <input value={it.value} onChange={(e) => setExtra(it.id, { value: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Tutar" />
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500" onClick={() => onRequestEklenti?.("extra:" + it.id, "Eklenti Hesapla", (v) => setExtra(it.id, { value: String(v.toFixed(2)).replace(".", ",") }))}>
                  Eklenti Hesapla
                  <span className="text-orange-500 dark:text-orange-400 cursor-help ml-1" title="Son 12 ayın değerlerini girerek aylık ortalama tutarı otomatik hesaplayın">ⓘ</span>
                </button>
              </div>
              <button type="button" onClick={() => removeExtra(it.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500 dark:text-red-400" aria-label="Satırı Sil">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {showExtras && (
            <button onClick={addExtra} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium px-4 py-2.5 rounded-full border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500">
              + Ekle
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-600 mt-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">Toplam</div>
        <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {customTotalFormatter 
            ? customTotalFormatter(toplam)
            : new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(toplam)
          }
        </div>
      </div>

      {/* Kaydet Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Ekstra Hesaplamaları Kaydet</h3>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Set adı girin"
              className="w-full mb-4 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setShowSaveModal(false);
                  setSaveName("");
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                }}
                className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2.5 rounded-full font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İçe Aktar Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Kaydedilmiş Setleri İçe Aktar</h3>
            {savedSets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Henüz kaydedilmiş set bulunmuyor
              </p>
            ) : (
              <div className="space-y-2">
                {savedSets.map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{set.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {set.data.length} kalem •{" "}
                        {new Date(set.createdAt).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleImport(set.name)}
                        className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-gray-700 dark:text-gray-300"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(set.id)}
                        className="p-2 rounded-full border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-full font-medium text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
