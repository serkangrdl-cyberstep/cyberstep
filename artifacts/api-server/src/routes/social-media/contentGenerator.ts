// ─── Sosyal Medya İçerik Üretici ──────────────────────────────────────────────
// Claude Haiku ile haftalık içerik üretimi, revizyon ve spontane içerik.

import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logAiCost, calcCost } from "../../services/aiCostTracker";
import { db } from "@workspace/db";
import {
  socialMediaPostsTable,
  contentCalendarTable,
  specialDaysTable,
  type SpecialDay,
} from "@workspace/db";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import { logger } from "../../lib/logger";

const HAIKU = "claude-haiku-4-5";

const SYSTEM_PROMPT = `Sen CyberStep.io'nun sosyal medya editörüsün.
Türkiye'nin bağımsız siber güvenlik platformu.

Marka sesi:
  - Otoriter ama erişilebilir
  - Veri odaklı (rakamlar kullan)
  - Korku değil, farkındalık
  - Türkçe, akıcı, doğal
  - Asla "hizmet satın alın" tonu

Platform kuralları:
  LinkedIn: Profesyonel, içgörü odaklı, 1200 karakter max
  Instagram: Görsel hikaye, kısa metin, hashtag
  X: Hızlı, keskin, 280 karakter max per tweet

Her zaman:
  Veri varsa sayı kullan
  CTA ücretsiz olsun (tarama, rapor)
  cyberstep.io referansı ver`;

