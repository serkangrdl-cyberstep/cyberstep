# Replit Agent Prompt — Port & CVE Sayısal Kolon Backfill Fix

## Sorun

`domain_scans` tablosunda `open_ports_count`, `critical_cve_count`, `high_cve_count` kolonları tüm kayıtlarda 0 kalıyor. Veriler JSON formatında kaydediliyor (`shodan_open_ports` vb.) ama sayısal kolonlara yazılmıyor.

**Etki:** 4.124 taranmış domain'in tamamında port ve CVE sayıları 0 görünüyor. Excel export ve risk skorlama bu verileri kullanamıyor.

---

## Başlamadan Önce — Keşif

Önce şunları kontrol et, bana rapor et, sonra koda geç:

```sql
-- 1. domain_scans'taki tüm JSON kolonları gör
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'domain_scans'
ORDER BY ordinal_position;

-- 2. JSON kolon içeriklerine bak (ilk 3 kayıt)
SELECT
  id,
  open_ports_count,
  critical_cve_count,
  high_cve_count,
  shodan_open_ports,
  cve_findings,
  vulnerabilities
FROM domain_scans
WHERE shodan_open_ports IS NOT NULL
   OR cve_findings IS NOT NULL
   OR vulnerabilities IS NOT NULL
LIMIT 3;

-- 3. Hangi JSON kolonlarda veri var?
SELECT
  COUNT(*) FILTER (WHERE shodan_open_ports IS NOT NULL AND shodan_open_ports != 'null'::jsonb) AS shodan_ports_dolu,
  COUNT(*) FILTER (WHERE cve_findings IS NOT NULL AND cve_findings != 'null'::jsonb) AS cve_findings_dolu,
  COUNT(*) FILTER (WHERE vulnerabilities IS NOT NULL AND vulnerabilities != 'null'::jsonb) AS vulnerabilities_dolu
FROM domain_scans;
```

Keşif sonucuna göre devam et:

- JSON kolon adları farklıysa → gerçek adları kullan
- `shodan_open_ports` bir array mi, object mi? → ona göre sayım yöntemi değişir
- CVE verisi hangi kolonda, nasıl yapılandırılmış? → severity field'ına göre critical/high ayır

---

## Yapılacaklar

### 1. open_ports_count Backfill

JSON içeriğini incele, array ise:
```sql
UPDATE domain_scans
SET open_ports_count = jsonb_array_length(shodan_open_ports)
WHERE shodan_open_ports IS NOT NULL
  AND shodan_open_ports != 'null'::jsonb
  AND jsonb_typeof(shodan_open_ports) = 'array'
  AND open_ports_count = 0;
```

Object/map ise → key sayısını al veya port listesi içindeki array'i bul. Keşif sonucuna göre uyarla.

### 2. critical_cve_count ve high_cve_count Backfill

CVE JSON yapısını keşif sorgusunda gördükten sonra severity alanına göre say:

```sql
-- Örnek — gerçek yapıya göre uyarla
UPDATE domain_scans
SET
  critical_cve_count = (
    SELECT COUNT(*)
    FROM jsonb_array_elements(cve_findings) AS cve
    WHERE cve->>'severity' ILIKE 'critical'
  ),
  high_cve_count = (
    SELECT COUNT(*)
    FROM jsonb_array_elements(cve_findings) AS cve
    WHERE cve->>'severity' ILIKE 'high'
  )
WHERE cve_findings IS NOT NULL
  AND cve_findings != 'null'::jsonb
  AND jsonb_typeof(cve_findings) = 'array'
  AND critical_cve_count = 0
  AND high_cve_count = 0;
```

### 3. Pipeline Fix — Gelecek Scan'ler

Backfill geçmiş veriyi düzeltir ama `performDomainScan` fonksiyonu yeni scan'lerde de bu kolonları yazmıyorsa sorun tekrarlar. Scan tamamlandığında sayısal kolonları da set eden kodu ekle:

```javascript
// performDomainScan veya scan kaydetme fonksiyonunda
await db.update(domainScans)
  .set({
    open_ports_count: portList?.length ?? 0,
    critical_cve_count: cveList?.filter(c => c.severity === 'critical').length ?? 0,
    high_cve_count: cveList?.filter(c => c.severity === 'high').length ?? 0,
  })
  .where(eq(domainScans.id, scanId));
```

Gerçek değişken adlarını koddan bul, yukarıdaki örnek.

---

## Doğrulama

Backfill sonrası kontrol:

```sql
SELECT
  COUNT(*) AS toplam_scan,
  COUNT(*) FILTER (WHERE open_ports_count > 0) AS port_dolu,
  COUNT(*) FILTER (WHERE critical_cve_count > 0) AS kritik_cve_dolu,
  COUNT(*) FILTER (WHERE high_cve_count > 0) AS yuksek_cve_dolu,
  AVG(open_ports_count) AS ort_port,
  MAX(open_ports_count) AS max_port,
  MAX(critical_cve_count) AS max_kritik_cve
FROM domain_scans;
```

Bu sorgunun sonucunu bana ver.

---

## Önemli Notlar

- **Prod DB'ye doğrudan yazıyorsun** — UPDATE çalıştırmadan önce etkilenecek kayıt sayısını `SELECT COUNT(*)` ile doğrula
- Backfill tek seferde tüm 4.124 kaydı güncelleyecek, transaction içinde yap
- JSON yapısı beklediğinden farklıysa tahminde bulunma, önce bana göster

---

*CyberStep — domain_scans Backfill Fix v1.0*
