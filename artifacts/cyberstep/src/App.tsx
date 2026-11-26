import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useRoute, useLocation, Redirect } from "wouter";
import { archivedRedirect } from "./lib/archived-routes";
import type { ReactNode } from "react";
import TedarikZinciri from "./pages/tedarik-zinciri";
import GuvenRozeti from "./pages/guven-rozeti";
import SkorApi from "./pages/skor-api";
import GuvenlikMerkezi from "./pages/guvenlik-merkezi";
import Metodoloji from "./pages/metodoloji";
import TedarikciOnboarding from "./pages/tedarikci-onboarding";
import TprmAnket from "./pages/tprm-anket";
import TprmAksiyon from "./pages/tprm-aksiyon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import SonucPage from "./pages/sonuc";
import AssessmentRunner from "./pages/assessment-runner";
import AssessmentReport, { AssessmentReportById } from "./pages/assessment-report";
import Dashboard from "./pages/dashboard";
import Pricing from "./pages/pricing";
import FullAssessmentRunner from "./pages/full-assessment-runner";
import Payment from "./pages/payment";
import AdminReview from "./pages/admin-review";
import Hakkimizda from "./pages/hakkimizda";
import NedenCyberStep from "./pages/archive/neden-cyberstep-legacy"; // arşivde — /neden-cyberstep → /hakkimizda yönlenir
import Iletisim from "./pages/iletisim";
import Kurumsal from "./pages/kurumsal";
import PartnerPage from "./pages/partner";
import SahteDoküman from "./pages/sahte-dokuman";
import Kvkk from "./pages/kvkk";
import KullanimKosullari from "./pages/kullanim-kosullari";
import GizlilikPolitikasi from "./pages/gizlilik-politikasi";
import VeriVeYapayZeka from "./pages/veri-ve-yapay-zeka";
import CerezPolitikasi from "./pages/cerez-politikasi";

import AdminLogin from "./pages/admin-panel/login";
import WorkspacePicker from "./pages/admin-panel/workspace-picker";
import TenantSettingsPage from "./pages/admin-panel/tenant-settings";
import AdminDashboard from "./pages/admin-panel/index";
import AdminSettings from "./pages/admin-panel/settings";
import AdminCronAyarlari from "./pages/admin-panel/cron-ayarlari";
import AdminCVE from "./pages/admin-panel/cve";
import CVEDetailPage from "./pages/cve-detail";
import AdminBulletin from "./pages/admin-panel/bulletin";
import BulletinArchivePage from "./pages/bulten-arsiv";
import BulletinDetailPage from "./pages/bulten-detail";
import HaftalikDigestPage from "./pages/haftalik-digest";
import AdminPayments from "./pages/admin-panel/payments";
import AdminTotp from "./pages/admin-panel/totp";
import AdminBlog from "./pages/admin-panel/blog";
import AdminKvkkLead from "./pages/admin-panel/kvkk-lead";
import AdminDailyDashboard from "./pages/admin-panel/daily-dashboard";
import AdminYoneticiler from "./pages/admin-panel/yoneticiler";
import AdminMusteriler from "./pages/admin-panel/musteriler";
import AdminDomainTaramalar from "./pages/admin-panel/domain-taramalar";
import AdminEntegrasyonlar from "./pages/admin-panel/entegrasyonlar";
import AdminEmailTemplates from "./pages/admin-panel/email-templates";
import AdminEmailNotifications from "./pages/admin-panel/email-notifications";
import AdminGuvenRozetiAdmin from "./pages/admin-panel/guven-rozeti-admin";
import { AdminLayout } from "./components/admin-layout";
import BlogList from "./pages/blog";
import BlogPost from "./pages/blog-post";
import Haberler from "./pages/haberler";

