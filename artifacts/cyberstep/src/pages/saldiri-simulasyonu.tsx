import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  Shield, AlertTriangle, Clock, TrendingDown, Newspaper,
  Loader2, ChevronRight, RotateCcw, Zap, Lock, Target,
} from "lucide-react";

const SECTORS = [
  "Üretim / İmalat", "Perakende / E-ticaret", "Lojistik / Taşımacılık",
  "İnşaat / Gayrimenkul", "Finans / Muhasebe", "Sağlık / Klinik",
  "Hukuk / Danışmanlık", "Tekstil / Hazır Giyim", "Gıda / Restoran",
  "Turizm / Otelcilik", "Yazılım / BT Hizmetleri", "Eğitim",
  "Otomotiv / Servis", "Tarım / Hayvancılık", "Diğer",
];

const EMPLOYEE_RANGES = [
  "1-9", "10-49", "50-99", "100-249", "250-499", "500+",
];

const REVENUE_RANGES = [
  "1 - 5 milyon TL", "5 - 25 milyon TL", "25 - 100 milyon TL",
  "100 - 500 milyon TL", "500 milyon TL+",
];

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

interface FinansalKalem { min: number; max: number; aciklama: string; }
interface Hamle { hamle: string; aciklama: string; sure: string; maliyet?: string; }

interface SimulationResult {
  giris: { baslik: string; hikaye: string; yontem: string };
  ilk24saat: { baslik: string; hikaye: string; etkiler: string[] };
  ilk7gun: { baslik: string; hikaye: string; etkiler: string[] };
  finansalEtki: {
    operasyonKaybi: FinansalKalem;
    musteriKaybi: FinansalKalem;
    kvkkCezasi: FinansalKalem;
    itKurtarma: FinansalKalem;
    itibarHasari: FinansalKalem;
    toplam: { min: number; max: number };
  };
  medyaBasligi: string;
  onleyici3Hamle: Hamle[];
}

export default function SaldiriSimulasyonu() {
  usePageMeta({
    title: "Saldırı Simülasyonu — Siber İkiz | CyberStep.io",
    description: "Yapay zeka ile şirketinize yönelik gerçekçi bir siber saldırı senaryosu oluşturun. Saldırganın bakış açısından riski görün.",
    noIndex: false,
  });

  const [form, setForm] = useState({
    sector: "",
    employeeCount: "",
    annualRevenue: "",
    knownRisks: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!form.sector || !form.employeeCount) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/breach-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector: form.sector,
          employeeCount: form.employeeCount,
          annualRevenue: form.annualRevenue,
          knownRisks: form.knownRisks || undefined,
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

  function reset() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-red-950/30 to-background">
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-red-500/40 text-red-400 bg-red-500/5">
            <Target className="h-3 w-3 mr-1" />
            Yapay Zeka ile Saldırı Simülasyonu
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            Siber İkiz — Saldırgan Gözüyle Şirketinize Bakın
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            "Eğer ben saldırgan olsaydım, şirketinize nasıl sızardım?" Gemini AI gerçekçi bir saldırı senaryosu,
            finansal etki analizi ve önleyici 3 hamle üretir.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {!result ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                Şirket Profilinizi Girin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label>Yıllık Ciro (opsiyonel)</Label>
                  <Select value={form.annualRevenue} onValueChange={v => setForm(f => ({ ...f, annualRevenue: v }))}>
                    <SelectTrigger><SelectValue placeholder="Ciro aralığı seçin" /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bilinen Riskler (opsiyonel)</Label>
                  <Input
                    placeholder="Örn: Açık RDP, eski Windows, zayıf şifreler..."
                    value={form.knownRisks}
                    onChange={e => setForm(f => ({ ...f, knownRisks: e.target.value }))}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                size="lg"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={!form.sector || !form.employeeCount || loading}
                onClick={run}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gemini analiz yapıyor...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Saldırı Senaryomu Oluştur</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Girilen bilgiler sunucuya kaydedilmez. Yalnızca simülasyon için kullanılır.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Saldırı Simülasyonu Raporu</h2>
                <p className="text-muted-foreground text-sm">{form.sector} · {form.employeeCount} çalışan</p>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1" /> Yeniden Oluştur
              </Button>
            </div>

            {/* Giriş */}
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-red-500/20 rounded-lg p-2.5 shrink-0">
                    <Target className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-400 mb-1">{result.giris.baslik}</h3>
                    <p className="text-sm leading-relaxed mb-3">{result.giris.hikaye}</p>
                    <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10 text-xs">
                      Saldırı Yöntemi: {result.giris.yontem}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* İlk 24 saat + 7 gün */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-orange-500/30 bg-orange-500/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-orange-400" />
                    <h3 className="font-semibold text-orange-400 text-sm">{result.ilk24saat.baslik}</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{result.ilk24saat.hikaye}</p>
                  <ul className="space-y-1.5">
                    {result.ilk24saat.etkiler.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-orange-400 mt-0.5 shrink-0">•</span>{e}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-red-700/30 bg-red-900/10">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    <h3 className="font-semibold text-red-400 text-sm">{result.ilk7gun.baslik}</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{result.ilk7gun.hikaye}</p>
                  <ul className="space-y-1.5">
                    {result.ilk7gun.etkiler.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-red-400 mt-0.5 shrink-0">•</span>{e}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Finansal Etki */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Tahmini Finansal Etki
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4">
                  {[
                    { label: "Operasyon Durması", data: result.finansalEtki.operasyonKaybi },
                    { label: "Müşteri Kaybı", data: result.finansalEtki.musteriKaybi },
                    { label: "KVKK İdari Cezası", data: result.finansalEtki.kvkkCezasi },
                    { label: "IT Kurtarma", data: result.finansalEtki.itKurtarma },
                    { label: "İtibar Hasarı", data: result.finansalEtki.itibarHasari },
                  ].map(({ label, data }) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{data.aciklama}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-red-400">
                          {fmt(data.min)} – {fmt(data.max)} TL
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 flex items-center justify-between">
                  <p className="font-bold text-red-400">Toplam Tahmini Kayıp</p>
                  <p className="text-xl font-bold text-red-400">
                    {fmt(result.finansalEtki.toplam.min)} – {fmt(result.finansalEtki.toplam.max)} TL
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Medya Başlığı */}
            <Card className="border-slate-500/30 bg-slate-500/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Newspaper className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Bu olay basına yansısaydı...</p>
                    <p className="text-sm font-semibold italic">"{result.medyaBasligi}"</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Önleyici 3 Hamle */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-500" />
                Bu Saldırıyı Önleyecek 3 Hamle
              </h3>
              <div className="space-y-3">
                {result.onleyici3Hamle.map((h, i) => (
                  <Card key={i} className="border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-500/20 rounded-full h-7 w-7 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-sm">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-400 text-sm">{h.hamle}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{h.aciklama}</p>
                          <div className="flex gap-3 mt-2">
                            <span className="text-xs text-slate-400">Süre: {h.sure}</span>
                            {h.maliyet && <span className="text-xs text-slate-400">Maliyet: {h.maliyet}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="font-semibold mb-1">Gerçek güvenlik durumunuzu öğrenmek ister misiniz?</p>
                <p className="text-muted-foreground text-sm mb-4">
                  20 soruluk ücretsiz Mini Değerlendirme ile gerçek risk puanınızı ve kişiselleştirilmiş raporu alın.
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
