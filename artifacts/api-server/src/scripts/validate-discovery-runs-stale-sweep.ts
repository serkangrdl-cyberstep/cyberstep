// ADIM 3 doğrulaması: cleanupStaleDiscoveryRuns(), 12 Haziran 2026'da elle SQL
// ile yapılan temizliğin otomatikleştirilmiş hali. status='running' VE
// started_at 30 dakikadan eski olan discovery_runs satırlarını 'failed' yapar.
//
// Bu betik gerçek veritabanına elle bir "stale" satır ekler, cleanupStaleDiscoveryRuns()'ı
// (production'da server başlangıcında çağrılan AYNI fonksiyon) doğrudan çağırır,
// ve sonucu SQL ile doğrular. Ayrıca "henüz stale olmayan" bir running satırın
// DOKUNULMADIĞINI da kontrol eder (yanlış pozitif olmadığını kanıtlamak için).
//
// Run: pnpm --filter @workspace/api-server exec tsx src/scripts/validate-discovery-runs-stale-sweep.ts

import { db, discoveryRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cleanupStaleDiscoveryRuns } from "../services/cronRegistry";

let failures = 0;
function step(ok: boolean, label: string, detail: string): void {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("discovery_runs stale-row sweep doğrulaması başlıyor\n");

  // 1) Stale test satırı: status='running', started_at = NOW() - 1 saat (eşik 30dk).
  const [staleRow] = await db.insert(discoveryRunsTable).values({
    source: "crtsh",
    runParams: { test: "validate-discovery-runs-stale-sweep", kind: "stale" },
    status: "running",
    startedAt: new Date(Date.now() - 60 * 60 * 1000),
  }).returning();
  console.log(`Stale test satırı oluşturuldu: id=${staleRow.id}, started_at=1 saat önce`);

  // 2) Kontrol grubu: status='running', started_at = NOW() - 5 dakika (eşiğin altında).
  //    Bu satıra DOKUNULMAMALI — sweep'in yanlışlıkla az önce başlamış gerçek
  //    run'ları "failed" yapmadığını kanıtlar.
  const [freshRow] = await db.insert(discoveryRunsTable).values({
    source: "crtsh",
    runParams: { test: "validate-discovery-runs-stale-sweep", kind: "fresh" },
    status: "running",
    startedAt: new Date(Date.now() - 5 * 60 * 1000),
  }).returning();
  console.log(`Fresh (henüz stale olmayan) test satırı oluşturuldu: id=${freshRow.id}, started_at=5 dakika önce\n`);

  // 3) Production'daki AYNI fonksiyonu (server başlangıcında çağrılan) tetikle.
  console.log("cleanupStaleDiscoveryRuns() çağrılıyor (aşağıdaki [WARN] satırı gerçek logger.warn çağrısıdır)...\n");
  await cleanupStaleDiscoveryRuns();

  // 4) Sonuçları SQL ile doğrula.
  const [staleAfter] = await db.select().from(discoveryRunsTable).where(eq(discoveryRunsTable.id, staleRow.id));
  const [freshAfter] = await db.select().from(discoveryRunsTable).where(eq(discoveryRunsTable.id, freshRow.id));

  console.log(`\nStale satır (id=${staleRow.id}) sonrası:`, JSON.stringify(staleAfter, null, 2));
  console.log(`Fresh satır (id=${freshRow.id}) sonrası:`, JSON.stringify(freshAfter, null, 2));

  step(staleAfter?.status === "failed", "Stale satır status='failed' oldu", String(staleAfter?.status));
  step(
    staleAfter?.errorMessage === "Stale on restart — cleaned up",
    "Stale satırın error_message'ı doğru",
    String(staleAfter?.errorMessage),
  );
  step(staleAfter?.completedAt !== null, "Stale satırın completed_at'i set edildi", String(staleAfter?.completedAt));
  step(freshAfter?.status === "running", "Fresh satıra DOKUNULMADI, hâlâ 'running'", String(freshAfter?.status));

  // 5) Temizlik.
  await db.delete(discoveryRunsTable).where(eq(discoveryRunsTable.id, staleRow.id));
  await db.delete(discoveryRunsTable).where(eq(discoveryRunsTable.id, freshRow.id));
  console.log(`\nTemizlik: test satırları (id=${staleRow.id}, id=${freshRow.id}) silindi.`);

  console.log("");
  if (failures === 0) {
    console.log("TÜM ADIMLAR BAŞARILI — stale-row sweep gerçek veritabanına karşı doğrulandı.");
    process.exit(0);
  }
  console.log(`${failures} adım BAŞARISIZ.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Doğrulama betiği beklenmeyen hata:", err);
  process.exit(1);
});
