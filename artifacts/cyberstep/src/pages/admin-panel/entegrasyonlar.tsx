import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp,
  Save, Eye, EyeOff, Shield, Zap, Globe, Mail, Brain, Server, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";

interface IntegrationDef {
  id: string;
  name: string;
  category: string;
  icon: string;
  cost: "free" | "freemium" | "paid" | "varies";
  costLabel: string;
  costNote?: string;
  envKey?: string;
  always: boolean;
  desc: string;
  why: string;
  how: string;
  setup?: string;
  docs?: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  // ─── Tehdit İstihbaratı ─────────────────────────────────────────────────────
  {
    id: "cisa-kev", name: "CISA KEV", category: "Tehdit İstihbaratı", icon: "🏛️",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "ABD Siber Güvenlik Ajansı'nın aktif fidye ve APT saldırılarında kullanıldığını doğruladığı ~1.100 CVE kataloğu",
    why: "Teorik açıkları değil, gerçekten istismar edilenleri gösterir. CISA KEV'deki bir CVE varsa müşteri için en kritik uyarıdır.",
    how: "Shadow IT ile tespit edilen yazılımlarla (WordPress, Apache, jQuery vb.) eşleştirilir. Sunucu başlangıcında indirilir, 24 saatte bir yenilenir.",
    setup: "Kurulum gerekmez. cisa.gov'dan JSON olarak indirilir.",
    docs: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  },
  {
    id: "urlhaus", name: "URLhaus (Abuse.ch)", category: "Tehdit İstihbaratı", icon: "🔗",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "200.000+ zararlı URL ve alan adının anlık kara listesi — fidye yazılımı ve malware dağıtım noktaları",
    why: "Sitenin zararlı içerik dağıtımında kullanılıp kullanılmadığını doğrular. E-posta filtrelerinden geçen phishing linkleri dahil.",
    how: "Her domain taramasında anlık olarak sorgulanır. Eşleşme varsa tarama raporunda kırmızı uyarı olarak gösterilir.",
    setup: "Kurulum gerekmez. urlhaus-api.abuse.ch açık API'si kullanılır.",
    docs: "https://urlhaus-api.abuse.ch/",
  },
  {
    id: "feodo-tracker", name: "Feodo Tracker (Abuse.ch)", category: "Tehdit İstihbaratı", icon: "🤖",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Emotet, TrickBot, IcedID, QakBot gibi aktif botnet C2 (komuta-kontrol) sunucularının IP listesi",
    why: "Sitenin barındığı IP adresi botnet altyapısıyla ilişkiliyse saldırganlar sistemi zaten kontrol altında tutabilir.",
    how: "Domain IP'leri DNS ile çözümlenerek botnet C2 listesiyle karşılaştırılır. Liste 6 saatte bir yenilenir.",
    setup: "Kurulum gerekmez. feodotracker.abuse.ch'den JSON olarak indirilir.",
    docs: "https://feodotracker.abuse.ch/",
  },
  {
    id: "threatfox", name: "ThreatFox (Abuse.ch)", category: "Tehdit İstihbaratı", icon: "🦊",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "APT grupları ve fidye çeteleriyle ilişkili IOC veritabanı — 1M+ güvenlik ihlali göstergesi",
    why: "Domain veya IP'nin bilinen siber saldırı altyapısıyla bağlantısını tespit eder. Cobalt Strike, LockBit, Emotet gibi malware grouplarını yakalar.",
    how: "Her taramada domain ThreatFox IOC veritabanında sorgulanır. Eşleşme varsa tehdit tipi ve malware adı rapora eklenir.",
    setup: "Kurulum gerekmez. Auth-Key: anonymous ile ücretsiz kullanılır.",
    docs: "https://threatfox.abuse.ch/api/",
  },
  {
    id: "usom", name: "USOM", category: "Tehdit İstihbaratı", icon: "🇹🇷",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "BTK/USOM (Ulusal Siber Olaylara Müdahale Merkezi) Türkiye siber tehdit kara listesi",
    why: "Uluslararası listelerde görünmeyebilecek Türkiye'ye özgü tehditleri yakalar. BTK'nın zararlı olarak işaretlediği domain'leri kontrol eder.",
    how: "Domain taramasında USOM kara listesiyle anlık eşleştirme yapılır. Türkiye odaklı rakip analiz için kritik veri kaynağı.",
    setup: "Kurulum gerekmez. usom.gov.tr'den çekilir, önbelleğe alınır.",
    docs: "https://www.usom.gov.tr/",
  },
  // ─── İtibar & Kötücül Yazılım ──────────────────────────────────────────────
  {
    id: "virustotal", name: "VirusTotal", category: "İtibar & Kötücül Yazılım", icon: "🦠",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 500 istek/gün | Premium: $30/ay",
    envKey: "VIRUSTOTAL_API_KEY", always: false,
    desc: "70+ antivirüs motorunun domain/IP taraması — Google altyapısı üzerinde çalışır",
    why: "Tek bir kara listeye güvenmek yerine Kaspersky, Sophos, Crowdstrike gibi 70 farklı güvenlik firmasının analizini tek API ile toplar.",
    how: "Tarama sonucunda 'VirusTotal İtibar' kartında zararlı/şüpheli motor sayısı ve genel itibar puanı gösterilir.",
    setup: "1. virustotal.com'da ücretsiz hesap açın  2. Sağ üst menü → API Keys  3. Anahtarı kopyalayıp aşağıya yapıştırın.",
    docs: "https://developers.virustotal.com/",
  },
  {
    id: "google-sb", name: "Google Safe Browsing", category: "İtibar & Kötücül Yazılım", icon: "🛡️",
    cost: "free", costLabel: "Ücretsiz", costNote: "10.000 istek/gün ücretsiz",
    envKey: "GOOGLE_SAFE_BROWSING_API_KEY", always: false,
    desc: "Chrome/Firefox/Safari'nin güvensiz işaretlediği domain listesi — 4 milyar kullanıcı verisiyle beslenir",
    why: "En geniş kapsamlı gerçek kullanıcı tabanlı phishing ve malware tespiti. GSB'de işaretli domain Chrome'da doğrudan uyarı gösterir.",
    how: "Domain GSB Lookup API'siyle sorgulanır. 'Phishing', 'Malware', 'Unwanted Software' kategorilerinde eşleşme varsa raporda gösterilir.",
    setup: "1. console.cloud.google.com → Proje oluşturun  2. Safe Browsing API'yi etkinleştirin  3. Credentials → Create API Key.",
    docs: "https://developers.google.com/safe-browsing/v4/get-started",
  },
  {
    id: "abuseipdb", name: "AbuseIPDB", category: "İtibar & Kötücül Yazılım", icon: "🚨",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 1.000/gün | Basic: $20/ay",
    envKey: "ABUSEIPDB_API_KEY", always: false,
    desc: "Spam, brute-force ve DDoS saldırılarında kullanılan IP adreslerinin küresel raporlama veritabanı",
    why: "Mail sunucusu IP'si kara listedeyse e-postalar spam kutusuna düşer. Web sunucusu IP'si kötü itibarına sahipse SEO'yu olumsuz etkiler.",
    how: "Domain'in MX ve A kayıtlarındaki IP'ler sorgulanır. Abuse skoru ve rapor sayısı 'AbuseIPDB' kartında gösterilir.",
    setup: "1. abuseipdb.com'da ücretsiz hesap açın  2. Account → API Keys → Create Key  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://www.abuseipdb.com/api.html",
  },
  {
    id: "otx", name: "AlienVault OTX", category: "İtibar & Kötücül Yazılım", icon: "👁️",
    cost: "free", costLabel: "Ücretsiz", costNote: "Tamamen ücretsiz",
    envKey: "OTX_API_KEY", always: false,
    desc: "200.000+ güvenlik araştırmacısının katkısıyla oluşan küresel tehdit istihbarat platformu",
    why: "Domain'in kaç aktif tehdit kampanyasında görüntülendiğini ve Türkiye'ye hedefli saldırılarla ilişkisini ortaya çıkarır.",
    how: "OTX Indicators API sorgulanır. Pulse sayısı, TR hedefli saldırı sayısı ve domain itibar puanı tarama raporuna eklenir.",
    setup: "1. otx.alienvault.com'a ücretsiz kayıt olun  2. Profil → API Key  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://otx.alienvault.com/api/",
  },
  {
    id: "greynoise", name: "GreyNoise", category: "İtibar & Kötücül Yazılım", icon: "📡",
    cost: "freemium", costLabel: "Freemium", costNote: "Community: Ücretsiz 1.000/gün | Teams: $99/ay",
    envKey: "GREYNOISE_API_KEY", always: false,
    desc: "İnternet genelinde port tarama yapan botları gerçek hedefli saldırganlardan ayıran IP niyeti analiz platformu",
    why: "'Bu IP bizi hedef alıyor mu yoksa sadece genel internet taraması mı yapıyor?' sorusunu yanıtlar. Yanlış alarmları dramatik azaltır.",
    how: "Shodan ile tespit edilen IP'lerin niyeti sınıflandırılır (noise/benign/malicious). Raporda saldırı niyeti gösterilir.",
    setup: "1. greynoise.io'da ücretsiz Community hesabı açın  2. Account → API Keys  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://docs.greynoise.io/",
  },
  // ─── Altyapı & Açık Yönetimi ───────────────────────────────────────────────
  {
    id: "shodan", name: "Shodan", category: "Altyapı & Açık Yönetimi", icon: "🔍",
    cost: "paid", costLabel: "Ücretli", costNote: "Free (çok sınırlı) | Member: $49/ay",
    envKey: "SHODAN_API_KEY", always: false,
    desc: "Tüm internetin port ve servis haritası — açık portlar, çalışan yazılımlar, donanım parmak izi",
    why: "Müşterinin bilmediği açık portları (RDP:3389, MongoDB:27017, Elasticsearch:9200) tespit eder. Veri sızdıran açık veritabanları sık bulunan kritik açık.",
    how: "Domain IP'si Shodan'da sorgulanır. Açık port listesi, ülke/ISP bilgisi ve bilinen CVE sayısı 'Shodan' kartında gösterilir.",
    setup: "1. shodan.io'da hesap açın  2. Account → Overview → API Key  3. Member plan ($49/ay) tam API erişimi için gerekli.",
    docs: "https://developer.shodan.io/api",
  },
  {
    id: "whoisxml", name: "WhoisXML API", category: "Altyapı & Açık Yönetimi", icon: "📋",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 1.000/ay | Basic: $29/ay",
    envKey: "WHOISXML_API_KEY", always: false,
    desc: "Domain kayıt geçmişi, sahiplik değişiklikleri ve DNS geçmişi — Domain Hijacking tespiti",
    why: "Domain el değiştirmişse veya DNS'i manipüle edilmişse müşteri habersiz olabilir. Domain Hijacking KOBİ'ler için giderek artan tehdit.",
    how: "WHOIS geçmişi sorgulanır. Sahiplik değişikliği veya şüpheli DNS manipülasyonu tespit edilirse rapora uyarı eklenir.",
    setup: "1. whoisxmlapi.com'da ücretsiz hesap açın  2. My Products → API Key  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://whois.whoisxmlapi.com/documentation/making-queries",
  },
  // ─── Protokol & Sertifika ──────────────────────────────────────────────────
  {
    id: "ssllabs", name: "Qualys SSL Labs", category: "Protokol & Sertifika", icon: "🔐",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "TLS protokol versiyonu, şifre zayıflığı, sertifika zinciri ve HSTS kontrolü — endüstri standardı değerlendirmesi",
    why: "A+ ile F arasında bağımsız harf notu verir. PCI-DSS uyumluluk için SSL notunun A olması zorunlu. Müşteri bankadan 'sertifikanız zayıf' uyarısı almadan önce tespit eder.",
    how: "SSLLabs önbellekten not alınır (24 saatlik cache). Tarama raporunda 'SSLLabs Notu' başlığında gösterilir.",
    setup: "Kurulum gerekmez. api.ssllabs.com açık ve ücretsizdir.",
    docs: "https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md",
  },
  {
    id: "mozilla-obs", name: "Mozilla Observatory", category: "Protokol & Sertifika", icon: "🦊",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "HTTP Güvenlik Başlıkları analizi — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy değerlendirmesi",
    why: "SSLLabs ile tamamlayıcı: SSL/TLS değil HTTP katmanı başlıklarının güvenliğini ölçer. Eksik CSP başlığı XSS saldırılarının kapısını açar.",
    how: "Her taramada Observatory API sorgulanır. A-F arası harf notu ve başarısız test sayısı rapora eklenir.",
    setup: "Kurulum gerekmez. Tamamen ücretsiz Mozilla API'si.",
    docs: "https://observatory.mozilla.org/",
  },
  {
    id: "nvd-cve", name: "NVD CVE (NIST)", category: "Protokol & Sertifika", icon: "🐛",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "ABD Ulusal Güvenlik Açığı Veritabanı — 200.000+ CVE kaydı, CVSS kritiklik puanları",
    why: "Shadow IT ile tespit edilen yazılımların (WordPress eklenti versiyonu, jQuery sürümü vb.) bilinen açıklarını tek tek tarar.",
    how: "Tespit edilen servisler için NVD'de CVE araması yapılır. Yüksek CVSS puanlı açıklar rapora öncelikli olarak eklenir.",
    setup: "Kurulum gerekmez. nvd.nist.gov API'si ücretsizdir.",
    docs: "https://nvd.nist.gov/developers/vulnerabilities",
  },
  {
    id: "epss", name: "EPSS (FIRST.org)", category: "Protokol & Sertifika", icon: "📊",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "CVE başına gerçek dünya istismar olasılığı puanı — 'Bu açık önümüzdeki 30 günde kullanılma ihtimali %94'",
    why: "NVD'nin CVSS puanı teorik şiddet ölçer; EPSS gerçek saldırı verilerinden makine öğrenimiyle hesaplanır. Önceliklendirmeyi tamamen değiştirir.",
    how: "NVD'den alınan CVE'ler EPSS API'siyle zenginleştirilir. Her CVE için istismar olasılığı yüzdesi ve percentile rapora eklenir.",
    setup: "Kurulum gerekmez. api.first.org tamamen ücretsizdir.",
    docs: "https://www.first.org/epss/api",
  },
  {
    id: "crt-sh", name: "crt.sh (CT Logs)", category: "Protokol & Sertifika", icon: "📜",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Sertifika Şeffaflığı günlükleri — domain'e ait tüm alt alanları ve sertifika geçmişini ortaya çıkarır",
    why: "Yöneticinin habersiz açılan subdomain'leri (eski test sunucusu, terk edilmiş proje) tespit eder. Bu subdomain'ler genellikle korumasız bırakılır.",
    how: "crt.sh sorgusu ile domain'e ait tüm sertifikalar listelenir. Alt domain keşfi ve shadow asset tespiti için kullanılır.",
    setup: "Kurulum gerekmez.",
    docs: "https://crt.sh/",
  },
  // ─── E-posta & Kimlik ──────────────────────────────────────────────────────
  {
    id: "hibp", name: "Have I Been Pwned", category: "E-posta & Kimlik", icon: "💀",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Domain'e ait e-posta adreslerinin 750+ veri sızıntısında yer alıp almadığını kontrol eder",
    why: "Çalışan kimlik bilgilerinin dark web'de bulunması hesap ele geçirme riskini dramatik artırır. LinkedIn, Adobe, RockYou sızıntıları hâlâ aktif olarak kullanılıyor.",
    how: "Domain HIBP API'siyle sorgulanır. Kaç sızıntıda kaç hesap bulunduğu ve hangi sızıntılar olduğu raporda gösterilir.",
    setup: "Kurulum gerekmez.",
    docs: "https://haveibeenpwned.com/API/v3",
  },
  {
    id: "spf-dmarc", name: "SPF / DMARC / DKIM", category: "E-posta & Kimlik", icon: "✉️",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "E-posta kimlik doğrulama kayıtları — phishing ve e-posta sahteciliği (spoofing) tespiti",
    why: "Bu kayıtlar eksikse saldırganlar şirket adına sahte e-posta gönderebilir. CEO fraud saldırılarının %91'i e-posta sahteciliğiyle başlar.",
    how: "DNS MX, TXT kayıtları sorgulanarak SPF/DMARC/DKIM analiz edilir. Eksik veya yanlış yapılandırmalar kırmızı ile işaretlenir.",
    setup: "Kurulum gerekmez.",
    docs: "https://dmarcian.com/what-is-spf/",
  },
  {
    id: "dnsbl", name: "DNSBL Kara Listeleri", category: "E-posta & Kimlik", icon: "🚫",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Spamhaus, Barracuda, SORBS, SpamCop gibi 15+ DNS tabanlı kara listede IP ve domain kontrolü",
    why: "Kara listedeki mail sunucusunun gönderdiği e-postalar otomatik spam kutusuna düşer. Müşteri sözleşme e-postasını karşı tarafın görmediğini düşünün.",
    how: "Domain ve MX IP'leri 15+ DNSBL listesine DNS sorgusuyla kontrol edilir. Kara listede görünme durumu ve hangi liste olduğu gösterilir.",
    setup: "Kurulum gerekmez. DNS sorguları ile çalışır.",
    docs: "https://www.spamhaus.org/lookup/",
  },
  // ─── Yapay Zeka ────────────────────────────────────────────────────────────
  {
    id: "gemini-ai", name: "Gemini 2.5 Flash", category: "Yapay Zeka", icon: "🤖",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Google'ın en güncel AI modeli — tüm tarama bulgularından kişiselleştirilmiş Türkçe risk raporu üretir",
    why: "Ham güvenlik verilerini (port numaraları, CVE ID'leri) CEO'nun anlayabileceği aksiyona dönüştürülebilir Türkçe rapora çevirir.",
    how: "Assessment tamamlanınca tüm bulgular Gemini'ye gönderilir. Sektöre özel, risk öncelikli Türkçe rapor streaming ile oluşturulur.",
    setup: "Replit AI Integrations tarafından otomatik sağlanır. Ek kurulum gerekmez.",
    docs: "https://ai.google.dev/",
  },
  // ─── İletişim ──────────────────────────────────────────────────────────────
  {
    id: "smtp", name: "SMTP E-posta", category: "İletişim", icon: "📧",
    cost: "varies", costLabel: "Değişken", always: false,
    desc: "Bülten, rapor ve güvenlik bildirimi e-postalarının gönderimi",
    why: "Müşterilere 30 günlük yeniden tarama raporu, skor değişikliği bildirimi ve güvenlik uyarıları göndermek için gerekli.",
    how: "Nodemailer ile yapılandırılmış SMTP sunucusu üzerinden tüm sistem e-postaları gönderilir.",
    setup: "Replit Secrets'a SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ortam değişkenlerini ekleyin.",
  },
  {
    id: "isr-imap", name: "ISR IMAP (AI Satış Asistanı)", category: "İletişim", icon: "🧠",
    cost: "free", costLabel: "Ücretsiz", always: false,
    desc: "AI Satış Asistanı'nın gelen kutusunu okuyarak potansiyel müşteri e-postalarına otomatik Türkçe yanıt vermesi",
    why: "7/24 çalışan AI satış temsilcisi — potansiyel müşteri e-postasını 5 dakika içinde yanıtlar, kapanma oranını artırır.",
    how: "Her 5 dakikada bir IMAP'ten e-posta okunur, Gemini AI ile bağlam bilinçli Türkçe yanıt oluşturulur ve SMTP ile gönderilir.",
    setup: "Replit Secrets'a ISR_IMAP_HOST, ISR_IMAP_PORT, ISR_IMAP_USER, ISR_IMAP_PASS ekleyin.",
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Tehdit İstihbaratı": Shield,
  "İtibar & Kötücül Yazılım": Zap,
  "Altyapı & Açık Yönetimi": Server,
  "Protokol & Sertifika": Lock,
  "E-posta & Kimlik": Mail,
  "Yapay Zeka": Brain,
  "İletişim": Globe,
};

const COST_COLORS: Record<string, string> = {
  free:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  freemium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  paid:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
  varies:   "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const CATEGORIES = [
  "Tümü",
  "Tehdit İstihbaratı",
  "İtibar & Kötücül Yazılım",
  "Altyapı & Açık Yönetimi",
  "Protokol & Sertifika",
  "E-posta & Kimlik",
  "Yapay Zeka",
  "İletişim",
];

export default function AdminEntegrasyonlar() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("Tümü");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const { data: apiKeys = {} } = useQuery<Record<string, boolean>>({
    queryKey: ["admin-apikeys"],
    queryFn: () => fetch("/api/admin-panel/settings/apikeys", { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: ({ envKey, value }: { envKey: string; value: string }) =>
      fetch("/api/admin-panel/settings/apikeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ envKey, value }),
      }).then(r => r.json()),
    onSuccess: (data, { envKey }) => {
      qc.invalidateQueries({ queryKey: ["admin-apikeys"] });
      qc.invalidateQueries({ queryKey: ["admin-ext-services"] });
      setKeyInputs(prev => ({ ...prev, [envKey]: "" }));
      toast({
        title: data.active ? "API anahtarı kaydedildi" : "API anahtarı silindi",
        description: data.active ? "Servis bir sonraki taramadan itibaren aktif olacak." : "Servis devre dışı bırakıldı.",
      });
    },
    onError: () => toast({ title: "Hata", description: "Kaydetme başarısız.", variant: "destructive" }),
  });

  const isActive = (integration: IntegrationDef): boolean => {
    if (integration.always) return true;
    if (!integration.envKey) return false;
    return !!apiKeys[integration.envKey];
  };

  const filtered = activeCategory === "Tümü"
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeCategory);

