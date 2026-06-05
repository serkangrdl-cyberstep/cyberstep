# CyberStep.io — HITL Approval Queue Sistemi
## Replit Agent Promptu — İnsan Onay Mekanizması

---

## AMAÇ

Geri alınamaz veya yüksek riskli aksiyonlar
otomasyona gitmeden önce insan onayını bekler.

Sabah 08:00 dashboard emailine entegre olur.
Admin panelden tek tıkla onayla/reddet.
Expire kuralları otomatik çalışır.

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

```
Şunları kontrol et:

src/services/dailyDashboard.ts
→ Sabah emaili nasıl üretiliyor?
→ actionItems dizisi nerede oluşuyor?
→ Email HTML şablonu nerede?

src/index.ts
→ FortiGate'e veri gönderen kısım var mı?
→ board_report gönderimi nerede?
→ dunning suspend kodu nerede?

src/routes/admin-panel/ veya src/routes/admin/
→ Mevcut admin route yapısı nasıl?
→ Auth middleware nasıl çalışıyor?
```

---

## BÖLÜM 1: VERİTABANI

```sql
-- Onay bekleyen aksiyonlar
CREATE TABLE IF NOT EXISTS pending_approvals (
  id serial PRIMARY KEY,

  -- Aksiyon tipi
  action_type varchar(50) NOT NULL,
  -- 'fortinet_block'       → FortiGate IOC blok
  -- 'board_report_send'    → Board raporu gönder
  -- 'zero_day_alert'       → Zero-day müşteri alarmı
  -- 'dunning_suspend'      → Servis askıya alma
  -- 'index_report_publish' → Aylık endeks yayını
  -- 'policy_doc_approve'   → Politika dokümanı onayı

  -- Başlık ve açıklama (email/dashboard için)
  title varchar(255) NOT NULL,
  description text,
  risk_level varchar(20) DEFAULT 'medium',
  -- 'critical' | 'high' | 'medium' | 'low'

  -- İlgili tüm veri
  payload jsonb NOT NULL,
  -- Aksiyon için gereken her şey burada

  -- İlişkili kayıtlar
  customer_id integer REFERENCES customers(id),
  related_id integer,
  -- İlgili record ID (scan_id, report_id vb.)

  -- Expire kuralları
  expires_at timestamp NOT NULL,
  on_expire varchar(20) DEFAULT 'auto_reject',
  -- 'auto_approve' → süre dolunca otomatik onayla
  -- 'auto_reject'  → süre dolunca otomatik reddet
  -- 'escalate'     → Telegram ile acil bildir

  -- Onay/red
  status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'expired'
  approved_by varchar(100),
  approved_at timestamp,
  rejection_reason text,

  -- Aksiyon tamamlandı mı?
  executed boolean DEFAULT false,
  executed_at timestamp,
  execution_result jsonb,

  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_approvals_status_idx
  ON pending_approvals (status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS pending_approvals_customer_idx
  ON pending_approvals (customer_id);

-- Approval geçmiş log
CREATE TABLE IF NOT EXISTS approval_audit_log (
  id serial PRIMARY KEY,
  approval_id integer REFERENCES pending_approvals(id),
  action varchar(30),
  -- 'created' | 'approved' | 'rejected' | 'expired'
  -- | 'executed' | 'execution_failed'
  performed_by varchar(100),
  -- 'admin' | 'system' | 'auto_expire'
  notes text,
  created_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: APPROVAL QUEUE SERVİSİ

```typescript
// src/services/approvalQueue.ts
// YENİ DOSYA

