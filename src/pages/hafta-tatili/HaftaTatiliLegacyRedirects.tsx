import { Navigate, useParams } from "react-router-dom";

export function LegacyHaftaGemiRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/hafta-tatili/gemi-adami/${id}` : "/hafta-tatili/gemi-adami"} replace />;
}

export function LegacyHaftaBasinRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/hafta-tatili/basin-is/${id}` : "/hafta-tatili/basin-is"} replace />;
}

export function LegacyHaftaStandardRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/hafta-tatili/standard/${id}` : "/hafta-tatili/standard"} replace />;
}
