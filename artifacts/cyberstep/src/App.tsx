import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useRoute, useLocation } from "wouter";
import SaldiriSimulasyonu from "./pages/saldiri-simulasyonu";
import FinansalKayip from "./pages/finansal-kayip";
import MarkaKoruma from "./pages/marka-koruma";
import TedarikZinciri from "./pages/tedarik-zinciri";
import GuvenRozeti from "./pages/guven-rozeti";
import DoraBddkUyum from "./pages/dora-bddk-uyum";
import SektorPage from "./pages/sektor";
import ExtensionDownload from "./pages/extension-download";
import SanalCiso from "./pages/sanal-ciso";
import ErpEntegrasyonu from "./pages/erp-entegrasyonu";
import SigortaPazaryeri from "./pages/sigorta-pazaryeri";
import TehditIstihbarati from "./pages/tehdit-istihbarati";
import SkorApi from "./pages/skor-api";
import GuvenlikMerkezi from "./pages/guvenlik-merkezi";
import Metodoloji from "./pages/metodoloji";
import ZeroDayUyari from "./pages/zero-day-uyari";
import GithubTarama from "./pages/github-tarama";
import OnPremise from "./pages/on-premise";
import MaDueDiligence from "./pages/ma-due-diligence";
import TedarikciOnboarding from "./pages/tedarikci-onboarding";
import ComplianceCalendar from "./pages/compliance-calendar";
import TprmAnket from "./pages/tprm-anket";
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
import Kurumsal from "./pages/kurumsal";
import PartnerPage from "./pages/partner";
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
import AdminEntegrasyonlar from "./pages/admin-panel/entegrasyonlar";
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
import RoiHesaplayici from "./pages/roi-hesaplayici";
import CustomerLogin from "./pages/customer/login";
import CustomerRegister from "./pages/customer/register";
import CustomerTotpSetup from "./pages/customer/totp-setup";
import CustomerAccount from "./pages/customer/account";
import CustomerReports from "./pages/customer/reports";
import CustomerIntegrations from "./pages/customer/integrations";
import CustomerDavet from "./pages/customer/davet";
import PentestLite from "./pages/pentest-lite";
import YonetimRaporu from "./pages/customer/yonetim-raporu";
import AdminSaglik from "./pages/admin/saglik";
import AdminYonetimRaporlari from "./pages/admin/yonetim-raporlari";
import AdminReferrallar from "./pages/admin/referrallar";
import SifreSifirla from "./pages/customer/sifre-sifirla";
import AiAssessmentLanding from "./pages/ai-assessment-landing";
import AiAssessmentStart from "./pages/ai-assessment-start";
import AiAssessmentTools from "./pages/ai-assessment-tools";
import AiAssessmentRunner from "./pages/ai-assessment-runner";
import AiAssessmentReport from "./pages/ai-assessment-report";
import AiPolitika from "./pages/ai-politika";
import AiAracIzleme from "./pages/ai-arac-izleme";
import AiPhishingSimulasyonu from "./pages/ai-phishing-simulasyonu";
import AiPhishingRapor from "./pages/ai-phishing-rapor";

import { Layout } from "./components/layout";
import { CookieBanner } from "./components/cookie-banner";
import { WhiteLabelProvider } from "./contexts/white-label-context";
import { LanguageProvider } from "./contexts/language-context";
import { ThemeProvider } from "next-themes";
import { TenantProvider } from "./contexts/tenant-context";

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
      <Route path="/entegrasyonlarim" component={CustomerIntegrations} />
      <Route path="/hesabim/davet" component={CustomerDavet} />
      <Route path="/pentest-lite" component={PentestLite} />
      <Route path="/hesabim/yonetim-raporu" component={YonetimRaporu} />

      {/* AI Phishing rapor — full-page (Layout kendi içinde) */}
      <Route path="/ai-phishing-simulasyonu/:id/rapor" component={AiPhishingRapor} />

      {/* AI Güvenlik Değerlendirmesi — full-page akış (layout yok) */}
      <Route path="/ai-guvenlik/start" component={AiAssessmentStart} />
      <Route path="/ai-guvenlik/:id/araclar" component={AiAssessmentTools} />
      <Route path="/ai-guvenlik/:id/sorular" component={AiAssessmentRunner} />
      <Route path="/ai-guvenlik/:id/rapor" component={AiAssessmentReport} />

      {/* Admin panel (full-page, no shared header/footer) */}
      <Route path="/panel/giris" component={AdminLogin} />
      <Route path="/panel/workspace" component={WorkspacePicker} />
      <Route path="/panel/workspace-ayarlari" component={TenantSettingsPage} />
      <Route path="/panel/entegrasyonlar" component={AdminEntegrasyonlar} />
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
      <Route path="/panel/email-sablonlari" component={AdminEmailTemplates} />
      <Route path="/panel/bildirimler" component={AdminEmailNotifications} />
      <Route path="/panel/rozet-avantajlari" component={AdminRozetAvantajlari} />
      <Route path="/panel/is-ortaklari" component={AdminIsOrtaklari} />
      <Route path="/panel/is-paketleri" component={AdminIsPaketleri} />
      <Route path="/panel/saglik" component={AdminSaglik} />
      <Route path="/panel/yonetim-raporlari" component={AdminYonetimRaporlari} />
      <Route path="/panel/referrallar" component={AdminReferrallar} />
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
            <Route path="/kurumsal" component={Kurumsal} />
            <Route path="/partner" component={PartnerPage} />
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
            <Route path="/roi-hesaplayici" component={RoiHesaplayici} />
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
            <Route path="/ai-politika" component={AiPolitika} />
            <Route path="/ai-arac-izleme" component={AiAracIzleme} />
            <Route path="/ai-phishing-simulasyonu" component={AiPhishingSimulasyonu} />
            <Route path="/saldiri-simulasyonu" component={SaldiriSimulasyonu} />
            <Route path="/finansal-kayip" component={FinansalKayip} />
            <Route path="/marka-koruma" component={MarkaKoruma} />
            <Route path="/tedarik-zinciri" component={TedarikZinciri} />
            <Route path="/guven-rozeti" component={GuvenRozeti} />
            <Route path="/dora-bddk-uyum" component={DoraBddkUyum} />
            <Route path="/sektor/:slug" component={SektorPage} />
            <Route path="/tarayici-eklentisi" component={ExtensionDownload} />
            <Route path="/sanal-ciso" component={SanalCiso} />
            <Route path="/erp-entegrasyonu" component={ErpEntegrasyonu} />
            <Route path="/sigorta-pazaryeri" component={SigortaPazaryeri} />
            <Route path="/tehdit-istihbarati" component={TehditIstihbarati} />
            <Route path="/skor-api" component={SkorApi} />
            <Route path="/guvenlik-merkezi" component={GuvenlikMerkezi} />
            <Route path="/metodoloji" component={Metodoloji} />
            <Route path="/zero-day-uyari" component={ZeroDayUyari} />
            <Route path="/github-tarama" component={GithubTarama} />
            <Route path="/on-premise" component={OnPremise} />
            <Route path="/ma-due-diligence" component={MaDueDiligence} />
            <Route path="/tedarikci-onboarding" component={TedarikciOnboarding} />
            <Route path="/compliance-calendar" component={ComplianceCalendar} />
            <Route path="/tprm/anket/:token" component={TprmAnket} />
            <Route path="/ai-guvenlik-degerlendirmesi" component={AiAssessmentLanding} />
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
                <ScrollToTop />
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
