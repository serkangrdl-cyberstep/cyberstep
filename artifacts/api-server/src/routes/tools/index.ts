import { Router } from "express";
import type { Request, Response } from "express";
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

  const prompt = `Sen Türkiye'deki KOBİ'ler için siber güvenlik risk simülatörüsün.

Şirket profili:
- Sektör: ${sector}
- Çalışan sayısı: ${employeeCount}
- Yıllık ciro: ${annualRevenue ? annualRevenue + " TL" : "belirtilmedi"}
- Bilinen teknik riskler: ${knownRisks || "genel KOBİ profili"}

Bu şirkete yönelik gerçekçi bir siber saldırı senaryosu oluştur. Saldırgan bakış açısından anlat.
Türkiye KOBİ pazarında gerçekleşen olaylara dayalı somut veriler kullan.

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

  const prompt = `Türkiye'deki bir KOBİ için siber saldırı finansal etki analizi yap.

Şirket: ${sector} sektörü, ${employeeCount} çalışan, yıllık ${annualRevenue} TL ciro
Tespit edilen riskler: ${riskler?.join(", ") || "Genel risk profili"}

IBM Cost of Data Breach 2024, Verizon DBIR 2024 ve Türkiye'deki KOBİ siber olay verilerini referans alarak
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

export default router;