import VerifyPage from "./pages/verify";
import DemoPage from "./pages/demo";
import DomainScan from "./pages/domain-scan";
import CustomerLogin from "./pages/customer/login";
import CustomerRegister from "./pages/customer/register";
import CustomerTotpSetup from "./pages/customer/totp-setup";
import CustomerAccount from "./pages/customer/account";
import CustomerReports from "./pages/customer/reports";
import CustomerIntegrations from "./pages/customer/integrations";
import PlatformSaglik from "./pages/admin-panel/platform-saglik";
import SifreSifirla from "./pages/customer/sifre-sifirla";
import TumAraclar from "./pages/tum-araclar";
import EnterpriseProspects from "./pages/admin-panel/enterprise/prospects";
import EnterprisePipeline from "./pages/admin-panel/enterprise/pipeline";
import EnterpriseContracts from "./pages/admin-panel/enterprise/contracts";
import SektorRaporu from "./pages/sektor-raporu";
import AdminFaturalar from "./pages/admin-panel/faturalar";
import AdminGelir from "./pages/admin-panel/gelir";
import AdminGorevler from "./pages/admin-panel/gorevler";
import Musteri360 from "./pages/admin-panel/musteri-360";
import AdminManuelTetikle from "./pages/admin-panel/manuel-tetikle";
import HesabimFaturalar from "./pages/hesabim/faturalar";
import OnboardingWizard from "./pages/admin-panel/onboarding-wizard";
import AdminAiCosts from "./pages/admin-panel/ai-costs";
import AdminApprovals from "./pages/admin-panel/approvals";
import TedarikciPortfoyu from "./pages/hesabim/tedarikci-portfoyu";
import HesabimDestek from "./pages/hesabim/destek";
import YenilePage from "./pages/yenile";
import NpsPage from "./pages/nps";
import StatusPage from "./pages/status";
import AdminStatusPage from "./pages/admin-panel/status";
import AdminLeadDiscovery from "./pages/admin-panel/lead-discovery";
import AdminSourceDashboard from "./pages/admin-panel/source-dashboard";
import AdminEndeksRaporu from "./pages/admin-panel/endeks-raporu";
import SslKontrol from "./pages/araclar/ssl-kontrol";
import DomainGuvenlikTaramasi from "./pages/araclar/domain-guvenlik-taramasi";
import DmarcKontrol from "./pages/araclar/dmarc-kontrol";
import SubdomainTarayici from "./pages/araclar/subdomain-tarayici";

import { Layout } from "./components/layout";
import { CookieBanner } from "./components/cookie-banner";
import { WhiteLabelProvider } from "./contexts/white-label-context";
import { LanguageProvider } from "./contexts/language-context";
import { ThemeProvider } from "next-themes";
import { TenantProvider } from "./contexts/tenant-context";
import { CartProvider } from "./contexts/cart-context";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function AdminAssessmentReport() {
  const [, params] = useRoute("/panel/degerlendirmeler/:id/rapor");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id || "0", 10);
  return (
    <AdminLayout title="Değerlendirme Raporu" description={`#${id} numaralı değerlendirme`}>
      <div className="mb-4">
        <button
          onClick={() => navigate("/panel/degerlendirmeler")}
          className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
        >
          ← Değerlendirmelere Dön
        </button>
      </div>
      <AssessmentReportById id={id} />
    </AdminLayout>
  );
}

