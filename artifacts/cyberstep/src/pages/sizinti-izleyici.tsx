import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, Search, AlertTriangle, CheckCircle2, Lock, ExternalLink, Info, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

interface BreachResult {
  domain: string;
  breachCount: number;
  totalPwnCount: number;
  breaches: Array<{
    name: string;
    breachDate: string;
    pwnCount: number;
    dataClassCount: number;
    dataClassPreview: string | null;
  }>;
  checkedAt: string;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}B`;
  return n.toString();
}

function RiskBadge({ count }: { count: number }) {
  if (count === 0) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
      <CheckCircle2 className="h-4 w-4" /> Temiz
    </span>
  );
  if (count <= 2) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium border border-yellow-500/20">
      <AlertTriangle className="h-4 w-4" /> {count} İhlal
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-sm font-medium border border-red-500/20">
      <AlertTriangle className="h-4 w-4" /> {count} İhlal — Kritik
    </span>
  );
}

export default function SizintiIzleyici() {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<BreachResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: async (d: string) => {
      const r = await fetch("/api/breach-monitor/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Sorgu başarısız");
      return j as BreachResult;
    },
    onSuccess: (data) => setResult(data),
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = domain.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] ?? "";
    if (!cleaned) return;
    setResult(null);
    checkMutation.mutate(cleaned);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-slate-950 border-b border-slate-800 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 text-red-400 text-sm font-medium mb-6">
            <Database className="h-4 w-4" />
            Dark Web &amp; Veri Sızıntısı Taraması
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {lang === "en" ? "Have Your Company Emails Been Leaked?" : "Şirket E-postalarınız Sızdı mı?"}
          </h1>
          <p className="text-slate-400 text-lg mb-3">
            Domain adresinizi girin — çalışanlarınıza ait e-postaların dark web'de ve veri ihlali veritabanlarında
            dolaşıp dolaşmadığını anında kontrol edelim.
          </p>
          <p className="text-slate-500 text-sm">
            Have I Been Pwned veritabanı ile{" "}
            <span className="text-slate-400 font-medium">14 milyardan fazla</span> sızdırılmış hesap sorgulanır.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Arama formu */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="sirketiniz.com"
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button
                type="submit"
                disabled={!domain.trim() || checkMutation.isPending}
                className="px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {checkMutation.isPending ? "Taranıyor..." : "Sorgula"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Yalnızca domain adresini girin (örn: <code className="text-foreground">acme.com</code>). www ve http:// olmadan da çalışır.
            </p>
          </CardContent>
        </Card>

        {/* Yükleniyor */}
        {checkMutation.isPending && (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-8 text-center">
              <div className="inline-block h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground text-sm">
                <strong className="text-foreground">{domain}</strong> için veri ihlali kayıtları sorgulanıyor...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sonuç */}
        {result && !checkMutation.isPending && (
          <>
            {/* Özet kart */}
            <Card className={`border-2 ${result.breachCount === 0 ? "border-emerald-500/30 bg-emerald-500/5" : result.breachCount <= 2 ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{result.domain}</span>
                      <RiskBadge count={result.breachCount} />
                    </div>
                    {result.breachCount > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Bu domain ile ilişkili{" "}
                        <span className="font-bold text-foreground">{formatNumber(result.totalPwnCount)}</span>{" "}
                        hesap toplamda etkilendi. Çalışanlarınızın şifreleri tehlikede olabilir.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Bu domain için bilinen bir veri ihlali kaydı bulunamadı.
                        Düzenli tarama yaparak takipte kalmanızı öneririz.
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-4xl font-bold ${result.breachCount === 0 ? "text-emerald-500" : result.breachCount <= 2 ? "text-yellow-500" : "text-red-500"}`}>
                      {result.breachCount}
                    </div>
                    <div className="text-xs text-muted-foreground">ihlal kaydı</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* İhlal listesi */}
            {result.breachCount > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Tespit Edilen İhlaller
                </h2>
                {result.breaches.map((breach, i) => (
                  <Card key={i} className="border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground truncate">{breach.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{breach.breachDate}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">{formatNumber(breach.pwnCount)}</span> hesap etkilendi
                            </span>
                            {breach.dataClassPreview && (
                              <span className="flex items-center gap-1">
                                <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-xs">
                                  {breach.dataClassPreview}
                                </span>
                                {breach.dataClassCount > 1 && (
                                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <Lock className="h-3 w-3" />
                                    +{breach.dataClassCount - 1} daha
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pro upsell */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground text-sm mb-1">Tam Detay Pro Pakette</p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Hangi şifreler, hangi veri kategorileri sızdı? Çalışan bazında e-posta sorgusu, haftalık otomatik izleme ve anlık uyarılar Pro planda.
                        </p>
                        <a href="/assessment/start" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                          Ücretsiz Değerlendirme ile Başla <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Temiz çıktıysa da aksiyon öner */}
            {result.breachCount === 0 && (
              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base">Sıradaki Adımlar</CardTitle>
                  <CardDescription>Temiz geçmiş iyi bir başlangıç, ancak yeterli değil.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "Çalışanlarınız aynı şifreyi farklı servislerde kullanıyor olabilir.",
                    "Domain e-posta güvenliğinizi (SPF, DMARC, DKIM) kontrol ettirin.",
                    "Düzenli sızıntı izlemesi için Pro pakete geçebilirsiniz.",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      {item}
                    </div>
                  ))}
                  <div className="pt-2 space-y-3">
                    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Temiz geçmiş tek başına yeterli değil.</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Domain e-posta güvenliği, cihaz koruması ve çalışan farkındalığı değerlendirmenizi 20 dakikada yapın.
                          </p>
                        </div>
                        <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2 rounded-md">
                          Ücretsiz Değerlendirme <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Nasıl çalışır */}
        {!result && !checkMutation.isPending && (
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: "14 Milyar+ Kayıt",
                desc: "Have I Been Pwned, dünyanın en kapsamlı veri ihlali veritabanıdır. Tüm büyük sızıntıları içerir.",
              },
              {
                title: "Domain Düzeyinde Tarama",
                desc: "Tek tek e-posta adresi değil, tüm domain için toplu sorgu yapılır. Tüm çalışanlar tek sorguda kontrol edilir.",
              },
              {
                title: "Ücretsiz Kullanım",
                desc: "İhlal sayısı ve genel bilgiler tamamen ücretsizdir. Detaylı analiz ve haftalık izleme Pro pakette sunulur.",
              },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-lg border border-border bg-muted/30">
                <p className="font-semibold text-foreground text-sm mb-1">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Kaynak notu */}
        <p className="text-xs text-muted-foreground text-center">
          Veri kaynağı: <a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">HaveIBeenPwned.com</a> —
          Troy Hunt tarafından yönetilen, güvenlik topluluğunun başvuru kaynağı.
          CyberStep.io bu veriyi üçüncü taraf API üzerinden sorgular; ham veriyi depolamaz.
        </p>
      </div>
    </div>
  );
}
