# CyberStep.io — 104 Blog Başlığı Güncellemesi
## Replit Agent Promptu — Admin Panel Blog Veritabanı Güncellemesi

---

## REPLIT AGENT PROMPTU

Update the blog post topics/titles in the CyberStep.io admin panel database.
The existing app uses PostgreSQL + Drizzle ORM.

Find the table that stores blog post drafts, scheduled topics, or a content calendar.
If no such table exists, CREATE one called `blog_content_calendar` and insert all 104 entries.

### DATABASE SCHEMA (create if not exists)

```sql
CREATE TABLE IF NOT EXISTS blog_content_calendar (
  id serial PRIMARY KEY,
  sort_order integer UNIQUE NOT NULL,
  -- Publication order (1 = first to publish)
  
  title_tr varchar(300) NOT NULL,
  -- Turkish title
  
  slug varchar(300),
  -- URL slug (auto-generate from title)
  
  category varchar(30) NOT NULL,
  -- 'FA' | 'RE' | 'SE' | 'DU' | 'CO' | 'AI' | 'KU'
  -- FA=Farkındalık, RE=Rehberlik, SE=Sektörel,
  -- DU=Düzenleyici, CO=Conversion, AI=Yapay Zeka, KU=Kurumsal
  
  target_audience varchar(30) NOT NULL,
  -- 'genel' | 'it_yoneticisi' | 'patron' | 'cfo' | 'kvkk_danismani' | 'kurumsal'
  
  seo_keyword varchar(200),
  -- Primary SEO keyword
  
  cyberstep_tool varchar(100),
  -- Which CyberStep tool/service to link in the post
  
  priority integer DEFAULT 3,
  -- 1=En Yüksek, 2=Yüksek, 3=Orta, 4=Düşük
  
  publish_week integer,
  -- Target week number (1-52)
  
  status varchar(20) DEFAULT 'planned',
  -- planned | in_progress | published | archived
  
  ai_prompt_notes text,
  -- Special instructions for Claude when generating this post
  
  created_at timestamp DEFAULT now(),
  published_at timestamp
);
```

### DELETE AND REINSERT ALL 104 TOPICS

```sql
DELETE FROM blog_content_calendar;
```

Now INSERT all 104 entries in publication order:

