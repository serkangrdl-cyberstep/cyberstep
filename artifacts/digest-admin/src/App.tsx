import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import NewsFeed from "@/pages/NewsFeed";
import DigestList from "@/pages/DigestList";
import DigestEditor from "@/pages/DigestEditor";
import NotFound from "@/pages/not-found";
import Sources from "@/pages/Sources";

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

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface AdminMe {
  id: number;
  email: string;
  departments: string[];
  isSuperadmin: boolean;
}

function useDigestAuth() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return useQuery<AdminMe>({
    queryKey: ["digest-admin-me"],
    queryFn: async () => {
      const r = await fetch(`${base}/api/admin-panel/auth/me`, { credentials: "include" });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json() as Promise<AdminMe>;
    },
    retry: false,
    staleTime: 60_000,
  });
}

function hasDigestAccess(me: AdminMe | undefined): boolean {
  if (!me) return false;
  return me.isSuperadmin || me.departments.includes("digest");
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function Sidebar({ adminEmail }: { adminEmail?: string }) {
  const [location] = useLocation();

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/50 uppercase tracking-widest font-semibold">CyberStep</p>
        <h1 className="text-sm font-bold text-sidebar-foreground mt-0.5">Digest Yonetimi</h1>
        {adminEmail && (
          <p className="text-xs text-sidebar-foreground/40 mt-0.5 truncate">{adminEmail}</p>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/"
            ? location === "/" || location === ""
            : location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-sidebar-border">
        <a href="/panel/giris" className="text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
          Cikis / Ana Panel
        </a>
      </div>
    </aside>
  );
}

function AppLayout() {
  const { data: me, isLoading, isError } = useDigestAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Kimlik dogrulaniyor...</p>
      </div>
    );
  }

  if (isError || !me || !hasDigestAccess(me)) {
    // Redirect to main admin login page
    window.location.href = "/panel/giris";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">Yonlendiriliyor...</p>
        <p className="text-xs text-muted-foreground/60">
          Bu panel icin <b>digest</b> departmanina atanmis olmaniz gerekiyor.
        </p>
        <a href="/panel/giris" className="text-sm underline text-primary">
          Admin girisi icin tiklayin
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar adminEmail={me.email} />
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

// ─── App ──────────────────────────────────────────────────────────────────────

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
