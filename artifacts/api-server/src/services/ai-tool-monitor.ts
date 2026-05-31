import { db } from "@workspace/db";
import {
  aiToolsRegistryTable,
  aiToolPolicySnapshotsTable,
  aiMonitoringSubscriptionsTable,
  aiMonitoringAlertsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getClaudeAiFn } from "./ai-client";
import { logger } from "../lib/logger";
import { sendMail } from "./email";
import { customersTable } from "@workspace/db";

const claudeFn = getClaudeAiFn();

export async function checkAllToolsForChanges(): Promise<void> {
  const tools = await db.select().from(aiToolsRegistryTable);
  for (const tool of tools) {
    try {
      await checkToolForChanges(tool.id);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      logger.error({ err, toolId: tool.id }, "AI tool monitor check failed");
    }
  }
  logger.info({ count: tools.length }, "AI tool policy check complete");
}

export async function checkToolForChanges(toolId: number): Promise<void> {
  const [tool] = await db.select().from(aiToolsRegistryTable).where(eq(aiToolsRegistryTable.id, toolId));
  if (!tool) return;

  const [latestSnapshot] = await db
    .select()
    .from(aiToolPolicySnapshotsTable)
    .where(eq(aiToolPolicySnapshotsTable.toolId, toolId))
    .orderBy(desc(aiToolPolicySnapshotsTable.createdAt))
    .limit(1);

  const changes: string[] = [];

  if (latestSnapshot) {
    if (tool.dataRetentionDays !== latestSnapshot.dataRetentionDays)
      changes.push(`Veri saklama süresi değişti: ${latestSnapshot.dataRetentionDays ?? "?"} gün → ${tool.dataRetentionDays ?? "?"} gün`);
    if (tool.trainsOnUserData !== latestSnapshot.trainsOnUserData)
      changes.push(tool.trainsOnUserData ? "Artık kullanıcı verisi eğitim için kullanılıyor" : "Artık eğitim için kullanıcı verisi kullanılmıyor");
    if (tool.kvkkCompatible !== latestSnapshot.kvkkCompatible)
      changes.push(tool.kvkkCompatible ? "KVKK uyumluluğu arttı" : "KVKK uyumluluğu azaldı");
    if (tool.riskLevel !== latestSnapshot.riskLevel)
      changes.push(`Risk seviyesi değişti: ${latestSnapshot.riskLevel ?? "?"} → ${tool.riskLevel ?? "?"}`);
  }

  if (changes.length > 0 || !latestSnapshot) {
    const severity = determineSeverity(changes, tool, latestSnapshot ?? null);
    let changeSummary = "İlk kayıt";
    if (changes.length > 0) {
      changeSummary = await generateChangeSummary(tool.toolName, changes);
    }

    const today = new Date().toISOString().split("T")[0]!;
    const [snap] = await db.insert(aiToolPolicySnapshotsTable).values({
      toolId,
      snapshotDate: today,
      dataRetentionDays: tool.dataRetentionDays,
      trainsOnUserData: tool.trainsOnUserData,
      kvkkCompatible: tool.kvkkCompatible,
      dpaAvailable: tool.dpaAvailable,
      riskLevel: tool.riskLevel,
      riskSummary: tool.riskSummary,
      recommendation: tool.recommendation,
      isChanged: changes.length > 0,
      changeSummary,
      changeSeverity: severity,
    }).returning();

    if (changes.length > 0 && snap) {
      await triggerAlerts(toolId, snap.id, changes, changeSummary, severity, tool.toolName);
    }
  }
}

async function generateChangeSummary(toolName: string, changes: string[]): Promise<string> {
  try {
    const prompt = `${toolName} yapay zeka aracının gizlilik politikasında değişiklik tespit edildi.\n\nDeğişiklikler:\n${changes.join("\n")}\n\nBu değişikliği Türk KOBİ patronuna anlatan 2-3 cümlelik özet yaz. Teknik terim kullanma. Şu soruyu yanıtla: "Bu beni nasıl etkiler?" Eğer risk artıyorsa açıkça belirt. Sadece özet metni döndür.`;
    return await claudeFn(prompt);
  } catch {
    return changes.join("; ");
  }
}

