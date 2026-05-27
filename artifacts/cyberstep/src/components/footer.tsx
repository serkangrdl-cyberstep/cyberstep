import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";

export function Footer() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 300000,
  });

  const company = settings?.["footer.company"] ?? "CyberStep.io";
  const tagline = settings?.["footer.tagline"] ?? "KOBİ'ler için siber güvenlik risk analizi";
  const email = settings?.["contact.email"] ?? "info@cyberstep.io";

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-6 w-6 text-emerald-400" />
              <span className="font-bold text-white text-lg">{company}</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">{tagline}</p>
            <a href={`mailto:${email}`} className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors">{email}</a>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Mini Degerlendirme", href: "/assessment/start" },
                { label: "Tam Degerlendirme", href: "/assessment/full/start" },
                { label: "Fiyatlar", href: "/fiyatlar" },
                { label: "Dashboard", href: "/dashboard" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-slate-400 text-sm hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kurumsal */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Kurumsal</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Hakkimizda", href: "/hakkimizda" },
                { label: "Iletisim", href: "/iletisim" },
                { label: "KVKK", href: "/kvkk" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-slate-400 text-sm hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-xs">
            {new Date().getFullYear()} {company}. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/kvkk" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">KVKK</Link>
            <Link href="/iletisim" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">Iletisim</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
