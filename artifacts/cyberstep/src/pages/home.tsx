/**
 * Ana sayfa — TPRM (tedarikçi siber risk skorlaması) odaklı.
 * Önceki ana sayfa: pages/archive/home-legacy.tsx (route'a bağlı değil, gerektiğinde geri alınabilir).
 */
import { useState } from "react";
import { Link } from "wouter";
import {
  ShieldCheck, Upload, Gauge, BellRing, FileText, Building2, Landmark, ShieldAlert, Handshake,
  ChevronRight, Loader2, Search, Bug, Network, Globe2, Mail, Database, Lock, BadgeCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";
import { usePageMeta } from "@/hooks/use-page-meta";

interface DomainScoreResponse {
  domain: string;
  status: "scanned" | "not_scanned" | "insufficient_data";
  score?: number;
  grade?: string;
  riskLabel?: string;
  lastScanAt?: string;
  topFindings?: Array<{ severity: "critical" | "high" | "medium" | "low"; title: string }>;
  findingCount?: number;
  error?: string;
}

const SEVERITY_TR = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" } as const;
const SEVERITY_EN = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;
const SEVERITY_CLS = {
  critical: "text-red-400", high: "text-orange-400", medium: "text-amber-400", low: "text-slate-400",
} as const;

const ROBOT_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
type RobotName = "maskot" | "tarama" | "alarm" | "rapor" | "zafer" | "mutlu" | "dikkat";
const ROBOT_ASPECT: Record<RobotName, [number, number]> = {
  maskot: [302, 420], tarama: [315, 420], alarm: [329, 420], rapor: [350, 420],
  zafer: [337, 420], mutlu: [317, 420], dikkat: [306, 420],
};

/** Step AI robot maskotu. Dekoratif: alt metin boş (yanındaki metin anlamı taşır). */
function Robot({ name, className = "", alt = "" }: { name: RobotName; className?: string; alt?: string }) {
  const [w, h] = ROBOT_ASPECT[name];
  return <img src={`${ROBOT_BASE}/robot/${name}.webp`} width={w} height={h} alt={alt} loading="lazy" decoding="async" className={className} />;
}

/** Skora göre robot ruh hali (marka kılavuzu: A/B mutlu, C/D dikkat, F alarm). */
function moodFor(score: number): RobotName {
  if (score >= 70) return "mutlu";
  if (score >= 40) return "dikkat";
  return "alarm";
}

function gradeColor(score: number): string {
  if (score >= 70) return "text-emerald-400 border-emerald-400/40";
  if (score >= 55) return "text-amber-400 border-amber-400/40";
  if (score >= 40) return "text-orange-400 border-orange-400/40";
  return "text-red-400 border-red-400/40";
}

export default function Home() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const tx = (tr: string, eng: string) => (en ? eng : tr);

  const [domain, setDomain] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<DomainScoreResponse | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  usePageMeta({
    title: tx("Tedarikçi Siber Risk Skorlaması | CyberStep.io", "Supplier Cyber Risk Ratings for Türkiye | CyberStep.io"),
    description: tx(
      "Tedarikçilerinizin siber güvenlik riskini dışarıdan, tedarikçiye yük bindirmeden ölçün. Anında risk skoru, sektör kıyaslaması, sürekli izleme, tedarikçi anketi ve KVKK uyumlu raporlar.",
      "Measure your suppliers' cyber risk from the outside, without burdening them. Instant risk scores, sector benchmarks, continuous monitoring, supplier questionnaires and KVKK-ready reports.",
    ),
    keywords: tx(
      "tedarikçi risk yönetimi, TPRM, tedarik zinciri siber güvenlik, siber risk skoru, KVKK veri işleyen, 7545 siber güvenlik kanunu, BDDK dış hizmet",
      "third-party risk management, TPRM, supplier cyber risk, security rating, Turkey, KVKK",
    ),
    canonicalPath: "/",
    lang,
  });

  async function checkSupplier(e: React.FormEvent) {
    e.preventDefault();
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
    if (!d) return;
    setChecking(true);
    setResult(null);
    setCheckError(null);
    try {
      const r = await fetch(`/api/public/domain-score/${encodeURIComponent(d)}`);
      const data = (await r.json()) as DomainScoreResponse;
      if (!r.ok) throw new Error(data.error ?? tx("Sorgu başarısız", "Lookup failed"));
      setResult(data);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : tx("Bir hata oluştu", "Something went wrong"));
    } finally {
      setChecking(false);
    }
  }

  const steps = [
    { icon: Upload, title: tx("Listenizi yükleyin", "Upload your list"), text: tx("Önce kendi alan adlarınızı, sonra tedarikçilerinizi ekleyin; yüzlercesini Excel/CSV ile tek seferde yükleyebilirsiniz.", "Add your own domains first, then your suppliers; upload hundreds at once via Excel/CSV.") },
    { icon: Gauge, title: tx("Anında skor", "Instant score"), text: tx("Veritabanımızda taranmış tedarikçiler saniyeler içinde skorlanır; diğerleri otomatik taranır.", "Suppliers already in our database are scored in seconds; the rest are scanned automatically.") },
    { icon: BellRing, title: tx("Sürekli izleme", "Continuous monitoring"), text: tx("Yeni kritik açık, risk artışı veya skor düşüşünde tek bir özet e-posta ile haberdar olun.", "Get one summary e-mail when a new critical issue, risk escalation or score drop appears.") },
    { icon: FileText, title: tx("Anket ve rapor", "Questionnaire & report"), text: tx("Tedarikçiye öz-değerlendirme anketi gönderin; tedarikçi portföyü ve kendi alan adlarınız için ayrı PDF raporları indirin.", "Send a self-assessment questionnaire; download separate PDF reports for your supplier portfolio and your own domains report for audits and the board.") },
  ];

  const categories = [
    { icon: Bug, label: tx("Bilinen zafiyetler", "Known vulnerabilities"), pts: 30, note: tx("CVE ve CISA KEV (aktif sömürülen)", "CVE and CISA KEV (actively exploited)") },
    { icon: Network, label: tx("Ağ maruziyeti", "Network exposure"), pts: 20, note: tx("İnternete açık RDP, SMB, veritabanı…", "Internet-exposed RDP, SMB, databases…") },
    { icon: ShieldAlert, label: tx("İtibar", "Reputation"), pts: 15, note: tx("Kara listeler, USOM, zararlı yazılım listeleri", "Blacklists, USOM, malware lists") },
    { icon: Mail, label: tx("E-posta güvenliği", "E-mail security"), pts: 15, note: "SPF, DMARC, DKIM" },
    { icon: Database, label: tx("Veri sızıntısı", "Data breaches"), pts: 10, note: tx("Bilinen sızıntılarda kurum e-postaları", "Company e-mails in known breaches") },
    { icon: Lock, label: tx("TLS ve web", "TLS & web"), pts: 10, note: tx("Sertifika ve güvenlik başlıkları", "Certificates and security headers") },
  ];

  const audiences = [
    { icon: Landmark, href: "/kurumsal", title: tx("Banka ve finans", "Banks & finance"), text: tx("Tedarikçilerinizin siber riskini kanıta dayalı, sürekli izleyin.", "Monitor your suppliers' cyber risk continuously and on evidence.") },
    { icon: ShieldCheck, href: "/skor-api", title: tx("Sigorta şirketleri", "Insurers"), text: tx("Siber poliçe fiyatlamasında dışarıdan risk verisini API ile alın.", "Feed outside-in risk data into cyber policy underwriting via API.") },
    { icon: Building2, href: "/kurumsal", title: tx("Kurumsal satın alma", "Enterprise procurement"), text: tx("Yeni tedarikçiyi sözleşmeden önce, mevcutları sürekli değerlendirin.", "Assess new suppliers before contracting and existing ones continuously.") },
  ];

  const tools = [
    { href: "/domain-tarama", label: tx("Alan adı güvenlik taraması", "Domain security scan") },
    { href: "/araclar/dmarc-kontrol", label: tx("DMARC kontrol", "DMARC check") },
    { href: "/araclar/ssl-kontrol", label: tx("SSL kontrol", "SSL check") },
  ];

  const faqs = [
    {
      q: tx("Hangi tedarikçileri portföye eklemeliyim?", "Which suppliers should I add to my portfolio?"),
      a: tx("Bir siber olay yaşadıklarında sizi etkileyecek olanları: API ile veri aldığınız veya verdiğiniz firmalar, üretiminiz için parça ya da hizmet aldığınız yan sanayi, iş sürecinizi taşıyan bulut ve yazılım hizmetleri, verilerinizi işleyen veya sistemlerinize erişimi olan firmalar. Birkaç kez alım yaptığınız, olası bir siber olayın operasyonunuzu etkilemeyeceği firmaları eklemeyin.", "Those who would affect you if they suffered a cyber incident: firms you exchange data with through APIs, sub-suppliers providing parts or services for your production, cloud and software services running your business process, and firms that process your data or have access to your systems. Leave out firms you have bought from a few times whose incident would not affect your operations."),
    },
    {
      q: tx("Kendi alan adlarımı da taratabilir miyim?", "Can I scan my own domains too?"),
      a: tx("Evet. Kendi alan adlarınızı tedarikçilerinizle aynı Risk Skoru v2 ile ölçebilir, sürekli izleyebilir ve ayrı bir PDF raporu alabilirsiniz. Kendi alan adları tedarikçi sayınıza dahil edilmez; müşteri başına en fazla 20 alan adı eklenebilir.", "Yes. You can measure your own domains with the same Risk Score v2 as your suppliers, monitor them continuously and download a separate PDF report. Your own domains do not count toward your supplier total; up to 20 domains can be added per customer."),
    },
    {
      q: tx("Tedarikçilerin bir şey kurması veya onay vermesi gerekiyor mu?", "Do suppliers need to install anything or give consent?"),
      a: tx("Hayır. Skor yalnızca herkese açık bilgilerden (DNS kayıtları, sertifikalar, internete açık servisler, itibar listeleri) hesaplanır. Tedarikçinin sistemlerine erişilmez veya saldırı testi yapılmaz.", "No. The score is built only from public information (DNS records, certificates, internet-facing services, reputation lists). We never access supplier systems or run intrusive tests."),
    },
    {
      q: tx("Skor nasıl hesaplanıyor?", "How is the score calculated?"),
      a: tx("Altı kategori ağırlıklandırılır: zafiyetler 30, ağ maruziyeti 20, itibar 15, e-posta güvenliği 15, veri sızıntısı 10, TLS ve web 10. Aktif sömürülen bir zafiyet veya USOM kaydı gibi ağır bulgular skoru üstten sınırlar. Ölçülemeyen kategoriler “temiz” sayılmaz. Ayrıntılar metodoloji sayfasında.", "Six weighted categories: vulnerabilities 30, network exposure 20, reputation 15, e-mail security 15, data breaches 10, TLS & web 10. Severe findings such as an actively exploited vulnerability cap the score. Unmeasured categories are never counted as clean. See the methodology page."),
    },
    {
      q: tx("Mevzuat açısından ne işe yarar?", "How does it help with regulation?"),
      a: tx("KVKK md. 12 uyarınca veri sorumlusu, verileri kendi adına işleyen kişilerle birlikte güvenlik tedbirlerinden müştereken sorumludur. 7545 sayılı Siber Güvenlik Kanunu önleyici ve sürekli siber güvenlik yükümlülükleri getirir; BDDK düzenlemeleri bankaların destek hizmeti sağlayıcılarını değerlendirmesini ayrıca ister. CyberStep raporları bu süreçlerde destekleyici kanıt olarak kullanılabilir; hukuki uyum değerlendirmesinin yerini tutmaz.", "Under KVKK Art. 12, data controllers are jointly responsible with their processors for security measures. Law No. 7545 imposes preventive, ongoing cybersecurity obligations, and BDDK rules separately require banks to assess support-service providers. CyberStep reports can serve as supporting evidence; they do not replace a legal compliance review."),
    },
    {
      q: tx("Tedarikçiysem skorumu nasıl iyileştiririm?", "I'm a supplier — how do I improve my score?"),
      a: tx("Ücretsiz taramayla bulguları görün, düzeltin ve yeniden taratın. İyi skorunuzu güven rozetiyle web sitenizde ve tekliflerinizde gösterebilirsiniz.", "Run the free scan, fix the findings and rescan. Show your good score with the trust badge on your website and proposals."),
    },
  ];

  const sev = en ? SEVERITY_EN : SEVERITY_TR;

  return (
    <div>
      {/* Hero + anında tedarikçi kontrolü */}
      <section className="py-16 md:py-24 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <img
            src={`${ROBOT_BASE}/robot/maskot.webp`} width={302} height={420}
            alt={tx("Step AI, CyberStep'in yapay zekâ destekli tarama robotu", "Step AI, CyberStep's AI-powered scanning robot")}
            className="hidden xl:block absolute right-0 top-1/2 -translate-y-1/2 w-52 h-auto drop-shadow-[0_0_40px_rgba(0,200,255,0.25)]"
          />
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>{tx("Türkiye için tedarikçi siber risk skorlaması", "Supplier cyber risk ratings for Türkiye")}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              {tx("Tedarikçilerinizin siber riskini, onlara sormadan görün.", "See your suppliers' cyber risk without asking them.")}
            </h1>
            <p className="text-lg md:text-xl text-white/80">
              {tx("CyberStep yüz binlerce Türk alan adını sürekli tarar. Tedarikçi listenizi yükleyin, her birinin skorunu, kritik açıklarını ve sektöründeki yerini dakikalar içinde görün.",
                 "CyberStep continuously scans hundreds of thousands of Turkish domains. Upload your supplier list and see each one's score, critical issues and sector ranking in minutes.")}
            </p>

            <form onSubmit={checkSupplier} className="max-w-xl mx-auto flex flex-col sm:flex-row gap-2 pt-2">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder={tx("tedarikci-firma.com.tr", "supplier-company.com")}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                aria-label={tx("Tedarikçi alan adı", "Supplier domain")}
              />
              <button
                type="submit"
                disabled={checking || !domain.trim()}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 disabled:opacity-60"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" />{tx("Tedarikçiyi kontrol et", "Check supplier")}</>}
              </button>
            </form>

            {checkError && <p className="text-sm text-red-300">{checkError}</p>}

            {checking && (
              <div className="flex items-center justify-center gap-3 text-sm text-white/80" role="status">
                <Robot name="tarama" className="h-20 w-auto" />
                <span>{tx("Step AI taranıyor…", "Step AI is scanning…")}</span>
              </div>
            )}

            {result && (
              <div className="max-w-xl mx-auto text-left rounded-xl border border-white/15 bg-white/5 p-4">
                {result.status === "scanned" && result.score != null ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-lg border-2 flex items-center justify-center text-2xl font-black ${gradeColor(result.score)}`}>
                        {result.grade}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{result.domain}</p>
                        <p className="text-sm text-white/70">
                          {result.score}/100 · {tx("Risk", "Risk")}: {result.riskLabel}
                          {result.lastScanAt && <> · {tx("Son tarama", "Last scan")}: {new Date(result.lastScanAt).toLocaleDateString(en ? "en-GB" : "tr-TR")}</>}
                        </p>
                      </div>
                      <Robot name={moodFor(result.score)} className="h-20 w-auto shrink-0" />
                    </div>
                    {result.topFindings && result.topFindings.length > 0 && (
                      <ul className="space-y-1">
                        {result.topFindings.map((f, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className={`font-semibold shrink-0 ${SEVERITY_CLS[f.severity]}`}>{sev[f.severity]}</span>
                            <span className="text-white/80">{f.title}</span>
                          </li>
                        ))}
                        {(result.findingCount ?? 0) > result.topFindings.length && (
                          <li className="text-xs text-white/50">
                            {tx(`+${(result.findingCount ?? 0) - result.topFindings.length} bulgu daha`, `+${(result.findingCount ?? 0) - result.topFindings.length} more findings`)}
                          </li>
                        )}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link href="/hesabim/tedarikci-portfoyu" className="text-sm font-medium text-primary hover:underline">
                        {tx("Portföyünüze ekleyip izleyin →", "Add to your portfolio and monitor →")}
                      </Link>
                    </div>
                  </div>
                ) : result.status === "insufficient_data" ? (
                  <p className="text-sm text-white/80">
                    {tx("Bu alan adına ulaşılamadı. Yazımı kontrol edin.", "This domain could not be reached. Please check the spelling.")}
                  </p>
                ) : (
                  <div className="text-sm text-white/80 space-y-2">
                    <p>{tx(`${result.domain} henüz veritabanımızda yok.`, `${result.domain} is not in our database yet.`)}</p>
                    <Link href={`/domain-tarama?domain=${encodeURIComponent(result.domain)}`} className="font-medium text-primary hover:underline">
                      {tx("Ücretsiz tam tarama başlat →", "Start a free full scan →")}
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/hesabim/tedarikci-portfoyu" className="inline-flex items-center justify-center rounded-md text-base font-medium bg-white text-slate-900 hover:bg-white/90 h-12 px-6">
                {tx("Tedarikçi portföyü oluştur", "Create a supplier portfolio")}
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Link>
              <Link href="/iletisim" className="inline-flex items-center justify-center rounded-md text-base font-medium border border-white/20 text-white hover:bg-white/10 h-12 px-6">
                {tx("Demo talep et", "Request a demo")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TPRM nedir */}
      <section className="py-16 bg-muted/30 border-y" id="tprm-nedir">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{tx("TPRM nedir?", "What is TPRM?")}</h2>
            <p className="text-muted-foreground mt-2 max-w-3xl mx-auto">
              {tx("TPRM (Third-Party Risk Management), iş ortaklarınızdan ve tedarikçilerinizden gelen siber riski belirleme, ölçme ve sürekli izleme yöntemidir. Kendi sisteminiz sağlam olsa bile, verinize veya sürecinize erişimi olan bir tedarikçi saldırıya uğrarsa sonuç size de yansır.",
                  "TPRM (Third-Party Risk Management) is the practice of identifying, measuring and continuously monitoring cyber risk that comes from your partners and suppliers. Even if your own systems are sound, an incident at a supplier with access to your data or processes reaches you too.")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: "1", t: tx("Belirleyin", "Identify"), d: tx("Hangi tedarikçilerin aksaması işinizi durdurur? Önce bu kritik listeyi çıkarın.", "Which suppliers would stop your business if they failed? Start by listing them.") },
              { n: "2", t: tx("Ölçün", "Measure"), d: tx("Kendi alan adlarınızı ve her tedarikçinin dışarıdan görünen güvenlik durumunu 0–100 skorla ve A–F notla görün, sektör medyanıyla karşılaştırın.", "See your own domains and each supplier's outside-in security posture as a 0–100 score and A–F grade, compared with the sector median.") },
              { n: "3", t: tx("İzleyin", "Monitor"), d: tx("Yıllık anketin yanında sürekli tarama. Skor düştüğünde veya yeni bir kritik açık çıktığında haberdar olun.", "Continuous scanning alongside the annual questionnaire. Get told when a score drops or a critical exposure appears.") },
            ].map((c) => (
              <div key={c.n} className="rounded-xl border p-5 bg-card">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mb-3">{c.n}</div>
                <p className="font-semibold">{c.t}</p>
                <p className="text-sm text-muted-foreground mt-1.5">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Neden şimdi */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-10 text-center md:text-left">
            <Robot name="alarm" className="h-28 w-auto shrink-0 bg-secondary rounded-2xl p-3" />
            <div>
              <h2 className="text-3xl font-bold">{tx("Tedarikçi riski artık sizin riskiniz", "Your suppliers' risk is your risk")}</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                {tx("Saldırganlar çoğu zaman hedefe en zayıf tedarikçiden ulaşır. Yasal yükümlülükler de bu riskin yönetilmesini bekliyor. Tek başına anketler yavaş, beyana dayalı ve hızla eskiyen bir resim veriyor; dış tarama bunu güncel veriyle tamamlıyor.",
                    "Attackers often reach their target through the weakest supplier, and regulation now expects this risk to be managed. On their own, questionnaires are slow, self-reported and quickly out of date; external scanning keeps the picture current.")}
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { t: "KVKK md. 12", d: tx("Veri sorumlusu, verileri kendi adına işleyen tedarikçilerle birlikte güvenlik tedbirlerinden müştereken sorumludur.", "Data controllers are jointly responsible with processors acting on their behalf for security measures.") },
              { t: tx("7545 sayılı Kanun", "Law No. 7545"), d: tx("Siber Güvenlik Kanunu kapsamındaki kuruluşlara önleyici ve sürekli siber güvenlik yükümlülükleri getiriyor. Tedarikçilerden gelen riski ölçmek bu sürecin doğal parçası.", "The Cybersecurity Law imposes preventive, ongoing cybersecurity obligations. Measuring risk coming from suppliers is a natural part of that.") },
              { t: tx("BDDK / DORA", "BDDK / DORA"), d: tx("Bankalar destek hizmeti sağlayıcılarının risklerini değerlendirmekle; AB'deki finans kuruluşları DORA kapsamında ICT tedarikçilerini izlemekle yükümlü.", "Turkish banks must assess their support-service providers; EU financial entities must monitor ICT third parties under DORA.") },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border p-5 bg-card">
                <p className="font-semibold">{c.t}</p>
                <p className="text-sm text-muted-foreground mt-1.5">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tedarikçi tanımı */}
      <section className="py-16 bg-muted/30 border-y" id="tedarikci-tanimi">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold">{tx("Hangi tedarikçiler kapsamda?", "Which suppliers are in scope?")}</h2>
            <p className="text-muted-foreground mt-2 max-w-3xl mx-auto">
              {tx("CyberStep'te tedarikçi, bir siber olay yaşadığında sizin operasyonunuzu, verilerinizi veya müşterilerinizi etkileyebilecek iş ortağıdır. Ölçüt alım hacmi ya da sıklığı değil, bağımlılık ve etkidir.",
                  "In CyberStep, a supplier is a business partner whose cyber incident could affect your operations, your data or your customers. The test is dependency and impact, not purchase volume or frequency.")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Network, t: tx("Veri ve API sağlayıcıları", "Data and API providers"), d: tx("Sistemlerinize API ile veri akıtan ya da sizden veri alan firmalar. Onların kesintisi veya ele geçirilmesi doğrudan size yansır.", "Firms that feed data into your systems through an API, or receive data from you. Their outage or compromise reaches you directly.") },
              { icon: Building2, t: tx("Üretim ve yan sanayi", "Production and sub-suppliers"), d: tx("Üretiminiz için parça, hammadde veya hizmet aldığınız firmalar. Siber saldırıyla durdukları gün sizin hattınız da durabilir.", "Firms supplying parts, materials or services for your production. The day a cyberattack stops them, your line can stop too.") },
              { icon: Globe2, t: tx("Bulut ve yazılım hizmetleri", "Cloud and software services"), d: tx("ERP, CRM, barındırma, ödeme veya e-posta gibi iş sürecinizi taşıyan hizmetler.", "Services that carry your business process, such as ERP, CRM, hosting, payments or e-mail.") },
              { icon: Lock, t: tx("Veri işleyenler ve erişimi olanlar", "Data processors and firms with access"), d: tx("Müşteri veya çalışan verisini sizin adınıza işleyen, ya da entegratör ve uzaktan bakım gibi sistemlerinize erişimi olan firmalar.", "Firms that process customer or employee data on your behalf, or that have access to your systems, such as integrators and remote maintenance.") },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border p-5 bg-card flex gap-4">
                <c.icon className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{c.t}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">{c.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-primary/40 p-5 bg-card">
              <p className="font-semibold">{tx("Tek soru yeterli", "One question is enough")}</p>
              <p className="text-sm text-muted-foreground mt-1.5">
                {tx("Bu firma bir siber olay yaşarsa işim, verim veya müşterilerim etkilenir mi? Cevap evetse tedarikçiniz kapsamdadır.",
                    "If this firm suffers a cyber incident, would my business, my data or my customers be affected? If yes, it is in scope.")}
              </p>
            </div>
            <div className="rounded-xl border p-5 bg-card">
              <p className="font-semibold">{tx("Kapsam dışı", "Out of scope")}</p>
              <p className="text-sm text-muted-foreground mt-1.5">
                {tx("Birkaç kez alım yaptığınız, bir siber olayın operasyonunuzu etkilemeyeceği firmalar. Bunları portföye eklemeyin; skorları anlamlı bir karar üretmez ve paket kotanızı harcar. Önce kritik tedarikçilerle başlayın.",
                    "Firms you have bought from a few times, whose cyber incident would not affect your operations. Leave them out: their scores drive no real decision and use up your plan quota. Start with your critical suppliers.")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-10">{tx("Nasıl çalışır?", "How it works")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Neyi ölçüyoruz */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold">{tx("Skor neyi ölçer?", "What the score measures")}</h2>
            <p className="text-muted-foreground mt-2">
              {tx("Yalnızca dışarıdan görülebilen, doğrulanabilir sinyaller. Ölçülemeyen hiçbir şey “temiz” sayılmaz.",
                  "Only verifiable, externally observable signals. Nothing unmeasured is counted as clean.")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(({ icon: Icon, label, pts, note }) => (
              <div key={label} className="rounded-xl border p-4 flex gap-3 items-start">
                <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{label}</p>
                    <Badge variant="outline" className="text-[10px]">{pts} {tx("puan", "pts")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center mt-6">
            <Link href="/metodoloji" className="text-sm font-medium text-primary hover:underline">
              {tx("Metodolojinin tamamı →", "Full methodology →")}
            </Link>
          </p>
        </div>
      </section>

      {/* Kimler için */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-10">{tx("Kimler için?", "Who it's for")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {audiences.map(({ icon: Icon, href, title, text }) => (
              <Link key={href} href={href} className="rounded-xl border bg-card p-5 hover:border-primary/50 transition-colors block">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="font-semibold">{title}</p>
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-2">{text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Neler alırsınız */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h2 className="text-3xl font-bold">{tx("Portföyün tamamı tek ekranda", "Your whole portfolio on one screen")}</h2>
              <ul className="mt-6 space-y-5">
                {[
                  { t: tx("Sektör kıyaslaması", "Sector benchmark"), d: tx("Her tedarikçinin sektöründeki yüzdelik dilimi.", "Each supplier's percentile within its sector.") },
                  { t: tx("Akıllı uyarılar", "Smart alerts"), d: tx("Kritik bulgu veya skor düşüşünde tek özet e-posta.", "One summary e-mail on a critical finding or score drop.") },
                  { t: tx("Portföy PDF raporu", "Portfolio PDF report"), d: tx("KVKK ve 7545 denetimlerine hazır kanıt raporu.", "Evidence report ready for KVKK and Law 7545 audits.") },
                  { t: tx("Risk Skoru API", "Risk Score API"), d: tx("Satın alma ve poliçe sistemlerine doğrudan veri (Kurumsal).", "Feed purchasing and underwriting systems directly (Enterprise).") },
                ].map((i) => (
                  <li key={i.t} className="flex gap-3">
                    <BadgeCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{i.t}</p>
                      <p className="text-sm text-muted-foreground">{i.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <Robot name="rapor" className="h-72 w-auto shrink-0 bg-secondary rounded-2xl p-5" />
          </div>
        </div>
      </section>

      {/* Tedarikçiler için güven rozeti */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center">
            <Robot name="zafer" className="h-28 w-auto shrink-0 bg-secondary rounded-2xl p-3" />
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-bold">{tx("Tedarikçi misiniz? Skorunuzu kanıtlayın.", "Are you a supplier? Prove your score.")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tx("Ücretsiz tarayın, açıkları kapatın, doğrulanmış güven rozetinizi web sitenize ve tekliflerinize ekleyin. Müşterileriniz sizi CyberStep'te zaten görüyor olabilir.",
                    "Scan for free, fix the gaps and add your verified trust badge to your website and proposals. Your customers may already be looking at you on CyberStep.")}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link href="/domain-tarama" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5">
                {tx("Ücretsiz tara", "Scan for free")}
              </Link>
              <Link href="/guven-rozeti" className="text-sm text-center text-primary hover:underline">
                {tx("Güven rozeti", "Trust badge")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ücretsiz araçlar */}
      <section className="py-14 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-2xl font-bold">{tx("Ücretsiz güvenlik araçları", "Free security tools")}</h2>
            <Link href="/araclar" className="text-sm font-medium text-primary hover:underline">{tx("Tüm araçlar →", "All tools →")}</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {tools.map((t) => (
              <Link key={t.href} href={t.href} className="rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:border-primary/50 transition-colors flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-primary shrink-0" />
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SSS */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-8">{tx("Sık sorulan sorular", "Frequently asked questions")}</h2>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl border">
                <button
                  className="w-full flex items-center justify-between gap-3 text-left px-5 py-4 font-medium"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {f.q}
                  {openFaq === i ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </button>
                {openFaq === i && <p className="px-5 pb-4 text-sm text-muted-foreground">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Son CTA */}
      <section className="py-16 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-4">
          <Robot name="mutlu" className="h-28 w-auto mx-auto" />
          <h2 className="text-3xl font-bold text-white">{tx("İlk tedarikçi listenizi bugün yükleyin", "Upload your first supplier list today")}</h2>
          <p className="text-white/70">
            {tx("Kurulum yok, tedarikçiden onay gerekmiyor. Excel listenizle başlayın.", "No setup, no supplier consent needed. Start with your Excel list.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/hesabim/tedarikci-portfoyu" className="inline-flex items-center justify-center rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6">
              {tx("Ücretsiz başla", "Start free")}
            </Link>
            <Link href="/fiyatlar" className="inline-flex items-center justify-center rounded-md font-medium border border-white/20 text-white hover:bg-white/10 h-12 px-6">
              {tx("Paketler ve fiyatlar", "Plans & pricing")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
