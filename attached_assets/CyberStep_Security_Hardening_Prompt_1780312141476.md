# CyberStep.io — Secure by Design
## Replit Agent Promptu — Güvenlik Sertleştirme + Açık Kapatma + Best Practices

---

## TALİMAT

Aşağıdaki güvenlik kontrollerini sırayla uygula.
Her bölümü tamamladıktan sonra "✅ Bölüm X tamamlandı" yaz.
Hiçbir özellik ekleme — sadece mevcut kodu güvenli hale getir.

---

## BÖLÜM 1: GİRİŞ DOĞRULAMA + SANİTİZASYON

### 1a — Tüm API Route'larına Input Validation Ekle

```typescript
// src/middleware/validate.ts
// Zod ile şema doğrulama — her route için kullan

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Geçersiz istek',
        details: result.error.flatten(),
      });
    }

    // Doğrulanmış veriyi req'e yaz (tip güvenli)
    req.validated = result.data;
    next();
  };
}

// Kritik şemalar:
export const domainScanSchema = z.object({
  body: z.object({
    domain: z.string()
      .min(3).max(253)
      .regex(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, 'Geçersiz domain formatı')
      .transform(d => d.toLowerCase().trim()),
  }),
});

export const assessmentSubmitSchema = z.object({
  body: z.object({
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    email: z.string().email().max(255),
    companyName: z.string().min(2).max(255),
    sector: z.string().max(100),
  }),
});

export const webhookTokenSchema = z.object({
  params: z.object({
    token: z.string().length(64).regex(/^[a-f0-9]+$/),
  }),
});
```

### 1b — XSS Koruması

```typescript
// pnpm add xss dompurify @types/dompurify

import xss from 'xss';

// Kullanıcıdan gelen tüm string veriler bu fonksiyondan geçmeli
export function sanitizeString(input: string): string {
  return xss(input, {
    whiteList: {}, // Hiçbir HTML tag'ine izin verme
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
}

// Özellikle bu alanlarda kullan:
// - companyName, domain, notes, description
// - Herhangi bir user-provided text DB'ye yazılmadan önce
```

### 1c — SQL Injection Önleme Audit

```typescript
// Drizzle ORM kullanıyorsun — parameterized queries otomatik
// AMA: raw SQL kullanılan yerler varsa bunları bul ve düzelt

// YANLIŞ (eğer varsa):
// db.execute(sql`SELECT * FROM users WHERE id = ${req.params.id}`)
// -- Bu güvenli çünkü template literal

// YANLIŞ (kesinlikle yapılmamalı):
// db.execute(`SELECT * FROM users WHERE id = ${req.params.id}`)
// -- String interpolation ile raw SQL

// Tüm .execute() çağrılarını tara:
// grep -r "\.execute(" src/ --include="*.ts"
// Template literal kullanmayan varsa düzelt
```

---

## BÖLÜM 2: KİMLİK DOĞRULAMA + OTURİZASYON

### 2a — JWT Güvenliği

```typescript
// src/auth/jwt.ts

import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const JWT_REFRESH_EXPIRES_IN = '30d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET en az 32 karakter olmalı');
}

// Token üretimi
export function generateTokens(userId: number, role: string) {
  const accessToken = jwt.sign(
    { userId, role, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: randomBytes(16).toString('hex') },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256' }
  );

  return { accessToken, refreshToken };
}

// Token doğrulama — type kontrolü dahil
export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

  if (payload.type !== 'access') {
    throw new Error('Geçersiz token tipi');
  }

  return payload;
}

// Token blacklist (logout için)
// Redis'e eklenene kadar DB ile yönet
export async function blacklistToken(jti: string, expiresAt: Date) {
  await db.insert(tokenBlacklist).values({ jti, expiresAt })
    .onConflictDoNothing();
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const result = await db.select()
    .from(tokenBlacklist)
    .where(eq(tokenBlacklist.jti, jti))
    .limit(1);
  return result.length > 0;
}
```

### 2b — Tüm Admin Route'larına Auth Middleware Ekle

```typescript
// src/middleware/auth.ts

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }

  try {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
};

export const requireAdmin = [requireAuth, (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Yetersiz yetki' });
  }
  next();
}];

export const requireCustomer = [requireAuth, (req, res, next) => {
  if (!['customer', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Yetersiz yetki' });
  }
  next();
}];

// TÜM /api/admin/* route'larına requireAdmin ekle
// TÜM /api/portal/* route'larına requireCustomer ekle
// PUBLIC route'lar sadece: /api/scan/free, /api/auth/*, /api/fabric/webhook/:token
```

