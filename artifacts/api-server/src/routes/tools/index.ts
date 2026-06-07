import { Router } from "express";
import type { Request, Response } from "express";
import https from "node:https";
import { ai } from "@workspace/integrations-gemini-ai";
import * as dnsPromises from "node:dns/promises";
import { logger } from "../../lib/logger";

const router = Router();

// ─── BREACH SIMULATOR ─────────────────────────────────────────────────────────

// POST /api/breach-simulator
router.post("/breach-simulator", async (req: Request, res: Response) => {
  const { sector, employeeCount, annualRevenue, knownRisks } = req.body as {
    sector?: string;
    employeeCount?: string;
    annualRevenue?: string;
    knownRisks?: string;
  };

  if (!sector || !employeeCount) {
    res.status(400).json({ error: "Sektör ve çalışan sayısı zorunludur" });
    return;
  }

  const prompt = `Sen Türkiye'deki işletmeler için siber güvenlik risk simülatörüsün.

Şirket profili:
- Sektör: ${sector}
- Çalışan sayısı: ${employeeCount}
- Yıllık ciro: ${annualRevenue ? annualRevenue + " TL" : "belirtilmedi"}
- Bilinen teknik riskler: ${knownRisks || "genel işletme profili"}

Bu şirkete yönelik gerçekçi bir siber saldırı senaryosu oluştur. Saldırgan bakış açısından anlat.
Türkiye işletme pazarında gerçekleşen olaylara dayalı somut veriler kullan.

SADECE aşağıdaki JSON formatında yanıt ver, başka metin ekleme:
{
  "giris": {
    "baslik": "Saldırgan Nasıl İçeri Girer?",
    "hikaye": "Saldırganın keşif ve sızma aşamasını 2-3 cümleyle anlat. Somut teknik yöntemi belirt.",
    "yontem": "Kullanılan saldırı yöntemi (örn: Kimlik avı e-postası, RDP brute force, tedarikçi zafiyeti)"
  },
  "ilk24saat": {
    "baslik": "İlk 24 Saat Ne Olur?",
    "hikaye": "İçeri giren saldırganın 24 saat içinde ne yaptığını anlat.",
    "etkiler": ["Etki maddesi 1", "Etki maddesi 2", "Etki maddesi 3"]
  },
  "ilk7gun": {
    "baslik": "İlk 7 Gün: Yayılma ve Maksimum Hasar",
    "hikaye": "Saldırının tam etkisini, sistemlerin nasıl felç olduğunu anlat.",
    "etkiler": ["Etki maddesi 1", "Etki maddesi 2", "Etki maddesi 3"]
  },
  "finansalEtki": {
    "operasyonKaybi": { "min": 80000, "max": 400000, "aciklama": "Duran iş süreçleri ve gelir kaybı" },
    "musteriKaybi": { "min": 50000, "max": 250000, "aciklama": "Güven kaybından ayrılan müşteri geliri" },
    "kvkkCezasi": { "min": 94668, "max": 945735, "aciklama": "KVKK idari para cezası" },
    "itKurtarma": { "min": 25000, "max": 120000, "aciklama": "Sistem kurtarma ve siber güvenlik uzmanı maliyeti" },
    "itibarHasari": { "min": 30000, "max": 200000, "aciklama": "Marka değer kaybı ve müşteri güveni onarımı" },
    "toplam": { "min": 280000, "max": 1900000 }
  },
  "medyaBasligi": "Bu olay basına yansısaydı çıkabilecek somut Türkçe gazete başlığı",
  "onleyici3Hamle": [
    { "hamle": "1. Hamle adı", "aciklama": "Ne yapılır, nasıl yapılır", "sure": "1 gün", "maliyet": "Ücretsiz" },
    { "hamle": "2. Hamle adı", "aciklama": "Ne yapılır, nasıl yapılır", "sure": "1 hafta", "maliyet": "Düşük" },
    { "hamle": "3. Hamle adı", "aciklama": "Ne yapılır, nasıl yapılır", "sure": "2 hafta", "maliyet": "Orta" }
  ]
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const text = result.text ?? "";
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Breach simulator error");
    res.status(500).json({ error: "Simülasyon oluşturulamadı. Lütfen tekrar deneyin." });
  }
});

// ─── FİNANSAL KAYIP HESAPLAYICI ──────────────────────────────────────────────

// POST /api/finansal-kayip
router.post("/finansal-kayip", async (req: Request, res: Response) => {
  const { sector, employeeCount, annualRevenue, riskler } = req.body as {
    sector?: string;
    employeeCount?: string;
    annualRevenue?: string;
    riskler?: string[];
  };

  if (!sector || !employeeCount || !annualRevenue) {
    res.status(400).json({ error: "Sektör, çalışan sayısı ve yıllık ciro zorunludur" });
    return;
  }

  const prompt = `Türkiye'deki bir işletme için siber saldırı finansal etki analizi yap.

Şirket: ${sector} sektörü, ${employeeCount} çalışan, yıllık ${annualRevenue} TL ciro
Tespit edilen riskler: ${riskler?.join(", ") || "Genel risk profili"}

IBM Cost of Data Breach 2024, Verizon DBIR 2024 ve Türkiye'deki işletme siber olay verilerini referans alarak
gerçekçi TL bazında kayıp hesapla. Şirketin cirosunu ve sektörünü göz önünde bulundur.

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "ozet": "Bu şirkete özgü 2 cümle risk özeti",
  "kategoriler": [
    {
      "kategori": "Operasyon Durması",
      "aciklama": "Sistemler kapalıyken günlük kayıp × tahmini kesinti süresi",
      "minTL": 80000,
      "maxTL": 450000,
      "olasilik": "Yüksek",
      "ikon": "clock"
    },
    {
      "kategori": "Müşteri Kaybı",
      "aciklama": "Güven kaybından ayrılan müşterilerin getirdiği gelir kaybı",
      "minTL": 40000,
      "maxTL": 250000,
      "olasilik": "Orta",
      "ikon": "users"
    },
    {
      "kategori": "İtibar ve Marka Hasarı",
      "aciklama": "Uzun vadeli marka değer kaybı ve iş fırsatı kaybı",
      "minTL": 25000,
      "maxTL": 180000,
      "olasilik": "Orta",
      "ikon": "star"
    },
    {
      "kategori": "Yasal ve Hukuki Maliyet",
      "aciklama": "Avukatlık, müşteri bildirimleri, dava ve uzlaşma giderleri",
      "minTL": 15000,
      "maxTL": 90000,
      "olasilik": "Orta",
      "ikon": "scale"
    },
    {
      "kategori": "KVKK İdari Para Cezası",
      "aciklama": "Kişisel veri ihlali tespit edilmesi halinde KVK Kurulu cezası",
      "minTL": 94668,
      "maxTL": 945735,
      "olasilik": "Orta",
      "ikon": "shield-alert"
    },
    {
      "kategori": "IT Kurtarma Maliyeti",
      "aciklama": "Sistem geri yükleme, siber güvenlik analizi, yedekten dönüş",
      "minTL": 20000,
      "maxTL": 110000,
      "olasilik": "Yüksek",
      "ikon": "server"
    }
  ],
  "toplamMin": 274668,
  "toplamMax": 2025735,
  "karsilastirma": "Bu sektör ve büyüklükteki Türk şirketlerinde ortalama kayıp hakkında 1 cümle",
  "enKritikRisk": "Bu şirket için en büyük finansal tehdidin adı",
  "oneri": "Toplam kaybın büyük bölümünü önlemek için yapılabilecek en kritik tek yatırım (1 cümle)"
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const text = result.text ?? "";
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Finansal kayip error");
    res.status(500).json({ error: "Hesaplama yapılamadı. Lütfen tekrar deneyin." });
  }
});

