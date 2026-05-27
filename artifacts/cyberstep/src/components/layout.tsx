import { Link, useLocation } from "wouter";
import { Shield, LogIn, User } from "lucide-react";
import { Footer } from "./footer";
import { useWhiteLabel } from "@/contexts/white-label-context";
import { useCustomer } from "@/hooks/use-customer";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const wl = useWhiteLabel();
  const { data: customer } = useCustomer();

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
          <nav className="flex items-center gap-4">
            {!wl && (
              <>
                <Link
                  href="/blog"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/blog') ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Blog
                </Link>
                <Link
                  href="/fiyatlar"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location === '/fiyatlar' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Fiyatlar
                </Link>
                <Link
                  href="/hakkimizda"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location === '/hakkimizda' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Hakkimizda
                </Link>
                <Link
                  href="/iletisim"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location === '/iletisim' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Iletisim
                </Link>
              </>
            )}

            {customer ? (
              <Link
                href="/hesabim"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <User className="h-4 w-4" />
                {customer.fullName.split(" ")[0]}
              </Link>
            ) : (
              <Link
                href="/giris"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Giriş
              </Link>
            )}

            <Link
              href={wl ? `/w/${wl.slug}/assessment/start` : "/assessment/start"}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:opacity-90 h-10 px-4 py-2"
              style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
            >
              {wl ? "Değerlendirmeyi Başlat" : "Ucretsiz Degerlendirme"}
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