// Onay kuyruğuna yeni aksiyon ekle
export async function queueForApproval(params: {
  actionType: string;
  title: string;
  description: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  payload: Record<string, unknown>;
  customerId?: number;
  relatedId?: number;
  expiresInHours: number;
  onExpire: "auto_approve" | "auto_reject" | "escalate";
}): Promise<number> {

  const expiresAt = addHours(new Date(), params.expiresInHours);

  const [approval] = await db.insert(pendingApprovalsTable)
    .values({
      actionType:  params.actionType,
      title:       params.title,
      description: params.description,
      riskLevel:   params.riskLevel,
      payload:     params.payload,
      customerId:  params.customerId,
      relatedId:   params.relatedId,
      expiresAt,
      onExpire:    params.onExpire,
      status:      "pending",
    })
    .returning();

  await db.insert(approvalAuditLogTable).values({
    approvalId:  approval.id,
    action:      "created",
    performedBy: "system",
    notes:       params.description,
  });

  // Kritik aksiyonlar için anında Telegram bildirimi
  if (params.riskLevel === "critical") {
    await sendAdminTelegram(
      `⚠️ Onay Gerekiyor: ${params.title}\n` +
      `Risk: ${params.riskLevel.toUpperCase()}\n` +
      `Süre: ${params.expiresInHours} saat\n` +
      `${process.env["BASE_URL"]}/admin-panel/approvals/${approval.id}`
    );
  }

  logger.info(
    { approvalId: approval.id, actionType: params.actionType },
    "Approval kuyruğuna eklendi"
  );

  return approval.id;
}

// Onay ver
export async function approveAction(
  approvalId: number,
  approvedBy: string
): Promise<void> {

  const [approval] = await db.select()
    .from(pendingApprovalsTable)
    .where(
      and(
        eq(pendingApprovalsTable.id, approvalId),
        eq(pendingApprovalsTable.status, "pending")
      )
    ).limit(1);

  if (!approval) {
    throw new Error("Onay bulunamadı veya zaten işlendi");
  }

  await db.update(pendingApprovalsTable).set({
    status:     "approved",
    approvedBy,
    approvedAt: new Date(),
  }).where(eq(pendingApprovalsTable.id, approvalId));

  await db.insert(approvalAuditLogTable).values({
    approvalId,
    action:      "approved",
    performedBy: approvedBy,
  });

  // Aksiyonu çalıştır
  await executeApprovedAction(approval);
}

// Reddet
export async function rejectAction(
  approvalId: number,
  rejectedBy: string,
  reason: string
): Promise<void> {

  await db.update(pendingApprovalsTable).set({
    status:          "rejected",
    approvedBy:      rejectedBy,
    approvedAt:      new Date(),
    rejectionReason: reason,
  }).where(eq(pendingApprovalsTable.id, approvalId));

  await db.insert(approvalAuditLogTable).values({
    approvalId,
    action:      "rejected",
    performedBy: rejectedBy,
    notes:       reason,
  });
}

// Expire kontrolü — cron tarafından çalıştırılır
export async function processExpiredApprovals(): Promise<void> {

  const expired = await db.select()
    .from(pendingApprovalsTable)
    .where(
      and(
        eq(pendingApprovalsTable.status, "pending"),
        lte(pendingApprovalsTable.expiresAt, new Date())
      )
    );

  for (const approval of expired) {
    switch (approval.onExpire) {

      case "auto_approve":
        await db.update(pendingApprovalsTable).set({
          status:     "approved",
          approvedBy: "auto_expire",
          approvedAt: new Date(),
        }).where(eq(pendingApprovalsTable.id, approval.id));

        await db.insert(approvalAuditLogTable).values({
          approvalId:  approval.id,
          action:      "expired",
          performedBy: "system",
          notes:       "Süre doldu → otomatik onaylandı",
        });

        await executeApprovedAction(approval);
        break;

      case "auto_reject":
        await db.update(pendingApprovalsTable).set({
          status:          "rejected",
          approvedBy:      "auto_expire",
          approvedAt:      new Date(),
          rejectionReason: "Süre doldu → otomatik reddedildi",
        }).where(eq(pendingApprovalsTable.id, approval.id));

        await db.insert(approvalAuditLogTable).values({
          approvalId:  approval.id,
          action:      "expired",
          performedBy: "system",
          notes:       "Süre doldu → otomatik reddedildi",
        });
        break;

      case "escalate":
        await sendAdminTelegram(
          `🚨 ACİL: Onay süresi doldu!\n` +
          `${approval.title}\n` +
          `Hemen karar ver: ` +
          `${process.env["BASE_URL"]}/admin-panel/approvals/${approval.id}`
        );
        // Expire etmeden bekletmeye devam et
        // (Admin karar verene kadar)
        break;
    }
  }
}

