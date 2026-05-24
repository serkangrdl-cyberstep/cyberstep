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
import { Layout } from "./components/layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/fiyatlar" component={Pricing} />
        <Route path="/assessment/start" component={AssessmentStart} />
        <Route path="/assessment/full/start" component={FullAssessmentStart} />
        <Route path="/assessment/full/:id" component={FullAssessmentRunner} />
        <Route path="/assessment/:id" component={AssessmentRunner} />
        <Route path="/assessment/:id/report" component={AssessmentReport} />
        <Route path="/admin/review/:token" component={AdminReview} />
        <Route path="/dashboard" component={Dashboard} />
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
