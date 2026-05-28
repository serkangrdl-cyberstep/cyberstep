import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, LayoutDashboard, Settings, CreditCard,
  FileText, Users, Briefcase, Award, Building2, DollarSign,
  BookOpen, Share2, CalendarHeart, Menu, X, Globe, UserSquare2, Bot,
  ChevronDown, Mail, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRequireAdmin } from "@/hooks/use-admin";
import { useTenant } from "@/contexts/tenant-context";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Genel Bakış",         href: "/panel" },
  { icon: FileText,        label: "Değerlendirmeler",    href: "/panel/degerlendiirmeler" },
  { icon: UserSquare2,     label: "Müşteriler",          href: "/panel/musteriler" },
  { icon: Globe,           label: "Alan Adı Taramaları", href: "/panel/domain-taramalar" },
  { icon: Bot,             label: "AI Satış Asistanı",   href: "/panel/isr" },
  { icon: Bell,            label: "Bildirim Merkezi",    href: "/panel/bildirimler" },
  { icon: Mail,            label: "E-posta Şablonları",  href: "/panel/email-sablonlari" },
  { icon: DollarSign,      label: "Ödemeler",            href: "/panel/odemeler" },
  { icon: CreditCard,      label: "Fiyatlandırma",       href: "/panel/fiyatlar" },
  { icon: Users,           label: "Soru Yönetimi",       href: "/panel/sorular" },
  { icon: BookOpen,        label: "Blog",                href: "/panel/blog" },
  { icon: CalendarHeart,   label: "Özel Gün Mesajları",  href: "/panel/ozel-gunler" },
  { icon: Share2,          label: "Sosyal Medya",        href: "/panel/sosyal-medya" },
  { icon: Briefcase,       label: "Danışmanlık",         href: "/panel/danismanlik" },
  { icon: Award,           label: "Teknoloji Ortakları", href: "/panel/partnerlar" },
  { icon: Building2,       label: "Beyaz Etiket",        href: "/panel/whitelabel" },
  { icon: Settings,        label: "Site Ayarları",       href: "/panel/ayarlar" },
  { icon: Shield,          label: "2FA Güvenlik",        href: "/panel/totp" },
  { icon: Building2,       label: "Workspace Ayarları",  href: "/panel/workspace-ayarlari" },
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
  const { tenant } = useTenant();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); navigate("/panel/giris"); },
  });

  const handleNav = (href: string) => {
    navigate(href);
    setSidebarOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <span className="font-bold text-white text-sm">CyberStep Admin</span>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {tenant ? (
          <button
            onClick={() => { navigate("/panel/workspace"); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-md px-3 py-2 transition-colors text-left"
          >
            <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{tenant.name}</div>
              <div className="text-slate-500 text-xs truncate">{tenant.plan} · {tenant.role}</div>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
          </button>
        ) : (
          <button
            onClick={() => { navigate("/panel/workspace"); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md px-3 py-2 transition-colors text-left"
          >
            <Building2 className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-amber-400 text-xs">Workspace seciniz</span>
          </button>
        )}
        <div className="text-slate-500 text-xs mt-2 truncate">{admin?.email}</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = location === href || (href !== "/panel" && location.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => handleNav(href)}
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
      <div className="p-3 border-t border-slate-800">
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
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* ─── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* ─── Mobile sidebar overlay ───────────────────────────────────── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ─── Main ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col min-h-screen min-w-0">
        <header className="bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-4 shrink-0 flex items-center gap-3">
          <button
            className="lg:hidden text-slate-400 hover:text-white p-1 -ml-1"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-white truncate">{title}</h1>
            {description && <p className="text-slate-400 text-xs lg:text-sm mt-0.5 truncate">{description}</p>}
          </div>
        </header>
        <div className="flex-1 p-4 lg:p-8 overflow-x-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
