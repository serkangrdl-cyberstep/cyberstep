import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Shield, LogIn, User, Moon, Sun, Menu, X, ChevronRight, ChevronDown, Bot, Cpu, Mail, Eye, FileText, ActivitySquare, ShieldCheck, Wrench } from "lucide-react";
import { useTheme } from "next-themes";
import { Footer } from "./footer";
import { useWhiteLabel } from "@/contexts/white-label-context";
import { useCustomer } from "@/hooks/use-customer";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";

const NAV_LINKS = (lang: "tr" | "en") => [
  { href: "/blog", label: t(T.nav.blog, lang) },
  { href: "/fiyatlar", label: t(T.nav.pricing, lang) },
  { href: "/hakkimizda", label: t(T.nav.about, lang) },
  { href: "/iletisim", label: t(T.nav.contact, lang) },
];

const AI_GUVENLIK_ITEMS = [
  { href: "/ai-guvenlik-degerlendirmesi", label: "AI Risk Değerlendirmesi", icon: ShieldCheck, available: true },
  { href: "/ai-phishing-simulasyonu", label: "AI Phishing Simülasyonu", icon: Mail, available: true },
  { href: "/ai-arac-izleme", label: "AI Araç İzleme", icon: ActivitySquare, available: true },
  { href: "/ai-politika", label: "AI Politika Otogüncelleme", icon: FileText, available: true },
  { href: "/deepfake-analizi", label: "Deepfake Tehdit Analizi", icon: Eye, available: true },
  { href: "/sahte-dokuman", label: "AI Sahte Doküman Tespiti", icon: FileText, available: true },
  { href: "/eu-ai-act", label: "EU AI Act Uyum Skoru", icon: Cpu, available: true },
  { href: "/ai-red-team", label: "AI Red Team Raporu", icon: Bot, available: true },
  { href: "/sanal-ciso", label: "Sanal CISO", icon: ShieldCheck, available: true },
];

const ARACLAR_ITEMS = [
  { href: "/domain-tarama", label: "Alan Adı Güvenlik Taraması" },
  { href: "/sizinti-izleyici", label: "Sızıntı İzleyici" },
  { href: "/kvkk-ceza-sim", label: "KVKK Ceza Simülatörü" },
  { href: "/m365-denetim", label: "Microsoft 365 Denetimi" },
  { href: "/sektorel-kiyaslama", label: "Sektörel Kıyaslama" },
  { href: "/roi-hesaplayici", label: "ROI Hesaplayıcı" },
  { href: "/marka-koruma", label: "Marka Koruma" },
  { href: "/araclar", label: "Tüm Araçlar" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const wl = useWhiteLabel();
  const { data: customer } = useCustomer();
  const { lang, toggle: toggleLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) {
        setAiOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="nav-grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00C8FF"/>
                    <stop offset="100%" stopColor="#0080FF"/>
                  </linearGradient>
                </defs>
                <rect width="512" height="512" rx="96" fill="#060D1A"/>
                <path d="M256 48 L432 112 L432 276 C432 372 352 444 256 480 C160 444 80 372 80 276 L80 112 Z" fill="#0A1628" stroke="url(#nav-grad)" strokeWidth="12"/>
                <path d="M 181 320 L 181 278 L 234 278 L 234 235 L 181 235 L 181 192 L 331 192 L 331 235 L 278 235 L 278 278 L 331 278 L 331 320 Z" fill="url(#nav-grad)" fillOpacity="0.95"/>
                <circle cx="181" cy="192" r="18" fill="#00C8FF"/>
                <circle cx="331" cy="192" r="18" fill="#00C8FF"/>
                <circle cx="181" cy="320" r="18" fill="#00C8FF"/>
                <circle cx="331" cy="320" r="18" fill="#00C8FF"/>
              </svg>
              <span className="font-bold text-xl tracking-tight text-foreground">Cyber<span className="text-primary">Step</span><span className="text-muted-foreground text-sm font-medium">.io</span></span>
            </Link>
          )}

          {/* Desktop Nav — sadece md ve üstü */}
          <nav className="hidden md:flex items-center gap-1">
            {!wl && (
              <div ref={aiRef} className="relative">
                <button
                  onClick={() => setAiOpen(v => !v)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${
                    location.startsWith("/ai-") || location.startsWith("/eu-ai") || location.startsWith("/deepfake") || location.startsWith("/sahte") || location.startsWith("/sanal-ciso") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  AI Güvenlik
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aiOpen ? "rotate-180" : ""}`} />
                </button>
                {aiOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-64 bg-popover border rounded-xl shadow-xl z-50 py-2 overflow-hidden">
                    {AI_GUVENLIK_ITEMS.map(({ href, label, icon: Icon, available }) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setAiOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                      >
                        <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${available ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-muted"}`}>
                          <Icon className={`h-4 w-4 ${available ? "text-emerald-600" : "text-muted-foreground"}`} />
                        </div>
                        <span className={available ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {label}
                        </span>
                        {!available && (
                          <span className="ml-auto text-xs text-slate-400 bg-muted px-1.5 py-0.5 rounded">Yakında</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!wl && (
              <div ref={toolsRef} className="relative">
                <button
                  onClick={() => setToolsOpen(v => !v)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:text-primary rounded-md ${
                    toolsOpen ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Araçlar
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
                </button>
                {toolsOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 bg-popover border rounded-xl shadow-xl z-50 py-2 overflow-hidden">
                    {ARACLAR_ITEMS.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setToolsOpen(false)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${label === "Tüm Araçlar" ? "font-semibold text-primary border-t mt-1 pt-2.5" : "text-foreground"}`}
                      >
                        {label === "Tüm Araçlar" ? <>{label} <ChevronRight className="h-3.5 w-3.5 ml-auto" /></> : label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              {/* AI Güvenlik accordion */}
              {!wl && (
                <div>
                  <button
                    onClick={() => setMobileAiOpen(v => !v)}
                    className={`flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      location.startsWith("/ai-") || location.startsWith("/eu-ai") || location.startsWith("/deepfake") || location.startsWith("/sahte") || location.startsWith("/sanal-ciso") ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    AI Güvenlik
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${mobileAiOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileAiOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-emerald-500/30 pl-3">
                      {AI_GUVENLIK_ITEMS.map(({ href, label, available }) => (
                        <Link
                          key={label}
                          href={href}
                          onClick={() => { setMobileOpen(false); setMobileAiOpen(false); }}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-md text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          {label}
                          {!available && <span className="text-xs text-slate-400 bg-muted px-1.5 py-0.5 rounded">Yakında</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Araçlar accordion */}
              {!wl && (
                <div>
                  <button
                    onClick={() => setMobileToolsOpen(v => !v)}
                    className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors text-foreground hover:bg-muted"
                  >
                    <span className="flex items-center gap-2"><Wrench className="h-4 w-4" />Araçlar</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${mobileToolsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileToolsOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-primary/20 pl-3">
                      {ARACLAR_ITEMS.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => { setMobileOpen(false); setMobileToolsOpen(false); }}
                          className="flex items-center w-full px-2 py-2 rounded-md text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
