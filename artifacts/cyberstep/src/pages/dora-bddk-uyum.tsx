import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  Scale, AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronRight, RotateCcw, FileCheck, Shield, Building2, Zap, ExternalLink,
} from "lucide-react";

// ── Düzenleyici Kurumlar ─────────────────────────────────────────────────────

const REGULATORS = [
  {
    id: "BDDK",
    name: "BDDK",
    fullName: "Bankacılık Düzenleme ve Denetleme Kurumu",
    desc: "Bankalar, katılım bankaları, finansal kiralama ve faktoring şirketleri",
    law: "Bilgi Sistemleri Yönetmeliği (BSY) 2021 + 2023 Bilgi Güvenliği Tebliği",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    url: "https://www.bddk.org.tr/Mevzuat/Liste/1",
  },
  {
    id: "SPK",
    name: "SPK",
    fullName: "Sermaye Piyasası Kurulu",
    desc: "Aracı kurumlar, portföy yönetim şirketleri, yatırım fonları",
    law: "Seri VIII No:54 — Bilgi İşlem ve Teknoloji Güvenliği Tebliği",
    color: "text-violet-400 border-violet-500/30 bg-violet-500/5",
    url: "https://www.spk.gov.tr/Sayfa/AltSayfa/819",
  },
  {
    id: "EPDK",
    name: "EPDK",
    fullName: "Enerji Piyasası Düzenleme Kurumu",
    desc: "Elektrik, doğalgaz, petrol dağıtım ve depolama şirketleri",
    law: "Enerji Sektörü Siber Güvenlik Yönetmeliği 2023",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/5",
    url: "https://www.epdk.gov.tr/Detay/Icerik/3-0-99-6/siber-guvenlik",
  },
  {
    id: "DORA",
    name: "DORA",
    fullName: "AB Dijital Operasyonel Dayanıklılık Yasası",
    desc: "AB piyasalarında faaliyet gösteren veya AB kurumlarıyla iş yapan finans kuruluşları",
    law: "EU 2022/2554 — Yürürlük: Ocak 2025",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    url: "https://eur-lex.europa.eu/legal-content/TR/TXT/?uri=CELEX%3A32022R2554",
  },
];

// ── Assessment sektörü → Uyum sayfası sektörü eşlemesi ───────────────────────

function mapAssessmentSector(s: string): string {
  if (/finans|sigorta|banka/i.test(s)) return "Bankacılık / Finansal Hizmetler";
  if (/sağlık/i.test(s)) return "Sağlık";
  if (/teknoloji|yazılım/i.test(s)) return "Teknoloji / Yazılım";
  if (/üretim|sanayi/i.test(s)) return "Üretim / Sanayi";
  if (/elektrik|enerji/i.test(s)) return "Elektrik / Enerji";
  if (/gaz|petrol/i.test(s)) return "Doğalgaz / Petrol";
  if (/sermaye|yatırım/i.test(s)) return "Sermaye Piyasaları / Yatırım";
  return "Diğer";
}

// ── Domain → Regülasyon Eşlemesi ─────────────────────────────────────────────

interface DomainMap {
  domain: string;
  title: string;
  BDDK: { articles: string[]; requirement: string };
  SPK: { articles: string[]; requirement: string };
  EPDK: { articles: string[]; requirement: string };
  DORA: { articles: string[]; requirement: string };
}

