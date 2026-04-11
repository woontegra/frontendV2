/**
 * Günlük olmayan basın yıllık izin — v1’de ayrı API; v2’de geçici bilgi sayfası.
 */

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function YillikIzinBasinGunlukOlmayanPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900 px-4 py-10">
      <div className="max-w-lg mx-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Günlük olmayan gazete</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Bu hesaplama türü ayrı kurallar ve API ile çalışır; v2 arayüzüne aktarımı sırada. Şimdilik günlük gazete hesaplaması için ana Basın sayfasını kullanabilirsiniz.
        </p>
        <Button type="button" variant="outline" className="gap-2" onClick={() => navigate("/yillik-izin/basin")}>
          <ArrowLeft className="h-4 w-4" />
          Günlük gazete hesaplamasına dön
        </Button>
      </div>
    </div>
  );
}
