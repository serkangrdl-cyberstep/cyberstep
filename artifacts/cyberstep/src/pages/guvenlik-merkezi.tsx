import { Shield, Lock, Server, Database, Globe, CheckCircle2, AlertTriangle, Eye, FileText, ArrowRight, Cpu, Network, Key, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";

const ARCH_LAYERS = [
  {
    icon: Globe,
    title: "CDN ve Edge Katmanı",
    items: [
      "Tüm trafik HTTPS/TLS 1.3 zorunlu — HTTP yönlendirmesi aktif",
      "HTTP Strict Transport Security (HSTS) max-age=31536000",
      "CORS politikası: yalnızca tanımlı origin'ler",
    ],
  },
  {
    icon: Server,
    title: "Uygulama Katmanı",
    items: [
      "Node.js 24 · Express 5 — minimum yüzey, minimal bağımlılık",
      "Tüm giriş Zod şeması ile doğrulanır, ham kullanıcı verisi asla DB'ye ulaşmaz",
      "Oturum token'ları httpOnly cookie — XSS erişimi imkansız",
      "Rate limiting: endpoint bazlı, IP bazlı ve API key bazlı",
      "Structured JSON logging — hassas veri asla log'a yazılmaz",
    ],
  },
  {
    icon: Database,
    title: "Veri Katmanı",
    items: [
      "PostgreSQL — Replit managed, colocated (Türkiye yakın bölge)",
      "Drizzle ORM — parametreli sorgular, SQL injection imkansız",
      "Şifreler asla saklanmaz (Clerk / Replit Auth — federated)",
      "Kişisel veri minimizasyonu — sadece gerekli alanlar toplanır",
      "Backup: otomatik günlük, 7 günlük retention",
    ],
  },
  {
    icon: Cpu,
    title: "AI İşleme Katmanı",
    items: [
      "Gemini 2.5 Flash — Replit AI Integrations proxy üzerinden",
      "Kullanıcı verisi AI sağlayıcısına gönderilmez; yalnızca anonim teknik bulgular",
      "AI çıktıları DB'de saklanır, kullanıcıya atfedilir",
    ],
  },
  {
    icon: Network,
    title: "Ağ ve Altyapı",
    items: [
      "Tüm servisler özel ağ üzerinde iletişim kurar (public port açığı yok)",
      "Bağımlılık denetimi: npm audit entegrasyonu",
      "Secrets management: environment variable (hardcoded sır yok)",
    ],
  },
];

const DATA_POLICIES = [
  {
    category: "Veri Toplama",
    icon: Eye,
    policies: [
      { label: "Domain tarama verisi", detail: "Kamuya açık DNS/SSL/IP kayıtları — kişisel veri değil" },
      { label: "Kullanıcı hesabı", detail: "E-posta, ad — kimlik doğrulama için zorunlu minimum" },
      { label: "Değerlendirme yanıtları", detail: "KOBİ'nin kendi güvenlik durumunu açıkladığı veriler — şifreli aktarım" },
      { label: "Log verileri", detail: "IP adresi, timestamp, endpoint — operasyonel amaç, 30 gün retention" },
    ],
  },
  {
    category: "Veri Aktarımı",
    icon: RefreshCw,
    policies: [
      { label: "Üçüncü taraf aktarım", detail: "Gemini AI: anonim teknik bulgular; HIBP, VirusTotal, Shodan: domain adı sorgusu" },
      { label: "Yurt dışı aktarım", detail: "KVKK Madde 9 kapsamında açık rıza + teknik kontrol" },
      { label: "Alt işleyenler", detail: "Replit (altyapı), Clerk (kimlik), Google (AI) — GDPR/KVKK uyumlu" },
      { label: "Satış veya devir", detail: "Müşteri verisi asla üçüncü tarafa satılmaz" },
    ],
  },
  {
    category: "Veri Silme",
    icon: Shield,
    policies: [
      { label: "Hesap silme", detail: "Talep tarihinden itibaren 30 gün içinde tüm kişisel veri silinir" },
      { label: "Tarama verisi saklama", detail: "Teknik bulgular (kişisel veri içermeyen) 24 ay saklanabilir" },
      { label: "KVKK başvurusu", detail: "kvkk@cyberstep.io — 30 gün içinde yanıt" },
      { label: "Portalda silme", detail: "Hesap ayarlarından anlık talep (yakında)" },
    ],
  },
];

const ENCRYPTION = [
  { label: "Aktarımda şifreleme", val: "TLS 1.3", detail: "Tüm istemci-sunucu iletişimi" },
  { label: "Bekleyen veri", val: "AES-256", detail: "Veritabanı disk şifreleme (managed DB)" },
  { label: "Oturum token'ları", val: "httpOnly Secure", detail: "XSS ile erişilemez" },
  { label: "API anahtarları", val: "csk_ prefix · 48 hex", detail: "Kriptografik güçlü rastgelelik" },
  { label: "Parola", val: "Saklanmaz", detail: "Clerk federated auth — parola CyberStep'e hiç gelmez" },
];

const SUBPROCESSORS = [
  { name: "Replit Inc.", role: "Altyapı / Barındırma", country: "ABD", dpa: "GDPR DPA mevcut", gdpr: true },
  { name: "Clerk Inc.", role: "Kimlik Doğrulama", country: "ABD", dpa: "GDPR DPA mevcut", gdpr: true },
  { name: "Google LLC", role: "Gemini AI İşleme", country: "ABD", dpa: "GDPR DPA mevcut", gdpr: true },
  { name: "Have I Been Pwned", role: "İhlal Veritabanı", country: "Avustralya", dpa: "Kamuya açık API", gdpr: false },
  { name: "Shodan LLC", role: "Port / Servis Tarama", country: "ABD", dpa: "Ticari sözleşme", gdpr: false },
  { name: "VirusTotal (Google)", role: "Domain İtibar", country: "ABD", dpa: "GDPR DPA mevcut", gdpr: true },
];

const CERT_ROADMAP = [
  {
    phase: "Faz 1",
    period: "Şu An",
    title: "Teknik Kontroller Aktif",
    status: "done",
    items: ["TLS 1.3, HSTS, CORS", "Input validasyon (Zod)", "Rate limiting & API key yönetimi", "KVKK Aydınlatma metni, DPA şablonu, VERBIS hazırlık"],
  },
  {
    phase: "Faz 2",
    period: "Q3 2026",
    title: "ISO 27001 Gap Analizi",
    status: "planned",
    items: ["Akredite danışman ile ISMS kapsamı belirleme", "Risk değerlendirme metodolojisi (ISO 27005)", "Politika ve prosedür dokümantasyonu", "İç denetim planı"],
  },
  {
    phase: "Faz 3",
    period: "Q4 2026",
    title: "Sertifikasyon Denetimi",
    status: "planned",
    items: ["Stage 1 denetim: belge incelemesi (Bureau Veritas / TÜV / SGS)", "Stage 2 denetim: yerinde uygulama doğrulama", "Uygunsuzluk kapatma", "ISO 27001:2022 sertifikası"],
  },
  {
    phase: "Faz 4",
    period: "2027+",
    title: "TSE ve Gözetim Denetimleri",
    status: "future",
    items: ["TS EN ISO/IEC 27001 (TSE akreditasyonu)", "Yıllık gözetim denetimleri", "SOC 2 Type II değerlendirmesi (isteğe bağlı)"],
  },
];

export default function GuvenlikMerkezi() {
  usePageMeta({
    title: "Güvenlik Merkezi | CyberStep.io",
    description: "CyberStep.io platform güvenlik mimarisi, veri işleme politikaları, şifreleme standartları ve ISO 27001 yol haritası.",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="flex items-start gap-5 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <div>
              <Badge className="bg-primary/20 text-primary border-primary/40 mb-3">Güvenlik Merkezi</Badge>
              <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Platform Güvenlik ve Güven Merkezi</h1>
              <p className="text-white/80 text-base max-w-2xl">
                CyberStep müşteri verilerini nasıl korur, hangi teknik kontrolleri uygular ve uyumluluk yol haritamız.
                Bu sayfa enterprise müşteriler, tedarik ekipleri ve denetçiler için hazırlanmıştır.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "TLS 1.3", ok: true },
              { label: "AES-256 Disk Şifreleme", ok: true },
              { label: "KVKK Uyumlu", ok: true },
              { label: "ISO 27001 — Süreçte", ok: false },
              { label: "SOC 2 — Planlanıyor", ok: false },
            ].map(t => (
              <span key={t.label} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${t.ok ? "bg-green-500/10 text-green-300 border-green-500/30" : "bg-muted/30 text-muted-foreground border-muted/30"}`}>
                {t.ok
                  ? <CheckCircle2 className="h-3 w-3" />
                  : <AlertTriangle className="h-3 w-3" />}
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-foreground mb-2">Platform Teknik Mimarisi</h2>
          <p className="text-muted-foreground text-sm mb-8">Katmanlı savunma (defense-in-depth) mimarisi: her katmanda bağımsız güvenlik kontrolleri.</p>
          <div className="space-y-4">
            {ARCH_LAYERS.map((layer, i) => (
              <div key={layer.title} className="border border-border/50 rounded-xl bg-card/30 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/20 border-b border-border/30">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <layer.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">{i + 1}. {layer.title}</span>
                </div>
                <ul className="divide-y divide-border/20">
                  {layer.items.map(item => (
                    <li key={item} className="flex items-start gap-2.5 px-5 py-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Encryption */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Şifreleme Standartları</h2>
          </div>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-3 bg-muted/30 border-b border-border/30 px-5 py-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Kapsam</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Standart</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Detay</span>
            </div>
            {ENCRYPTION.map(e => (
              <div key={e.label} className="grid grid-cols-3 items-center px-5 py-3.5 border-b border-border/20 last:border-0">
                <span className="text-sm text-foreground">{e.label}</span>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-primary font-bold w-fit">{e.val}</span>
                <span className="text-xs text-muted-foreground">{e.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data policies */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Veri İşleme Politikaları</h2>
          </div>
          <div className="space-y-5">
            {DATA_POLICIES.map(section => (
              <div key={section.category} className="border border-border/50 rounded-xl bg-card/30 overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3 bg-muted/20 border-b border-border/30">
                  <section.icon className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">{section.category}</span>
                </div>
                <div className="divide-y divide-border/20">
                  {section.policies.map(p => (
                    <div key={p.label} className="flex items-start justify-between gap-4 px-5 py-3">
                      <span className="text-sm font-medium text-foreground w-40 shrink-0">{p.label}</span>
                      <span className="text-sm text-muted-foreground">{p.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subprocessors */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Alt İşleyenler (Sub-processors)</h2>
            </div>
            <span className="text-xs text-muted-foreground">Son güncelleme: Mayıs 2026</span>
          </div>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-4 bg-muted/30 border-b border-border/30 px-5 py-2">
              {["Firma", "Rol", "Ülke", "DPA"].map(h => (
                <span key={h} className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {SUBPROCESSORS.map(s => (
              <div key={s.name} className="grid grid-cols-4 items-center px-5 py-3.5 border-b border-border/20 last:border-0">
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.role}</span>
                <span className="text-xs text-muted-foreground">{s.country}</span>
                <span className={`text-xs font-medium ${s.gdpr ? "text-green-500" : "text-muted-foreground"}`}>{s.dpa}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Alt işleyen listesindeki değişiklikler bu sayfada 30 gün önceden duyurulur.</p>
        </div>
      </section>

      {/* Incident response */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Güvenlik Açığı ve Olay Müdahale</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border/50 bg-card/30 p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Güvenlik Açığı Bildirimi</h3>
              <p className="text-sm text-muted-foreground mb-4">
                CyberStep platformunda bir güvenlik açığı keşfettiyseniz lütfen <strong className="text-foreground">guvenlik@cyberstep.io</strong> adresine sorumlu ifşa (responsible disclosure) politikasıyla bildirin.
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />48 saat içinde ilk yanıt</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />90 gün koordineli ifşa penceresi</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Hall of Fame (isteğe bağlı)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/30 p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Veri İhlali Müdahale</h3>
              <p className="text-sm text-muted-foreground mb-4">
                KVKK Madde 12 kapsamında veri ihlali tespitinde:
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />72 saat içinde KVKK Kurumu'na bildirim</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Etkilenen müşterilere e-posta bildirimi</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Olay sonrası teknik rapor yayını</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ISO 27001 Roadmap */}
      <section className="py-14 bg-muted/20 border-t">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Sertifikasyon Yol Haritası</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-8">ISO 27001:2022 ve TSE belgelendirme planımız. Güncel durum aşağıda gösterilmektedir.</p>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border/50" />
            <div className="space-y-6 pl-14">
              {CERT_ROADMAP.map((phase) => (
                <div key={phase.phase} className="relative">
                  <div className={`absolute -left-8 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs font-bold
                    ${phase.status === "done" ? "bg-green-500 border-green-500 text-white" :
                      phase.status === "planned" ? "bg-primary/20 border-primary text-primary" :
                      "bg-muted border-border text-muted-foreground"}`}>
                    {phase.status === "done" ? "✓" : phase.phase[phase.phase.length - 1]}
                  </div>
                  <div className={`rounded-xl border p-5 ${phase.status === "done" ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : "border-border/50 bg-card/30"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs font-bold text-primary">{phase.phase}</span>
                        <h3 className="font-bold text-foreground text-sm mt-0.5">{phase.title}</h3>
                      </div>
                      <Badge variant="outline" className={`text-xs ${phase.status === "done" ? "border-green-300 text-green-600 bg-green-50 dark:bg-green-950/20" : "border-border text-muted-foreground"}`}>
                        {phase.period}
                      </Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {phase.items.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${phase.status === "done" ? "text-green-500" : "text-muted-foreground/40"}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DPA CTA */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground mb-2">Veri İşleme Sözleşmesi (DPA)</h2>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Enterprise müşterilerimiz için imzalı KVKK/GDPR Veri İşleme Sözleşmesi (DPA) talep edebilirsiniz.
                  Taslak sözleşme 2 iş günü içinde iletilir.
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 font-semibold">
                  <Link href="/kvkk-dpa-olustur">DPA Talep Et <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="mailto:kvkk@cyberstep.io">kvkk@cyberstep.io</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