const DOMAIN_REGULATION_MAP: DomainMap[] = [
  {
    domain: "A",
    title: "Yönetişim ve Envanter",
    BDDK: { articles: ["BSY Md.5", "BSY Md.6", "BSY Md.8"], requirement: "Yönetim Kurulu düzeyinde BT risk sorumluluğu ve Bilgi Güvenliği Politikası zorunluluğu" },
    SPK: { articles: ["Seri VIII/54 Md.4", "Md.5"], requirement: "Yönetim kurulunun teknoloji risk gözetimi ve iç denetim kapsamı" },
    EPDK: { articles: ["Md.6", "Md.8"], requirement: "Siber güvenlik yönetim yapısı ve kritik enerji varlık envanteri" },
    DORA: { articles: ["Art.5", "Art.6", "Art.7"], requirement: "ICT Risk Management Framework — üst yönetim sorumluluğu ve sürekli risk değerlendirme" },
  },
  {
    domain: "B",
    title: "Kimlik, Erişim ve Uzak Erişim",
    BDDK: { articles: ["BSY Md.12", "BSY Md.13"], requirement: "Kimlik ve erişim yönetimi politikası; ayrıcalıklı kullanıcı kontrolü; VPN ve uzak erişim güvenliği" },
    SPK: { articles: ["Seri VIII/54 Md.9", "Md.10"], requirement: "Erişim kontrolü ve kimlik doğrulama standartları" },
    EPDK: { articles: ["Md.12", "Md.13"], requirement: "OT/IT erişim ayrımı ve uzak erişim denetimi" },
    DORA: { articles: ["Art.9.2", "Art.9.3"], requirement: "Kimlik doğrulama, ayrıcalıklı erişim yönetimi ve çok faktörlü doğrulama zorunluluğu" },
  },
  {
    domain: "C",
    title: "E-posta Güvenliği ve Farkındalık",
    BDDK: { articles: ["BSY Md.20", "BSY Md.21"], requirement: "Çalışan bilgi güvenliği farkındalık eğitimi; e-posta güvenliği politikası" },
    SPK: { articles: ["Seri VIII/54 Md.15"], requirement: "Personel eğitimi ve sosyal mühendislik farkındalığı" },
    EPDK: { articles: ["Md.18"], requirement: "OT personeli dahil yıllık siber güvenlik eğitimi" },
    DORA: { articles: ["Art.13"], requirement: "ICT risk farkındalık programı ve kimlik avı direnci testleri" },
  },
  {
    domain: "D",
    title: "Cihaz ve Uç Nokta Güvenliği",
    BDDK: { articles: ["BSY Md.14", "BSY Md.15", "BSY Md.16"], requirement: "Varlık yönetimi, güvenlik açığı taraması ve yama yönetimi zorunluluğu" },
    SPK: { articles: ["Seri VIII/54 Md.11", "Md.12"], requirement: "Uç nokta koruması ve yazılım güncelleme politikası" },
    EPDK: { articles: ["Md.14", "Md.15"], requirement: "SCADA/OT cihaz yönetimi ve ağ segmentasyonu" },
    DORA: { articles: ["Art.9.4", "Art.10"], requirement: "ICT güvenlik politikaları; tehdit tespiti ve anomali izleme" },
  },
  {
    domain: "E",
    title: "Veri Koruma, Yedekleme ve Olay Hazırlığı",
    BDDK: { articles: ["BSY Md.18", "BSY Md.19", "BSY Md.22"], requirement: "İş sürekliliği planı, yedekleme testleri ve olay bildirim yükümlülüğü (4 saat)" },
    SPK: { articles: ["Seri VIII/54 Md.17", "Md.18"], requirement: "Felaket kurtarma planı ve düzenleyiciye olay bildirimi" },
    EPDK: { articles: ["Md.19", "Md.20", "Md.21"], requirement: "Kritik enerji altyapısı için kesinti planı ve olay müdahale ekibi" },
    DORA: { articles: ["Art.11", "Art.12", "Art.19"], requirement: "ICT iş sürekliliği, felaket kurtarma ve olay raporlama zaman çerçeveleri" },
  },
];

// ── Sektörler ─────────────────────────────────────────────────────────────────

const SECTORS = [
  "Bankacılık / Finansal Hizmetler",
  "Sigorta",
  "Sermaye Piyasaları / Yatırım",
  "Elektrik / Enerji",
  "Doğalgaz / Petrol",
  "Üretim / Sanayi",
  "Teknoloji / Yazılım",
  "Sağlık",
  "Diğer",
];

// ── Domain skor bantları ──────────────────────────────────────────────────────

const BANDS = [
  { label: "Temel", range: [0, 39], color: "bg-red-500" },
  { label: "Gelişmekte", range: [40, 69], color: "bg-amber-400" },
  { label: "İleri", range: [70, 100], color: "bg-emerald-500" },
];

function getBand(score: number) {
  return BANDS.find(b => score >= b.range[0] && score <= b.range[1]) ?? BANDS[0];
}

interface ComplianceResult {
  genel: { uyumSkoru: number; oncelikliRegulasyon: string; ozet: string };
  domainAnalizleri: Array<{
    domain: string; baslik: string; uyumDurumu: string;
    kritikEksikler: string[]; acilAksiyon: string;
  }>;
  duzenleyiciUyari: string;
  yolHaritasi: string[];
}

