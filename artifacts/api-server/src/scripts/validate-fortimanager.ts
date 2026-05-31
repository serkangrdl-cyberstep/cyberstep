// End-to-end validation of the FortiManager auto-block path against a REAL appliance.
//
// This exercises the exact production code path used by the auto-block engine:
//   login -> address-object create -> block-group append -> policy install -> verify.
// It then cleans up by removing the test address (non-destructive).
//
// It does NOT need the app's DB — it validates the JSON-RPC layer. The DB
// recording into `fortimanager_block_actions` is exercised separately by the
// portal route / correlation engine, which call these same functions.
//
// Run (provide creds via env — never hard-code appliance secrets):
//   FM_URL="https://fmg.example.com" \
//   FM_USERNAME="apiuser" \
//   FM_PASSWORD="secret" \
//   FM_ADOM="root" \
//   FM_BLOCK_GROUP="CyberStep-BlockList" \
//   [FM_TEST_IP="198.51.100.66"] [FM_SKIP_CLEANUP="1"] \
//   pnpm --filter @workspace/api-server tsx src/scripts/validate-fortimanager.ts
//
// FM_TEST_IP defaults to a TEST-NET-2 address (RFC 5737), which is reserved for
// documentation/testing and is safe to push as a throwaway block entry.

import {
  fmTestConnection,
  fmDiscoverDevices,
  fmBlockIp,
  fmVerifyBlock,
  fmUnblockIp,
  type FortiManagerCreds,
} from "../services/fabric-fortimanager";

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Eksik ortam değişkeni: ${name}`);
    process.exit(2);
  }
  return v;
}

let failures = 0;
function step(ok: boolean, label: string, detail: string): void {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const creds: FortiManagerCreds = {
    url: req("FM_URL"),
    username: req("FM_USERNAME"),
    password: req("FM_PASSWORD"),
    adom: process.env["FM_ADOM"] || "root",
    blockGroup: process.env["FM_BLOCK_GROUP"] || "CyberStep-BlockList",
  };
  const testIp = process.env["FM_TEST_IP"] || "198.51.100.66";
  const skipCleanup = process.env["FM_SKIP_CLEANUP"] === "1";

  console.log("FortiManager gerçek cihaz doğrulaması başlıyor");
  console.log(`  URL=${creds.url} ADOM=${creds.adom} grup=${creds.blockGroup} testIP=${testIp}`);
  console.log("");

  // 1) Connection / RPC login
  const conn = await fmTestConnection(creds);
  step(conn.ok, "RPC login (bağlantı testi)", conn.message);
  if (!conn.ok) {
    console.log("\nBağlantı kurulamadı — kalan adımlar atlanıyor.");
    process.exit(1);
  }

  // 2) Device discovery (read path)
  const devices = await fmDiscoverDevices(creds);
  step(Array.isArray(devices), "Cihaz keşfi (dvmdb/device okuma)", `${devices.length} cihaz bulundu`);
  for (const d of devices.slice(0, 5)) {
    console.log(`        - ${d.name} (${d.type}${d.version ? ` ${d.version}` : ""}${d.ip ? `, ${d.ip}` : ""})`);
  }

  // 3) Block: address create + group append + policy install
  const block = await fmBlockIp(creds, testIp, "CyberStep doğrulama testi");
  step(block.ok, "Engelleme (adres + grup + politika kurulumu)", block.message);

  // 4) Verify membership
  const verify = await fmVerifyBlock(creds, testIp);
  step(verify.ok && verify.present, "Doğrulama (IP grupta mı)", verify.message);

  // 5) Cleanup (remove the test address)
  if (skipCleanup) {
    console.log("[SKIP] Temizlik atlandı (FM_SKIP_CLEANUP=1) — test IP grupta bırakıldı");
  } else {
    const cleanup = await fmUnblockIp(creds, testIp);
    step(cleanup.ok, "Temizlik (test IP kaldırma)", cleanup.message);

    const verifyGone = await fmVerifyBlock(creds, testIp);
    step(verifyGone.ok && !verifyGone.present, "Temizlik doğrulaması (IP artık yok)", verifyGone.message);
  }

  console.log("");
  if (failures === 0) {
    console.log("TÜM ADIMLAR BAŞARILI — auto-block yolu gerçek cihaza karşı doğrulandı.");
    process.exit(0);
  }
  console.log(`${failures} adım BAŞARISIZ — yukarıdaki mesajları inceleyin.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Doğrulama betiği beklenmeyen hata:", err);
  process.exit(1);
});
