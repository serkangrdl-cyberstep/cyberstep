import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  TrendingDown, Loader2, ChevronRight, RotateCcw,
  Clock, Users, Star, Scale, ShieldAlert, Server, Calculator,
} from "lucide-react";

const SECTORS = [
  "Üretim / İmalat", "Perakende / E-ticaret", "Lojistik / Taşımacılık",
  "İnşaat / Gayrimenkul", "Finans / Muhasebe", "Sağlık / Klinik",
  "Hukuk / Danışmanlık", "Tekstil / Hazır Giyim", "Gıda / Restoran",
  "Turizm / Otelcilik", "Yazılım / BT Hizmetleri", "Eğitim",
  "Otomotiv / Servis", "Tarım / Hayvancılık", "Diğer",
];

const EMPLOYEE_RANGES = ["1-9", "10-49", "50-99", "100-249", "250-499", "500+"];

const REVENUE_RANGES = [
  "1 - 5 milyon TL", "5 - 25 milyon TL", "25 - 100 milyon TL",
  "100 - 500 milyon TL", "500 milyon TL+",
];

const RISK_OPTIONS = [
  "Açık RDP / Uzak masaüstü", "Zayıf şifre politikası", "Güncellenmemiş yazılımlar",
  "SPF/DMARC yapılandırılmamış", "Çalışan güvenlik eğitimi yok",
  "Yedekleme sistemi yok", "Antivirüs/EDR yok", "MFA kullanılmıyor",
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock, users: Users, star: Star, scale: Scale,
  "shield-alert": ShieldAlert, server: Server,
};

const OLASILIK_RENK: Record<string, string> = {
  "Yüksek": "bg-red-500/20 text-red-400 border-red-500/30",
  "Orta":   "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Düşük":  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

interface Kategori {
  kategori: string;
  aciklama: string;
  minTL: number;
  maxTL: number;
  olasilik: string;
  ikon: string;
}

interface KayipResult {
  ozet: string;
  kategoriler: Kategori[];
  toplamMin: number;
  toplamMax: number;
  karsilastirma: string;
  enKritikRisk: string;
  oneri: string;
}

export default function FinansalKayip() {
  usePageMeta({
    title: "Siber Saldırı Finansal Kayıp Hesaplayıcı | CyberStep.io",
    description: "Şirketinize yapılacak bir siber saldırının TL cinsinden finansal etkisini hesaplayın. IBM ve Verizon DBIR verileri referans alınmıştır.",
    noIndex: false,
  });

  const [form, setForm] = useState({
    sector: "",
    employeeCount: "",
    annualRevenue: "",
    riskler: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KayipResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleRisk(r: string) {
    setForm(f => ({
      ...f,
      riskler: f.riskler.includes(r) ? f.riskler.filter(x => x !== r) : [...f.riskler, r],
    }));
  }

  async function run() {
    if (!form.sector || !form.employeeCount || !form.annualRevenue) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/finansal-kayip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector: form.sector,
          employeeCount: form.employeeCount,
          annualRevenue: form.annualRevenue,
          riskler: form.riskler.length > 0 ? form.riskler : undefined,
        }),
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-amber-950/20 to-background">
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-amber-500/40 text-amber-400 bg-amber-500/5">
            <Calculator className="h-3 w-3 mr-1" />
            TL Bazlı Finansal Etki Analizi
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            Siber Saldırı Kaça Mal Olur?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            IBM Cost of Data Breach ve Verizon DBIR verilerine dayalı, Türkiye KOBİ pazarına uyarlanmış
            finansal etki hesaplayıcısı. Altı kategoride TL bazında kayıp aralığı.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {!result ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-amber-500" />
                Şirket Bilgilerinizi Girin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Sektör *</Label>
                  <Select value={form.sector} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sektör seçin" /></SelectTrigger>
                    <SelectContent>
                      {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Çalışan Sayısı *</Label>
                  <Select value={form.employeeCount} onValueChange={v => setForm(f => ({ ...f, employeeCount: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_RANGES.map(r => <SelectItem key={r} value={r}>{r} çalışan</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Yıllık Ciro *</Label>
                  <Select value={form.annualRevenue} onValueChange={v => setForm(f => ({ ...f, annualRevenue: v }))}>
                    <SelectTrigger><SelectValue placeholder="Ciro aralığı" /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bilinen Güvenlik Açıkları (opsiyonel)</Label>
                <div className="flex flex-wrap gap-2">
                  {RISK_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRisk(r)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        form.riskler.includes(r)
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                          : "border-border text-muted-foreground hover:border-amber-500/30"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                size="lg"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!form.sector || !form.employeeCount || !form.annualRevenue || loading}
                onClick={run}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gemini hesaplıyor...</>
                ) : (
                  <><Calculator className="h-4 w-4 mr-2" /> Finansal Etkiyi Hesapla</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Hesaplama IBM CODB 2024, Verizon DBIR 2024 ve Türkiye KOBİ olay verilerine dayanmaktadır.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Finansal Etki Raporu</h2>
                <p className="text-muted-foreground text-sm">{form.sector} · {form.employeeCount} çalışan · {form.annualRevenue}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Yeniden Hesapla
              </Button>
            </div>

            {/* Özet */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed">{result.ozet}</p>
              </CardContent>
            </Card>

            {/* Kategoriler */}
            <div className="space-y-3">
              {result.kategoriler.map((k, i) => {
                const Icon = ICON_MAP[k.ikon] ?? TrendingDown;
                return (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="bg-muted rounded-lg p-2 shrink-0">
                            <Icon className="h-4 w-4 text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{k.kategori}</p>
                            <p className="text-xs text-muted-foreground">{k.aciklama}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="font-bold text-amber-400 text-sm">
                            {fmt(k.minTL)} – {fmt(k.maxTL)} TL
                          </p>
                          <Badge variant="outline" className={`text-xs ${OLASILIK_RENK[k.olasilik] ?? "border-border text-muted-foreground"}`}>
                            {k.olasilik} Olasılık
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Toplam */}
            <Card className="border-red-500/30 bg-red-500/10">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-base">Toplam Tahmini Kayıp</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{result.karsilastirma}</p>
                </div>
                <p className="text-2xl font-bold text-red-400">
                  {fmt(result.toplamMin)} – {fmt(result.toplamMax)} TL
                </p>
              </CardContent>
            </Card>

            {/* En Kritik Risk */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-red-500/20">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">En Kritik Finansal Tehdit</p>
                  <p className="font-semibold text-red-400">{result.enKritikRisk}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/20">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">En Etkili Koruma Yatırımı</p>
                  <p className="font-semibold text-emerald-400 text-sm">{result.oneri}</p>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="font-semibold mb-1">Bu rakamları gerçek risk analiziyle doğrulayın</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Ücretsiz Mini Değerlendirme ile gerçek güvenlik puanınızı ve kişisel aksiyon planınızı alın.
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
      </div>
    </div>
  );
}