// ─── MARKA KORUMA / TYPOSQUATTİNG ────────────────────────────────────────────

function generateVariants(domain: string): string[] {
  const variants = new Set<string>();

  // Parse base name and TLD
  let baseName: string;
  let primaryTld: string;

  if (domain.endsWith(".com.tr")) {
    baseName = domain.slice(0, -7);
    primaryTld = ".com.tr";
  } else if (domain.endsWith(".net.tr")) {
    baseName = domain.slice(0, -7);
    primaryTld = ".net.tr";
  } else if (domain.endsWith(".org.tr")) {
    baseName = domain.slice(0, -7);
    primaryTld = ".org.tr";
  } else {
    const dotIdx = domain.lastIndexOf(".");
    baseName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain;
    primaryTld = dotIdx > 0 ? domain.slice(dotIdx) : ".com";
  }

  // Alternative TLDs
  const altTlds = [".com", ".net", ".org", ".io", ".co", ".biz", ".com.tr", ".net.tr", ".org.tr", ".info"];
  for (const tld of altTlds) {
    if (baseName + tld !== domain) variants.add(baseName + tld);
  }

  // Character omission (missing one letter)
  for (let i = 0; i < baseName.length; i++) {
    variants.add(baseName.slice(0, i) + baseName.slice(i + 1) + primaryTld);
  }

  // Character doubling
  for (let i = 0; i < baseName.length; i++) {
    variants.add(baseName.slice(0, i) + baseName[i] + baseName[i] + baseName.slice(i + 1) + primaryTld);
  }

  // Adjacent character swap (transposition)
  for (let i = 0; i < baseName.length - 1; i++) {
    const chars = baseName.split("");
    [chars[i], chars[i + 1]] = [chars[i + 1]!, chars[i]!];
    variants.add(chars.join("") + primaryTld);
  }

  // Common keyboard proximity substitutions
  const subs: Record<string, string[]> = {
    a: ["q", "s", "z"], e: ["r", "w", "3"], i: ["1", "l"], o: ["0", "p"],
    s: ["z", "5"], l: ["1", "i"], g: ["9"], t: ["y"], n: ["m"],
  };
  for (let i = 0; i < baseName.length; i++) {
    const c = baseName[i]!.toLowerCase();
    for (const sub of (subs[c] ?? [])) {
      variants.add(baseName.slice(0, i) + sub + baseName.slice(i + 1) + primaryTld);
    }
  }

  // Hyphenated
  for (let i = 1; i < baseName.length - 1; i++) {
    variants.add(baseName.slice(0, i) + "-" + baseName.slice(i) + primaryTld);
  }

  // Prefix/suffix variants
  variants.add("www" + baseName + primaryTld);
  variants.add(baseName + "-tr" + primaryTld);
  variants.add(baseName + "tr" + primaryTld);
  variants.add(baseName + "-online" + primaryTld);
  variants.add(baseName + "-resmi" + primaryTld);
  variants.add(baseName + "destek" + primaryTld);

  variants.delete(domain);
  return [...variants].slice(0, 70);
}