```sql
INSERT INTO blog_content_calendar
(sort_order, title_tr, category, target_audience, seo_keyword,
 cyberstep_tool, priority, publish_week, ai_prompt_notes)
VALUES

-- ════════════════════════════════════════
-- AY 1 — HAFTA 1-4 (Sıra 1-8)
-- Temel farkındalık + yüksek arama hacmi
-- ════════════════════════════════════════

(1,
 'Türkiye''de Siber Saldırılar: 2026 Yılı Gerçek Verileri ve Eğilimler',
 'FA', 'genel',
 'türkiye siber saldırı 2026',
 'domain-tarama', 1, 1,
 'USOM ve BTK verilerini kullan. Sektör kırılımı ekle. TL bazında ortalama hasar.'),

(2,
 'KVKK Cezası Nasıl Hesaplanır? 2026 Güncel Rehber',
 'DU', 'patron',
 'KVKK ceza hesaplama 2026',
 'kvkk-ceza-sim', 1, 1,
 'KVK Kurulu 2024-2025 kararlarından somut örnekler. TL tutarları.'),

(3,
 'Domain Güvenlik Taraması Nedir? Şirketinizi 30 Saniyede Test Edin',
 'CO', 'patron',
 'domain güvenlik taraması ücretsiz',
 'domain-tarama', 1, 2,
 'CyberStep domain tarama aracının doğrudan tanıtımı. Adım adım nasıl kullanılır.'),

(4,
 'SPF, DKIM, DMARC: E-posta Sahtekarlığından Korunmanın 3 Teknik Önlemi',
 'RE', 'it_yoneticisi',
 'SPF DKIM DMARC e-posta güvenliği',
 'domain-tarama', 2, 2,
 'Teknik ama patronun anlayacağı örneklerle. CEO fraud senaryosu ekle.'),

(5,
 'Fidye Yazılımı Saldırısına Uğrarsanız İlk 24 Saatte Ne Yapmalısınız?',
 'RE', 'genel',
 'fidye yazılımı saldırısı ne yapmalı',
 'siber-panik', 1, 3,
 'Adım adım kriz rehberi. Panik dili değil, soğukkanlı protokol.'),

(6,
 'ChatGPT''ye Şirket Verisi Göndermek KVKK İhlali mi?',
 'AI', 'patron',
 'ChatGPT KVKK veri güvenliği',
 'ai-guvenlik-degerlendirmesi', 1, 3,
 'Türkiye''ye özgü. KVKK Madde 9 yurt dışı aktarım bağlamı. Pratik önlemler.'),

(7,
 'SSL Sertifikası Nedir, Neden Önemlidir? Web Siteniz Güvende mi?',
 'RE', 'patron',
 'SSL sertifikası web sitesi güvenliği',
 'domain-tarama', 2, 4,
 'Teknik olmayan açıklama. Müşteri güveni ve KVKK bağlantısı.'),

(8,
 'Dark Web''de Şirket Bilgileriniz Var mı? Ücretsiz Kontrol Edin',
 'FA', 'patron',
 'dark web şirket bilgisi sorgulama',
 'sizinti-izleyici', 1, 4,
 'Duygusal kanca: "Bunu bilmiyor olabilirsiniz." HIBP entegrasyonu açıkla.'),

-- ════════════════════════════════════════
-- AY 2 — HAFTA 5-8 (Sıra 9-16)
-- Derinleşme + AI güvenlik girişi
-- ════════════════════════════════════════

(9,
 'Yapay Zeka Araçları Güvenliği: Hangi Araç Ne Kadar Riskli?',
 'AI', 'genel',
 'yapay zeka araçları güvenlik riski',
 'ai-guvenlik-degerlendirmesi', 1, 5,
 'ChatGPT/Gemini/Copilot karşılaştırma tablosu. Risk seviyeleri.'),

(10,
 'KVKK VERBİS Kaydı Zorunlu mu? Kimler Kaydolmak Zorunda?',
 'DU', 'kvkk_danismani',
 'KVKK VERBİS kayıt zorunluluk',
 'kvkk-verbis', 1, 5,
 'Net bilgi. 2026 güncel kural. Ceza riski. CyberStep VERBİS rehberine bağla.'),

(11,
 'Türkiye''de CEO Dolandırıcılığı: Gerçek Vakalar ve Korunma Yolları',
 'FA', 'patron',
 'CEO dolandırıcılığı türkiye',
 'domain-tarama', 1, 6,
 'Anonim Türkiye vakaları. TL kayıp rakamları. DMARC çözümü.'),

(12,
 'Microsoft 365 Güvenlik Denetimi: 10 Adımlık Kontrol Listesi',
 'RE', 'it_yoneticisi',
 'Microsoft 365 güvenlik ayarları',
 'm365-denetim', 2, 6,
 'M365 Denetim aracına yönlendir. Somut ayar ekran görüntüsü tarifi.'),

(13,
 'Siber Sigorta Almadan Önce Bilmeniz Gereken 7 Şey',
 'RE', 'patron',
 'siber sigorta türkiye',
 'siber-sigorta', 2, 7,
 'Türkiye''deki sigorta şirketleri. Hangi hasarı karşılıyor. CyberStep skor bağlantısı.'),

(14,
 'AB Yapay Zeka Yasası (EU AI Act) Türk Şirketlerini Nasıl Etkiliyor?',
 'AI', 'kurumsal',
 'AB yapay zeka yasası türkiye etki',
 'eu-ai-act', 1, 7,
 'Erişilebilir dil. Hangi şirketler kapsam dahilinde. Ceza skalası Euro+TL.'),

(15,
 'E-Ticaret Sitelerinde En Sık Görülen 5 Güvenlik Açığı',
 'SE', 'patron',
 'e-ticaret güvenlik açığı',
 'domain-tarama', 1, 8,
 'Sektörel. Gerçek vaka tipleri. WooCommerce/Shopify örnekleri.'),

(16,
 'Güçlü Parola Politikası Nasıl Oluşturulur? Şablon ve Rehber',
 'RE', 'it_yoneticisi',
 'güçlü parola politikası şirketi',
 'assessment', 2, 8,
 'Hazır şablon. Çalışanlara nasıl anlatılır. İmzalatma prosedürü.'),

-- ════════════════════════════════════════
-- AY 3 — HAFTA 9-12 (Sıra 17-24)
-- Sektörel derinleşme
-- ════════════════════════════════════════

(17,
 'Sağlık Sektöründe Hasta Verisi Güvenliği ve KVKK Yükümlülükleri',
 'SE', 'patron',
 'sağlık sektörü hasta verisi güvenliği KVKK',
 'kvkk-ceza-sim', 1, 9,
 'Hastane, klinik, eczane odaklı. Özel nitelikli veri vurgusu.'),

(18,
 'Deepfake Saldırıları Türkiye''ye Geliyor: Şirketiniz Hazır mı?',
 'AI', 'genel',
 'deepfake saldırı türkiye şirket',
 'ai-phishing-simulasyonu', 1, 9,
 'Yeni tehdit. Ses klonu örnekleri. Doğrulama protokolü önerisi.'),

(19,
 'Tedarik Zinciri Siber Riski: Muhasebecinden Gelen Tehlike',
 'FA', 'patron',
 'tedarik zinciri siber saldırı',
 'tprm', 1, 10,
 'Türkiye''ye özgü: muhasebeci, mali müşavir erişim riski. TPRM aracına bağla.'),

(20,
 'Finans Sektöründe Siber Güvenlik: BDDK ve KVKK Gereksinimleri',
 'SE', 'kurumsal',
 'finans sektörü siber güvenlik BDDK',
 'assessment', 1, 10,
 'Faktoring, leasing, fintech odaklı. BDDK yönetmelik referansları.'),

(21,
 'İki Faktörlü Doğrulama (2FA) Nedir? Nasıl Kurulur?',
 'RE', 'genel',
 'iki faktörlü doğrulama 2FA nasıl kurulur',
 'assessment', 2, 11,
 'Çok aranıyor. Adım adım. Uygulama önerileri. KOBİ çalışanı için.'),

(22,
 'Yapay Zeka ile Yazılmış Sahte Fatura Nasıl Anlaşılır?',
 'AI', 'patron',
 'sahte fatura tespiti yapay zeka',
 'ai-guvenlik-degerlendirmesi', 1, 11,
 'Yeni tehdit tipi. Muhasebe firmalarına özel. Doküman tarama aracına bağla.'),

(23,
 'Lojistik ve Kargo Sektöründe Siber Riskler',
 'SE', 'patron',
 'lojistik sektörü siber güvenlik',
 'domain-tarama', 2, 12,
 'Araç takip sistemleri, müşteri veri tabanı riskleri.'),

(24,
 'CyberStep Güven Rozeti Nedir? Web Sitenize Nasıl Eklenir?',
 'CO', 'patron',
 'siber güvenlik rozeti web sitesi',
 'guven-rozeti', 2, 12,
 'Ürün tanıtımı. SVG embed kodu. Faydaları: müşteri güveni, ihale belgesi.'),

-- ════════════════════════════════════════
-- AY 4 — HAFTA 13-16 (Sıra 25-32)
-- AI derinleşme + conversion
-- ════════════════════════════════════════

(25,
 'ChatGPT Ücretsiz vs Enterprise: Gizlilik Farkları ve Şirket Kararı',
 'AI', 'patron',
 'ChatGPT ücretsiz enterprise fark güvenlik',
 'ai-guvenlik-degerlendirmesi', 1, 13,
 'Karar matrisi. TL maliyet karşılaştırması. DPA ne demek.'),

(26,
 'KVKK Aydınlatma Metni Nasıl Yazılır? 2026 Şablon',
 'DU', 'kvkk_danismani',
 'KVKK aydınlatma metni şablon 2026',
 'kvkk-dpa-olustur', 1, 13,
 'CyberStep DPA oluşturucu aracına yönlendir. Gerçek şablon örnekleri.'),

(27,
 'Siber Güvenlik Yatırımının ROI''si Nasıl Hesaplanır?',
 'CO', 'cfo',
 'siber güvenlik ROI hesaplama',
 'roi-hesaplayici', 1, 14,
 'CFO/finansçı dili. TL bazında formül. CyberStep ROI hesaplayıcıya bağla.'),

(28,
 'Microsoft Copilot Güvenli mi? Kurumsal Kullanım Rehberi',
 'AI', 'it_yoneticisi',
 'Microsoft Copilot güvenli kurumsal',
 'ai-guvenlik-degerlendirmesi', 2, 14,
 'M365 Copilot özelinde. Veri kalma yeri. DPA mevcut mu.'),

(29,
 'Türkiye''de Veri İhlali Bildirimi: 72 Saat Kuralı ve Prosedür',
 'DU', 'patron',
 'veri ihlali bildirimi KVKK 72 saat',
 'siber-panik', 1, 15,
 'Pratik rehber. KVK Kurulu''na nasıl bildirim yapılır. Şablon.'),

(30,
 'Üretim ve Fabrika Sektöründe OT/IT Siber Güvenlik',
 'SE', 'it_yoneticisi',
 'üretim sektörü OT IT siber güvenlik',
 'assessment', 2, 15,
 'Endüstriyel kontrol sistemleri. SCADA riski. Türkiye üretim sektörü.'),

(31,
 'Sosyal Medya Hesabı Ele Geçirilirse Ne Olur? Korunma Rehberi',
 'FA', 'patron',
 'sosyal medya hesabı ele geçirme korunma',
 'domain-tarama', 2, 16,
 'Instagram, LinkedIn, Twitter/X. Türkiye vakaları. 2FA zorunluluğu.'),

(32,
 'Tam Güvenlik Değerlendirmesi ile Mini Değerlendirme Arasındaki Fark',
 'CO', 'patron',
 'siber güvenlik değerlendirmesi tam mini fark',
 'assessment', 2, 16,
 'Karşılaştırma. Hangisi ne zaman. Tam değerlendirmeye yönlendirme.'),

-- ════════════════════════════════════════
-- AY 5 — HAFTA 17-20 (Sıra 33-40)
-- Kurumsal kitle + yeni servisler
-- ════════════════════════════════════════

(33,
 'Sürekli Maruz Kalma Yönetimi (CEM) Nedir? Neden Önemli?',
 'KU', 'kurumsal',
 'sürekli maruz kalma yönetimi CEM',
 'assessment', 1, 17,
 'Gartner çerçevesi. Teknik olmayan açıklama. CyberStep CEM yaklaşımı.'),

(34,
 'Yapay Zeka Phishing Simülasyonu: Şirketinize Nasıl Saldırılır?',
 'AI', 'patron',
 'yapay zeka phishing simülasyonu',
 'ai-phishing-simulasyonu', 1, 17,
 'Yeni servis tanıtımı. Anonim örnek senaryo. Demo CTA.'),

(35,
 'İnşaat Sektöründe KVKK: Çalışan ve Müşteri Verisi Yükümlülükleri',
 'SE', 'patron',
 'inşaat sektörü KVKK veri güvenliği',
 'kvkk-ceza-sim', 2, 18,
 'İnşaat firmaları için özel. Taşeron çalışan verisi riski.'),

(36,
 'Yönetim Kuruluna Siber Güvenlik Nasıl Anlatılır?',
 'KU', 'kurumsal',
 'yönetim kurulu siber güvenlik raporu',
 'assessment', 1, 18,
 'CFO/CEO dili. TL risk rakamları. Yönetim kurulu raporu aracına bağla.'),

(37,
 'EU AI Act Yüksek Riskli AI Sistemleri: Şirketiniz Kapsam Dahilinde mi?',
 'AI', 'kurumsal',
 'EU AI Act yüksek riskli sistem kapsam',
 'eu-ai-act', 1, 19,
 'Kurumsal odaklı. Hangi sektörler yüksek riskli. 2026 uyum takvimi.'),

(38,
 'Bulut Güvenliği: AWS, Azure ve Google Cloud''da Yapılması Gerekenler',
 'RE', 'it_yoneticisi',
 'bulut güvenliği AWS Azure Google Cloud',
 'assessment', 2, 19,
 'Türk şirketlerinin en çok kullandığı bulut platformları.'),

(39,
 'Turizm ve Otelcilik Sektöründe Misafir Verisi Güvenliği',
 'SE', 'patron',
 'turizm otel misafir verisi güvenliği KVKK',
 'kvkk-ceza-sim', 2, 20,
 'Pasaport verisi. Rezervasyon sistemleri. KVKK yükümlülükleri.'),

(40,
 'Siber Güvenlik Sertifikası ile İhaleye Girerken Avantaj Sağlayın',
 'CO', 'patron',
 'siber güvenlik sertifikası ihale',
 'assessment', 1, 20,
 'Siber Güvenlik Başkanlığı bağlamı. İhale fırsatı. Sertifikasyon CTA.'),

-- ════════════════════════════════════════
-- AY 6 — HAFTA 21-24 (Sıra 41-48)
-- Otorite içeriği + veri ürünleri
-- ════════════════════════════════════════

(41,
 'Türkiye Siber Risk Endeksi: 2026 Yılı Yarı Yıllık Rapor',
 'FA', 'genel',
 'türkiye siber risk raporu 2026',
 'sektorel-kiyaslama', 1, 21,
 'CyberStep verisi ile üretilen otorite içerik. Medyaya gönderi için.'),

(42,
 'Ses Klonlama Saldırısı Nedir? Türkiye''den Vakalar',
 'AI', 'patron',
 'ses klonlama saldırısı türkiye',
 'ai-phishing-simulasyonu', 1, 21,
 'Deepfake servisine giriş. Duygusal kanca. Patron için korku/merak.'),

(43,
 'Eğitim Sektöründe Öğrenci Verisi Güvenliği ve KVKK',
 'SE', 'patron',
 'eğitim sektörü öğrenci verisi KVKK',
 'kvkk-ceza-sim', 2, 22,
 'Özel okullar, dershaneler, üniversite. Ebeveyn verisi riski.'),

(44,
 'Firewall Nedir? Şirketinizde Doğru Yapılandırılmış mı?',
 'RE', 'patron',
 'firewall nedir şirket yapılandırma',
 'assessment', 2, 22,
 'Teknik olmayan açıklama. FortiGate örneği. CyberStep tarama bağlantısı.'),

(45,
 'AI Red Team Nedir? Saldırgan Şirketiniz Hakkında Ne Biliyor?',
 'AI', 'kurumsal',
 'AI red team siber güvenlik',
 'ai-red-team', 1, 23,
 'Yeni servis tanıtımı. OSINT kavramı. "5 dakikada ne öğrenebilirler?"'),

(46,
 'KVKK''da Özel Nitelikli Kişisel Veri Nedir? Hangi Veriler Kapsıyor?',
 'DU', 'kvkk_danismani',
 'özel nitelikli kişisel veri KVKK',
 'kvkk-ceza-sim', 1, 23,
 'Hukuki ama anlaşılır. Sağlık, biyometri, sendika üyeliği örnekleri.'),

(47,
 'Uzaktan Çalışma Güvenliği: Evden Bağlananlar İçin 8 Kural',
 'RE', 'genel',
 'uzaktan çalışma siber güvenlik',
 'assessment', 2, 24,
 'VPN, kişisel cihaz politikası, kahve dükkanında çalışma riski.'),

(48,
 'Şirket Domain''i Neden Kaçırılır? Alan Adı Güvenliği Rehberi',
 'RE', 'patron',
 'domain kaçırma alan adı güvenliği',
 'domain-tarama', 1, 24,
 'Domain yenileme. Registrar güvenliği. 2FA. Türkiye vakaları.'),

-- ════════════════════════════════════════
-- AY 7 — HAFTA 25-28 (Sıra 49-56)
-- Derinlemesine teknik + yeni AI servisleri
-- ════════════════════════════════════════

(49,
 'AI Araç İzleme: ChatGPT''nin Gizlilik Politikası Değişince Ne Olur?',
 'AI', 'patron',
 'AI araç gizlilik politikası değişiklik izleme',
 'ai-arac-izleme', 1, 25,
 'Yeni servis tanıtımı. OpenAI politika değişiklikleri örnek. Abonelik CTA.'),

(50,
 'TPRM Nedir? Tedarikçi Risk Yönetimi Rehberi',
 'RE', 'kurumsal',
 'TPRM tedarikçi risk yönetimi',
 'tprm', 2, 25,
 'Supply chain saldırıları. CyberStep TPRM anketi tanıtımı.'),

(51,
 'Muhasebe Yazılımı Güvenliği: Logo, Luca, Mikro Kullananlar İçin',
 'SE', 'patron',
 'muhasebe yazılımı güvenliği logo luca mikro',
 'assessment', 1, 26,
 'Türkiye''ye özgü. Ortak hesap kullanımı riski. Spesifik öneriler.'),

(52,
 'Yapay Zeka Kullanım Politikası Nasıl Yazılır? Şablon',
 'AI', 'it_yoneticisi',
 'yapay zeka kullanım politikası şablon',
 'ai-politika', 1, 26,
 'AI Politika servisine yönlendir. Hazır şablon özeti. İmzalatma.'),

(53,
 'Savunma Sanayii Tedarikçileri İçin Siber Güvenlik Zorunlulukları',
 'SE', 'kurumsal',
 'savunma sanayii tedarikçi siber güvenlik',
 'assessment', 1, 27,
 'SSB kalifikasyonu. Niche ama yüksek değerli segment.'),

(54,
 'Vishing (Telefon Dolandırıcılığı) ve AI Ses Taklidi Nasıl Çalışır?',
 'AI', 'genel',
 'vishing telefon dolandırıcılığı AI ses',
 'ai-phishing-simulasyonu', 1, 27,
 'Deepfake ses + telefon kombinasyonu. Türkiye vakaları. Protokol.'),

(55,
 'ISO 27001 Sertifikasyonu: Türk Şirketleri İçin Hazırlık Rehberi',
 'DU', 'kurumsal',
 'ISO 27001 sertifikasyon türkiye',
 'assessment', 2, 28,
 'CyberStep sertifikası ile ISO 27001 hazırlık ilişkisi.'),

(56,
 'Sektörünüzde Siber Güvenlik Ortalaması Kaç? Benchmark Verisi',
 'CO', 'patron',
 'sektör siber güvenlik skoru kıyaslama',
 'sektorel-kiyaslama', 1, 28,
 'Sektörel kıyaslama aracına yönlendir. "Rakibiniz nerede?" hook.'),

-- ════════════════════════════════════════
-- AY 8 — HAFTA 29-32 (Sıra 57-64)
-- Conversion ağırlıklı + vaka çalışmaları
-- ════════════════════════════════════════

(57,
 'Gerçek Vaka: Bir Türk E-Ticaret Firması Nasıl Hacklenişi Geçirdi?',
 'FA', 'patron',
 'türk e-ticaret firması hacklendi vaka',
 'assessment', 1, 29,
 'Anonim, izinli. Gerçek senaryo. Ne oldu, ne yapıldı, ne öğrenildi.'),

(58,
 'EU AI Act Uyum Skoru: Şirketiniz Hangi Kategoride?',
 'AI', 'kurumsal',
 'EU AI Act uyum skoru kategori',
 'eu-ai-act', 1, 29,
 'Yeni servis tanıtımı. Risk kategorileri. Hemen değerlendir CTA.'),

(59,
 'WhatsApp İş Güvenliği: Şirkette Güvenli Kullanım Kuralları',
 'RE', 'patron',
 'WhatsApp iş güvenliği şirket',
 'assessment', 1, 30,
 'Türkiye''ye özgü. Grup güvenliği. Müşteri verisi paylaşımı riski.'),

(60,
 'Saldırı Yüzeyi Yönetimi (ASM) Nedir? Kurumsal Rehber',
 'KU', 'kurumsal',
 'saldırı yüzeyi yönetimi ASM',
 'domain-tarama', 1, 30,
 'Kurumsal kitle. CEM bağlantısı. CyberStep ASM yaklaşımı.'),

(61,
 'AI ile Oluşturulan Sahte Belge Nasıl Tespit Edilir?',
 'AI', 'patron',
 'yapay zeka sahte belge tespiti',
 'ai-belge-tarama', 1, 31,
 'Doküman tarama servisine yönlendir. Muhasebe firmalarına özel.'),

(62,
 'Türkiye''de Siber Güvenlik Başkanlığı: Şirketleri Neler Bekliyor?',
 'DU', 'genel',
 'siber güvenlik başkanlığı türkiye şirketler',
 'assessment', 1, 31,
 '7545 sayılı kanun. 2027 uyum tarihi. CyberStep yetkilendirme bağlantısı.'),

(63,
 'Pentest (Sızma Testi) Nedir? CyberStep Pentest Lite ile Farkı',
 'CO', 'it_yoneticisi',
 'pentest sızma testi nedir',
 'pentest-lite', 2, 32,
 'Pentest Lite servis tanıtımı. Gerçek pentest vs otomatik doğrulama.'),

(64,
 'Veri Sızıntısı Sonrası Müşterilere Nasıl Bildirim Yapılır?',
 'DU', 'patron',
 'veri sızıntısı bildirim KVKK müşteri',
 'siber-panik', 2, 32,
 'KVKK 72 saat kuralı + müşteri iletişim şablonu.'),

-- ════════════════════════════════════════
-- AY 9 — HAFTA 33-36 (Sıra 65-72)
-- Otorite + medya içeriği
-- ════════════════════════════════════════

(65,
 'Türkiye''nin En Riskli 5 Sektörü: 2026 Siber Güvenlik Raporu',
 'FA', 'genel',
 'türkiye en riskli sektör siber güvenlik',
 'sektorel-kiyaslama', 1, 33,
 'Medya için otorite içerik. CyberStep verisi. Basın bülteni versiyonu da hazırla.'),

(66,
 'AI Politika Otomatik Güncelleme: Çeyreklik Politika Servisi',
 'AI', 'it_yoneticisi',
 'AI politika otomatik güncelleme KVKK',
 'ai-politika', 1, 33,
 'Servis tanıtımı. Politika eskimesi riski. Abonelik CTA.'),

(67,
 'Sağlık Verisi ve Yapay Zeka: Hasta Bilgilerini AI''a Gönderebilir misiniz?',
 'AI', 'patron',
 'sağlık verisi yapay zeka KVKK',
 'ai-guvenlik-degerlendirmesi', 1, 34,
 'Özel nitelikli veri + AI araç riski kombinasyonu. Sağlık sektörü.'),

(68,
 'Şirket Güvenlik Kültürü Nasıl Oluşturulur? 6 Adım',
 'RE', 'patron',
 'şirket güvenlik kültürü oluşturma',
 'assessment', 2, 34,
 'İnsan faktörü. Çalışan farkındalığı. Ölçülebilir adımlar.'),

(69,
 'GitHub Copilot Güvenli mi? Yazılım Firmaları İçin Rehber',
 'AI', 'it_yoneticisi',
 'GitHub Copilot güvenli yazılım',
 'ai-guvenlik-degerlendirmesi', 2, 35,
 'Kod sızıntısı riski. Business plan farkı. Politika önerisi.'),

(70,
 'Türkiye''de Siber Olayların Sektörel Dağılımı: Çeyreklik Analiz',
 'FA', 'genel',
 'türkiye siber olay sektör analiz',
 'sektorel-kiyaslama', 1, 35,
 'Çeyreklik otorite içerik. CyberStep tarama veritabanından üret.'),

(71,
 'Kurumsal Siber Güvenlik Bütçesi Nasıl Planlanır?',
 'KU', 'cfo',
 'kurumsal siber güvenlik bütçe planlama',
 'roi-hesaplayici', 1, 36,
 'CFO dili. ROI çerçevesi. CyberStep maliyet/fayda tablosu.'),

(72,
 'Phishing E-postası Nasıl Anlaşılır? Çalışan Eğitim Rehberi',
 'RE', 'genel',
 'phishing e-posta nasıl anlaşılır',
 'assessment', 2, 36,
 'Görsel örnekler. Kontrol listesi. Çalışana dağıtılabilir format.'),

-- ════════════════════════════════════════
-- AY 10 — HAFTA 37-40 (Sıra 73-80)
-- Derinlemesine kurumsal + uluslararası
-- ════════════════════════════════════════

(73,
 'Sigorta Şirketi Siber Risk Değerlendirmesi İstiyorsa Ne Yapmalı?',
 'CO', 'patron',
 'siber sigorta risk değerlendirmesi',
 'assessment', 1, 37,
 'Sigorta başvurusu için CyberStep raporu. Direkt satış içeriği.'),

(74,
 'AI Red Team Raporu: Saldırgan 30 Dakikada Neler Öğrenebilir?',
 'AI', 'kurumsal',
 'AI red team OSINT şirket istihbarat',
 'ai-red-team', 1, 37,
 'Servis derinleştirme. Gerçek örnek OSINT bulguları. Kurumsal CTA.'),

(75,
 'Türkiye''den AB''ye İhracat Yapanlara: GDPR ve EU AI Act Çifte Uyum',
 'DU', 'kurumsal',
 'GDPR EU AI Act türkiye ihracat uyum',
 'eu-ai-act', 1, 38,
 'KVKK + GDPR + EU AI Act üçlüsü. İhracatçı firmalar için.'),

(76,
 'DeepL, Grammarly ve Çeviri Araçları: Gizlilik Riskleri',
 'AI', 'patron',
 'DeepL Grammarly güvenli kullanım',
 'ai-guvenlik-degerlendirmesi', 2, 38,
 'AI araç serisi devam. Pratik tavsiye: hangi plan güvenli.'),

(77,
 'Olay Müdahale Planı (IRP) Nasıl Hazırlanır? Şablon',
 'RE', 'it_yoneticisi',
 'olay müdahale planı IRP şablon',
 'siber-panik', 1, 39,
 'Hazır şablon. Türkiye bağlamı. KVKK bildirim entegrasyonu.'),

(78,
 'Türk Teknoloji Firmalarına Yönelik Siber Tehditler: 2026 Analizi',
 'SE', 'kurumsal',
 'teknoloji firması siber tehdit türkiye',
 'assessment', 1, 39,
 'SaaS, yazılım, startup sektörü. API güvenliği. Kaynak kodu riski.'),

(79,
 'Çalışan Ayrılırken Dijital Güvenlik: Hesap Kapatma Kontrol Listesi',
 'RE', 'it_yoneticisi',
 'çalışan ayrılma dijital güvenlik hesap kapatma',
 'assessment', 2, 40,
 'Pratik kontrol listesi. İnsan kaynakları + IT işbirliği.'),

(80,
 'Siber Güvenlik Olmadan Dijital Dönüşüm Olmaz: Kurumsal Bakış',
 'KU', 'kurumsal',
 'dijital dönüşüm siber güvenlik kurumsal',
 'assessment', 2, 40,
 'Kurumsal strateji. CEM + dijital dönüşüm ilişkisi.'),

-- ════════════════════════════════════════
-- AY 11 — HAFTA 41-44 (Sıra 81-88)
-- Yıl sonu + vaka çalışmaları
-- ════════════════════════════════════════

(81,
 'Yapay Zeka Çağında Sosyal Mühendislik Saldırıları',
 'AI', 'genel',
 'yapay zeka sosyal mühendislik saldırısı',
 'ai-phishing-simulasyonu', 1, 41,
 'Trend içerik. AI + insan psikolojisi kombinasyonu.'),

(82,
 'Türkiye''de KVKK Ceza İstatistikleri: 2025-2026 Karşılaştırması',
 'DU', 'genel',
 'KVKK ceza istatistik 2026',
 'kvkk-ceza-sim', 1, 41,
 'Yıllık veri. Medya değeri yüksek. KVK Kurulu kararları analizi.'),

(83,
 'Bulut Depolama Güvenliği: Google Drive ve OneDrive Ayarları',
 'RE', 'genel',
 'Google Drive OneDrive güvenlik ayarları',
 'assessment', 2, 42,
 'Paylaşım izinleri. Eski çalışan erişimi. Pratik adımlar.'),

(84,
 'CyberStep API: Üçüncü Taraf Entegrasyonu Nasıl Yapılır?',
 'CO', 'it_yoneticisi',
 'CyberStep API entegrasyonu',
 'api', 2, 42,
 'Developer odaklı. API dokümantasyonuna bağla. Kullanım senaryoları.'),

(85,
 'Siber Güvenlik Başkanlığı Yetkilendirmesi: Şirketler Ne Yapmalı?',
 'DU', 'kurumsal',
 'siber güvenlik başkanlığı yetkilendirme şirket',
 'assessment', 1, 43,
 '2027 deadline. Kimler kapsam dahilinde. CyberStep hazırlık desteği.'),

(86,
 'Yapay Zeka Araçları ve Çalışan Gizliliği: İK''nın Bilmesi Gerekenler',
 'AI', 'patron',
 'yapay zeka çalışan gizliliği İK',
 'ai-guvenlik-degerlendirmesi', 2, 43,
 'İK perspektifi. Çalışan veri hakları. AI işe alım araçları KVKK.'),

(87,
 'Türkiye''de Siber Güvenlik Ekosistemi: Kim, Ne Yapıyor?',
 'FA', 'genel',
 'türkiye siber güvenlik ekosistemi',
 'assessment', 2, 44,
 'Piyasa haritası. CyberStep''in yeri. Otorite içerik.'),

(88,
 'Partner Programı: KVKK Danışmanları İçin CyberStep Fırsatı',
 'CO', 'kvkk_danismani',
 'CyberStep partner program KVKK danışmanı',
 'partner', 1, 44,
 'Partner kanalına özel içerik. Kazanç modeli açıklaması.'),

-- ════════════════════════════════════════
-- AY 12 — HAFTA 45-52 (Sıra 89-104)
-- Yıllık otorite + strateji içerikleri
-- ════════════════════════════════════════

(89,
 'Türkiye Yıllık Siber Güvenlik Durum Raporu 2026',
 'FA', 'genel',
 'türkiye siber güvenlik raporu yıllık 2026',
 'sektorel-kiyaslama', 1, 45,
 'Yıllık büyük rapor. Medya lansmanı için. CyberStep verisi.'),

(90,
 'Deepfake Tespiti: Şirketler Hangi Araçları Kullanabilir?',
 'AI', 'it_yoneticisi',
 'deepfake tespit araçları şirket',
 'ai-phishing-simulasyonu', 1, 46,
 'Deepfake analizi servisine yönlendir. Teknik + pratik rehber.'),

(91,
 'Siber Güvenlik Yatırımı Yapmayan Şirketlere Ne Olur? Vakalar',
 'FA', 'patron',
 'siber güvenlik yatırım yapmamanın sonuçları',
 'roi-hesaplayici', 1, 46,
 'Negatif ROI framing. Gerçek vakalar. TL kayıp rakamları.'),

(92,
 'EU AI Act 2027: Türk Şirketleri İçin Uyum Takvimi',
 'AI', 'kurumsal',
 'EU AI Act 2027 uyum takvimi türkiye',
 'eu-ai-act', 1, 47,
 'Güncelleme içeriği. 2027''ye yaklaşırken yenilenen bilgiler.'),

(93,
 'Türkiye''de En Çok Kullanılan Şifreler ve Güvenlik Riskleri',
 'FA', 'genel',
 'türkiye en çok kullanılan şifre güvenlik',
 'sizinti-izleyici', 2, 47,
 'Viral potansiyelli içerik. Şifre sızıntısı verisi. Kolay okunur.'),

(94,
 'Siber Güvenlik Danışmanlığı vs Otomatik Platform: Doğru Seçim',
 'CO', 'patron',
 'siber güvenlik danışmanlığı platform karşılaştırma',
 'assessment', 1, 48,
 'CyberStep vs danışmanlık firması. Maliyet + hız + süreklilik.'),

(95,
 'Yapay Zeka ve Siber Güvenlik: 2027''ye Bakış',
 'AI', 'genel',
 'yapay zeka siber güvenlik 2027 gelecek',
 'assessment', 2, 48,
 'Trend ve öngörü içeriği. CyberStep vizyonu.'),

(96,
 'Türk Girişimciler İçin Siber Güvenlik Başlangıç Kiti',
 'RE', 'patron',
 'girişim startup siber güvenlik başlangıç',
 'assessment', 2, 49,
 'Startup ve yeni kurulan şirketler için. Minimum ama doğru adımlar.'),

(97,
 'Saldırı Simülasyonu (BAS) Nedir? CyberStep Yaklaşımı',
 'KU', 'kurumsal',
 'saldırı simülasyonu BAS siber güvenlik',
 'pentest-lite', 1, 49,
 'Pentest Lite + BAS kavramı. Kurumsal kitle için derinlemesine.'),

(98,
 'AI Araç Güvenliği Kontrol Listesi: 20 Soruluk Hızlı Test',
 'CO', 'patron',
 'AI araç güvenliği kontrol listesi',
 'ai-guvenlik-degerlendirmesi', 1, 50,
 'Conversion içeriği. Hızlı self-assessment. Tam değerlendirmeye CTA.'),

(99,
 'Türkiye''de Siber Güvenlik Mevzuatı: Tam Rehber 2026',
 'DU', 'kvkk_danismani',
 'türkiye siber güvenlik mevzuatı rehber',
 'assessment', 1, 50,
 'KVKK + Siber Güvenlik Kanunu + BDDK. Referans içerik.'),

(100,
 'CyberStep ile 1 Yılda Neler Değişti? Müşteri Sonuçları',
 'CO', 'patron',
 'CyberStep sonuçları müşteri başarı hikayesi',
 'assessment', 1, 51,
 'Sosyal kanıt. Gerçek skor değişimleri. Anonim vaka çalışmaları.'),

(101,
 'Yapay Zeka ile Siber Dolandırıcılık: 2026''nın En Tehlikeli 5 Yöntemi',
 'AI', 'genel',
 'yapay zeka dolandırıcılık 2026 yöntemler',
 'ai-phishing-simulasyonu', 1, 51,
 'Yıl sonu trend içeriği. Medya değeri yüksek.'),

(102,
 'Siber Güvenlik Sertifikasyonu Rehberi: Standart, Altın, Platin',
 'CO', 'patron',
 'siber güvenlik sertifikasyon CyberStep',
 'assessment', 1, 52,
 'Sertifika sistemi tanıtımı. İhale ve partner faydaları.'),

(103,
 'Türkiye Siber Güvenlik Ekosistemi 2027: Nereye Gidiyoruz?',
 'KU', 'genel',
 'türkiye siber güvenlik 2027 ekosistem',
 'assessment', 2, 52,
 'Yıl sonu öngörü içeriği. CyberStep vizyonu. Lider ses konumu.'),

(104,
 'CyberStep Yıllık Özet: 2026''da Türkiye''nin Siber Güvenlik Tablosu',
 'FA', 'genel',
 'CyberStep yıllık özet türkiye siber güvenlik 2026',
 'sektorel-kiyaslama', 1, 52,
 'Yıl sonu otorite içerik. Tüm platform verisinden üret. Medya lansmanı.');
```

