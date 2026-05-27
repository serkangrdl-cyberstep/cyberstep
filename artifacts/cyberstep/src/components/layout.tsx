import { Link, useLocation } from "wouter";
import { Shield } from "lucide-react";
import { Footer } from "./footer";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isAdminPanel = location.startsWith("/panel");

  if (isAdminPanel) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <Shield className="h-6 w-6" />
            <span className="font-bold text-xl tracking-tight text-foreground">CyberStep.io</span>
          </Link>
          <nav className="flex items-center gap-6">
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
            <Link
              href="/assessment/start"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Ucretsiz Degerlendirme
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