// POST /api/marka-koruma
router.post("/marka-koruma", async (req: Request, res: Response) => {
  const { domain } = req.body as { domain?: string };

  if (!domain) {
    res.status(400).json({ error: "Alan adı zorunludur" });
    return;
  }

  const cleanDomain = domain.toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();

  const variants = generateVariants(cleanDomain);

  const results = await Promise.allSettled(
    variants.map(async (variant) => {
      try {
        const addrs = await Promise.race<string[]>([
          dnsPromises.resolve(variant, "A"),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
        ]);
        return { domain: variant, registered: true, ips: addrs };
      } catch {
        return { domain: variant, registered: false, ips: [] };
      }
    })
  );

  const checked = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { domain: variants[i]!, registered: false, ips: [] }
  );

  const registered = checked.filter(r => r.registered);
  const notRegistered = checked.filter(r => !r.registered);

  const riskLevel =
    registered.length === 0 ? "Düşük" :
    registered.length <= 3  ? "Orta" : "Yüksek";

  res.json({
    originalDomain: cleanDomain,
    totalChecked: checked.length,
    registeredCount: registered.length,
    registered,
    safeVariants: notRegistered.slice(0, 15),
    riskLevel,
  });
});

// ─── TEDARİK ZİNCİRİ TPRM ────────────────────────────────────────────────────

