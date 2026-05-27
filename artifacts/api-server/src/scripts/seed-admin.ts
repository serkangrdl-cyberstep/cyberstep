// One-time seed script: creates admin user + default site settings + pricing plans
// Run: pnpm --filter @workspace/api-server tsx src/scripts/seed-admin.ts

import { db } from "@workspace/db";
import { adminUsersTable, siteSettingsTable, pricingPlansTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

const ADMIN_EMAIL = "serkangrdl@gmail.com";
const ADMIN_PASSWORD = "CyberStep2024!";

async function seed() {
  // Admin user
  const existing = await db.execute(sql`SELECT id FROM admin_users WHERE email = ${ADMIN_EMAIL}`);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.insert(adminUsersTable).values({ email: ADMIN_EMAIL, passwordHash: hash });
    console.log("Admin user created:", ADMIN_EMAIL);
    console.log("Initial password:", ADMIN_PASSWORD, "— change after first login!");
  } else {
    console.log("Admin user already exists, skipping.");
  }

  // Site settings
  const defaultSettings: Record<string, string> = {
    "about.title": "CyberStep.io Hakkında",
    "about.content": "CyberStep.io, Türkiye'deki KOBİ'lere yönelik siber güvenlik risk analizi sunan bir platformdur. Yapay zeka destekli değerlendirme araçları ve uzman incelemesiyle işletmenizin güvenlik açıklarını hızla tespit ederiz.",
    "contact.email": "info@cyberstep.io",
    "contact.phone": "+90 212 000 00 00",
    "contact.address": "İstanbul, Türkiye",
    "kvkk.content": "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında kişisel verileriniz CyberStep.io tarafından işlenmektedir. Verileriniz yalnızca siber güvenlik değerlendirme hizmetlerinin sunulması amacıyla toplanmakta ve üçüncü taraflarla paylaşılmamaktadır. Daha fazla bilgi için info@cyberstep.io adresine ulaşabilirsiniz.",
    "footer.company": "CyberStep.io",
    "footer.tagline": "KOBİ'ler için siber güvenlik risk analizi",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoNothing();
  }
  console.log("Site settings seeded.");

  // Pricing plans
  const plans = [
    { slug: "mini", name: "Mini Değerlendirme", price: "0", description: "20 soruluk ücretsiz başlangıç değerlendirmesi", features: ["20 soru, 5 alan", "AI destekli analiz", "Uzman incelemeli rapor", "PDF rapor"], isActive: true, sortOrder: 1 },
    { slug: "full", name: "Tam Değerlendirme", price: "4990", description: "55 soruluk kapsamlı siber güvenlik denetimi", features: ["55 soru, 10 alan", "AI destekli detaylı analiz", "Uzman incelemeli rapor", "PDF rapor", "Aksiyon planı", "Öncelikli destek"], isActive: true, sortOrder: 2 },
    { slug: "premium", name: "Premium Danışmanlık", price: "14990", description: "Kişisel danışmanlık ve saha değerlendirmesi", features: ["Tam değerlendirme", "1-1 uzman görüşmesi", "Saha incelemesi", "Teknik yol haritası", "6 ay takip desteği"], isActive: true, sortOrder: 3 },
  ];

  for (const plan of plans) {
    await db.insert(pricingPlansTable)
      .values({ ...plan, updatedAt: new Date() })
      .onConflictDoNothing();
  }
  console.log("Pricing plans seeded.");

  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
