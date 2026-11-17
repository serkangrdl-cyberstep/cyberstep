import { Shield, CheckCircle2, ArrowRight, BarChart3, Zap, AlertTriangle, ExternalLink, Info, ChevronRight, Target, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

// ─── Scoring methodology ──────────────────────────────────────────────────────

// Skor v2 — kaynak: artifacts/api-server/src/lib/scoring/scoreV2.ts ve docs/skor-v2-metodoloji.md
const DOMAIN_CHECKS = [
  { id: "Zafiyetler",  max: 30, desc: "Tespit edilen yazılım sürümlerine ait CVE'ler. CISA KEV −20, CVSS ≥9 −10, CVSS 7–8.9 −4, CVSS 4–6.9 −1. WAF ile hafifletilenlerde düzeltilmiş CVSS." },
  { id: "Ağ",          max: 20, desc: "İnternete açık portlar ve sahipsiz (dangling) CNAME alt alan adları (−5). Kritik servis (RDP, SMB, veritabanı, Docker…) −10, yüksek riskli −5, orta −1. CDN arkasında beklenen portlar ceza almaz." },
  { id: "İtibar",      max: 15, desc: "Spam kara listeleri −8; USOM, URLhaus, Google Safe Browsing, Feodo botnet C2 −15; ThreatFox IOC, VirusTotal −10; AbuseIPDB ≥50 −8 (≥25 −4)." },
  { id: "E-posta",     max: 15, desc: "SPF (−all 5, ~all 3.5, ?all 2), DMARC (reject 6, quarantine 5, none 2), DKIM 3, MX 1." },
  { id: "Veri ihlali geçmişi", max: 10, desc: "Alan adına ait hizmetin yer aldığı bilinen veri ihlalleri (HIBP; çalışan e-postalarının sızıntısı değildir): 0 → 10, 1 → 6, 2–3 → 3, 4+ → 0." },
  { id: "TLS ve web",  max: 10, desc: "SSL geçerliliği (≥30 gün 7, 14–29 gün 5, ≤13 gün 3, geçersiz 0) ve HTTP güvenlik başlıkları (3)." },
];

const SCORE_CAPS = [
  { cond: "CISA KEV listesindeki (aktif sömürülen) zafiyet", max: 49 },
  { cond: "Fidye yazılımında kullanılan KEV zafiyeti", max: 39 },
  { cond: "USOM / URLhaus / Google Safe Browsing / Feodo botnet C2 kaydı", max: 39 },
  { cond: "ThreatFox zararlı IOC kaydı", max: 49 },
  { cond: "İnternete açık kritik servis (RDP, SMB vb.)", max: 59 },
];

const RISK_SIGNALS = [
  { signal: "Kara liste tespiti", impact: "Kritik", src: "Spamhaus, Barracuda, URIBL, SORBS vb." },
  { signal: "HIBP veri ihlali geçmişi (alan adı hizmeti)", impact: "Yüksek", src: "Have I Been Pwned API" },
  { signal: "VirusTotal kötücül", impact: "Kritik", src: "70+ AV motoru konsensüsü" },
  { signal: "AbuseIPDB skoru", impact: "Yüksek", src: "IP kötüye kullanım veritabanı" },
  { signal: "USOM kara liste", impact: "Kritik", src: "BTK / USOM Türkiye ulusal listesi" },
  { signal: "URLhaus tespiti", impact: "Yüksek", src: "Abuse.ch tehdit istihbaratı" },
  { signal: "Safe Browsing uyarısı", impact: "Yüksek", src: "Google Safe Browsing API" },
  { signal: "CVE eşleşmesi", impact: "Değişken", src: "NVD + CISA KEV listesi" },
  { signal: "Açık port / servis", impact: "Orta", src: "Shodan Internet Intelligence" },
  { signal: "Botnet C2 / zararlı IOC", impact: "Kritik", src: "Feodo Tracker, ThreatFox (abuse.ch)" },
  { signal: "Sahipsiz alt alan adı", impact: "Yüksek", src: "Certificate Transparency + DNS CNAME doğrulaması" },
  { signal: "Shadow IT tespiti", impact: "Orta", src: "DNS + HTTP başlık analizi" },
  { signal: "HTTP başlık skoru", impact: "Orta", src: "Mozilla Observatory metodolojisi" },
];

const GRADES = [
  { grade: "A", range: "85–100", risk: "Düşük Risk",  color: "text-green-500",  bg: "bg-green-500/10 border-green-200",   desc: "Dış saldırı yüzeyi iyi yönetiliyor; ağır bulgu yok." },
  { grade: "B", range: "70–84",  risk: "Düşük Risk",  color: "text-lime-600",   bg: "bg-lime-500/10 border-lime-200",     desc: "Temel kontroller yerinde; giderilmesi gereken sınırlı eksikler var." },
  { grade: "C", range: "55–69",  risk: "Orta Risk",   color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-200", desc: "Önemli eksiklikler mevcut. İyileştirme planı oluşturulmalı." },
  { grade: "D", range: "40–54",  risk: "Yüksek Risk", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-200", desc: "Ciddi açıklar var; tedarikçiden düzeltme talep edilmeli." },
  { grade: "F", range: "0–39",   risk: "Kritik Risk", color: "text-red-600",    bg: "bg-red-600/10 border-red-300",       desc: "Aktif sömürülen zafiyet, zararlı listesi kaydı veya çok sayıda ağır bulgu." },
];

const CVSS_LEVELS = [
  { range: "9.0–10.0", label: "Kritik",  color: "bg-red-600", action: "Acil yama — 24–72 saat" },
  { range: "7.0–8.9",  label: "Yüksek",  color: "bg-orange-500", action: "Öncelikli yama — 1 hafta" },
  { range: "4.0–6.9",  label: "Orta",    color: "bg-yellow-500", action: "Planlı yama — 30 gün" },
  { range: "0.1–3.9",  label: "Düşük",   color: "bg-blue-400", action: "Risk kabul veya yama — 90 gün" },
];

const EPSS_EXPLAIN = [
  { range: "EPSS > %50", label: "Aktif istismar riski yüksek", note: "CVSS skoru ne olursa olsun önceliklendir" },
  { range: "EPSS %10–50", label: "İzlemede tut, yama planla", note: "Trend analizi ile takip et" },
  { range: "EPSS < %10", label: "Standart yama döngüsüne dahil et", note: "CVSS puanına göre sıralama yeterli" },
];

const MITRE_PHASES = [
  { id: "TA0043", name: "Keşif", icon: "🔍", examples: ["DNS sorguları", "Alt domain sayımı", "Port tarama"] },
  { id: "TA0001", name: "Başlangıç Erişimi", icon: "🚪", examples: ["Kimlik avı (Phishing)", "Exploit ile erişim", "Valid hesap kullanımı"] },
  { id: "TA0002", name: "Yürütme", icon: "⚙️", examples: ["Komut satırı arayüzü", "Betik çalıştırma", "Servis manipülasyonu"] },
  { id: "TA0003", name: "Kalıcılık", icon: "🔗", examples: ["Zamanlanmış görev", "Arka kapı", "Hesap oluşturma"] },
  { id: "TA0010", name: "Sızdırma", icon: "📤", examples: ["C2 üzerinden veri çıkarma", "Şifreleme + fidye", "Veri satışı"] },
];

const ASSESSMENT_DOMAINS = [
  { id: "A", name: "Kimlik ve Erişim Yönetimi", weight: "Normal", questions: 4, examples: ["MFA kullanımı", "Parola politikası", "Ayrıcalıklı erişim yönetimi"] },
  { id: "B", name: "Ağ ve Sistem Güvenliği", weight: "Normal", questions: 4, examples: ["Güvenlik duvarı", "Güncelleme döngüsü", "Endpoint koruması"] },
  { id: "C", name: "Veri Güvenliği", weight: "Kritik (2x)", questions: 4, examples: ["Yedekleme", "Şifreleme", "KVKK farkındalığı"] },
  { id: "D", name: "Olay Yönetimi", weight: "Kritik (2x)", questions: 4, examples: ["Olay müdahale planı", "Sigorta", "RTO/RPO hedefleri"] },
  { id: "E", name: "Tedarikçi ve Süreç", weight: "Normal", questions: 4, examples: ["Tedarikçi güvenlik gereksinimleri", "Çalışan eğitimi", "Politika belgesi"] },
];

const ANSWER_WEIGHTS = [
  { answer: "Evet", score: 5, color: "text-green-500", note: "Kontrol tam ve aktif olarak uygulanıyor" },
  { answer: "Kısmen", score: 3, color: "text-yellow-500", note: "Kontrol var ama eksik veya tutarsız uygulanıyor" },
  { answer: "Bilmiyorum", score: 1, color: "text-orange-400", note: "Belirsizlik kendi başına risk — bilinçlenme gerekli" },
  { answer: "Hayır", score: 0, color: "text-red-500", note: "Kontrol mevcut değil — öncelikli iyileştirme hedefi" },
];

export default function Metodoloji() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Değerlendirme Metodolojisi | CyberStep.io",
    description: "CyberStep Risk Skoru v2 metodolojisi: zafiyet (CVE/KEV), ağ maruziyeti, itibar, e-posta güvenliği, veri sızıntısı ve TLS kategorileri, ağır bulgu tavanları, kapsama ve sektör kıyaslaması.",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">{lang === "en" ? "Methodology Document" : "Metodoloji Belgesi"}</Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4">{lang === "en" ? "CyberStep Assessment Methodology" : "CyberStep Değerlendirme Metodolojisi"}</h1>
          <p className="text-white/80 text-base max-w-2xl leading-relaxed mb-6">
            CyberStep skorlarının nasıl hesaplandığı, hangi uluslararası standartları kullandığı ve
            her metriğin neden önemli olduğu hakkında teknik referans belgesi.
            Hedef kitle: CISO, güvenlik ekipleri, denetçiler, entegrasyon ortakları.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {["CVSS v3.1", "EPSS v3", "MITRE ATT&CK v15", "NVD", "CISA KEV", "Mozilla Observatory", "HIBP", "USOM"].map(t => (
              <span key={t} className="bg-white/10 text-white px-2.5 py-1 rounded-full font-mono">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* TOC */}
      <section className="py-8 border-b bg-muted/10">
        <div className="container mx-auto px-4 max-w-4xl">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-3">İçindekiler</p>
          <div className="flex flex-wrap gap-3">
            {[
              ["#domain-tarama", "Domain Teknik Analizi"],
              ["#mini-degerlendirme", "Mini Değerlendirme"],
              ["#skor-modeli", "Skor ve Grade Modeli"],
              ["#cvss", "CVSS Entegrasyonu"],
              ["#epss", "EPSS Önceliklendirme"],
              ["#mitre", "MITRE ATT&CK"],
              ["#sinirlar", "Kısıtlamalar"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-xs text-primary hover:underline flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />{label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Domain Scan */}
      <section id="domain-tarama" className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">1. Domain Teknik Analizi</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-8">
            Domain tarama, kamuya açık teknik sinyallerin otomatik olarak toplanması ve puanlanmasıdır.
            Şirket personeline soru sormadan, yalnızca DNS/HTTP/SSL/IP altyapısından türetilir.
          </p>

          <h3 className="font-semibold text-foreground mb-3 text-sm">1.1 Risk Skoru v2 Kategorileri (toplam 100 puan)</h3>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden mb-4">
            <div className="grid grid-cols-[110px_70px_1fr] bg-muted/30 border-b border-border/30 px-5 py-2 gap-3">
              {["Kategori", "Maks.", "Nasıl puanlanır"].map(h => (
                <span key={h} className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {DOMAIN_CHECKS.map(c => (
              <div key={c.id} className="grid grid-cols-[110px_70px_1fr] items-center px-5 py-3 border-b border-border/20 last:border-0 gap-3">
                <span className="text-xs font-bold text-primary">{c.id}</span>
                <span className="text-xs font-bold text-foreground">{c.max}</span>
                <span className="text-xs text-muted-foreground">{c.desc}</span>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-foreground mb-3 text-sm">1.2 Ağır Bulgu Tavanları</h3>
          <p className="text-xs text-muted-foreground mb-3">Ortalamanın ağır bir riski gizlemesini önlemek için, aşağıdaki bulgulardan biri varsa skor belirtilen değeri aşamaz.</p>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden mb-4">
            {SCORE_CAPS.map(c => (
              <div key={c.cond} className="flex items-center justify-between px-5 py-3 border-b border-border/20 last:border-0 gap-3">
                <span className="text-sm text-foreground">{c.cond}</span>
                <span className="text-xs font-bold text-red-500 shrink-0">en fazla {c.max}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-8 text-xs text-muted-foreground space-y-1.5">
            <p><strong className="text-foreground">Ölçülmeyen veri temiz sayılmaz.</strong> Bir kategori ölçülemediyse (ör. port verisi yok) skor yalnızca ölçülen kategorilerin azami puanı üzerinden 100'e ölçeklenir ve kapsama oranı ayrıca raporlanır. DNS zaman aşımı gibi geçici hatalar "kayıt yok" anlamına gelmez; ilgili kontrol yeniden denenir, yine ölçülemezse skora dahil edilmez. CVE yalnızca bileşenin sürümü tespit edilip NVD sürüm aralığıyla eşleştiğinde atfedilir; sürümü doğrulanamayan bileşenler için zafiyet iddia edilmez.</p>
            <p><strong className="text-foreground">Veri yetersiz.</strong> Alan adı çözümlenemiyorsa skor üretilmez.</p>
            <p><strong className="text-foreground">Sektör kıyaslaması.</strong> Her domainin en son taramasının skoru, sektörüne göre gruplanır; en az 30 domaini olan sektörler yayınlanır. Ekranda görülen "taranan Türk domain" sayısı, en az bir taraması tamamlanmış ve skoru hesaplanmış benzersiz domainleri ifade eder; keşfedilmiş ama henüz taranmamış adaylar bu sayıya dahil değildir.</p>
          </div>

          <h3 className="font-semibold text-foreground mb-3 text-sm">1.3 Kullanılan Kaynaklar</h3>

          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-3 bg-muted/30 border-b border-border/30 px-5 py-2">
              {["Sinyal", "Etki Seviyesi", "Kaynak"].map(h => (
                <span key={h} className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {RISK_SIGNALS.map(s => (
              <div key={s.signal} className="grid grid-cols-3 items-center px-5 py-3 border-b border-border/20 last:border-0">
                <span className="text-sm text-foreground">{s.signal}</span>
                <span className={`text-xs font-semibold ${s.impact === "Kritik" ? "text-red-500" : s.impact === "Yüksek" ? "text-orange-500" : "text-yellow-500"}`}>{s.impact}</span>
                <span className="text-xs text-muted-foreground">{s.src}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mini Assessment */}
      <section id="mini-degerlendirme" className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">2. Mini Değerlendirme (20 Soru)</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-8">
            Anket tabanlı değerlendirme; domain taramasının ölçemediği insana ve sürece dayalı kontrolleri ölçer.
            5 alan, her alanda 4 soru. Soru ağırlıkları alan kritikliğine göre değişir.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {ASSESSMENT_DOMAINS.map(d => (
              <div key={d.id} className={`rounded-xl border p-5 ${d.weight.includes("Kritik") ? "border-primary/25 bg-primary/5" : "border-border/50 bg-card/30"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-xs shrink-0">{d.id}</span>
                    <span className="font-semibold text-sm text-foreground">{d.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${d.weight.includes("Kritik") ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}`}>
                    {d.weight}
                  </span>
                </div>
                <ul className="space-y-1">
                  {d.examples.map(e => (
                    <li key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary/50 shrink-0" />{e}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-foreground mb-3 text-sm">Yanıt Ağırlıkları</h3>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-3 bg-muted/30 border-b border-border/30 px-5 py-2">
              {["Yanıt", "Puan", "Yorum"].map(h => (
                <span key={h} className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {ANSWER_WEIGHTS.map(a => (
              <div key={a.answer} className="grid grid-cols-3 items-center px-5 py-3 border-b border-border/20 last:border-0">
                <span className={`font-semibold text-sm ${a.color}`}>{a.answer}</span>
                <span className={`font-black text-lg ${a.color}`}>{a.score}</span>
                <span className="text-xs text-muted-foreground">{a.note}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Kritik alan soruları (C ve D) 2x çarpanla ağırlıklandırılır. Maksimum ham puan: 140. Normalize edilmiş skor 0–100 aralığında gösterilir.
          </p>
        </div>
      </section>

      {/* Score model */}
      <section id="skor-modeli" className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">3. Skor ve Grade Modeli</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-8">
            Risk Skoru v2 ve Mini Değerlendirme sonuçları ayrı ayrı 0–100 aralığında gösterilir.
            Harf notu ve risk seviyesi Risk Skoru v2 için aşağıdaki eşiklerle belirlenir.
          </p>
          <div className="space-y-3">
            {GRADES.map(g => (
              <div key={g.grade} className={`flex items-center gap-5 rounded-xl border p-4 ${g.bg}`}>
                <div className={`text-3xl font-black w-10 shrink-0 ${g.color}`}>{g.grade}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-sm font-bold ${g.color}`}>{g.range} Puan</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${g.color} bg-current/10`}>{g.risk}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CVSS */}
      <section id="cvss" className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">4. CVSS v3.1 Entegrasyonu</h2>
            </div>
            <a href="https://www.first.org/cvss/" target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1">
              FIRST.org <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            CVSS (Common Vulnerability Scoring System) v3.1, her güvenlik açığının şiddetini 0.0–10.0 arasında puanlar.
            CyberStep, NVD veritabanından CVE eşleşmelerini domain taraması sırasında çeker ve CVSS puanlarını rapora dahil eder.
          </p>
          <div className="space-y-2 mb-6">
            {CVSS_LEVELS.map(l => (
              <div key={l.label} className="flex items-center gap-4 rounded-xl border border-border/30 bg-card/30 p-4">
                <div className={`h-3 w-3 rounded-full ${l.color} shrink-0`} />
                <span className="font-mono text-xs text-muted-foreground w-16">{l.range}</span>
                <span className={`text-sm font-bold w-16 ${l.range.startsWith("9") ? "text-red-500" : l.range.startsWith("7") ? "text-orange-500" : l.range.startsWith("4") ? "text-yellow-500" : "text-blue-400"}`}>{l.label}</span>
                <span className="text-xs text-muted-foreground">{l.action}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
            <span className="font-bold text-primary block mb-1">CyberStep'te CVSS Nasıl Kullanılır?</span>
            <p className="text-muted-foreground">
              Yalnızca sürümü kesin tespit edilen yazılımlar (site parmak izi ve açık port banner'ı) NVD'deki CVE kayıtlarıyla, sürüm aralığı doğrulanarak eşleştirilir; sürüm bilinmiyorsa CVE atfedilmez. Banner kaynaklı eşleşmeler dağıtım yamaları nedeniyle doğrulanmamış olabilir. NVD'ye ulaşılamazsa zafiyet kategorisi "ölçülemedi" sayılır, temiz kabul edilmez.
              CVSS 7.0+ eşleşmeleri raporda kırmızı bayrak olarak işaretlenir ve Saldırı Senaryosu analizine dahil edilir.
              CISA KEV (Known Exploited Vulnerabilities) listesinde yer alan CVE'ler ayrıca vurgulanır.
            </p>
          </div>
        </div>
      </section>

      {/* EPSS */}
      <section id="epss" className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">5. EPSS — İstismar Olasılığı Tahmini</h2>
            </div>
            <a href="https://www.first.org/epss/" target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1">
              FIRST.org EPSS <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            EPSS v3 (Exploit Prediction Scoring System), her CVE için önümüzdeki 30 günde aktif istismar edilme olasılığını tahmin eder.
            CVSS şiddeti yüksek ama EPSS skoru düşük olan açıklar teorik tehdit; EPSS yüksek ise gerçek operasyonel risk.
          </p>
          <div className="space-y-3 mb-6">
            {EPSS_EXPLAIN.map(e => (
              <div key={e.range} className="flex items-start gap-4 rounded-xl border border-border/40 bg-card/30 p-4">
                <span className="font-mono text-xs text-primary font-bold w-24 shrink-0 mt-0.5">{e.range}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{e.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
            <span className="font-bold text-primary block mb-1">Neden CVSS + EPSS Birlikte?</span>
            <p className="text-muted-foreground">
              CVSS tek başına kullanıldığında güvenlik ekipleri binlerce "Kritik" açık ile boğulur, hangisini önce kapatacağını bilemez.
              EPSS, CVSS puanı ne olursa olsun şu anda gerçekten tehlikeli olan açıkları öne çıkarır.
              CyberStep, her iki skoru birlikte göstererek somut önceliklendirme rehberi sunar.
            </p>
          </div>
        </div>
      </section>

      {/* MITRE ATT&CK */}
      <section id="mitre" className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">6. MITRE ATT&CK Eşlemesi</h2>
            </div>
            <a href="https://attack.mitre.org/" target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1">
              attack.mitre.org <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            MITRE ATT&CK v15, gerçek dünya saldırılarından türetilmiş 200+ teknik ve taktikten oluşan bir bilgi tabanıdır.
            CyberStep'in AI destekli Saldırı Senaryosu Analizi her bulgulu domain için ATT&CK tekniklerini eşler.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {MITRE_PHASES.map(p => (
              <div key={p.id} className="rounded-xl border border-border/50 bg-card/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{p.icon}</span>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">{p.id}</p>
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {p.examples.map(e => (
                    <li key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary/50 shrink-0" />{e}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
            <span className="font-bold text-primary block mb-1">CyberStep Saldırı Senaryosunda ATT&CK Nasıl Kullanılır?</span>
            <p className="text-muted-foreground">
              Domain tarama bulguları (açık portlar, eski TLS, kara liste tespiti vb.) Gemini 2.5 Flash ile analiz edilir.
              AI, her bulgu için olası ATT&CK tekniklerini eşler ve gerçekçi saldırı zinciri oluşturur.
              Her senaryo için olasılık (Yüksek/Orta/Düşük), aciliyet ve KVKK etkisi ayrı ayrı değerlendirilir.
            </p>
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section id="sinirlar" className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">7. Metodoloji Kısıtlamaları</h2>
          </div>
          <div className="space-y-3">
            {[
              { title: "Anlık fotoğraf", detail: "Tarama, belirli bir andaki kamuya açık sinyalleri yansıtır. İç ağ güvenliği, fiziksel güvenlik veya insan davranışı hakkında kesin sonuç üretmez." },
              { title: "Yanlış negatifler mümkün", detail: "Kara listelere henüz eklenmemiş kötücül aktivite veya DNS yayılım gecikmesi nedeniyle bazı sorunlar tespit edilemeyebilir." },
              { title: "Alan adı tabanlı ölçüm", detail: "Değerlendirme domain düzeyinde çalışır. Alt domain'ler ve iç sistemler tam olarak kapsanmaz (Premium planda alt domain taraması dahildir)." },
              { title: "Otomatik keşif", detail: "Saldırı Senaryosu analizi AI tarafından üretilir; çıktılar belirlilik (certainty) değil olasılık tahminleri içerir. CISO veya güvenlik uzmanı incelemesi önerilir." },
              { title: "Sertifikasyon yerine geçmez", detail: "CyberStep skoru, ISO 27001, SOC 2 veya herhangi bir akredite sertifikasyonun yerini almaz. Risk görünürlüğü ve önceliklendirme aracıdır." },
            ].map(l => (
              <div key={l.title} className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/30 p-4">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{l.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-muted/10 border-t">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">Metodoloji hakkında soru mu var?</h2>
          <p className="text-sm text-muted-foreground mb-6">Enterprise müşterilerimize teknik brifing ve güvenlik belgesi paketi sunuyoruz.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 font-semibold">
              <Link href="/iletisim">Teknik Brifing Talep Et <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/guvenlik-merkezi">Güvenlik Merkezi</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
