import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, LayoutDashboard, Settings, CreditCard, Search,
  FileText, Users, Briefcase, Award, Building2, DollarSign,
  Menu, X, Globe, UserSquare2, Bot,
  Mail, Bell, Package, Plug, Heart,
  Telescope, Handshake, ListTodo, Target,
  Receipt, TrendingUp, CheckSquare, Star, Calculator,
  Play, Tag, UserCheck, Activity, Network, ShieldAlert, ScrollText,
  ChevronDown, Cpu, BarChart3, Palette, Sunrise, ToggleLeft, Newspaper,
  Zap, ShoppingCart, Code, Fingerprint, Rocket,
  Wrench, Gauge, Gift, Share2, MonitorCheck, Layers, CalendarDays, Share, GitBranch, ClipboardCheck, Medal, CalendarCheck,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRequireAdmin } from "@/hooks/use-admin";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";


// dept: hangi admin departmanlarının bu bölümü görebileceği (mevcut departman anahtarları korunur).
// Superadmin her zaman tüm bölümleri görür.
//
// TPRM odaklı sadeleştirme (Kasım 2026): kullanılmayan sayfalar menüden çıkarıldı ve
// lib/archived-routes.ts → ARCHIVED_ADMIN listesine alındı (kod silinmedi, adresleri /panel'e yönlenir).
// İçerik işleri (blog, sosyal medya, özel günler, rozetler, demo raporlar, marka kılavuzu)
// Marketing panelinde (/digest/) toplandı.
const NAV_SECTIONS = [
  {
    title: "Genel",
    dept: "genel",
    items: [
      { icon: LayoutDashboard, label: "Genel Bakış",            href: "/panel" },
      { icon: Sunrise,         label: "Günlük Özet",             href: "/panel/gunluk-ozet" },
      { icon: Activity,        label: "Sistem Durumu",           href: "/panel/status" },
    ],
  },
  {
    title: "Müşteriler & Tedarikçi Riski",
    dept: "musteriler",
    items: [
      { icon: UserSquare2,     label: "Müşteriler ve Paketler",  href: "/panel/musteriler" },
      { icon: Globe,           label: "Alan Adı Taramaları",     href: "/panel/domain-taramalar" },
      { icon: Shield,          label: "Güven Rozeti",            href: "/panel/guven-rozeti-admin" },
      { icon: FileText,        label: "KOBİ Değerlendirmeleri",  href: "/panel/degerlendirmeler" },
      { icon: Users,           label: "Değerlendirme Soruları",  href: "/panel/sorular" },
      { icon: FileText,        label: "YK Raporları",            href: "/panel/yonetim-raporlari" },
    ],
  },
  {
    title: "Veri & Keşif",
    dept: "istihbarat",
    items: [
      { icon: Globe,           label: "Domain Keşfi (Lead Discovery)", href: "/panel/lead-discovery" },
      { icon: BarChart3,       label: "Kaynak Dashboard",        href: "/panel/source-dashboard" },
      { icon: Rocket,          label: "Growth Engine",           href: "/panel/growth-engine" },
      { icon: TrendingUp,      label: "Siber Güvenlik Endeksi",  href: "/panel/endeks-raporu" },
      { icon: CalendarCheck,   label: "Dönemsel Risk Raporları", href: "/panel/risk-raporlari" },
      { icon: ShieldAlert,     label: "CVE İzleme",              href: "/panel/cve" },
      { icon: Zap,             label: "Acil Tehdit Bildirimleri", href: "/panel/acil-tehditler" },
    ],
  },
  {
    title: "Satış & Gelir",
    dept: "satis",
    items: [
      { icon: Receipt,         label: "Fatura Yönetimi",         href: "/panel/faturalar" },
      { icon: DollarSign,      label: "Ödemeler",                href: "/panel/odemeler" },
      { icon: TrendingUp,      label: "Gelir / MRR",             href: "/panel/gelir" },
    ],
  },
  {
    title: "Enterprise & Lead",
    dept: "enterprise",
    items: [
      { icon: Telescope,       label: "Enterprise: Adaylar",     href: "/panel/enterprise/prospects" },
      { icon: GitBranch,       label: "Enterprise: Pipeline",    href: "/panel/enterprise/pipeline" },
      { icon: Handshake,       label: "Enterprise: Sözleşmeler", href: "/panel/enterprise/contracts" },
      { icon: ListTodo,        label: "Lead Kuyruğu",            href: "/panel/lead-gen/queue" },
      { icon: Target,          label: "Lead Kampanyaları",       href: "/panel/lead-gen/campaigns" },
      { icon: ShoppingCart,    label: "ISR İş Listesi",          href: "/panel/isr" },
    ],
  },
  {
    title: "İş Ortakları",
    dept: "ortaklar",
    items: [
      { icon: Building2,       label: "İş Ortakları",            href: "/panel/is-ortaklari" },
      { icon: Handshake,       label: "İş Ortaklığı Başvuruları", href: "/panel/is-ortakligi-basvurulari" },
    ],
  },
  {
    title: "İçerik & İletişim",
    dept: "icerik",
    items: [
      { icon: Newspaper,       label: "Marketing Paneli",        href: "/digest/" },
      { icon: ShieldAlert,     label: "Haftalık Bülten",         href: "/panel/bulletin" },
      { icon: Mail,            label: "E-posta Şablonları",      href: "/panel/email-sablonlari" },
      { icon: Bell,            label: "Bildirim Merkezi",        href: "/panel/bildirimler" },
    ],
  },
  {
    title: "Sistem & Ayarlar",
    dept: "sistem",
    items: [
      { icon: Activity,        label: "Platform Sağlığı",        href: "/panel/platform-saglik" },
      { icon: Play,            label: "Cron Ayarları",           href: "/panel/cron-ayarlari" },
      { icon: Play,            label: "Manuel Tetikleme",        href: "/panel/manuel-tetikle" },
      { icon: ClipboardCheck,  label: "Onay Kuyruğu (HITL)",     href: "/panel/approvals" },
      { icon: CheckSquare,     label: "Görev Motoru",            href: "/panel/gorevler" },
      { icon: DollarSign,      label: "AI Maliyet",              href: "/panel/ai-costs" },
      { icon: Plug,            label: "Entegrasyonlar",          href: "/panel/entegrasyonlar" },
      { icon: Settings,        label: "Site Ayarları",           href: "/panel/ayarlar" },
      { icon: Users,           label: "Yönetici Yönetimi",       href: "/panel/yoneticiler" },
      { icon: Shield,          label: "2FA Güvenlik",            href: "/panel/totp" },
    ],
  },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Departman filtrelemesi: superadmin her şeyi görür, diğerleri yalnızca kendi departmanlarını
  const visibleSections = NAV_SECTIONS.filter(s => {
    if (!admin) return true; // henüz yüklenmedi, hepsini göster (flicker önleme)
    if (admin.isSuperadmin) return true;
    return admin.departments.includes(s.dept);
  });

  // Aktif sayfanın bulunduğu grup açık, diğerleri kapalı başlar
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const activeSection = NAV_SECTIONS.find(s =>
      s.items.some(item => location === item.href || (item.href !== "/panel" && location.startsWith(item.href)))
    );
    return new Set(NAV_SECTIONS.filter(s => s !== activeSection).map(s => s.title));
  });

  const toggleSection = (title: string) =>
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });

  const logoutMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); navigate("/panel/giris"); },
  });

  const handleNav = (href: string) => {
    setSidebarOpen(false);
    if (href.startsWith("/panel")) {
      navigate(href);
    } else {
      window.location.href = href;
    }
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
        <div className="text-slate-500 text-xs mt-1 truncate">{admin?.email}</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleSections.map((section) => {
          const isCollapsed = collapsedSections.has(section.title);
          const hasActiveItem = section.items.some(
            item => location === item.href || (item.href !== "/panel" && location.startsWith(item.href))
          );
          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors group"
              >
                <span className={hasActiveItem && isCollapsed ? "text-emerald-500" : ""}>{section.title}</span>
                <ChevronDown
                  className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                />
              </button>
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {section.items.map(({ icon: Icon, label, href }) => {
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
                </div>
              )}
            </div>
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
          <AdminErrorBoundary key={location}>
            {children}
          </AdminErrorBoundary>
        </div>
      </main>
    </div>
  );
}
