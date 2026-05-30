import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, CheckCircle2, Building2, Calendar, AlertTriangle,
  Copy, Check, Clock, QrCode, FileText, Award,
} from "lucide-react";
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

const fmt = (d: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));

// ─── Katman tanımları ─────────────────────────────────────────────────────────
const TIER_CONFIG = {
  1: {
    label: "CyberStep Risk Skoru",
    sublabel: "Beyan Bazlı Değerlendirme",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Bu değerlendirme, şirket tarafından iletilen beyanlar ve otomatik dış tarama verileri esas alınarak oluşturulmuştur.",
    disclaimer: "Bu belge beyan bazlıdır; bağımsız teknik denetim veya kanıt doğrulama içermez. Sertifika niteliği taşımaz. CyberStep A.Ş. doğruluğu teyit etme yükümlülüğü üstlenmez.",
  },
  2: {
    label: "CyberStep Değerlendirildi",
    sublabel: "Uzman İncelemeli Rapor",
    icon: Shield,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description: "Kapsamlı değerlendirme anketi, otomatik teknik tarama ve CyberStep uzman incelemesiyle onaylanmıştır.",
    disclaimer: "Bu rapor şirket beyanları, teknik tarama verileri ve uzman incelemesi esas alınarak hazırlanmıştır. Yerinde fiziksel denetim veya kanıt doğrulama içermez. Belge, düzenlendiği tarihteki durumu yansıtır.",
  },
  3: {
    label: "CyberStep Sertifikalı Platform",
    sublabel: "Kanıt Doğrulamalı Denetim",
    icon: Award,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    description: "CyberStep uzmanı tarafından kanıt doğrulama ve uzaktan/yerinde denetimle sertifikalandırılmıştır.",
    disclaimer: "Bu sertifika, CyberStep uzmanı tarafından kanıt doğrulama ve denetim sonucunda düzenlenmiştir. Yıllık yenileme gerektirir. Belge, denetim tarihindeki güvenlik durumunu yansıtır; sonraki değişiklikler kapsam dışındadır.",
  },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

export default function VerifyPage() {
  const [, params] = useRoute("/verify/:token");
  const token = params?.token ?? "";
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["verify", token],
    queryFn: async () => {
      const res = await fetch(`/api/verify/${token}`);
      if (res.status === 410) {
        const body = await res.json();
        throw Object.assign(new Error("expired"), body);
      }
      if (!res.ok) throw new Error("not_found");
      return res.json() as Promise<{
        companyName: string;
        sector: string;
        employeeCount: string;
        riskLevel: string;
        scorePercent: number;
        completedAt: string;
        verifiedAt: string;
        verificationExpiresAt: string | null;
        certificationTier: number;
        verificationCode: string;
      }>;
    },
    retry: false,
    enabled: !!token,
  });

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const embedCode = `<a href="${pageUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">
  <img src="https://img.shields.io/badge/CyberStep.io-Doğrulandı-10b981?style=for-the-badge&logo=shield&logoColor=white" alt="CyberStep.io Doğrulandı" style="height:28px"/>
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
    const isExpired = error instanceof Error && error.message === "expired";
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            {isExpired ? (
              <>
                <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h1 className="text-lg font-bold mb-2">Sertifika Süresi Doldu</h1>
                <p className="text-sm text-muted-foreground">
                  Bu CyberStep sertifikasının geçerlilik süresi sona ermiştir. Yenileme için firmayla iletişime geçebilirsiniz.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h1 className="text-lg font-bold mb-2">Doğrulama Bulunamadı</h1>
                <p className="text-sm text-muted-foreground">
                  Bu doğrulama bağlantısı geçersiz veya iptal edilmiş olabilir.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = (data.certificationTier ?? 1) as TierKey;
  const tierCfg = TIER_CONFIG[tier] ?? TIER_CONFIG[1];
  const TierIcon = tierCfg.icon;
  const riskColor = RISK_COLOR[data.riskLevel] ?? "#64748b";
  const verifiedDate = fmt(data.verifiedAt);
  const expiresDate = data.verificationExpiresAt ? fmt(data.verificationExpiresAt) : null;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=1e293b&margin=8`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-4">

        {/* Ana Sertifika Kartı */}
        <Card className="overflow-hidden shadow-2xl">
          {/* Başlık bandı — katmana göre renk */}
          <div className={`px-6 py-4 flex items-center justify-between ${tierCfg.bgColor} border-b ${tierCfg.borderColor}`}>
            <div className="flex items-center gap-2">
              <TierIcon className={`h-5 w-5 ${tierCfg.color}`} />
              <div>
                <div className={`font-bold text-sm ${tierCfg.color}`}>{tierCfg.label}</div>
                <div className="text-xs text-slate-500">{tierCfg.sublabel}</div>
              </div>
            </div>
            <Badge variant="outline" className={`text-xs ${tierCfg.badgeClass}`}>
              {tier === 3 ? "Sertifikalı" : tier === 2 ? "Değerlendirildi" : "Risk Skoru"}
            </Badge>
          </div>

          <CardContent className="p-7">
            {/* Şirket + onay ikonu */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-4">
                <div className={`${tierCfg.bgColor} rounded-full p-4`}>
                  <CheckCircle2 className={`h-12 w-12 ${tierCfg.color}`} />
                </div>
                <div className={`absolute -bottom-1 -right-1 ${tier === 3 ? "bg-violet-500" : tier === 2 ? "bg-emerald-500" : "bg-blue-500"} rounded-full p-1`}>
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-1">{data.companyName}</h1>
              <p className="text-muted-foreground text-sm max-w-xs">{tierCfg.description}</p>
            </div>

            {/* Sektör + Tarih + Skor */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/40 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Sektör
                </div>
                <div className="font-semibold text-sm">{data.sector}</div>
                <div className="text-xs text-muted-foreground">{data.employeeCount} çalışan</div>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Doğrulama Tarihi
                </div>
                <div className="font-semibold text-sm">{verifiedDate}</div>
              </div>
            </div>

            {/* Geçerlilik */}
            {expiresDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-2.5 mb-4">
                <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>
                  Geçerlilik: <span className="font-semibold text-foreground">{expiresDate}</span> tarihine kadar
                </span>
              </div>
            )}

            {/* Risk skoru */}
            <div className="border rounded-xl p-4 mb-5">
              <div className="text-xs text-muted-foreground mb-2 text-center">Güvenlik Risk Skoru</div>
              <div className="flex items-center justify-center gap-3">
                <div className="text-4xl font-black" style={{ color: riskColor }}>
                  %{data.scorePercent}
                </div>
                <div>
                  <Badge
                    className={`text-sm font-bold px-3 py-1 border ${getRiskBadgeClass(data.riskLevel)}`}
                    variant="outline"
                  >
                    {data.riskLevel} Risk
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Güvenlik skoru</p>
                </div>
              </div>
            </div>

            {/* Doğrulama kodu + QR */}
            <div className="flex items-center justify-between gap-4 border rounded-xl p-4 mb-5 bg-muted/20">
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Doğrulama Kodu
                </div>
                <div className="font-mono font-bold text-base tracking-widest">{data.verificationCode}</div>
                <div className="text-xs text-muted-foreground mt-0.5">cyberstep.io/verify/{token.slice(0, 8)}...</div>
              </div>
              <img
                src={qrUrl}
                alt="QR Doğrulama Kodu"
                className="h-[80px] w-[80px] rounded-lg border border-slate-200 bg-white"
              />
            </div>

            {/* Yasal uyarı — katmana göre */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">{tierCfg.disclaimer}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Embed kodu kartı */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-1">Web Sitenize veya Teklifinize Ekleyin</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Bu kodu e-posta imzanıza, web sitenize veya ihale tekliflerinize ekleyin.
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
          <a href="/" className="hover:text-slate-300 transition-colors">CyberStep.io</a>{" "}
          — KOBİ'ler için siber güvenlik değerlendirme platformu
        </p>
      </div>
    </div>
  );
}