// Onaylanan aksiyonu çalıştır
async function executeApprovedAction(
  approval: typeof pendingApprovalsTable.$inferSelect
): Promise<void> {

  try {
    switch (approval.actionType) {

      case "fortinet_block": {
        // FortiGate'e IOC gönder
        // (Şu an placeholder — entegrasyon hazır olduğunda)
        const { ip, customerId } = approval.payload as any;
        logger.info(
          { ip, customerId },
          "FortiGate IOC blok onaylandı (entegrasyon bekliyor)"
        );
        // await sendToFortiGate(ip, customerId);
        break;
      }

      case "board_report_send": {
        const { reportId, customerId, sendTo } =
          approval.payload as any;
        const { sendBoardReport } = await import("./ciso");
        await sendBoardReport(reportId, customerId, sendTo);
        break;
      }

      case "zero_day_alert": {
        const { cveId, customerIds, alertContent } =
          approval.payload as any;
        const { sendCVEAlert } = await import("./cve");
        for (const cId of customerIds) {
          await sendCVEAlert(cveId, cId, alertContent);
        }
        break;
      }

      case "dunning_suspend": {
        const { customerId } = approval.payload as any;
        const { suspendService } =
          await import("./dunningManager");
        await suspendService(customerId);
        break;
      }

      case "index_report_publish": {
        const { reportId } = approval.payload as any;
        const { publishIndexReport } =
          await import("./indexReport");
        await publishIndexReport(reportId);
        break;
      }

      case "policy_doc_approve": {
        const { policyId, customerId } =
          approval.payload as any;
        await db.update(securityPoliciesTable).set({
          status:     "approved",
          approvedAt: new Date(),
        }).where(eq(securityPoliciesTable.id, policyId));
        break;
      }
    }

    // Başarılı işaretlendi
    await db.update(pendingApprovalsTable).set({
      executed:    true,
      executedAt:  new Date(),
    }).where(eq(pendingApprovalsTable.id, approval.id));

    await db.insert(approvalAuditLogTable).values({
      approvalId:  approval.id,
      action:      "executed",
      performedBy: "system",
    });

  } catch (err) {
    logger.error(
      { err, approvalId: approval.id },
      "Approval execution hatası"
    );

    await db.insert(approvalAuditLogTable).values({
      approvalId:  approval.id,
      action:      "execution_failed",
      performedBy: "system",
      notes:       String(err),
    });

    // Admin'e bildir
    await sendAdminTelegram(
      `❌ Aksiyon çalıştırılamadı: ${approval.title}\n` +
      `Hata: ${String(err)}`
    );
  }
}
```

---

## BÖLÜM 3: MEVCUT SERVİSLERE ENTEGRASYON

```typescript
// Her servis kendi yerine queueForApproval() çağırır

// ─── FortiGate IOC Bloklama ────────────────────────────
// src/services/ioc/actionLogger.ts içinde:
// "block_queued" yerine şimdi approval queue'ya gider

if (shouldBlock) {
  const approvalId = await queueForApproval({
    actionType:   "fortinet_block",
    title:        `FortiGate Blok: ${ioc.value}`,
    description:
      `${ioc.value} → Güven skoru: ${ioc.confidenceScore}/100\n` +
      `Kaynaklar: ${ioc.sources.join(", ")}\n` +
      `Müşteri: ${customer.companyName}`,
    riskLevel:    "critical",
    payload: {
      ip:         ioc.value,
      customerId: customer.id,
      iocId:      ioc.id,
      confidence: ioc.confidenceScore,
      sources:    ioc.sources,
    },
    customerId:      customer.id,
    expiresInHours:  24,
    onExpire:        "auto_reject",
    // Güvenli taraf: onay gelmezse gitmesin
  });

  logger.info(
    { approvalId, ioc: ioc.value },
    "FortiGate blok onay kuyruğuna alındı"
  );
}