---

## ADMIN PANEL UPDATE

After inserting all 104 topics, update the blog admin panel to:

1. Show `sort_order` and `publish_week` columns in the content calendar view
2. Add filter by `category` (FA/RE/SE/DU/CO/AI/KU)
3. Add filter by `target_audience`
4. Add "Generate Post" button that sends topic + ai_prompt_notes + seo_keyword to Claude
5. Show category distribution chart:
   - FA (Farkındalık): 18 posts
   - RE (Rehberlik): 19 posts
   - SE (Sektörel): 12 posts
   - DU (Düzenleyici): 13 posts
   - CO (Conversion): 15 posts
   - AI (Yapay Zeka): 20 posts ← Yeni kategori
   - KU (Kurumsal): 7 posts ← Yeni kategori

---

## CLAUDE BLOG GENERATION — UPDATED MASTER PROMPT

When admin clicks "Generate" for any topic, send this prompt to Claude:

```typescript
const generateBlogPost = (topic: BlogTopic) => `
Sen CyberStep.io'nun içerik direktörüsün.
Aşağıdaki parametrelerle SEO uyumlu blog yazısı üret.

BAŞLIK: ${topic.title_tr}
SEO ANAHTAR KELİME: ${topic.seo_keyword}
KATEGORİ: ${topic.category}
HEDEF OKUYUCU: ${topic.target_audience}
CyberStep ARACI: ${topic.cyberstep_tool}
ÖZEL NOTLAR: ${topic.ai_prompt_notes}