async function quickCheckSPF(domain: string): Promise<boolean> {
  try {
    const records = await dnsPromises.resolveTxt(domain);
    return records.some(r => r.join("").startsWith("v=spf1"));
  } catch { return false; }
}

async function quickCheckDMARC(domain: string): Promise<boolean> {
  try {
    const records = await dnsPromises.resolveTxt(`_dmarc.${domain}`);
    return records.some(r => r.join("").startsWith("v=DMARC1"));
  } catch { return false; }
}

async function quickCheckMX(domain: string): Promise<boolean> {
  try {
    const records = await dnsPromises.resolveMx(domain);
    return records.length > 0;
  } catch { return false; }
}

async function quickCheckSSL(domain: string): Promise<{ pass: boolean; daysUntilExpiry: number | null }> {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: domain, port: 443, method: "HEAD", timeout: 6000, rejectUnauthorized: true },
      (res) => {
        try {
          const cert = (res.socket as { getPeerCertificate?: () => { valid_to?: string } }).getPeerCertificate?.();
          if (cert?.valid_to) {
            const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
            resolve({ pass: days > 14, daysUntilExpiry: days });
          } else {
            resolve({ pass: false, daysUntilExpiry: null });
          }
        } catch { resolve({ pass: false, daysUntilExpiry: null }); }
      }
    );
    req.on("error", () => resolve({ pass: false, daysUntilExpiry: null }));
    req.on("timeout", () => { req.destroy(); resolve({ pass: false, daysUntilExpiry: null }); });
    req.end();
  });
}

async function quickCheckDNS(domain: string): Promise<boolean> {
  try {
    await dnsPromises.resolve(domain, "A");
    return true;
  } catch { return false; }
}

interface SupplierScanResult {
  domain: string;
  reachable: boolean;
  spf: boolean;
  dmarc: boolean;
  mx: boolean;
  ssl: boolean;
  sslDays: number | null;
  score: number;
}

async function scanSupplier(domain: string): Promise<SupplierScanResult> {
  const clean = domain.toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();

  const [reachable, spf, dmarc, mx, ssl] = await Promise.all([
    quickCheckDNS(clean),
    quickCheckSPF(clean),
    quickCheckDMARC(clean),
    quickCheckMX(clean),
    quickCheckSSL(clean),
  ]);

  const score = (spf ? 20 : 0) + (dmarc ? 25 : 0) + (mx ? 10 : 0) + (ssl.pass ? 25 : 0) + (reachable ? 20 : 0);

  return { domain: clean, reachable, spf, dmarc, mx, ssl: ssl.pass, sslDays: ssl.daysUntilExpiry, score };
}