// ─── Board Raporu Gönderimi ────────────────────────────
// src/services/ciso/boardReportGenerator.ts içinde:
// sendBoardReport() çağrısından önce:

await queueForApproval({
  actionType:   "board_report_send",
  title:        `Board Raporu: ${customer.companyName} — ${month}`,
  description:
    `Risk skoru: ${riskScore}/100 · ` +
    `7545 Uyum: %${compliance7545} · ` +
    `KVKK: %${complianceKvkk}\n` +
    `Gönderilecek: ${boardReportEmail}`,
  riskLevel:    "high",
  payload: {
    reportId:    savedReport.id,
    customerId:  customer.id,
    sendTo:      boardReportEmail,
    riskScore,
    month,
  },
  customerId:     customer.id,
  relatedId:      savedReport.id,
  expiresInHours: 72,
  // 3 gün içinde onaylanmazsa ayın 25'i geçer
  onExpire:       "escalate",
});

// ─── Zero-day Alarmı (Yeni, Az Veri) ──────────────────
// src/services/cve/ içinde:
// EPSS < 0.05 ama "kritik" etiketli CVE için:

if (isNewZeroDay && epssScore < 0.05) {
  await queueForApproval({
    actionType:   "zero_day_alert",
    title:        `Zero-Day Alarmı: ${cveId}`,
    description:
      `${cveId} — Henüz az veri\n` +
      `EPSS: ${(epssScore * 100).toFixed(2)}%\n` +
      `Etkilenen müşteri: ${affectedCustomers.length}`,
    riskLevel:    "high",
    payload: {
      cveId,
      customerIds: affectedCustomers.map(c => c.id),
      alertContent,
      epssScore,
    },
    expiresInHours: 4,
    // 4 saat içinde onaylanmazsa otomatik gönder
    // (hız kritik)
    onExpire:       "auto_approve",
  });
} else {
  // Normal CVE → direkt gönder
  await sendCVEAlertToAll(cveId, affectedCustomers);
}

// ─── Dunning Servis Askıya Alma ────────────────────────
// src/services/dunningManager.ts içinde:
// Gün 10 kontrolünde:

if (daysFailed >= 10) {
  await queueForApproval({
    actionType:   "dunning_suspend",
    title:        `Servis Askıya Alma: ${customer.companyName}`,
    description:
      `${daysFailed} gündür ödeme alınamadı.\n` +
      `Plan: ${subscription.plan} · ` +
      `Tutar: ${subscription.monthlyAmount} TL\n` +
      `İletişim: ${customer.email}`,
    riskLevel:    "high",
    payload:      { customerId: customer.id },
    customerId:   customer.id,
    expiresInHours: 2,
    onExpire:       "auto_approve",
    // 2 saat içinde bakmadıysan otomatik gerçekleşir
  });
}
```

---

## BÖLÜM 4: SABAH DASHBOARD ENTEGRASYONu

```typescript
// src/services/dailyDashboard.ts içinde:
// collectDailySummary() fonksiyonuna ekle:

// Bekleyen onayları topla
const pendingApprovals = await db.select()
  .from(pendingApprovalsTable)
  .where(eq(pendingApprovalsTable.status, "pending"))
  .orderBy(
    // Risk seviyesine göre sırala
    asc(
      sql`CASE risk_level
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        ELSE 4
      END`
    )
  );

// actionItems dizisine en başa ekle:
if (pendingApprovals.length > 0) {
  actions.unshift({
    priority: 0,
    // Tüm diğer aksiyonlardan önce
    icon: "✅",
    description:
      `${pendingApprovals.length} aksiyon onay bekliyor`,
    url: "/admin-panel/approvals",
    estimatedMinutes:
      pendingApprovals.length * 3,
    urgent: pendingApprovals.some(
      a => a.riskLevel === "critical"
    ),
  });
}
```

```typescript
// Email şablonuna ekle — buildSummaryEmail() içinde:
// Diğer bölümlerden ÖNCE:

