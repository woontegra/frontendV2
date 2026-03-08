import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/context/ToastContext";
import AppShell from "@/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import DavaciUcretiPage from "@/pages/davaci-ucreti/DavaciUcretiPage";
import Kidem30Page from "@/pages/kidem-tazminati/Kidem30Page";
import Ihbar30Page from "@/pages/ihbar-tazminati/Ihbar30Page";
import StandartFazlaMesaiPage from "@/pages/fazla-mesai/standart/StandartFazlaMesaiPage";
import TanikliStandartPage from "@/pages/fazla-mesai/tanikli-standart/TanikliStandartPage";
import ProfilePage from "@/pages/profile/ProfilePage";

function App() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="davaci-ucreti" element={<DavaciUcretiPage />} />
        <Route path="davaci-ucreti/:id" element={<DavaciUcretiPage />} />
        <Route path="kidem-tazminati/30isci" element={<Kidem30Page />} />
        <Route path="kidem-tazminati/30isci/:id" element={<Kidem30Page />} />
        <Route path="ihbar-tazminati/30isci" element={<Ihbar30Page />} />
        <Route path="ihbar-tazminati/30isci/:id" element={<Ihbar30Page />} />
        <Route path="fazla-mesai/standart" element={<StandartFazlaMesaiPage />} />
        <Route path="fazla-mesai/standart/:id" element={<StandartFazlaMesaiPage />} />
        <Route path="fazla-mesai/tanikli-standart" element={<TanikliStandartPage />} />
        <Route path="fazla-mesai/tanikli-standart/:id" element={<TanikliStandartPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/saved-calculations" element={<ProfilePage />} />
      </Route>
    </Routes>
    </>
  );
}

export default App;