// Arşivlenen bölümlere gelen ziyaretçileri yönlendirir (bkz. lib/archived-routes.ts).
function ArchivedRouteGuard({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const to = archivedRedirect(location);
  if (to) return <Redirect to={to} replace />;
  return <>{children}</>;
}

function Router() {
  return (
    <ArchivedRouteGuard>
    <Switch>
      {/* White label routes (wrapped with WhiteLabelProvider + own Layout) */}

      {/* Customer auth (full-page, no shared header/footer) */}
      <Route path="/giris" component={CustomerLogin} />
      <Route path="/sifre-sifirla" component={SifreSifirla} />
      <Route path="/kayit" component={CustomerRegister} />
      <Route path="/totp-kurulum" component={CustomerTotpSetup} />
      <Route path="/hesabim" component={CustomerAccount} />
      <Route path="/raporlarim" component={CustomerReports} />
      <Route path="/entegrasyonlarim" component={CustomerIntegrations} />
      <Route path="/hesabim/faturalar" component={HesabimFaturalar} />
      <Route path="/hesabim/destek" component={HesabimDestek} />
      <Route path="/hesabim/tedarikci-portfoyu" component={TedarikciPortfoyu} />
      <Route path="/yenile" component={YenilePage} />
      <Route path="/hesabim/yonetim-raporu" component={CustomerReports} />
      <Route path="/nps/:token" component={NpsPage} />
      <Route path="/status" component={StatusPage} />

      {/* AI Phishing rapor — full-page (Layout kendi içinde) */}

      {/* AI Güvenlik Değerlendirmesi — full-page akış (layout yok) */}

      {/* Admin panel (full-page, no shared header/footer) */}
      <Route path="/panel/giris" component={AdminLogin} />
      <Route path="/panel/workspace" component={WorkspacePicker} />
      <Route path="/panel/workspace-ayarlari" component={TenantSettingsPage} />
      <Route path="/panel/entegrasyonlar" component={AdminEntegrasyonlar} />
      <Route path="/panel/ayarlar" component={AdminSettings} />
      <Route path="/panel/cron-ayarlari" component={AdminCronAyarlari} />
      <Route path="/panel/cve" component={AdminCVE} />
      <Route path="/cve/:cveId" component={CVEDetailPage} />
      <Route path="/panel/bulletin" component={AdminBulletin} />
      <Route path="/bulten/arsiv" component={BulletinArchivePage} />
      <Route path="/bulten/:slug" component={BulletinDetailPage} />
      <Route path="/haftalik-digest" component={HaftalikDigestPage} />
      <Route path="/panel/odemeler" component={AdminPayments} />
      <Route path="/panel/totp" component={AdminTotp} />
      <Route path="/panel/blog" component={AdminBlog} />
      <Route path="/panel/kvkk-lead" component={AdminKvkkLead} />
      <Route path="/panel/yoneticiler" component={AdminYoneticiler} />
      <Route path="/panel/musteriler" component={AdminMusteriler} />
      <Route path="/panel/domain-taramalar" component={AdminDomainTaramalar} />
      <Route path="/panel/email-sablonlari" component={AdminEmailTemplates} />
      <Route path="/panel/bildirimler" component={AdminEmailNotifications} />
      <Route path="/panel/guven-rozeti-admin" component={AdminGuvenRozetiAdmin} />
      <Route path="/panel/platform-saglik" component={PlatformSaglik} />
      <Route path="/panel/enterprise/prospects" component={EnterpriseProspects} />
      <Route path="/panel/enterprise/pipeline" component={EnterprisePipeline} />
      <Route path="/panel/enterprise/contracts" component={EnterpriseContracts} />
      <Route path="/panel/faturalar" component={AdminFaturalar} />
      <Route path="/panel/gelir" component={AdminGelir} />
      <Route path="/panel/gorevler" component={AdminGorevler} />
      <Route path="/panel/musteriler/:id" component={Musteri360} />
      <Route path="/panel/manuel-tetikle" component={AdminManuelTetikle} />
      <Route path="/panel/lead-discovery" component={AdminLeadDiscovery} />
      <Route path="/panel/source-dashboard" component={AdminSourceDashboard} />
      <Route path="/panel/endeks-raporu" component={AdminEndeksRaporu} />
      <Route path="/panel/gunluk-ozet" component={AdminDailyDashboard} />
      <Route path="/panel/status" component={AdminStatusPage} />
      <Route path="/panel/musteriler/:id/onboarding" component={OnboardingWizard} />
      <Route path="/panel/ai-costs" component={AdminAiCosts} />
      <Route path="/panel/approvals" component={AdminApprovals} />
      <Route path="/panel" component={AdminDashboard} />

      {/* Partner portal */}

      {/* Public standalone pages — no shared Layout */}
      <Route path="/sonuc/:id" component={SonucPage} />

      {/* All other routes use shared Layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/fiyatlar" component={Pricing} />
            <Route path="/hakkimizda" component={Hakkimizda} />
            <Route path="/kurumsal" component={Kurumsal} />
            <Route path="/partner" component={PartnerPage} />
            <Route path="/sahte-dokuman" component={SahteDoküman} />
            <Route path="/iletisim" component={Iletisim} />
            <Route path="/kvkk" component={Kvkk} />
            <Route path="/kullanim-kosullari" component={KullanimKosullari} />
            <Route path="/gizlilik-politikasi" component={GizlilikPolitikasi} />
            <Route path="/veri-ve-yapay-zeka" component={VeriVeYapayZeka} />
            <Route path="/cerez-politikasi" component={CerezPolitikasi} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/blog" component={BlogList} />
            <Route path="/haberler" component={Haberler} />
            <Route path="/assessment/full/:id" component={FullAssessmentRunner} />
            <Route path="/payment/:id" component={Payment} />
            <Route path="/assessment/:id/report" component={AssessmentReport} />
            <Route path="/assessment/:id" component={AssessmentRunner} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/admin/review/:token" component={AdminReview} />
            <Route path="/verify/:token" component={VerifyPage} />
            <Route path="/domain-tarama" component={DomainScan} />
            <Route path="/tedarik-zinciri" component={TedarikZinciri} />
            <Route path="/guven-rozeti" component={GuvenRozeti} />
            <Route path="/skor-api" component={SkorApi} />
            <Route path="/guvenlik-merkezi" component={GuvenlikMerkezi} />
            <Route path="/metodoloji" component={Metodoloji} />
            <Route path="/tedarikci-onboarding" component={TedarikciOnboarding} />
            <Route path="/tprm/anket/:token" component={TprmAnket} />
            <Route path="/tprm/aksiyon/:token" component={TprmAksiyon} />
            <Route path="/araclar/ssl-kontrol" component={SslKontrol} />
            <Route path="/araclar/domain-guvenlik-taramasi" component={DomainGuvenlikTaramasi} />
            <Route path="/araclar/dmarc-kontrol" component={DmarcKontrol} />
            <Route path="/araclar/subdomain-taray%C4%B1c%C4%B1" component={SubdomainTarayici} />
            <Route path="/araclar/subdomain-tarayıcı" component={SubdomainTarayici} />
            <Route path="/araclar" component={TumAraclar} />
            <Route path="/sektor-raporu" component={SektorRaporu} />
            <Route path="/demo" component={DemoPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
    </ArchivedRouteGuard>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <TenantProvider>
                <CartProvider>
                  <ScrollToTop />
                  <Router />
                </CartProvider>
              </TenantProvider>
            </WouterRouter>
            <CookieBanner />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