async function callHaiku(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<{ text: string; costUsd: number }> {
  const msg = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const costUsd = calcCost(HAIKU, msg.usage.input_tokens, msg.usage.output_tokens);
  logAiCost({
    service: "social_media",
    model: HAIKU,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }).catch(() => {});
  const block = msg.content[0];
  return { text: block?.type === "text" ? block.text : "", costUsd };
}

export interface ScanStats {
  totalScans: number;
  avgScore: number;
  spfFailPct: number;
  dmarcFailPct: number;
  hibpBreachPct: number;
  riskyDomains: number;
  topIssues: string[];
}

async function getWeeklyScanStats(): Promise<ScanStats> {
  try {
    const [mainRows, issueRows] = await Promise.all([
      db.execute(`
        SELECT
          COUNT(*)                                                                             AS total,
          ROUND(AVG(overall_score))                                                           AS avg_score,
          ROUND(100.0 * SUM(CASE WHEN spf_pass  = false THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS spf_fail_pct,
          ROUND(100.0 * SUM(CASE WHEN dmarc_pass = false THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS dmarc_fail_pct,
          ROUND(100.0 * SUM(CASE WHEN hibp_breach_count > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS hibp_pct,
          SUM(CASE WHEN overall_score < 60 THEN 1 ELSE 0 END)                                AS risky_domains
        FROM domain_scans
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      db.execute(`
        SELECT issue, cnt FROM (
          SELECT 'DMARC kaydı eksik'        AS issue, SUM(CASE WHEN dmarc_pass = false           THEN 1 ELSE 0 END) AS cnt FROM domain_scans WHERE created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'SPF kaydı eksik',                   SUM(CASE WHEN spf_pass  = false            THEN 1 ELSE 0 END)        FROM domain_scans WHERE created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'SSL sertifikası yakın/geçersiz',    SUM(CASE WHEN ssl_days_until_expiry < 30   THEN 1 ELSE 0 END)        FROM domain_scans WHERE created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'Kara listeye alınmış domain',       SUM(CASE WHEN blacklisted = true           THEN 1 ELSE 0 END)        FROM domain_scans WHERE created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'Veri ihlali tespit edildi (HIBP)',  SUM(CASE WHEN hibp_breach_count > 0        THEN 1 ELSE 0 END)        FROM domain_scans WHERE created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'HTTP güvenlik başlıkları eksik',    SUM(CASE WHEN http_headers_score < 50      THEN 1 ELSE 0 END)        FROM domain_scans WHERE created_at >= NOW() - INTERVAL '7 days'
        ) t
        WHERE cnt > 0
        ORDER BY cnt DESC
        LIMIT 3
      `),
    ]);

    const r = (mainRows.rows as Array<Record<string, unknown>>)[0] ?? {};
    const topIssues = (issueRows.rows as Array<{ issue: string; cnt: unknown }>).map(
      (row) => `${row.issue} (%${Math.round(Number(row.cnt) / Math.max(Number(r["total"] ?? 1), 1) * 100)})`
    );

    return {
      totalScans:   Number(r["total"]         ?? 0),
      avgScore:     Number(r["avg_score"]      ?? 0),
      spfFailPct:   Number(r["spf_fail_pct"]   ?? 0),
      dmarcFailPct: Number(r["dmarc_fail_pct"] ?? 0),
      hibpBreachPct:Number(r["hibp_pct"]       ?? 0),
      riskyDomains: Number(r["risky_domains"]  ?? 0),
      topIssues,
    };
  } catch {
    return { totalScans: 0, avgScore: 0, spfFailPct: 0, dmarcFailPct: 0, hibpBreachPct: 0, riskyDomains: 0, topIssues: [] };
  }
}

function getSpecialDaysForWeek(weekStart: Date, specials: SpecialDay[]): Array<SpecialDay & { date: Date }> {
  const results: Array<SpecialDay & { date: Date }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    for (const s of specials) {
      if (s.day === d.getDate() && s.month === (d.getMonth() + 1)) {
        results.push({ ...s, date: d });
      }
    }
  }
  return results;
}

const TIP_TOPICS = [
  "DMARC yapılandırması",
  "Güçlü şifre politikası",
  "Çok faktörlü doğrulama",
  "SSL sertifika yönetimi",
  "Phishing tespiti",
  "Yedekleme stratejisi",
  "Güvenli DNS yapılandırması",
  "Firewall kural temizliği",
  "Çalışan güvenlik farkındalığı",
  "VPN güvenli kullanım",
  "Patch yönetimi",
  "Dark web izleme",
];

function getISOWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatStats(stats: ScanStats): string {
  const issueList = stats.topIssues.length
    ? stats.topIssues.join(", ")
    : "yeterli veri yok";
  return `Bu hafta ${stats.totalScans} Türk şirketi tarandı.
Ortalama güvenlik skoru: ${stats.avgScore}/100
Riskli şirket sayısı (skor < 60): ${stats.riskyDomains}
En yaygın 3 açık: ${issueList}
SPF kaydı eksik: %${stats.spfFailPct}
DMARC kaydı eksik: %${stats.dmarcFailPct}
Veri ihlali tespit edilen: %${stats.hibpBreachPct}`;
}

function buildWeeklySystemPrompt(stats: ScanStats): string {
  const issueList = stats.topIssues.length
    ? stats.topIssues.join("; ")
    : "çeşitli güvenlik açıkları";
  return `## Türkiye Siber Güvenlik Pazar Verileri (Fortinet/DORinsight 2025)
- Türkiye'deki kurumların %65,2'si son 12 ayda en az bir siber saldırıya uğradı
- Saldırıya maruz kalanlar ortalama 14,6 farklı saldırıyla karşılaştı
- Kurumların %40,9'u mevcut güvenlik altyapısının yetersiz olduğunu düşünüyor
- %53,3'ü nitelikli uzman eksikliği nedeniyle güvenlik seviyesini artıramıyor
- %44,3'ü OT güvenlik seviyesini "yetersiz" veya "gelişmekte" olarak değerlendiriyor
- %88'i AI tabanlı güvenlik çözümlerini kullanıyor veya kullanmayı planlıyor
- %68,7'si önümüzdeki dönemde düzenlemelerin artacağını öngörüyor
Kaynak: Fortinet Türkiye / DORinsight 2025 Türkiye Siber Güvenlik Araştırması.
Bu verileri içeriklerde referans olarak kullan. Özellikle "%65 saldırı oranı", "uzman eksikliği", "AI güvenlik ilgisi" istatistiklerini merak uyandıran başlıklarda ve argümanlarda kullan.

${SYSTEM_PROMPT}

HAFTALIK TARAMA VERİSİ (sistem bağlamı — içerikte mutlaka kullan):
Bu hafta ${stats.totalScans} Türk şirketi tarandı. Ortalama skor: ${stats.avgScore}/100. ${stats.riskyDomains} şirkette kritik açık tespit edildi. En yaygın sorunlar: ${issueList}. Bu verileri kullanarak LinkedIn ve Instagram için etkileyici, merak uyandıran Türkçe içerik üret.`;
}

function buildVisualSVG(platform: string, caption: string): string {
  const firstLine = caption.split("\n")[0].replace(/[^\w\s.,!?%-]/g, "").trim().slice(0, 55);
  const w = platform === "x" ? 1200 : 1080;
  const h = platform === "linkedin" ? 628 : 1080;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#060D1A"/>
      <stop offset="100%" stop-color="#0A1628"/>
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="25%" r="40%">
      <stop offset="0%" stop-color="#00C8FF" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#00C8FF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${w}" height="6" fill="#00C8FF" opacity="0.8"/>
  <rect x="0" y="0" width="6" height="${h}" fill="#00C8FF" opacity="0.5"/>
  <text x="${w * 0.08}" y="${h * 0.12}" font-family="Arial,sans-serif" font-size="${w * 0.04}" font-weight="900" fill="#E8EDF5">Cyber</text>
  <text x="${w * 0.08 + w * 0.165}" y="${h * 0.12}" font-family="Arial,sans-serif" font-size="${w * 0.04}" font-weight="900" fill="#00C8FF">Step</text>
  <text x="${w * 0.08 + w * 0.285}" y="${h * 0.12}" font-family="Arial,sans-serif" font-size="${w * 0.022}" fill="#7B8FAF">.io</text>
  <text x="${w * 0.08}" y="${h * 0.48}" font-family="Arial,sans-serif" font-size="${Math.min(w * 0.045, 48)}" font-weight="700" fill="#E8EDF5">${firstLine.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>
  <rect x="0" y="${h * 0.88}" width="${w}" height="${h * 0.12}" fill="#111F35" opacity="0.8"/>
  <text x="${w * 0.08}" y="${h * 0.955}" font-family="Arial,sans-serif" font-size="${w * 0.022}" fill="#7B8FAF">Turkiye'nin Siber Guvenlik Risk Platformu</text>
  <text x="${w * 0.92}" y="${h * 0.955}" text-anchor="end" font-family="Arial,sans-serif" font-size="${w * 0.022}" fill="#00C8FF">cyberstep.io</text>
</svg>`;
}

async function generatePostText(
  platform: string,
  postType: string,
  stats: ScanStats,
  specialDay?: SpecialDay,
  spontaneousTopic?: string,
  spontaneousNotes?: string,
  systemPromptOverride?: string,
): Promise<{ caption: string; hashtags: string[]; costUsd: number; isThread?: boolean }> {
  const activeSystemPrompt = systemPromptOverride ?? SYSTEM_PROMPT;
  let userPrompt = "";

  if (platform === "x") {
    userPrompt = `Platform: X (Twitter)
İçerik tipi: ${postType === "data_insight" ? "Haftalık veri insight" : postType === "special_day" && specialDay ? `Özel gün: ${specialDay.name}` : "Güvenlik ipucu"}
${postType === "data_insight" ? `\nBu hafta CyberStep verisi:\n${formatStats(stats)}` : ""}

5 tweet'lik thread yaz. Her tweet max 280 karakter.
- Tweet 1 (Hook): Bağımsız değer taşımalı, "🧵" ile bitmeli
- Tweet 2: Problemi somutlaştır, Türkiye verisi kullan
- Tweet 3: En şaşırtıcı istatistik veya gerçek
- Tweet 4: Pratik, hemen uygulanabilir öneri
- Tweet 5: cyberstep.io ücretsiz tarama linki + 3-4 hashtag

Tweet'leri "---" ile ayır. Sadece tweet metinlerini yaz, numara veya etiket ekleme.`;
    const { text, costUsd } = await callHaiku(activeSystemPrompt, userPrompt, 800);
    const hashtags = text.match(/#[\w]+/g) ?? [];
    return { caption: text, hashtags, costUsd, isThread: true };
  }

  if (postType === "special_day" && specialDay) {
    userPrompt = `Platform: ${platform}
İçerik tipi: Özel gün paylaşımı
Özel gün: ${specialDay.name}
Ton: ${specialDay.tone ?? "celebratory"}
Siber güvenlik açısı: ${specialDay.cybersecurityAngle ?? ""}
Tarih: ${new Date().toLocaleDateString("tr-TR")}

Bu özel gün için ${platform} platformuna özgü bir paylaşım yaz.
Satış tonu kesinlikle yok. Hashtag listesi ver.`;
  } else if (postType === "data_insight") {
    userPrompt = `Platform: ${platform}
İçerik tipi: Haftalık veri insight
Tarih: ${new Date().toLocaleDateString("tr-TR")}

Bu hafta CyberStep verisi:
${formatStats(stats)}

${platform === "linkedin" ? "Başlık cümlesi (FOMO yaratacak), 3-4 madde (rakamlarla), CTA, 5-7 hashtag" : ""}
${platform === "instagram" ? "Emoji ile güçlü açılış, 2-3 kısa madde, soru ile kapanış, 10-12 hashtag" : ""}`;
  } else if (postType === "spontaneous" && spontaneousTopic) {
    userPrompt = `Platform: ${platform}
Konu: ${spontaneousTopic}
Ek notlar: ${spontaneousNotes ?? ""}

Bu konu için ${platform} platformuna özgü paylaşım yaz.
CyberStep marka sesiyle. Hashtag listesi ver.`;
  } else {
    const weekNum = getISOWeek(new Date());
    const topic = TIP_TOPICS[weekNum % TIP_TOPICS.length];
    userPrompt = `Platform: ${platform}
İçerik tipi: Güvenlik ipucu
Konu: ${topic}

Bu konuda ${platform} platformuna özgü eğitici içerik yaz.
Pratik, uygulanabilir. Hashtag listesi ver.`;
  }

  const { text, costUsd } = await callHaiku(activeSystemPrompt, userPrompt);

  const hashtagMatch = text.match(/#[\w]+/g);
  const hashtags = hashtagMatch ?? [];
  const caption = text.replace(/#[\w]+/g, "").trim();

  return { caption, hashtags, costUsd };
}

export async function generateWeeklyContent(weekStart: Date, calendarId: number): Promise<void> {
  const stats = await getWeeklyScanStats();
  const weeklySystemPrompt = buildWeeklySystemPrompt(stats);
  const allSpecials = await db.select().from(specialDaysTable).where(eq(specialDaysTable.isActive, true));
  const weekSpecials = getSpecialDaysForWeek(weekStart, allSpecials);

  const dayOffsets: Record<string, number[]> = {
    linkedin:  [0, 2, 4],
    instagram: [0, 1, 3, 5],
    x:         [0, 1, 2, 3, 4],
  };

  for (const [platform, offsets] of Object.entries(dayOffsets)) {
    for (let i = 0; i < offsets.length; i++) {
      const postDate = new Date(weekStart);
      postDate.setDate(postDate.getDate() + offsets[i]);

      const specialDay = weekSpecials.find(s => s.date.toDateString() === postDate.toDateString());
      const postType = specialDay ? "special_day" : (i === 0 || i === 2 ? "data_insight" : "security_tip");

      try {
        const { caption: rawCaption, hashtags, costUsd, isThread } = await generatePostText(platform, postType, stats, specialDay, undefined, undefined, weeklySystemPrompt);
        const imageSvg = buildVisualSVG(platform, rawCaption);
        const dim = platform === "linkedin" ? "1200x628" : platform === "x" ? "1200x675" : "1080x1080";

        let caption = rawCaption;
        let threadTweets: string[] | undefined;
        if (isThread && rawCaption) {
          const tweets = rawCaption.split("---").map((t: string) => t.trim()).filter(Boolean);
          threadTweets = tweets;
          caption = tweets[0] ?? rawCaption;
        }

        await db.insert(socialMediaPostsTable).values({
          calendarId,
          platform,
          postType,
          scheduledDate: postDate.toISOString().split("T")[0],
          caption,
          hashtags,
          imageSvg,
          imageDimensions: dim,
          status: "draft",
          specialDayId: specialDay?.id ?? null,
          dataSource: postType === "data_insight" ? "scan_stats" : "manual",
          generationCostUsd: costUsd.toFixed(6),
          ...(threadTweets ? { threadTweets } : {}),
        });

        logger.info({ platform, postType, date: postDate.toISOString().split("T")[0] }, "Sosyal medya içeriği üretildi");
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        logger.error({ err, platform, postType }, "İçerik üretim hatası");
      }
    }
  }

  await db.update(contentCalendarTable).set({
    status: "generated",
    generatedAt: new Date(),
  }).where(eq(contentCalendarTable.id, calendarId));
}

export async function revisePost(postId: number, revisionNote: string): Promise<void> {
  const [post] = await db.select().from(socialMediaPostsTable).where(eq(socialMediaPostsTable.id, postId));
  if (!post) throw new Error("Post bulunamadı");

  const userPrompt = `Platform: ${post.platform}
Mevcut metin:
---
${post.caption}
---
Hashtags: ${post.hashtags?.join(" ")}

İnsan düzeltme notu:
"${revisionNote}"

Bu notla metni yeniden yaz. Sadece yeni metni ver, açıklama yok. Hashtag listesi ver.`;

  const { text } = await callHaiku(SYSTEM_PROMPT, userPrompt);
  const hashtagMatch = text.match(/#[\w]+/g);
  const hashtags = hashtagMatch ?? [];
  const caption = text.replace(/#[\w]+/g, "").trim();

  await db.update(socialMediaPostsTable).set({
    caption,
    hashtags,
    status: "draft",
    revisionRequest: revisionNote,
    revisionCount: (post.revisionCount ?? 0) + 1,
    updatedAt: new Date(),
  }).where(eq(socialMediaPostsTable.id, postId));
}

export async function generateSpontaneous(params: {
  platform: "linkedin" | "instagram" | "x";
  topic: string;
  notes?: string;
}): Promise<number> {
  const stats = await getWeeklyScanStats();
  const { caption, hashtags } = await generatePostText(
    params.platform, "spontaneous", stats,
    undefined, params.topic, params.notes,
  );
  const imageSvg = buildVisualSVG(params.platform, caption);
  const dim = params.platform === "linkedin" ? "1200x628" : params.platform === "x" ? "1200x675" : "1080x1080";

  const [post] = await db.insert(socialMediaPostsTable).values({
    platform: params.platform,
    postType: "spontaneous",
    scheduledDate: new Date().toISOString().split("T")[0],
    caption,
    hashtags,
    imageSvg,
    imageDimensions: dim,
    status: "draft",
    dataSource: "manual",
    generationCostUsd: "0.0001",
  }).returning();

  return post.id;
}
