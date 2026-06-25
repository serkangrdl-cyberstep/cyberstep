/**
 * Test script: CT subdomain çek + HTTP probe + domain_scan_subdomains'e yaz
 * Çalıştır: pnpm --filter @workspace/api-server run test:subdomain-probe
 */
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { checkCertTransparency } from "../routes/domain-scan/index";
import { probeAndClassifySubdomains } from "../services/subdomainClassifier";

const DOMAIN = process.argv[2] ?? "tat.com.tr";

async function main() {
  console.log(`\n=== Subdomain Probe Test: ${DOMAIN} ===\n`);

  // 1. CT subdomains çek
  console.log("[1] crt.sh / Certificate Transparency sorgulanıyor...");
  const certTrans = await checkCertTransparency(DOMAIN).catch(() => ({ subdomains: [] as string[], count: 0 }));
  console.log(`    Bulunan: ${certTrans.count} subdomain`);
  if (certTrans.subdomains.length > 0) {
    console.log(`    İlk 10:`, certTrans.subdomains.slice(0, 10));
  }

  if (certTrans.subdomains.length === 0) {
    console.log("\nSonuç: Bu domain için CT'de subdomain kaydı yok.");
    process.exit(0);
  }

  // 2. Test scan satırı aç (domain'e -test-ts ek)
  const testDomain = `${DOMAIN}`;
  const [newScan] = await db.insert(domainScansTable).values({
    domain: testDomain,
    ctSubdomains: certTrans.subdomains,
    ctSubdomainCount: certTrans.count,
    spfPass: false,
    dmarcPass: false,
    dkimPass: false,
    mxPass: false,
    sslPass: false,
    overallScore: 0,
  }).returning({ id: domainScansTable.id });
  const scanId = newScan!.id;
  console.log(`\n[2] Yeni domain_scans satırı: id=${scanId}`);

  // 3. HTTP probe (synchronous, max 8 paralel, 5s timeout/subdomain)
  console.log(`\n[3] HTTP probe başlıyor (${certTrans.subdomains.length} subdomain, ~${Math.ceil(certTrans.subdomains.length / 8) * 5}s tahmini süre)...`);
  const t0 = Date.now();
  await probeAndClassifySubdomains(scanId, certTrans.subdomains);
  console.log(`    Tamamlandı (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // 4. Sonuçları göster
  const rows = await db.execute(sql`
    SELECT domain, http_status, asset_classification, priority_score, priority_reason
    FROM domain_scan_subdomains
    WHERE scan_id = ${scanId}
    ORDER BY priority_score DESC, domain
  `);

  console.log(`\n[4] domain_scan_subdomains (scan_id=${scanId}, ${rows.rowCount} kayıt):`);
  if (rows.rows.length > 0) {
    console.table(rows.rows);
  } else {
    console.log("    Kayıt yok (tüm subdomain'ler unreachable olabilir)");
  }

  // Özet
  const byClass = rows.rows.reduce((acc: Record<string, number>, r) => {
    const k = String(r.asset_classification ?? "unknown");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\nSınıf dağılımı:", byClass);

  const highPri = rows.rows.filter(r => Number(r.priority_score) >= 20);
  if (highPri.length > 0) {
    console.log(`\nYüksek öncelikli (score>=20):`);
    highPri.forEach(r => console.log(`  ${r.domain} [${r.asset_classification}] score=${r.priority_score} — ${r.priority_reason}`));
  }

  process.exit(0);
}

main().catch(e => {
  console.error("HATA:", e);
  process.exit(1);
});
