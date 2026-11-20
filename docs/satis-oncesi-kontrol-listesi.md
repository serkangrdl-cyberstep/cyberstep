# Satış öncesi kontrol listesi (TPRM)

Durum: `[ ]` yapılmadı · `[~]` kısmen · `[x]` tamam. "Doğrulanmadı" = şartlar henüz okunmadı; varsayım yapılmamalı.

## 1. Veri kaynakları: yazılı izin, ticari lisans veya ücretli API gerekenler

| Kaynak | Durum | Ne gerekiyor |
|---|---|---|
| ransomware.live | Ticari kullanım **yasak**, yazılı onay şart (şartlar 14 Ağu 2026). Ücretli/danışmanlık hizmetinde kullanım ve türetilmiş içgörü satışı da ticari sayılıyor | Kodda kullanılmıyor. Kullanılacaksa önce yazılı onay. Alternatif: RansomLook (CC BY 4.0, atıfla ticari kullanıma açık) — API uç noktaları ve limitler `/doc/` sayfasından doğrulanmalı |
| VirusTotal Public API | Ticari kullanım yasak | Ticari lisans al veya itibar skorundan çıkar |
| Google Safe Browsing | Ticari kullanım için uygun değil | Web Risk API'ye geç (ücretli) |
| Hudson Rock | Ticari şartlar doğrulanmadı | Şartları oku; gerekirse ticari plan |
| Censys | Fiyat/şartlar doğrulanmadı | Fiyat ve ticari kullanım izni |
| HIBP | Alan adı sahipliği doğrulaması sorunu | Müşterinin tedarikçisi için domain doğrulaması yapılamaz; alternatif veya ticari plan |
| abuse.ch (ThreatFox, URLhaus, Feodo) | Ticari/kâr amaçlı kullanım ücretli abonelik gerektirebilir (ThreatFox SSS'si) | Şartları oku; gerekirse ticari API |
| SSL Labs | v3 canlıda çalışıyor, ancak v4 için kayıt gerekiyor; ticari şartlar doğrulanmadı | v3 kaldırılma riski ve ticari kullanım şartları kontrolü |
| Mozilla Observatory, crt.sh, OTX, VulnCheck KEV, NVD, EPSS | Şartlar doğrulanmadı | Her biri için ticari kullanım/atıf şartı kontrolü |

Kural: şartı okunmamış kaynak satışa konu özellikte "hazır" sayılmaz.

## 2. Temizlik
- [ ] Demo uçlarını kaldır: `routes/admin-panel/tprm-demo.ts`
- [ ] sasa-demo hesabını ve test tedarikçilerini (11–24) sil

## 3. Ürün/hukuk
- [ ] BDDK eşlemesini uyum/hukuk ile doğrulat
- [ ] Destek erişimi talebi için bildirim e-postası (e-posta servisi hazır olunca)
- [ ] E-posta servisi ve Iyzico (en son)
- [ ] Kullanım koşulları/KVKK metninde tedarikçi taramasının dayanağı ve dış kaynak atıfları