${pendingApprovals.length > 0 ? `
  <!-- Onay Bekleyen Aksiyonlar -->
  <div style="background:#FFF3CD;border:2px solid #F5A623;
    padding:16px;border-radius:8px;margin-bottom:24px">
    <div style="font-size:14px;font-weight:700;
      color:#8B4513;margin-bottom:12px">
      ✅ ${pendingApprovals.length} aksiyon onay bekliyor
    </div>
    ${pendingApprovals.map(a => `
    <a href="${BASE_URL}/admin-panel/approvals/${a.id}"
      style="display:block;background:white;
      border-radius:6px;padding:10px 14px;
      margin-bottom:6px;text-decoration:none;
      border-left:4px solid ${
        a.riskLevel === 'critical' ? '#DC3545' :
        a.riskLevel === 'high'     ? '#F5A623' : '#17A2B8'
      }">
      <span style="font-size:13px;color:#333">
        ${a.title}
      </span>
      <span style="float:right;font-size:11px;
        color:#999">
        ${formatTimeLeft(a.expiresAt)} kaldı →
      </span>
    </a>`).join('')}
    <a href="${BASE_URL}/admin-panel/approvals"
      style="font-size:12px;color:#F5A623;
      text-decoration:none">
      Tümünü Gör →
    </a>
  </div>
` : ''}
```

---

## BÖLÜM 5: ADMİN PANELİ SAYFASI

```
/admin-panel/approvals

─── ONAY BEKLEYENLERREMİ ───────────────────────────────
3 aksiyon bekliyor

🔴 FortiGate Blok: 185.x.x.x
   Müşteri: Acme A.Ş.  ·  Risk: KRİTİK  ·  22:14 kaldı
   "Güven skoru 92/100, CISA KEV + ThreatFox eşleşti"
   [Onayla ✅] [Reddet ❌] [Detayları Gör →]

🟠 Zero-Day Alarmı: CVE-2026-XXXX
   12 müşteri etkileniyor  ·  3:42 kaldı
   "EPSS %0.8 — az veri, yeni bildirilen"
   [Onayla ✅] [Reddet ❌] [CVE Detayı →]

🟡 Board Raporu: Beta Ltd. — Haziran 2026
   Gönderilecek: ceo@beta.com  ·  71 saat kaldı
   "Risk: 58/100 · 7545: %72 · KVKK: %68"
   [Önizle 👁️] [Onayla ✅] [Düzenle ✏️]

─── TAMAMLANANLAR (Son 7 Gün) ───────────────────────────
✅ FortiGate Blok: 91.x.x.x        Onaylandı · Dün 09:12
❌ Dunning Suspend: Gamma A.Ş.     Reddedildi · 2 gün önce
⏰ Zero-Day CVE-2026-XXXX          Süre doldu → Otomatik onay
✅ Board Raporu: Delta Ltd.         Onaylandı · 3 gün önce

[Tüm Geçmiş]  [CSV İndir]


/admin-panel/approvals/:id

─── ONAY DETAYI ─────────────────────────────────────────
FortiGate IOC Blok — Acme A.Ş.

Risk Seviyesi: 🔴 KRİTİK
Kalan Süre: 22 saat 14 dakika
Süre dolunca: Otomatik REDDEDİLECEK

Detaylar:
  IP Adresi:    185.x.x.x
  Güven Skoru:  92/100
  Kaynaklar:    CISA KEV, ThreatFox, AbuseIPDB
  Müşteri:      Acme A.Ş. — id: 47

IOC Geçmişi:
  ThreatFox:   Emotet C2 — ilk görülme: 3 gün önce
  AbuseIPDB:   %98 güven — 187 rapor
  CISA KEV:    KEV-2026-0412

[✅ ONAYLA]  [❌ REDDET]

Red sebebi: [________________]  (reddetmek için gerekli)

Audit Log:
  09:45 Sistem tarafından oluşturuldu
  10:02 Admin'e Telegram bildirimi gönderildi
```

---

## BÖLÜM 6: API ROTALAR

```typescript
// src/routes/admin/approvals.ts
// YENİ DOSYA

