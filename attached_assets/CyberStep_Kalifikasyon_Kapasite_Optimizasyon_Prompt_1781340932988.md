# CyberStep — Kalifikasyon Pipeline Kapasite Optimizasyonu ve Katmanlı Tarama Mimarisi

## Bağlam

CT (Certificate Transparency) tabanlı domain keşfi GitHub Actions workflow üzerinden çalışıyor (Replit'in WebSocket kısıtlaması nedeniyle crt.sh REST polling + Shodan kullanılıyor). Bu akış sağlıklı ve günlük ~5,000 yeni domain üretiyor. Ancak kalifikasyon adımı (her domain için ~25 saniyelik tam OSINT zinciri) günlük yaklaşık 1,000 domain kapasiteli — yani günlük girişin sadece ~%20'si işlenebiliyor, kalan birikiyor (backlog büyüyor).

Hedef: Bu darboğazı, kaliteden ödün vermeden, iki aşamalı bir kalifikasyon modeline geçerek çözmek. Aynı zamanda bu pipeline'ın çıktısı iki amaca hizmet etmeli:
1. **Lead generation** — mevcut iş akışı (kalifiye lead → satış/pazarlama pipeline)
2. **Otorite/envanter raporlama** — Türkiye domain ekosisteminin genel durumunu (örn. "taranan domainlerin %X'inde DMARC eksik") periyodik olarak raporlayabilecek bir veri tabanı

Bu görev İKİ FAZLI çalışmalı: önce KONTROL/ANALİZ, sonra (sonuçlara göre) DEĞİŞİKLİK. Kontrol fazında bulduğun gerçek tablo adları, kolon adları, fonksiyon imzaları ve mevcut pattern'lere göre devam et — bu promptta varsayımsal isimler YOK, sen kod tabanındaki gerçek adlandırmayı kullan.

---

## FAZ 1 — KONTROL (kod değiştirme, sadece analiz ve rapor)

Aşağıdakileri incele ve raporla:

### 1.1 Mevcut Kalifikasyon Akışı
- Kalifikasyon cron'unun tam kodunu, hangi tabloyu okuyup yazdığını, hangi sırayla hangi kontrolleri çalıştırdığını özetle
- Hangi adımlar "ucuz/hızlı" (DNS sorgusu, liveness check gibi saniyeler içinde), hangileri "pahalı/yavaş" (Shodan, NVD, blacklist gibi saniyeler-on saniyeler) — bu ayrımı net bir tabloda göster
- Kalifikasyon kararının (qualify/reject) hangi koşula bağlı olduğunu (skor eşiği vb.) doğrula

### 1.2 İletişim Bilgisi Bulma Adımı
- Apollo ve Hunter entegrasyonlarının şu anki durumunu (hata kodları, başarı oranı) doğrula
- Bu iki servisin Türkiye'deki şirketler için sonuç vermediği bilgisi doğru mu — kodda/loglarda bunu destekleyen bir kanıt var mı (örn. sürekli boş sonuç, 0 sonuç dönen response)?
- WHOIS ve web scraping fallback'inin gerçek başarı oranı ne (son N kalifiye lead için kaç tanesinde iletişim bilgisi bulunabilmiş)?

### 1.3 Şema Hazırlığı
- Domain/lead tablosunda "ne zaman son tarandı", "hangi derinlikte tarandı", "hangi katmanda (ham/izleniyor/kalifiye)" bilgisini tutacak alan var mı — yoksa eklemek için en uygun migration yaklaşımı ne (mevcut migration pattern'ine uygun şekilde)?
- Mevcut `scan_status` (veya eşdeğeri) durum makinesinin değerlerini listele — yeni bir ön-eleme durumu eklemek bu makineyi nasıl etkiler?

### 1.4 Rate Limit / Quota Durumu
- Shodan, NVD ve varsa diğer dış kaynaklar için kodda quota sayacı, circuit breaker veya günlük limit koruması var mı — yoksa bu kaynakların resmi/bilinen rate limit değerleri neler (kod yorumlarında veya config'de varsa)?
- Backlog'u hızlandırmaya çalışırken bu kaynaklara giden istek sıklığının artması durumunda (örn. ön-eleme katmanı eklenirse) hangi kaynak ilk darboğaz/ban riski olur?

### 1.5 Raporlama Altyapısı (Otorite Hedefi İçin)
- Şu an taranan domainlerin sonuçlarından (DMARC/SPF/SSL/blacklist/CVE bulguları) toplu istatistik üretebilecek bir sorgu/servis var mı (örn. "taranan domainlerin %X'inde DMARC yok" gibi agregasyon)?
- Yoksa, bu tür bir agregasyon raporu için mevcut şema üzerinden (tier/scan_status ayrımıyla) nasıl bir sorgu/servis tasarımı uygun olur — taslak öner ama henüz yazma

**Kontrol fazı sonunda**, bulduklarını özetleyen kısa bir rapor üret: gerçek tablo/kolon/fonksiyon adları, önerilen migration'ın tam SQL'i (gerçek tablo adıyla), ve Faz 2'deki değişikliklerin nerede/nasıl uygulanacağına dair plan. Bu raporu onaylamam için bekle — ONAY GELMEDEN Faz 2'ye geçme.

---

## FAZ 2 — DEĞİŞİKLİK (Faz 1 onayından sonra)

Faz 1'de bulunan gerçek isimlendirmeyi kullanarak:

### 2.1 Şema Genişletmesi
- Faz 1'de tasarlanan migration'ı uygula: domain/lead tablosuna "katman" (ham / izleniyor / kalifiye-aday gibi 3 seviyeli bir sınıflandırma), "son tarama zamanı" ve "tarama derinliği" bilgisini tutacak kolonları ekle
- Mevcut kayıtlar için sensible default değerler ata (örn. zaten `is_qualified=true` olanlar üst katmana, diğerleri en alt katmana)

### 2.2 İki Aşamalı Kalifikasyon
- Mevcut kalifikasyon fonksiyonunu, Faz 1.1'de belirlenen "ucuz/hızlı" ve "pahalı/yavaş" ayrımına göre ikiye böl:
  - **Ön-eleme adımı**: sadece hızlı kontroller (liveness + temel skor) — yüksek batch limiti, sık çalışabilir, domainleri en alt katmandan orta katmana terfi ettirir (veya doğrudan eler)
  - **Derin tarama adımı**: mevcut tam OSINT zinciri — SADECE orta katmandaki domainlere uygulanır, düşük batch limiti korunur
- Her iki adım da `wrapCron` pattern'ine uygun, mevcut cron loglama/hata yönetimi ile tutarlı olmalı
- Mevcut tek-aşamalı cron'un davranışını BOZMADAN bu geçişi yap — yani halihazırda kalifiye olmuş/işlenmiş kayıtlar yeniden işlenmemeli (idempotent olmalı)

### 2.3 İletişim Bilgisi Bulma — Apollo/Hunter Devre Dışı
- Eğer Faz 1.2'de Apollo/Hunter'ın TR için sonuç vermediği doğrulanırsa, bu iki adımı kalifikasyon zincirinden ÇIKAR (kodu silme, feature-flag veya config ile devre dışı bırak — ileride farklı bir pazar/bölge için tekrar açılabilir olsun)
- WHOIS ve web scraping fallback'ini birincil yöntem olarak işaretle, gerekirse bu adımların hata toleransını/log seviyesini gözden geçir
- Not: Manuel olarak (LinkedIn Sales Navigator üzerinden) bulunacak kontak bilgileri için, kalifiye lead kaydına "iletişim bilgisi eksik / manuel araştırma gerekiyor" durumunu işaretleyen bir alan/flag faydalı olur — bu, mevcut şemaya uygun şekilde ekle (manuel iş akışını kolaylaştırmak için, otomatik bir şey YAPMA, sadece işaretleme)

### 2.4 Rate Limit Koruması
- Faz 1.4'te tespit edilen risk taşıyan dış kaynaklar (muhtemelen Shodan ve NVD) için basit bir günlük/saatlik istek sayacı ve eşik kontrolü ekle — eşik aşıldığında o kaynağı atlayıp diğer kontrollerle devam et (sessizce hata vermek yerine, "bu kaynak quota nedeniyle atlandı" şeklinde loglansın)

### 2.5 Otorite Raporlama Servisi
- Faz 1.5'te taslağı çıkarılan agregasyon sorgusunu/servisini implemente et — periyodik (örn. haftalık) çalışan bir cron veya on-demand çağrılabilen bir fonksiyon olarak
- Çıktı formatı: toplam taranan domain sayısı, katman bazlı dağılım, ve seçili güvenlik bulgularının (DMARC/SPF eksikliği, zayıf SSL, kara liste durumu, kritik CVE varlığı gibi) yüzdesel dağılımı
- Bu servisin çıktısı hem dahili (lead pipeline önceliklendirme) hem de dışa açık bir rapor/içerik (örn. "Türkiye Siber Risk Görünümü") için kullanılabilir olmalı — ama bu adımda sadece VERİYİ üret, dış yayın/içerik formatı ayrı bir görev

---

## ÇIKTI VE TEST

Her iki fazın sonunda:
1. Faz 1: yukarıdaki kontrol raporu (markdown, kod referanslarıyla)
2. Faz 2: değişen dosyaların listesi, eklenen migration'ın SQL'i, ve şu testlerin sonucu:
   - Ön-eleme adımı manuel bir kez çalıştırıldığında, mevcut backlog'dan örnek bir batch üzerinde beklenen şekilde katman güncellemesi yapıyor mu (birkaç örnek kayıt göster)
   - Derin tarama adımı, ön-elemeden geçen bir domain üzerinde eskisi gibi çalışıyor mu (sonuç formatı değişmemiş olmalı)
   - Rate limit sayacı, eşiğe ulaştığında gerçekten atlıyor mu (simüle edilebilir mi, ya da kod incelemesiyle doğrulanabilir mi)
   - Otorite raporlama servisi çalıştırıldığında mantıklı bir özet çıktı üretiyor mu (örnek çıktıyı göster)

## SINIRLAR — DOKUNMA
- CT/crt.sh → GitHub Actions intake akışının kendisi (bu görev sadece kalifikasyon ve sonrasını kapsıyor, intake çalışıyor ve dokunulmayacak)
- Mevcut kalifiye lead'lerin durumu/skorları (geriye dönük yeniden hesaplama YAPMA)
- Demo/test hesapları ve genel cron iş mantığı dışındaki sistemler
