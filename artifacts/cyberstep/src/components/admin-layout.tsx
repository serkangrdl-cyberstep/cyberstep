import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, LayoutDashboard, Settings, CreditCard,
  FileText, Users, Briefcase, Award, Building2, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRequireAdmin } from "@/hooks/use-admin";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Genel Bakış", href: "/panel" },
  { icon: FileText, label: "Değerlendirmeler", href: "/panel/degerlendiirmeler" },
  { icon: DollarSign, label: "Ödemeler", href: "/panel/odemeler" },
  { icon: Settings, label: "Site Ayarları", href: "/panel/ayarlar" },
  { icon: CreditCard, label: "Fiyatlandırma", href: "/panel/fiyatlar" },
  { icon: Users, label: "Soru Yönetimi", href: "/panel/sorular" },
  { icon: Shield, label: "2FA Güvenlik", href: "/panel/totp" },
  { icon: Briefcase, label: "Danışmanlık", href: "/panel/danismanlik" },
  { icon: Award, label: "Teknoloji Ortakları", href: "/panel/partnerlar" },
  { icon: Building2, label: "Beyaz Etiket", href: "/panel/whitelabel" },
];

interface AdminLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AdminLayout({ title, description, children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: admin } = useRequireAdmin();

  const logoutMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); navigate("/panel/giris"); },
  });

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            <span className="font-bold text-white">CyberStep Admin</span>
          </div>
          <div className="text-slate-400 text-xs mt-1 truncate">{admin?.email}</div>
        </div>
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const active = location === href || (href !== "/panel" && location.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => navigate(href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  active
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col min-h-screen">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 shrink-0">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {description && <p className="text-slate-400 text-sm mt-0.5">{description}</p>}
        </header>
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