// POST /api/tedarik-zinciri
router.post("/tedarik-zinciri", async (req: Request, res: Response) => {
  const { companyName, sector, suppliers } = req.body as {
    companyName?: string;
    sector?: string;
    suppliers?: string[];
  };

  if (!sector || !suppliers || suppliers.length === 0) {
    res.status(400).json({ error: "Sektör ve en az bir tedarikçi domain'i zorunludur" });
    return;
  }
  if (suppliers.length > 10) {
    res.status(400).json({ error: "En fazla 10 tedarikçi domain'i taranabilir" });
    return;
  }

  // Scan all suppliers in parallel
  const scanResults = await Promise.all(suppliers.map(scanSupplier));

  const supplierSummary = scanResults.map(r => ({
    domain: r.domain,
    score: r.score,
    reachable: r.reachable,
    spf: r.spf,
    dmarc: r.dmarc,
    mx: r.mx,
    ssl: r.ssl,
    sslDays: r.sslDays,
  }));

  const prompt = `Sen Türkiye'deki işletmeler için tedarik zinciri siber güvenlik risk analistsin.

Müşteri şirket: ${companyName ?? "belirtilmedi"}, ${sector} sektörü

Tedarikçi domain tarama sonuçları (puan 0-100):
${supplierSummary.map(s => `
- ${s.domain}: Skor ${s.score}/100
  DNS/Erişilebilir: ${s.reachable ? "Evet" : "Hayır"}
  SPF (sahte mail koruması): ${s.spf ? "Var" : "YOK"}
  DMARC (e-posta doğrulama): ${s.dmarc ? "Var" : "YOK"}
  MX (mail sunucusu): ${s.mx ? "Var" : "Yok"}
  SSL (HTTPS sertifikası): ${s.ssl ? "Geçerli" + (s.sslDays ? ` (${s.sslDays} gün)` : "") : "YOK/Geçersiz"}
`).join("")}

Her tedarikçi için risk seviyesi belirle ve müşteri şirkete somut tehdit senaryoları oluştur.
SPF ve DMARC yoksa: tedarikçi adına sahte e-posta gönderilebilir → müşteri CEO fraud saldırısına maruz kalabilir.
SSL yoksa: bağlantılar şifresiz, veri sızıntısı riski var.

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "genel": {
    "ortalamaSkor": 65,
    "riskSeviyesi": "Orta",
    "ozet": "Tedarik zincirine genel bakış — 2-3 cümle"
  },
  "tedarikciRaporlari": [
    {
      "domain": "example.com",
      "riskSeviyesi": "Yüksek",
      "riskPuani": 30,
      "kritikBulgular": ["SPF kaydı yok — sahte e-posta riski", "DMARC yok — CEO fraud saldırısına açık"],
      "tehditSenaryosu": "Bu tedarikçi adına sahte fatura e-postası gönderilebilir...",
      "onerilen Aksiyon": "Bu tedarikçiden gelen tüm ödeme taleplerini telefon ile teyit edin"
    }
  ],
  "avrupaAlicilariNotu": "Bu şirketin ihracat yaptığı varsayımıyla, Avrupalı alıcıların beklediği tedarikçi güvenlik standardları hakkında 1-2 cümle",
  "oncelikliAksiyonlar": [
    "Aksiyon 1 — kime ne yapılacak",
    "Aksiyon 2",
    "Aksiyon 3"
  ]
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const text = result.text ?? "";
    const aiData = JSON.parse(text);

    res.json({ scanResults: supplierSummary, ai: aiData });
  } catch (err) {
    logger.error({ err }, "Tedarik zinciri error");
    res.status(500).json({ error: "Analiz yapılamadı. Lütfen tekrar deneyin." });
  }
});

// ─── BENCHMARK AI ────────────────────────────────────────────────────────────

// POST /api/benchmark-ai
router.post("/benchmark-ai", async (req: Request, res: Response) => {
  const { sector, employees, userScore, avgScore, topScore, percentile } = req.body as {
    sector?: string;
    employees?: string;
    userScore?: number;
    avgScore?: number;
    topScore?: number;
    percentile?: number;
  };

  if (!sector || userScore === undefined || avgScore === undefined) {
    res.status(400).json({ error: "Eksik parametre" });
    return;
  }

  const prompt = `Sen Türkiye işletme siber güvenlik danışmanısın. Sert, patron diline yakın, harekete geçirici yaz.

Şirket profili:
- Sektör: ${sector}
- Çalışan bandı: ${employees ?? "belirtilmedi"}
- Siber güvenlik puanı: ${userScore}/100
- Bu sektörün ortalaması: ${avgScore}/100
- Bu sektörün lideri: ${topScore}/100
- Bu şirketin yüzdelik dilimi: ${percentile ? `%${percentile} (şirketlerin %${100 - percentile}'i bu şirketi geçiyor)` : "hesaplanamadı"}

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "baslik": "Güçlü, kişiselleştirilmiş başlık — rakamları kullan",
  "ana_mesaj": "En güçlü cümle — sektördeki konumunu, rakip şirket oranını, bunun ne anlama geldiğini anlat. 2-3 cümle.",
  "geri_biraktan_2_faktor": [
    { "faktor": "Faktör adı", "aciklama": "Bu faktörün bu şirketi nasıl geride bıraktığını anlat" },
    { "faktor": "Faktör adı", "aciklama": "Bu faktörün bu şirketi nasıl geride bıraktığını anlat" }
  ],
  "onenin_anlami": "Sektör ortalamasının üstüne çıkmanın bu şirkete ne kazandıracağını anlat — müşteri güveni, sigorta primi, regülasyon, yatırımcı güveni. 2 cümle.",
  "aciliyetSeviyesi": "Yüksek veya Orta veya Düşük"
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const data = JSON.parse(result.text ?? "{}");
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Benchmark AI error");
    res.status(500).json({ error: "AI analizi yapılamadı" });
  }
});

