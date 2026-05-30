import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  ShieldAlert, TrendingDown, Calculator, ChevronRight,
  AlertTriangle, Building2, Users, BadgeCheck, Info,
} from "lucide-react";

// ─── Veri tabloları ───────────────────────────────────────────────────────────

const SEKTORLER = [
  { value: "finans", label: "Finans & Sigorta", multiplier: 2.5, kvkkRisk: "Çok Yüksek", kvkkMin: 500_000, kvkkMax: 5_000_000 },
  { value: "saglik", label: "Sağlık & Klinik", multiplier: 2.2, kvkkRisk: "Çok Yüksek", kvkkMin: 500_000, kvkkMax: 5_000_000 },
  { value: "eticaret", label: "E-ticaret & Perakende", multiplier: 2.0, kvkkRisk: "Yüksek", kvkkMin: 250_000, kvkkMax: 2_000_000 },
  { value: "bilisim", label: "Bilgi Teknolojileri", multiplier: 1.8, kvkkRisk: "Yüksek", kvkkMin: 250_000, kvkkMax: 2_000_000 },
  { value: "uretim", label: "Üretim & Sanayi", multiplier: 1.5, kvkkRisk: "Orta", kvkkMin: 100_000, kvkkMax: 750_000 },
  { value: "lojistik", label: "Lojistik & Taşımacılık", multiplier: 1.3, kvkkRisk: "Orta", kvkkMin: 100_000, kvkkMax: 750_000 },
  { value: "turizm", label: "Turizm & Otelcilik", multiplier: 1.4, kvkkRisk: "Orta", kvkkMin: 100_000, kvkkMax: 750_000 },
  { value: "insaat", label: "İnşaat & Gayrimenkul", multiplier: 1.2, kvkkRisk: "Düşük", kvkkMin: 50_000, kvkkMax: 300_000 },
  { value: "egitim", label: "Eğitim", multiplier: 1.3, kvkkRisk: "Orta", kvkkMin: 100_000, kvkkMax: 750_000 },
  { value: "hizmet", label: "Profesyonel Hizmetler", multiplier: 1.2, kvkkRisk: "Düşük", kvkkMin: 50_000, kvkkMax: 300_000 },
  { value: "diger", label: "Diğer", multiplier: 1.0, kvkkRisk: "Düşük", kvkkMin: 50_000, kvkkMax: 300_000 },
] as const;

const CALISANLAR = [
  { value: "1-10", label: "1 – 10 çalışan", baseCost: 185_000, plan: "Başlangıç Aboneliği", planPrice: 690, planSlug: "starter" },
  { value: "11-50", label: "11 – 50 çalışan", baseCost: 420_000, plan: "Büyüme Aboneliği", planPrice: 1990, planSlug: "growth" },
  { value: "51-200", label: "51 – 200 çalışan", baseCost: 850_000, plan: "Büyüme Aboneliği", planPrice: 1990, planSlug: "growth" },
  { value: "201-500", label: "201 – 500 çalışan", baseCost: 1_800_000, plan: "Kurumsal Abonelik", planPrice: 5990, planSlug: "enterprise" },
  { value: "500+", label: "500+ çalışan", baseCost: 3_500_000, plan: "Kurumsal Abonelik", planPrice: 5990, planSlug: "enterprise" },
] as const;

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────
function fmtTL(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} Milyon TL`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("tr-TR")} Bin TL`;
  return `${n.toLocaleString("tr-TR")} TL`;
}

