import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/context/ToastContext";
import AppShell from "@/layout/AppShell";
import GlobalCalculationTools from "@/components/GlobalCalculationTools";
import ChatWidget from "@/components/chat/ChatWidget";
import AdminRoute from "@/components/auth/AdminRoute";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import ProfessionalLicenseActivation from "@/pages/ProfessionalLicenseActivation";
import StartPage from "@/pages/StartPage";
import ViewCalculation from "@/pages/calculations/ViewCalculation";
import Vardiya12Page from "@/pages/fazla-mesai/vardiya12/Vardiya12Page";
import BasinIsFazlaMesaiPage from "@/pages/fazla-mesai/basin-is/BasinIsFazlaMesaiPage";
import FazlaSurelerleCalismaPage from "@/pages/fazla-mesai/fazla-surelerle-calisma/FazlaSurelerleCalismaPage";
import GemiFullCrew24Page from "@/pages/fazla-mesai/gemi-7-24/GemiFullCrew24Page";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/admin/AdminPage";
import AdminAccessDeniedPage from "@/pages/admin/AdminAccessDeniedPage";
import AdminPlaceholderPage from "@/pages/admin/AdminPlaceholderPage";
import AdminControlCenter from "@/pages/admin/AdminControlCenter";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminCreateUserPage from "@/pages/admin/AdminCreateUserPage";
import AdminUserDetailPage from "@/pages/admin/AdminUserDetailPage";
import AdminUserEditPage from "@/pages/admin/AdminUserEditPage";
import AdminSubscriptionsPage from "@/pages/admin/AdminSubscriptionsPage";
import AdminTicketsPage from "@/pages/admin/AdminTicketsPage";
import LogsPage from "@/pages/admin/LogsPage";
import AdminLicensesPage from "@/pages/admin/AdminLicensesPage";
import AdminTenantAnalytics from "@/pages/admin/AdminTenantAnalytics";
import AdminEmailNotifications from "@/pages/admin/AdminEmailNotifications";
import AdminAuditLogPage from "@/pages/admin/AdminAuditLogPage";
import DemoConversionPage from "@/pages/admin/DemoConversionPage";
import AdminChatPage from "@/pages/admin/AdminChatPage";
import DeviceManagementPage from "@/pages/admin/DeviceManagementPage";
import AdminFeedbackPage from "@/pages/admin/AdminFeedbackPage";
import DavaciUcretiPage from "@/pages/davaci-ucreti/DavaciUcretiPage";
import Kidem30Page from "@/pages/kidem-tazminati/Kidem30Page";
import KidemGemiPage from "@/pages/kidem-tazminati/KidemGemiPage";
import KidemMevsimlikPage from "@/pages/kidem-tazminati/KidemMevsimlikPage";
import KidemBasinPage from "@/pages/kidem-tazminati/KidemBasinPage";
import KidemSelectionPage from "@/pages/kidem-tazminati/KidemSelectionPage";
import KidemBorclarPage from "@/pages/kidem-tazminati/KidemBorclarPage";
import KidemKismiSureliPage from "@/pages/kidem-tazminati/KidemKismiSureliPage";
import KidemBelirliSureliPage from "@/pages/kidem-tazminati/KidemBelirliSureliPage";
import Ihbar30Page from "@/pages/ihbar-tazminati/Ihbar30Page";
import IhbarBorclarPage from "@/pages/ihbar-tazminati/IhbarBorclarPage";
import IhbarGemiPage from "@/pages/ihbar-tazminati/IhbarGemiPage";
import IhbarMevsimPage from "@/pages/ihbar-tazminati/IhbarMevsimPage";
import IhbarBasinPage from "@/pages/ihbar-tazminati/IhbarBasinPage";
import IhbarKismiPage from "@/pages/ihbar-tazminati/IhbarKismiPage";
import IhbarBelirliPage from "@/pages/ihbar-tazminati/IhbarBelirliPage";
import IhbarSelectionPage from "@/pages/ihbar-tazminati/IhbarSelectionPage";
import StandartFazlaMesaiPage from "@/pages/fazla-mesai/standart/StandartFazlaMesaiPage";
import TanikliStandartPage from "@/pages/fazla-mesai/tanikli-standart/TanikliStandartPage";
import HaftalikKarmaPage from "@/pages/fazla-mesai/haftalik-karma/HaftalikKarmaPage";
import DonemselPage from "@/pages/fazla-mesai/donemsel/DonemselPage";
import YeraltiIsciPage from "@/pages/fazla-mesai/yeralti-isci/YeraltiIsciPage";
import Vardiya24_48Page from "@/pages/fazla-mesai/vardiya-24-48/Vardiya24_48Page";
import GemiAdamiPage from "@/pages/fazla-mesai/gemi-adami/GemiAdamiPage";
import EvIsciPage from "@/pages/fazla-mesai/ev-isci/EvIsciPage";
import FazlaMesaiSelectionPage from "@/pages/fazla-mesai/FazlaMesaiSelectionPage";
import YillikIzinSelectionPage from "@/pages/yillik-izin/YillikIzinSelectionPage";
import YillikIzinStandartPage from "@/pages/yillik-izin/YillikIzinStandartPage";
import YillikIzinBorclarPage from "@/pages/yillik-izin/YillikIzinBorclarPage";
import YillikIzinGemiPage from "@/pages/yillik-izin/YillikIzinGemiPage";
import YillikIzinMevsimPage from "@/pages/yillik-izin/YillikIzinMevsimPage";
import YillikIzinBasinPage from "@/pages/yillik-izin/YillikIzinBasinPage";
import YillikIzinBasinGunlukOlmayanPage from "@/pages/yillik-izin/YillikIzinBasinGunlukOlmayanPage";
import YillikIzinKismiPage from "@/pages/yillik-izin/YillikIzinKismiPage";
import YillikIzinBelirliPage from "@/pages/yillik-izin/YillikIzinBelirliPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import NotificationsPage from "@/pages/profile/NotificationsPage";
import PrimAlacagiPage from "@/pages/prim-alacagi/PrimAlacagiPage";
import KotuNiyetTazminatiPage from "@/pages/kotu-niyet-tazminati/KotuNiyetTazminatiPage";
import HaksizFesihTazminatiPage from "@/pages/haksiz-fesih-tazminati/HaksizFesihTazminatiPage";
import AyrimcilikTazminatiPage from "@/pages/ayrimcilik-tazminati/AyrimcilikTazminatiPage";
import IseAlmamaTazminatiPage from "@/pages/ise-almama-tazminati/IseAlmamaTazminatiPage";
import BostaGecenSureUcretiPage from "@/pages/bosta-gecen-sure-ucreti/BostaGecenSureUcretiPage";
import BakiyeUcretAlacagiPage from "@/pages/bakiye-ucret-alacagi/BakiyeUcretAlacagiPage";
import UcretAlacagiPage from "@/pages/ucret-alacagi/UcretAlacagiPage";
import IsAramaIzniUcretiPage from "@/pages/is-arama-izni-ucreti/IsAramaIzniUcretiPage";
import UbgtSelectionPage from "@/pages/ubgt-alacagi/UbgtSelectionPage";
import UbgtStandartPage from "@/pages/ubgt-alacagi/UbgtStandartPage";
import UbgtBilirkisiPage from "@/pages/ubgt-alacagi/UbgtBilirkisiPage";
import HaftaTatiliSelectionPage from "@/pages/hafta-tatili/HaftaTatiliSelectionPage";
import HaftaTatiliStandardPage from "@/pages/hafta-tatili/HaftaTatiliStandardPage";
import HaftaTatiliGemiPage from "@/pages/hafta-tatili/HaftaTatiliGemiPage";
import HaftaTatiliBasinPage from "@/pages/hafta-tatili/HaftaTatiliBasinPage";
import {
  InternalHaftaBasinToBasinIsRedirect,
  InternalHaftaGemiToGemiAdamiRedirect,
  InternalHaftaStandartToStandardRedirect,
  LegacyHaftaBasinRedirect,
  LegacyHaftaGemiRedirect,
  LegacyHaftaStandardRedirect,
} from "@/pages/hafta-tatili/HaftaTatiliLegacyRedirects";

