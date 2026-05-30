import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import NewsFeed from "@/pages/NewsFeed";
import DigestList from "@/pages/DigestList";
import DigestEditor from "@/pages/DigestEditor";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const NAV = [
  { href: "/", label: "Pano" },
  { href: "/news", label: "Haber Akisi" },
  { href: "/digests", label: "Digestler" },
  { href: "/sources", label: "Kaynaklar" },
];

function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/50 uppercase tracking-widest font-semibold">CyberStep</p>
        <h1 className="text-sm font-bold text-sidebar-foreground mt-0.5">Digest Yonetimi</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/"
            ? location === "/" || location === ""
            : location.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40">CyberStep.io Digest v1</p>
      </div>
    </aside>
  );
}

import Sources from "@/pages/Sources";

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/news" component={NewsFeed} />
            <Route path="/digests" component={DigestList} />
            <Route path="/digest/:id" component={DigestEditor} />
            <Route path="/sources" component={Sources} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppLayout />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
