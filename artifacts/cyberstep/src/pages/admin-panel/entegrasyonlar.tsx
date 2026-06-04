import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp,
  Save, Eye, EyeOff, Shield, Zap, Globe, Mail, Brain, Server, Lock, Bot,
  CreditCard, Settings, SlidersHorizontal, Radar, Network, Cpu, Calendar, Bell,
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
  type: "security" | "platform";
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
  superAdminOnly?: boolean;
}

const INTEGRATIONS: IntegrationDef[] = [
  // ─── Tehdit İstihbaratı ─────────────────────────────────────────────────────
  {
    id: "cisa-kev", name: "CISA KEV", category: "Tehdit İstihbaratı", type: "security", icon: "🏛️",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "ABD Siber Güvenlik Ajansı'nın aktif fidye ve APT saldırılarında kullanıldığını doğruladığı ~1.100 CVE kataloğu",
    why: "Teorik açıkları değil, gerçekten istismar edilenleri gösterir. CISA KEV'deki bir CVE varsa müşteri için en kritik uyarıdır.",
    how: "Shadow IT ile tespit edilen yazılımlarla (WordPress, Apache, jQuery vb.) eşleştirilir. Sunucu başlangıcında indirilir, 24 saatte bir yenilenir.",
    setup: "Kurulum gerekmez. cisa.gov'dan JSON olarak indirilir.",
    docs: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  },
  {
    id: "urlhaus", name: "URLhaus (Abuse.ch)", category: "Tehdit İstihbaratı", type: "security", icon: "🔗",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "200.000+ zararlı URL ve alan adının anlık kara listesi — fidye yazılımı ve malware dağıtım noktaları",
    why: "Sitenin zararlı içerik dağıtımında kullanılıp kullanılmadığını doğrular. E-posta filtrelerinden geçen phishing linkleri dahil.",
    how: "Her domain taramasında anlık olarak sorgulanır. Eşleşme varsa tarama raporunda kırmızı uyarı olarak gösterilir.",
    setup: "Kurulum gerekmez. urlhaus-api.abuse.ch açık API'si kullanılır.",
    docs: "https://urlhaus-api.abuse.ch/",
  },
  {
    id: "feodo-tracker", name: "Feodo Tracker (Abuse.ch)", category: "Tehdit İstihbaratı", type: "security", icon: "🤖",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Emotet, TrickBot, IcedID, QakBot gibi aktif botnet C2 (komuta-kontrol) sunucularının IP listesi",
    why: "Sitenin barındığı IP adresi botnet altyapısıyla ilişkiliyse saldırganlar sistemi zaten kontrol altında tutabilir.",
    how: "Domain IP'leri DNS ile çözümlenerek botnet C2 listesiyle karşılaştırılır. Liste 6 saatte bir yenilenir.",
    setup: "Kurulum gerekmez. feodotracker.abuse.ch'den JSON olarak indirilir.",
    docs: "https://feodotracker.abuse.ch/",
  },
  {
    id: "threatfox", name: "ThreatFox (Abuse.ch)", category: "Tehdit İstihbaratı", type: "security", icon: "🦊",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "APT grupları ve fidye çeteleriyle ilişkili IOC veritabanı — 1M+ güvenlik ihlali göstergesi",
    why: "Domain veya IP'nin bilinen siber saldırı altyapısıyla bağlantısını tespit eder. Cobalt Strike, LockBit, Emotet gibi malware grouplarını yakalar.",
    how: "Her taramada domain ThreatFox IOC veritabanında sorgulanır. Eşleşme varsa tehdit tipi ve malware adı rapora eklenir.",
    setup: "Kurulum gerekmez. Auth-Key: anonymous ile ücretsiz kullanılır.",
    docs: "https://threatfox.abuse.ch/api/",
  },
  {
    id: "usom", name: "USOM", category: "Tehdit İstihbaratı", type: "security", icon: "🇹🇷",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "BTK/USOM (Ulusal Siber Olaylara Müdahale Merkezi) Türkiye siber tehdit kara listesi",
    why: "Uluslararası listelerde görünmeyebilecek Türkiye'ye özgü tehditleri yakalar. BTK'nın zararlı olarak işaretlediği domain'leri kontrol eder.",
    how: "Domain taramasında USOM kara listesiyle anlık eşleştirme yapılır. Türkiye odaklı rakip analiz için kritik veri kaynağı.",
    setup: "Kurulum gerekmez. usom.gov.tr'den çekilir, önbelleğe alınır.",
    docs: "https://www.usom.gov.tr/",
  },
  // ─── İtibar & Kötücül Yazılım ──────────────────────────────────────────────
  {
    id: "virustotal", name: "VirusTotal", category: "İtibar & Kötücül Yazılım", type: "security", icon: "🦠",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 500 istek/gün | Premium: $30/ay",
    envKey: "VIRUSTOTAL_API_KEY", always: false,
    desc: "70+ antivirüs motorunun domain/IP taraması — Google altyapısı üzerinde çalışır",
    why: "Tek bir kara listeye güvenmek yerine Kaspersky, Sophos, Crowdstrike gibi 70 farklı güvenlik firmasının analizini tek API ile toplar.",
    how: "Tarama sonucunda 'VirusTotal İtibar' kartında zararlı/şüpheli motor sayısı ve genel itibar puanı gösterilir.",
    setup: "1. virustotal.com'da ücretsiz hesap açın  2. Sağ üst menü → API Keys  3. Anahtarı kopyalayıp aşağıya yapıştırın.",
    docs: "https://developers.virustotal.com/",
  },
  {
    id: "google-sb", name: "Google Safe Browsing", category: "İtibar & Kötücül Yazılım", type: "security", icon: "🛡️",
    cost: "free", costLabel: "Ücretsiz", costNote: "10.000 istek/gün ücretsiz",
    envKey: "GOOGLE_SAFE_BROWSING_API_KEY", always: false,
    desc: "Chrome/Firefox/Safari'nin güvensiz işaretlediği domain listesi — 4 milyar kullanıcı verisiyle beslenir",
    why: "En geniş kapsamlı gerçek kullanıcı tabanlı phishing ve malware tespiti. GSB'de işaretli domain Chrome'da doğrudan uyarı gösterir.",
    how: "Domain GSB Lookup API'siyle sorgulanır. 'Phishing', 'Malware', 'Unwanted Software' kategorilerinde eşleşme varsa raporda gösterilir.",
    setup: "1. console.cloud.google.com → Proje oluşturun  2. Safe Browsing API'yi etkinleştirin  3. Credentials → Create API Key.",
    docs: "https://developers.google.com/safe-browsing/v4/get-started",
  },
  {
    id: "abuseipdb", name: "AbuseIPDB", category: "İtibar & Kötücül Yazılım", type: "security", icon: "🚨",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 1.000/gün | Basic: $20/ay",
    envKey: "ABUSEIPDB_API_KEY", always: false,
    desc: "Spam, brute-force ve DDoS saldırılarında kullanılan IP adreslerinin küresel raporlama veritabanı",
    why: "Mail sunucusu IP'si kara listedeyse e-postalar spam kutusuna düşer. Web sunucusu IP'si kötü itibarına sahipse SEO'yu olumsuz etkiler.",
    how: "Domain'in MX ve A kayıtlarındaki IP'ler sorgulanır. Abuse skoru ve rapor sayısı 'AbuseIPDB' kartında gösterilir.",
    setup: "1. abuseipdb.com'da ücretsiz hesap açın  2. Account → API Keys → Create Key  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://www.abuseipdb.com/api.html",
  },
  {
    id: "otx", name: "AlienVault OTX", category: "İtibar & Kötücül Yazılım", type: "security", icon: "👁️",
    cost: "free", costLabel: "Ücretsiz", costNote: "Tamamen ücretsiz",
    envKey: "OTX_API_KEY", always: false,
    desc: "200.000+ güvenlik araştırmacısının katkısıyla oluşan küresel tehdit istihbarat platformu",
    why: "Domain'in kaç aktif tehdit kampanyasında görüntülendiğini ve Türkiye'ye hedefli saldırılarla ilişkisini ortaya çıkarır.",
    how: "OTX Indicators API sorgulanır. Pulse sayısı, TR hedefli saldırı sayısı ve domain itibar puanı tarama raporuna eklenir.",
    setup: "1. otx.alienvault.com'a ücretsiz kayıt olun  2. Profil → API Key  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://otx.alienvault.com/api/",
  },
  {
    id: "greynoise", name: "GreyNoise", category: "İtibar & Kötücül Yazılım", type: "security", icon: "📡",
    cost: "freemium", costLabel: "Freemium", costNote: "Community: Ücretsiz 1.000/gün | Teams: $99/ay",
    envKey: "GREYNOISE_API_KEY", always: false,
    desc: "İnternet genelinde port tarama yapan botları gerçek hedefli saldırganlardan ayıran IP niyeti analiz platformu",
    why: "'Bu IP bizi hedef alıyor mu yoksa sadece genel internet taraması mı yapıyor?' sorusunu yanıtlar. Yanlış alarmları dramatik azaltır.",
    how: "Shodan ile tespit edilen IP'lerin niyeti sınıflandırılır (noise/benign/malicious). Raporda saldırı niyeti gösterilir.",
    setup: "1. greynoise.io'da ücretsiz Community hesabı açın  2. Account → API Keys  3. Anahtarı aşağıya yapıştırın.",
    docs: "https://docs.greynoise.io/",
  },
  // ─── Güvenlik Vendor Feed'leri ─────────────────────────────────────────────
  {
    id: "fortiguard", name: "FortiGuard (Fortinet)", category: "Güvenlik Vendor Feed'leri", type: "security", icon: "🛡️",
    cost: "paid", costLabel: "Ticari", costNote: "Web lookup ücretsiz | Tam IoC feed: ticari abonelik",
    envKey: "FORTIGUARD_API_KEY", always: false,
    desc: "Fortinet'in küresel tehdit istihbarat servisi — IP/URL itibarı, günlük IoC feed'i ve botnet/C&C kategorileri",
    why: "Fortinet dünyanın en büyük güvenlik vendor'larından biri. FortiGuard Labs milyonlarca cihazdan beslenen gerçek zamanlı tehdit verisi sağlar.",
    how: "Domain IP ve URL'leri FortiGuard'da sorgulanır; tehdit skoru (0-5) ve kategoriler (Botnet, C&C, Phishing) rapora eklenir. Ticari abonelikle günlük IoC feed'i merkezi IoC havuzuna senkronize edilir.",
    setup: "1. fortiguard.com'dan ticari abonelik alın  2. API anahtarını FORTIGUARD_API_KEY olarak ekleyin. Web lookup anahtarsız da sınırlı çalışır.",
    docs: "https://www.fortiguard.com/",
  },
  {
    id: "unit42", name: "Palo Alto Unit 42 / AutoFocus", category: "Güvenlik Vendor Feed'leri", type: "security", icon: "🌐",
    cost: "paid", costLabel: "Ticari", costNote: "AutoFocus + WildFire ticari abonelik",
    envKey: "AUTOFOCUS_API_KEY", always: false,
    desc: "Palo Alto Networks'ün tehdit araştırma birimi Unit 42 — APT raporları, AutoFocus IoC'leri ve WildFire malware analizi",
    why: "Unit 42, dünya çapında en saygın tehdit araştırma ekiplerinden biri. Kampanya ve aktör istihbaratı kalitesi yüksektir.",
    how: "AutoFocus API'sinden kampanya ve IoC verileri çekilir, tehdit kampanyaları tablosuna işlenir. WildFire ile şüpheli dosya hash'leri zenginleştirilir.",
    setup: "1. Palo Alto AutoFocus aboneliği  2. AUTOFOCUS_API_KEY (ve isteğe bağlı WILDFIRE_API_KEY) ekleyin.",
    docs: "https://unit42.paloaltonetworks.com/",
  },
  {
    id: "checkpoint-tc", name: "Check Point ThreatCloud", category: "Güvenlik Vendor Feed'leri", type: "security", icon: "☁️",
    cost: "paid", costLabel: "Ticari", costNote: "ThreatCloud API ticari abonelik",
    envKey: "CHECKPOINT_API_KEY", always: false,
    desc: "Check Point'in ThreatCloud istihbarat ağı — küresel sensör verisinden beslenen IP/URL/dosya itibarı ve tehdit göstergeleri",
    why: "ThreatCloud, Check Point güvenlik duvarlarından toplanan devasa telemetriyle gerçek zamanlı tehdit korelasyonu yapar.",
    how: "ThreatCloud API'siyle domain ve dosya göstergeleri sorgulanır, eşleşen IoC'ler tehdit havuzuna eklenir ve tarama raporlarında gösterilir.",
    setup: "1. Check Point ThreatCloud aboneliği  2. CHECKPOINT_API_KEY ekleyin.",
    docs: "https://www.checkpoint.com/infinity/threatcloud/",
  },
  {
    id: "cisco-talos", name: "Cisco Talos / Umbrella", category: "Güvenlik Vendor Feed'leri", type: "security", icon: "🔱",
    cost: "paid", costLabel: "Ticari", costNote: "Talos feed + Umbrella Investigate ticari",
    envKey: "TALOS_API_KEY", always: false,
    desc: "Cisco'nun tehdit istihbarat ekibi Talos ve Umbrella Investigate — domain itibarı, DNS tabanlı tehdit verisi ve IoC feed'leri",
    why: "Talos, internet trafiğinin önemli bir kısmını gözlemleyen en büyük ticari tehdit istihbarat ekiplerindendir; DNS katmanı görünürlüğü benzersizdir.",
    how: "Talos feed'i ve Umbrella Investigate API'siyle domain/IP itibarı sorgulanır, sonuçlar IoC havuzuna ve tarama raporlarına işlenir.",
    setup: "1. Cisco Talos / Umbrella aboneliği  2. TALOS_API_KEY (ve isteğe bağlı UMBRELLA_API_KEY) ekleyin.",
    docs: "https://talosintelligence.com/",
  },
  // ─── CTI Platformları ──────────────────────────────────────────────────────
  {
    id: "misp", name: "MISP", category: "CTI Platformları", type: "security", icon: "🔄",
    cost: "free", costLabel: "Açık Kaynak", costNote: "Self-hosted (kurulum gerektirir)",
    envKey: "MISP_API_KEY", always: false,
    desc: "Malware Information Sharing Platform — topluluk tabanlı tehdit göstergesi paylaşım ve korelasyon platformu",
    why: "MISP, güvenlik toplulukları arasında yapılandırılmış IoC paylaşımının fiili standardıdır. TLP:White/Green olaylarla zengin tehdit verisi sağlar.",
    how: "Kendi MISP sunucunuzdan periyodik olarak yayınlanmış olaylar (events) çekilir, IoC'ler merkezi havuza senkronize edilir.",
    setup: "1. Self-hosted MISP kurun  2. MISP_URL ve MISP_API_KEY değerlerini ekleyin.",
    docs: "https://www.misp-project.org/",
  },
  {
    id: "opencti", name: "OpenCTI", category: "CTI Platformları", type: "security", icon: "🧩",
    cost: "free", costLabel: "Açık Kaynak", costNote: "Self-hosted (kurulum gerektirir)",
    envKey: "OPENCTI_API_TOKEN", always: false,
    desc: "Open Cyber Threat Intelligence — STIX2 tabanlı, GraphQL API ile tehdit göstergesi ve aktör yönetim platformu",
    why: "OpenCTI, tehdit aktörü, kampanya ve IoC'ler arasındaki ilişkileri grafik veri modeliyle yönetir; CTI verisini tek merkezde toplar.",
    how: "OpenCTI GraphQL API'siyle belirli tarihten sonra oluşturulan göstergeler (indicators) çekilir ve merkezi IoC havuzuna işlenir.",
    setup: "1. Self-hosted OpenCTI kurun  2. OPENCTI_URL ve OPENCTI_API_TOKEN değerlerini ekleyin.",
    docs: "https://www.opencti.io/",
  },
  // ─── Güvenlik Cihazı Entegrasyonları ───────────────────────────────────────
  {
    id: "fortigate", name: "FortiGate Firewall", category: "Güvenlik Cihazı Entegrasyonları", type: "security", icon: "🧱",
    cost: "varies", costLabel: "Müşteri Cihazı", costNote: "Müşteri başına yapılandırılır",
    always: false,
    desc: "Müşterinin FortiGate güvenlik duvarından tehdit olaylarını çekme ve otomatik IP blok kuralı gönderme entegrasyonu",
    why: "Müşteri kendi FortiGate'ine API erişimi verdiğinde CyberStep tespit ettiği zararlı IP'leri otomatik bloklayabilir ve gerçek saldırı olaylarını rapora dahil eder.",
    how: "FortiGate REST API'siyle tehdit log'ları çekilir (vendor olay tablosuna), tespit edilen IoC'ler için otomatik adres + blok kuralı gönderilir.",
    setup: "Müşteri panelinden cihaz başına yapılandırılır: yönetim IP'si, API anahtarı ve sürüm. Global anahtar gerekmez.",
    docs: "https://docs.fortinet.com/",
  },
  {
    id: "panos", name: "Palo Alto PAN-OS", category: "Güvenlik Cihazı Entegrasyonları", type: "security", icon: "🧱",
    cost: "varies", costLabel: "Müşteri Cihazı", costNote: "Müşteri başına yapılandırılır",
    always: false,
    desc: "Müşterinin Palo Alto PAN-OS güvenlik duvarından tehdit log'larını çekme ve dinamik adres grubuyla IP bloklama",
    why: "PAN-OS yaygın kurumsal güvenlik duvarıdır. Entegrasyon, gerçek olay verisini rapora taşır ve otomatik müdahale sağlar.",
    how: "PAN-OS XML/REST API'siyle tehdit log'ları çekilir; tespit edilen zararlı IP'ler dinamik adres grubuna eklenerek bloklanır.",
    setup: "Müşteri panelinden cihaz başına yapılandırılır: yönetim IP'si, API anahtarı ve sürüm.",
    docs: "https://docs.paloaltonetworks.com/pan-os",
  },
  {
    id: "checkpoint-fw", name: "Check Point Firewall", category: "Güvenlik Cihazı Entegrasyonları", type: "security", icon: "🧱",
    cost: "varies", costLabel: "Müşteri Cihazı", costNote: "Müşteri başına yapılandırılır",
    always: false,
    desc: "Müşterinin Check Point güvenlik duvarından log çekme ve Management API ile IP bloklama entegrasyonu",
    why: "Check Point kurumsal ortamlarda yaygındır. Management API ile merkezi politika güncellemesi ve gerçek olay görünürlüğü sağlanır.",
    how: "Check Point Management API'siyle (R81.x) oturum açılır, tehdit log'ları çekilir ve blok kuralları publish edilir.",
    setup: "Müşteri panelinden cihaz başına yapılandırılır: yönetim IP'si, API anahtarı ve sürüm (örn. R81.10).",
    docs: "https://sc1.checkpoint.com/documents/latest/APIs/",
  },
  {
    id: "cisco-asa", name: "Cisco ASA / FTD", category: "Güvenlik Cihazı Entegrasyonları", type: "security", icon: "🧱",
    cost: "varies", costLabel: "Müşteri Cihazı", costNote: "Müşteri başına yapılandırılır",
    always: false,
    desc: "Müşterinin Cisco ASA veya Firepower (FTD) cihazından olay çekme ve erişim kuralıyla IP bloklama",
    why: "Cisco ASA/FTD geniş bir kurumsal tabana sahiptir. Entegrasyon gerçek olay verisi ve otomatik müdahale yeteneği ekler.",
    how: "Cisco ASA REST / FTD FMC API'siyle olaylar çekilir ve tespit edilen zararlı IP'ler için erişim kuralı uygulanır.",
    setup: "Müşteri panelinden cihaz başına yapılandırılır: yönetim IP'si, API anahtarı ve sürüm.",
    docs: "https://www.cisco.com/c/en/us/support/security/",
  },
  // ─── Altyapı & Açık Yönetimi ───────────────────────────────────────────────
  {
    id: "shodan", name: "Shodan", category: "Altyapı & Açık Yönetimi", type: "security", icon: "🔍",
    cost: "paid", costLabel: "Ücretli", costNote: "Free (çok sınırlı) | Member: $49/ay",
    envKey: "SHODAN_API_KEY", always: false,
    desc: "Tüm internetin port ve servis haritası — açık portlar, çalışan yazılımlar, donanım parmak izi",
    why: "Müşterinin bilmediği açık portları (RDP:3389, MongoDB:27017, Elasticsearch:9200) tespit eder. Veri sızdıran açık veritabanları sık bulunan kritik açık.",
    how: "Domain IP'si Shodan'da sorgulanır. Açık port listesi, ülke/ISP bilgisi ve bilinen CVE sayısı 'Shodan' kartında gösterilir.",
    setup: "1. shodan.io'da hesap açın  2. Account → Overview → API Key  3. Member plan ($49/ay) tam API erişimi için gerekli.",
    docs: "https://developer.shodan.io/api",
  },
  {
    id: "securitytrails", name: "SecurityTrails", category: "Altyapı & Açık Yönetimi", type: "security", icon: "🛰️",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 50/ay | API: $50/ay'dan başlar",
    envKey: "SECURITYTRAILS_API_KEY", always: false,
    desc: "DNS geçmişi, tarihsel A/MX kayıtları ve kapsamlı subdomain keşfi — altyapı değişikliklerini izler",
    why: "Geçmiş DNS kayıtları, gizli subdomain'ler ve ilişkili IP'ler saldırı yüzeyini ortaya çıkarır. crt.sh'in bulamadığı pasif DNS verisini sağlar.",
    how: "Domain için DNS geçmişi ve subdomain listesi çekilir, 30 günlük cache'e alınır ve tarama raporundaki altyapı haritasına eklenir.",
    setup: "1. securitytrails.com'da hesap açın  2. Account → API Key  3. SECURITYTRAILS_API_KEY olarak ekleyin.",
    docs: "https://docs.securitytrails.com/",
  },
  {
    id: "censys", name: "Censys", category: "Altyapı & Açık Yönetimi", type: "security", icon: "🛰️",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 250 sorgu/ay | Pro ücretli",
    envKey: "CENSYS_API_ID", always: false,
    desc: "İnternet genelinde host ve sertifika taraması — açık servisler, TLS yapılandırması ve cihaz parmak izi",
    why: "Shodan'a alternatif/tamamlayıcı internet tarama veri kaynağı. Açık servisleri ve sertifika ayrıntılarını farklı bir bakış açısıyla doğrular.",
    how: "Domain ve IP'ler Censys Search API'siyle sorgulanır; açık portlar, servisler ve sertifika bilgileri tarama raporuna eklenir.",
    setup: "1. censys.io'da hesap açın  2. Account → API → ID ve Secret  3. CENSYS_API_ID ve CENSYS_API_SECRET ekleyin.",
    docs: "https://search.censys.io/api",
  },
  {
    id: "binaryedge", name: "BinaryEdge", category: "Altyapı & Açık Yönetimi", type: "security", icon: "🛰️",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz: 250 istek/ay | Ücretli planlar",
    envKey: "BINARYEDGE_API_KEY", always: false,
    desc: "İnternet tarama ve maruz kalan servis veritabanı — açık portlar, risk skorları ve veri sızıntısı tespiti",
    why: "Maruz kalan servisleri ve potansiyel veri sızıntılarını farklı bir tarama ağıyla doğrular; Shodan/Censys ile kapsama artırır.",
    how: "Domain ve IP'ler BinaryEdge API'siyle sorgulanır; risk skoru ve açık servis bulguları tarama raporuna eklenir.",
    setup: "1. app.binaryedge.io'da hesap açın  2. Account → API Access  3. BINARYEDGE_API_KEY olarak ekleyin.",
    docs: "https://docs.binaryedge.io/",
  },
  {
    id: "cloudflare-radar", name: "Cloudflare Radar", category: "Altyapı & Açık Yönetimi", type: "security", icon: "📶",
    cost: "free", costLabel: "Ücretsiz", costNote: "API token gerektirir",
    envKey: "CLOUDFLARE_API_TOKEN", always: false,
    desc: "Türkiye internet trafiği ve saldırı anomalileri — bölgesel DDoS, BGP ve katman-3 saldırı eğilimleri",
    why: "Türkiye genelindeki saldırı dalgaları ve internet anomalileri, müşteriye yönelik tehditleri makro bağlama oturtur.",
    how: "Cloudflare Radar API'siyle Türkiye'ye ait saldırı zaman serileri çekilir ve CTI panosunda bölgesel tehdit göstergesi olarak gösterilir.",
    setup: "1. dash.cloudflare.com'da API token oluşturun  2. CLOUDFLARE_API_TOKEN olarak ekleyin.",
    docs: "https://developers.cloudflare.com/radar/",
  },
  {
    id: "whoisxml", name: "WhoisXML API", category: "Altyapı & Açık Yönetimi", type: "security", icon: "📋",
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
    id: "ssllabs", name: "Qualys SSL Labs", category: "Protokol & Sertifika", type: "security", icon: "🔐",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "TLS protokol versiyonu, şifre zayıflığı, sertifika zinciri ve HSTS kontrolü — endüstri standardı değerlendirmesi",
    why: "A+ ile F arasında bağımsız harf notu verir. PCI-DSS uyumluluk için SSL notunun A olması zorunlu.",
    how: "SSLLabs önbellekten not alınır (24 saatlik cache). Tarama raporunda 'SSLLabs Notu' başlığında gösterilir.",
    setup: "Kurulum gerekmez. api.ssllabs.com açık ve ücretsizdir.",
    docs: "https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md",
  },
  {
    id: "mozilla-obs", name: "Mozilla Observatory", category: "Protokol & Sertifika", type: "security", icon: "🦊",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "HTTP Güvenlik Başlıkları analizi — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy değerlendirmesi",
    why: "SSLLabs ile tamamlayıcı: SSL/TLS değil HTTP katmanı başlıklarının güvenliğini ölçer. Eksik CSP başlığı XSS saldırılarının kapısını açar.",
    how: "Her taramada Observatory API sorgulanır. A-F arası harf notu ve başarısız test sayısı rapora eklenir.",
    setup: "Kurulum gerekmez. Tamamen ücretsiz Mozilla API'si.",
    docs: "https://observatory.mozilla.org/",
  },
  {
    id: "nvd-cve", name: "NVD CVE (NIST)", category: "Protokol & Sertifika", type: "security", icon: "🐛",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "ABD Ulusal Güvenlik Açığı Veritabanı — 200.000+ CVE kaydı, CVSS kritiklik puanları",
    why: "Shadow IT ile tespit edilen yazılımların (WordPress eklenti versiyonu, jQuery sürümü vb.) bilinen açıklarını tek tek tarar.",
    how: "Tespit edilen servisler için NVD'de CVE araması yapılır. Yüksek CVSS puanlı açıklar rapora öncelikli olarak eklenir.",
    setup: "Kurulum gerekmez. nvd.nist.gov API'si ücretsizdir.",
    docs: "https://nvd.nist.gov/developers/vulnerabilities",
  },
  {
    id: "epss", name: "EPSS (FIRST.org)", category: "Protokol & Sertifika", type: "security", icon: "📊",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "CVE başına gerçek dünya istismar olasılığı puanı — 'Bu açık önümüzdeki 30 günde kullanılma ihtimali %94'",
    why: "NVD'nin CVSS puanı teorik şiddet ölçer; EPSS gerçek saldırı verilerinden makine öğrenimiyle hesaplanır.",
    how: "NVD'den alınan CVE'ler EPSS API'siyle zenginleştirilir. Her CVE için istismar olasılığı yüzdesi rapora eklenir.",
    setup: "Kurulum gerekmez. api.first.org tamamen ücretsizdir.",
    docs: "https://www.first.org/epss/api",
  },
  {
    id: "crt-sh", name: "crt.sh (CT Logs)", category: "Protokol & Sertifika", type: "security", icon: "📜",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Sertifika Şeffaflığı günlükleri — domain'e ait tüm alt alanları ve sertifika geçmişini ortaya çıkarır",
    why: "Yöneticinin habersiz açılan subdomain'leri (eski test sunucusu, terk edilmiş proje) tespit eder. Bu subdomain'ler genellikle korumasız bırakılır.",
    how: "crt.sh sorgusu ile domain'e ait tüm sertifikalar listelenir. Alt domain keşfi ve shadow asset tespiti için kullanılır.",
    setup: "Kurulum gerekmez.",
    docs: "https://crt.sh/",
  },
  // ─── E-posta & Kimlik ──────────────────────────────────────────────────────
  {
    id: "hibp", name: "Have I Been Pwned", category: "E-posta & Kimlik", type: "security", icon: "💀",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Domain'e ait e-posta adreslerinin 750+ veri sızıntısında yer alıp almadığını kontrol eder",
    why: "Çalışan kimlik bilgilerinin dark web'de bulunması hesap ele geçirme riskini dramatik artırır.",
    how: "Domain HIBP API'siyle sorgulanır. Kaç sızıntıda kaç hesap bulunduğu ve hangi sızıntılar olduğu raporda gösterilir.",
    setup: "Kurulum gerekmez.",
    docs: "https://haveibeenpwned.com/API/v3",
  },
  {
    id: "spf-dmarc", name: "SPF / DMARC / DKIM", category: "E-posta & Kimlik", type: "security", icon: "✉️",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "E-posta kimlik doğrulama kayıtları — phishing ve e-posta sahteciliği (spoofing) tespiti",
    why: "Bu kayıtlar eksikse saldırganlar şirket adına sahte e-posta gönderebilir. CEO fraud saldırılarının %91'i e-posta sahteciliğiyle başlar.",
    how: "DNS MX, TXT kayıtları sorgulanarak SPF/DMARC/DKIM analiz edilir. Eksik veya yanlış yapılandırmalar kırmızı ile işaretlenir.",
    setup: "Kurulum gerekmez.",
    docs: "https://dmarcian.com/what-is-spf/",
  },
  {
    id: "dnsbl", name: "DNSBL Kara Listeleri", category: "E-posta & Kimlik", type: "security", icon: "🚫",
    cost: "free", costLabel: "Ücretsiz", always: true,
    desc: "Spamhaus, Barracuda, SORBS, SpamCop gibi 15+ DNS tabanlı kara listede IP ve domain kontrolü",
    why: "Kara listedeki mail sunucusunun gönderdiği e-postalar otomatik spam kutusuna düşer.",
    how: "Domain ve MX IP'leri 15+ DNSBL listesine DNS sorgusuyla kontrol edilir. Kara listede görünme durumu gösterilir.",
    setup: "Kurulum gerekmez. DNS sorguları ile çalışır.",
    docs: "https://www.spamhaus.org/lookup/",
  },
  // ─── Yapay Zeka ────────────────────────────────────────────────────────────
  {
    id: "gemini-ai", name: "Gemini 2.5 Flash", category: "Yapay Zeka", type: "security", icon: "✨",
    cost: "free", costLabel: "Ücretsiz Plan", always: true,
    desc: "Ücretsiz plan için Google'ın hızlı AI modeli — tarama bulgularından Türkçe risk raporu üretir",
    why: "Ham güvenlik verilerini CEO'nun anlayabileceği aksiyona dönüştürülebilir Türkçe rapora çevirir.",
    how: "Assessment tamamlanınca tüm bulgular Gemini'ye gönderilir. Sektöre özel, risk öncelikli Türkçe rapor oluşturulur.",
    setup: "Replit AI Integrations tarafından otomatik sağlanır. Ek kurulum gerekmez.",
    docs: "https://ai.google.dev/",
  },
  {
    id: "claude-sonnet", name: "Claude Sonnet 4.6", category: "Yapay Zeka", type: "security", icon: "🧠",
    cost: "paid", costLabel: "Starter / Pro Plan", always: true,
    desc: "Anthropic'in en ileri analiz modeli — ücretli planlarda otomatik devreye girer, Gemini'den belirgin biçimde üstün rapor kalitesi",
    why: "Güvenlik bulgularında bağlam anlama, nüans ve Türkçe ifade kalitesi açısından Gemini ve ChatGPT'den önde gelir.",
    how: "Starter veya Pro plandaki tenant'lar için rapor üretimi otomatik olarak Claude Sonnet'e yönlendirilir.",
    setup: "Ekstra kurulum gerekmez. Tenant planı Starter veya Pro olduğunda sistem otomatik Claude kullanır.",
    docs: "https://www.anthropic.com/claude",
  },
  // ─── İletişim ──────────────────────────────────────────────────────────────
  {
    id: "smtp", name: "SMTP E-posta", category: "İletişim", type: "platform", icon: "📧",
    cost: "varies", costLabel: "Değişken", always: false,
    desc: "Bülten, rapor ve güvenlik bildirimi e-postalarının gönderimi",
    why: "Müşterilere 30 günlük yeniden tarama raporu, skor değişikliği bildirimi ve güvenlik uyarıları göndermek için gerekli.",
    how: "Nodemailer ile yapılandırılmış SMTP sunucusu üzerinden tüm sistem e-postaları gönderilir.",
    setup: "Replit Secrets'a SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ortam değişkenlerini ekleyin.",
  },
  {
    id: "isr-imap", name: "ISR IMAP (AI Satış Asistanı)", category: "İletişim", type: "platform", icon: "🧠",
    superAdminOnly: true,
    cost: "free", costLabel: "Ücretsiz", always: false,
    desc: "AI Satış Asistanı'nın gelen kutusunu okuyarak potansiyel müşteri e-postalarına otomatik Türkçe yanıt vermesi",
    why: "7/24 çalışan AI satış temsilcisi — potansiyel müşteri e-postasını 5 dakika içinde yanıtlar.",
    how: "Her 5 dakikada bir IMAP'ten e-posta okunur, Gemini AI ile bağlam bilinçli Türkçe yanıt oluşturulur ve SMTP ile gönderilir.",
    setup: "Replit Secrets'a ISR_IMAP_HOST, ISR_IMAP_PORT, ISR_IMAP_USER, ISR_IMAP_PASS ekleyin.",
  },
  // ─── Ödeme & Faturalandırma ────────────────────────────────────────────────
  {
    id: "iyzico", name: "Iyzico Ödeme", category: "Ödeme & Faturalandırma", type: "platform", icon: "💳",
    cost: "paid", costLabel: "Komisyonlu", costNote: "İşlem başına %2,5 + 0,25 TL",
    envKey: "IYZICO_API_KEY", always: false,
    desc: "Türkiye'nin lider ödeme altyapısı — kredi kartı, havale ve taksit desteğiyle abonelik ve tek seferlik ödeme tahsilatı",
    why: "Yerli ödeme altyapısı: BKM Express, 3D Secure, taksit desteği. Stripe'a kıyasla Türk bankalarıyla daha az red oranı. BDDK lisanslı.",
    how: "Müşteri kayıt/yükseltme akışında ödeme formu gösterilir. Abonelik yenilemeleri otomatik tahsil edilir. Fatura PDF'i e-postayla gönderilir.",
    setup: "1. iyzico.com'dan işyeri hesabı açın  2. Geliştirici Merkezi → API Anahtarları  3. IYZICO_API_KEY ve IYZICO_SECRET_KEY'i Secrets'a ekleyin.",
    docs: "https://dev.iyzipay.com/",
  },
  {
    id: "parasut-efatura", name: "Paraşüt E-Fatura", category: "Ödeme & Faturalandırma", type: "platform", icon: "🧾",
    cost: "paid", costLabel: "Paraşüt Aboneliği", costNote: "parasut.com bulut muhasebe + e-Fatura modülü",
    envKey: "PARASUT_API_KEY", always: false,
    desc: "Paraşüt OAuth2 API üzerinden otomatik e-Fatura / e-Arşiv üretimi — ödeme tamamlanınca fatura Paraşüt'e yazılır, GİB'e iletilir",
    why: "Türkiye'de belirli ciro eşiği geçen şirketler için e-Fatura zorunludur. Manuel kesim yerine ödeme akışına bağlı tam otomatik faturalama sağlar.",
    how: "Iyzico ödeme başarıyla tamamlanınca einvoice.ts servisi Paraşüt OAuth2 token alır, satış faturası oluşturur ve GİB'e iletir. Fatura UUID'si sipariş kaydına işlenir.",
    setup: "1. parasut.com'dan hesap açın, e-Fatura modülünü aktif edin  2. Geliştirici Paneli → Uygulama Oluştur → Client ID / Client Secret alın  3. Replit Secrets'a PARASUT_API_KEY, PARASUT_CLIENT_ID, PARASUT_CLIENT_SECRET, PARASUT_COMPANY_ID ekleyin.",
    docs: "https://apidocs.parasut.com/",
  },
  // ─── Üretkenlik ─────────────────────────────────────────────────────────────
  {
    id: "calendly", name: "Calendly", category: "Üretkenlik", type: "platform", icon: "📅",
    cost: "freemium", costLabel: "Freemium", costNote: "Ücretsiz plan | API: ücretli planlar",
    envKey: "CALENDLY_API_KEY", always: false,
    desc: "Satış demo randevuları için otomatik toplantı planlama — AI Satış Asistanı potansiyel müşteriye Calendly linki gönderir",
    why: "Demo randevusu ayarlamak için ileri-geri e-postalaşmayı ortadan kaldırır. ISR akışında otomatik demo planlaması dönüşümü hızlandırır.",
    how: "Bir fırsat (deal) için Calendly Event Types API'siyle 30 dakikalık demo etkinliği oluşturulur ve booking linki ISR aktivitesine kaydedilir.",
    setup: "1. calendly.com'da hesap açın  2. Integrations → API & Webhooks  3. CALENDLY_API_KEY ve CALENDLY_USER_URI ekleyin.",
    docs: "https://developer.calendly.com/",
  },
  // ─── AI Analiz Modülleri ────────────────────────────────────────────────────
  {
    id: "eu-aiact", name: "EU AI Act Uyum Skoru", category: "AI Analiz Modülleri", type: "platform", icon: "🇪🇺",
    cost: "paid", costLabel: "1.990 TL", always: false,
    desc: "20 soruluk değerlendirme ile şirketin AB Yapay Zeka Yasası kapsamındaki uyum durumu ve risk kategorisi",
    why: "1 Ağustos 2026'dan itibaren AB pazarına ürün/hizmet sunan şirketler yükümlü. Ceza: 35 milyon Euro'ya kadar.",
    how: "POST /api/eu-aiact — 20 soru değerlendirmesi, Claude AI rapor üretimi, fire-and-forget + polling pattern.",
    setup: "ANTHROPIC_API_KEY (Replit AI Integrations) gerekli. Entegre Claude Sonnet ile otomatik çalışır.",
    docs: "/eu-ai-act",
  },
  {
    id: "ai-red-team", name: "AI Red Team Raporu", category: "AI Analiz Modülleri", type: "platform", icon: "🎯",
    cost: "paid", costLabel: "2.490 TL", always: false,
    desc: "Kamuya açık kaynaklardan AI ile toplanan saldırgan bakış açısı istihbaratı — altyapı, yöneticiler, e-posta formatı, sızıntı geçmişi",
    why: "Bir saldırgan şirketi hedef almadan önce tam olarak bu analizi yapar. Shodan, HaveIBeenPwned, DNS, OSINT verileri tek raporda.",
    how: "POST /api/red-team — domain + şirket bilgisi alır, arka planda OSINT toplar, Claude AI saldırı vektörü analizi yapar.",
    setup: "ANTHROPIC_API_KEY gerekli. İsteğe bağlı: SHODAN_API_KEY (daha derin tarama).",
    docs: "/ai-red-team",
  },
  {
    id: "deepfake-analizi", name: "Deepfake & Ses Klonu Analizi", category: "AI Analiz Modülleri", type: "platform", icon: "🎭",
    cost: "paid", costLabel: "1.490 TL", always: false,
    desc: "Yöneticilerin dijital izini analiz ederek CEO fraud saldırılarına karşı ses klonu risk haritası çıkarır",
    why: "Modern ses klonlama 3 dakika ses örnekle çalışıyor. YouTube, LinkedIn, haber arşivlerindeki ses maruziyeti deepfake riskini doğrudan belirliyor.",
    how: "POST /api/deepfake — domain/şirket adı alır, OSINT ile yönetici tespiti, ses/video maruziyeti tahmini, Claude AI risk raporu.",
    setup: "ANTHROPIC_API_KEY gerekli.",
    docs: "/deepfake-analizi",
  },
  {
    id: "sahte-dokuman", name: "AI Sahte Doküman Tespiti", category: "AI Analiz Modülleri", type: "platform", icon: "📄",
    cost: "paid", costLabel: "49 TL / tarama", always: false,
    desc: "Fatura, sözleşme, kimlik belgelerinde metadata anomalisi, format tutarsızlığı ve AI üretimi izlerini tespit eder",
    why: "AI ile üretilen sahte belgeler gözle ayırt edilemiyor. Muhasebe ve hukuk süreçlerinde tedarikçi doğrulaması kritik hale geldi.",
    how: "POST /api/document-scan — dosya upload, buffer metadata analizi, isteğe bağlı Hive AI görsel analizi, Claude AI açıklama.",
    envKey: "HIVE_API_KEY",
    setup: "HIVE_API_KEY opsiyonel — olmadan da heuristik + Claude AI ile çalışır. Daha derin görsel analiz için Hive Moderation API key ekleyin.",
    docs: "/sahte-dokuman",
  },
  // ─── Bildirim & Alarm ───────────────────────────────────────────────────────
  {
    id: "webhook", name: "Generic Webhook", category: "Bildirim & Alarm", type: "platform", icon: "🔗",
    cost: "free", costLabel: "Ücretsiz", always: false,
    envKey: "",
    desc: "HMAC-SHA256 imzalı outbound webhook. Zapier, Make, n8n veya kendi endpoint'inize SOC alarmlarını, SLA ihlallerini ve tarama sonuçlarını JSON olarak iletir.",
    why: "Tek entegrasyon noktasıyla 5.000+ uygulamaya köprü kurulur. Müşteri \"biz Notion kullanıyoruz, alert oraya düşsün\" dediğinde webhook + Zapier ile 10 dakikada çözülür.",
    how: "Müşteri /hesabim/entegrasyonlarim → Generic Webhook bölümünden URL + secret tanımlar. SOC triage case açınca dispatchWebhook() çağrılır; HMAC imzalı POST 15s timeout ile gönderilir. Başarısız teslimatlar 10dk'da bir cron ile 5 denemeye kadar retry yapılır.",
    setup: "1. Zapier/Make/n8n'de webhook trigger URL alın  2. /hesabim/entegrasyonlarim → Generic Webhook → Ekle  3. URL + opsiyonel secret girin, olayları seçin.",
    docs: "https://zapier.com/apps/webhook",
  },
  {
    id: "telegram", name: "Telegram Bot", category: "Bildirim & Alarm", type: "platform", icon: "✈️",
    cost: "free", costLabel: "Ücretsiz", always: false,
    envKey: "",
    desc: "Telegram Bot API üzerinden SOC alarmları MarkdownV2 formatında iletilir. Kritik vakalar, SLA ihlalleri ve case kapanışları anlık bildirim olarak gelir.",
    why: "Türkiye'de IT direktörlerinin tercihi. WhatsApp'a bağımlılığı ortadan kaldırır. API dünyanın en basit bot API'si — kurumsal ağlarda kısıtlanmaz.",
    how: "Müşteri @BotFather'dan bot oluşturur, token + chat ID girer. sendTelegramAlert() HMAC imzasız direkt Bot API çağrısı yapar. Teslim başarısız olursa sadece log düşer (kritik değil).",
    setup: "1. Telegram'da @BotFather → /newbot → token al  2. Botu hedef gruba/kanala ekle  3. @userinfobot ile Chat ID öğren  4. /hesabim/entegrasyonlarim → Telegram → kaydet.",
    docs: "https://core.telegram.org/bots/api",
  },
  {
    id: "netgsm", name: "NetGSM SMS", category: "Bildirim & Alarm", type: "platform", icon: "📱",
    cost: "paid", costLabel: "Kullanım bazlı", always: false,
    envKey: "",
    desc: "NetGSM XML API üzerinden Türkiye SMS. Kritik SOC alarmları ve SLA ihlalleri anında SMS olarak iletilir. Birden fazla alıcı numarası tanımlanabilir.",
    why: "WhatsApp kurumsal ağlarda kısıtlanabilir veya down olabilir. SMS kritik alarm için şarttır. NetGSM Türkiye'nin lider SMS operatörü, API temiz, günlük 1.000 SMS birkaç kuruş.",
    how: "username + password AES-256-GCM ile şifrelenir. sendNetgsmRequest() XML body oluşturup https://api.netgsm.com.tr/sms/send/xml'e POST atar. Yanıt '00' ise başarılı.",
    setup: "1. netgsm.com.tr'den hesap açın  2. API şifresi oluşturun  3. SMS başlığı (alfanümerik, maks. 11 karakter) onaylayın  4. /hesabim/entegrasyonlarim → NetGSM → kaydet.",
    docs: "https://www.netgsm.com.tr/dokuman/",
  },
  {
    id: "teams", name: "Microsoft Teams", category: "Bildirim & Alarm", type: "platform", icon: "💬",
    cost: "freemium", costLabel: "Microsoft 365 dahil", always: false,
    envKey: "",
    desc: "Incoming Webhook üzerinden SOC alarmları Adaptive Card olarak Teams kanalına iletilir. Kritik vakalar, SLA ihlalleri ve case güncellemeleri doğrudan Teams'de görünür.",
    why: "KOBİ'lerde Slack'ten yaygın. IT ekiplerinin zaten açık tuttuğu kanala alarm düşmesi yanıt süresini kısaltır. Adaptive Card ile 'Kabul Et' butonu eklenince analist Teams'den çıkmadan acknowledge edebilir.",
    how: "Müşteri Teams kanalında Incoming Webhook Connector tanımlar. Webhook URL + seçili olaylar kaydedilir. SOC triage case açınca Adaptive Card JSON POST edilir.",
    setup: "1. Teams kanalı → Connectors → Incoming Webhook → URL al  2. /hesabim/entegrasyonlarim → Microsoft Teams → URL'i yapıştır  3. Olayları seç.",
    docs: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
  },
  {
    id: "opsgenie", name: "OpsGenie", category: "Bildirim & Alarm", type: "platform", icon: "🚨",
    cost: "paid", costLabel: "Essentials $9/kullanıcı/ay", always: false,
    envKey: "",
    desc: "Atlassian OpsGenie API üzerinden on-call rotasyonu ve eskalasyon. Kritik SOC vakası açılınca OpsGenie alert oluşturur; vaka kapatılınca alert otomatik kapatılır.",
    why: "Türkiye'de PagerDuty'den yaygın, Jira ile native entegre. SOC Pro tier için on-call rotasyonu şart — SLA ihlali anında nöbetçi analist uyandırılır, eskalasyon politikası OpsGenie tarafında yönetilir.",
    how: "API key AES-256-GCM ile şifrelenir. Alert create/close Alerts API v2'ye POST edilir. Team ID opsiyonel — alert doğrudan rotasyona yönlendirmek için kullanılır.",
    setup: "1. OpsGenie → Settings → API Key oluştur  2. Opsiyonel: hedef team ID'yi kopyala  3. /hesabim/entegrasyonlarim → OpsGenie → bağla.",
    docs: "https://docs.opsgenie.com/docs/alert-api",
  },
  // ─── ITSM & Operasyon ───────────────────────────────────────────────────────
  {
    id: "servicenow", name: "ServiceNow ITSM", category: "ITSM & Operasyon", type: "platform", icon: "🎫",
    cost: "paid", costLabel: "Lisans", always: false,
    envKey: "SERVICENOW_INSTANCE_URL",
    desc: "SOC vakaları açıldığında ServiceNow'da otomatik INC ticket oluşturur; kapatıldığında çözüldü olarak günceller. 15 dakikalık çift yönlü senkronizasyon ile work note'lar ve durum değişiklikleri her iki sistemde de yansıtılır.",
    why: "ITSM süreçleri ServiceNow üzerinden yürüyen müşterilerde SOC vakalarının IT operasyon iş akışlarıyla entegre olması gerekir. Manuel veri girişini ortadan kaldırır, SLA takibini merkezileştirir.",
    how: "Müşteri /hesabim/entegrasyonlarim sayfasından instance URL + kullanıcı adı + API token girer. SOC triage'da case açılınca TableAPI'ye POST atılır. 15 dakikada bir cron SN durumunu çeker; SN'de kapanan vakalar CyberStep'te de kapatılır. Analist notları SN work_notes'a yazılır.",
    setup: "1. ServiceNow instance URL'ini edinin (örn. dev12345.service-now.com)  2. Yönetici hesabıyla API erişimi olan kullanıcı oluşturun  3. /hesabim/entegrasyonlarim → ServiceNow bölümünden bağlayın.",
    docs: "https://developer.servicenow.com/dev.do#!/reference/api/sandiego/rest/c_TableAPI",
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Tehdit İstihbaratı": Shield,
  "İtibar & Kötücül Yazılım": Zap,
  "Güvenlik Vendor Feed'leri": Radar,
  "CTI Platformları": Network,
  "Güvenlik Cihazı Entegrasyonları": Cpu,
  "Altyapı & Açık Yönetimi": Server,
  "Protokol & Sertifika": Lock,
  "E-posta & Kimlik": Mail,
  "Yapay Zeka": Brain,
  "İletişim": Globe,
  "Ödeme & Faturalandırma": CreditCard,
  "Üretkenlik": Calendar,
  "AI Analiz Modülleri": Bot,
  "ITSM & Operasyon": Settings,
  "Bildirim & Alarm": Bell,
};

const COST_COLORS: Record<string, string> = {
  free:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  freemium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  paid:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
  varies:   "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const SECURITY_CATEGORIES = [
  "Tehdit İstihbaratı",
  "İtibar & Kötücül Yazılım",
  "Güvenlik Vendor Feed'leri",
  "CTI Platformları",
  "Güvenlik Cihazı Entegrasyonları",
  "Altyapı & Açık Yönetimi",
  "Protokol & Sertifika",
  "E-posta & Kimlik",
  "Yapay Zeka",
];

const PLATFORM_CATEGORIES = [
  "İletişim",
  "Ödeme & Faturalandırma",
  "Üretkenlik",
  "AI Analiz Modülleri",
  "ITSM & Operasyon",
  "Bildirim & Alarm",
];

type StatusFilter = "all" | "active" | "needs-api" | "needs-setup";

export default function AdminEntegrasyonlar() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [shodanTest, setShodanTest] = useState<{ ok: boolean; message?: string; error?: string; plan?: string; queryCredits?: number; searchApiOk?: boolean } | null>(null);
  const [shodanTesting, setShodanTesting] = useState(false);

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

  const isActive = (i: IntegrationDef): boolean => {
    if (i.always) return true;
    if (!i.envKey) return false;
    return !!apiKeys[i.envKey];
  };

  const getStatus = (i: IntegrationDef): StatusFilter => {
    if (isActive(i)) return "active";
    if (i.envKey) return "needs-api";
    return "needs-setup";
  };

  const PUBLIC = INTEGRATIONS.filter(i => !i.superAdminOnly);

  // Stats
  const totalActive      = PUBLIC.filter(i => isActive(i)).length;
  const totalNeedsApi    = PUBLIC.filter(i => !isActive(i) && !!i.envKey).length;
  const totalNeedsSetup  = PUBLIC.filter(i => !isActive(i) && !i.envKey && !i.always).length;

  // Apply filters
  const applyFilters = (items: IntegrationDef[]) => {
    let result = items;
    if (categoryFilter !== "Tümü") result = result.filter(i => i.category === categoryFilter);
    if (statusFilter === "active")      result = result.filter(i => isActive(i));
    if (statusFilter === "needs-api")   result = result.filter(i => !isActive(i) && !!i.envKey);
    if (statusFilter === "needs-setup") result = result.filter(i => !isActive(i) && !i.envKey && !i.always);
    return result;
  };

  const securityItems  = applyFilters(PUBLIC.filter(i => i.type === "security"));
  const platformItems  = applyFilters(PUBLIC.filter(i => i.type === "platform"));

  const allCategories = ["Tümü", ...SECURITY_CATEGORIES.filter(c => PUBLIC.some(i => i.category === c)), ...PLATFORM_CATEGORIES.filter(c => PUBLIC.some(i => i.category === c))];

  const toggleStat = (s: StatusFilter) => {
    setStatusFilter(prev => prev === s ? "all" : s);
    setCategoryFilter("Tümü");
  };

  const renderCard = (integration: IntegrationDef) => {
    const active = isActive(integration);
    const expanded = expandedId === integration.id;
    const hasKey = !!integration.envKey;
    const inputVal = keyInputs[integration.envKey ?? ""] ?? "";
    const visible = !!showKey[integration.envKey ?? ""];
    const status = getStatus(integration);

    return (
      <Card
        key={integration.id}
        className={`bg-slate-800 border transition-colors ${
          status === "active"      ? "border-slate-700" :
          status === "needs-api"   ? "border-amber-800/40" :
                                     "border-slate-700/50"
        }`}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">{integration.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-1.5 mb-1">
                <span className="text-white font-semibold text-sm">{integration.name}</span>
                {status === "active"
                  ? <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle className="h-3 w-3" /> Aktif</span>
                  : status === "needs-api"
                    ? <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-700/40"><XCircle className="h-3 w-3" /> API Anahtarı Gerekli</span>
                    : <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600"><Settings className="h-3 w-3" /> Kurulum Gerekli</span>
                }
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
                  {integration.id === "shodan" && (
                    <div className="mt-2 space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setShodanTesting(true);
                          setShodanTest(null);
                          try {
                            const r = await fetch("/api/admin-panel/settings/apikeys/test-shodan", {
                              method: "POST", credentials: "include",
                            });
                            const data = await r.json() as typeof shodanTest;
                            setShodanTest(data);
                          } catch {
                            setShodanTest({ ok: false, error: "Bağlantı hatası" });
                          } finally {
                            setShodanTesting(false);
                          }
                        }}
                        disabled={shodanTesting}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                      >
                        {shodanTesting ? "Test ediliyor..." : "Shodan Anahtarını Test Et"}
                      </Button>
                      {shodanTest && (
                        <div className={`rounded p-2.5 text-xs ${shodanTest.ok ? (shodanTest.searchApiOk ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border border-amber-500/30 text-amber-300") : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
                          {shodanTest.ok ? shodanTest.message : shodanTest.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSection = (items: IntegrationDef[], categories: string[]) => {
    return categories.map(cat => {
      const catItems = items.filter(i => i.category === cat);
      if (catItems.length === 0) return null;
      const CatIcon = CATEGORY_ICONS[cat] ?? Shield;
      return (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <CatIcon className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{cat}</h3>
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-600">{catItems.length} entegrasyon</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {catItems.map(renderCard)}
          </div>
        </div>
      );
    });
  };

  return (
    <AdminLayout title="Entegrasyon Merkezi" description="Tüm güvenlik veri kaynakları, API bağlantıları ve servis durumları">
      <div className="max-w-5xl space-y-6">

        {/* Stats — tıklanabilir filtre */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: "all" as StatusFilter,         label: "Toplam Entegrasyon",      value: PUBLIC.length,      color: "text-white",        border: "border-slate-700",         bg: "" },
            { key: "active" as StatusFilter,      label: "Aktif Servis",            value: totalActive,        color: "text-emerald-400",  border: "border-emerald-700/40",    bg: "bg-emerald-500/5" },
            { key: "needs-api" as StatusFilter,   label: "API Anahtarı Bekliyor",   value: totalNeedsApi,      color: "text-amber-400",    border: "border-amber-700/40",      bg: "bg-amber-500/5" },
            { key: "needs-setup" as StatusFilter, label: "Kurulum Gerekli",         value: totalNeedsSetup,    color: "text-slate-400",    border: "border-slate-600",         bg: "" },
          ] as const).map(({ key, label, value, color, border, bg }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => toggleStat(key)}
                className={`rounded-xl border p-4 text-center transition-all hover:opacity-80 ${bg} ${border} ${active ? "ring-2 ring-emerald-500/50 scale-[1.02]" : "bg-slate-800"}`}
              >
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-400 text-xs mt-1">{label}</p>
                {active && key !== "all" && (
                  <p className="text-emerald-400 text-xs mt-1 font-medium">Filtrelendi</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Aktif filtre göstergesi */}
        {statusFilter !== "all" && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm text-emerald-400">
              Filtre aktif:{" "}
              <strong>
                {statusFilter === "active" ? "Aktif servisler" : statusFilter === "needs-api" ? "API Anahtarı Bekleyenler" : "Kurulum Gerektiren Servisler"}
              </strong>
            </span>
            <button onClick={() => setStatusFilter("all")} className="ml-auto text-xs text-emerald-400/70 hover:text-emerald-400 underline">Temizle</button>
          </div>
        )}

        {/* Kategori filtreleri */}
        <div className="flex flex-wrap gap-2">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                categoryFilter === cat
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── GÜVENLIK & ANALİZ KAYNAKLARI ─────────────────────────────────── */}
        {securityItems.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-widest px-3">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                Güvenlik & Analiz Kaynakları
              </span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>
            <div className="space-y-6">
              {renderSection(securityItems, SECURITY_CATEGORIES)}
            </div>
          </div>
        )}

        {/* ── PLATFORM & ALTYAPI ────────────────────────────────────────────── */}
        {platformItems.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-widest px-3">
                <Settings className="h-3.5 w-3.5 text-blue-400" />
                Platform & Altyapı Servisleri
              </span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>
            <p className="text-xs text-slate-500 -mt-3">İletişim, ödeme ve platforma ait ücretli analiz modülleri. Siber güvenlik tarama motoru ile doğrudan ilişkili değildir.</p>
            <div className="space-y-6">
              {renderSection(platformItems, PLATFORM_CATEGORIES)}
            </div>
          </div>
        )}

        {/* Boş durum */}
        {securityItems.length === 0 && platformItems.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <SlidersHorizontal className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Bu filtreyle eşleşen entegrasyon bulunamadı.</p>
            <button onClick={() => { setStatusFilter("all"); setCategoryFilter("Tümü"); }} className="text-emerald-400 text-sm mt-2 hover:underline">
              Filtreleri temizle
            </button>
          </div>
        )}

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
