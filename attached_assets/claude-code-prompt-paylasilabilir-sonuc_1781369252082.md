# CyberStep — Paylaşılabilir Sonuç Sayfası + Rozet: Uygulama Promptu

**Ön kontrol raporu tamamlandı, kod değişikliğine başla.**

## 1. DB Migration
`domain_scans` tablosuna ekle:
- `letter_grade TEXT` (A/B/C/D/F)
- `is_publicly_shared BOOLEAN DEFAULT false`
- (mevcut `badge_token` kolonu `public_result_id` olarak yeniden kullanılacak — yeni kolon ekleme)

## 2. Harf Notu Fonksiyonu
`/skor-api` dokümantasyonundaki eşikleri kullanan `calculateLetterGrade(score: number): string` fonksiyonunu paylaşılan bir util dosyasına çıkar (örn. `artifacts/api-server/src/lib/scoring/letterGrade.ts`):
```
80–100 → A
60–79  → B
40–59  → C
20–39  → D
0–19   → F
```
`/domain-tarama` tarama tamamlandığında bu fonksiyonu çağırıp `letter_grade` kolonunu doldur.

## 3. `/sonuc/:id` Public Sayfa + API
- `GET /api/public/result/:id` → `badge_token` (=public_result_id) ile `domain_scans` sorgula, sadece `is_publicly_shared = true` ise veri döndür (score, letter_grade, domain, scan_date). Aksi halde 404.
- Rate limit gerekmiyor (salt-okunur, raporun Soru 4 sonucu).
- Frontend: `/sonuc/:id` route, skor/harf notu/domain gösterir, "Bu raporu paylaş" CTA'sı.
- `/domain-tarama` sonuç ekranına "Sonucu paylaşılabilir yap" toggle ekle → `is_publicly_shared = true` set eder, `/sonuc/:id` linkini gösterir.

## 4. OG Görsel (Rozet)
- `@resvg/resvg-js` paketini ekle (`npm install @resvg/resvg-js`).
- SVG template oluştur: domain adı, skor (0-100), harf notu (A-F), CyberStep brand renkleri (#060D1A arka plan, #00C8FF cyan, #F5A623 amber, #E8EDF5 metin).
- `GET /api/public/result/:id/og-image.png` endpoint: SVG'yi `resvg-js` ile PNG'ye render edip `Content-Type: image/png` ile servis et.
- Bu endpoint'e ayrı rate limiter ekle: 20 istek/dakika/IP (`express-rate-limit` ile, mevcut limiter pattern'ini takip et).
- `/sonuc/:id` sayfasının `<head>`'ine `og:image` meta tag olarak bu PNG URL'sini ekle.

## 5. Test
- Yeni bir domain taramasından sonra `letter_grade` doğru dolduğunu doğrula.
- `is_publicly_shared = false` iken `/api/public/result/:id` 404 döndüğünü doğrula.
- OG image endpoint'inin skor/harf notu metnini PNG üzerinde doğru render ettiğini doğrula (pixel-perfect, Gemini'nin garanti edemediği nokta).

**Kapsam dışı:** Mevcut `badge_token` / `/api/trust-badge` sistemine (müşteri güven rozeti) dokunma — bu ayrı bir özellik, karıştırma.
