  import pg from "pg";
  const { Client } = pg;
  const DATABASE_URL = process.env.DATABASE_URL;
  const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
  if (!DATABASE_URL) { console.error("HATA: DATABASE_URL tanımlı değil"); process.exit(1); }
  if (!HUNTER_API_KEY) { console.error("HATA: HUNTER_API_KEY tanımlı değil"); process.exit(1); }
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(`SELECT id, domain FROM lead_candidates WHERE is_qualified = true AND contact_email IS NULL ORDER BY risk_score DESC`);
  console.log(`\n${rows.length} aday bulundu\n${"─".repeat(50)}`);
  let found = 0, empty = 0, errors = 0;
  for (const { id, domain } of rows) {
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&type=professional&limit=5`;
      const res = await fetch(url);
      if (res.status === 429) { console.log(`[RATE_LIMIT] ${domain} — 10sn bekleniyor`); await new Promise(r => setTimeout(r, 10_000)); continue; }
      if (!res.ok) { console.log(`[SKIP] ${domain} → HTTP ${res.status}`); errors++; continue; }
      const data = await res.json();
      const emails = data.data?.emails ?? [];
      if (emails.length === 0) { console.log(`[EMPTY] ${domain}`); empty++; await new Promise(r => setTimeout(r, 300)); continue; }
      const top = emails[0];
      const contactEmail = top.value ?? null;
      const contactName = [top.first_name, top.last_name].filter(Boolean).join(" ") || null;
      const contactTitle = top.position ?? null;
      await client.query(`UPDATE lead_candidates SET contact_email=$1, contact_name=$2, contact_title=$3, contact_source='hunter', updated_at=NOW() WHERE id=$4`, [contactEmail, contactName, contactTitle, id]);
      console.log(`[OK]    ${domain.padEnd(30)} → ${contactEmail}${contactName ? ` (${contactName})` : ""}`);
      found++;
      await new Promise(r => setTimeout(r, 400));
    } catch (err) { console.error(`[ERROR] ${domain}: ${err.message}`); errors++; }
  }
  await client.end();
  console.log(`\n${"─".repeat(50)}\nTamamlandı — bulundu: ${found}, boş: ${empty}, hata: ${errors}`);
  ENDOFSCRIPT