YAZIM KURALLARI:
1. Platform artık sadece KOBİ değil — TÜM Türk şirketleri hedef.
   "KOBİ" kelimesini kullanma. Yerine: "şirket", "işletme",
   "Türk firması", "yönetici" gibi ifadeler kullan.

2. Patron dili: teknik terim yok veya parantez içi açıklamalı.

3. Türkiye odaklı: Türkiye verileri, KVKK, USOM, Siber Güvenlik
   Başkanlığı referansları öncelikli.

4. TL bazında finansal risk: her yazıda en az 1 somut rakam.

5. CyberStep bağlantısı doğal olmalı — 2 kez, reklam hissi vermeden.

6. İstatistik kullanıyorsan [DOĞRULA: kaynak] etiketi ekle.

7. Uzunluk: 900-1200 kelime.

8. Format: Markdown (## başlıklar, **bold**, - listeler)

9. Son bölüm: "Bugün Yapabileceğiniz Tek Şey" —
   spesifik 1 aksiyon + CyberStep CTA.

META VERİLER (ayrı bölüm olarak üret):
---META---
SEO başlık (max 60 karakter):
Meta açıklama (max 155 karakter):
Slug:
Etiketler (5 adet):
Okuma süresi:
---META---
`;
```

---

## KATEGORI ÖZET (104 BAŞLIK DAĞILIMI)

| Kategori | Kod | Adet | Oran | Açıklama |
|---|---|---|---|---|
| Yapay Zeka Güvenliği | AI | 20 | %19 | Yeni — en güncel alan |
| Rehberlik / How-to | RE | 19 | %18 | SEO çekirdeği |
| Farkındalık | FA | 18 | %17 | Viral + geniş kitle |
| Conversion | CO | 15 | %14 | Satış tetikleyici |
| Düzenleyici / Uyum | DU | 13 | %13 | KVKK + EU AI Act |
| Sektörel | SE | 12 | %12 | Nitelikli lead |
| Kurumsal | KU | 7 | %7 | B2B kurumsal kitle |

---

*CyberStep.io Blog Takvimi v2.0 — Türkiye Odaklı + AI Güvenlik Kategorili — Mayıs 2026*
