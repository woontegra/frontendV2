import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

type AdminRouteProps = { children: React.ReactNode };

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user } = useAuth();
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    const tid = localStorage.getItem("tenant_id");
    if (!t) {
      setOk(false);
      setLoading(false);
      return;
    }
    const is1 = tid === "1";
    const ua = user?.role === "admin";
    const ut = (user as { tenantId?: number })?.tenantId;
    setOk(!!(is1 || ua || ut === 1));
    setLoading(false);
  }, [user]);

  if (loading) return <div className="flex justify-center py-20 text-gray-500">Yükleniyor...</div>;
  if (!localStorage.getItem("access_token")) return <Navigate to="/login" replace />;
  if (!ok) return <Navigate to="/admin-access-denied" replace />;
  return <>{children}</>;
}
