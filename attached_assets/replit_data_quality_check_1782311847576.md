# Replit Agent Prompt — lead_candidates Veri Kalitesi Kontrolü

Geliştirme yok, sadece veri kalitesi raporu istiyorum. Aşağıdaki SQL sorgularını çalıştır ve sonuçları düzenli bir özet olarak ver.

---

## 1. Genel Tablo Durumu

```sql
-- Toplam kayıt
SELECT COUNT(*) AS toplam_domain FROM lead_candidates;

-- Tablo kolonlarının tam listesi
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lead_candidates'
ORDER BY ordinal_position;
```

---

## 2. Her Kolon İçin Doluluk Oranı

```sql
SELECT
  COUNT(*) AS toplam,

  -- Temel bilgiler
  COUNT(domain) AS domain_dolu,
  COUNT(NULLIF(TRIM(domain), '')) AS domain_dolu_bos_haric,

  -- Lokasyon
  COUNT(NULLIF(TRIM(city), '')) AS sehir_dolu,
  COUNT(NULLIF(TRIM(country), '')) AS ulke_dolu,

  -- Şirket / iletişim
  COUNT(NULLIF(TRIM(company_name), '')) AS sirket_adi_dolu,
  COUNT(NULLIF(TRIM(sector), '')) AS sektor_dolu,
  COUNT(NULLIF(TRIM(email), '')) AS email_dolu,
  COUNT(NULLIF(TRIM(phone), '')) AS telefon_dolu,
  COUNT(NULLIF(TRIM(contact_name), '')) AS yetkili_adi_dolu,

  -- Tarama durumu
  COUNT(NULLIF(TRIM(status), '')) AS durum_dolu,
  COUNT(NULLIF(TRIM(source), '')) AS kaynak_dolu

FROM lead_candidates;
```

> Eğer bir kolon adı yoksa hata verecek — o kolonu sorgudan çıkar ve bana hangilerin olmadığını söyle.

---

## 3. domain_scans Join Kalitesi

```sql
-- Kaç domain'in en az 1 scan'i var?
SELECT
  COUNT(DISTINCT lc.id) AS scan_olan_domain,
  (SELECT COUNT(*) FROM lead_candidates) AS toplam_domain,
  ROUND(
    COUNT(DISTINCT lc.id) * 100.0 / (SELECT COUNT(*) FROM lead_candidates), 1
  ) AS yuzde
FROM lead_candidates lc
INNER JOIN domain_scans ds ON ds.domain_id = lc.id;

-- Scan olan domain'lerde hangi alanlar dolu?
SELECT
  COUNT(*) AS scan_olan_toplam,
  COUNT(NULLIF(TRIM(ds.origin_ip), '')) AS ip_dolu,
  COUNT(NULLIF(TRIM(ds.abuseipdb_country), '')) AS ulke_dolu,
  COUNT(ds.open_ports_count) AS port_sayisi_dolu,
  COUNT(ds.critical_cve_count) AS kritik_cve_dolu,
  COUNT(ds.high_cve_count) AS yuksek_cve_dolu,
  COUNT(ds.risk_score) AS risk_skoru_dolu,
  COUNT(NULLIF(TRIM(ds.risk_level), '')) AS risk_seviyesi_dolu
FROM (
  SELECT DISTINCT ON (domain_id) *
  FROM domain_scans
  ORDER BY domain_id, scanned_at DESC
) ds
JOIN lead_candidates lc ON lc.id = ds.domain_id;
```

---

## 4. Sektör Dağılımı (Dolu Olanlar)

```sql
SELECT
  sector,
  COUNT(*) AS adet,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS yuzde
FROM lead_candidates
WHERE sector IS NOT NULL AND TRIM(sector) != ''
GROUP BY sector
ORDER BY adet DESC
LIMIT 20;
```

---

## 5. Kaynak Dağılımı

```sql
SELECT
  source,
  COUNT(*) AS adet,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS yuzde
FROM lead_candidates
GROUP BY source
ORDER BY adet DESC;
```

---

## 6. Ülke Dağılımı (domain_scans'tan)

```sql
SELECT
  ds.abuseipdb_country AS ulke,
  COUNT(*) AS adet
FROM (
  SELECT DISTINCT ON (domain_id) *
  FROM domain_scans
  ORDER BY domain_id, scanned_at DESC
) ds
WHERE ds.abuseipdb_country IS NOT NULL AND TRIM(ds.abuseipdb_country) != ''
GROUP BY ds.abuseipdb_country
ORDER BY adet DESC
LIMIT 15;
```

---

## 7. Risk Skoru Dağılımı

```sql
SELECT
  ds.risk_level,
  COUNT(*) AS adet,
  ROUND(AVG(ds.risk_score), 1) AS ort_skor,
  MIN(ds.risk_score) AS min_skor,
  MAX(ds.risk_score) AS max_skor
FROM (
  SELECT DISTINCT ON (domain_id) *
  FROM domain_scans
  ORDER BY domain_id, scanned_at DESC
) ds
WHERE ds.risk_level IS NOT NULL
GROUP BY ds.risk_level
ORDER BY adet DESC;
```

---

## Beklenen Çıktı Formatı

Tüm sorgu sonuçlarını şu şekilde özetle:

```
GENEL DURUM
- Toplam domain: X
- Taranmış domain: X (%Y)
- Taranmamış domain: X (%Y)

DOLULUK ORANI (lead_candidates)
- Sektör: X / 31.167 (%Y)
- Şehir: X / 31.167 (%Y)
- Şirket Adı: X / 31.167 (%Y)
- Email: X / 31.167 (%Y)
- ...

DOLULUK ORANI (domain_scans — son scan)
- IP Adresi: X (%Y)
- Ülke: X (%Y)
- Risk Skoru: X (%Y)
- ...

EKSİK / SORUNLU ALANLAR
- [Tespit ettiğin sorunları listele]
```

Kod yazmana gerek yok, sadece sorguları çalıştır ve rapor ver.
