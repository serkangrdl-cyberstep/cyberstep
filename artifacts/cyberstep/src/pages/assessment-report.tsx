import { useRoute, Link } from "wouter";
import { useGetReport, useGetAssessment } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, AlertOctagon, CheckCircle, Info, Download, ArrowRight, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function AssessmentReport() {
  const [, params] = useRoute("/assessment/:id/report");
  const id = parseInt(params?.id || "0", 10);

  const { data: reportData, isLoading } = useGetReport(id, {
    query: {
      enabled: !!id,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        if ('status' in data && data.status !== 'report_ready') return 2000;
        return false;
      }
    }
  });

  const { data: assessment } = useGetAssessment(id, {
    query: { enabled: !!id }
  });

  const isPending = !reportData || ('status' in reportData);

  if (isLoading || isPending) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex flex-col items-center justify-center text-center space-y-6 mb-12">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative bg-primary/10 p-6 rounded-full">
              <Lock className="h-12 w-12 text-primary animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Raporunuz Hazırlanıyor...</h2>
          <p className="text-muted-foreground max-w-md">
            Yapay zeka asistanımız cevaplarınızı analiz ediyor ve size özel siber güvenlik yol haritasını oluşturuyor. Bu işlem birkaç saniye sürebilir.
          </p>
        </div>
        
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const report = reportData as any; // Cast safely since we handled the pending state
  
  const getRiskColor = (level: string) => {
    switch(level) {
      case "Kritik": return "bg-destructive text-destructive-foreground";
      case "Yüksek": return "bg-orange-500 text-white";
      case "Orta": return "bg-yellow-500 text-white";
      case "Düşük": return "bg-green-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getRiskTextColor = (level: string) => {
    switch(level) {
      case "Kritik": return "text-destructive";
      case "Yüksek": return "text-orange-500";
      case "Orta": return "text-yellow-500";
      case "Düşük": return "text-green-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Analiz Raporu
            </Badge>
            <span className="text-sm text-muted-foreground">Tarih: {new Date(report.createdAt).toLocaleDateString("tr-TR")}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {assessment?.companyName || "Şirket"} Siber Risk Karnesi
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> PDF İndir
          </Button>
          <Link href="/dashboard">
            <Button>
              Dashboard'a Dön <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-1 md:col-span-2 shadow-sm border-t-4 border-t-primary">
          <CardHeader className="pb-2">
            <CardTitle>Risk Skoru</CardTitle>
            <CardDescription>Siber güvenlik olgunluk seviyeniz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-muted/30"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={351.8}
                    strokeDashoffset={351.8 - (351.8 * report.scorePercent) / 100}
                    className={`${getRiskTextColor(report.riskLevel)} transition-all duration-1000 ease-out`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{report.totalScore}</span>
                  <span className="text-xs text-muted-foreground">/ {report.maxScore}</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Risk Seviyesi</span>
                    <Badge className={`${getRiskColor(report.riskLevel)}`}>{report.riskLevel}</Badge>
                  </div>
                  <Progress value={report.scorePercent} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Skorunuz ne kadar yüksekse, siber saldırılara karşı o kadar hazırlıklısınız demektir. Mevcut durumunuz acil iyileştirmeler gerektirmektedir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-destructive" /> 
              Kırmızı Alarmlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-full pt-4 pb-2">
              <span className="text-5xl font-bold text-destructive mb-2">{report.redAlarmCount}</span>
              <p className="text-center text-sm font-medium">Kritik Güvenlik Açığı</p>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Derhal aksiyon alınması gereken temel güvenlik eksiklikleri tespit edildi.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Yönetici Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
              {report.aiAnalysis.split('\n\n').map((paragraph: string, i: number) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Kategori Bazlı Analiz</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.domainScores} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="domain" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip 
                  formatter={(value: number) => [`%${value.toFixed(0)}`, 'Başarı']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                  {report.domainScores.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.percent > 70 ? 'hsl(142 71% 45%)' : entry.percent > 40 ? 'hsl(35 92% 60%)' : 'hsl(0 84% 60%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Öncelikli Aksiyon Planı</CardTitle>
          <CardDescription>Siber güvenliğinizi artırmak için hemen uygulamanız gereken adımlar</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {report.recommendations.map((rec: string, index: number) => (
              <li key={index} className="flex gap-4 items-start p-4 rounded-lg bg-muted/30 border">
                <div className="flex-shrink-0 mt-0.5">
                  <ShieldAlert className="h-5 w-5 text-orange-500" />
                </div>
                <span className="text-sm font-medium leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
