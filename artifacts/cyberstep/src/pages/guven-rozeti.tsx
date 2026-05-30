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
            AI Güven Rozeti
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            Güvenlik Durumunuzu Müşterilerinize Gösterin
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Web sitenize ekleyebileceğiniz, canlı güncellenen güvenlik skoru rozeti. SSL sertifikası
            ve kilit ikonunun siber güvenlik versiyonu — müşteri güvenini somutlaştırır.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
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
            <div className="grid md:grid-cols-2 gap-5">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">Alan Adı</p>
                  <p className="font-mono font-semibold mb-4">{result.domain}</p>

                  <div className="flex items-end gap-3 mb-3">
                    <p className={`text-6xl font-black ${scoreColor}`}>{result.score}</p>
                    <div className="mb-1">
                      <p className="text-sm text-muted-foreground">/ 100</p>
                      <Badge variant="outline" className={`text-xs ${riskBadge}`}>
                        {result.riskLevel}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4">
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

              {/* Rozet önizlemesi */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rozet Önizlemesi</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="bg-slate-950 rounded-lg p-6 flex items-center justify-center mb-4 border border-slate-800">
                    {badgeUrl && (
                      <img
                        src={badgeUrl}
                        alt="CyberStep Güvenlik Rozeti"
                        className="h-[88px]"
                        style={{ imageRendering: "auto" }}
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://cyberstep.io/guven-rozeti`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Canlı rozet
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Embed kodları */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-4 w-4" /> Web Sitenize Ekleyin
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Rozet, tarama yapıldıkça otomatik güncellenir. Herhangi bir sayfa veya footer'a ekleyebilirsiniz.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sadece rozet */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Sadece rozet (img)</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyToClipboard(imgCode, "img")}
                    >
                      {copied === "img" ? <><Check className="h-3 w-3 mr-1" /> Kopyalandı</> : <><Copy className="h-3 w-3 mr-1" /> Kopyala</>}
                    </Button>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                    {imgCode}
                  </div>
                </div>

                {/* Link ile */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Link ile birlikte (önerilen)</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyToClipboard(htmlCode, "html")}
                    >
                      {copied === "html" ? <><Check className="h-3 w-3 mr-1" /> Kopyalandı</> : <><Copy className="h-3 w-3 mr-1" /> Kopyala</>}
                    </Button>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800 whitespace-pre">
                    {htmlCode}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Düşük/Orta skor uyarısı */}
            {result.score < 70 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-400 text-sm mb-1">
                        Rozeti yayınlamadan önce skoru iyileştirmenizi öneririz
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!result.spf && "SPF kaydı eklenmesi (+25 puan), "}
                        {!result.dmarc && "DMARC yapılandırması (+30 puan), "}
                        {!result.ssl && "SSL sertifikası (+35 puan) "}
                        skorunuzu anlamlı şekilde artıracaktır.
                        Teknik detaylar için alan adı güvenlik taraması yapın.
                      </p>
                      <Link href="/domain-tarama" className="mt-2 inline-block">
                        <Button variant="outline" size="sm" className="text-xs mt-2">
                          Alan Adı Güvenlik Taraması <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="font-semibold mb-1">Tam resmi görmek ister misiniz?</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Rozet yalnızca e-posta güvenliği ve SSL'i ölçer. 20 soruluk ücretsiz değerlendirme ile
                  tam güvenlik puanınızı ve kişiselleştirilmiş raporu alın.
                </p>
                <Link href="/assessment/start">
                  <Button>
                    Ücretsiz Değerlendirme Başlat <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
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
