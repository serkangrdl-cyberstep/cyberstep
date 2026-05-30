# CyberStep Haftalık Siber Olay Toplayıcı — Replit Agent Promptu

Aşağıdaki promptu Replit Agent'a ver. Tek seferde çalışır.

---

## REPLIT AGENT PROMPTU (Kopyala-Yapıştır)

Build a full-stack Node.js application called "CyberStep News Aggregator" that automatically collects Turkish cybersecurity news, processes it with Claude AI, and produces weekly digest content.

## Tech Stack
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL with Drizzle ORM
- Scheduler: node-cron
- HTTP client: axios
- RSS parser: rss-parser
- AI: Anthropic Claude API (claude-sonnet-4-20250514)
- Frontend: Simple React dashboard (Vite)
- Email: nodemailer

## Environment Variables Required
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=...
SMTP_USER=...
SMTP_PASS=...
ADMIN_EMAIL=...
PORT=3000
```

---

## DATABASE SCHEMA

Create these PostgreSQL tables using Drizzle ORM:

```typescript
// news_items table
{
  id: serial primary key,
  source_name: varchar(100),
  source_url: text,
  title: text not null,
  content: text,
  url: text unique,
  published_at: timestamp,
  collected_at: timestamp default now(),
  category: varchar(50), // 'official' | 'news' | 'global'
  language: varchar(10) default 'tr',
  relevance_score: integer default 0, // 0-100, set by AI
  is_processed: boolean default false,
  keywords: text[], // extracted keywords
  week_number: integer, // ISO week number
  year: integer
}

// weekly_digests table
{
  id: serial primary key,
  week_number: integer,
  year: integer,
  generated_at: timestamp default now(),
  status: varchar(20) default 'draft', // draft | approved | sent
  approved_at: timestamp,
  
  // AI-generated content
  summary_tr: text, // 300-400 word Turkish summary
  linkedin_post: text,
  twitter_thread: text, // JSON array of tweets
  instagram_caption: text,
  instagram_story_slides: text, // JSON array of 3 slide texts
  
  // Stats
  total_items_processed: integer,
  critical_incidents: integer,
  kvkk_news: integer,
  
  // Raw data
  selected_item_ids: integer[] // which news items were used
}

// sources table
{
  id: serial primary key,
  name: varchar(100),
  url: text unique,
  type: varchar(20), // 'rss' | 'api' | 'scrape'
  category: varchar(20), // 'official' | 'news' | 'global'
  is_active: boolean default true,
  last_fetched: timestamp,
  fetch_count: integer default 0,
  error_count: integer default 0,
  last_error: text
}
```

---

## NEWS SOURCES CONFIGURATION

Seed the sources table with these sources on startup:

```typescript
const SOURCES = [
  // OFFICIAL
  {
    name: "Siber Güvenlik Başkanlığı",
    url: "https://www.siberguvenlik.gov.tr/rss",
    type: "rss",
    category: "official"
  },
  {
    name: "BTK Haberler",
    url: "https://www.btk.gov.tr/haberler/rss",
    type: "rss",
    category: "official"
  },
  
  // TURKISH NEWS
  {
    name: "Siber Bülten",
    url: "https://siberbulten.com/feed/",
    type: "rss",
    category: "news"
  },
  {
    name: "BT Haber",
    url: "https://www.bthaber.com.tr/feed/",
    type: "rss",
    category: "news"
  },
  {
    name: "ShiftDelete",
    url: "https://shiftdelete.net/feed",
    type: "rss",
    category: "news"
  },
  {
    name: "Webrazzi",
    url: "https://webrazzi.com/feed/",
    type: "rss",
    category: "news"
  },
  {
    name: "Haberler.com Teknoloji",
    url: "https://www.haberler.com/rss/teknoloji-haberleri.xml",
    type: "rss",
    category: "news"
  },
  
  // GLOBAL (Turkey coverage)
  {
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    type: "rss",
    category: "global"
  },
  {
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    type: "rss",
    category: "global"
  },
  {
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    type: "rss",
    category: "global"
  }
];
```

---

## CORE MODULES

### 1. RSS Collector (`src/collector/rss.ts`)

```typescript
// Fetch all active RSS sources
// Parse feed items
// Filter by keywords:
const TURKEY_KEYWORDS = [
  'türkiye', 'turkey', 'turkish', 'tr', 'ankara', 'istanbul',
  'kvkk', 'btk', 'usom', 'tübitak', 'siber güvenlik', 'cyber security',
  'veri ihlali', 'data breach', 'fidye', 'ransomware', 'saldırı', 'attack',
  'hack', 'phishing', 'oltalama', 'dolandırıcılık'
];

