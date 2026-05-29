import { Router } from "express";
import { getTenantAiFn } from "../../services/ai-client";
import { logger } from "../../lib/logger";

const router = Router();

// ─── POST /api/kvkk/dpa-draft ─────────────────────────────────────────────────
router.post("/kvkk/dpa-draft", async (req, res) => {
  const {
    companyName,
    partnerName,
    partnerRole,
    dataCategories,
    processingPurpose,
    sector,
    retentionPeriod,
  } = req.body ?? {};

  if (!companyName || !partnerName || !dataCategories || !processingPurpose) {
    res.status(400).json({ error: "Zorunlu alanlar eksik: companyName, partnerName, dataCategories, processingPurpose" });
    return;
  }

  const prompt = `Sen Türkiye KVKK (Kişisel Verilerin Korunması Kanunu) uzmanısın.
Aşağıdaki bilgilere göre bir Veri İşleme Sözleşmesi (DPA) taslağı hazırla.

Bilgiler:
- Veri Sorumlusu (Firma): ${companyName}
- Veri İşleyen (Tedarikçi/Ortak): ${partnerName}
- Taraf Rolü: ${partnerRole ?? "Veri İşleyen"}
- Sektör: ${sector ?? "Belirtilmemiş"}
- İşlenen Veri Kategorileri: ${Array.isArray(dataCategories) ? dataCategories.join(", ") : dataCategories}
- İşleme Amacı: ${processingPurpose}
- Saklama Süresi: ${retentionPeriod ?? "Hizmet sözleşmesi süresi boyunca"}

Taslak şunları içermeli (Türkçe, hukuki dil, KOBİ'nin anlayabileceği açıklıkta):
1. Taraflar ve Tanımlar
2. Kişisel Veri İşleme Kapsamı ve Amacı
3. Veri İşleyenin Yükümlülükleri (KVKK Md.12 kapsamında teknik ve idari tedbirler)
4. Veri Sorumlusunun Yükümlülükleri
5. Veri Kategorileri ve Saklama Süreleri
6. Alt Veri İşleyenlere İlişkin Hükümler
7. Veri Güvenliği İhlali Bildirimi (72 saat kuralı)
8. Veri Silme, Yok Etme ve İade
9. Denetim ve Uyum
10. Sözleşmenin Süresi ve Feshi
11. İmza Bölümü

Sadece sözleşme metnini döndür, başka açıklama ekleme. Madde numaralandırması ile düzgün formatla.`;

  try {
    const aiFn = await getTenantAiFn();
    const text = await aiFn(prompt);
    res.json({ draftText: text, companyName, partnerName });
  } catch (err) {
    logger.error({ err }, "DPA draft generation failed");
    res.status(500).json({ error: "Sözleşme taslağı oluşturulamadı" });
  }
});

export default router;
