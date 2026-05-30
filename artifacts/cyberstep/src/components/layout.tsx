import { Link, useLocation } from "wouter";
import { Shield, LogIn, User, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Footer } from "./footer";
import { useWhiteLabel } from "@/contexts/white-label-context";
import { useCustomer } from "@/hooks/use-customer";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const wl = useWhiteLabel();
  const { data: customer } = useCustomer();
  const { lang, toggle: toggleLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  const isAdminPanel = location.startsWith("/panel");
  if (isAdminPanel) return <>{children}</>;

  const primaryColor = wl?.primaryColor ?? undefined;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={primaryColor ? { borderColor: primaryColor + "30" } : undefined}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          {wl ? (
            <div className="flex items-center gap-3">
              {wl.logoUrl ? (
                <img src={wl.logoUrl} alt={wl.name} className="h-8 object-contain max-w-[140px]" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: wl.primaryColor }}>
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight text-foreground">{wl.name}</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground border border-muted-foreground/30 rounded px-1.5 py-0.5">
                powered by CyberStep
              </span>
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2 text-primary">
              <Shield className="h-6 w-6" />
              <span className="font-bold text-xl tracking-tight text-foreground">CyberStep.io</span>
            </Link>
          )}

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {!wl && (
              <>
                <Link
                  href="/sizinti-izleyici"
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${location === '/sizinti-izleyici' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Sızıntı Kontrolü
                </Link>
                <Link
                  href="/blog"
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${location.startsWith('/blog') ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {t(T.nav.blog, lang)}
                </Link>
                <Link
                  href="/fiyatlar"
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${location === '/fiyatlar' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {t(T.nav.pricing, lang)}
                </Link>
                <Link
                  href="/hakkimizda"
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${location === '/hakkimizda' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {t(T.nav.about, lang)}
                </Link>
                <Link
                  href="/iletisim"
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${location === '/iletisim' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {t(T.nav.contact, lang)}
                </Link>
              </>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="px-2.5 py-1 rounded-md text-xs font-semibold border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              aria-label="Switch language"
            >
              {lang === "tr" ? "EN" : "TR"}
            </button>

            {customer ? (
              <Link
                href="/hesabim"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <User className="h-4 w-4" />
                {customer.fullName.split(" ")[0]}
              </Link>
            ) : (
              <Link
                href="/giris"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <LogIn className="h-4 w-4" />
                {t(T.nav.login, lang)}
              </Link>
            )}

            <Link
              href={wl ? `/w/${wl.slug}/assessment/start` : "/assessment/start"}
              className="ml-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-primary-foreground hover:opacity-90 h-10 px-4 py-2"
              style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
            >
              {wl ? t(T.assessmentStart.startBtn, lang) : t(T.nav.startFree, lang)}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      {!wl && <Footer />}
      {wl && (
        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          {wl.name} · <span className="opacity-60">Powered by CyberStep.io</span>
        </footer>
      )}
    </div>
  );
}
