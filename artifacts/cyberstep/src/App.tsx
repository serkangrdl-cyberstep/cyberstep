import { Switch, Route, Router as WouterRouter } from "wouter";
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
import AdminReview from "./pages/admin-review";
import Hakkimizda from "./pages/hakkimizda";
import Iletisim from "./pages/iletisim";
import Kvkk from "./pages/kvkk";

import AdminLogin from "./pages/admin-panel/login";
import AdminDashboard from "./pages/admin-panel/index";
import AdminSettings from "./pages/admin-panel/settings";
import AdminPricing from "./pages/admin-panel/pricing";
import AdminAssessments from "./pages/admin-panel/assessments";
import AdminPayments from "./pages/admin-panel/payments";
import AdminQuestions from "./pages/admin-panel/questions";

import { Layout } from "./components/layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Public pages */}
        <Route path="/" component={Home} />
        <Route path="/fiyatlar" component={Pricing} />
        <Route path="/hakkimizda" component={Hakkimizda} />
        <Route path="/iletisim" component={Iletisim} />
        <Route path="/kvkk" component={Kvkk} />

        {/* Assessment flow */}
        <Route path="/assessment/start" component={AssessmentStart} />
        <Route path="/assessment/full/start" component={FullAssessmentStart} />
        <Route path="/assessment/full/:id" component={FullAssessmentRunner} />
        <Route path="/assessment/:id" component={AssessmentRunner} />
        <Route path="/assessment/:id/report" component={AssessmentReport} />

        {/* Dashboard & legacy admin */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/admin/review/:token" component={AdminReview} />

        {/* Admin panel */}
        <Route path="/panel/giris" component={AdminLogin} />
        <Route path="/panel" component={AdminDashboard} />
        <Route path="/panel/ayarlar" component={AdminSettings} />
        <Route path="/panel/fiyatlar" component={AdminPricing} />
        <Route path="/panel/degerlendiirmeler" component={AdminAssessments} />
        <Route path="/panel/odemeler" component={AdminPayments} />
        <Route path="/panel/sorular" component={AdminQuestions} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
