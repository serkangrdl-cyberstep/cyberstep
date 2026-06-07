import { useState } from "react";
import { BarChart2, ArrowRight, Download, CheckCircle, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

const SECTORS = [
  { value: "finans", label: "Finans & Bankacılık" },
  { value: "saglik", label: "Sağlık & Eczane" },
  { value: "perakende", label: "Perakende & E-Ticaret" },
  { value: "bilisim", label: "Bilişim & Yazılım" },
  { value: "imalat", label: "İmalat & Sanayi" },
  { value: "lojistik", label: "Lojistik & Taşımacılık" },
  { value: "insaat", label: "İnşaat & Gayrimenkul" },
  { value: "hukuk", label: "Hukuk & Danışmanlık" },
  { value: "egitim", label: "Eğitim & Akademi" },
  { value: "diger", label: "Diğer" },
];

const SECTOR_STATS: Record<string, { avgScore: number; topFindings: string[]; kvkkRate: number; breachRate: number }> = {
  finans:    { avgScore: 58, kvkkRate: 62, breachRate: 34, topFindings: ["Zayıf MFA uygulaması", "API güvenlik açıkları", "Şifreli olmayan yedekler"] },
  saglik:    { avgScore: 41, kvkkRate: 38, breachRate: 52, topFindings: ["Eski yazılım sürümleri", "Açık RDP portları", "KVKK uyumsuz veri saklama"] },
  perakende: { avgScore: 49, kvkkRate: 45, breachRate: 47, topFindings: ["Ödeme sayfası güvenlik açıkları", "Zayıf SSL konfigürasyonu", "Müşteri veri sızıntısı riski"] },
  bilisim:   { avgScore: 63, kvkkRate: 71, breachRate: 28, topFindings: ["Tedarikçi erişim yönetimi", "CI/CD pipeline güvenliği", "Açık kaynak bileşen riskleri"] },
  imalat:    { avgScore: 35, kvkkRate: 29, breachRate: 41, topFindings: ["OT/IT ayrımı eksikliği", "Eski SCADA sistemleri", "Tedarikçi zincirine açık portlar"] },
  lojistik:  { avgScore: 44, kvkkRate: 36, breachRate: 39, topFindings: ["Şifreli olmayan araç takip verileri", "Partner entegrasyon güvenliği", "DNS güvenlik eksiklikleri"] },
  insaat:    { avgScore: 38, kvkkRate: 31, breachRate: 36, topFindings: ["Proje veri koruma eksikliği", "BIM platformu güvenlik açıkları", "İhale süreçlerinde veri maruziyeti"] },
  hukuk:     { avgScore: 52, kvkkRate: 58, breachRate: 31, topFindings: ["Müvekkil belgelerinin şifreleme eksikliği", "E-posta güvenlik açıkları", "Uzaktan erişim riskleri"] },
  egitim:    { avgScore: 37, kvkkRate: 33, breachRate: 44, topFindings: ["Öğrenci verisi KVKK uyumu", "Açık öğrenci portalları", "Eski LMS platformları"] },
  diger:     { avgScore: 45, kvkkRate: 42, breachRate: 38, topFindings: ["Genel web uygulama güvenlik açıkları", "Zayıf şifre politikası", "Yama yönetimi eksikliği"] },
};

export default function SektorRaporu() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Sektörel Güvenlik Benchmark Raporu 2026 | CyberStep.io",
    description: "Türkiye'de sektörünüzün siber güvenlik ortalaması nerede? Ücretsiz sektörel benchmark raporu indirin.",
    canonicalPath: "/sektor-raporu",
    lang: "tr",
  });

  const { toast } = useToast();
  const [sector, setSector] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sectorPreview, setSectorPreview] = useState<typeof SECTOR_STATS["finans"] | null>(null);

  function handleSectorChange(val: string) {
    setSector(val);
    setSectorPreview(SECTOR_STATS[val] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sector || !email.trim()) return;
    setLoading(true);
    try {
      const domain = email.includes("@") ? email.split("@")[1] : "";
      await fetch("/api/public/benchmark-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector,
          visitorName: name.trim(),
          visitorEmail: email.trim(),
          visitorCompany: company.trim(),
          visitorDomain: domain,
          reportPeriod: "Q2-2026",
        }),
      });
      setDone(true);
    } catch {
      toast({ title: "Hata", description: "Bir sorun oluştu. Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <BarChart2 className="h-4 w-4" />
            Ücretsiz Benchmark Raporu — Q2 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {lang === "en" ? <>Where Does Your Sector <span className="text-emerald-400">Stand?</span></> : <>Sektörünüz <span className="text-emerald-400">Nerede Duruyor?</span></>}
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Türkiye'deki sektörünüzün siber güvenlik ortalaması, en yaygın açıklar ve KVKK uyum oranı — tek raporda.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Form */}
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              {!done ? (
                <>
                  <h2 className="text-xl font-bold mb-6">Raporu İndir</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Sektörünüz *</Label>
                      <Select value={sector} onValueChange={handleSectorChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sektör seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTORS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="name">Adınız</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Adı Soyadı" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Şirket</Label>
                        <Input id="company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Şirket A.Ş." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-posta *</Label>
                      <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="siz@sirket.com" required />
                    </div>
                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500" disabled={loading || !sector || !email}>
                      {loading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Hazırlanıyor...</>
                      ) : (
                        <><Download className="h-4 w-4 mr-2" /> Raporu İndir (Ücretsiz)</>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Spam göndermiyoruz. İstediğinizde aboneliği iptal edebilirsiniz.
                    </p>
                  </form>
                </>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <CheckCircle className="h-14 w-14 text-emerald-600 mx-auto" />
                  <h3 className="text-xl font-bold">Raporunuz yolda!</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Sektör benchmark raporu e-posta adresinize gönderildi. Ayrıca uzman ekibimiz sektörünüz için kişiselleştirilmiş analiz sunmak üzere 24 saat içinde sizinle iletişime geçecek.
                  </p>
                  <a
                    href="/assessment/start"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
                  >
                    Şirketinizi Değerlendirin <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>

            {/* Sector Preview */}
            <div className="space-y-4">
              {sectorPreview ? (
                <>
                  <div className="bg-card border rounded-2xl p-6 space-y-4">
                    <h3 className="font-semibold text-lg">Sektör Önizlemesi</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-muted/30 rounded-xl p-4">
                        <div className="text-2xl font-black text-amber-600">{sectorPreview.avgScore}</div>
                        <div className="text-xs text-muted-foreground mt-1">Ortalama Skor</div>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-4">
                        <div className="text-2xl font-black text-emerald-600">%{sectorPreview.kvkkRate}</div>
                        <div className="text-xs text-muted-foreground mt-1">KVKK Uyum</div>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-4">
                        <div className="text-2xl font-black text-red-600">%{sectorPreview.breachRate}</div>
                        <div className="text-xs text-muted-foreground mt-1">Sızıntı Riski</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-2">Sektörde En Yaygın 3 Açık:</div>
                      <ul className="space-y-2">
                        {sectorPreview.topFindings.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
                      Tam raporda: Şehir bazlı karşılaştırma, KVKK ceza geçmişi, sektöre özel aksiyon planı ve daha fazlası.
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-card border rounded-2xl p-8 text-center space-y-4 text-muted-foreground">
                  <BarChart2 className="h-12 w-12 mx-auto opacity-30" />
                  <p className="text-sm">Sektörünüzü seçin — önizleme verisi burada görünecek.</p>
                </div>
              )}

              {/* Report Contents */}
              <div className="bg-card border rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold">Raporda Ne Var?</h3>
                <ul className="space-y-2">
                  {[
                    "Sektör ortalama güvenlik skoru (100+ şirket analizi)",
                    "En yaygın 10 güvenlik açığı ve kapatma öncelikleri",
                    "KVKK uyum oranı ve sektörel ceza geçmişi",
                    "Sektörünüzün sektörler arası karşılaştırması",
                    "\"Şirketiniz ortalamanın neresinde?\" ücretsiz analiz",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-4">
          <Shield className="h-8 w-8 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold">Sektör ortalamasının neresinde olduğunuzu öğrenin</h2>
          <p className="text-slate-400">20 soruluk ücretsiz risk değerlendirmesi ile kişisel skor alın.</p>
          <a
            href="/assessment/start"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors"
          >
            Ücretsiz Değerlendirme <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
