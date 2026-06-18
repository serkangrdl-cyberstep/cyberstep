// ADIM 1 doğrulaması: crt.sh mutex'i 20 dakikadan uzun süre kilitli kalmışsa
// _acquireCrtsh() bunu zorla serbest bırakmalı ve logger.warn ile uyarmalı.
//
// __crtshMutexTestHooks üzerinden gerçek (üretimde kullanılan) mutex
// fonksiyonlarına erişiyoruz — paralel bir test implementasyonu değil.
//
// Run: pnpm --filter @workspace/api-server exec tsx src/scripts/validate-crtsh-mutex-timeout.ts

import { __crtshMutexTestHooks } from "../services/crtshScanner";

let failures = 0;
function step(ok: boolean, label: string, detail: string): void {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("crt.sh mutex timeout doğrulaması başlıyor\n");

  // 1) Mutex'i "25 dakika önce kilitlenmiş ve hiç bırakılmamış" durumuna getir.
  const TWENTY_FIVE_MIN_AGO = Date.now() - 25 * 60 * 1000;
  __crtshMutexTestHooks.forceState(true, TWENTY_FIVE_MIN_AGO);

  const before = __crtshMutexTestHooks.getState();
  step(
    before.running === true && before.acquiredAt === TWENTY_FIVE_MIN_AGO,
    "Ön koşul: mutex 'running=true, 25dk önce acquired' durumuna ayarlandı",
    JSON.stringify(before),
  );

  // 2) _acquireCrtsh() çağır — beklenti: stale kilidi tespit edip zorla
  //    serbest bırakmalı, warn loglamalı, sonra HEMEN (kuyruğa girmeden) kendi
  //    kilidini almalı.
  console.log("\n_acquireCrtsh() çağrılıyor (aşağıdaki [WARN] satırı uygulamanın gerçek logger.warn çağrısıdır)...\n");
  const acquireStart = Date.now();
  await __crtshMutexTestHooks.acquire();
  const acquireDurationMs = Date.now() - acquireStart;

  const after = __crtshMutexTestHooks.getState();
  console.log(`\nacquire() ${acquireDurationMs}ms içinde resolve oldu (kuyrukta beklemedi — stale kilit zorla kırıldı)`);

  step(acquireDurationMs < 1000, "acquire() neredeyse anında resolve oldu (kuyruğa girmedi)", `${acquireDurationMs}ms`);
  step(after.running === true, "Yeni acquire sonrası mutex tekrar 'running=true'", JSON.stringify(after));
  step(
    after.acquiredAt !== null && after.acquiredAt > TWENTY_FIVE_MIN_AGO && Date.now() - after.acquiredAt < 1000,
    "acquiredAt yeni bir zaman damgasına güncellendi (eski 25dk'lık değer değil)",
    `eski=${TWENTY_FIVE_MIN_AGO}, yeni=${after.acquiredAt}`,
  );

  // 3) Temizlik: testin mutex'i kilitli bırakmaması için release et.
  __crtshMutexTestHooks.release();
  const cleaned = __crtshMutexTestHooks.getState();
  step(cleaned.running === false, "Temizlik: mutex serbest bırakıldı, başka testleri etkilemeyecek", JSON.stringify(cleaned));

  console.log("");
  if (failures === 0) {
    console.log("TÜM ADIMLAR BAŞARILI — stale mutex zorla serbest bırakma çalışıyor.");
    process.exit(0);
  }
  console.log(`${failures} adım BAŞARISIZ.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Doğrulama betiği beklenmeyen hata:", err);
  process.exit(1);
});
