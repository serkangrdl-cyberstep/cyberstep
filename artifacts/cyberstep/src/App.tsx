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
import TechnologyDiscovery from "./pages/technology-discovery";
import VcisoErkenErisim from "./pages/vciso-erken-erisim";
import CisoAsistanPortal from "./pages/hesabim/ciso-asistan";
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
import NedenCyberStep from "./pages/neden-cyberstep";
import Iletisim from "./pages/iletisim";
import Kurumsal from "./pages/kurumsal";
import PartnerPage from "./pages/partner";
import EuAiAct from "./pages/eu-ai-act";
import EuAiActSorular from "./pages/eu-ai-act-sorular";
import EuAiActRapor from "./pages/eu-ai-act-rapor";
import AiRedTeam from "./pages/ai-red-team";
import DeepfakeAnalizi from "./pages/deepfake-analizi";
import SahteDoküman from "./pages/sahte-dokuman";
import Kvkk from "./pages/kvkk";
import KullanimKosullari from "./pages/kullanim-kosullari";
import GizlilikPolitikasi from "./pages/gizlilik-politikasi";
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
import AdminPricing from "./pages/admin-panel/pricing";
import AdminAssessments from "./pages/admin-panel/assessments";
import AdminPayments from "./pages/admin-panel/payments";
import AdminQuestions from "./pages/admin-panel/questions";
import AdminTotp from "./pages/admin-panel/totp";
import AdminDanismanlik from "./pages/admin-panel/danismanlik";
import AdminPartnerlar from "./pages/admin-panel/partnerlar";
import AdminWhitelabel from "./pages/admin-panel/whitelabel";
import AdminBlog from "./pages/admin-panel/blog";
import AdminBrandKit from "./pages/admin-panel/brand-kit";
import AdminDailyDashboard from "./pages/admin-panel/daily-dashboard";
import AdminSosyalMedya from "./pages/admin-panel/sosyal-medya";
import AdminYoneticiler from "./pages/admin-panel/yoneticiler";
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
import Haberler from "./pages/haberler";

