import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  Shield, CheckCircle2, XCircle, Loader2, Copy, Check,
  Globe, Code2, ChevronRight, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

interface ScanResult {
  domain: string;
  score: number;
  riskLevel: string;
  spf: boolean;
  dmarc: boolean;
  ssl: boolean;
  scannedAt: number;
  cached: boolean;
}

function Check2({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {pass
        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
      <span className={pass ? "text-muted-foreground" : "text-red-400"}>{label}</span>
    </div>
  );
}

export default function GuvenRozeti() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "AI Güven Rozeti — Canlı Güvenlik Skoru | CyberStep.io",
    description: "Web sitenize gömülebilir, canlı güvenlik rozeti. Müşterilerinize siber güvenlik durumunuzu şeffaf şekilde gösterin.",
    noIndex: false,
  });

  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"img" | "html" | null>(null);

  async function run() {
    const input = domain.trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/.*$/, "");
    if (!input) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/guven-rozeti/${encodeURIComponent(input)}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Bir hata oluştu");
      }
      setResult(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const badgeUrl = result ? `/api/guven-rozeti/${result.domain}/badge.svg` : null;
  const absoluteBadgeUrl = result
    ? `${window.location.origin}/api/guven-rozeti/${result.domain}/badge.svg`
    : null;

  const imgCode = absoluteBadgeUrl
    ? `<img src="${absoluteBadgeUrl}" alt="CyberStep Güvenlik Skoru" />`
    : "";

  const htmlCode = absoluteBadgeUrl
    ? `<a href="https://cyberstep.io" target="_blank" rel="noopener">\n  <img src="${absoluteBadgeUrl}" alt="CyberStep Güvenlik Skoru" />\n</a>`
    : "";

  function copyToClipboard(text: string, type: "img" | "html") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const scoreColor = result
    ? result.score >= 70 ? "text-emerald-400" : result.score >= 40 ? "text-amber-400" : "text-red-400"
    : "text-primary";

  const riskBadge = result
    ? result.score >= 70
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : result.score >= 40
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30"
    : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-emerald-950/20 to-background">
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-emerald-500/40 text-emerald-400 bg-emerald-500/5">
            <Shield className="h-3 w-3 mr-1" />
            {lang === "en" ? "AI Trust Badge" : "AI Güven Rozeti"}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {lang === "en" ? "Show Your Security Status to Your Customers" : "Güvenlik Durumunuzu Müşterilerinize Gösterin"}
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Web sitenize ekleyebileceğiniz, canlı güncellenen güvenlik skoru rozeti. SSL sertifikası
            ve kilit ikonunun siber güvenlik versiyonu — müşteri güvenini somutlaştırır.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Beta uyarısı */}
        <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
              Beta Dönemi — Resmi Geçerlilik Yok
            </p>
            <p className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-1 leading-relaxed">
              Platform şu an beta aşamasındadır. Bu dönemde oluşturulan rozetler resmi geçerlilik taşımaz ve ticari amaçla kullanılamaz. Tam lansman sonrası rozetinizi yenileyebilirsiniz.
            </p>
          </div>
        </div>
        {/* Form */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Alan Adınızı Girin</Label>
              <div className="flex gap-3">
                <Input
                  className="flex-1 text-base"
                  placeholder="örn: sirketiniz.com.tr"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !loading && run()}
                />
                <Button onClick={run} disabled={!domain.trim() || loading} className="shrink-0">
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Taranıyor...</>
                    : <><Globe className="h-4 w-4 mr-1" /> Skoru Al</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                SPF, DMARC ve SSL kontrolü yapılır. Sonuçlar 24 saat önbelleğe alınır.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-red-500/30">
            <CardContent className="p-4 text-red-400 text-sm">{error}</CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-5">
            {/* Skor özeti */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Alan Adı</p>
                    <p className="font-mono font-semibold">{result.domain}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-5xl font-black ${scoreColor}`}>{result.score}</p>
                    <p className="text-xs text-muted-foreground">/ 100</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-xs mb-4 ${riskBadge}`}>{result.riskLevel}</Badge>
                <div className="space-y-1.5 mt-2">
                  <Check2 pass={result.spf} label={result.spf ? "SPF kaydı mevcut" : "SPF kaydı eksik"} />
                  <Check2 pass={result.dmarc} label={result.dmarc ? "DMARC yapılandırılmış" : "DMARC yapılandırılmamış"} />
                  <Check2 pass={result.ssl} label={result.ssl ? "SSL sertifikası geçerli" : "SSL sertifikası geçersiz / eksik"} />
                </div>
                {result.cached && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Önbellekten döndü · {new Date(result.scannedAt).toLocaleDateString("tr-TR")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 3-Aşamalı Rozet Sistemi */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold">CyberStep Güven Rozeti — 3 Aşamalı Süreç</p>
                <p className="text-xs text-muted-foreground mt-0.5">Rozetinizi kazanmak için aşağıdaki adımları tamamlayın</p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Aşama 1 — Tamamlandı */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 border border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold">Aşama 1 — Alan Adı Taraması</p>
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20" variant="outline">Tamamlandı</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Temel güvenlik kontrolü yapıldı. Skor: {result.score}/100</p>
                  </div>
                </div>

                {/* Aşama 2 — Kilitli */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                    <Globe className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-muted-foreground">Aşama 2 — Mini Değerlendirme</p>
                      <Badge variant="outline" className="text-xs text-muted-foreground">Kilitli</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      20 soruluk ücretsiz değerlendirmeyi tamamlayın. Skor ≥60 olduğunda temel rozet embed kodu açılır.
                    </p>
                    <Link href="/assessment/start">
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        Değerlendirmeyi Başlat <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Aşama 3 — Kilitli */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                    <Shield className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-muted-foreground">Aşama 3 — Uzman Doğrulaması</p>
                      <Badge variant="outline" className="text-xs text-muted-foreground">Kilitli</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      CyberStep uzmanı kapsamlı inceleme yapar ve resmi "Doğrulanmış" rozeti verir. 1 veya 2 yıl geçerli.
                    </p>
                    <a href="/fiyatlar" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                      Paketleri İncele <ChevronRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Preview — locked */}
              <div className="bg-gradient-to-b from-slate-50 to-primary/5 dark:from-slate-800/40 dark:to-primary/10 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Rozet Önizlemesi (Kilide alındı)</p>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="blur-sm opacity-50 bg-slate-950 rounded-lg p-4 border border-slate-700 flex items-center justify-center">
                      <img src={badgeUrl ?? ""} alt="" className="h-16" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">Aşama 2 Gerekli</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Embed kodu, Aşama 2 tamamlandıktan sonra kullanılabilir hale gelir.
                      Web sitenize eklemek için önce ücretsiz değerlendirmeyi tamamlayın.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Skor iyileştirme önerisi */}
            {result.score < 70 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-400 text-sm mb-1">Skoru iyileştirerek rozete daha hızlı ulaşın</p>
                      <p className="text-xs text-muted-foreground">
                        {!result.spf && "SPF kaydı eklenmesi (+25 puan), "}
                        {!result.dmarc && "DMARC yapılandırması (+30 puan), "}
                        {!result.ssl && "SSL sertifikası (+35 puan) "}
                        skorunuzu anlamlı şekilde artıracaktır.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Bilgi kutuları — form boşken */}
        {!result && !loading && (
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {[
              { icon: Shield, title: "Canlı Güncellenen Skor", desc: "Rozet, her taramada otomatik güncellenir. Müşterileriniz her zaman güncel durumu görür." },
              { icon: Globe, title: "Kolay Entegrasyon", desc: "Tek satır HTML kodu. WordPress, Wix, özel site — her platformda çalışır." },
              { icon: CheckCircle2, title: "Güven Sinyali", desc: "SSL logosunun siber güvenlik versiyonu. Müşteriler için görünür ve anlaşılır bir güvence." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title}>
                <CardContent className="p-4">
                  <Icon className="h-5 w-5 text-emerald-400 mb-2" />
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
