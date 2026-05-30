import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Shield, LogIn, User, Moon, Sun, Menu, X, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { Footer } from "./footer";
import { useWhiteLabel } from "@/contexts/white-label-context";
import { useCustomer } from "@/hooks/use-customer";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";

const NAV_LINKS = (lang: "tr" | "en") => [
  { href: "/sizinti-izleyici", label: "Sızıntı Kontrolü" },
  { href: "/blog", label: t(T.nav.blog, lang) },
  { href: "/fiyatlar", label: t(T.nav.pricing, lang) },
  { href: "/hakkimizda", label: t(T.nav.about, lang) },
  { href: "/iletisim", label: t(T.nav.contact, lang) },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const wl = useWhiteLabel();
  const { data: customer } = useCustomer();
  const { lang, toggle: toggleLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdminPanel = location.startsWith("/panel");
  if (isAdminPanel) return <>{children}</>;

  const primaryColor = wl?.primaryColor ?? undefined;
  const navLinks = NAV_LINKS(lang);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-x-hidden">
      <header
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={primaryColor ? { borderColor: primaryColor + "30" } : undefined}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          {wl ? (
            <div className="flex items-center gap-3 shrink-0">
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
            <Link href="/" className="flex items-center gap-2 text-primary shrink-0">
              <Shield className="h-6 w-6" />
              <span className="font-bold text-xl tracking-tight text-foreground">CyberStep.io</span>
            </Link>
          )}

          {/* Desktop Nav — sadece md ve üstü */}
          <nav className="hidden md:flex items-center gap-1">
            {!wl && navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${
                  location === href || (href !== "/" && location.startsWith(href))
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </Link>
            ))}

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

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

          {/* Mobile sağ taraf: CTA + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href={wl ? `/w/${wl.slug}/assessment/start` : "/assessment/start"}
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold text-primary-foreground hover:opacity-90 h-9 px-3"
              style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
            >
              {lang === "en" ? "Start Free" : "Ücretsiz Dene"}
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Menüyü aç"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menü */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-background/98 backdrop-blur shadow-lg">
            <div className="container mx-auto px-4 py-3 space-y-1">
              {!wl && navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    location === href || (href !== "/" && location.startsWith(href))
                      ? "text-primary bg-primary/10"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}

              <div className="flex items-center gap-3 px-3 py-2 border-t mt-2 pt-3">
                {customer ? (
                  <Link
                    href="/hesabim"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    <User className="h-4 w-4" />
                    {customer.fullName.split(" ")[0]}
                  </Link>
                ) : (
                  <Link
                    href="/giris"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    {t(T.nav.login, lang)}
                  </Link>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={toggleLang}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  >
                    {lang === "tr" ? "EN" : "TR"}
                  </button>
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Toggle theme"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