### 2c — Rate Limiting

```typescript
// pnpm add express-rate-limit

import rateLimit from 'express-rate-limit';

// Global rate limit
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen bekleyin.' },
});

// Auth endpoint'leri — brute force koruması
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 15 dakikada 10 deneme
  skipSuccessfulRequests: true,
  message: { error: 'Çok fazla giriş denemesi.' },
});

// Domain tarama — API abuse koruması
export const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 20, // Saatte 20 tarama
  keyGenerator: (req) => req.ip + (req.user?.userId || ''),
  message: { error: 'Tarama limiti aşıldı.' },
});

// Uygulama:
app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/scan/', scanLimiter);
```

---

## BÖLÜM 3: GÜVENLİK BAŞLIKLARI

```typescript
// src/middleware/securityHeaders.ts
// pnpm add helmet

import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'strict-dynamic'",
        "https://js.iyzipay.com",       // Iyzico
        "https://cdnjs.cloudflare.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.anthropic.com",
        "wss://cyberstep.io",           // WebSocket
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],       // Clickjacking koruması
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,        // 1 yıl
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,   // Bazı üçüncü taraf script'ler için
}));

// CORS — sadece kendi domain'inden
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://cyberstep.io',
      'https://www.cyberstep.io',
      process.env.ADMIN_URL,
      // Development
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    ].filter(Boolean);

    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: İzin verilmeyen kaynak'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## BÖLÜM 4: VERİ GÜVENLİĞİ

### 4a — Hassas Veri Şifreleme

```typescript
// src/utils/encryption.ts
// API key'ler, webhook token'lar DB'de şifreli saklanmalı

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = scryptSync(
  process.env.ENCRYPTION_KEY!,
  'cyberstep-salt-v1',
  32
);

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Şifrelenecek alanlar:
// - fortinet_integrations.fortimanager_token_encrypted
// - customer_security_devices.api_key_encrypted
// - observability_integrations.api_key_encrypted
// - cloud_connections.credentials_encrypted
// Tüm *_encrypted sütunlar bu fonksiyonla şifreli saklanmalı
```

### 4b — Parola Güvenliği

```typescript
// pnpm add bcryptjs @types/bcryptjs

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  // Minimum 8 karakter kontrolü
  if (password.length < 8) {
    throw new Error('Parola en az 8 karakter olmalı');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// DB'de plaintext parola var mı kontrol et:
// grep -r "password" src/db/schema.ts
// password alanı her zaman text (hashed), asla plaintext
```

### 4c — Log'larda Hassas Veri Sızıntısı Önleme

```typescript
// src/utils/logger.ts

const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'api_key', 'apikey',
  'authorization', 'credit_card', 'cvv', 'iban',
  'private_key', 'client_secret',
];

function redactSensitive(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
        return [key, '[REDACTED]'];
      }
      return [key, redactSensitive(value)];
    })
  );
}

export const logger = {
  info: (msg: string, data?: unknown) =>
    console.log(JSON.stringify({ level: 'info', msg, data: redactSensitive(data) })),
  warn: (msg: string, data?: unknown) =>
    console.warn(JSON.stringify({ level: 'warn', msg, data: redactSensitive(data) })),
  error: (msg: string, err?: unknown, data?: unknown) =>
    console.error(JSON.stringify({
      level: 'error', msg,
      error: err instanceof Error ? err.message : err,
      // Stack trace production'da loglanmaz
      stack: process.env.NODE_ENV !== 'production' && err instanceof Error
        ? err.stack : undefined,
      data: redactSensitive(data),
    })),
};

// Mevcut console.log çağrılarını logger ile değiştir
```

---

## BÖLÜM 5: API GÜVENLİĞİ

### 5a — Webhook İmza Doğrulama

```typescript
// Tüm inbound webhook'lar imzalanmalı

// Fortinet webhook
export function verifyFabricWebhook(
  body: string,
  signature: string,
  token: string
): boolean {
  const expected = createHmac('sha256', token)
    .update(body)
    .digest('hex');
  // Timing-safe karşılaştırma
  return timingSafeEqual(
    Buffer.from(signature), Buffer.from(expected)
  );
}