export default function DoraBddkUyum() {
  usePageMeta({
    title: "BDDK / SPK / EPDK / DORA Uyum Analizi | CyberStep.io",
    description: "Türkiye ve AB siber güvenlik regülasyonlarına uyum durumunuzu analiz edin. BDDK BSY, SPK, EPDK ve DORA makalelerine eşleme.",
    noIndex: false,
  });

  const [selectedRegulators, setSelectedRegulators] = useState<string[]>([]);
  const [sector, setSector] = useState("");
  const [score, setScore] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawSector = params.get("sector");
    const rawScore = params.get("score");
    if (rawSector) {
      const mapped = mapAssessmentSector(rawSector);
      setSector(mapped);
    }
    if (rawScore) {
      const n = parseInt(rawScore, 10);
      if (!isNaN(n) && n >= 0 && n <= 100) setScore(String(n));
    }
  }, []);

  function toggleRegulator(id: string) {
    setSelectedRegulators(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  }

  const numScore = parseInt(score, 10);
  const validScore = !isNaN(numScore) && numScore >= 0 && numScore <= 100;
  const band = validScore ? getBand(numScore) : null;

  async function analyze() {
    if (!sector || selectedRegulators.length === 0 || !validScore) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/dora-bddk-uyum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regulators: selectedRegulators, sector, score: numScore }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Analiz yapılamadı");
      setResult(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = (s: string) =>
    s === "Uyumlu" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
    : s === "Kısmen" ? <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
    : <XCircle className="h-4 w-4 text-red-400 shrink-0" />;

  const statusCls = (s: string) =>
    s === "Uyumlu" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    : s === "Kısmen" ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
    : "bg-red-500/10 border-red-500/20 text-red-400";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-blue-950/20 to-background">
        <div className="container mx-auto px-4 py-14 max-w-5xl">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 border-blue-500/40 text-blue-400 bg-blue-500/5">
              <Scale className="h-3 w-3 mr-1" />
              Regülasyon Uyum Analizi
            </Badge>
            <h1 className="text-4xl font-bold mb-4">
              BDDK · SPK · EPDK · DORA
            </h1>
            <p className="text-white/80 text-lg">
              AB'de DORA Ocak 2025'te yürürlüğe girdi. BDDK ve SPK benzer niceliksel ICT risk metriklerini
              zorunlu kılmaya hazırlanıyor. Şimdi bu dili konuşun — regülasyon geldiğinde hazır oyuncu olun.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-5xl">

        {/* Açıklama kartları */}
        {!result && !loading && (
          <div className="grid md:grid-cols-4 gap-3 mb-8">
            {REGULATORS.map(r => (
              <div key={r.id} className={`rounded-xl border p-4 ${r.color} flex flex-col justify-between`}>
                <div>
                  <p className="font-bold text-sm mb-0.5">{r.id}</p>
                  <p className="text-xs text-muted-foreground leading-snug mb-2">{r.fullName}</p>
                  <p className="text-xs opacity-70 leading-tight">{r.law}</p>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                >
                  Resmi Metin <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        )}

        {!result ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-blue-400" />
                Uyum Analizi Başlat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-7">
              {/* Regülasyon seçimi */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">
                  Hangi regülasyonlar sizin için geçerli? *
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {REGULATORS.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRegulator(r.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedRegulators.includes(r.id)
                          ? `${r.color} ring-1 ring-current`
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="font-bold text-sm">{r.id}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sektör */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Sektörünüz *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SECTORS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSector(s)}
                      className={`px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                        sector === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skor */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Siber Güvenlik Puanınız (0–100) *
                </Label>
                <div className="flex items-center gap-4">
                  <input
                    type="number" min={0} max={100}
                    value={score}
                    onChange={e => setScore(e.target.value)}
                    placeholder="Örn: 62"
                    className="w-28 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  />
                  {band && (
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-12 rounded-full ${band.color}`} />
                      <span className="text-sm font-medium">{band.label} Segment</span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    CyberStep değerlendirmenizden alabilirsiniz
                  </span>
                </div>
              </div>

              {/* Domain-regülasyon önizlemesi */}
              {selectedRegulators.length > 0 && (
                <div className="rounded-xl bg-muted/30 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                    Analiz Kapsamı — {selectedRegulators.join(" + ")}
                  </p>
                  <div className="space-y-2">
                    {DOMAIN_REGULATION_MAP.map(d => (
                      <div key={d.domain} className="flex items-start gap-3 text-xs">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                          {d.domain}
                        </span>
                        <div>
                          <span className="font-medium">{d.title}</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {selectedRegulators.map(reg => {
                              const arts = d[reg as keyof DomainMap] as { articles: string[] };
                              return arts.articles.map(a => (
                                <span key={a} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">
                                  {a}
                                </span>
                              ));
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!sector || selectedRegulators.length === 0 || !validScore || loading}
                onClick={analyze}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gemini analiz ediyor...</>
                  : <><Scale className="h-4 w-4 mr-2" /> Uyum Raporu Oluştur</>}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Regülasyon Uyum Raporu</h2>
                <p className="text-muted-foreground text-sm">
                  {sector} · {selectedRegulators.join(", ")} · Skor: {numScore}/100
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setResult(null); }}>
                <RotateCcw className="h-4 w-4 mr-1" /> Yeni Analiz
              </Button>
            </div>

            {/* Genel uyum skoru */}
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-bold text-2xl">{result.genel.uyumSkoru}/100</p>
                      <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10">
                        Regülasyon Uyum Skoru
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.genel.ozet}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Öncelikli Regülasyon</p>
                    <p className="font-bold text-sm text-blue-400">{result.genel.oncelikliRegulasyon}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rating band visualization */}
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Siber Güvenlik Segment Konumunuz</p>
                <div className="relative mb-4">
                  <div className="flex h-8 rounded-full overflow-hidden">
                    <div className="flex-none bg-red-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: "40%" }}>
                      Temel
                    </div>
                    <div className="flex-none bg-amber-400 flex items-center justify-center text-white text-xs font-medium" style={{ width: "30%" }}>
                      Gelişmekte
                    </div>
                    <div className="flex-1 bg-emerald-500 flex items-center justify-center text-white text-xs font-medium">
                      İleri
                    </div>
                  </div>
                  {/* Position marker */}
                  <div
                    className="absolute top-0 h-8 w-0.5 bg-white"
                    style={{ left: `${Math.min(98, Math.max(2, numScore))}%` }}
                  >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap">
                      {numScore}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 — Temel</span>
                  <span>40 — Gelişmekte</span>
                  <span>70 — İleri — 100</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  DORA ve BDDK BSY kapsamındaki kuruluşlar en az <strong>İleri</strong> segmentinde yer almalıdır
                </p>
              </CardContent>
            </Card>

            {/* Domain analizleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Alan Bazlı Uyum Durumu</h3>
              {result.domainAnalizleri.map((d, i) => {
                const mapRow = DOMAIN_REGULATION_MAP.find(r => r.domain === d.domain);
                return (
                  <Card key={i} className={`border ${statusCls(d.uyumDurumu)}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {statusIcon(d.uyumDurumu)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{d.domain} — {d.baslik}</p>
                            <Badge variant="outline" className={`text-xs ${statusCls(d.uyumDurumu)}`}>
                              {d.uyumDurumu}
                            </Badge>
                          </div>

                          {/* İlgili maddeler */}
                          {mapRow && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {selectedRegulators.flatMap(reg => {
                                const entry = mapRow[reg as keyof DomainMap] as { articles: string[] };
                                return entry.articles.map(a => (
                                  <span key={a} className="text-xs bg-background/60 border rounded px-1.5 py-0.5">
                                    {a}
                                  </span>
                                ));
                              })}
                            </div>
                          )}

                          {d.kritikEksikler.length > 0 && (
                            <ul className="space-y-0.5 mb-2">
                              {d.kritikEksikler.map((e, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs">
                                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                                  {e}
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="flex items-start gap-1.5 text-xs text-emerald-400">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{d.acilAksiyon}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Düzenleyici uyarı */}
            {result.duzenleyiciUyari && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-amber-400 mb-1">Düzenleyici Risk Uyarısı</p>
                      <p className="text-sm text-muted-foreground">{result.duzenleyiciUyari}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Yol haritası */}
            {result.yolHaritasi.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">Uyum Yol Haritası</h3>
                <div className="space-y-2">
                  {result.yolHaritasi.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="shrink-0 h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center">
                        {i + 1}
                      </div>
                      <p className="text-sm">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <Zap className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="font-semibold mb-1">Tüm alanlar için detaylı değerlendirme alın</p>
                <p className="text-muted-foreground text-sm mb-4">
                  20 soruluk Mini Değerlendirme ile domain bazlı skor alın, bu regülasyon haritasını
                  gerçek verilerinizle doldurun.
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

        {/* Neden bu önemli */}
        {!result && !loading && (
          <div className="mt-10 rounded-xl border bg-muted/30 p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-400" />
              Türkiye Regülasyon Yol Haritası
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              {[
                { year: "Ocak 2025", event: "DORA yürürlüğe girdi", desc: "AB finansal sektöründe ICT risk yönetimi, olay raporlama ve üçüncü taraf risk yönetimi zorunlu oldu." },
                { year: "2025–2026", event: "BDDK ICT Tebliği hazırlığı", desc: "BDDK'nın DORA'ya paralel niceliksel ICT risk metrikleri tebliğinin çıkması bekleniyor." },
                { year: "2026+", event: "SPK ve EPDK uyum zorunluluğu", desc: "Sermaye piyasaları ve enerji sektöründe benzer çerçeveler için düzenleyici baskı artıyor." },
              ].map(({ year, event, desc }) => (
                <div key={year} className="rounded-lg border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{year}</Badge>
                  </div>
                  <p className="font-medium mb-1">{event}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">DORA/BDDK uyumu teknik güvenlikle başlar.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ICT risk yönetimi çerçevenizi oluşturmadan önce mevcut güvenlik durumunuzu 20 soruluk ücretsiz değerlendirmeyle belgeleyin.
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
