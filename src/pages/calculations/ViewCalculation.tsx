import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getRouteForCalculationType } from "./calculationRouter";
import { apiClient } from "@/utils/apiClient";

export default function ViewCalculation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [calculation, setCalculation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const hasNavigated = useRef(false);

  const getRoute = (calc: Record<string, unknown>) => {
    const d = (calc.data || {}) as Record<string, unknown>;
    const savedRoute = (d.route || (d.form as Record<string, unknown>)?.route) as string | undefined;
    if (savedRoute) return String(savedRoute).toLowerCase();
    const calcType = (calc.type || calc.calculation_type || "") as string;
    return getRouteForCalculationType(calcType, d);
  };

  useEffect(() => {
    if (!id) { navigate("/profile/saved-calculations"); return; }
    apiClient(`/api/saved-cases/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setCalculation(data))
      .catch(() => navigate("/profile/saved-calculations"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (calculation && !loading && id && !hasNavigated.current) {
      hasNavigated.current = true;
      const route = getRoute(calculation);
      navigate(`${route}/${id}?view=true`, { replace: true });
    }
  }, [calculation, loading, id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        {calculation ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">Yönlendiriliyor...</p>
          </>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Hesaplama bulunamadı</p>
            <button onClick={() => navigate("/profile/saved-calculations")} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
              <ArrowLeft className="h-4 w-4" />
              Geri Dön
            </button>
          </>
        )}
      </div>
    </div>
  );
}
