import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetchJson } from "@/lib/admin-fetch";
import {
  Shield, RefreshCw, AlertTriangle, Rss, Calendar,
  ChevronRight, BarChart2, Globe, Network,
} from "lucide-react";

interface VulnCheckStats {
  total: number;
  edgeCount: number;
  ransomwareCount: number;
  inCisaKev: number;
  blindSpot: number;
  blindSpotPct: number;
  lastFetchedAt: string | null;
  apiKeyConfigured: boolean;
}

interface FeedSource {
  sourceKey: string;
  name: string;
  category: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastNewItemAt: string | null;
  newToday: number;
}

interface FeedItem {
  id: number;
  sourceKey: string;
  title: string;
  itemUrl: string;
  relevanceScore: number;
  tags: string[] | null;
  publishedAt: string | null;
  relevanceReason: string | null;
}

interface ReportCalendarEntry {
  key: string;
  title: string;
  publisher: string;
  expectedMonth: number | null;
  status: string;
  isThisMonth: boolean;
  analyzedAt: string | null;
}

interface AnnualReportsResponse {
  calendar: ReportCalendarEntry[];
  analyzed: Array<{ reportKey: string; turkeyImpactSummary: string | null }>;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  warn?: boolean;
}) {
  return (
    <Card className={warn ? "border-orange-500/30" : ""}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className={`h-8 w-8 ${warn ? "text-orange-500" : "text-primary/60"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

const MONTH_NAMES = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export default function AdminCtiIstihbarat() {
  const [analyzeForm, setAnalyzeForm] = useState({
    reportKey: "",
    title: "",
    publisher: "",
    content: "",
    reportYear: new Date().getFullYear(),
  });

  const vulnStats = useQuery<VulnCheckStats>({
    queryKey: ["cti-vulncheck-stats"],
    queryFn: () => adminFetchJson("/api/admin-panel/cti-intel/vulncheck/stats"),
    refetchInterval: 60_000,
  });

  const feedSources = useQuery<FeedSource[]>({
    queryKey: ["cti-feed-sources"],
    queryFn: () => adminFetchJson("/api/admin-panel/cti-intel/feeds"),
    refetchInterval: 120_000,
  });

  const feedItems = useQuery<FeedItem[]>({
    queryKey: ["cti-feed-items"],
    queryFn: () => adminFetchJson("/api/admin-panel/cti-intel/feeds/items?limit=30"),
  });

  const annualReports = useQuery<AnnualReportsResponse>({
    queryKey: ["cti-annual-reports"],
    queryFn: () => adminFetchJson("/api/admin-panel/cti-intel/annual-reports"),
  });

  const refreshVulnCheck = useMutation({
    mutationFn: () => adminFetchJson("/api/admin-panel/cti-intel/vulncheck/refresh", { method: "POST" }),
    onSuccess: () => setTimeout(() => vulnStats.refetch(), 5000),
  });

  const checkFeeds = useMutation({
    mutationFn: () => adminFetchJson("/api/admin-panel/cti-intel/feeds/check", { method: "POST" }),
    onSuccess: () => setTimeout(() => { feedSources.refetch(); feedItems.refetch(); }, 10_000),
  });

  const analyzeReport = useMutation({
    mutationFn: () =>
      adminFetchJson("/api/admin-panel/cti-intel/annual-reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzeForm),
      }),
    onSuccess: () => {
      setTimeout(() => annualReports.refetch(), 5000);
      setAnalyzeForm((f) => ({ ...f, content: "" }));
    },
  });

  const stats = vulnStats.data;
  const lastFetched = stats?.lastFetchedAt
    ? new Date(stats.lastFetchedAt).toLocaleString("tr-TR")
    : "Henüz çekilmedi";

  return (
    <AdminLayout
      title="CTI İstihbarat"
      description="VulnCheck KEV, intel feed izleme ve yıllık rapor takvimi"
    >
      <Tabs defaultValue="vulncheck">
        <TabsList className="mb-6">
          <TabsTrigger value="vulncheck">
            <Shield className="h-4 w-4 mr-2" />
            VulnCheck KEV
          </TabsTrigger>
          <TabsTrigger value="feeds">
            <Rss className="h-4 w-4 mr-2" />
            Intel Feeds
          </TabsTrigger>
          <TabsTrigger value="reports">
            <Calendar className="h-4 w-4 mr-2" />
            Yıllık Raporlar
          </TabsTrigger>
        </TabsList>

        {/* ── VulnCheck KEV ──────────────────────────────────────────────── */}
        <TabsContent value="vulncheck" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">VulnCheck KEV Veritabanı</h3>
              <p className="text-sm text-muted-foreground">Son güncelleme: {lastFetched}</p>
            </div>
            <Button
              onClick={() => refreshVulnCheck.mutate()}
              disabled={refreshVulnCheck.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshVulnCheck.isPending ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>

          {stats && !stats.apiKeyConfigured && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>VULNCHECK_API_KEY</strong> ayarlı değil.{" "}
                    <a
                      href="https://vulncheck.com/auth/register"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      vulncheck.com
                    </a>{" "}
                    adresinden ücretsiz kayıt ol ve Replit Secrets'a ekle.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Toplam KEV"
              value={stats?.total ?? "—"}
              sub="VulnCheck veritabanı"
              icon={Shield}
            />
            <StatCard
              label="Network Edge"
              value={stats?.edgeCount ?? "—"}
              sub="Fortinet, Cisco, Palo Alto..."
              icon={Network}
              warn={(stats?.edgeCount ?? 0) > 0}
            />
            <StatCard
              label="Fidye Yazılımı"
              value={stats?.ransomwareCount ?? "—"}
              sub="Ransomware operasyonlarında kullanılan"
              icon={AlertTriangle}
              warn={(stats?.ransomwareCount ?? 0) > 0}
            />
            <StatCard
              label="CISA Kör Noktası"
              value={stats?.blindSpot != null ? `${stats.blindSpot} (%${stats.blindSpotPct})` : "—"}
              sub="CISA KEV'de olmayan VulnCheck"
              icon={BarChart2}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Network Edge CVE'leri (Son 90 Gün)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Fortinet, Cisco, Palo Alto ve diğer network edge cihazlarını etkileyen,
                aktif olarak istismar edilen güvenlik açıkları otomatik olarak izlenmektedir.
                VulnCheck KEV her gece 01:00'de güncellenir.
              </p>
              {(stats?.edgeCount ?? 0) > 0 && (
                <div className="mt-3 p-3 rounded-md bg-orange-500/10 border border-orange-500/20">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    {stats?.edgeCount} network edge CVE tespit edildi — müşteri tech stack eşleştirmesi için CVE
                    sayfasını kontrol et.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Intel Feeds ────────────────────────────────────────────────── */}
        <TabsContent value="feeds" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">CTI Feed Kaynakları</h3>
              <p className="text-sm text-muted-foreground">Her 6 saatte bir otomatik taranır</p>
            </div>
            <Button
              onClick={() => checkFeeds.mutate()}
              disabled={checkFeeds.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkFeeds.isPending ? "animate-spin" : ""}`} />
              Şimdi Tara
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {feedSources.isLoading ? (
              <p className="text-muted-foreground text-sm">Yükleniyor...</p>
            ) : (feedSources.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Henüz feed taranmamış. "Şimdi Tara" butonunu kullan.
              </p>
            ) : (
              (feedSources.data ?? []).map((src) => (
                <Card key={src.sourceKey}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{src.name}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {src.category?.replace("_", " ")}
                        </p>
                      </div>
                      <Badge variant={src.newToday > 0 ? "default" : "outline"} className="text-xs">
                        {src.newToday > 0 ? `+${src.newToday} bugün` : "Yeni yok"}
                      </Badge>
                    </div>
                    {src.lastCheckedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Son kontrol: {new Date(src.lastCheckedAt).toLocaleString("tr-TR")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alakalı İçerikler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {feedItems.isLoading ? (
                <p className="text-sm text-muted-foreground">Yükleniyor...</p>
              ) : (feedItems.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz alakalı içerik bulunamadı.</p>
              ) : (
                (feedItems.data ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-2 border-b last:border-0"
                  >
                    <Badge variant="outline" className="text-xs mt-0.5 shrink-0">
                      {item.relevanceScore}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium hover:underline line-clamp-1"
                      >
                        {item.title}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{item.sourceKey}</span>
                        {(item.tags ?? []).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <a href={item.itemUrl} target="_blank" rel="noreferrer">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Yıllık Raporlar ────────────────────────────────────────────── */}
        <TabsContent value="reports" className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg">Yıllık Rapor Takvimi</h3>
            <p className="text-sm text-muted-foreground">
              WEF, CrowdStrike, IBM, Verizon, ENISA ve diğer küresel güvenlik raporları
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {(annualReports.data?.calendar ?? []).map((r) => (
              <Card
                key={r.key}
                className={r.isThisMonth ? "border-primary/40" : ""}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.publisher}</p>
                    </div>
                    <Badge
                      variant={
                        r.status === "analyzed"
                          ? "default"
                          : r.isThisMonth
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs shrink-0"
                    >
                      {r.status === "analyzed"
                        ? "Analiz edildi"
                        : r.isThisMonth
                        ? "Bu ay bekleniyor"
                        : r.expectedMonth
                        ? MONTH_NAMES[r.expectedMonth]
                        : "Sürekli"}
                    </Badge>
                  </div>
                  {r.analyzedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Analiz: {new Date(r.analyzedAt).toLocaleDateString("tr-TR")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Rapor Analizi Başlat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bir raporun içeriğini buraya yapıştır. Claude ile Türkiye odaklı analiz üretilir
                ve aylık endeks raporuna entegre edilir.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Rapor Anahtarı</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={analyzeForm.reportKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      const meta = annualReports.data?.calendar.find((r) => r.key === key);
                      setAnalyzeForm((f) => ({
                        ...f,
                        reportKey: key,
                        title: meta?.title ?? f.title,
                        publisher: meta?.publisher ?? f.publisher,
                      }));
                    }}
                  >
                    <option value="">Seç...</option>
                    {(annualReports.data?.calendar ?? []).map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.title}
                      </option>
                    ))}
                    <option value="other">Diğer (Manuel)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Rapor Yılı</Label>
                  <Input
                    type="number"
                    value={analyzeForm.reportYear}
                    onChange={(e) =>
                      setAnalyzeForm((f) => ({ ...f, reportYear: Number(e.target.value) }))
                    }
                    min={2020}
                    max={2030}
                  />
                </div>
              </div>

              {analyzeForm.reportKey === "other" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Başlık</Label>
                    <Input
                      value={analyzeForm.title}
                      onChange={(e) => setAnalyzeForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Raporun adı"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Yayıncı</Label>
                    <Input
                      value={analyzeForm.publisher}
                      onChange={(e) => setAnalyzeForm((f) => ({ ...f, publisher: e.target.value }))}
                      placeholder="Org adı"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>Rapor İçeriği (özet veya tam metin)</Label>
                <Textarea
                  value={analyzeForm.content}
                  onChange={(e) => setAnalyzeForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Rapor metnini buraya yapıştır (en az 200 karakter)..."
                  className="min-h-[180px] font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {analyzeForm.content.length} karakter
                </p>
              </div>

              <Button
                onClick={() => analyzeReport.mutate()}
                disabled={
                  analyzeReport.isPending ||
                  !analyzeForm.reportKey ||
                  analyzeForm.content.length < 200
                }
              >
                {analyzeReport.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analiz ediliyor...
                  </>
                ) : (
                  "Analizi Başlat"
                )}
              </Button>

              {analyzeReport.isSuccess && (
                <p className="text-sm text-green-600">
                  Analiz başlatıldı. Birkaç dakika içinde tamamlanacak.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