// For global sources: only save items containing Turkey keywords
// For Turkish sources: save all items
// Deduplicate by URL
// Calculate basic relevance_score (keyword count × 10, max 100)
// Save to news_items table
```

### 2. AI Processor (`src/processor/claude.ts`)

Two AI functions:

**Function A: `scoreAndFilter(items: NewsItem[])`**
Send batch of news items to Claude and get relevance scores + category tags.

Claude prompt for scoring:
```
Sen CyberStep.io'nun tehdit istihbarat editörüsün.
Aşağıdaki haber listesini Türk KOBİ'leri için önem sırasına koy.

Her haber için JSON formatında şunu dön:
{
  "id": number,
  "relevance_score": 0-100,
  "is_relevant": boolean,
  "tags": ["kvkk", "fidye", "veri_ihlali", "kritik_altyapı", "regülasyon", "genel"],
  "one_line_tr": "Türkçe tek cümle özet"
}

Önem kriterleri:
- Türkiye'de gerçekleşen olay: +40 puan
- KOBİ'leri etkiliyor: +20 puan
- KVKK / regülasyon ile ilgili: +20 puan
- Fidye yazılımı / veri ihlali: +15 puan
- Kritik altyapı: +15 puan

Sadece JSON array dön, başka açıklama ekleme.

Haberler:
${JSON.stringify(items.map(i => ({ id: i.id, title: i.title, content: i.content?.substring(0, 300) })))}
```

**Function B: `generateWeeklyDigest(items: NewsItem[])`**
Generate full weekly content from top-scored items.

Claude prompt for digest:
```
Sen CyberStep.io'nun içerik direktörüsün.
Bu haftanın en önemli Türkiye siber güvenlik haberlerinden
haftalık bülten ve sosyal medya içerikleri üret.

Haberler (önem sırasıyla):
${JSON.stringify(items)}

Aşağıdaki JSON formatında içerik üret.
Sadece JSON dön, markdown veya açıklama ekleme:

{
  "summary_tr": "300-400 kelime Türkçe özet. Format: Bu haftanın en kritik 3 olayı + KOBİ etkisi + regülasyon haberleri. Ton: ciddi ama panikletmeyen, çözüm odaklı. Son cümle CyberStep'e doğal yönlendirme.",
  
  "linkedin_post": "150-250 kelime. Yapı: [Hook 2 satır] + [boşluk] + [Problem 2-3 satır] + [boşluk] + [Bu haftanın en kritik 3 bulgusu liste] + [boşluk] + [CyberStep doğal referans] + [boşluk] + 🔗 Tam bülten: cyberstep.io/bulten + [5 hashtag: #SiberGüvenlik #KOBİ #KVKK #Türkiye #SiberSaldırı]",
  
  "twitter_thread": [
    "Tweet 1: Hook + 🧵 (maks 280 karakter)",
    "Tweet 2: Bu haftanın en önemli olayı",
    "Tweet 3: KOBİ etkisi + istatistik",
    "Tweet 4: Regülasyon/KVKK haberi",
    "Tweet 5: CyberStep bağlantısı + cyberstep.io/domain-tarama"
  ],
  
  "instagram_caption": "3-4 madde emoji listesi + CTA: 'link in bio 🔗' + 15 hashtag",
  
  "instagram_story_slides": [
    "Slayt 1: Tek büyük soru veya istatistik (max 8 kelime)",
    "Slayt 2: 3 madde özet (her biri max 6 kelime)",
    "Slayt 3: 'Ücretsiz kontrol → link in bio'"
  ],
  
  "cyberstep_data_note": "Bu haberlerden CyberStep tarama veritabanıyla doğrulanabilecek bulgular var mı? Varsa belirt.",
  
  "critical_count": number,
  "kvkk_count": number,
  "stats_note": "Varsa [DOĞRULA: kaynak] etiketiyle istatistikler"
}
```

### 3. Scheduler (`src/scheduler/cron.ts`)

```typescript
// DAILY 06:00 — Collect from all RSS sources
cron.schedule('0 6 * * *', collectAllSources);

// DAILY 07:00 — Score and filter new items
cron.schedule('0 7 * * *', scoreNewItems);

// FRIDAY 09:00 — Generate weekly digest (draft)
cron.schedule('0 9 * * 5', generateWeeklyDigest);

