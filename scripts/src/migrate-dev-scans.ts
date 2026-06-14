import pg from "pg";

const { Client } = pg;

const PROD_URL =
  "https://cyberstep.io/api/internal/migrate-domain-scans";
const SECRET = process.env["BRIDGE_SECRET"];
const DATABASE_URL = process.env["DATABASE_URL"];

if (!SECRET) {
  console.error("BRIDGE_SECRET env var gerekli");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL env var gerekli");
  process.exit(1);
}

const toCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Dev DB bağlantısı açıldı");

  // Prod'daki domain listesini al
  const prodResp = await fetch(PROD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scans: [], secret: SECRET }),
  });
  // 400 bekliyoruz (scans boş) — bu endpoint'in canlı olduğunu doğrular
  if (prodResp.status !== 400 && prodResp.status !== 200) {
    console.error(`Prod endpoint erişim hatası: HTTP ${prodResp.status}`);
    await client.end();
    process.exit(1);
  }
  console.log("Prod endpoint erişilebilir");

  // Dev'deki tüm domain'ler
  const { rows: devRows } = await client.query<{ domain: string }>(
    "SELECT DISTINCT domain FROM domain_scans"
  );
  const devDomains = devRows.map((r) => r.domain);
  console.log(`Dev'deki benzersiz domain: ${devDomains.length}`);

  // Prod'daki domain'leri bulk-check: küçük batch'lerle migrate ederken
  // endpoint zaten "exists check" yapıyor — tümünü gönderiyoruz, endpoint filtreler.

  // Her domain için en son taramayı al
  const { rows: scanIdRows } = await client.query<{ id: number }>(
    `SELECT DISTINCT ON (domain) id
     FROM domain_scans
     ORDER BY domain, created_at DESC`
  );
  const allIds = scanIdRows.map((r) => r.id);
  console.log(`Migrate edilecek toplam scan ID: ${allIds.length}`);

  const BATCH_SIZE = 50;
  let totalInserted = 0;
  let totalSkipped = 0;
  let batchNum = 0;

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batchIds = allIds.slice(i, i + BATCH_SIZE);
    batchNum++;

    const { rows } = await client.query(
      "SELECT * FROM domain_scans WHERE id = ANY($1::int[])",
      [batchIds]
    );

    // snake_case → camelCase
    const scans = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        out[toCamel(k)] = v;
      }
      return out;
    });

    const resp = await fetch(PROD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scans, secret: SECRET }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error(
        `Batch ${batchNum} HATA HTTP ${resp.status}: ${txt.slice(0, 200)}`
      );
      // Devam et
      continue;
    }

    const r = (await resp.json()) as {
      inserted: number;
      skipped: number;
      total: number;
    };
    totalInserted += r.inserted ?? 0;
    totalSkipped += r.skipped ?? 0;

    if (batchNum % 10 === 0 || i + BATCH_SIZE >= allIds.length) {
      console.log(
        `Batch ${batchNum} (${Math.min(i + BATCH_SIZE, allIds.length)}/${allIds.length}): ` +
          `+${r.inserted} eklendi, ${r.skipped} atlandı | Kümülatif: ${totalInserted} eklendi`
      );
    }
  }

  await client.end();
  console.log("\n=== Migration Tamamlandı ===");
  console.log(`Toplam eklenen: ${totalInserted}`);
  console.log(`Atlanan (zaten vardı): ${totalSkipped}`);
}

run().catch((e) => {
  console.error("Migration hatası:", e);
  process.exit(1);
});
