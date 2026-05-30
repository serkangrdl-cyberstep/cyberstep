import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileText, Settings, CreditCard,
  TrendingUp, CheckCircle, Clock,
  BarChart3, DollarSign, Globe, Users,
  Database, ChevronDown, ChevronUp, ExternalLink, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface OverviewData {
  totalAssessments: number;
  completedAssessments: number;
  thisMonthAssessments: number;
  lastMonthAssessments: number;
  totalRevenue: number;
  monthRevenue: number;
  totalKdv: number;
  monthKdv: number;
  netRevenue: number;
  avgScore: number;
  riskDistribution: Record<string, number>;
  pendingReviews: number;
  totalCustomers?: number;
  activeSubscriptions?: number;
  totalDomainScans?: number;
  avgDomainScore?: number;
}

interface MonthlyRow { month: string; assessment_count: number; completed_count: number; }
interface PaymentRow { month: string; revenue: number; kdv: number; }

function StatCard({ title, value, sub, icon: Icon, color = "text-emerald-400" }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-sm">{title}</span>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        {sub && <div className="text-slate-500 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => fetch("/api/admin-panel/analytics/overview", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: monthly } = useQuery<{ monthly: MonthlyRow[]; payments: PaymentRow[] }>({
    queryKey: ["admin-monthly"],
    queryFn: () => fetch("/api/admin-panel/analytics/monthly", { credentials: "include" }).then(r => r.json()),
  });

  const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
  const fmtCur = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

  const riskColors: Record<string, string> = { "Kritik": "#dc2626", "Yüksek": "#ea580c", "Orta": "#d97706", "Düşük": "#16a34a" };
  const riskData = Object.entries(overview?.riskDistribution ?? {}).map(([name, value]) => ({ name, value, fill: riskColors[name] ?? "#64748b" }));

  const chartData = (monthly?.monthly ?? []).map(m => {
    const pay = monthly?.payments?.find(p => p.month === m.month);
    return { month: m.month.slice(5), assessments: m.assessment_count, gelir: pay?.revenue ?? 0 };
  });

  return (
    <AdminLayout title="Genel Bakış" description="Platform istatistikleri ve muhasebe">
      <div className="space-y-8">
        {(overview?.pendingReviews ?? 0) > 0 && (
          <div className="flex">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <Clock className="h-3 w-3 mr-1" />
              {overview?.pendingReviews} bekleyen rapor incelemesi
            </Badge>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Toplam Değerlendirme" value={fmt(overview?.totalAssessments ?? 0)} sub={`Bu ay: ${fmt(overview?.thisMonthAssessments ?? 0)}`} icon={FileText} />
          <StatCard title="Toplam Gelir (KDV dahil)" value={fmtCur(overview?.totalRevenue ?? 0)} sub={`Bu ay: ${fmtCur(overview?.monthRevenue ?? 0)}`} icon={TrendingUp} color="text-emerald-400" />
          <StatCard title="Toplam KDV" value={fmtCur(overview?.totalKdv ?? 0)} sub={`Bu ay: ${fmtCur(overview?.monthKdv ?? 0)}`} icon={DollarSign} color="text-blue-400" />
          <StatCard title="Net Gelir (KDV hariç)" value={fmtCur(overview?.netRevenue ?? 0)} sub="Tüm zamanlar" icon={CheckCircle} color="text-violet-400" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Tamamlanan Raporlar" value={fmt(overview?.completedAssessments ?? 0)} icon={CheckCircle} color="text-emerald-400" />
          <StatCard title="Bekleyen İnceleme" value={fmt(overview?.pendingReviews ?? 0)} icon={Clock} color="text-amber-400" />
          <StatCard title="Ortalama Değ. Skoru" value={`%${Math.round(overview?.avgScore ?? 0)}`} icon={BarChart3} color="text-blue-400" />
          <StatCard title="Aktif Abonelik" value={fmt(overview?.activeSubscriptions ?? 0)} icon={TrendingUp} color="text-violet-400" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Kayıtlı Müşteri" value={fmt(overview?.totalCustomers ?? 0)} icon={Users} color="text-sky-400" />
          <StatCard title="Alan Adı Taraması" value={fmt(overview?.totalDomainScans ?? 0)} icon={Globe} color="text-emerald-400" />
          <StatCard title="Ort. Domain Skoru" value={overview?.avgDomainScore !== undefined ? String(overview.avgDomainScore) : "—"} icon={BarChart3} color="text-teal-400" />
          <StatCard title="Geçen Ay Değ." value={fmt(overview?.lastMonthAssessments ?? 0)} sub="Önceki ay" icon={FileText} color="text-slate-400" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Aylık Değerlendirme & Gelir</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                  <Bar dataKey="assessments" name="Değerlendirme" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Risk Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                {riskData.map(({ name, value, fill }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: fill }} />
                    <div className="flex-1 text-slate-300 text-sm">{name}</div>
                    <div className="text-white font-semibold text-sm w-8 text-right">{value}</div>
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: fill, width: `${Math.min(100, (value / Math.max(1, overview?.totalAssessments ?? 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {riskData.length === 0 && <div className="text-slate-500 text-sm text-center py-8">Henüz veri yok</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Değerlendirmeleri Yönet", desc: "Tüm anket sonuçlarını görüntüle", href: "/panel/degerlendiirmeler", icon: FileText },
            { label: "Müşteri Yönetimi", desc: "Abonelikler, plan atamaları", href: "/panel/musteriler", icon: Users },
            { label: "Alan Adı Taramaları", desc: "Tüm domain tarama geçmişi", href: "/panel/domain-taramalar", icon: Globe },
            { label: "Site Ayarlarını Düzenle", desc: "Hakkımızda, servisler, KVKK", href: "/panel/ayarlar", icon: Settings },
            { label: "Fiyatları Güncelle", desc: "Paket fiyatları ve içerikleri", href: "/panel/fiyatlar", icon: CreditCard },
          ].map(({ label, desc, href, icon: Icon }) => (
            <button key={href} onClick={() => navigate(href)}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-left hover:border-emerald-500/40 hover:bg-slate-750 transition-all group">
              <Icon className="h-6 w-6 text-emerald-400 mb-3" />
              <div className="text-white font-medium text-sm mb-1">{label}</div>
              <div className="text-slate-400 text-xs">{desc}</div>
            </button>
          ))}
        </div>

        {/* Veri Kaynakları — sadece admin görür */}
        <DataSourcesCard />
      </div>
    </AdminLayout>
  );
}

const DATA_SOURCES: {
  tool: string;
  desc: string;
  sources: { name: string; url: string; note: string }[];
}[] = [
  {
    tool: "KVKK Ceza Simülatörü",
    desc: "İdari para cezası hesaplamada kullanılan taban rakamlar ve ağırlaştırıcı/hafifletici koşul çarpanları",
    sources: [
      { name: "KVK Kurul Karar Özetleri", url: "https://www.kvkk.gov.tr/Icerik/5673/Karar-Ozetleri", note: "Resmi kurul kararları — taban ceza aralıkları" },
      { name: "Resmi Gazete (mevzuat.gov.tr)", url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5", note: "6698 sayılı KVKK Kanunu — Madde 18 yaptırımlar" },
      { name: "KVK Rehber Dokümanlar", url: "https://www.kvkk.gov.tr/Icerik/4570/Rehberler", note: "Ceza hesaplama metodolojisi referansı" },
    ],
  },
  {
    tool: "Siber Sigorta Prim Hesaplayıcı",
    desc: "Prim aralığı tahmini için kullanılan sektör piyasa verileri ve risk çarpanları",
    sources: [
      { name: "Türkiye Sigorta Birliği İstatistikleri", url: "https://www.tsb.org.tr/istatistikler.aspx", note: "Türkiye siber sigorta prim verileri" },
      { name: "Segem Aktüerya Verileri", url: "https://www.segem.org.tr", note: "KOBİ profili risk fiyatlandırması" },
      { name: "IBM Cost of Data Breach Report", url: "https://www.ibm.com/reports/data-breach", note: "Sektörel ortalama olay maliyetleri (küresel)" },
      { name: "Marsh Siber Risk Raporu (TR)", url: "https://www.marsh.com/tr/tr.html", note: "Türkiye pazar prim endeksi referansı" },
    ],
  },
  {
    tool: "Sektörel Kıyaslama Aracı",
    desc: "Sektör bazında güvenlik olgunluk skorları, olay oranları ve ortalama maliyet rakamları",
    sources: [
      { name: "IBM Cost of Data Breach Report", url: "https://www.ibm.com/reports/data-breach", note: "Yıllık sektörel ihlal maliyeti raporu" },
      { name: "Verizon DBIR", url: "https://www.verizon.com/business/resources/reports/dbir/", note: "Data Breach Investigations Report — sektör olay dağılımı" },
      { name: "BTK Bilgi Güvenliği Raporları", url: "https://www.btk.gov.tr/haberler", note: "Türkiye KOBİ siber güvenlik istatistikleri" },
      { name: "ENISA SME Threat Landscape", url: "https://www.enisa.europa.eu/topics/cyber-threats/threats-and-trends", note: "AB KOBİ tehdit peyzajı — sektör riski" },
    ],
  },
  {
    tool: "Alan Adı Tarama — Finansal/Ceza Hesaplamaları",
    desc: "Domain taramada harici API'lerin hesapladığı risk skorları ve kullandığı veri kaynakları",
    sources: [
      { name: "Have I Been Pwned (HIBP)", url: "https://haveibeenpwned.com/API/v3", note: "E-posta/domain sızıntı veritabanı" },
      { name: "VirusTotal API", url: "https://developers.virustotal.com/reference/overview", note: "Domain reputasyon ve zararlı yazılım taraması" },
      { name: "AbuseIPDB", url: "https://www.abuseipdb.com/api", note: "IP kötüye kullanım geçmişi skoru" },
      { name: "URLhaus (abuse.ch)", url: "https://urlhaus-api.abuse.ch/", note: "Zararlı URL veritabanı" },
      { name: "USOM (BTK)", url: "https://www.usom.gov.tr", note: "Türkiye kara liste ve tehdit istihbarat verileri" },
    ],
  },
  {
    tool: "KVKK VERBİS Yükümlülük Eşikleri",
    desc: "Çalışan sayısı ve yıllık mali bilanço eşiği kriterleri",
    sources: [
      { name: "KVK VERBİS Kılavuzu", url: "https://www.kvkk.gov.tr/Icerik/6098/Veri-Sorumlulusu-Bilgi-Sistemi-VERBiS", note: "Resmi yükümlülük kriterleri" },
      { name: "Resmi Gazete 30224", url: "https://www.resmigazete.gov.tr/eskiler/2017/10/20171017-5.htm", note: "VERBİS kayıt yükümlülüğü yönetmeliği" },
    ],
  },
  {
    tool: "ERP Güvenlik Tarama Listesi",
    desc: "Kontrol maddelerinin dayandığı güvenlik standartları",
    sources: [
      { name: "NIST SP 800-53", url: "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final", note: "ERP erişim kontrolü, denetim ve yama yönetimi kriterleri" },
      { name: "CIS Controls v8", url: "https://www.cisecurity.org/controls/v8", note: "ERP için uygulanabilir güvenlik kontrolleri" },
      { name: "SAP Security Baseline", url: "https://support.sap.com/en/index.html", note: "SAP özel güvenlik yapılandırması referansı" },
    ],
  },
];

function DataSourcesCard() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <Card className="bg-slate-800 border-slate-700">
      <button className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-400" />
              <CardTitle className="text-white text-base">Araç Veri Kaynakları ve Hesaplama Metodolojisi</CardTitle>
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 font-medium">Sadece Admin</span>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
          <p className="text-slate-400 text-xs pt-1">Müşterilere sunulan hesaplama araçlarının dayandığı kaynak ve metodoloji bilgisi. Müşterilere gösterilmez.</p>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-start gap-2 bg-sky-500/10 border border-sky-500/20 rounded-lg p-3">
            <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-sky-300 text-xs leading-relaxed">
              Aşağıdaki rakamlar hesaplama modeli için baz alınmıştır. Gerçek değerler güncel mevzuat ve piyasa koşullarına göre periyodik olarak doğrulanmalıdır.
            </p>
          </div>

          {DATA_SOURCES.map((ds) => (
            <div key={ds.tool} className="border border-slate-700 rounded-lg overflow-hidden">
              <button className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpanded((e) => ({ ...e, [ds.tool]: !e[ds.tool] }))}>
                <div>
                  <p className="text-white text-sm font-medium">{ds.tool}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{ds.desc}</p>
                </div>
                {expanded[ds.tool] ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0 ml-3" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-3" />}
              </button>

              {expanded[ds.tool] && (
                <div className="border-t border-slate-700 px-4 py-3 bg-slate-900/50 space-y-2">
                  {ds.sources.map((src) => (
                    <div key={src.url} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-200 text-xs font-medium">{src.name}</span>
                          <span className="text-slate-500 text-xs">—</span>
                          <span className="text-slate-400 text-xs">{src.note}</span>
                        </div>
                        <a href={src.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-sky-400 hover:text-sky-300 font-mono break-all flex items-center gap-1 mt-0.5">
                          {src.url} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