// Iyzico webhook
export function verifyIyzicoWebhook(
  payload: string,
  signature: string
): boolean {
  const expected = createHmac('sha256', process.env.IYZICO_SECRET_KEY!)
    .update(payload)
    .digest('hex');
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

### 5b — Hata Mesajlarını Temizle

```typescript
// src/middleware/errorHandler.ts
// Production'da stack trace veya DB hata detayı sızmamalı

export function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', err, {
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
  });

  // Production'da generic mesaj
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: 'Sunucu hatası oluştu. Lütfen tekrar deneyin.',
      requestId: req.id, // İzleme için
    });
  }

  // Development'da detay göster
  return res.status(500).json({
    error: err.message,
    stack: err.stack,
  });
}

// Bilinmeyen route'lar
app.use((req, res) => {
  res.status(404).json({ error: 'Sayfa bulunamadı' });
});
```

### 5c — API Key Rotasyon Sistemi

```typescript
// Müşteri API key'leri rotasyon desteklemeli

// Yeni key üret
export async function rotateCustomerAPIKey(
  customerId: number
): Promise<string> {
  const newKey = `csk_${randomBytes(32).toString('hex')}`;
  const hashedKey = createHash('sha256').update(newKey).digest('hex');

  await db.update(customers)
    .set({
      apiKeyHash: hashedKey,
      apiKeyLastRotatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  // Sadece bir kez göster, DB'de hash sakla
  return newKey;
}

// API key doğrulama
export async function verifyAPIKey(key: string): Promise<number | null> {
  const hash = createHash('sha256').update(key).digest('hex');
  const customer = await db.select()
    .from(customers)
    .where(eq(customers.apiKeyHash, hash))
    .limit(1);
  return customer[0]?.id || null;
}
```

---

## BÖLÜM 6: OWASP TOP 10 KONTROL LİSTESİ

```typescript
// Her maddeyi kontrol et, eksikleri düzelt

// A01: Broken Access Control
// ✓ Kontrol: Her endpoint'te ownership check var mı?
// Müşteri başkasının raporuna erişemesin:
export async function requireOwnership(
  customerId: number,
  resourceType: string,
  resourceId: number
): Promise<boolean> {
  const checks: Record<string, () => Promise<boolean>> = {
    report: async () => {
      const r = await db.select()
        .from(domainScans)
        .where(and(
          eq(domainScans.id, resourceId),
          eq(domainScans.customerId, customerId)
        )).limit(1);
      return r.length > 0;
    },
    invoice: async () => {
      const i = await db.select()
        .from(enterpriseInvoices)
        .where(and(
          eq(enterpriseInvoices.id, resourceId),
          eq(enterpriseInvoices.customerId, customerId)
        )).limit(1);
      return i.length > 0;
    },
    soc_case: async () => {
      const c = await db.select()
        .from(socCases)
        .where(and(
          eq(socCases.id, resourceId),
          eq(socCases.customerId, customerId)
        )).limit(1);
      return c.length > 0;
    },
  };

  const check = checks[resourceType];
  if (!check) return false;
  return check();
}

// A03: Injection — Drizzle ORM kullandığımız için SQL injection riski düşük
// Ama: grep ile raw SQL varsa bul ve düzelt

// A05: Security Misconfiguration
// ✓ .env.example'da hiçbir gerçek değer olmamalı
// ✓ Debug modu production'da kapalı olmalı
// ✓ Default admin şifresi olmamalı

// A07: Authentication Failures
// ✓ Account lockout: 5 başarısız giriş → 15 dk kilit
export async function checkAccountLockout(email: string): Promise<boolean> {
  const key = `lockout:${email}`;
  // Redis varsa Redis'e, yoksa DB'ye yaz
  const attempts = await getLoginAttempts(email);
  return attempts >= 5;
}

// A09: Security Logging
// ✓ Tüm auth olaylarını logla (başarılı + başarısız)
// ✓ Admin aksiyonlarını logla
// ✓ Müşteri verisi erişimini logla

// A10: SSRF (Server-Side Request Forgery)
// CyberStep dış URL'lere bağlanıyor (tarama için) — güvenli liste zorunlu
const ALLOWED_SCAN_DOMAINS = [
  'shodan.io', 'virustotal.com', 'haveibeenpwned.com',
  'abuseipdb.com', 'fortiguard.com', 'urlhaus-api.abuse.ch',
  'certstream.crtsh.com', 'api.usom.gov.tr',
];

export function validateExternalURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_SCAN_DOMAINS.some(d => parsed.hostname.endsWith(d));
  } catch {
    return false;
  }
}
```

---

## BÖLÜM 7: BAĞIMLILIK GÜVENLİĞİ

```bash
# Çalıştır ve raporla:

# 1. Güvenlik açıklı paketler
npm audit --production

# 2. Kritik ve yüksek öncelikli açıkları otomatik düzelt
npm audit fix

# 3. Kalan kritik açıkları manuel incele
npm audit --audit-level=high

# 4. Kullanılmayan bağımlılıkları bul
npx depcheck

# 5. Güncel olmayan paketler
npm outdated

# Kritik paketleri güncelle (test et!):
# express, jsonwebtoken, bcryptjs, zod
```

---

## BÖLÜM 8: SESSION + COOKIE GÜVENLİĞİ

```typescript
// src/config/session.ts

app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS zorunlu
    httpOnly: true,    // JS erişimi yok
    sameSite: 'strict', // CSRF koruması
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
  },
  // Production'da Redis session store kullan
  // store: new RedisStore({ client: redisClient }),
}));

// CSRF Token (form submit'ler için)
import csrf from 'csurf';
export const csrfProtection = csrf({ cookie: { httpOnly: true } });

// Ödeme formları ve önemli POST endpoint'lerine ekle:
// app.post('/api/payments/create', csrfProtection, handler)
```

---

## BÖLÜM 9: ENV GÜVENLIK AUDIT

```bash
# .env dosyasını kontrol et:

# 1. Kısa veya zayıf secret'lar var mı?
# JWT_SECRET en az 32 karakter olmalı
# ENCRYPTION_KEY en az 32 karakter olmalı
# SESSION_SECRET en az 32 karakter olmalı

# 2. .gitignore'da .env var mı?
grep -r "\.env" .gitignore

# 3. .env.example'da gerçek değer var mı?
# OLMAMALI — sadece placeholder

# 4. Kod içinde hardcoded secret var mı?
grep -r "sk_live\|sk_test\|AKIA\|Bearer " src/ --include="*.ts"
grep -rn "api_key.*=.*['\"]" src/ --include="*.ts"

# Bulunanlar varsa environment variable'a taşı

# 5. Production için güçlü secret üret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## BÖLÜM 10: GÜVENLİK KONTROL LİSTESİ (Son Kontrol)

```
Aşağıdakilerin hepsinin uygulandığını doğrula:

AUTH:
[ ] Tüm /admin/* route'ları requireAdmin ile korumalı
[ ] Tüm /api/portal/* route'ları requireCustomer ile korumalı
[ ] JWT secret 32+ karakter
[ ] Token blacklist çalışıyor (logout sonrası token geçersiz)
[ ] Rate limiting: auth endpoint'leri 10/15dk, scan 20/saat

INPUT:
[ ] Tüm POST body'leri Zod ile validate ediliyor
[ ] domain input'u regex ile kontrol ediliyor
[ ] XSS sanitizasyonu user-generated içeriklerde aktif

HEADERS:
[ ] Helmet aktif
[ ] CSP tanımlı
[ ] HSTS aktif (production)
[ ] CORS sadece kendi domain'lerine açık

VERİ:
[ ] Parolalar bcrypt ile hashleniyor (rounds: 12)
[ ] API key'ler AES-256 ile şifreli DB'de
[ ] Log'larda sensitive key'ler redact ediliyor
[ ] Production'da stack trace sızımıyor

BAĞIMLILIK:
[ ] npm audit kritik açık yok
[ ] express, jsonwebtoken, bcryptjs güncel

WEBHOOK:
[ ] Iyzico webhook imzası doğrulanıyor
[ ] Fabric webhook token-only (IP kısıtlaması opsiyonel)

GENEL:
[ ] .env.example'da gerçek değer yok
[ ] Kodda hardcoded secret yok
[ ] 404/500 hata sayfaları generic mesaj veriyor
[ ] Account lockout 5 başarısız denemede aktif
```

---

*CyberStep.io Secure by Design Promptu — 2026*
