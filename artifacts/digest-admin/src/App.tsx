import { useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import NewsFeed from "@/pages/NewsFeed";
import DigestList from "@/pages/DigestList";
import DigestEditor from "@/pages/DigestEditor";
import NotFound from "@/pages/not-found";
import Sources from "@/pages/Sources";
import BlogYonetimi from "@/pages/BlogYonetimi";
import SosyalMedya from "@/pages/SosyalMedya";
import IletisimBilgileri from "@/pages/IletisimBilgileri";
import OzelGunler from "@/pages/OzelGunler";
import Rozetler from "@/pages/Rozetler";
import DemoRaporlar from "@/pages/DemoRaporlar";
import Referrallar from "@/pages/Referrallar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const NAV_SECTIONS = [
  {
    label: "Digest",
    items: [
      { href: "/", label: "Pano" },
      { href: "/news", label: "Haber Akisi" },
      { href: "/digests", label: "Digestler" },
      { href: "/sources", label: "Kaynaklar" },
    ],
  },
  {
    label: "Icerik & Blog",
    items: [
      { href: "/blog", label: "Blog Yonetimi" },
      { href: "/sosyal-medya", label: "Sosyal Medya" },
      { href: "/ozel-gunler", label: "Ozel Gun Mesajlari" },
    ],
  },
  {
    label: "Buyume & CRM",
    items: [
      { href: "/referrallar", label: "Referral Programi" },
      { href: "/rozetler", label: "Rozet Yonetimi" },
      { href: "/demo-raporlar", label: "Demo Raporlar" },
    ],
  },
  {
    label: "Site Ayarlari",
    items: [
      { href: "/iletisim", label: "Iletisim Bilgileri" },
    ],
  },
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface AdminMe {
  id: number;
  email: string;
  departments: string[];
  isSuperadmin: boolean;
}

function useDigestAuth() {
  return useQuery<AdminMe>({
    queryKey: ["digest-admin-me"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/auth/me", { credentials: "include" });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json() as Promise<AdminMe>;
    },
    retry: false,
    staleTime: 60_000,
  });
}

function hasDigestAccess(me: AdminMe | undefined): boolean {
  if (!me) return false;
  return me.isSuperadmin || me.departments.includes("digest") || me.departments.includes("pazarlama");
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ adminEmail }: { adminEmail?: string }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("digest-sidebar-collapsed") === "true"; } catch { return false; }
  });

  const toggle = (val: boolean) => {
    try { localStorage.setItem("digest-sidebar-collapsed", val ? "true" : "false"); } catch { /* noop */ }
    setCollapsed(val);
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" || location === "" : location.startsWith(href);

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
        <div className="flex justify-center py-4 border-b border-sidebar-border">
          <button
            onClick={() => toggle(false)}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            title="Menuyu ac"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 py-3 flex flex-col items-center gap-1">
          {NAV_SECTIONS.flatMap(s => s.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-colors ${
                isActive(item.href)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {item.label.slice(0, 1)}
            </Link>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-48 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-sidebar-foreground/50 uppercase tracking-widest font-semibold">CyberStep</p>
            <h1 className="text-sm font-bold text-sidebar-foreground mt-0.5">Pazarlama Paneli</h1>
            {adminEmail && (
              <p className="text-xs text-sidebar-foreground/40 mt-0.5 truncate">{adminEmail}</p>
            )}
          </div>
          <button
            onClick={() => toggle(true)}
            className="mt-0.5 shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            title="Menuyu kapat"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-xs text-sidebar-foreground/40 uppercase tracking-widest font-semibold px-3 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        <a href="/panel" className="block text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
          Ana Admin Panel
        </a>
        <a href="/panel/giris" className="block text-xs text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors">
          Cikis
        </a>
      </div>
    </aside>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

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
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/panel/giris?returnTo=${returnTo}`;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Yonlendiriliyor...</p>
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
            <Route path="/blog" component={BlogYonetimi} />
            <Route path="/sosyal-medya" component={SosyalMedya} />
            <Route path="/iletisim" component={IletisimBilgileri} />
            <Route path="/ozel-gunler" component={OzelGunler} />
            <Route path="/rozetler" component={Rozetler} />
            <Route path="/demo-raporlar" component={DemoRaporlar} />
            <Route path="/referrallar" component={Referrallar} />
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
