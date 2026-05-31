import { useState } from "react";
import { Shield, ArrowRight, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useToast } from "@/hooks/use-toast";

interface ScanBrief {
  domain: string;
  overallScore: number;
  riskLevel: string;
  criticalCount: number;
  hibpBreachCount: number;
  shodanVulnCount: number;
}

interface CompareResult {
  own: ScanBrief;
  competitor: ScanBrief;
  diff: number;
}

const RISK_COLOR: Record<string, string> = {
  "Kritik": "#dc2626",
  "Yüksek": "#ea580c",
  "Orta": "#d97706",
  "Düşük": "#16a34a",
};

function ScoreBadge({ score, riskLevel }: { score: number; riskLevel: string }) {
  const color = RISK_COLOR[riskLevel] ?? "#64748b";
  return (
    <div className="text-center">
      <div className="text-5xl font-black" style={{ color }}>{score}<span className="text-2xl font-normal text-muted-foreground">/100</span></div>
      <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold" style={{ background: color + "20", color }}>
        {riskLevel} Risk
      </span>
    </div>
  );
}

export default function RakipKarsilastirma() {
  usePageMeta({
    title: "Rakibiniz Nerede? — Güvenlik Skoru Karşılaştırma | CyberStep.io",
    description: "Kendi domain'inizin güvenlik skorunu rakibinizle karşılaştırın. Farkı görün, önce kapatın.",
    canonicalPath: "/rakip-karsilastirma",
    lang: "tr",
  });

  const { toast } = useToast();
  const [ownDomain, setOwnDomain] = useState("");
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadDone, setLeadDone] = useState(false);

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!ownDomain.trim() || !competitorDomain.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/public/competitor-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownDomain: ownDomain.trim(), competitorDomain: competitorDomain.trim() }),
      });
      if (!res.ok) throw new Error("Karşılaştırma başarısız");
      const data = await res.json();
      setResult(data);
      setShowLeadForm(true);
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLeadLoading(true);
    try {
      await fetch("/api/public/competitor-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownDomain: ownDomain.trim(),
          competitorDomain: competitorDomain.trim(),
          email: email.trim(),
          company: company.trim(),
        }),
      });
      setLeadDone(true);
    } catch {
      // best effort
      setLeadDone(true);
    } finally {
      setLeadLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <TrendingUp className="h-4 w-4" />
            Ücretsiz Karşılaştırma Aracı
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Rakibiniz <span className="text-emerald-400">Nerede?</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Kendi alan adınızın güvenlik skorunu rakibinizle karşılaştırın. Farkı görün, önce siz kapatın.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-2xl">
          <form onSubmit={handleCompare} className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="own">Sizin domain'iniz</Label>
                <Input
                  id="own"
                  value={ownDomain}
                  onChange={e => setOwnDomain(e.target.value)}
                  placeholder="sirketiniz.com.tr"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp">Rakibinizin domain'i</Label>
                <Input
                  id="comp"
                  value={competitorDomain}
                  onChange={e => setCompetitorDomain(e.target.value)}
                  placeholder="rakibiniz.com.tr"
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500" disabled={loading || !ownDomain || !competitorDomain}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Taranıyor...</>
              ) : (
                <><TrendingUp className="h-4 w-4 mr-2" /> Karşılaştır</>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Tarama 15-30 saniye sürebilir. Teknik bilgi gerekmez.
            </p>
          </form>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="pb-16 bg-background">
          <div className="container mx-auto px-4 max-w-3xl space-y-8">
            {/* Score Comparison */}
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 border-b">
                <div className="p-6 border-r text-center">
                  <div className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Siz</div>
                  <div className="text-lg font-bold mb-4 text-foreground">{result.own.domain}</div>
                  <ScoreBadge score={result.own.overallScore} riskLevel={result.own.riskLevel} />
                </div>
                <div className="p-6 text-center">
                  <div className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Rakibiniz</div>
                  <div className="text-lg font-bold mb-4 text-foreground">{result.competitor.domain}</div>
                  <ScoreBadge score={result.competitor.overallScore} riskLevel={result.competitor.riskLevel} />
                </div>
              </div>

              {/* Verdict */}
              <div className="p-6 text-center bg-muted/30">
                {result.diff < 0 ? (
                  <div className="space-y-2">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="font-semibold text-lg">Rakibiniz sizden <span className="text-amber-600">{Math.abs(result.diff)} puan</span> önde.</p>
                    <p className="text-sm text-muted-foreground">Farkı kapatmak için ücretsiz danışmanlık alın.</p>
                  </div>
                ) : result.diff > 0 ? (
                  <div className="space-y-2">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-lg">Rakibinizden <span className="text-emerald-600">{result.diff} puan</span> öndeydiniz.</p>
                    <p className="text-sm text-muted-foreground">Bu avantajı büyüterek koruyun.</p>
                  </div>
                ) : (
                  <p className="font-semibold">Skorunuz eşit.</p>
                )}
              </div>

              {/* Comparison Table */}
              <div className="border-t">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Metrik</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Siz</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Rakibiniz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { label: "Güvenlik Skoru", own: result.own.overallScore + "/100", comp: result.competitor.overallScore + "/100" },
                      { label: "Risk Seviyesi", own: result.own.riskLevel, comp: result.competitor.riskLevel },
                      { label: "Veri Sızıntısı", own: result.own.hibpBreachCount + " ihlal", comp: result.competitor.hibpBreachCount + " ihlal" },
                      { label: "Açık Güvenlik Açığı", own: result.own.shodanVulnCount + " CVE", comp: result.competitor.shodanVulnCount + " CVE" },
                    ].map(row => (
                      <tr key={row.label}>
                        <td className="px-4 py-3 text-sm font-medium">{row.label}</td>
                        <td className="px-4 py-3 text-sm text-center">{row.own}</td>
                        <td className="px-4 py-3 text-sm text-center">{row.comp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lead Capture */}
            {showLeadForm && !leadDone && (
              <div className="bg-card border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold">Detaylı raporu e-posta ile alın</h3>
                  <p className="text-sm text-muted-foreground">
                    Her iki domain için tam güvenlik analizi, öncelikli aksiyon planı ve ücretsiz danışmanlık.
                  </p>
                </div>
                <form onSubmit={handleLeadSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="lead-email">E-posta *</Label>
                      <Input id="lead-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="siz@sirket.com" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lead-company">Şirket Adı</Label>
                      <Input id="lead-company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Şirket A.Ş." />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500" disabled={leadLoading || !email}>
                    {leadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    Tam Raporu E-posta ile Al
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">Ücretsiz. Spam yok. İstediğiniz zaman iptal edin.</p>
                </form>
              </div>
            )}

            {leadDone && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center space-y-3">
                <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto" />
                <h3 className="text-lg font-semibold">Raporunuz yolda!</h3>
                <p className="text-sm text-muted-foreground">
                  Detaylı analiz e-posta adresinize gönderilecek. Uzman ekibimiz 24 saat içinde sizinle iletişime geçecek.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* How it works */}
      {!result && (
        <section className="pb-20 bg-muted/30 border-t">
          <div className="container mx-auto px-4 max-w-4xl py-16">
            <h2 className="text-2xl font-bold text-center mb-10">Nasıl Çalışır?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: "1", title: "Domain girin", desc: "Kendi domain'inizi ve rakibinizin domain'ini girin. Alan adları dışında bilgi gerekmez." },
                { step: "2", title: "Otomatik tarama", desc: "İki domain paralel olarak taranır. SSL, veri sızıntısı, açık portlar, CVE'ler ve daha fazlası." },
                { step: "3", title: "Skoru görün", desc: "100 üzerinden güvenlik skoru karşılaştırması. Kim nerede? Fark ne kadar? Ne yapmalısınız?" },
              ].map(item => (
                <div key={item.step} className="bg-card border rounded-xl p-6 space-y-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">{item.step}</div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-4">
          <Shield className="h-10 w-10 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold">Sadece rakibinizi değil, kendinizi de tarayın</h2>
          <p className="text-slate-400">20 soruluk ücretsiz risk değerlendirmesi — teknik bilgi gerekmez.</p>
          <a
            href="/assessment/start"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors"
          >
            Ücretsiz Değerlendirme Başlat <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