function determineSeverity(changes: string[], tool: typeof aiToolsRegistryTable.$inferSelect, prev: typeof aiToolPolicySnapshotsTable.$inferSelect | null): string {
  if (!prev) return "minor";
  if (!prev.trainsOnUserData && tool.trainsOnUserData) return "critical";
  if (prev.kvkkCompatible && !tool.kvkkCompatible) return "critical";
  if (changes.some(c => c.includes("risk") || c.includes("saklama"))) return "important";
  return "minor";
}

async function triggerAlerts(toolId: number, snapshotId: number, changes: string[], summary: string, severity: string, toolName: string): Promise<void> {
  const subs = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.status, "active"));
  const affected = subs.filter(s => {
    const ids = s.monitoredToolIds ?? [];
    return ids.includes(toolId);
  });

  for (const sub of affected) {
    if (severity === "minor" && !sub.alertOnMinor) continue;
    if (severity === "important" && !sub.alertOnImportant) continue;
    if (severity === "critical" && !sub.alertOnCritical) continue;

    const [alert] = await db.insert(aiMonitoringAlertsTable).values({
      subscriptionId: sub.id,
      customerId: sub.customerId,
      toolId,
      snapshotId,
      alertType: "policy_change",
      severity,
      title: `${toolName} gizlilik politikası değişti`,
      summary,
      recommendation: severity === "critical" ? `${toolName} kullanımını askıya alın ve KVKK danışmanınızla görüşün.` : `${toolName} kullanımını gözden geçirin.`,
      sentAt: new Date(),
    }).returning();

    if (alert && sub.notifyEmail) {
      const [customer] = await db.select({ email: customersTable.email, companyName: customersTable.companyName })
        .from(customersTable).where(eq(customersTable.id, sub.customerId));
      if (customer) {
        await sendMail({
          to: customer.email,
          subject: `${severity === "critical" ? "🔴 KRİTİK" : "⚠️"} ${toolName} Gizlilik Politikası Değişti`,
          html: buildAlertEmail(customer.companyName ?? "Sayın Müşteri", toolName, summary, severity, alert.recommendation ?? ""),
        }).catch(() => {});
      }
    }
  }
}

function buildAlertEmail(companyName: string, toolName: string, summary: string, severity: string, recommendation: string): string {
  const severityLabel = severity === "critical" ? "KRİTİK" : severity === "important" ? "ÖNEMLİ" : "BİLGİ";
  const borderColor = severity === "critical" ? "#dc2626" : severity === "important" ? "#d97706" : "#2563eb";
  return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1e293b;">${toolName} Gizlilik Politikası Değişti</h2>
  <p>Sayın ${companyName},</p>
  <div style="border-left: 4px solid ${borderColor}; padding: 12px 16px; margin: 16px 0; background: #f8fafc;">
    <strong>Önem Seviyesi: ${severityLabel}</strong><br>
    ${summary}
  </div>
  <p><strong>Önerilen Aksiyon:</strong> ${recommendation}</p>
  <p>Detaylar için: <a href="https://cyberstep.io/ai-arac-izleme">cyberstep.io/ai-arac-izleme</a></p>
  <hr style="margin: 24px 0;">
  <p style="color: #64748b; font-size: 12px;">CyberStep AI Araç İzleme Servisi</p>
</div>`;
}

export async function sendWeeklyAIMonitoringDigests(): Promise<void> {
  const subs = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.status, "active"));
  for (const sub of subs) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const alerts = await db.select().from(aiMonitoringAlertsTable)
      .where(and(eq(aiMonitoringAlertsTable.customerId, sub.customerId)));
    const recentAlerts = alerts.filter(a => a.createdAt > weekAgo);
    if (recentAlerts.length === 0) continue;

    const [customer] = await db.select({ email: customersTable.email, companyName: customersTable.companyName })
      .from(customersTable).where(eq(customersTable.id, sub.customerId));
    if (!customer) continue;

    await sendMail({
      to: customer.email,
      subject: `Haftalık AI Araç İzleme Raporu — ${recentAlerts.length} değişiklik`,
      html: `<p>Sayın ${customer.companyName ?? "Müşteri"},</p><p>Bu hafta ${recentAlerts.length} AI aracında değişiklik tespit edildi.</p><p><a href="https://cyberstep.io/ai-arac-izleme">Panele git →</a></p>`,
    }).catch(() => {});
  }
}
