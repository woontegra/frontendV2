/**
 * Fazla Mesai Modülü - Merkezi Import
 *
 * Tüm fazla-mesai sayfaları (Standart, Tanıklı, Donemsel, Haftalık Karma, vb.)
 * buradan tek noktadan import eder. Ortak dosyalar tek yerde tutulur.
 */

// === API & Tarih (global utils) ===
export { API_BASE_URL, apiClient, apiPost } from "@/utils/apiClient";
export {
  calculateWorkPeriod,
  calculateWeeksBetweenDates,
  clampToLastDayOfMonth,
} from "@/utils/dateUtils";
export { getScopedStorageKey } from "@/utils/storageKey";

// === Fazla Mesai Pipeline (utils/fazlaMesai) ===
export { applyAnnualLeaveExclusions } from "@/utils/fazlaMesai/applyAnnualLeaveExclusions";
export {
  apply270RuleFrontend,
  computeDisplayRows,
  FAZLA_MESAI_DENOMINATOR,
  FAZLA_MESAI_KATSAYI,
  DAMGA_VERGISI_ORANI,
  GELIR_VERGISI_ORANI,
  INCLUDED_OVERTIME_HOURS,
} from "@/utils/fazlaMesai/tableDisplayPipeline";
export type {
  FazlaMesaiRowBase,
  SonucSatiri270,
  CalculateOvertime270Detailed,
  CalculateOvertime270DetailedParams,
  ComputeDisplayRowsInput,
} from "@/utils/fazlaMesai/tableDisplayPipeline";

// === Modül Shared Utils ===
export { safeNumber, safeCurrency } from "./utils/safeFormat";
export { normalizeCurrency } from "./utils/currencyNormalizeCore";
export { normalizeLocalDate } from "./utils/dateHelpers";
export { generateDynamicIntervals, calculateIntervals, generateDynamicIntervalsFromWitnesses, calculateOvertimeHours } from "./utils/intervalHelper";
export { calculateOvertimeWith270AndLimitation } from "./utils/calculateOvertimeWith270AndLimitation";
export { segmentOvertimeResult, splitByAsgariUcretPeriods } from "./utils/dateSegmentationCore";
export { asgariUcretler, getAsgariUcretByDate } from "./constants/asgariUcretler";
export { calculateOvertimeTable } from "./utils/calculateOvertimeTable";
export { calculateOvertime } from "./utils/overtimeCalculator";
export type { Interval as OTInterval, SalaryPeriod as OTSalaryPeriod } from "./utils/overtimeCalculator";
export { calculateIncomeTaxForYear, calculateIncomeTaxWithBrackets } from "./utils/incomeTaxCore";

// === Modül Shared Constants ===
export { getAsgariUcretPeriods } from "./constants/asgariUcretPeriods";

// === Modül Shared Hooks ===
export { useToast } from "./hooks/useToast";
export { useKaydet } from "./hooks/useKaydet";

// === Report / Word / PDF (global utils) ===
export { buildWordTable } from "@/utils/wordTableBuilder";
export { adaptToWordTable } from "@/utils/wordTableAdapter";
export { copySectionForWord } from "@/utils/copyTableForWord";
export { downloadPdfFromDOM } from "@/utils/pdfExport";

// === Fazla Mesai UI ===
export { YillikIzinDislamalariPanel } from "@/components/fazlaMesai/YillikIzinDislamalariPanel";

// === Exclusion Storage ===
export type { ExcludedDay } from "@/utils/exclusionStorage";
export {
  saveExclusionSet,
  getAllExclusionSets,
  deleteExclusionSet,
} from "@/utils/exclusionStorage";
