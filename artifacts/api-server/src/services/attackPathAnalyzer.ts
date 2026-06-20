import { db } from "@workspace/db";
import { attackPathsTable, domainScansTable, customersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { callModel } from "@workspace/ai";
import { logger } from "../lib/logger";
import type { AttackPathStage } from "@workspace/db";

interface ParsedPath {
  path_name: string;
  severity: string;
  confidence: number;
  stages: AttackPathStage[];
  narrative: string;
  estimated_damage_tl: number;
  single_fix: string;
  mermaid: string;
}

interface ScanFinding {
  severity: string;
  type: string;
  title: string;
  affectedAsset?: string;
}

function buildFindingsFromScan(scan: typeof domainScansTable.$inferSelect): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const domain = scan.domain;

  if (!scan.spfPass) {
    findings.push({ severity: "high", type: "no_spf", title: "SPF Kaydı Eksik", affectedAsset: domain });
  }
  if (!scan.dmarcPass) {
    findings.push({ severity: "high", type: "no_dmarc", title: "DMARC Kaydı Eksik", affectedAsset: domain });
  }
  if (!scan.dkimPass) {
    findings.push({ severity: "medium", type: "no_dkim", title: "DKIM Kaydı Eksik", affectedAsset: domain });
  }
  if (!scan.sslPass) {
    findings.push({ severity: "critical", type: "ssl_expired", title: "SSL Sertifikası Geçersiz/Süresi Dolmuş", affectedAsset: domain });
  }
  if (scan.hibpBreaches && scan.hibpBreaches.length > 0) {
    findings.push({ severity: "critical", type: "leaked_credential", title: `${scan.hibpBreaches.length} Veri Sızıntısı Tespit Edildi`, affectedAsset: domain });
  }
  if (scan.blacklistResults && scan.blacklistResults.some((b: { listed: boolean }) => b.listed)) {
    findings.push({ severity: "high", type: "blacklisted", title: "Domain Kara Listede", affectedAsset: domain });
  }
  if (scan.shodanOpenPorts && Array.isArray(scan.shodanOpenPorts)) {
    const criticalPorts = [22, 3389, 1433, 3306, 5432];
    for (const p of scan.shodanOpenPorts as Array<{ port: number; service: string }>) {
      if (criticalPorts.includes(p.port)) {
        findings.push({
          severity: "high",
          type: `open_${p.service || "port"}_port`,
          title: `Açık Port: ${p.port} (${p.service || "unknown"})`,
          affectedAsset: domain,
        });
      }
    }
  }
  if (scan.cveSummary && scan.cveSummary.length > 0) {
    for (const cve of scan.cveSummary.slice(0, 3)) {
      findings.push({
        severity: cve.cvssScore >= 7 ? "high" : "medium",
        type: "cve",
        title: `CVE: ${cve.cveId} - ${cve.service}`,
        affectedAsset: domain,
      });
    }
  }

  return findings;
}

export async function analyzeAttackPaths(customerId: number, scanId: number): Promise<void> {
  const [scan] = await db.select()
    .from(domainScansTable)
    .where(eq(domainScansTable.id, scanId))
    .limit(1);

  if (!scan) return;

  const findings = buildFindingsFromScan(scan);
  const leaksText = scan.hibpBreaches && scan.hibpBreaches.length > 0
    ? scan.hibpBreaches.map((b: { name: string }) => `Sızıntı kaynağı: ${b.name}`).join("\n")
    : "Tespit edilmedi";

  if (findings.length === 0) return;

  const prompt = `Sen offensive security uzmanısın.
Aşağıdaki güvenlik bulgularını analiz et ve gerçekçi saldırı yollarını (attack paths) belirle.

BULGULAR:
${findings.map(f => `[${f.severity}] ${f.type}: ${f.title} — ${f.affectedAsset ?? ""}`).join("\n")}

SIZMA VERİLERİ:
${leaksText}

GÖREV: Bu bulgular birleştirilerek nasıl saldırı yapılır?
Gerçekçi 1-3 saldırı senaryosu belirle.

Her senaryo için JSON:
{
  "path_name": "Kısa isim (maks 5 kelime)",
  "severity": "critical|high|medium",
  "confidence": 0-100,
  "stages": [
    {
      "stage": "1",
      "mitre_technique": "T1190",
      "technique_name": "Exploit Public-Facing Application",
      "finding_used": "Bulgu başlığı",
      "description": "Saldırgan bu adımda ne yapar (1 cümle)",
      "finding_type": "no_dmarc"
    }
  ],
  "narrative": "Patron dilinde 3-4 cümle saldırı hikayesi (Türkçe)",
  "estimated_damage_tl": 250000,
  "single_fix": "Sadece şunu kapat, bu path tamamen kapanır",
  "mermaid": "graph LR\\n  A[Saldırgan] -->|DMARC Yok| B[Sahte E-posta]\\n  B --> C[Hedef]"
}

Sadece JSON array döndür, başka hiçbir şey yazma.`;

  let raw: string;
  try {
    raw = await callModel({
      task: "attack-path",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error({ err, customerId, scanId }, "analyzeAttackPaths: Claude error");
    return;
  }

  let paths: ParsedPath[];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    paths = JSON.parse(match ? match[0] : raw) as ParsedPath[];
  } catch {
    logger.error({ customerId, scanId }, "analyzeAttackPaths: JSON parse error");
    return;
  }

  await db.delete(attackPathsTable).where(eq(attackPathsTable.customerId, customerId));

  for (const path of paths) {
    await db.insert(attackPathsTable).values({
      customerId,
      scanId,
      pathName: path.path_name,
      severity: path.severity,
      confidence: path.confidence,
      stages: path.stages,
      estimatedDamageTl: path.estimated_damage_tl,
      mermaidDiagram: path.mermaid,
      narrative: path.narrative,
      singleFixRecommendation: path.single_fix,
      status: "active",
    });
  }

  logger.info({ customerId, scanId, count: paths.length }, "Attack paths analyzed and saved");
}

export async function getLatestScan(customerId: number): Promise<{ id: number } | null> {
  const [customer] = await db.select({ email: customersTable.email })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  if (!customer) return null;

  const [scan] = await db.select({ id: domainScansTable.id })
    .from(domainScansTable)
    .where(eq(domainScansTable.email, customer.email))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(1);
  return scan ?? null;
}

export async function getActiveCustomers(): Promise<{ id: number }[]> {
  return db.select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.subscriptionStatus, "active"));
}
