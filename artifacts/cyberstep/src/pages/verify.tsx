import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, Building2, Calendar, AlertTriangle, Copy, Check } from "lucide-react";
import { useState } from "react";

const RISK_COLOR: Record<string, string> = {
  Düşük: "#16a34a",
  Orta: "#d97706",
  Yüksek: "#ea580c",
  Kritik: "#dc2626",
};

function getRiskBadgeClass(level: string) {
  if (level === "Düşük") return "bg-green-100 text-green-800 border-green-200";
  if (level === "Orta") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (level === "Yüksek") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export default function VerifyPage() {
  const [, params] = useRoute("/verify/:token");
  const token = params?.token ?? "";
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verify", token],
    queryFn: async () => {
      const res = await fetch(`/api/verify/${token}`);
      if (!res.ok) throw new Error("not_found");
      return res.json() as Promise<{
        companyName: string;
        sector: string;
        employeeCount: string;
        riskLevel: string;
        scorePercent: number;
        completedAt: string;
        verifiedAt: string;
      }>;
    },
    retry: false,
    enabled: !!token,
  });

  const pageUrl = window.location.href;

  const embedCode = `<a href="${pageUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">
  <img src="https://img.shields.io/badge/CyberStep.io-Verified-10b981?style=for-the-badge&logo=shield&logoColor=white" alt="CyberStep.io Doğrulandı" style="height:28px"/>
</a>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <div className="text-slate-400 text-sm animate-pulse">Doğrulama kontrol ediliyor...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold mb-2">Doğrulama Bulunamadı</h1>
            <p className="text-sm text-muted-foreground">
              Bu doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const riskColor = RISK_COLOR[data.riskLevel] ?? "#64748b";
  const verifiedDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.verifiedAt));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-5">
        {/* Badge Card */}
        <Card className="overflow-hidden shadow-2xl">
          <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span className="text-white font-bold text-lg">CyberStep.io</span>
            </div>
            <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">Doğrulama Belgesi</span>
          </div>

          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="bg-emerald-50 rounded-full p-5">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-1">{data.companyName}</h1>
            <p className="text-muted-foreground text-sm mb-6">CyberStep.io uzmanı tarafından sahaya doğrulama denetimi tamamlandı ve onaylandı.</p>

            <div className="grid grid-cols-2 gap-4 mb-6 text-left">
              <div className="bg-muted/40 rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Sektör
                </div>
                <div className="font-semibold text-sm">{data.sector}</div>
                <div className="text-xs text-muted-foreground">{data.employeeCount} çalışan</div>
              </div>
              <div className="bg-muted/40 rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Doğrulama Tarihi
                </div>
                <div className="font-semibold text-sm">{verifiedDate}</div>
              </div>
            </div>

            <div className="border rounded-xl p-4 mb-6">
              <div className="text-xs text-muted-foreground mb-2">Güvenlik Risk Seviyesi</div>
              <div className="flex items-center justify-center gap-3">
                <div className="text-4xl font-black" style={{ color: riskColor }}>%{data.scorePercent}</div>
                <div>
                  <Badge className={`text-sm font-bold px-3 py-1 border ${getRiskBadgeClass(data.riskLevel)}`} variant="outline">
                    {data.riskLevel} Risk
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Güvenlik skoru</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Bu belge CyberStep.io uzmanı tarafından sahada gerçekleştirilen fiziksel denetim sonucunda düzenlenmiştir. Bağlantıyı bilen herkes tarafından görüntülenebilir.
            </p>
          </CardContent>
        </Card>

        {/* Embed code */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-1">Web Sitenize Ekleyin</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Bu kodu tekliflerinize veya web sitenize ekleyerek müşterilerinize güvenlik durumunuzu gösterin.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs text-muted-foreground mb-3 overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs text-primary font-medium hover:underline"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Kopyalandı!" : "Kodu Kopyala"}
            </button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          <a href="/" className="hover:text-slate-300 transition-colors">CyberStep.io</a> — KOBİ'ler için siber güvenlik değerlendirme platformu
        </p>
      </div>
    </div>
  );
}
