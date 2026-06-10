import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Shield, ShieldCheck, ShieldOff, QrCode, KeyRound, LogOut,
  CheckCircle2, AlertTriangle, ArrowRight, User, Building2, Mail,
  CreditCard, FileText, Heart, Search, Package, Settings,
  Globe, ShoppingCart, Wrench, Activity, XCircle,
  Flame, Lock, BarChart2, TrendingUp, TrendingDown,
  ChevronDown, Map, MonitorCheck, LayoutDashboard,
  RotateCcw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useCart } from "@/contexts/cart-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";
import { useDashboardPrefs } from "@/hooks/use-dashboard-prefs";
import { DashboardCustomizer } from "@/components/dashboard-customizer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityOverview {
  creditGrade: string;
  creditScore: number;
  domain: string | null;
  domainScore: number | null;
  lastScanAt: string | null;
  ransomwareScore: number;
  ransomwareBand: "Yüksek" | "Orta" | "Düşük";
  ransomwareFactors: string[];
  domainHijackScore: number | null;
  trend: Array<{ date: string; score: number; grade: string }>;
  sectorBenchmark: { sector: string; avgScore: number; percentile: number } | null;
  signals: {
    breachCount: number;
    criticalCveCount: number;
    orphanedAssets: number;
    openHighRiskPorts: string[];
    assessmentRisk: string | null;
  };
}

interface MyServiceItem {
  subscription: { serviceSlug: string; serviceLabel: string; status: string };
  onboardingSteps: { side: string; status: string }[];
  onboardingProgress: number;
}