// ─── GÜVEN ROZETİ ─────────────────────────────────────────────────────────────

// In-memory cache: domain → { score, riskLevel, scannedAt }
const badgeCache = new Map<string, { score: number; riskLevel: string; spf: boolean; dmarc: boolean; ssl: boolean; scannedAt: number }>();
const BADGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runBadgeScan(domain: string) {
  const [spf, dmarc, mx, ssl] = await Promise.all([
    quickCheckSPF(domain),
    quickCheckDMARC(domain),
    quickCheckMX(domain),
    quickCheckSSL(domain),
  ]);
  const score = (spf ? 25 : 0) + (dmarc ? 30 : 0) + (mx ? 10 : 0) + (ssl.pass ? 35 : 0);
  const riskLevel = score >= 70 ? "Düşük Risk" : score >= 40 ? "Orta Risk" : "Yüksek Risk";
  return { score, riskLevel, spf, dmarc, ssl: ssl.pass, scannedAt: Date.now() };
}

function makeBadgeSVG(domain: string, score: number, riskLevel: string, scannedAt: number): string {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const bgColor = score >= 70 ? "#052e16" : score >= 40 ? "#1c1007" : "#1c0606";
  const date = new Date(scannedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const shortDomain = domain.length > 22 ? domain.slice(0, 20) + "…" : domain;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="88" role="img" aria-label="CyberStep Güvenlik Rozeti">
  <title>CyberStep Güvenlik Rozeti — ${domain}</title>
  <rect width="220" height="88" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
  <rect x="1" y="1" width="218" height="86" rx="9" fill="${bgColor}" opacity="0.35"/>
  <text x="12" y="20" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="1">CYBERSTEP.IO</text>
  <text x="12" y="40" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">${shortDomain}</text>
  <text x="12" y="60" font-family="system-ui,sans-serif" font-size="11" fill="#94a3b8">Güvenlik Skoru</text>
  <text x="12" y="78" font-family="system-ui,sans-serif" font-size="10" fill="#475569">Son tarama: ${date}</text>
  <text x="165" y="55" font-family="system-ui,sans-serif" font-size="26" font-weight="800" fill="${color}" text-anchor="middle">${score}</text>
  <text x="165" y="68" font-family="system-ui,sans-serif" font-size="9" fill="${color}" text-anchor="middle" font-weight="600">${riskLevel.toUpperCase()}</text>
</svg>`;
}

// GET /api/guven-rozeti/:domain — JSON result
router.get("/guven-rozeti/:domain", async (req: Request, res: Response) => {
  const domain = (req.params["domain"] as string | undefined)?.toLowerCase().trim() ?? "";
  if (!domain) { res.status(400).json({ error: "Domain zorunludur" }); return; }

  const cached = badgeCache.get(domain);
  if (cached && Date.now() - cached.scannedAt < BADGE_TTL_MS) {
    res.json({ ...cached, domain, cached: true });
    return;
  }

  try {
    const result = await runBadgeScan(domain);
    badgeCache.set(domain, result);
    res.json({ ...result, domain, cached: false });
  } catch (err) {
    logger.error({ err }, "Badge scan error");
    res.status(500).json({ error: "Tarama yapılamadı" });
  }
});

// GET /api/guven-rozeti/:domain/badge.svg — SVG image
router.get("/guven-rozeti/:domain/badge.svg", async (req: Request, res: Response) => {
  const domain = (req.params["domain"] as string | undefined)?.toLowerCase().trim() ?? "";
  if (!domain) { res.status(400).send("Domain required"); return; }

  let data = badgeCache.get(domain);
  if (!data || Date.now() - data.scannedAt > BADGE_TTL_MS) {
    try {
      data = await runBadgeScan(domain);
      badgeCache.set(domain, data);
    } catch {
      data = { score: 0, riskLevel: "Bilinmiyor", spf: false, dmarc: false, ssl: false, scannedAt: Date.now() };
    }
  }

  const svg = makeBadgeSVG(domain, data.score, data.riskLevel, data.scannedAt);
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(svg);
});

// ─── DORA / BDDK / SPK / EPDK UYUM ANALİZİ ──────────────────────────────────

const DOMAIN_REGULATION_CONTEXT = `
Alan A (Yönetişim/Envanter):
  BDDK BSY: Md.5 (YK sorumluluğu), Md.6 (Bilgi Güvenliği Politikası), Md.8 (Organizasyon)
  SPK VIII/54: Md.4 (Yönetim), Md.5 (İç denetim)
  EPDK: Md.6 (Yönetim yapısı), Md.8 (Kritik varlık envanteri)
  DORA: Art.5 (ICT Risk Management Framework), Art.6 (Risk sistemi), Art.7 (Sürekli iyileştirme)

Alan B (Kimlik/Erişim):
  BDDK BSY: Md.12 (Kimlik yönetimi), Md.13 (Erişim kontrolü)
  SPK VIII/54: Md.9 (Erişim), Md.10 (Kimlik doğrulama)
  EPDK: Md.12 (OT/IT erişim ayrımı), Md.13 (Uzak erişim)
  DORA: Art.9.2 (Kimlik doğrulama), Art.9.3 (Ayrıcalıklı erişim)

Alan C (E-posta/Farkındalık):
  BDDK BSY: Md.20 (Eğitim), Md.21 (Farkındalık)
  SPK VIII/54: Md.15 (Personel eğitimi)
  EPDK: Md.18 (Yıllık eğitim)
  DORA: Art.13 (Farkındalık programı)

Alan D (Cihaz/Uç Nokta):
  BDDK BSY: Md.14 (Varlık yönetimi), Md.15 (Güvenlik açığı tarama), Md.16 (Yama yönetimi)
  SPK VIII/54: Md.11 (Uç nokta), Md.12 (Yazılım güncelleme)
  EPDK: Md.14 (SCADA/OT cihaz), Md.15 (Ağ segmentasyonu)
  DORA: Art.9.4 (ICT güvenlik politikaları), Art.10 (Tehdit tespiti)

Alan E (Veri/Yedek/Olay):
  BDDK BSY: Md.18 (İş sürekliliği), Md.19 (Yedekleme testleri), Md.22 (Olay bildirim — 4 saat)
  SPK VIII/54: Md.17 (Felaket kurtarma), Md.18 (Düzenleyiciye bildirim)
  EPDK: Md.19 (Kesinti planı), Md.20 (Olay müdahale), Md.21 (Bildirim)
  DORA: Art.11 (Felaket kurtarma), Art.12 (İş sürekliliği), Art.19 (Olay raporlama zaman çerçeveleri)
`;

// POST /api/dora-bddk-uyum
router.post("/dora-bddk-uyum", async (req: Request, res: Response) => {
  const { regulators, sector, score } = req.body as {
    regulators?: string[];
    sector?: string;
    score?: number;
  };

  if (!regulators?.length || !sector || score === undefined) {
    res.status(400).json({ error: "Eksik parametre" });
    return;
  }

  const segment = score >= 70 ? "İleri" : score >= 40 ? "Gelişmekte" : "Temel";
  const regList = regulators.join(", ");

  const prompt = `Sen bir Türkiye siber güvenlik hukuk ve regülasyon danışmanısın.

Şirket profili:
- Sektör: ${sector}
- Seçilen regülasyonlar: ${regList}
- Siber güvenlik puanı: ${score}/100 (Segment: ${segment})

Alan-regülasyon eşlemesi:
${DOMAIN_REGULATION_CONTEXT}

${segment === "Temel" ? "Bu şirket Temel segmentte — regülasyon uyumu açısından ciddi riskler taşıyor." : ""}
${segment === "Gelişmekte" ? "Bu şirket Gelişmekte segmentinde — bazı regülasyon eksiklikleri var." : ""}
${segment === "İleri" ? "Bu şirket İleri segmentinde — temel uyum iyi, ince noktalara dikkat gerekiyor." : ""}

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "genel": {
    "uyumSkoru": 65,
    "oncelikliRegulasyon": "BDDK",
    "ozet": "Şirketin regülasyon uyum durumuna genel bakış — 2-3 cümle, somut risk ile başla"
  },
  "domainAnalizleri": [
    {
      "domain": "A",
      "baslik": "Yönetişim ve Envanter",
      "uyumDurumu": "Kısmen",
      "kritikEksikler": ["Yönetim kurulu düzeyinde BT risk sorumluluğu tanımlanmamış — BSY Md.5 ihlali", "Bilgi Güvenliği Politikası yazılı değil — BSY Md.6 gereksinimi"],
      "acilAksiyon": "30 gün içinde YK kararıyla bir Bilgi Güvenliği Komitesi kurun ve BSY Md.5 uyumunu belgeleyin"
    },
    { "domain": "B", "baslik": "Kimlik ve Erişim", "uyumDurumu": "Uyumlu", "kritikEksikler": [], "acilAksiyon": "..." },
    { "domain": "C", "baslik": "E-posta ve Farkındalık", "uyumDurumu": "Eksik", "kritikEksikler": ["..."], "acilAksiyon": "..." },
    { "domain": "D", "baslik": "Cihaz ve Uç Nokta", "uyumDurumu": "Kısmen", "kritikEksikler": ["..."], "acilAksiyon": "..." },
    { "domain": "E", "baslik": "Veri Koruma ve Olay Hazırlığı", "uyumDurumu": "Eksik", "kritikEksikler": ["..."], "acilAksiyon": "..." }
  ],
  "duzenleyiciUyari": "Bu skor seviyesinde ${regList} denetçisi denetim başlatırsa olası yaptırım ve itibar riskini 1-2 cümle ile anlat",
  "yolHaritasi": [
    "1. aksyon — hangi madde, hangi süre",
    "2. aksiyon",
    "3. aksiyon",
    "4. aksiyon",
    "5. aksiyon"
  ]
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    res.json(JSON.parse(result.text ?? "{}"));
  } catch (err) {
    logger.error({ err }, "DORA/BDDK uyum analiz error");
    res.status(500).json({ error: "Analiz yapılamadı" });
  }
});

export default router;