function riskRenk(kvkkRisk: string) {
  if (kvkkRisk === "Çok Yüksek") return "bg-red-100 text-red-700 border-red-200";
  if (kvkkRisk === "Yüksek") return "bg-orange-100 text-orange-700 border-orange-200";
  if (kvkkRisk === "Orta") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-green-100 text-green-700 border-green-200";
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────
export default function RoiHesaplayici() {
  usePageMeta({
    title: "Siber Risk ROI Hesaplayıcı — Şirketinizin Siber Maruziyetini Hesaplayın | CyberStep.io",
    description: "Sektörünüz ve şirket büyüklüğünüze göre tahmini siber risk maliyetinizi ve CyberStep ile sağlayacağınız tasarrufu hesaplayın.",
    noIndex: false,
  });

  const [sektor, setSektor] = useState<string>("");
  const [calisanlar, setCalisanlar] = useState<string>("");

  const sektorData = SEKTORLER.find(s => s.value === sektor);
  const calisanData = CALISANLAR.find(c => c.value === calisanlar);

  const hazir = !!sektorData && !!calisanData;

  const riskMin = hazir ? Math.round(calisanData.baseCost * sektorData.multiplier * 0.7) : 0;
  const riskMax = hazir ? Math.round(calisanData.baseCost * sektorData.multiplier * 1.3) : 0;
  const riskOrta = hazir ? Math.round((riskMin + riskMax) / 2) : 0;

  const yillikAbone = hazir ? calisanData.planPrice * 12 : 0;
  const tasarruf = hazir ? Math.round(riskOrta - yillikAbone) : 0;
  const roi = hazir && yillikAbone > 0 ? Math.round((tasarruf / yillikAbone) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-orange-950/20 to-background">
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-orange-500/40 text-orange-400 bg-orange-500/5">
            <Calculator className="h-3 w-3 mr-1" />
            Siber Risk Hesaplayıcı
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            Şirketinizin Siber Risk Maliyeti Ne Kadar?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Sektörünüze ve şirket büyüklüğüne göre olası siber saldırı maliyetini, KVKK ceza riskini
            ve CyberStep ile sağlayacağınız tasarrufu hesaplayın.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="grid md:grid-cols-2 gap-8 items-start">

          {/* Sol: Girdi formu */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Şirket Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sektör</Label>
                <Select value={sektor} onValueChange={setSektor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sektörünüzü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEKTORLER.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Çalışan Sayısı</Label>
                <Select value={calisanlar} onValueChange={setCalisanlar}>
                  <SelectTrigger>
                    <SelectValue placeholder="Çalışan sayısını seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALISANLAR.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bağlam kutusu */}
              <div className="bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Hesaplama metodolojisi
                </p>
                <p>Türkiye KOBİ verisi, IBM Cost of a Data Breach 2024 raporu ve KVKK Kurulu kararları esas alınmıştır. Sektörel çarpanlar Verizon DBIR 2024 sektör ihlal frekansı verisiyle kalibre edilmiştir.</p>
                <p>Sonuçlar istatistiksel tahminden ibarettir; garantili maliyet değildir.</p>
              </div>

              {hazir && (
                <Link href="/assessment/start">
                  <Button className="w-full" size="lg">
                    Ücretsiz Güvenlik Değerlendirmesi Başlat
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Sağ: Sonuçlar */}
          {!hazir ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Calculator className="h-12 w-12 mb-4 opacity-20" />
              <p>Sektör ve çalışan sayısını seçerek risk maliyetinizi hesaplayın</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Siber saldırı risk aralığı */}
              <Card className="border-red-200 bg-red-50/30">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700 mb-1">Tahmini Siber Saldırı Maliyeti</p>
                      <div className="text-3xl font-black text-red-600 mb-1">
                        {fmtTL(riskMin)} – {fmtTL(riskMax)}
                      </div>
                      <p className="text-xs text-red-500/80">
                        Orta senaryo: {fmtTL(riskOrta)} — ransomware, veri ihlali, operasyonel duruş ve itibar kaybı dahil
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KVKK ceza riski */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">KVKK Ceza Riski</p>
                        <Badge variant="outline" className={`text-xs ${riskRenk(sektorData!.kvkkRisk)}`}>
                          {sektorData!.kvkkRisk}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-amber-600 mb-1">
                        {fmtTL(sektorData!.kvkkMin)} – {fmtTL(sektorData!.kvkkMax)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        KVK Kurulu 2025 kararları esas alınmıştır. {sektorData!.label} sektörü{" "}
                        {sektorData!.kvkkRisk === "Çok Yüksek" || sektorData!.kvkkRisk === "Yüksek"
                          ? "yoğun kişisel veri işlediğinden yüksek ceza riski taşımaktadır."
                          : "ortalama sektör ceza riskindedir."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CyberStep maliyeti + ROI */}
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-700 mb-3">CyberStep ile Korunma Maliyeti</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-white rounded-lg p-3 border border-emerald-100">
                          <p className="text-xs text-muted-foreground mb-0.5">Önerilen Plan</p>
                          <p className="font-bold text-emerald-700">{calisanData!.plan}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-emerald-100">
                          <p className="text-xs text-muted-foreground mb-0.5">Yıllık Abonelik</p>
                          <p className="font-bold text-emerald-700">{fmtTL(yillikAbone)}</p>
                          <p className="text-xs text-muted-foreground">{calisanData!.planPrice.toLocaleString("tr-TR")} TL/ay</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tasarruf özeti */}
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingDown className="h-5 w-5 shrink-0" />
                    <p className="font-semibold">Risk / Maliyet Karşılaştırması</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-2xl font-black">{fmtTL(riskOrta)}</div>
                      <div className="text-xs opacity-70">Olası Risk</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black">{fmtTL(yillikAbone)}</div>
                      <div className="text-xs opacity-70">CyberStep / Yıl</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-emerald-300">%{roi}</div>
                      <div className="text-xs opacity-70">Tahmini ROI</div>
                    </div>
                  </div>
                  <p className="text-xs opacity-70 mt-3 text-center">
                    {fmtTL(riskOrta)} olası kayba karşı yıllık yalnızca {fmtTL(yillikAbone)} yatırım
                  </p>
                </CardContent>
              </Card>

              {/* Kıyaslama notu */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Kıyaslama: </span>
                    {fmtTL(calisanData!.planPrice * 12)} yıllık CyberStep aboneliği =
                    bir güvenlik danışmanının <strong>tek günlük</strong> ücreti.
                    Tek bir siber saldırı veya KVKK cezası, yıllarca abonelik ücreti demektir.
                  </p>
                </CardContent>
              </Card>

              {/* CTA — hesaplanan riske bağlı */}
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Bu riski azaltmak için ilk adım ücretsiz.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Hesapladığınız <span className="font-semibold text-foreground">{fmtTL(riskOrta)}</span> riski gerçekte nerede taşıdığınızı görün.
                    </p>
                  </div>
                  <Link href="/assessment/start" className="shrink-0">
                    <Button size="lg">
                      Ücretsiz Değerlendirme
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-primary/10">
                  <span>Derin analiz istiyorsanız:</span>
                  <Link href="/assessment/full/start">
                    <span className="font-medium text-primary hover:underline cursor-pointer">
                      Tam Değerlendirme — 5.990 TL →
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alt bilgi kutuları */}
        <div className="grid md:grid-cols-3 gap-4 mt-12">
          {[
            {
              title: "Neden Bu Rakamlar?",
              desc: "IBM Cost of a Data Breach 2024 raporuna göre küçük şirketlerde ortalama ihlal maliyeti 2,35 milyon dolar. Türkiye'de TL bazında düzeltilmiş ve KOBİ ölçeğine indirgenmiş tahminler kullanılmıştır.",
            },
            {
              title: "KVKK Cezaları Gerçek mi?",
              desc: "2023-2025 yılları arasında KVK Kurulu 200'den fazla firmaya toplam 85 milyon TL'yi aşan idari para cezası uyguladı. En yüksek tek ceza 5 milyon TL'dir.",
            },
            {
              title: "Hesaplama Sınırlılıkları",
              desc: "Bu araç istatistiksel ortalama tahminler üretir. Gerçek maliyet şirketin güvenlik olgunluğuna, saldırı türüne ve müdahale süresine göre önemli ölçüde farklılaşabilir.",
            },
          ].map(({ title, desc }) => (
            <Card key={title}>
              <CardContent className="p-4">
                <Users className="h-4 w-4 text-primary mb-2" />
                <p className="font-semibold text-sm mb-1">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
