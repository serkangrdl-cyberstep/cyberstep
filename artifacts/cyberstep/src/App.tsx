import { Switch, Route, Router as WouterRouter, useRoute, useLocation } from "wouter";
import KvkkDpa from "./pages/kvkk-dpa";
import SiberPanik from "./pages/siber-panik";
import KvkkVerbis from "./pages/kvkk-verbis";
import M365Denetim from "./pages/m365-denetim";
import SiberSigorta from "./pages/siber-sigorta";
import KepRehberi from "./pages/kep-rehberi";
import ErpTarama from "./pages/erp-tarama";
import SektorelKiyaslama from "./pages/sektorel-kiyaslama";
import KvkkCezaSim from "./pages/kvkk-ceza-sim";
import PhishingSim from "./pages/phishing-sim";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import AssessmentStart from "./pages/assessment-start";
import AssessmentRunner from "./pages/assessment-runner";
import AssessmentReport, { AssessmentReportById } from "./pages/assessment-report";
import Dashboard from "./pages/dashboard";
import Pricing from "./pages/pricing";
import FullAssessmentStart from "./pages/full-assessment-start";
import FullAssessmentRunner from "./pages/full-assessment-runner";
import Payment from "./pages/payment";
import AdminReview from "./pages/admin-review";
import Hakkimizda from "./pages/hakkimizda";
import Iletisim from "./pages/iletisim";
import Kvkk from "./pages/kvkk";
import KullanimKosullari from "./pages/kullanim-kosullari";
import GizlilikPolitikasi from "./pages/gizlilik-politikasi";
import CerezPolitikasi from "./pages/cerez-politikasi";

import AdminLogin from "./pages/admin-panel/login";
import WorkspacePicker from "./pages/admin-panel/workspace-picker";
import TenantSettingsPage from "./pages/admin-panel/tenant-settings";
import AdminDashboard from "./pages/admin-panel/index";
import AdminSettings from "./pages/admin-panel/settings";
import AdminPricing from "./pages/admin-panel/pricing";
import AdminAssessments from "./pages/admin-panel/assessments";
import AdminPayments from "./pages/admin-panel/payments";
import AdminQuestions from "./pages/admin-panel/questions";
import AdminTotp from "./pages/admin-panel/totp";
import AdminDanismanlik from "./pages/admin-panel/danismanlik";
import AdminPartnerlar from "./pages/admin-panel/partnerlar";
import AdminWhitelabel from "./pages/admin-panel/whitelabel";
import AdminBlog from "./pages/admin-panel/blog";
import AdminSosyalMedya from "./pages/admin-panel/sosyal-medya";
import AdminSpecialMessages from "./pages/admin-panel/special-messages";
import AdminMusteriler from "./pages/admin-panel/musteriler";
import AdminDomainTaramalar from "./pages/admin-panel/domain-taramalar";
import AdminIsrDashboard from "./pages/admin-panel/isr/index";
import AdminIsrDeal from "./pages/admin-panel/isr/deal";
import AdminIsrVendors from "./pages/admin-panel/isr/vendors";
import AdminIsrKurallar from "./pages/admin-panel/isr/kurallar";
import AdminIsrMusteriler from "./pages/admin-panel/isr/musteriler";
import AdminIsrMusteri360 from "./pages/admin-panel/isr/musteri-360";
import AdminEmailTemplates from "./pages/admin-panel/email-templates";
import AdminEmailNotifications from "./pages/admin-panel/email-notifications";
import AdminIsOrtaklari from "./pages/admin-panel/is-ortaklari";
import AdminIsPaketleri from "./pages/admin-panel/is-paketleri";
import AdminRozetAvantajlari from "./pages/admin-panel/rozet-avantajlari";
import PartnerLogin from "./pages/partner/login";
import PartnerDashboard from "./pages/partner/dashboard";
import { AdminLayout } from "./components/admin-layout";
import BlogList from "./pages/blog";
import BlogPost from "./pages/blog-post";

import VerifyPage from "./pages/verify";
import DomainScan from "./pages/domain-scan";
import SizintiIzleyici from "./pages/sizinti-izleyici";
import CustomerLogin from "./pages/customer/login";
import CustomerRegister from "./pages/customer/register";
import CustomerTotpSetup from "./pages/customer/totp-setup";
import CustomerAccount from "./pages/customer/account";
import CustomerReports from "./pages/customer/reports";
import SifreSifirla from "./pages/customer/sifre-sifirla";

import { Layout } from "./components/layout";
import { CookieBanner } from "./components/cookie-banner";
import { WhiteLabelProvider } from "./contexts/white-label-context";
import { LanguageProvider } from "./contexts/language-context";
import { ThemeProvider } from "next-themes";
import { TenantProvider } from "./contexts/tenant-context";

const queryClient = new QueryClient();

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

function WhiteLabelRouter() {
  const [, params] = useRoute("/w/:slug/*?");
  const slug = params?.slug ?? "";

  return (
    <WhiteLabelProvider slug={slug}>
      <Layout>
        <Switch>
          <Route path="/w/:slug/assessment/start" component={AssessmentStart} />
          <Route path="/w/:slug/assessment/:id/report" component={AssessmentReport} />
          <Route path="/w/:slug/assessment/:id" component={AssessmentRunner} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </WhiteLabelProvider>
  );
}