// GET /api/admin/approvals — Bekleyenleri listele
router.get("/", requireAdmin, async (req, res) => {
  const { status = "pending" } = req.query;

  const approvals = await db.select()
    .from(pendingApprovalsTable)
    .where(
      status === "all"
        ? undefined
        : eq(pendingApprovalsTable.status, String(status))
    )
    .orderBy(
      asc(sql`CASE risk_level
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        ELSE 4
      END`),
      asc(pendingApprovalsTable.expiresAt)
    );

  res.json({ approvals, count: approvals.length });
});

// GET /api/admin/approvals/:id — Detay
router.get("/:id", requireAdmin, async (req, res) => {
  const [approval] = await db.select()
    .from(pendingApprovalsTable)
    .where(
      eq(pendingApprovalsTable.id, parseInt(req.params.id))
    ).limit(1);

  if (!approval) {
    res.status(404).json({ error: "Bulunamadı" });
    return;
  }

  const auditLog = await db.select()
    .from(approvalAuditLogTable)
    .where(
      eq(approvalAuditLogTable.approvalId, approval.id)
    )
    .orderBy(asc(approvalAuditLogTable.createdAt));

  res.json({ approval, auditLog });
});

// POST /api/admin/approvals/:id/approve
router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    await approveAction(
      parseInt(req.params.id),
      req.admin?.email || "admin"
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/admin/approvals/:id/reject
router.post("/:id/reject", requireAdmin, async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) {
    res.status(400).json({
      error: "Red sebebi zorunlu"
    });
    return;
  }
  try {
    await rejectAction(
      parseInt(req.params.id),
      req.admin?.email || "admin",
      reason
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});
```

---

## BÖLÜM 7: CRON

```typescript
// Her 15 dakikada expire kontrolü
cron.schedule("*/15 * * * *",
  wrapCron("approval_expire_check", "*/15 * * * *",
    async () => {
      const { processExpiredApprovals } =
        await import("./services/approvalQueue");
      await processExpiredApprovals();
    }
  )
);
```

---

## EXPIRE KURALLARI ÖZET

```
AKSİYON                  SÜRE    EXPIRE DAVRANIŞI
────────────────────────────────────────────────────
FortiGate blok           24 sa   auto_reject
  (güvenli taraf: gitmesin)

Board raporu gönder      72 sa   escalate
  (CEO emaili kaçırılmamalı)

Zero-day alarm (yeni)    4 sa    auto_approve
  (hız kritik)

Dunning suspend          2 sa    auto_approve
  (süreç devam etmeli)

Endeks raporu yayını     --      expire yok
  (ayın 25'ine kadar bekler)

Politika dokümanı        --      expire yok
  (müşteri istediğinde onaylar)
```

---

## TEST SENARYOLARI

```
1. Kuyruk oluşturma:
   queueForApproval({
     actionType: "dunning_suspend",
     title: "Test Suspend",
     riskLevel: "high",
     expiresInHours: 0.01,  // 36 saniye
     onExpire: "auto_approve",
     payload: { customerId: testId }
   })
   → pending_approvals tablosunda kayıt var mı?
   → Telegram bildirimi geldi mi?

2. Onay testi:
   POST /api/admin/approvals/:id/approve
   → status: "approved" mi?
   → executed: true mi?
   → audit_log'da "approved" kaydı var mı?

3. Expire testi:
   36 saniye bekle
   processExpiredApprovals() çalıştır
   → status: "approved" mi? (auto_approve)
   → executedAt dolu mu?

4. Red testi:
   POST /api/admin/approvals/:id/reject
   Body: { "reason": "Test red" }
   → status: "rejected" mi?
   → rejection_reason dolu mu?

5. Dashboard entegrasyon:
   Pending approval oluştur
   collectDailySummary() çalıştır
   → actionItems[0].icon: "✅" mi?
   → estimatedMinutes hesaplandı mı?
   → Sabah emailinde sarı bölüm var mı?
```

---

*CyberStep.io — HITL Approval Queue — Haziran 2026*
*"Geri alınamaz kararlar insan onayıyla."*
