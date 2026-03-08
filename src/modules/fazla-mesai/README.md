# Fazla Mesai Modülü

Tüm fazla mesai sayfaları (Standart, Tanıklı, Dönemsel, Haftalık Karma, vb.) ortak dosyaları
**tek yerden** import eder.

## Merkezi Import Kullanımı

```tsx
// ❌ Eski (her sayfada farklı localUtils/localConstants import)
import { safeNumber } from "./localUtils/safeFormat";
import { asgariUcretler } from "./localConstants/asgariUcretler";
import { useKaydet } from "./localHooks/useKaydet";
import { applyAnnualLeaveExclusions } from "@/utils/fazlaMesai/applyAnnualLeaveExclusions";

// ✅ Yeni (tek noktadan import)
import {
  safeNumber,
  asgariUcretler,
  getAsgariUcretByDate,
  useKaydet,
  useToast,
  applyAnnualLeaveExclusions,
  calculateOvertimeWith270AndLimitation,
  YillikIzinDislamalariPanel,
} from "@modules/fazla-mesai/shared";
```

## Shared İçeriği

- **Utils:** safeFormat, dateHelpers, intervalHelper, calculateOvertimeWith270AndLimitation,
  dateSegmentationCore, overtimeCalculator, calculateOvertimeTable, incomeTaxCore, currencyNormalizeCore
- **Constants:** asgariUcretler, getAsgariUcretByDate, getAsgariUcretPeriods
- **Hooks:** useToast, useKaydet
- **API/Tarih:** apiClient, dateUtils, storageKey
- **Fazla Mesai Pipeline:** applyAnnualLeaveExclusions, tableDisplayPipeline
- **Report/PDF:** buildWordTable, adaptToWordTable, copySectionForWord, downloadPdfFromDOM
- **UI:** YillikIzinDislamalariPanel, KaydetModal (useKaydet ile kullanılır)
