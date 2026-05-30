import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowRight, ShieldCheck, Activity, AlertTriangle, Filter, X, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from "recharts";

interface StatsData {
  totalAssessments: number;
  completedAssessments: number;
  averageScore: number;
  riskDistribution: { kritik: number; yuksek: number; orta: number; dusuk: number };
  recentAssessments: Assessment[];
  sectorBreakdown: Array<{ sector: string; count: number }>;
  scoreDistribution: Array<{ bucket: string; count: number }>;
  allSectors: string[];
}

interface Assessment {
  id: number;
  companyName: string;
  sector: string;
  createdAt: string;
  totalScore: number | null;
  maxScore: number | null;
  riskLevel: string | null;
  status: string;
}

type DatePreset = "all" | "7d" | "30d" | "90d";

const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: "all", label: "Tüm Zamanlar" },
  { key: "7d", label: "Son 7 Gün" },
  { key: "30d", label: "Son 30 Gün" },
  { key: "90d", label: "Son 90 Gün" },
];

function getDateRange(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  if (preset === "all") return {};
  const now = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: from.toISOString() };
}

const getRiskColor = (level: string) => {
  switch (level) {
    case "Kritik": return "bg-destructive text-destructive-foreground";
    case "Yüksek": return "bg-orange-500 text-white";
    case "Orta": return "bg-yellow-500 text-white";
    case "Düşük": return "bg-green-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSector !== "all") params.set("sector", selectedSector);
    const range = getDateRange(datePreset);
    if (range.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range.dateTo) params.set("dateTo", range.dateTo);
    params.set("limit", "20");
    return params.toString();
  }, [selectedSector, datePreset]);

  const { data: stats, isLoading, error } = useQuery<StatsData>({
    queryKey: ["stats-summary", queryParams],
    queryFn: () =>
      fetch(`/api/assessments/stats/summary?${queryParams}`).then(async r => {
        if (r.status === 401 || r.status === 403) throw Object.assign(new Error("unauthorized"), { status: r.status });
        if (!r.ok) throw new Error("Veri yüklenemedi");
        return r.json();
      }),
    staleTime: 30_000,
    retry: false,
  });

  const hasFilters = selectedSector !== "all" || datePreset !== "all";

  const clearFilters = () => {
    setSelectedSector("all");
    setDatePreset("all");
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stats) {
    const isUnauth = error && (error as Error & { status?: number }).status === 401;
    return (
      <div className="flex h-[60vh] items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">
            {isUnauth ? "Giriş Gerekiyor" : "Veri Yüklenemedi"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isUnauth
              ? "Dashboard'a erişmek için yönetici girişi gereklidir."
              : "İstatistikler şu an yüklenemiyor. Lütfen daha sonra tekrar deneyin."}
          </p>
          {isUnauth && (
            <Button onClick={() => navigate("/panel/giris")} className="mt-2">
              Yönetici Girişi
            </Button>
          )}
        </div>
      </div>
    );
  }

  const riskData = [
    { name: "Kritik", value: stats.riskDistribution.kritik, color: "hsl(0 84.2% 60.2%)" },
    { name: "Yüksek", value: stats.riskDistribution.yuksek, color: "hsl(24.6 95% 53.1%)" },
    { name: "Orta", value: stats.riskDistribution.orta, color: "hsl(47.9 95.8% 53.1%)" },
    { name: "Düşük", value: stats.riskDistribution.dusuk, color: "hsl(142.1 76.2% 36.3%)" },
  ].filter(d => d.value > 0);

  const scoreDistColors: Record<string, string> = {
    "0-25%": "hsl(0 84.2% 60.2%)",
    "26-50%": "hsl(24.6 95% 53.1%)",
    "51-75%": "hsl(47.9 95.8% 53.1%)",
    "76-100%": "hsl(142.1 76.2% 36.3%)",
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform genelindeki analiz istatistikleri</p>
        </div>
        <Link href="/assessment/start">
          <Button>Yeni Analiz Başlat</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
              <Filter className="h-4 w-4" />
              Filtrele:
            </div>

            {/* Date preset buttons */}
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDatePreset(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    datePreset === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sector filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                className="text-xs rounded-md border bg-background px-2.5 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="all">Tüm Sektörler</option>
                {stats.allSectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                <X className="h-3 w-3" /> Temizle
              </button>
            )}
          </div>

          {hasFilters && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {datePreset !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  {DATE_PRESETS.find(p => p.key === datePreset)?.label}
                </Badge>
              )}
              {selectedSector !== "all" && (
                <Badge variant="secondary" className="text-xs">{selectedSector}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hızlı Başlangıç — sadece çok az veri varsa */}
      {stats.totalAssessments < 3 && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Platform Kurulum Kontrol Listesi
            </CardTitle>
            <CardDescription>İlk müşterileri kazanmadan önce bu adımları tamamlayın.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              {[
                { step: "Alan adı tarama aracını test edin", href: "/domain-tarama", done: false },
                { step: "İlk mini değerlendirmeyi tamamlayın", href: "/assessment/start", done: stats.totalAssessments > 0 },
                { step: "E-posta drip şablonlarını kontrol edin (SMTP_USER + SMTP_PASS ayarlı olmalı)", href: null, done: false },
                { step: "Fiyatlandırma sayfasını inceleyin", href: "/fiyatlar", done: false },
                { step: "Güven rozetini test edin", href: "/guven-rozeti", done: false },
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${item.done ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {item.done ? "✓" : idx + 1}
                  </span>
                  {item.href ? (
                    <Link href={item.href} className="text-sm hover:underline text-foreground/80">{item.step}</Link>
                  ) : (
                    <span className="text-sm text-foreground/80">{item.step}</span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Toplam Analiz</p>
              <h2 className="text-3xl font-bold">{stats.totalAssessments}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.completedAssessments} tamamlandı
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-green-500/10 rounded-full text-green-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tamamlanma Oranı</p>
              <h2 className="text-3xl font-bold">
                %{stats.totalAssessments > 0
                  ? Math.round((stats.completedAssessments / stats.totalAssessments) * 100)
                  : 0}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.completedAssessments} / {stats.totalAssessments}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-orange-500/10 rounded-full text-orange-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ortalama Skor</p>
              <h2 className="text-3xl font-bold">
                {Math.round(stats.averageScore)}
                <span className="text-base font-normal text-muted-foreground"> / 140</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                %{Math.round((stats.averageScore / 140) * 100)} başarı
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Dağılımı</CardTitle>
            <CardDescription>Firmaların genel risk profil durumları</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Yeterli veri bulunmuyor
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skor Dağılımı</CardTitle>
            <CardDescription>Firmaların güvenlik skoru aralıkları</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {stats.scoreDistribution.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.scoreDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(v: number) => [v, "Firma Sayısı"]}
                  />
                  <Bar dataKey="count" name="Firma Sayısı" radius={[4, 4, 0, 0]} maxBarSize={64}>
                    {stats.scoreDistribution.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={scoreDistColors[entry.bucket] ?? "hsl(215 20% 65%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Yeterli veri bulunmuyor
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 — Sector breakdown + Risk bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Sektör Dağılımı</CardTitle>
            <CardDescription>Sektörlere göre analiz sayıları</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {stats.sectorBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.sectorBreakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="sector"
                    type="category"
                    width={110}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(v: number) => [v, "Analiz Sayısı"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Yeterli veri bulunmuyor
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Seviyeleri (Sayısal)</CardTitle>
            <CardDescription>Risk seviyelerine göre firma sayıları</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  formatter={(v: number) => [v, "Firma"]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent assessments table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Son Analizler</CardTitle>
            {hasFilters && (
              <Badge variant="outline" className="text-xs">
                Filtre uygulandı · {stats.recentAssessments.length} sonuç
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Sektör</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead>Risk Seviyesi</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      {hasFilters ? "Bu filtrelere uygun analiz bulunamadı." : "Henüz analiz bulunmuyor."}
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.recentAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.companyName}</TableCell>
                      <TableCell>
                        <span className="text-xs">{assessment.sector}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(assessment.createdAt).toLocaleDateString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        {assessment.totalScore !== undefined && assessment.totalScore !== null
                          ? `${assessment.totalScore}/${assessment.maxScore}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {assessment.riskLevel ? (
                          <Badge className={getRiskColor(assessment.riskLevel)}>
                            {assessment.riskLevel}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Devam Ediyor</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={assessment.status === "report_ready" ? `/assessment/${assessment.id}/report` : `/assessment/${assessment.id}`}>
                          <Button variant="ghost" size="sm" className="h-8">
                            Detay <ArrowRight className="ml-2 h-3 w-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
