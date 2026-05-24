import { useGetStatsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowRight, ShieldCheck, Activity, Users, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStatsSummary();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const riskData = [
    { name: "Kritik", value: stats.riskDistribution.kritik, color: "hsl(0 84.2% 60.2%)" },
    { name: "Yüksek", value: stats.riskDistribution.yuksek, color: "hsl(24.6 95% 53.1%)" },
    { name: "Orta", value: stats.riskDistribution.orta, color: "hsl(47.9 95.8% 53.1%)" },
    { name: "Düşük", value: stats.riskDistribution.dusuk, color: "hsl(142.1 76.2% 36.3%)" },
  ].filter(d => d.value > 0);

  const getRiskColor = (level: string) => {
    switch(level) {
      case "Kritik": return "bg-destructive text-destructive-foreground";
      case "Yüksek": return "bg-orange-500 text-white";
      case "Orta": return "bg-yellow-500 text-white";
      case "Düşük": return "bg-green-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform genelindeki analiz istatistikleri</p>
        </div>
        <Link href="/assessment/start">
          <Button>
            Yeni Analiz Başlat
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Toplam Analiz</p>
              <h2 className="text-3xl font-bold">{stats.totalAssessments}</h2>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-secondary/10 rounded-full text-secondary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tamamlanan Analiz</p>
              <h2 className="text-3xl font-bold">{stats.completedAssessments}</h2>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-accent rounded-full text-accent-foreground">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ortalama Skor</p>
              <h2 className="text-3xl font-bold">{Math.round(stats.averageScore)} <span className="text-base font-normal text-muted-foreground">/ 140</span></h2>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Risk Dağılımı</CardTitle>
            <CardDescription>Firmaların genel risk profil durumları</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
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
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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

      <Card>
        <CardHeader>
          <CardTitle>Son Analizler</CardTitle>
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
                      Henüz analiz bulunmuyor.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.recentAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.companyName}</TableCell>
                      <TableCell>{assessment.sector}</TableCell>
                      <TableCell>{new Date(assessment.createdAt).toLocaleDateString("tr-TR")}</TableCell>
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
                        <Link href={assessment.status === 'report_ready' ? `/assessment/${assessment.id}/report` : `/assessment/${assessment.id}`}>
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