import VerifyPage from "./pages/verify";
import ServislerPage from "./pages/servisler";
import SatinAl from "./pages/satin-al";
import AdminServisKatalogu from "./pages/admin-panel/servis-katalogu";
import AdminServisYonetimi from "./pages/admin-panel/servis-yonetimi";
import AdminDemoRaporlar from "./pages/admin-panel/demo-raporlar";
import DemoPage from "./pages/demo";
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
import PlatformSaglik from "./pages/admin-panel/platform-saglik";
import AdminYonetimRaporlari from "./pages/admin/yonetim-raporlari";
import AdminReferrallar from "./pages/admin/referrallar";
import SifreSifirla from "./pages/customer/sifre-sifirla";
import AiAssessmentLanding from "./pages/ai-assessment-landing";
import TumAraclar from "./pages/tum-araclar";
import AiAssessmentStart from "./pages/ai-assessment-start";
import AiAssessmentTools from "./pages/ai-assessment-tools";
import AiAssessmentRunner from "./pages/ai-assessment-runner";
import AiAssessmentReport from "./pages/ai-assessment-report";
import AiPolitika from "./pages/ai-politika";
import AiAracIzleme from "./pages/ai-arac-izleme";
import AiPhishingSimulasyonu from "./pages/ai-phishing-simulasyonu";
import AiPhishingRapor from "./pages/ai-phishing-rapor";
import EnterpriseTab from "./pages/hesabim/enterprise-tab";
import EnterpriseProspects from "./pages/admin-panel/enterprise/prospects";
import EnterprisePipeline from "./pages/admin-panel/enterprise/pipeline";
import EnterpriseContracts from "./pages/admin-panel/enterprise/contracts";
import LeadGenQueue from "./pages/admin-panel/lead-gen/queue";
import LeadGenCampaigns from "./pages/admin-panel/lead-gen/campaigns";
import PreviewPage from "./pages/preview";
import RakipKarsilastirma from "./pages/rakip-karsilastirma";
import SektorRaporu from "./pages/sektor-raporu";
import AdminGrowthEngine from "./pages/admin/growth-engine";
import AdminFaturalar from "./pages/admin-panel/faturalar";
import AdminGelir from "./pages/admin-panel/gelir";
import AdminGorevler from "./pages/admin-panel/gorevler";
import AdminNps from "./pages/admin-panel/nps-page";
import AdminMuhasebe from "./pages/admin-panel/muhasebe";
import Musteri360 from "./pages/admin-panel/musteri-360";
import AdminKariyer from "./pages/admin-panel/kariyer";
import AdminServisFiyatlari from "./pages/admin-panel/servis-fiyatlari";
import AdminManuelTetikle from "./pages/admin-panel/manuel-tetikle";
import AdminRozetler from "./pages/admin-panel/rozetler";
import HesabimFaturalar from "./pages/hesabim/faturalar";
import FortinetEntegrasyonu from "./pages/hesabim/fortinet";
import AdminFortinet from "./pages/admin-panel/fortinet";
import AdminSoc from "./pages/admin-panel/soc";
import AdminNoc from "./pages/admin-panel/noc";
import OnboardingWizard from "./pages/admin-panel/onboarding-wizard";
import OnboardingDashboard from "./pages/admin-panel/onboarding-dashboard";
import MusteriServisleri from "./pages/admin-panel/musteri-servisleri";
import AdminAiCosts from "./pages/admin-panel/ai-costs";
import AdminRemediation from "./pages/admin-panel/remediation";
import AdminCodeSecrets from "./pages/admin-panel/code-secrets";
import AdminObservability from "./pages/admin-panel/observability";
import AdminDnsIzleme from "./pages/admin-panel/dns-izleme";
import AdminCtIzleme from "./pages/admin-panel/ct-izleme";
import AdminMs365 from "./pages/admin-panel/ms365";
import AdminKvkk from "./pages/admin-panel/kvkk";
import AdminServiceNow from "./pages/admin-panel/servicenow";
import AdminIocKontroller from "./pages/admin-panel/ioc-kontroller";
import AdminApprovals from "./pages/admin-panel/approvals";
import IocSorgu from "./pages/ioc-sorgu";
import DnsIzleme from "./pages/hesabim/dns-izleme";
import TedarikciPortfoyu from "./pages/hesabim/tedarikci-portfoyu";
import HesabimWhitelist from "./pages/hesabim/whitelist";
import HesabimIocLog from "./pages/hesabim/ioc-log";
import SocDashboard from "./pages/hesabim/soc";
import NocDashboard from "./pages/hesabim/noc";
import NocKurulum from "./pages/hesabim/noc-kurulum";
import KurulumMerkezi from "./pages/hesabim/kurulum";
import MusteriProvizyon from "./pages/admin-panel/musteri-provizyon";
import HesabimDestek from "./pages/hesabim/destek";
import Bulgularim from "./pages/hesabim/bulgularim";
import CloudGuvenlik from "./pages/hesabim/cloud-guvenlik";
import EntegrasyonlarimPage from "./pages/hesabim/entegrasyonlarim";
import ServislerimPage from "./pages/hesabim/servislerim";
import TechDiscoveryPortal from "./pages/hesabim/technology-discovery";
import SepetPage from "./pages/hesabim/sepet";
import YenilePage from "./pages/yenile";
import NpsPage from "./pages/nps";
import StatusPage from "./pages/status";
import AdminStatusPage from "./pages/admin-panel/status";
import AdminLeadDiscovery from "./pages/admin-panel/lead-discovery";
import AdminTechIntelligence from "./pages/admin-panel/tech-intelligence";
import AdminTechDiscovery from "./pages/admin-panel/technology-discovery";
import AdminIntelligence from "./pages/admin-panel/istihbarat";
import AdminEndeksRaporu from "./pages/admin-panel/endeks-raporu";
import AdminCtiIstihbarat from "./pages/admin-panel/cti-istihbarat";
import SslKontrol from "./pages/araclar/ssl-kontrol";
import DomainGuvenlikTaramasi from "./pages/araclar/domain-guvenlik-taramasi";
import KvkkCezaHesaplayici from "./pages/araclar/kvkk-ceza-hesaplayici";
import DmarcKontrol from "./pages/araclar/dmarc-kontrol";
import DarkWebSorgulama from "./pages/araclar/dark-web-sorgulama";
import SiberRiskRoi from "./pages/araclar/siber-risk-roi";

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
      <Route path="/hesabim/enterprise" component={EnterpriseTab} />
      <Route path="/hesabim/davet" component={CustomerDavet} />
      <Route path="/hesabim/faturalar" component={HesabimFaturalar} />
      <Route path="/hesabim/fortinet-entegrasyonu" component={FortinetEntegrasyonu} />
      <Route path="/hesabim/soc" component={SocDashboard} />
      <Route path="/hesabim/noc" component={NocDashboard} />
      <Route path="/hesabim/noc-kurulum" component={NocKurulum} />
      <Route path="/hesabim/kurulum" component={KurulumMerkezi} />
      <Route path="/hesabim/destek" component={HesabimDestek} />
      <Route path="/hesabim/bulgularim" component={Bulgularim} />
      <Route path="/hesabim/cloud-guvenlik" component={CloudGuvenlik} />
      <Route path="/hesabim/entegrasyonlarim" component={EntegrasyonlarimPage} />
      <Route path="/hesabim/dns-izleme" component={DnsIzleme} />
      <Route path="/hesabim/tedarikci-portfoyu" component={TedarikciPortfoyu} />
      <Route path="/hesabim/whitelist" component={HesabimWhitelist} />
      <Route path="/hesabim/ioc-log" component={HesabimIocLog} />
      <Route path="/hesabim/ioc-sorgu" component={IocSorgu} />
      <Route path="/hesabim/servislerim" component={ServislerimPage} />
      <Route path="/hesabim/technology-discovery" component={TechDiscoveryPortal} />
      <Route path="/hesabim/sepet" component={SepetPage} />
      <Route path="/hesabim/ciso-asistan" component={CisoAsistanPortal} />
      <Route path="/yenile" component={YenilePage} />
      <Route path="/pentest-lite" component={PentestLite} />
      <Route path="/hesabim/yonetim-raporu" component={YonetimRaporu} />
      <Route path="/nps/:token" component={NpsPage} />
      <Route path="/status" component={StatusPage} />

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
      <Route path="/panel/cron-ayarlari" component={AdminCronAyarlari} />
      <Route path="/panel/cve" component={AdminCVE} />
      <Route path="/cve/:cveId" component={CVEDetailPage} />
      <Route path="/panel/bulletin" component={AdminBulletin} />
      <Route path="/bulten/arsiv" component={BulletinArchivePage} />
      <Route path="/bulten/:slug" component={BulletinDetailPage} />
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
      <Route path="/panel/marka-kilavuzu" component={AdminBrandKit} />
      <Route path="/panel/ozel-gunler" component={AdminSpecialMessages} />
      <Route path="/panel/sosyal-medya" component={AdminSosyalMedya} />
      <Route path="/panel/yoneticiler" component={AdminYoneticiler} />
      <Route path="/panel/musteriler" component={AdminMusteriler} />
      <Route path="/panel/domain-taramalar" component={AdminDomainTaramalar} />
      <Route path="/panel/email-sablonlari" component={AdminEmailTemplates} />
      <Route path="/panel/bildirimler" component={AdminEmailNotifications} />
      <Route path="/panel/rozet-avantajlari" component={AdminRozetAvantajlari} />
      <Route path="/panel/is-ortaklari" component={AdminIsOrtaklari} />
      <Route path="/panel/is-paketleri" component={AdminIsPaketleri} />
      <Route path="/panel/saglik" component={AdminSaglik} />
      <Route path="/panel/platform-saglik" component={PlatformSaglik} />
      <Route path="/panel/growth-engine" component={AdminGrowthEngine} />
      <Route path="/panel/yonetim-raporlari" component={AdminYonetimRaporlari} />
      <Route path="/panel/referrallar" component={AdminReferrallar} />
      <Route path="/panel/enterprise/prospects" component={EnterpriseProspects} />
      <Route path="/panel/enterprise/pipeline" component={EnterprisePipeline} />
      <Route path="/panel/enterprise/contracts" component={EnterpriseContracts} />
      <Route path="/panel/lead-gen/queue" component={LeadGenQueue} />
      <Route path="/panel/lead-gen/campaigns" component={LeadGenCampaigns} />
      <Route path="/panel/faturalar" component={AdminFaturalar} />
      <Route path="/panel/gelir" component={AdminGelir} />
      <Route path="/panel/gorevler" component={AdminGorevler} />
      <Route path="/panel/nps" component={AdminNps} />
      <Route path="/panel/muhasebe" component={AdminMuhasebe} />
      <Route path="/panel/musteriler/:id" component={Musteri360} />
      <Route path="/panel/kariyer" component={AdminKariyer} />
      <Route path="/panel/servis-fiyatlari" component={AdminServisFiyatlari} />
      <Route path="/panel/manuel-tetikle" component={AdminManuelTetikle} />
      <Route path="/panel/lead-discovery" component={AdminLeadDiscovery} />
      <Route path="/panel/tech-intelligence" component={AdminTechIntelligence} />
      <Route path="/panel/technology-discovery" component={AdminTechDiscovery} />
      <Route path="/panel/intelligence" component={AdminIntelligence} />
      <Route path="/panel/endeks-raporu" component={AdminEndeksRaporu} />
      <Route path="/panel/cti-istihbarat" component={AdminCtiIstihbarat} />
      <Route path="/panel/gunluk-ozet" component={AdminDailyDashboard} />
      <Route path="/panel/status" component={AdminStatusPage} />
      <Route path="/panel/rozetler" component={AdminRozetler} />
      <Route path="/panel/fortinet" component={AdminFortinet} />
      <Route path="/panel/soc" component={AdminSoc} />
      <Route path="/panel/noc" component={AdminNoc} />
      <Route path="/panel/onboarding" component={OnboardingDashboard} />
      <Route path="/panel/musteri-servisleri" component={MusteriServisleri} />
      <Route path="/panel/musteriler/:id/onboarding" component={OnboardingWizard} />
      <Route path="/panel/musteriler/:id/provizyon" component={MusteriProvizyon} />
      <Route path="/panel/ai-costs" component={AdminAiCosts} />
      <Route path="/panel/remediation" component={AdminRemediation} />
      <Route path="/panel/kod-guvenligi" component={AdminCodeSecrets} />
      <Route path="/panel/observability" component={AdminObservability} />
      <Route path="/panel/dns-izleme" component={AdminDnsIzleme} />
      <Route path="/panel/ct-izleme" component={AdminCtIzleme} />
      <Route path="/panel/ms365" component={AdminMs365} />
      <Route path="/panel/kvkk" component={AdminKvkk} />
      <Route path="/panel/servicenow" component={AdminServiceNow} />
      <Route path="/panel/ioc-kontroller" component={AdminIocKontroller} />
      <Route path="/panel/approvals" component={AdminApprovals} />
      <Route path="/panel/servis-katalogu" component={AdminServisKatalogu} />
      <Route path="/panel/servis-yonetimi" component={AdminServisYonetimi} />
      <Route path="/panel/demo-raporlar" component={AdminDemoRaporlar} />
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
            <Route path="/neden-cyberstep" component={NedenCyberStep} />
            <Route path="/kurumsal" component={Kurumsal} />
            <Route path="/partner" component={PartnerPage} />
            <Route path="/eu-ai-act" component={EuAiAct} />
            <Route path="/eu-ai-act/sorular/:id" component={EuAiActSorular} />
            <Route path="/eu-ai-act/rapor/:id" component={EuAiActRapor} />
            <Route path="/ai-red-team/:id" component={AiRedTeam} />
            <Route path="/ai-red-team" component={AiRedTeam} />
            <Route path="/deepfake-analizi/:id" component={DeepfakeAnalizi} />
            <Route path="/deepfake-analizi" component={DeepfakeAnalizi} />
            <Route path="/sahte-dokuman" component={SahteDoküman} />
            <Route path="/iletisim" component={Iletisim} />
            <Route path="/kvkk" component={Kvkk} />
            <Route path="/kullanim-kosullari" component={KullanimKosullari} />
            <Route path="/gizlilik-politikasi" component={GizlilikPolitikasi} />
            <Route path="/cerez-politikasi" component={CerezPolitikasi} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/blog" component={BlogList} />
            <Route path="/haberler" component={Haberler} />
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
            <Route path="/ciso-asistan-paketi" component={SanalCiso} />
            <Route path="/technology-discovery" component={TechnologyDiscovery} />
            <Route path="/vciso-erken-erisim" component={VcisoErkenErisim} />
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
            <Route path="/preview/:token" component={PreviewPage} />
            <Route path="/ai-guvenlik-degerlendirmesi" component={AiAssessmentLanding} />
            <Route path="/araclar/ssl-kontrol" component={SslKontrol} />
            <Route path="/araclar/domain-guvenlik-taramasi" component={DomainGuvenlikTaramasi} />
            <Route path="/araclar/kvkk-ceza-hesaplayici" component={KvkkCezaHesaplayici} />
            <Route path="/araclar/dmarc-kontrol" component={DmarcKontrol} />
            <Route path="/araclar/dark-web-sorgulama" component={DarkWebSorgulama} />
            <Route path="/araclar/siber-risk-roi" component={SiberRiskRoi} />
            <Route path="/araclar" component={TumAraclar} />
            <Route path="/rakip-karsilastirma" component={RakipKarsilastirma} />
            <Route path="/sektor-raporu" component={SektorRaporu} />
            <Route path="/demo" component={DemoPage} />
            <Route path="/servisler/:slug" component={ServislerPage} />
            <Route path="/satin-al/:slug" component={SatinAl} />
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