// Check for approved digests and send — every hour
cron.schedule('0 * * * *', sendApprovedDigests);
```

### 4. API Routes (`src/routes/`)

```
GET  /api/news               — List news items (filterable by week, category, relevance)
GET  /api/news/:id           — Single news item
GET  /api/digests            — List weekly digests
GET  /api/digests/:id        — Single digest with all content
PUT  /api/digests/:id/approve — Approve digest for sending
PUT  /api/digests/:id        — Edit digest content
POST /api/digests/:id/send   — Manually trigger send
GET  /api/sources            — List sources
PUT  /api/sources/:id        — Toggle source active/inactive
POST /api/collect/trigger    — Manually trigger collection
POST /api/digest/trigger     — Manually trigger digest generation
GET  /api/stats              — Dashboard stats
```

### 5. Admin Dashboard (`src/frontend/`)

Simple React single-page app with these views:

**Dashboard** (`/`):
- Stats cards: This week's news count, critical incidents, KVKK news count
- Latest digest status badge (draft/approved/sent)
- "Collect Now" button
- "Generate Digest" button

**News Feed** (`/news`):
- Sortable table: title, source, relevance score, tags, date
- Filter by: week, category (official/news/global), tag
- Click row to expand full content

**Weekly Digest** (`/digests`):
- List of all weekly digests with status
- Click to open digest editor

**Digest Editor** (`/digests/:id`):
- 5 tabs: Summary | LinkedIn | Twitter | Instagram | Story Slides
- Each tab: editable textarea with current AI content
- Right sidebar: source news items used
- Bottom: "Approve & Schedule Send" button (sends to ADMIN_EMAIL)
- Preview mode toggle

**Sources** (`/sources`):
- List all sources with last fetch time, error count
- Toggle active/inactive switch
- "Test Fetch" button per source

---

## ERROR HANDLING

- RSS fetch failures: log error, increment error_count, continue with other sources
- Claude API errors: retry once after 5 seconds, then mark as failed
- If RSS URL returns 404: auto-deactivate source after 3 consecutive failures
- All errors logged to console with timestamp

---

## SAMPLE DATA

On first run, if news_items table is empty, generate 10 sample Turkish cybersecurity news items using Claude so the dashboard is not empty.

---

## IMPORTANT NOTES

1. RSS feeds may have different date formats — normalize all to UTC timestamp
2. For global sources (BleepingComputer, etc.), filter aggressively: only save if Turkey keyword appears in title OR first 200 chars of content
3. Deduplication: check URL uniqueness before insert, also check title similarity (>80% similar = skip)
4. Week calculation: use ISO week numbers (Monday start)
5. The digest editor textarea should auto-save on blur (PUT /api/digests/:id)
6. LinkedIn post must not exceed 3000 characters
7. Each tweet in twitter_thread must not exceed 280 characters

---

## DELIVERABLE

When complete, the app should:
1. Auto-collect news from 10 sources every morning at 06:00
2. AI-score and filter for Turkey relevance
3. Every Friday generate a draft weekly digest with all 5 content formats
4. Show everything in a clean admin dashboard
5. Allow editing and one-click approval
6. Send approved digest to admin email

The app should be production-ready with proper TypeScript types, error handling, and database migrations.
```

---

## KURULUM SONRASI YAPILACAKLAR

Replit uygulamayı kurduktan sonra:

1. Environment variables ekle (Replit Secrets):
   - ANTHROPIC_API_KEY
   - DATABASE_URL (Replit PostgreSQL veya Supabase)
   - SMTP_USER + SMTP_PASS (Gmail uygulama şifresi)
   - ADMIN_EMAIL (senin e-posta adresin)

2. İlk çalıştırmada otomatik:
   - Tablolar oluşturulur
   - 10 kaynak seed edilir
   - Test verisi üretilir

3. Admin dashboard: https://[replit-url]/

4. Manuel test: Dashboard'da "Collect Now" → "Generate Digest"

5. CyberStep admin paneliyle entegrasyon (sonraki adım):
   - Haftalık özet → doğrudan blog taslağı olarak ekle
   - Onaylanan içerikler → sosyal medya planlama modülüne push

---

## CyberStep ANA PLATFORMUYLA ENTEGRASYON

Replit app hazır olduktan sonra CyberStep backend'ine şu webhook endpoint'i ekle:

```typescript
// CyberStep backend'de
POST /api/internal/weekly-digest
Body: {
  week: number,
  year: number,
  summary_tr: string,
  linkedin_post: string,
  twitter_thread: string[],
  instagram_caption: string
}

// Bu endpoint:
// 1. Blog taslağı olarak kaydet (status: draft)
// 2. Admin panele bildirim gönder
// 3. Sosyal medya planlama modülüne ekle
```

Replit app'te digest approve edildiğinde bu webhook'u çağır.

---

*Replit Agent Promptu — CyberStep Haftalık Siber Olay Toplayıcı — Mayıs 2026*
