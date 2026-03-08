# frontendV2 Mimari

## Genel Yapı

- **Sıfırdan** kurulmuş, düzenli ve modüler yapı
- **Mobil uyumlu**, program benzeri arayüz hedefi
- **Hesaplama motorları** değişmeden korunuyor
- **Sayfa izolasyonu:** Bir sayfa düzenlenirken diğerleri etkilenmez

## Klasör Yapısı

```
src/
├── shared/           # Global paylaşılan kaynaklar
│   ├── utils/        # apiClient, dateUtils, authToken, fazlaMesai/, vb.
│   ├── context/      # Auth, Toast
│   ├── contexts/     # Case
│   ├── config/
│   ├── constants/
│   └── lib/
├── core/             # Kaydet (merkezi kayıt akışı)
├── modules/          # Modül bazlı merkezi import
│   ├── fazla-mesai/
│   │   └── shared/   # Tüm fazla-mesai sayfaları BURADAN import eder
│   │       ├── index.ts
│   │       ├── utils/
│   │       ├── constants/
│   │       ├── hooks/
│   │       └── components/
│   ├── kidem-tazminati/shared/   # (gelecekte)
│   ├── yillik-izin/shared/       # (gelecekte)
│   └── hafta-tatili/shared/      # (gelecekte)
├── components/       # UI, FooterActions, report, fazlaMesai
├── layout/           # Mobil-first shell
├── pages/
└── main.tsx, App.tsx, index.css
```

## Modül Merkezi Import

Her modül (örn. fazla-mesai) için tek bir `shared/index.ts` dosyası vardır.
Tüm sayfalar o modüle özgü utils, constants, hooks ve bileşenleri buradan import eder.

**Örnek:**
```tsx
import { safeNumber, useKaydet, applyAnnualLeaveExclusions } from "@modules/fazla-mesai/shared";
```

## Alias’lar (vite.config + tsconfig)

- `@/utils` → src/shared/utils
- `@/context` → src/shared/context
- `@/contexts` → src/shared/contexts
- `@/core` → src/core
- `@/components` → src/components
- `@modules/fazla-mesai` → src/modules/fazla-mesai
- `@modules/kidem-tazminati` → src/modules/kidem-tazminati
- vb.

## Sonraki Adımlar

1. Kidem, Yıllık İzin, Hafta Tatili modülleri için shared yapıları kurulacak
2. Mobil-first layout (bottom nav, responsive header) eklenecek
3. Sayfalar bu shared modüllerden import edecek şekilde güncellenecek
