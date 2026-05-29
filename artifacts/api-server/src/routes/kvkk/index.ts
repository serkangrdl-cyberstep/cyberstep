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

// ─── POST /api/panic-advice ───────────────────────────────────────────────────
router.post("/panic-advice", async (req, res) => {
  const { attackType, companyType, currentImpact, timeElapsed, affectedSystems } = req.body ?? {};

  if (!attackType || !currentImpact) {
    res.status(400).json({ error: "attackType ve currentImpact zorunludur" });
    return;
  }

  const prompt = `Sen Türkiye'de KOBİler için siber güvenlik olay müdahale uzmanısın.
Bir KOBİ şu anda siber saldırı altında ve acil yardıma ihtiyacı var.

Saldırı Bilgileri:
- Saldırı türü: ${attackType}
- Firma türü: ${companyType ?? "KOBİ"}
- Saldırıdan bu yana geçen süre: ${timeElapsed ?? "Bilinmiyor"}
- Mevcut durum: ${currentImpact}
- Etkilenen sistemler: ${affectedSystems ?? "Belirtilmemiş"}

Lütfen aşağıdaki formatta ACIL müdahale planı ver:

## İlk 30 Dakika (Hemen Yapın)
- 3-5 somut adım, KOBİ sahibinin bizzat yapabileceği
- Her adım tek cümle, jargon yok

## İlk 4 Saat
- 3-5 adım, teknik ekibinle koordine et

## KVKK Bildirimi Gerekiyor mu?
- Kişisel veri etkilendiyse 72 saat içinde KVKK'ya bildirim zorunlu
- Bildirim gerekiyorsa: "EVET — verbis.kvkk.gov.tr veya sgd@kvkk.gov.tr" 
- Gerekmiyorsa: "Mevcut bilgilerle gerek görünmüyor ama takip et"

## Kanıt Toplama (Kritik)
- 3 adım, silinmeden önce ne saklanmalı

## İyileşme Adımları
- Sisteme geri dönüş için 3-5 öncelikli adım

## Tekrar Olmaması İçin
- 2-3 spesifik güvenlik önlemi

Türkçe yaz, sade dil, bullet points, başlıklar markdown ile.`;

  try {
    const aiFn = await getTenantAiFn();
    const text = await aiFn(prompt);
    res.json({ advice: text, attackType, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "Panic advice generation failed");
    res.status(500).json({ error: "Müdahale planı oluşturulamadı" });
  }
});

export default router;