function App() {
  const location = useLocation();
  const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/unsubscribe", "/change-password", "/professional-license-activation"];
  const isPublicPage = PUBLIC_PATHS.includes(location.pathname) || location.pathname.startsWith("/test-");

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/professional-license-activation" element={<ProfessionalLicenseActivation />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="panel/start" element={<StartPage />} />
        <Route path="calculations/view/:id" element={<ViewCalculation />} />
        <Route path="davaci-ucreti" element={<DavaciUcretiPage />} />
        <Route path="davaci-ucreti/:id" element={<DavaciUcretiPage />} />
        <Route path="prim-alacagi" element={<PrimAlacagiPage />} />
        <Route path="prim-alacagi/:id" element={<PrimAlacagiPage />} />
        <Route path="bakiye-ucret-alacagi" element={<BakiyeUcretAlacagiPage />} />
        <Route path="bakiye-ucret-alacagi/:id" element={<BakiyeUcretAlacagiPage />} />
        <Route path="ucret-alacagi" element={<UcretAlacagiPage />} />
        <Route path="ucret-alacagi/:id" element={<UcretAlacagiPage />} />
        <Route path="is-arama-izni-ucreti" element={<IsAramaIzniUcretiPage />} />
        <Route path="is-arama-izni-ucreti/:id" element={<IsAramaIzniUcretiPage />} />
        <Route path="ubgt" element={<UbgtSelectionPage />} />
        <Route path="ubgt-alacagi" element={<UbgtStandartPage />} />
        <Route path="ubgt-alacagi/:id" element={<UbgtStandartPage />} />
        <Route path="ubgt-bilirkisi" element={<UbgtBilirkisiPage />} />
        <Route path="ubgt-bilirkisi/:id" element={<UbgtBilirkisiPage />} />
        <Route path="hafta-tatili-alacagi" element={<Navigate to="/hafta-tatili" replace />} />
        <Route path="hafta-tatili-alacagi/standard" element={<Navigate to="/hafta-tatili/standard" replace />} />
        <Route path="hafta-tatili-alacagi/standard/:id" element={<LegacyHaftaStandardRedirect />} />
        <Route path="hafta-tatili-alacagi/standart" element={<Navigate to="/hafta-tatili/standard" replace />} />
        <Route path="hafta-tatili-alacagi/standart/:id" element={<LegacyHaftaStandardRedirect />} />
        <Route path="hafta-tatili-alacagi/gemi-adami" element={<Navigate to="/hafta-tatili/gemi-adami" replace />} />
        <Route path="hafta-tatili-alacagi/gemi-adami/:id" element={<LegacyHaftaGemiRedirect />} />
        <Route path="hafta-tatili-alacagi/basin-is" element={<Navigate to="/hafta-tatili/basin-is" replace />} />
        <Route path="hafta-tatili-alacagi/basin-is/:id" element={<LegacyHaftaBasinRedirect />} />
        <Route path="hafta-tatili" element={<Outlet />}>
          <Route index element={<HaftaTatiliSelectionPage />} />
          <Route path="standard" element={<HaftaTatiliStandardPage />} />
          <Route path="standard/:id" element={<HaftaTatiliStandardPage />} />
          <Route path="standart" element={<Navigate to="/hafta-tatili/standard" replace />} />
          <Route path="standart/:id" element={<Navigate to="/hafta-tatili/standard/:id" replace />} />
          <Route path="gemi-adami" element={<HaftaTatiliGemiPage />} />
          <Route path="gemi-adami/:id" element={<HaftaTatiliGemiPage />} />
          <Route path="gemi" element={<Navigate to="/hafta-tatili/gemi-adami" replace />} />
          <Route path="gemi/:id" element={<Navigate to="/hafta-tatili/gemi-adami/:id" replace />} />
          <Route path="basin-is" element={<HaftaTatiliBasinPage />} />
          <Route path="basin-is/:id" element={<HaftaTatiliBasinPage />} />
          <Route path="basin" element={<Navigate to="/hafta-tatili/basin-is" replace />} />
          <Route path="basin/:id" element={<Navigate to="/hafta-tatili/basin-is/:id" replace />} />
        </Route>
        {/* Kıdem alt sayfaları: tek segmentli çocuk rotaları — /kidem-tazminati/kismi-sureli vb. RR7 ile güvenilir eşleşme */}
        <Route path="kidem-tazminati" element={<Outlet />}>
          <Route index element={<KidemSelectionPage />} />
          <Route path="30isci" element={<Kidem30Page />} />
          <Route path="30isci/:id" element={<Kidem30Page />} />
          <Route path="borclar" element={<KidemBorclarPage />} />
          <Route path="borclar/:id" element={<KidemBorclarPage />} />
          <Route path="gemi" element={<KidemGemiPage />} />
          <Route path="gemi/:id" element={<KidemGemiPage />} />
          <Route path="mevsimlik" element={<KidemMevsimlikPage />} />
          <Route path="mevsimlik/:id" element={<KidemMevsimlikPage />} />
          <Route path="basin" element={<KidemBasinPage />} />
          <Route path="basin/:id" element={<KidemBasinPage />} />
          <Route path="kismi-sureli" element={<KidemKismiSureliPage />} />
          <Route path="kismi-sureli/:id" element={<KidemKismiSureliPage />} />
          <Route path="belirli-sureli" element={<KidemBelirliSureliPage />} />
          <Route path="belirli-sureli/:id" element={<KidemBelirliSureliPage />} />
        </Route>
        <Route path="ihbar-tazminati" element={<Outlet />}>
          <Route index element={<IhbarSelectionPage />} />
          <Route path="30isci" element={<Ihbar30Page />} />
          <Route path="30isci/:id" element={<Ihbar30Page />} />
          <Route path="borclar" element={<IhbarBorclarPage />} />
          <Route path="borclar/:id" element={<IhbarBorclarPage />} />
          <Route path="gemi" element={<IhbarGemiPage />} />
          <Route path="gemi/:id" element={<IhbarGemiPage />} />
          <Route path="mevsim" element={<IhbarMevsimPage />} />
          <Route path="mevsim/:id" element={<IhbarMevsimPage />} />
          <Route path="basin" element={<IhbarBasinPage />} />
          <Route path="basin/:id" element={<IhbarBasinPage />} />
          <Route path="kismi" element={<IhbarKismiPage />} />
          <Route path="kismi/:id" element={<IhbarKismiPage />} />
          <Route path="belirli" element={<IhbarBelirliPage />} />
          <Route path="belirli/:id" element={<IhbarBelirliPage />} />
        </Route>
        <Route path="kotu-niyet-tazminati" element={<KotuNiyetTazminatiPage />} />
        <Route path="kotu-niyet-tazminati/:id" element={<KotuNiyetTazminatiPage />} />
        <Route path="bosta-gecen-sure-ucreti" element={<BostaGecenSureUcretiPage />} />
        <Route path="bosta-gecen-sure-ucreti/:id" element={<BostaGecenSureUcretiPage />} />
        <Route path="ise-almama-tazminati" element={<IseAlmamaTazminatiPage />} />
        <Route path="ise-almama-tazminati/:id" element={<IseAlmamaTazminatiPage />} />
        <Route path="ayrimcilik-tazminati" element={<AyrimcilikTazminatiPage />} />
        <Route path="ayrimcilik-tazminati/:id" element={<AyrimcilikTazminatiPage />} />
        <Route path="haksiz-fesih-tazminati" element={<HaksizFesihTazminatiPage />} />
        <Route path="haksiz-fesih-tazminati/:id" element={<HaksizFesihTazminatiPage />} />
        <Route path="yillik-izin" element={<Outlet />}>
          <Route index element={<YillikIzinSelectionPage />} />
          <Route path="standart" element={<YillikIzinStandartPage />} />
          <Route path="standart/:id" element={<YillikIzinStandartPage />} />
          <Route path="borclar" element={<YillikIzinBorclarPage />} />
          <Route path="borclar/:id" element={<YillikIzinBorclarPage />} />
          <Route path="gemi" element={<YillikIzinGemiPage />} />
          <Route path="gemi/:id" element={<YillikIzinGemiPage />} />
          <Route path="mevsim" element={<YillikIzinMevsimPage />} />
          <Route path="mevsim/:id" element={<YillikIzinMevsimPage />} />
          <Route path="basin/gunluk-olmayan" element={<YillikIzinBasinGunlukOlmayanPage />} />
          <Route path="basin" element={<YillikIzinBasinPage />} />
          <Route path="basin/:id" element={<YillikIzinBasinPage />} />
          <Route path="kismi" element={<YillikIzinKismiPage />} />
          <Route path="kismi/:id" element={<YillikIzinKismiPage />} />
          <Route path="belirli" element={<YillikIzinBelirliPage />} />
          <Route path="belirli/:id" element={<YillikIzinBelirliPage />} />
        </Route>
        <Route path="fazla-mesai" element={<Outlet />}>
          <Route index element={<FazlaMesaiSelectionPage />} />
          <Route path="standart" element={<StandartFazlaMesaiPage />} />
          <Route path="standart/:id" element={<StandartFazlaMesaiPage />} />
          <Route path="tanikli-standart" element={<TanikliStandartPage />} />
          <Route path="tanikli-standart/:id" element={<TanikliStandartPage />} />
          <Route path="haftalik-karma" element={<HaftalikKarmaPage />} />
          <Route path="haftalik-karma/:id" element={<HaftalikKarmaPage />} />
          <Route path="donemsel" element={<DonemselPage />} />
          <Route path="donemsel/:id" element={<DonemselPage />} />
          <Route path="donemsel-haftalik" element={<DonemselPage />} />
          <Route path="donemsel-haftalik/:id" element={<DonemselPage />} />
          <Route path="yeralti-isci" element={<YeraltiIsciPage />} />
          <Route path="yeralti-isci/:id" element={<YeraltiIsciPage />} />
          <Route path="vardiya-24-48" element={<Vardiya24_48Page />} />
          <Route path="vardiya-24-48/:id" element={<Vardiya24_48Page />} />
          <Route path="gemi-adami" element={<GemiAdamiPage />} />
          <Route path="gemi-adami/:id" element={<GemiAdamiPage />} />
          <Route path="ev" element={<EvIsciPage />} />
          <Route path="vardiya12" element={<Vardiya12Page />} />
          <Route path="vardiya12/:id" element={<Vardiya12Page />} />
          <Route path="basin-is-fazla-mesai" element={<BasinIsFazlaMesaiPage />} />
          <Route path="basin-is-fazla-mesai/:id" element={<BasinIsFazlaMesaiPage />} />
          <Route path="fazla-surelerle-calisma" element={<FazlaSurelerleCalismaPage />} />
          <Route path="fazla-surelerle-calisma/:id" element={<FazlaSurelerleCalismaPage />} />
          <Route path="gemi-7-24" element={<GemiFullCrew24Page />} />
          <Route path="gemi-7-24/:id" element={<GemiFullCrew24Page />} />
        </Route>
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/saved-calculations" element={<ProfilePage />} />
        <Route path="profile/notifications" element={<NotificationsPage />} />
        <Route path="admin-access-denied" element={<AdminAccessDeniedPage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="admin/control-center" element={<AdminRoute><AdminControlCenter /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="admin/users/new" element={<AdminRoute><AdminCreateUserPage /></AdminRoute>} />
        <Route path="admin/users/:id/detail" element={<AdminRoute><AdminUserDetailPage /></AdminRoute>} />
        <Route path="admin/users/:id/edit" element={<AdminRoute><AdminUserEditPage /></AdminRoute>} />
        <Route path="admin/subscriptions" element={<AdminRoute><AdminSubscriptionsPage /></AdminRoute>} />
        <Route path="admin/tickets" element={<AdminRoute><AdminTicketsPage /></AdminRoute>} />
        <Route path="admin/logs" element={<AdminRoute><LogsPage /></AdminRoute>} />
        <Route path="admin/licenses" element={<AdminRoute><AdminLicensesPage /></AdminRoute>} />
        <Route path="admin/analytics" element={<AdminRoute><AdminTenantAnalytics /></AdminRoute>} />
        <Route path="admin/email-notifications" element={<AdminRoute><AdminEmailNotifications /></AdminRoute>} />
        <Route path="admin/audit-logs" element={<AdminRoute><AdminAuditLogPage /></AdminRoute>} />
        <Route path="admin/demo-conversion" element={<AdminRoute><DemoConversionPage /></AdminRoute>} />
        <Route path="admin/chat" element={<AdminRoute><AdminChatPage /></AdminRoute>} />
        <Route path="admin/device-management" element={<AdminRoute><DeviceManagementPage /></AdminRoute>} />
        <Route path="admin/feedback" element={<AdminRoute><AdminFeedbackPage /></AdminRoute>} />
      </Route>
    </Routes>

      {!isPublicPage && <GlobalCalculationTools />}
      {!isPublicPage && <ChatWidget />}
    </>
  );
}

export default App;
