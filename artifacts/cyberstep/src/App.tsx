import { Switch, Route, Router as WouterRouter, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import AssessmentStart from "./pages/assessment-start";
import AssessmentRunner from "./pages/assessment-runner";
import AssessmentReport from "./pages/assessment-report";
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
import BlogList from "./pages/blog";
import BlogPost from "./pages/blog-post";

import CustomerLogin from "./pages/customer/login";
import CustomerRegister from "./pages/customer/register";
import CustomerTotpSetup from "./pages/customer/totp-setup";
import CustomerAccount from "./pages/customer/account";

import { Layout } from "./components/layout";
import { CookieBanner } from "./components/cookie-banner";
import { WhiteLabelProvider } from "./contexts/white-label-context";
import { LanguageProvider } from "./contexts/language-context";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

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
      <Route path="/kayit" component={CustomerRegister} />
      <Route path="/totp-kurulum" component={CustomerTotpSetup} />
      <Route path="/hesabim" component={CustomerAccount} />

      {/* Admin panel (full-page, no shared header/footer) */}
      <Route path="/panel/giris" component={AdminLogin} />
      <Route path="/panel/ayarlar" component={AdminSettings} />
      <Route path="/panel/fiyatlar" component={AdminPricing} />
      <Route path="/panel/degerlendiirmeler" component={AdminAssessments} />
      <Route path="/panel/odemeler" component={AdminPayments} />
      <Route path="/panel/sorular" component={AdminQuestions} />
      <Route path="/panel/totp" component={AdminTotp} />
      <Route path="/panel/danismanlik" component={AdminDanismanlik} />
      <Route path="/panel/partnerlar" component={AdminPartnerlar} />
      <Route path="/panel/whitelabel" component={AdminWhitelabel} />
      <Route path="/panel/blog" component={AdminBlog} />
      <Route path="/panel/ozel-gunler" component={AdminSpecialMessages} />
      <Route path="/panel/sosyal-medya" component={AdminSosyalMedya} />
      <Route path="/panel" component={AdminDashboard} />

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
              <Router />
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
