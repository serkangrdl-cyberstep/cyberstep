/**
 * CISO Asistan — Uyum Skoru Hesaplayıcı
 * 7545 ve KVKK uyum skorlarını hesaplar, compliance_scores tablosuna kaydeder.
 */

import { db } from "@workspace/db";
import {
  cisoAssistantSubscriptionsTable,
  complianceScoresTable,
  domainScansTable,
  customersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

export interface ComplianceCheckItem {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  note: string | null;
}

export interface ComplianceResult {
  score7545: number;
  scoreKvkk: number;
  checklist7545: ComplianceCheckItem[];
  checklistKvkk: ComplianceCheckItem[];
}

async function getLatestScan(customerEmail: string) {
  const [scan] = await db
    .select()
    .from(domainScansTable)
    .where(eq(domainScansTable.email, customerEmail))
    .orderBy(desc(domainScansTable.id))
    .limit(1);
  return scan ?? null;
}

function countCriticalCves(cveSummary: unknown): number {
  if (!Array.isArray(cveSummary)) return 0;
  return cveSummary.filter((c: { severity?: string }) =>
    c?.severity?.toLowerCase() === "critical"
  ).length;
}

export async function calculateComplianceScore(
  customerId: number
): Promise<ComplianceResult> {
  const [sub] = await db
    .select()
    .from(cisoAssistantSubscriptionsTable)
    .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId))
    .limit(1);

  if (!sub) throw new Error(`CISO aboneliği bulunamadı: customerId=${customerId}`);

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) throw new Error(`Müşteri bulunamadı: ${customerId}`);

  const scan = await getLatestScan(customer.email);
  const criticalCveCount = countCriticalCves(scan?.cveSummary);

  // ─── 7545 Kanunu ──────────────────────────────────────────────────────────
  const checklist7545: ComplianceCheckItem[] = [
    {
      id: "security_officer",
      label: "Siber Güvenlik Sorumlusu atandı",
      weight: 25,
      passed: sub.hasDedicatedCiso === true || sub.cisoName !== null,
      note: "Madde 6: 50+ çalışanlı şirketlerde zorunlu.",
    },
    {
      id: "annual_audit",
      label: "Yıllık güvenlik denetimi yapıldı",
      weight: 20,
      passed: scan !== null,
      note: "CyberStep değerlendirmesi denetim belgesi olarak kullanılabilir.",
    },
    {
      id: "incident_response",
      label: "Olay müdahale planı mevcut",
      weight: 20,
      passed: sub.hasIncidentResponsePlan === true,
      note: "Politika kütüphanesinden olay müdahale prosedürünü indirin.",
    },
    {
      id: "ssl_valid",
      label: "SSL sertifikası geçerli",
      weight: 15,
      passed: scan?.sslPass === true,
      note: null,
    },
    {
      id: "dmarc_configured",
      label: "E-posta güvenliği (DMARC) aktif",
      weight: 10,
      passed: scan?.dmarcPass === true && !!scan?.dmarcRecord,
      note: null,
    },
    {
      id: "no_critical_cve",
      label: "Kritik CVE açığı yok",
      weight: 10,
      passed: criticalCveCount === 0,
      note: null,
    },
  ];

  const score7545 = checklist7545.reduce(
    (sum, item) => sum + (item.passed ? item.weight : 0),
    0
  );

  // ─── KVKK ─────────────────────────────────────────────────────────────────
  const checklistKvkk: ComplianceCheckItem[] = [
    {
      id: "verbis",
      label: "VERBİS kaydı yapıldı",
      weight: 25,
      passed: sub.kvkkVerbisRegistered === true,
      note: "verbis.kvkk.gov.tr adresinden kayıt yapılmalı.",
    },
    {
      id: "data_inventory",
      label: "Kişisel veri envanteri mevcut",
      weight: 20,
      passed: sub.hasDataInventory === true,
      note: "Politika kütüphanesinden veri sınıflandırma şablonunu kullanın.",
    },
    {
      id: "no_breach",
      label: "Bilinen veri sızıntısı yok",
      weight: 25,
      passed: (scan?.hibpBreachCount ?? 0) === 0,
      note:
        (scan?.hibpBreachCount ?? 0) > 0
          ? `${scan!.hibpBreachCount} sızıntı tespit edildi.`
          : null,
    },
    {
      id: "breach_notification",
      label: "72 saat bildirim kapasitesi var",
      weight: 15,
      passed: true,
      note: "CyberStep anlık tehdit bildirimi ile karşılanıyor.",
    },
    {
      id: "technical_measures",
      label: "Teknik tedbirler yeterli",
      weight: 15,
      passed: (scan?.overallScore ?? 0) >= 60,
      note: null,
    },
  ];

  const scoreKvkk = checklistKvkk.reduce(
    (sum, item) => sum + (item.passed ? item.weight : 0),
    0
  );

  // ─── Kaydet ───────────────────────────────────────────────────────────────
  const scoreMonth = new Date().toISOString().slice(0, 7);

  await db.execute(
    db
      .insert(complianceScoresTable)
      .values({
        customerId,
        scoreMonth,
        score7545,
        scoreKvkk,
        checklist7545: checklist7545 as unknown as Record<string, unknown>[],
        checklistKvkk: checklistKvkk as unknown as Record<string, unknown>[],
      })
      .onConflictDoUpdate({
        target: [complianceScoresTable.customerId, complianceScoresTable.scoreMonth],
        set: {
          score7545,
          scoreKvkk,
          checklist7545: checklist7545 as unknown as Record<string, unknown>[],
          checklistKvkk: checklistKvkk as unknown as Record<string, unknown>[],
          calculatedAt: new Date(),
        },
      })
  );

  logger.info({ customerId, score7545, scoreKvkk, scoreMonth }, "Uyum skoru hesaplandı");

  return { score7545, scoreKvkk, checklist7545, checklistKvkk };
}
