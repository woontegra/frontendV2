import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "@/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import DavaciUcretiPage from "@/pages/davaci-ucreti/DavaciUcretiPage";
import Kidem30Page from "@/pages/kidem-tazminati/Kidem30Page";
import Ihbar30Page from "@/pages/ihbar-tazminati/Ihbar30Page";
import StandartFazlaMesaiPage from "@/pages/fazla-mesai/standart/StandartFazlaMesaiPage";

function App() {
  return (
    <Routes>
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
      </Route>
    </Routes>
  );
}

export default App;
