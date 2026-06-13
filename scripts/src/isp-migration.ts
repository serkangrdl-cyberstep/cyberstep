import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  // 1. isp_organization kolonu lead_candidates'a ekle
  await db.execute(sql`ALTER TABLE lead_candidates ADD COLUMN IF NOT EXISTS isp_organization TEXT`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lead_candidates_isp ON lead_candidates(isp_organization)`);
  console.log("lead_candidates.isp_organization OK");

  // 2. isp_partners tablosu
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS isp_partners (
      id SERIAL PRIMARY KEY,
      organization_name_pattern TEXT NOT NULL,
      partner_name VARCHAR(255) NOT NULL,
      partner_contact VARCHAR(255),
      is_active_partnership BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_isp_partners_pattern ON isp_partners(organization_name_pattern)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_isp_partners_name ON isp_partners(partner_name)`);
  console.log("isp_partners table OK");

  // 3. Seed — bilinen Türk ISP/hosting normalize mapping
  const seeds: [string, string][] = [
    ["%Turk Telekomunikasyon%", "Türk Telekom"],
    ["%TTNet%", "Türk Telekom"],
    ["%TT Teknoloji%", "Türk Telekom"],
    ["%Turk Telecom%", "Türk Telekom"],
    ["%Superonline Iletisim%", "Turkcell Superonline"],
    ["%Superonline%", "Turkcell Superonline"],
    ["%Turkcell Superonline%", "Turkcell Superonline"],
    ["%Vodafone Net%", "Vodafone"],
    ["%Vodafone Telekomunikasyon%", "Vodafone"],
    ["%Vodafone TR%", "Vodafone"],
    ["%TURKNET%", "TurkNet"],
    ["%Turknet Iletisim%", "TurkNet"],
    ["%Turk Net%", "TurkNet"],
    ["%Fibernet%", "Fibernet"],
    ["%Millenicom%", "Millenicom"],
    ["%Radore%", "Radore Hosting"],
    ["%Natro%", "Natro"],
    ["%Doruk%", "Doruk Net"],
    ["%Fatihnet%", "Fatihnet"],
    ["%Bursanet%", "Bursanet"],
    ["%Metronet%", "Metronet"],
    ["%Hetzner%", "Hetzner Online"],
    ["%OVH%", "OVH"],
    ["%DigitalOcean%", "DigitalOcean"],
    ["%Amazon%", "AWS"],
    ["%AMAZON%", "AWS"],
    ["%Microsoft Corporation%", "Azure"],
    ["%Google LLC%", "Google Cloud"],
    ["%Cloudflare%", "Cloudflare"],
    ["%Akamai%", "Akamai"],
  ];
  for (const [pattern, name] of seeds) {
    await db.execute(sql`
      INSERT INTO isp_partners(organization_name_pattern, partner_name)
      VALUES (${pattern}, ${name})
      ON CONFLICT DO NOTHING
    `);
  }
  console.log(`Seeded ${seeds.length} ISP patterns`);

  // 4. Backfill — mevcut lead'lerin source_data->>'org' → isp_organization
  const result = await db.execute(sql`
    UPDATE lead_candidates
    SET isp_organization = source_data->>'org'
    WHERE isp_organization IS NULL
      AND source_data->>'org' IS NOT NULL
      AND source_data->>'org' <> ''
  `);
  console.log("Backfilled rows:", result.rowCount);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
