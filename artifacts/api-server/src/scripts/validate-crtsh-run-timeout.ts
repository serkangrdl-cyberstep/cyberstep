// ADIM 2 doğrulaması: _scanCRTSHInner'ın kullandığı _raceWithRunTimeout,
// iş kasıtlı olarak uzun sürdüğünde (gerçek crt.sh fetch'i yerine 30 dakikalık
// bir sleep enjekte ediyoruz) gerçek bir discovery_runs satırını
// status='failed', error_message='Run-level timeout exceeded' ile kapatmalı.
//
// __crtshRunTimeoutTestHooks.raceWithRunTimeout, üretimde _scanCRTSHInner'ın
// kullandığı AYNI fonksiyon — kısaltılmış timeoutMs (10s, gerçek 20dk yerine)
// ile canlı veritabanına karşı çalıştırıyoruz.
//
// Run: pnpm --filter @workspace/api-server exec tsx src/scripts/validate-crtsh-run-timeout.ts

import { db, discoveryRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { __crtshRunTimeoutTestHooks } from "../services/crtshScanner";

const TEST_TIMEOUT_MS = 10_000; // gerçek 20dk yerine test için 10s
const INJECTED_HANG_MS = 30 * 60 * 1000; // "sonsuz" bekleme — TEST_TIMEOUT_MS'den çok daha uzun

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

let failures = 0;
function step(ok: boolean, label: string, detail: string): void {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("crt.sh run-level timeout doğrulaması başlıyor");
  console.log(`  test timeout=${TEST_TIMEOUT_MS}ms, enjekte edilen hang=${INJECTED_HANG_MS}ms\n`);

  // 1) Gerçek bir discovery_runs satırı oluştur — _scanCRTSHInner'ın yaptığının aynısı.
  const [run] = await db.insert(discoveryRunsTable).values({
    source: "crtsh",
    runParams: { test: "validate-crtsh-run-timeout", injectedHangMs: INJECTED_HANG_MS },
    status: "running",
  }).returning();
  console.log(`discovery_runs satırı oluşturuldu: id=${run.id}, status=running\n`);

  // 2) _raceWithRunTimeout'u, gerçek crt.sh fetch'i yerine kasıtlı uzun bir
  //    sleep ile çağır — production kodundaki AYNI race/cleanup mantığını sürer.
  const startedAt = Date.now();
  let caughtError: unknown = null;
  try {
    await __crtshRunTimeoutTestHooks.raceWithRunTimeout(
      run.id,
      () => sleep(INJECTED_HANG_MS).then(() => ({ hung: false })),
      TEST_TIMEOUT_MS,
    );
  } catch (err) {
    caughtError = err;
  }
  const elapsedMs = Date.now() - startedAt;

  step(caughtError instanceof Error, "raceWithRunTimeout() reject etti (timeout fırlattı)", String(caughtError));
  step(
    caughtError instanceof Error && caughtError.message === __crtshRunTimeoutTestHooks.timeoutMessage,
    "Hata mesajı doğru",
    caughtError instanceof Error ? caughtError.message : "n/a",
  );
  step(
    elapsedMs >= TEST_TIMEOUT_MS && elapsedMs < TEST_TIMEOUT_MS + 3000,
    "Süre TEST_TIMEOUT_MS civarında doldu (30dk enjekte edilen hang'i beklemedi)",
    `${elapsedMs}ms`,
  );

  // 3) Gerçek satırı SQL ile kontrol et.
  const [row] = await db.select().from(discoveryRunsTable).where(eq(discoveryRunsTable.id, run.id));
  console.log(`\ndiscovery_runs satırı (id=${run.id}) güncel hali:`, JSON.stringify(row, null, 2));

  step(row?.status === "failed", "Satır status='failed' olarak işaretlendi", String(row?.status));
  step(row?.errorMessage === "Run-level timeout exceeded", "error_message doğru", String(row?.errorMessage));
  step(row?.completedAt !== null, "completed_at set edildi", String(row?.completedAt));

  // 4) Temizlik: test satırını sil, gerçek discovery_runs verisini kirletmesin.
  await db.delete(discoveryRunsTable).where(eq(discoveryRunsTable.id, run.id));
  console.log(`\nTemizlik: test satırı (id=${run.id}) silindi.`);

  console.log("");
  if (failures === 0) {
    console.log("TÜM ADIMLAR BAŞARILI — run-level timeout gerçek DB satırına karşı doğrulandı.");
    process.exit(0);
  }
  console.log(`${failures} adım BAŞARISIZ.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Doğrulama betiği beklenmeyen hata:", err);
  process.exit(1);
});