  const totalActive = INTEGRATIONS.filter(i => isActive(i)).length;
  const totalNeedsConfig = INTEGRATIONS.filter(i => !isActive(i) && !!i.envKey).length;

  const categories = Object.keys(
    INTEGRATIONS.reduce<Record<string, true>>((acc, i) => { acc[i.category] = true; return acc; }, {})
  );

  return (
    <AdminLayout title="Entegrasyon Merkezi" description="Tüm güvenlik veri kaynakları, API bağlantıları ve servis durumları">
      <div className="max-w-5xl space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Toplam Entegrasyon", value: INTEGRATIONS.length, color: "text-white" },
            { label: "Aktif Servis", value: totalActive, color: "text-emerald-400" },
            { label: "API Anahtarı Bekliyor", value: totalNeedsConfig, color: "text-amber-400" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="bg-slate-800 border-slate-700">
              <CardContent className="pt-4 pb-4 text-center">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-400 text-xs mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter(c => c === "Tümü" || categories.includes(c)).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeCategory === cat
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Integration cards grouped by category */}
        {(activeCategory === "Tümü" ? categories : [activeCategory]).map(cat => {
          const items = filtered.filter(i => i.category === cat);
          if (items.length === 0) return null;
          const CatIcon = CATEGORY_ICONS[cat] ?? Shield;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <CatIcon className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{cat}</h2>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {items.map(integration => {
                  const active = isActive(integration);
                  const expanded = expandedId === integration.id;
                  const hasKey = !!integration.envKey;
                  const inputVal = keyInputs[integration.envKey ?? ""] ?? "";
                  const visible = !!showKey[integration.envKey ?? ""];

                  return (
                    <Card
                      key={integration.id}
                      className={`bg-slate-800 border transition-colors ${active ? "border-slate-700" : hasKey ? "border-amber-800/40" : "border-slate-700"}`}
                    >
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl shrink-0">{integration.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5 mb-1">
                              <span className="text-white font-semibold text-sm">{integration.name}</span>
                              {active
                                ? <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle className="h-3 w-3" /> Aktif
                                  </span>
                                : hasKey
                                  ? <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-700/40">
                                      <XCircle className="h-3 w-3" /> API Anahtarı Gerekli
                                    </span>
                                  : <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 border border-slate-600">
                                      Yapılandırma Gerekli
                                    </span>}
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${COST_COLORS[integration.cost]}`}>
                                {integration.costLabel}
                              </span>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">{integration.desc}</p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="px-4 pb-4 pt-0 space-y-3">
                        {integration.costNote && (
                          <p className="text-xs text-slate-500 italic">{integration.costNote}</p>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-slate-900/60 p-2.5">
                            <p className="text-xs font-medium text-slate-300 mb-1">Neden Değerli?</p>
                            <p className="text-xs text-slate-500 leading-relaxed">{integration.why}</p>
                          </div>
                          <div className="rounded-md bg-slate-900/60 p-2.5">
                            <p className="text-xs font-medium text-slate-300 mb-1">Nasıl Katkı Sağlar?</p>
                            <p className="text-xs text-slate-500 leading-relaxed">{integration.how}</p>
                          </div>
                        </div>

                        {(hasKey || (integration.setup && !integration.always)) && (
                          <button
                            onClick={() => setExpandedId(expanded ? null : integration.id)}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors font-medium"
                          >
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {hasKey ? (active ? "API Anahtarını Güncelle / Sil" : "API Anahtarını Yapılandır") : "Kurulum Rehberi"}
                          </button>
                        )}

                        {expanded && (
                          <div className="space-y-3 rounded-lg bg-slate-900 border border-slate-700 p-3">
                            {integration.setup && (
                              <div>
                                <p className="text-xs font-medium text-slate-300 mb-1.5">Kurulum Adımları</p>
                                <p className="text-xs text-slate-400 whitespace-pre-line leading-relaxed">{integration.setup}</p>
                              </div>
                            )}

                            {integration.docs && (
                              <a
                                href={integration.docs}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline font-medium"
                              >
                                <ExternalLink className="h-3 w-3" /> Resmi Dokümantasyon
                              </a>
                            )}

                            {hasKey && integration.envKey && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-300">
                                  {active ? "Mevcut anahtar aktif — değiştirmek için yeni anahtar girin, silmek için boş bırakıp kaydedin" : "API Anahtarı"}
                                </p>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      type={visible ? "text" : "password"}
                                      placeholder={active ? "Yeni anahtar (değiştirmek için)" : `${integration.envKey} değerini girin`}
                                      value={inputVal}
                                      onChange={e => setKeyInputs(prev => ({ ...prev, [integration.envKey!]: e.target.value }))}
                                      className="bg-slate-800 border-slate-600 text-white text-xs font-mono pr-8"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowKey(prev => ({ ...prev, [integration.envKey!]: !prev[integration.envKey!] }))}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    >
                                      {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => saveMutation.mutate({ envKey: integration.envKey!, value: inputVal })}
                                    disabled={saveMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-xs shrink-0"
                                  >
                                    <Save className="h-3.5 w-3.5 mr-1" />
                                    {inputVal === "" && active ? "Sil" : "Kaydet"}
                                  </Button>
                                </div>
                                <p className="text-xs text-slate-600">
                                  Ortam değişken adı: <code className="text-slate-500">{integration.envKey}</code>
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">
            <strong className="text-slate-300">Not:</strong> API anahtarları veritabanında güvenli olarak saklanır ve sunucu ortam değişkenlerine yüklenir.
            Girilen anahtarlar şifreli bağlantı üzerinden iletilir. Anahtarları Replit Secrets'a da ekleyebilirsiniz — her iki yöntem de desteklenir.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
