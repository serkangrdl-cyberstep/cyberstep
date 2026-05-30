import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  Shield, AlertTriangle, CheckCircle2, Search, Loader2,
  ChevronRight, RotateCcw, Globe, XCircle, ShieldAlert,
} from "lucide-react";

interface DomainResult {
  domain: string;
  registered: boolean;
  ips: string[];
}

interface MarkaResult {
  originalDomain: string;
  totalChecked: number;
  registeredCount: number;
  registered: DomainResult[];
  safeVariants: DomainResult[];
  riskLevel: "Düşük" | "Orta" | "Yüksek";
}

const RISK_CONFIG = {
  "Düşük":   { cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", icon: CheckCircle2, label: "Düşük Risk" },
  "Orta":    { cls: "bg-amber-500/10 border-amber-500/30 text-amber-400",    icon: AlertTriangle, label: "Orta Risk" },
  "Yüksek":  { cls: "bg-red-500/10 border-red-500/30 text-red-400",         icon: XCircle,       label: "Yüksek Risk" },
};

export default function MarkaKoruma() {
  usePageMeta({
    title: "Marka Koruma ve Domain Taklidi Tespiti | CyberStep.io",
    description: "Alan adınızın taklitlerini tespit edin. Typosquatting ve phishing amaçlı sahte domain'leri anında kontrol edin.",
    noIndex: false,
  });

  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarkaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const input = domain.trim();
    if (!input) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/marka-koruma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: input }),
      });
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

  const riskConfig = result ? RISK_CONFIG[result.riskLevel] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-blue-950/20 to-background">
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-blue-500/40 text-blue-400 bg-blue-500/5">
            <Globe className="h-3 w-3 mr-1" />
            Marka Koruma ve Typosquatting Tespiti
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            Sahte Domain'ler Markanızı Kullanıyor Mu?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Alan adınızın olası taklitlerini DNS üzerinden kontrol eder. Phishing saldırıları ve
            müşteri kaybı için kullanılabilecek kayıtlı taklit domain'leri tespit eder.
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
                <div className="flex-1">
                  <Input
                    placeholder="örn: sirketiniz.com.tr"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !loading && run()}
                    className="text-base"
                  />
                </div>
                <Button
                  onClick={run}
                  disabled={!domain.trim() || loading}
                  className="shrink-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                  {loading ? "Taranıyor..." : "Tara"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Alan adı varyantları DNS üzerinden sorgulanır. Verileriniz kaydedilmez.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Yükleniyor */}
        {loading && (
          <Card>
            <CardContent className="p-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium">DNS sorguları yapılıyor...</p>
              <p className="text-muted-foreground text-sm mt-1">
                Onlarca domain varyantı gerçek zamanlı kontrol ediliyor
              </p>
            </CardContent>
          </Card>
        )}

        {/* Hata */}
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-5 text-red-400 text-sm">{error}</CardContent>
          </Card>
        )}

        {/* Sonuçlar */}
        {result && riskConfig && (
          <div className="space-y-5">
            {/* Özet */}
            <div className={`rounded-xl border p-5 ${riskConfig.cls}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <riskConfig.icon className="h-6 w-6 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-lg">{riskConfig.label}</p>
                    <p className="text-sm mt-0.5">
                      {result.totalChecked} varyant kontrol edildi — {result.registeredCount} kayıtlı domain tespit edildi
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setResult(null); setDomain(""); }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Yeni Tarama
                </Button>
              </div>
            </div>

            {/* Kayıtlı taklit domain'ler */}
            {result.registered.length > 0 ? (
              <Card className="border-red-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-red-400">
                    <ShieldAlert className="h-4 w-4" />
                    Kayıtlı Taklit Domain'ler ({result.registered.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Bu domain'ler DNS'te kayıtlı. Phishing veya müşteri yönlendirme için kullanılıyor olabilir.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {result.registered.map((d) => (
                      <div key={d.domain} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                          <code className="text-sm font-mono text-red-300 truncate">{d.domain}</code>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.ips.length > 0 && (
                            <span className="text-xs text-muted-foreground font-mono">{d.ips[0]}</span>
                          )}
                          <Badge variant="outline" className="text-xs border-red-500/40 text-red-400 bg-red-500/10">
                            Aktif
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-5 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-400">
                    Kontrol edilen {result.totalChecked} varyant arasında kayıtlı taklit domain bulunamadı.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Risk değerlendirmesi */}
            {result.registeredCount > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-5 space-y-2">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Bu Durumun Riskleri
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><span className="text-amber-400">•</span>Müşterilerinize sahte fatura veya ödeme talebi e-postası gönderilebilir</li>
                    <li className="flex items-start gap-2"><span className="text-amber-400">•</span>Çalışanlarınız CEO adına sahte para transferi talebi alabilir</li>
                    <li className="flex items-start gap-2"><span className="text-amber-400">•</span>Sahte site üzerinden toplanan veriler KVKK kapsamında sizin sorumluluğunuzu doğurabilir</li>
                    <li className="flex items-start gap-2"><span className="text-amber-400">•</span>Marka itibarınız zarar görebilir</li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-1">
                    Önerilen aksiyon: Alan adı sahipliğini belirleyin, hukuk danışmanı ile kaldırma süreci başlatın,
                    müşterilerinize sahte domain uyarısı bildirin.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Güvenli varyantlar */}
            {result.safeVariants.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Kayıtsız Varyantlar (örnek)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.safeVariants.map(d => (
                      <code key={d.domain} className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground font-mono">
                        {d.domain}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Bu domain'ler kayıtsız. Markanızı korumak için kritik olanları kayıt altına almayı değerlendirebilirsiniz.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="font-semibold mb-1">E-posta güvenliğiniz de zayıf olabilir</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Taklit domain saldırılarının yüzde doksanı, hedefin e-posta altyapısındaki açıklardan yararlanır.
                  Ücretsiz alan adı tarama ile SPF/DKIM/DMARC durumunuzu kontrol edin.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Link href="/domain-tarama">
                    <Button variant="outline">
                      <Globe className="h-4 w-4 mr-1" /> Alan Adı Güvenlik Taraması
                    </Button>
                  </Link>
                  <Link href="/assessment/start">
                    <Button>
                      Tam Risk Değerlendirmesi <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bilgi kutuları */}
        {!result && !loading && (
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              { icon: Shield, title: "70+ Varyant Kontrolü", desc: "Yazım hataları, TLD değişimleri, ek karakter ve ön/son ek kombinasyonları taranır." },
              { icon: Globe, title: "Gerçek Zamanlı DNS", desc: "Her varyant için canlı DNS sorgusu yapılır. Statik veritabanı değil, anlık durum." },
              { icon: AlertTriangle, title: "Risk Sınıflandırması", desc: "Kayıtlı taklit sayısına göre Düşük / Orta / Yüksek risk seviyesi belirlenir." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title}>
                <CardContent className="p-4">
                  <Icon className="h-5 w-5 text-primary mb-2" />
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Marka taklit bir semptom — kaynağa bakın.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phishing, e-posta güvenliği ve veri sızıntısı dahil 5 güvenlik alanınızı 20 dakikada ücretsiz değerlendirin.
            </p>
          </div>
          <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap">
            Ücretsiz Değerlendirme →
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}