// ─── Grade Config ─────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  "A+": { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  "A":  { text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30" },
  "B+": { text: "text-lime-400",    bg: "bg-lime-500/10",    border: "border-lime-500/30" },
  "B":  { text: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
  "C":  { text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  "D":  { text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
  "F":  { text: "text-red-600",     bg: "bg-red-600/10",     border: "border-red-600/30" },
};

// ─── Navigation ───────────────────────────────────────────────────────────────

function CustomerNav({
  kurulumPending,
  cartItemCount,
  onLogout,
  logoutPending,
}: {
  kurulumPending: number;
  cartItemCount: number;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  return (
    <>
      {/* Desktop nav */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Shield className="h-5 w-5 text-emerald-500" />
              <span className="font-bold text-white">CyberStep.io</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/hesabim" icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Dashboard" active />
              <NavLink href="/hesabim/guvenlik-durumu" icon={<MonitorCheck className="h-3.5 w-3.5" />} label="Güvenlik" />
              <NavLink href="/hesabim/bulgularim" icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Bulgularım" />
              <NavLink href="/raporlarim" icon={<FileText className="h-3.5 w-3.5" />} label="Raporlarım" />

              {/* Servisler dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
                    Servisler <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700 text-white min-w-[180px]">
                  <DropdownItem href="/hesabim/soc" label="SOC Paneli" />
                  <DropdownItem href="/hesabim/noc" label="NOC Paneli" />
                  <DropdownItem href="/hesabim/dns-izleme" label="DNS İzleme" />
                  <DropdownItem href="/hesabim/tedarikci-portfoyu" label="Tedarikçi Riski" />
                  <DropdownItem href="/hesabim/cloud-guvenlik" label="Cloud Güvenlik" />
                  <DropdownItem href="/hesabim/ciso-asistan" label="CISO Asistan" />
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownItem href="/pentest-lite" label="Saldırı Yüzeyi" />
                  <DropdownItem href="/ai-guvenlik" label="AI Güvenlik" />
                  <DropdownItem href="/hesabim/entegrasyonlarim" label="Entegrasyonlar" />
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link href="/hesabim/sepet">
              <button className="relative p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <ShoppingCart className="h-4 w-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-sky-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </Link>

            {/* Hesap dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
                  <User className="h-3.5 w-3.5" />
                  Hesabım <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-slate-700 text-white min-w-[180px]">
                <DropdownItem href="/hesabim/servislerim" label="Servislerim" />
                <DropdownItem href="/hesabim/faturalar" label="Faturalar" />
                <DropdownItem
                  href="/hesabim/kurulum"
                  label="Kurulum Merkezi"
                  badge={kurulumPending > 0 ? String(kurulumPending) : undefined}
                />
                <DropdownItem href="/hesabim/yonetim-raporu" label="YK Raporu" />
                <DropdownItem href="/hesabim/davet" label="Arkadaş Davet Et" />
                <DropdownItem href="/hesabim/enterprise" label="Enterprise" />
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer gap-2"
                  onClick={onLogout}
                  disabled={logoutPending}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile nav strip */}
      <div className="md:hidden border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
        <div className="flex items-center gap-0.5 px-3 py-2 min-w-max">
          {[
            { href: "/hesabim", label: "Dashboard" },
            { href: "/hesabim/guvenlik-durumu", label: "Güvenlik" },
            { href: "/hesabim/bulgularim", label: "Bulgular" },
            { href: "/raporlarim", label: "Raporlar" },
            { href: "/hesabim/servislerim", label: "Servisler" },
            { href: "/hesabim/kurulum", label: "Kurulum" },
            { href: "/hesabim/tedarikci-portfoyu", label: "Tedarikçi" },
            { href: "/hesabim/davet", label: "Davet" },
          ].map(({ href, label }) => (
            <Link key={href} href={href}>
              <span className="block px-3 py-1.5 rounded-md text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link href={href}>
      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "text-white bg-slate-800 font-medium"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      }`}>
        {icon}{label}
      </span>
    </Link>
  );
}

function DropdownItem({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 gap-2">
      <Link href={href}>
        <span className="flex items-center justify-between w-full">
          {label}
          {badge && (
            <span className="bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {badge}
            </span>
          )}
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

// ─── Signal Pills ─────────────────────────────────────────────────────────────

function SignalPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${
      ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" : "border-red-500/30 bg-red-500/5 text-red-500"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

function SignalPillsWidget({ signals }: { signals: SecurityOverview["signals"] }) {
  const s = signals;
  return (
    <div className="flex flex-wrap gap-2">
      <SignalPill ok={s.breachCount === 0} label={s.breachCount === 0 ? "Sızıntı Yok" : `${s.breachCount} Sızıntı`} />
      <SignalPill ok={s.criticalCveCount === 0} label={s.criticalCveCount === 0 ? "Kritik CVE Yok" : `${s.criticalCveCount} Kritik CVE`} />
      <SignalPill ok={s.orphanedAssets === 0} label={s.orphanedAssets === 0 ? "Gölge IT Yok" : `${s.orphanedAssets} Korumasız Varlık`} />
      <SignalPill ok={s.openHighRiskPorts.length === 0} label={s.openHighRiskPorts.length === 0 ? "Kritik Port Kapalı" : `Açık: ${s.openHighRiskPorts.slice(0, 3).join(", ")}`} />
      <SignalPill ok={s.assessmentRisk !== "Kritik" && s.assessmentRisk !== "Yüksek"} label={`Assessment: ${s.assessmentRisk ?? "Yok"}`} />
    </div>
  );
}

// ─── Score Trend Widget ────────────────────────────────────────────────────────

function ScoreTrendWidget({ trend }: { trend: Array<{ date: string; score: number; grade: string }> }) {
  if (trend.length < 2) {
    return (
      <Card className="bg-slate-900 border-slate-700 h-full">
        <CardContent className="flex flex-col items-center justify-center h-full py-8">
          <TrendingUp className="h-7 w-7 text-slate-600 mb-2" />
          <p className="text-sm text-slate-500 text-center">Trend için en az 2 tarama gerekli</p>
          <Link href="/domain-tarama">
            <Button variant="ghost" size="sm" className="mt-3 text-primary gap-1">
              Tarama Başlat <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const first = trend[0]!.score;
  const last = trend[trend.length - 1]!.score;
  const delta = last - first;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-white">
            <TrendingUp className="h-4 w-4 text-primary" /> Güvenlik Trendi
          </span>
          <span className={`text-xs flex items-center gap-1 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtDate} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [v, "Skor"]}
                labelFormatter={fmtDate}
              />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Security Roadmap Widget ───────────────────────────────────────────────────

interface RoadmapItem { horizon: "30" | "90" | "180"; text: string; done?: boolean }

function getSecurityRoadmap(score: number): RoadmapItem[] {
  if (score < 40) {
    return [
      { horizon: "30", text: "Incident Response planı oluştur veya güncelle" },
      { horizon: "30", text: "EDR/AV çözümü tüm cihazlara dağıt" },
      { horizon: "30", text: "Kritik yamaları önceliklendir ve uygula" },
      { horizon: "90", text: "Tüm hesaplarda MFA'yı zorunlu hale getir" },
      { horizon: "90", text: "SPF, DMARC ve DKIM e-posta güvenlik kayıtlarını yapılandır" },
      { horizon: "90", text: "Kapsamlı güvenlik açığı değerlendirmesi yap" },
      { horizon: "180", text: "Güvenlik politikası ve prosedürlerini belgele" },
      { horizon: "180", text: "KVKK uyumluluk denetimi gerçekleştir" },
      { horizon: "180", text: "Çalışan güvenlik farkındalık eğitimi başlat" },
    ];
  }
  if (score < 60) {
    return [
      { horizon: "30", text: "SPF, DMARC ve DKIM kayıtlarını eksiksiz yapılandır" },
      { horizon: "30", text: "Yönetici hesaplarında MFA'yı aktifleştir" },
      { horizon: "30", text: "Kritik güvenlik yamalarını bir hafta içinde uygula" },
      { horizon: "90", text: "EDR çözümü değerlendir ve pilot uygula" },
      { horizon: "90", text: "Yedekleme sistemini test et ve RTO/RPO tanımla" },
      { horizon: "90", text: "Firewall kurallarını gözden geçir ve gereksizleri kapat" },
      { horizon: "180", text: "Penetrasyon testi planla ve uygulat" },
      { horizon: "180", text: "Tedarikçi güvenlik değerlendirmesi yap" },
      { horizon: "180", text: "KVKK teknik tedbirler haritasını güncelle" },
    ];
  }
  if (score < 80) {
    return [
      { horizon: "30", text: "Eksik DMARC/DKIM yapılandırmalarını tamamla" },
      { horizon: "30", text: "Aylık yama takvimi oluştur ve işlet" },
      { horizon: "30", text: "Güvenlik açığı tarama sıklığını artır" },
      { horizon: "90", text: "Güvenlik farkındalık eğitimi düzenle" },
      { horizon: "90", text: "SOC/SIEM çözümü değerlendirme başlat" },
      { horizon: "90", text: "Tedarikçi risk profillerini gözden geçir" },
      { horizon: "180", text: "Yıllık penetrasyon testi yaptır" },
      { horizon: "180", text: "Supply chain risk değerlendirmesi yap" },
    ];
  }
  return [
    { horizon: "30", text: "Mevcut güvenlik kontrollerinin etkinliğini doğrula" },
    { horizon: "30", text: "Yama yönetimi sürecini çeyreklik olarak gözden geçir" },
    { horizon: "90", text: "Çeyreklik güvenlik değerlendirmesi yap" },
    { horizon: "90", text: "Tedarikçi güvenlik skorlarını gözden geçir" },
    { horizon: "180", text: "Yıllık penetrasyon testi ve bağımsız denetim" },
    { horizon: "180", text: "Yönetim kurulu raporunu gözden geçir ve onayat" },
  ];
}

const HORIZON_CONFIG = {
  "30":  { label: "30 Gün",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  "90":  { label: "90 Gün",  color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  "180": { label: "180 Gün", color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
};

function SecurityRoadmapWidget({ score }: { score: number }) {
  const items = getSecurityRoadmap(score);
  const grouped: Record<"30" | "90" | "180", string[]> = { "30": [], "90": [], "180": [] };
  for (const item of items) grouped[item.horizon].push(item.text);

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-white">
          <Map className="h-4 w-4 text-primary" /> Güvenlik Yol Haritası
        </CardTitle>
        <CardDescription className="text-slate-500 text-xs">
          Mevcut skora göre önerilen aksiyonlar
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {(["30", "90", "180"] as const).map(horizon => {
          const cfg = HORIZON_CONFIG[horizon];
          const horizonItems = grouped[horizon];
          if (horizonItems.length === 0) return null;
          return (
            <div key={horizon} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${cfg.color} mb-2`}>
                {cfg.label}
              </p>
              <ul className="space-y-1.5">
                {horizonItems.map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <ArrowRight className={`h-3 w-3 ${cfg.color} shrink-0 mt-0.5`} />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Ransomware Widget ────────────────────────────────────────────────────────

function RansomwareWidget({ score, band, factors }: { score: number; band: string; factors: string[] }) {
  const cfg =
    band === "Yüksek" ? { color: "text-red-400", bar: "bg-red-500", border: "border-red-500/30" } :
    band === "Orta"   ? { color: "text-amber-400", bar: "bg-amber-500", border: "border-amber-500/30" } :
                        { color: "text-emerald-400", bar: "bg-emerald-500", border: "border-emerald-500/30" };
  return (
    <Card className={`bg-slate-900 border ${cfg.border}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-white">
          <Flame className="h-4 w-4 text-orange-500" /> Fidye Yazılımı Riski
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-3xl font-black ${cfg.color}`}>{score}</span>
          <span className="text-slate-500 text-sm pb-0.5">/100</span>
          <Badge className={`ml-auto border ${cfg.color} ${cfg.border} bg-transparent text-xs`}>
            {band} Risk
          </Badge>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-3">
          <div className={`h-1.5 rounded-full ${cfg.bar}`} style={{ width: `${score}%` }} />
        </div>
        {factors.slice(0, 3).map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-400 mb-1">
            <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
            {f}
          </div>
        ))}
        {factors.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Bilinen fidye yazılımı vektörü yok
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Domain Hijack Widget ─────────────────────────────────────────────────────

function DomainHijackWidget({ score }: { score: number | null }) {
  if (score === null) return null;
  const band = score >= 80 ? "Güçlü" : score >= 60 ? "Orta" : "Zayıf";
  const cfg =
    score >= 80 ? { color: "text-emerald-400", bar: "bg-emerald-500" } :
    score >= 60 ? { color: "text-amber-400",   bar: "bg-amber-500" } :
                  { color: "text-red-400",      bar: "bg-red-500" };
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-white">
          <Lock className="h-4 w-4 text-primary" /> Domain Dayanıklılığı
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-3xl font-black ${cfg.color}`}>{score}</span>
          <span className="text-slate-500 text-sm pb-0.5">/100</span>
          <Badge className="ml-auto" variant="outline">{band}</Badge>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-3">
          <div className={`h-1.5 rounded-full ${cfg.bar}`} style={{ width: `${score}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          SPF, DKIM, DMARC, SSL ve kara liste durumuna göre hesaplanır.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Sector Benchmark Widget ──────────────────────────────────────────────────

function SectorBenchmarkWidget({
  benchmark,
  myScore,
}: {
  benchmark: { sector: string; avgScore: number; percentile: number };
  myScore: number | null;
}) {
  const score = myScore ?? 50;
  const diff = score - benchmark.avgScore;
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-white">
          <BarChart2 className="h-4 w-4 text-primary" /> Sektör Karşılaştırması
          <Badge variant="outline" className="text-xs ml-auto">{benchmark.sector}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-white">{score}</p>
            <p className="text-xs text-slate-500">Sizin</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {diff >= 0 ? "+" : ""}{diff}
            </p>
            <p className="text-xs text-slate-500">fark</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-slate-400">{benchmark.avgScore}</p>
            <p className="text-xs text-slate-500">Sektör</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-center text-slate-400">
          {diff >= 0
            ? `Sektörünüzün %${benchmark.percentile}'inden üstesiniz.`
            : `Sektör ortalamasının ${Math.abs(diff)} puan altındasınız.`}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Health Score Widget ──────────────────────────────────────────────────────

function HealthScoreWidget() {
  const { data } = useQuery<{
    healthScore: number; healthTier: string; churnProbability: string;
  }>({
    queryKey: ["my-health-score"],
    queryFn: () => fetch("/api/health/my-score", { credentials: "include" }).then(r => r.json()),
    staleTime: 1000 * 60 * 10,
  });

  if (!data) return null;

  const cfg =
    data.healthTier === "healthy"  ? { color: "text-emerald-400", border: "border-emerald-500/30", label: "Sağlıklı" } :
    data.healthTier === "at_risk"  ? { color: "text-amber-400",   border: "border-amber-500/30",   label: "Risk Altında" } :
                                     { color: "text-red-400",      border: "border-red-500/30",      label: "Kritik" };

  return (
    <Card className={`bg-slate-900 border ${cfg.border}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <Heart className={`h-7 w-7 ${cfg.color} shrink-0`} />
        <div>
          <p className="text-xs text-slate-500">Hesap Sağlığı</p>
          <p className={`text-2xl font-bold ${cfg.color}`}>{data.healthScore}<span className="text-sm text-slate-500 font-normal">/100</span></p>
          <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
        </div>
        <Link href="/hesabim/guvenlik-durumu" className="ml-auto">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1 text-xs">
            Detay <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Active Services Widget ───────────────────────────────────────────────────

function ActiveServicesWidget() {
  const { data: myServices = [] } = useQuery<MyServiceItem[]>({
    queryKey: ["my-services"],
    queryFn: async () => {
      const res = await fetch("/api/customer/my-services", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const active = myServices.filter(m => m.subscription.status === "active");
  if (active.length === 0) return null;

  const pendingSteps = active.flatMap(m => m.onboardingSteps.filter(s => s.side === "customer" && s.status === "pending"));

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-sky-400 shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">{active.length} Aktif Servis</p>
            {pendingSteps.length > 0 && (
              <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 mt-0.5">
                <Settings className="w-2.5 h-2.5" /> {pendingSteps.length} adım bekliyor
              </Badge>
            )}
          </div>
        </div>
        <Link href="/hesabim/servislerim">
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800 gap-1.5">
            Yönet <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Vendor Risk Widget ───────────────────────────────────────────────────────

function VendorRiskWidget() {
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-violet-400 shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">Tedarikçi Riski</p>
            <p className="text-xs text-slate-500">Vendor portföyü güvenlik durumu</p>
          </div>
        </div>
        <Link href="/hesabim/tedarikci-portfoyu">
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800 gap-1.5">
            Görüntüle <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ customer }: { customer: { subscriptionPlan?: string | null; subscriptionStatus: string; email: string } }) {
  const { visibility, toggle, reset, isVisible } = useDashboardPrefs();

  const { data: overview, isLoading } = useQuery<SecurityOverview>({
    queryKey: ["security-overview"],
    queryFn: () =>
      fetch("/api/customer/security-overview", { credentials: "include" }).then(r => {
        if (!r.ok) throw new Error("Yüklenemedi");
        return r.json();
      }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: kurulumData } = useQuery<{
    totalCustomerSteps: number; doneCustomerSteps: number; overallProgress: number;
  }>({
    queryKey: ["kurulum-durumu"],
    queryFn: () => fetch("/api/customer/kurulum-durumu", { credentials: "include" }).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  const kurulumTotal = kurulumData?.totalCustomerSteps ?? 0;
  const kurulumDone = kurulumData?.doneCustomerSteps ?? 0;
  const kurulumPct = kurulumData?.overallProgress ?? 0;
  const kurulumPending = kurulumTotal - kurulumDone;

  const grade = overview?.creditGrade;
  const score = overview?.creditScore ?? 0;
  const gradeCfg = grade ? (GRADE_COLORS[grade] ?? GRADE_COLORS["C"]!) : null;

  const isCritical = grade === "D" || grade === "F";

  return (
    <div className="space-y-5">
      {/* Dashboard header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" /> Dashboard
          </h1>
          {overview?.domain ? (
            <p className="text-slate-400 text-sm mt-0.5">
              {overview.domain}
              {overview.lastScanAt && ` · Son tarama: ${new Date(overview.lastScanAt).toLocaleDateString("tr-TR")}`}
            </p>
          ) : (
            <p className="text-slate-500 text-sm mt-0.5">Güvenlik verisi için domain taraması yapın</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {grade && gradeCfg && (
            <div className={`rounded-xl ${gradeCfg.bg} ${gradeCfg.border} border px-3 py-1.5 flex items-center gap-2`}>
              <span className={`text-lg font-black ${gradeCfg.text}`}>{grade}</span>
              <span className="text-slate-400 text-xs">{score}/100</span>
            </div>
          )}
          <DashboardCustomizer visibility={visibility} toggle={toggle} reset={reset} />
        </div>
      </div>

      {/* Critical alert banner */}
      {isCritical && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 font-semibold text-sm">Kritik Güvenlik Riski Tespit Edildi</p>
            <p className="text-slate-400 text-xs mt-0.5">Güvenlik notunuz {grade}. Acil aksiyonlar için bulgularınızı inceleyin ve yol haritasını takip edin.</p>
          </div>
          <Link href="/hesabim/bulgularim">
            <Button size="sm" className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 gap-1.5 shrink-0">
              Bulgular <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Quick actions — always visible */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/assessment/start">
          <Card className="border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors cursor-pointer">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="text-white text-xs font-semibold">Değerlendirme</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/domain-tarama">
          <Card className="border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 transition-colors cursor-pointer">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
              <Globe className="h-5 w-5 text-sky-400" />
              <p className="text-white text-xs font-semibold">Domain Tara</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/raporlarim">
          <Card className="border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-pointer">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
              <FileText className="h-5 w-5 text-violet-400" />
              <p className="text-white text-xs font-semibold">Raporlarım</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* No data state */}
      {!isLoading && !overview?.domain && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-8 text-center">
            <Shield className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Güvenlik verisi bekleniyor</p>
            <p className="text-slate-500 text-sm mb-4">İlk domain taramanızı yaparak güvenlik durumunuzu öğrenin.</p>
            <Link href="/domain-tarama">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                Domain Taraması Başlat <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Widgets — only when data available */}
      {overview && (
        <div className="space-y-4">
          {/* Signal Pills — full width */}
          {isVisible("signal_pills") && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Anlık Durum</p>
              <SignalPillsWidget signals={overview.signals} />
            </div>
          )}

          {/* Trend + Roadmap */}
          {(isVisible("score_trend") || isVisible("security_roadmap")) && (
            <div className="grid md:grid-cols-2 gap-4">
              {isVisible("score_trend") && <ScoreTrendWidget trend={overview.trend} />}
              {isVisible("security_roadmap") && <SecurityRoadmapWidget score={score} />}
            </div>
          )}

          {/* Ransomware + Domain Hijack */}
          {(isVisible("ransomware") || isVisible("domain_hijack")) && (
            <div className="grid md:grid-cols-2 gap-4">
              {isVisible("ransomware") && (
                <RansomwareWidget
                  score={overview.ransomwareScore}
                  band={overview.ransomwareBand}
                  factors={overview.ransomwareFactors}
                />
              )}
              {isVisible("domain_hijack") && <DomainHijackWidget score={overview.domainHijackScore} />}
            </div>
          )}

          {/* Sector Benchmark — full width */}
          {isVisible("sector_benchmark") && overview.sectorBenchmark && (
            <SectorBenchmarkWidget benchmark={overview.sectorBenchmark} myScore={overview.domainScore} />
          )}
        </div>
      )}

      {/* Kurulum */}
      {isVisible("kurulum_durumu") && kurulumTotal > 0 && (
        <Link href="/hesabim/kurulum">
          <Card className="border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" />
                  <span className="text-white text-sm font-medium">Kurulum Durumu</span>
                </div>
                {kurulumPending > 0 ? (
                  <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">{kurulumPending} bekleyen adım</Badge>
                ) : (
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Tamamlandı</Badge>
                )}
              </div>
              <Progress value={kurulumPct} className="h-1.5" />
              <p className="text-slate-400 text-xs mt-1.5">{kurulumDone}/{kurulumTotal} adım tamamlandı</p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Optional widgets */}
      {isVisible("health_score") && <HealthScoreWidget />}
      {isVisible("active_services") && <ActiveServicesWidget />}
      {isVisible("vendor_risk") && <VendorRiskWidget />}

      {/* Plan features */}
      {isVisible("plan_features") && (
        <PlanFeaturesWidget plan={customer.subscriptionPlan} status={customer.subscriptionStatus} />
      )}

      {/* Explore section */}
      <div className="border-t border-slate-800 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Hızlı Erişim</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/hesabim/bulgularim", icon: AlertTriangle, label: "Bulgularım", color: "text-red-400" },
            { href: "/hesabim/tedarikci-portfoyu", icon: Shield, label: "Tedarikçi", color: "text-violet-400" },
            { href: "/hesabim/ciso-asistan", icon: Activity, label: "CISO Asistan", color: "text-primary" },
            { href: "/hesabim/yonetim-raporu", icon: FileText, label: "YK Raporu", color: "text-sky-400" },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link key={href} href={href}>
              <div className="border border-slate-800 rounded-xl p-3 hover:border-slate-700 hover:bg-slate-800/50 transition-colors text-center cursor-pointer">
                <Icon className={`h-4 w-4 ${color} mx-auto mb-1.5`} />
                <p className="text-xs text-slate-300 font-medium">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Plan Features Widget ─────────────────────────────────────────────────────

function PlanFeaturesWidget({ plan, status }: { plan?: string | null; status: string }) {
  const isFullPlan = plan === "full" || plan === "premium";
  const miniFeatures = [
    "20 soruluk hızlı risk değerlendirmesi",
    "Domain tarama: SPF, DMARC, DKIM, MX, SSL",
    "HIBP veri sızıntısı & kara liste kontrolü",
    "Shadow IT servis tespiti",
    "AI destekli temel rapor",
  ];
  const fullOnlyFeatures = [
    "60 soruluk kapsamlı değerlendirme",
    "NIST NVD CVE güvenlik açığı taraması",
    "KVKK Madde 12 Teknik Tedbir Haritası",
    "Sektörel karşılaştırma",
    "PDF rapor indirme",
  ];

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-emerald-400" /> Hizmet Planım
        </CardTitle>
        <CardDescription className="text-slate-400">
          {isFullPlan ? "Tam Plan — tüm özellikler aktif" : "Mini (Ücretsiz) — Tam Plan ile genişletin"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {(isFullPlan ? [...miniFeatures, ...fullOnlyFeatures] : miniFeatures).map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />{f}
            </div>
          ))}
        </div>
        {!isFullPlan && (
          <Link href="/assessment/full/start">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2">
              Tam Plana Geç <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Account Settings Tab ─────────────────────────────────────────────────────

function AccountSettingsTab({ customer }: {
  customer: {
    fullName: string; email: string; companyName?: string | null;
    subscriptionPlan?: string | null; subscriptionStatus: string; totpEnabled: boolean;
  };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [totpStep, setTotpStep] = useState<"idle" | "setup" | "done">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: () =>
      fetch("/api/auth/totp-setup", { method: "POST", credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json() as Promise<{ secret: string; qrDataUrl: string }>;
      }),
    onSuccess: (data) => { setQrDataUrl(data.qrDataUrl); setSecret(data.secret); setTotpStep("setup"); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (tok: string) =>
      fetch("/api/auth/totp-confirm", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error ?? "Hata"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      setTotpStep("done"); setError(null);
      toast({ title: "2FA Aktif", description: "İki faktörlü doğrulama etkinleştirildi." });
    },
    onError: (e: Error) => setError(e.message),
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      fetch("/api/auth/totp-disable", { method: "POST", credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      setTotpStep("idle");
      toast({ title: "2FA Devre Dışı", description: "İki faktörlü doğrulama kapatıldı." });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const subscriptionLabel: Record<string, string> = { active: "Aktif", inactive: "Pasif", trial: "Deneme" };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Hesap Ayarları</h2>

      {/* Profile */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-400" /> Profil Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Ad Soyad</p>
            <p className="text-white font-medium">{customer.fullName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-posta</p>
            <p className="text-white">{customer.email}</p>
          </div>
          {customer.companyName && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Şirket</p>
              <p className="text-white">{customer.companyName}</p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Üyelik</p>
            <div className="flex items-center gap-2">
              <span className="text-white">{customer.subscriptionPlan ?? "Ücretsiz"}</span>
              <Badge className={customer.subscriptionStatus === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400 border-slate-600"}>
                {subscriptionLabel[customer.subscriptionStatus] ?? customer.subscriptionStatus}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            {customer.totpEnabled ? <ShieldCheck className="h-5 w-5 text-emerald-400" /> : <ShieldOff className="h-5 w-5 text-slate-400" />}
            İki Faktörlü Doğrulama
          </CardTitle>
          <CardDescription className="text-slate-400">Hesabınıza yetkisiz erişimi engelleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          {totpStep === "idle" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={customer.totpEnabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400 border-slate-600"}>
                  {customer.totpEnabled ? "Aktif" : "Pasif"}
                </Badge>
                <span className="text-slate-300 text-sm">
                  {customer.totpEnabled ? "Hesabınız 2FA ile korunuyor" : "2FA henüz etkinleştirilmedi"}
                </span>
              </div>
              {customer.totpEnabled ? (
                <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => disableMutation.mutate()} disabled={disableMutation.isPending}>
                  <ShieldOff className="h-4 w-4 mr-2" /> Devre Dışı Bırak
                </Button>
              ) : (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
                  <QrCode className="h-4 w-4 mr-2" />
                  {setupMutation.isPending ? "Hazırlanıyor..." : "2FA Etkinleştir"}
                </Button>
              )}
            </div>
          )}
          {totpStep === "setup" && qrDataUrl && (
            <div className="space-y-5">
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <img src={qrDataUrl} alt="TOTP QR" className="w-40 h-40" />
                </div>
              </div>
              {secret && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Manuel giriş için gizli anahtar:</p>
                  <code className="text-emerald-400 text-xs font-mono break-all">{secret}</code>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-400" /> Doğrulama Kodu
                </label>
                <input type="text" inputMode="numeric" maxLength={6} value={token}
                  onChange={e => { setToken(e.target.value.replace(/\D/g, "")); setError(null); }}
                  placeholder="123456"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 text-xl tracking-widest text-center outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
                {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertTriangle className="h-4 w-4" /> {error}</div>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => { setTotpStep("idle"); setQrDataUrl(null); setSecret(null); setToken(""); }}>
                  İptal
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => token.length === 6 && confirmMutation.mutate(token)}
                  disabled={token.length !== 6 || confirmMutation.isPending}>
                  {confirmMutation.isPending ? "Doğrulanıyor..." : "Etkinleştir"}
                </Button>
              </div>
            </div>
          )}
          {totpStep === "done" && (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-emerald-300 text-sm">2FA başarıyla etkinleştirildi.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan */}
      <PlanFeaturesWidget plan={customer.subscriptionPlan} status={customer.subscriptionStatus} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerAccount() {
  const qc = useQueryClient();
  const { data: customer } = useRequireCustomer();
  const { itemCount: cartItemCount } = useCart();
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");

  const { data: kurulumData } = useQuery<{ overallProgress: number; totalCustomerSteps: number; doneCustomerSteps: number }>({
    queryKey: ["kurulum-durumu"],
    queryFn: () => fetch("/api/customer/kurulum-durumu", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
    staleTime: 1000 * 60 * 5,
  });

  const kurulumPending = (kurulumData?.totalCustomerSteps ?? 0) - (kurulumData?.doneCustomerSteps ?? 0);

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <CustomerNav
        kurulumPending={kurulumPending}
        cartItemCount={cartItemCount}
        onLogout={() => logoutMutation.mutate()}
        logoutPending={logoutMutation.isPending}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Tab selector */}
        <div className="flex gap-1 mb-6 border-b border-slate-800 pb-0">
          {[
            { id: "dashboard" as const, label: "Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
            { id: "settings" as const, label: "Hesap Ayarları", icon: <Settings className="h-3.5 w-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && <DashboardTab customer={customer} />}
        {activeTab === "settings" && <AccountSettingsTab customer={customer} />}
      </div>
    </div>
  );
}
