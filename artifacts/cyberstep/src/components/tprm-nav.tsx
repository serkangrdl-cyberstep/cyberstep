import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/hesabim", label: "Özet" },
  { href: "/hesabim/tedarikci-portfoyu", label: "Tedarikçiler" },
  { href: "/raporlarim", label: "Raporlar" },
  { href: "/hesabim/faturalar", label: "Faturalar" },
  { href: "/hesabim/destek", label: "Destek" },
];

/** Müşteri portalı üst menüsü — yalnızca TPRM (tedarikçi risk yönetimi) akışı. */
export function TprmNav() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });
  const isActive = (href: string) => (href === "/hesabim" ? location === "/hesabim" : location.startsWith(href));
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Shield className="h-5 w-5 text-emerald-500" />
            <span className="font-bold text-white">CyberStep.io</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href}>
                <span className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${isActive(l.href) ? "text-white bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>{l.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => logout.mutate()}>
          <LogOut className="h-4 w-4 mr-2" /> Çıkış
        </Button>
      </div>
      <div className="md:hidden border-t border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-0.5 px-3 py-2 min-w-max">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}>
              <span className={`block px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${isActive(l.href) ? "text-white bg-slate-800" : "text-slate-300"}`}>{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