function Router() {
  return (
    <Switch>
      {/* White label routes (wrapped with WhiteLabelProvider + own Layout) */}
      <Route path="/w/:slug/*?" component={WhiteLabelRouter} />

      {/* Customer auth (full-page, no shared header/footer) */}
      <Route path="/giris" component={CustomerLogin} />
      <Route path="/sifre-sifirla" component={SifreSifirla} />
      <Route path="/kayit" component={CustomerRegister} />
      <Route path="/totp-kurulum" component={CustomerTotpSetup} />
      <Route path="/hesabim" component={CustomerAccount} />
      <Route path="/raporlarim" component={CustomerReports} />

      {/* Admin panel (full-page, no shared header/footer) */}
      <Route path="/panel/giris" component={AdminLogin} />
      <Route path="/panel/workspace" component={WorkspacePicker} />
      <Route path="/panel/workspace-ayarlari" component={TenantSettingsPage} />
      <Route path="/panel/ayarlar" component={AdminSettings} />
      <Route path="/panel/fiyatlar" component={AdminPricing} />
      <Route path="/panel/degerlendirmeler/:id/rapor" component={AdminAssessmentReport} />
      <Route path="/panel/degerlendirmeler" component={AdminAssessments} />
      <Route path="/panel/odemeler" component={AdminPayments} />
      <Route path="/panel/sorular" component={AdminQuestions} />
      <Route path="/panel/totp" component={AdminTotp} />
      <Route path="/panel/danismanlik" component={AdminDanismanlik} />
      <Route path="/panel/partnerlar" component={AdminPartnerlar} />
      <Route path="/panel/whitelabel" component={AdminWhitelabel} />
      <Route path="/panel/blog" component={AdminBlog} />
      <Route path="/panel/ozel-gunler" component={AdminSpecialMessages} />
      <Route path="/panel/sosyal-medya" component={AdminSosyalMedya} />
      <Route path="/panel/musteriler" component={AdminMusteriler} />
      <Route path="/panel/domain-taramalar" component={AdminDomainTaramalar} />
      <Route path="/panel/isr/vendors" component={AdminIsrVendors} />
      <Route path="/panel/isr/kurallar" component={AdminIsrKurallar} />
      <Route path="/panel/isr/musteriler" component={AdminIsrMusteriler} />
      <Route path="/panel/isr/musteri/:id" component={AdminIsrMusteri360} />
      <Route path="/panel/isr/deal/:id" component={AdminIsrDeal} />
      <Route path="/panel/isr" component={AdminIsrDashboard} />
      <Route path="/panel/email-sablonlari" component={AdminEmailTemplates} />
      <Route path="/panel/bildirimler" component={AdminEmailNotifications} />
      <Route path="/panel/rozet-avantajlari" component={AdminRozetAvantajlari} />
      <Route path="/panel/is-ortaklari" component={AdminIsOrtaklari} />
      <Route path="/panel/is-paketleri" component={AdminIsPaketleri} />
      <Route path="/panel" component={AdminDashboard} />

      {/* Partner portal */}
      <Route path="/ortak/giris" component={PartnerLogin} />
      <Route path="/ortak" component={PartnerDashboard} />

      {/* All other routes use shared Layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/fiyatlar" component={Pricing} />
            <Route path="/hakkimizda" component={Hakkimizda} />
            <Route path="/iletisim" component={Iletisim} />
            <Route path="/kvkk" component={Kvkk} />
            <Route path="/kullanim-kosullari" component={KullanimKosullari} />
            <Route path="/gizlilik-politikasi" component={GizlilikPolitikasi} />
            <Route path="/cerez-politikasi" component={CerezPolitikasi} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/blog" component={BlogList} />
            <Route path="/assessment/start" component={AssessmentStart} />
            <Route path="/assessment/full/start" component={FullAssessmentStart} />
            <Route path="/assessment/full/:id" component={FullAssessmentRunner} />
            <Route path="/payment/:id" component={Payment} />
            <Route path="/assessment/:id/report" component={AssessmentReport} />
            <Route path="/assessment/:id" component={AssessmentRunner} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/admin/review/:token" component={AdminReview} />
            <Route path="/verify/:token" component={VerifyPage} />
            <Route path="/domain-tarama" component={DomainScan} />
            <Route path="/sizinti-izleyici" component={SizintiIzleyici} />
            <Route path="/kvkk-dpa-olustur" component={KvkkDpa} />
            <Route path="/siber-panik" component={SiberPanik} />
            <Route path="/kvkk-verbis" component={KvkkVerbis} />
            <Route path="/m365-denetim" component={M365Denetim} />
            <Route path="/siber-sigorta" component={SiberSigorta} />
            <Route path="/kep-rehberi" component={KepRehberi} />
            <Route path="/erp-tarama" component={ErpTarama} />
            <Route path="/sektorel-kiyaslama" component={SektorelKiyaslama} />
            <Route path="/kvkk-ceza-sim" component={KvkkCezaSim} />
            <Route path="/phishing-sim" component={PhishingSim} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
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
                <Router />
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
