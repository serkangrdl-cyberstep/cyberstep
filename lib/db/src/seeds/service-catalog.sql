-- Service catalog seed data for CyberStep.io
-- Run: psql "$DATABASE_URL" -f lib/db/src/seeds/service-catalog.sql

CREATE TABLE IF NOT EXISTS service_catalog (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]',
  how_it_works JSONB NOT NULL DEFAULT '[]',
  faq JSONB NOT NULL DEFAULT '[]',
  monthly_price_tl NUMERIC(10,2) NOT NULL,
  setup_fee_tl NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'monitoring',
  icon TEXT NOT NULL DEFAULT 'Shield',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO service_catalog
  (slug, label, short_description, long_description, features, how_it_works, faq,
   monthly_price_tl, setup_fee_tl, category, icon, sort_order)
VALUES
(
  'fortinet-fabric',
  'Fortinet Security Fabric',
  'FortiGate, FortiAnalyzer ve FortiSIEM entegrasyonuyla ağınızdaki tehditleri gerçek zamanlı izleyin ve otomatik bloklama yapın.',
  'Fortinet Security Fabric, şirket ağınızdaki tüm güvenlik cihazlarını tek bir merkezi platform üzerinden yönetmenizi sağlar. CyberStep SOC analistleri 7/24 olayları izler, kritik tehditleri önceliklendirir ve gerektiğinde otomatik bloklama gerçekleştirir.',
  '["Gerçek zamanlı olay korelasyonu","Otomatik tehdit bloklama (FortiManager API)","SOC analist triage ve eskalasyon","Aylık güvenlik raporu","FortiGate, FortiAnalyzer, FortiSIEM entegrasyonu","MITRE ATT&CK eşleme"]',
  '[{"step":"Bağlantı Kurulumu","desc":"FortiManager API kimlik bilgilerini güvenli şekilde sisteme tanımlarsınız."},{"step":"İzleme Başlar","desc":"SOC motoru olayları gerçek zamanlı olarak toplar ve korelasyon yapar."},{"step":"Müdahale","desc":"Kritik tehditler için otomatik bloklama veya SOC analist triage devreye girer."}]',
  '[{"q":"Mevcut Fortinet lisansım var, ek ücret öder miyim?","a":"Hayır. Bu servis yalnızca CyberStep SOC entegrasyonu ve yönetim hizmetini kapsar. Fortinet lisanslarınız değişmez."},{"q":"Kaç cihaza kadar destekleniyor?","a":"Başlangıç paketinde 5 FortiGate cihazına kadar destek verilir."},{"q":"Kurulum ne kadar sürer?","a":"Ortalama 2-3 iş günü içinde entegrasyon tamamlanır."}]',
  4990.00, 2500.00, 'soc', 'Network', 1
),
(
  'dns-izleme',
  'DNS İzleme',
  'Alan adlarınızdaki değişiklikleri 5 dakikada bir denetleyin; yetkisiz subdomain, NS veya MX değişikliklerinde anında uyarı alın.',
  'DNS kayıt değişiklikleri genellikle domain ele geçirme veya altyapı sabotajının ilk işaretidir. CyberStep DNS İzleme servisi, kayıtlarınızı sürekli denetleyerek herhangi bir yetkisiz değişikliği anında size bildirir.',
  '["5 dakikada bir otomatik DNS taraması","Subdomain, NS, MX, A, AAAA kayıt takibi","E-posta ve WhatsApp anlık uyarı","Domain hijacking erken tespiti","Çoklu domain desteği","Değişiklik geçmişi ve diff görünümü"]',
  '[{"step":"Domain Tanımlama","desc":"Takip etmek istediğiniz domain listesini sisteme eklersiniz."},{"step":"Sürekli İzleme","desc":"Her 5 dakikada bir tüm DNS kayıtları otomatik olarak kontrol edilir."},{"step":"Anlık Uyarı","desc":"Herhangi bir değişiklik tespit edildiğinde e-posta ve WhatsApp bildirimi gönderilir."}]',
  '[{"q":"Kaç domain izlenebilir?","a":"Başlangıç paketinde 5 domaine kadar izleme yapılır."},{"q":"Uyarılar ne kadar hızlı gelir?","a":"Değişiklik tespitinden sonra en fazla 10 dakika içinde bildirim gönderilir."},{"q":"WhatsApp bildirimi zorunlu mu?","a":"Hayır. Yalnızca e-posta bildirimi tercih edilebilir."}]',
  990.00, 0.00, 'monitoring', 'Globe', 2
),
(
  'ct-log-izleme',
  'CT Log İzleme',
  'Alan adınız için dünyada verilen tüm SSL sertifikalarını izleyin; sahte sertifika tespitinde anında bildirim alın.',
  'Certificate Transparency logları, herkesin SSL sertifikası hakkında şeffaf bilgi edinmesini sağlar. Kötü niyetli kişiler alan adınız için sahte sertifika çıkarttığında CT Log İzleme servisi sizi anında uyarır.',
  '["crt.sh entegrasyonu ile dünya geneli SSL izleme","Sahte ve yetkisiz sertifika tespiti","Yeni sertifika bildirim sistemi","Subdomain enumeration tespiti","Günlük özet rapor","Kritik olaylarda anlık uyarı"]',
  '[{"step":"Domain Kaydı","desc":"İzlemek istediğiniz domain adlarını sisteme eklersiniz."},{"step":"CT Log Taraması","desc":"crt.sh ve diğer CT log sunucuları sürekli taranır."},{"step":"Anında Bildirim","desc":"Alan adınız için yeni bir sertifika verildiğinde hemen haberdar olursunuz."}]',
  '[{"q":"Tüm SSL sağlayıcılarını kapsıyor mu?","a":"Evet. CT log standartlarına uyan tüm sertifika otoritelerini kapsar."},{"q":"Kaç domain izlenebilir?","a":"Başlangıç paketinde 10 domaine kadar izleme yapılır."},{"q":"Subdomain için de çalışıyor mu?","a":"Evet, wildcard ve subdomain sertifikalar da izleme kapsamındadır."}]',
  490.00, 0.00, 'monitoring', 'ScrollText', 3
),
(
  'microsoft-365',
  'Microsoft 365 Entegrasyonu',
  'Azure AD riskli giriş olaylarını, şüpheli kullanıcı aktivitelerini ve Microsoft 365 güvenlik uyarılarını otomatik olarak izleyin.',
  'Microsoft 365 ve Azure AD, şirket verilerinin büyük bölümünü barındırır. CyberStep MS365 Entegrasyonu, kullanıcı hesaplarındaki şüpheli aktiviteleri gerçek zamanlı olarak SOC ekibinize iletir.',
  '["Azure AD OAuth güvenli bağlantı","Riskli giriş olayı korelasyonu","İmkansız seyahat tespiti","MFA bypass girişimi uyarısı","Kullanıcı risk skoru izleme","Microsoft Secure Score entegrasyonu"]',
  '[{"step":"OAuth Bağlantısı","desc":"Microsoft hesabınızla güvenli OAuth akışını tamamlarsınız. Şifre paylaşımı gerekmez."},{"step":"Risk İzleme","desc":"Azure AD risk olayları gerçek zamanlı olarak toplanır ve analiz edilir."},{"step":"SOC Korelasyonu","desc":"Kritik olaylar SOC vakasına dönüştürülür ve eskalasyon sürecini başlatır."}]',
  '[{"q":"Microsoft tenanta tam erişim mi veriyorum?","a":"Hayır. Yalnızca read-only güvenlik olayları kapsamında Graph API izni talep edilir."},{"q":"Microsoft 365 E3/E5 lisansı gerekiyor mu?","a":"Temel özellikler için E1 yeterlidir. Tam risk olay akışı için E3 veya E5 önerilir."},{"q":"Mevcut Conditional Access politikalarım değişir mi?","a":"Hayır. Sadece izleme yapılır, mevcut politikalar değiştirilmez."}]',
  1490.00, 0.00, 'monitoring', 'Building2', 4
),
(
  'kvkk-bildirim',
  'KVKK Bildirim Sistemi',
  'Veri ihlali olaylarını KVKK''nın gerektirdiği 72 saat içinde Kurul''a bildirmek için hazır süreç ve dokümantasyon.',
  'KVKK Madde 12 kapsamında veri ihlali yaşandığında veri sorumluları 72 saat içinde Kişisel Verileri Koruma Kurulu''na bildirim yapmak zorundadır. CyberStep KVKK Bildirim Sistemi bu süreci otomatize eder.',
  '["72 saatlik bildirim sürecinin otomatizasyonu","Hazır Kurul bildirim şablonları","Olay kaydı ve delil zinciri yönetimi","Veri envanteri ihlal haritalaması","İlgili kişi bildirim şablonları","KVKK Madde 12 uyumluluk skoru"]',
  '[{"step":"Olay Tespiti","desc":"Veri ihlali tespit edildiğinde sistem otomatik olarak bildirim sürecini başlatır."},{"step":"Dokümantasyon","desc":"İhlalin kapsamı, etkilenen kişiler ve alınan tedbirler otomatik olarak raporlanır."},{"step":"Bildirim","desc":"Kurul bildirimi için hazırlanan taslak onayınıza sunulur ve gönderilebilir hale gelir."}]',
  '[{"q":"Otomatik bildirim gönderiyor mu?","a":"Hayır. Sistem taslağı hazırlar, ancak nihai gönderim sorumluya aittir."},{"q":"Hangi ihlal türlerini kapsıyor?","a":"Yetkisiz erişim, veri sızıntısı, fidye yazılımı ve kayıp/çalıntı cihaz senaryolarını kapsar."},{"q":"Avukatımla birlikte mi kullanabilirim?","a":"Evet. Sistem avukat ve DPO erişimine uygun rol tabanlı yapıya sahiptir."}]',
  1990.00, 500.00, 'compliance', 'FileText', 5
),
(
  'servicenow',
  'ServiceNow Entegrasyonu',
  'SOC vakalarını ServiceNow incident''larıyla çift yönlü senkronize edin. HMAC-SHA256 imzalı webhook ile güvenli entegrasyon.',
  'Kurumsal ITSM sistemlerinde ServiceNow, olay yönetiminin merkezindedir. CyberStep ServiceNow Entegrasyonu, güvenlik vakalarını ServiceNow incident''larına otomatik olarak eşler.',
  '["Çift yönlü vaka senkronizasyonu","HMAC-SHA256 güvenli webhook","SLA ihlali anlık uyarısı","Incident öncelik eşleme","Assignment group yönlendirmesi","SOC vaka kapanma otomasyonu"]',
  '[{"step":"Webhook Yapılandırması","desc":"ServiceNow''da Outbound REST Message ve Business Rule oluşturursunuz."},{"step":"Senkronizasyon","desc":"CyberStep SOC vakası açıldığında otomatik olarak ServiceNow incident oluşturulur."},{"step":"Çift Yönlü Akış","desc":"Her iki sistemdeki durum değişiklikleri karşılıklı yansır."}]',
  '[{"q":"ServiceNow sürümüm önemli mi?","a":"Tokyo veya sonraki sürümler için HMAC desteği tam çalışır."},{"q":"Hangi ServiceNow tablosunu kullanıyor?","a":"Incident tablosuna yazılır. Problem veya Change için özelleştirme yapılabilir."},{"q":"Mevcut ITSM workflowlarım bozulur mu?","a":"Hayır. Entegrasyon mevcut workflowlara dokunmaz."}]',
  2490.00, 1000.00, 'itsm', 'Activity', 6
),
(
  'soc-operasyon',
  'SOC Operasyon Merkezi',
  '7/24 güvenlik operasyonları; triage, playbook yönetimi, eskalasyon ve olay müdahale desteği.',
  'CyberStep SOC Operasyon Merkezi, şirketinize dedike SOC analistleri atar. Tüm güvenlik olayları 7/24 izlenir, kritik vakalar önceliklendirilir ve müdahale koordine edilir.',
  '["7/24 dedike SOC analist desteği","MITRE ATT&CK tabanlı triage","Olay müdahale playbook kütüphanesi","Aylık güvenlik operasyon raporu","Eskalasyon prosedürü ve hotline","Tehdit istihbaratı entegrasyonu"]',
  '[{"step":"Dedike Analist Ataması","desc":"Şirketinize SOC analistleri atanır, iletişim kanalları kurulur."},{"step":"Sürekli İzleme","desc":"7/24 olaylar izlenir, kritik tehditler gerçek zamanlı analiz edilir."},{"step":"Raporlama","desc":"Aylık kapsamlı güvenlik operasyon raporu yöneticilerinize sunulur."}]',
  '[{"q":"Kendi güvenlik ekibimiz varsa ne olur?","a":"SOC ekibinizle entegre çalışır. Escalation matrix birlikte belirlenir."},{"q":"Hangi sistemleri izliyorsunuz?","a":"Bağlandığınız tüm entegrasyonları (Fortinet, MS365, DNS, CT Log vb.) izleriz."},{"q":"Sözleşme süresi ne kadar?","a":"Minimum 3 aylık taahhüt gereklidir. Yıllık taahhütte %15 indirim uygulanır."}]',
  9990.00, 5000.00, 'soc', 'Shield', 7
),
(
  'observability',
  'Observability & SIEM',
  'Log kaynaklarınızı merkezi bir noktada toplayın; AI destekli anomali tespiti ve öngörülü uyarılarla güvenlik görünürlüğünüzü artırın.',
  'Merkezi log yönetimi ve SIEM, büyük hacimli güvenlik olayı verisinden anlam çıkarmanın temel yöntemidir. CyberStep Observability servisi, mevcut altyapınızdan gelen logları toplar ve AI destekli anomali tespitiyle önceliklendirme yapar.',
  '["Çoklu log kaynağı bağlantısı (Syslog, API, Agent)","AI destekli anomali tespiti","Gerçek zamanlı güvenlik dashboard","Özelleştirilebilir uyarı kuralları","Log saklama ve arama (90 gün)","SIEM korelasyon motoru"]',
  '[{"step":"Log Kaynakları","desc":"Firewall, sunucu, uygulama ve bulut loglarınız merkezi sisteme bağlanır."},{"step":"Normalizasyon","desc":"Farklı formatlardaki loglar normalize edilerek korelasyona hazır hale gelir."},{"step":"Analiz & Uyarı","desc":"AI motoru anormallikleri tespit eder; kritik olaylar için anlık uyarı gönderilir."}]',
  '[{"q":"Kaç log kaynağı destekleniyor?","a":"Başlangıç paketinde 10 log kaynağına kadar destek verilir."},{"q":"Log verileri nerede saklanır?","a":"Türkiye''deki sunucularda, KVKK uyumlu altyapıda 90 gün saklanır."},{"q":"Mevcut SIEM sistemimle birlikte kullanabilir miyiz?","a":"Evet. Çift yönlü entegrasyon veya feed aktarımı yapılabilir."}]',
  2990.00, 1500.00, 'monitoring', 'Server', 8
)
ON CONFLICT (slug) DO NOTHING;
