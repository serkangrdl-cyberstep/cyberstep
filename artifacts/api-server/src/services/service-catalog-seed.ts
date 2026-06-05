import { db } from "@workspace/db";
import { serviceCatalogTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "../lib/logger";

const SEED_DATA = [
  {
    "slug": "fortinet-fabric",
    "label": "Fortinet Security Fabric",
    "short_description": "FortiGate, FortiAnalyzer ve FortiSIEM entegrasyonuyla ağınızdaki tehditleri gerçek zamanlı izleyin ve otomatik bloklama yapın.",
    "long_description": "Fortinet Security Fabric, şirket ağınızdaki tüm güvenlik cihazlarını tek bir merkezi platform üzerinden yönetmenizi sağlar. CyberStep SOC analistleri 7/24 olayları izler, kritik tehditleri önceliklendirir ve gerektiğinde otomatik bloklama gerçekleştirir.",
    "features": [
      "Gerçek zamanlı olay korelasyonu",
      "Otomatik tehdit bloklama (FortiManager API)",
      "SOC analist triage ve eskalasyon",
      "Aylık güvenlik raporu",
      "FortiGate, FortiAnalyzer, FortiSIEM entegrasyonu",
      "MITRE ATT&CK eşleme"
    ],
    "how_it_works": [
      {
        "desc": "FortiManager API kimlik bilgilerini güvenli şekilde sisteme tanımlarsınız.",
        "step": "Bağlantı Kurulumu"
      },
      {
        "desc": "SOC motoru olayları gerçek zamanlı olarak toplar ve korelasyon yapar.",
        "step": "İzleme Başlar"
      },
      {
        "desc": "Kritik tehditler için otomatik bloklama veya SOC analist triage devreye girer.",
        "step": "Müdahale"
      }
    ],
    "faq": [
      {
        "a": "Hayır. Bu servis yalnızca CyberStep SOC entegrasyonu ve yönetim hizmetini kapsar. Fortinet lisanslarınız değişmez.",
        "q": "Mevcut Fortinet lisansım var, ek ücret öder miyim?"
      },
      {
        "a": "Başlangıç paketinde 5 FortiGate cihazına kadar destek verilir. Ek cihazlar için özel fiyatlandırma uygulanır.",
        "q": "Kaç cihaza kadar destekleniyor?"
      },
      {
        "a": "Ortalama 2-3 iş günü içinde entegrasyon tamamlanır.",
        "q": "Kurulum ne kadar sürer?"
      }
    ],
    "monthly_price_tl": 4990,
    "setup_fee_tl": 2500,
    "category": "soc",
    "icon": "Network",
    "is_active": true,
    "sort_order": 1,
    "service_type": "monthly",
    "price_tl": 4990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "dns-izleme",
    "label": "DNS İzleme",
    "short_description": "Alan adlarınızdaki değişiklikleri 5 dakikada bir denetleyin; yetkisiz subdomain, NS veya MX değişikliklerinde anında uyarı alın.",
    "long_description": "DNS kayıt değişiklikleri genellikle domain ele geçirme veya altyapı sabotajının ilk işaretidir. CyberStep DNS İzleme servisi, kayıtlarınızı sürekli denetleyerek herhangi bir yetkisiz değişikliği anında size bildirir.",
    "features": [
      "5 dakikada bir otomatik DNS taraması",
      "Subdomain, NS, MX, A, AAAA kayıt takibi",
      "E-posta ve WhatsApp anlık uyarı",
      "Domain hijacking erken tespiti",
      "Çoklu domain desteği",
      "Değişiklik geçmişi ve diff görünümü"
    ],
    "how_it_works": [
      {
        "desc": "Takip etmek istediğiniz domain listesini sisteme eklersiniz.",
        "step": "Domain Tanımlama"
      },
      {
        "desc": "Her 5 dakikada bir tüm DNS kayıtları otomatik olarak kontrol edilir.",
        "step": "Sürekli İzleme"
      },
      {
        "desc": "Herhangi bir değişiklik tespit edildiğinde e-posta ve WhatsApp bildirimi gönderilir.",
        "step": "Anlık Uyarı"
      }
    ],
    "faq": [
      {
        "a": "Başlangıç paketinde 5 domaine kadar izleme yapılır. Daha fazlası için ek ücret uygulanır.",
        "q": "Kaç domain izlenebilir?"
      },
      {
        "a": "Değişiklik tespitinden sonra en fazla 10 dakika içinde bildirim gönderilir.",
        "q": "Uyarılar ne kadar hızlı gelir?"
      },
      {
        "a": "Hayır. Yalnızca e-posta bildirimi tercih edilebilir. WhatsApp isteğe bağlıdır.",
        "q": "WhatsApp bildirimi zorunlu mu?"
      }
    ],
    "monthly_price_tl": 990,
    "setup_fee_tl": 0,
    "category": "monitoring",
    "icon": "Globe",
    "is_active": true,
    "sort_order": 2,
    "service_type": "monthly",
    "price_tl": 990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "ct-log-izleme",
    "label": "CT Log İzleme",
    "short_description": "Alan adınız için dünyada verilen tüm SSL sertifikalarını izleyin; sahte sertifika tespitinde anında bildirim alın.",
    "long_description": "Certificate Transparency logları, herkesin SSL sertifikası hakkında şeffaf bilgi edinmesini sağlar. Kötü niyetli kişiler alan adınız için sahte sertifika çıkarttığında CT Log İzleme servisi sizi anında uyarır.",
    "features": [
      "crt.sh entegrasyonu ile dünya geneli SSL izleme",
      "Sahte ve yetkisiz sertifika tespiti",
      "Yeni sertifika bildirim sistemi",
      "Subdomain enumeration tespiti",
      "Günlük özet rapor",
      "Kritik olaylarda anlık uyarı"
    ],
    "how_it_works": [
      {
        "desc": "İzlemek istediğiniz domain adlarını sisteme eklersiniz.",
        "step": "Domain Kaydı"
      },
      {
        "desc": "crt.sh ve diğer CT log sunucuları sürekli taranır.",
        "step": "CT Log Taraması"
      },
      {
        "desc": "Alan adınız için yeni bir sertifika verildiğinde hemen haberdar olursunuz.",
        "step": "Anında Bildirim"
      }
    ],
    "faq": [
      {
        "a": "Evet. CT log standartlarına uyan tüm sertifika otoritelerini kapsar (Let's Encrypt, DigiCert, Comodo vb.).",
        "q": "Tüm SSL sağlayıcılarını kapsıyor mu?"
      },
      {
        "a": "Başlangıç paketinde 10 domaine kadar izleme yapılır.",
        "q": "Kaç domain izlenebilir?"
      },
      {
        "a": "Evet, wildcard ve subdomain sertifikalar da izleme kapsamındadır.",
        "q": "Subdomain için de çalışıyor mu?"
      }
    ],
    "monthly_price_tl": 490,
    "setup_fee_tl": 0,
    "category": "monitoring",
    "icon": "ScrollText",
    "is_active": true,
    "sort_order": 3,
    "service_type": "monthly",
    "price_tl": 490,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "microsoft-365",
    "label": "Microsoft 365 Entegrasyonu",
    "short_description": "Microsoft 365 ortamınızı CyberStep'e bağlayın. Azure AD riskli girişleri, şüpheli kullanıcı aktiviteleri ve M365 güvenlik uyarıları otomatik izlenir ve raporlanır. Kurulum: 15 dakika, teknik bilgi gerekmez.",
    "long_description": "Microsoft 365 ve Azure AD, şirket verilerinin büyük bölümünü barındırır. CyberStep MS365 Entegrasyonu, kullanıcı hesaplarındaki şüpheli aktiviteleri gerçek zamanlı olarak SOC ekibinize iletir.",
    "features": [
      "Azure AD OAuth güvenli bağlantı",
      "Riskli giriş olayı korelasyonu",
      "İmkansız seyahat tespiti",
      "MFA bypass girişimi uyarısı",
      "Kullanıcı risk skoru izleme",
      "Microsoft Secure Score entegrasyonu"
    ],
    "how_it_works": [
      {
        "desc": "Microsoft hesabınızla güvenli OAuth akışını tamamlarsınız. Şifre paylaşımı gerekmez.",
        "step": "OAuth Bağlantısı"
      },
      {
        "desc": "Azure AD risk olayları gerçek zamanlı olarak toplanır ve analiz edilir.",
        "step": "Risk İzleme"
      },
      {
        "desc": "Kritik olaylar SOC vakasına dönüştürülür ve eskalasyon sürecini başlatır.",
        "step": "SOC Korelasyonu"
      }
    ],
    "faq": [
      {
        "a": "Hayır. Yalnızca read-only güvenlik olayları kapsamında Graph API izni talep edilir.",
        "q": "Microsoft tenant'a tam erişim mi veriyorum?"
      },
      {
        "a": "Temel özellikler için E1 yeterlidir. Tam risk olay akışı için E3 veya E5 önerilir.",
        "q": "Microsoft 365 E3/E5 lisansı gerekiyor mu?"
      },
      {
        "a": "Hayır. Sadece izleme yapılır, mevcut politikalar değiştirilmez.",
        "q": "Mevcut Conditional Access politikalarım değişir mi?"
      }
    ],
    "monthly_price_tl": 1490,
    "setup_fee_tl": 0,
    "category": "monitoring",
    "icon": "Building2",
    "is_active": true,
    "sort_order": 4,
    "service_type": "monthly",
    "price_tl": 1490,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "kvkk-bildirim",
    "label": "KVKK Bildirim Sistemi",
    "short_description": "Veri ihlali olaylarını KVKK'nın gerektirdiği 72 saat içinde Kurul'a bildirmek için hazır süreç ve dokümantasyon.",
    "long_description": "KVKK Madde 12 kapsamında veri ihlali yaşandığında veri sorumluları 72 saat içinde Kişisel Verileri Koruma Kurulu'na bildirim yapmak zorundadır. CyberStep KVKK Bildirim Sistemi bu süreci otomatize eder.",
    "features": [
      "72 saatlik bildirim sürecinin otomatizasyonu",
      "Hazır Kurul bildirim şablonları",
      "Olay kaydı ve delil zinciri yönetimi",
      "Veri envanteri ihlal haritalaması",
      "İlgili kişi bildirim şablonları",
      "KVKK Madde 12 uyumluluk skoru"
    ],
    "how_it_works": [
      {
        "desc": "Veri ihlali tespit edildiğinde sistem otomatik olarak bildirim sürecini başlatır.",
        "step": "Olay Tespiti"
      },
      {
        "desc": "İhlalin kapsamı, etkilenen kişiler ve alınan tedbirler otomatik olarak raporlanır.",
        "step": "Dokümantasyon"
      },
      {
        "desc": "Kurul bildirimi için hazırlanan taslak onayınıza sunulur ve gönderilebilir hale gelir.",
        "step": "Bildirim"
      }
    ],
    "faq": [
      {
        "a": "Hayır. Sistem taslağı hazırlar, ancak nihai gönderim sorumluya aittir.",
        "q": "Otomatik bildirim gönderiyor mu?"
      },
      {
        "a": "Yetkisiz erişim, veri sızıntısı, fidye yazılımı ve kayıp/çalıntı cihaz senaryolarını kapsar.",
        "q": "Hangi ihlal türlerini kapsıyor?"
      },
      {
        "a": "Evet. Sistem avukat ve DPO erişimine uygun rol tabanlı yapıya sahiptir.",
        "q": "Avukatımla birlikte mi kullanabilirim?"
      }
    ],
    "monthly_price_tl": 1990,
    "setup_fee_tl": 500,
    "category": "compliance",
    "icon": "FileText",
    "is_active": true,
    "sort_order": 5,
    "service_type": "monthly",
    "price_tl": 1990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "domain-scan-free",
    "label": "Ücretsiz Domain Güvenlik Taraması",
    "short_description": "Domain güvenlik açıklarını 30 saniyede tespit edin",
    "long_description": "",
    "features": [
      "SSL kontrolü",
      "SPF/DKIM/DMARC",
      "Kara liste",
      "Sızıntı kontrolü",
      "Skor"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 0,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "Globe",
    "is_active": true,
    "sort_order": 5,
    "service_type": "one_time",
    "price_tl": 0,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Tüm şirket büyüklükleri"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "servicenow",
    "label": "ServiceNow Entegrasyonu",
    "short_description": "SOC güvenlik vakalarını ServiceNow'a otomatik aktarın. CyberStep'te açılan güvenlik alarmları ServiceNow incident olarak oluşturulur. Kurulum sırasında teknik destek sağlanır. Kurulum: 3.000 TL (tek seferlik)",
    "long_description": "Kurumsal ITSM sistemlerinde ServiceNow, olay yönetiminin merkezindedir. CyberStep ServiceNow Entegrasyonu, güvenlik vakalarını ServiceNow incident'larına otomatik olarak eşler ve her iki sistemdeki durum değişikliklerini senkronize eder.",
    "features": [
      "Çift yönlü vaka senkronizasyonu",
      "HMAC-SHA256 güvenli webhook",
      "SLA ihlali anlık uyarısı",
      "Incident öncelik eşleme",
      "Assignment group yönlendirmesi",
      "SOC vaka kapanma otomasyonu"
    ],
    "how_it_works": [
      {
        "desc": "ServiceNow'da Outbound REST Message ve Business Rule oluşturursunuz (hazır şablon sağlanır).",
        "step": "Webhook Yapılandırması"
      },
      {
        "desc": "CyberStep SOC vakası açıldığında otomatik olarak ServiceNow incident'ı oluşturulur.",
        "step": "Senkronizasyon"
      },
      {
        "desc": "ServiceNow'daki durum değişiklikleri CyberStep'e, CyberStep'tekiler ServiceNow'a yansır.",
        "step": "Çift Yönlü Akış"
      }
    ],
    "faq": [
      {
        "a": "Tokyo veya sonraki sürümler için HMAC desteği tam çalışır.",
        "q": "ServiceNow sürümüm önemli mi?"
      },
      {
        "a": "Incident (incident) tablosuna yazılır. Problem veya Change için özelleştirme yapılabilir.",
        "q": "Hangi ServiceNow tablosunu kullanıyor?"
      },
      {
        "a": "Hayır. Entegrasyon mevcut workflow'lara dokunmaz; yeni incident açar veya var olanı günceller.",
        "q": "Mevcut ITSM workflow'larım bozulur mu?"
      }
    ],
    "monthly_price_tl": 2490,
    "setup_fee_tl": 3000,
    "category": "itsm",
    "icon": "Activity",
    "is_active": true,
    "sort_order": 6,
    "service_type": "monthly",
    "price_tl": 2490,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "soc-operasyon",
    "label": "SOC Operasyon Merkezi",
    "short_description": "7/24 güvenlik operasyonları; triage, playbook yönetimi, eskalasyon ve olay müdahale desteği.",
    "long_description": "CyberStep SOC Operasyon Merkezi, şirketinize dedike SOC analistleri atar. Tüm güvenlik olayları 7/24 izlenir, kritik vakalar önceliklendirilir ve müdahale koordine edilir.",
    "features": [
      "7/24 dedike SOC analist desteği",
      "MITRE ATT&CK tabanlı triage",
      "Olay müdahale playbook kütüphanesi",
      "Aylık güvenlik operasyon raporu",
      "Eskalasyon prosedürü ve hotline",
      "Tehdit istihbaratı entegrasyonu"
    ],
    "how_it_works": [
      {
        "desc": "Şirketinize SOC analistleri atanır, iletişim kanalları kurulur.",
        "step": "Dedike Analist Ataması"
      },
      {
        "desc": "7/24 olaylar izlenir, kritik tehditler gerçek zamanlı analiz edilir.",
        "step": "Sürekli İzleme"
      },
      {
        "desc": "Aylık kapsamlı güvenlik operasyon raporu yöneticilerinize sunulur.",
        "step": "Raporlama"
      }
    ],
    "faq": [
      {
        "a": "SOC ekibinizle entegre çalışır. Escalation matrix'i birlikte belirliyoruz.",
        "q": "Kendi güvenlik ekibimiz varsa ne olur?"
      },
      {
        "a": "Bağlandığınız tüm entegrasyonları (Fortinet, MS365, DNS, CT Log vb.) izleriz.",
        "q": "Hangi sistemleri izliyorsunuz?"
      },
      {
        "a": "Minimum 3 aylık taahhüt gereklidir. Yıllık taahhütte %15 indirim uygulanır.",
        "q": "Sözleşme süresi ne kadar?"
      }
    ],
    "monthly_price_tl": 9990,
    "setup_fee_tl": 5000,
    "category": "soc",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 7,
    "service_type": "monthly",
    "price_tl": 9990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "observability",
    "label": "Gözlemlenebilirlik & İzleme",
    "short_description": "Log kaynaklarınızı merkezi bir noktada toplayın; AI destekli anomali tespiti ve öngörülü uyarılarla güvenlik görünürlüğünüzü artırın.",
    "long_description": "Merkezi log yönetimi ve SIEM, büyük hacimli güvenlik olayı verisinden anlam çıkarmanın temel yöntemidir. CyberStep Observability servisi, mevcut altyapınızdan gelen logları toplar, normalize eder ve AI destekli anomali tespitiyle önceliklendirme yapar.",
    "features": [
      "Çoklu log kaynağı bağlantısı (Syslog, API, Agent)",
      "AI destekli anomali tespiti",
      "Gerçek zamanlı güvenlik dashboard",
      "Özelleştirilebilir uyarı kuralları",
      "Log saklama ve arama (90 gün)",
      "SIEM korelasyon motoru"
    ],
    "how_it_works": [
      {
        "desc": "Firewall, sunucu, uygulama ve bulut loglarınız merkezi sisteme bağlanır.",
        "step": "Log Kaynakları"
      },
      {
        "desc": "Farklı formatlardaki loglar normalize edilerek korelasyona hazır hale gelir.",
        "step": "Normalizasyon"
      },
      {
        "desc": "AI motoru anormallikleri tespit eder; kritik olaylar için anlık uyarı gönderilir.",
        "step": "Analiz & Uyarı"
      }
    ],
    "faq": [
      {
        "a": "Başlangıç paketinde 10 log kaynağına kadar destek verilir.",
        "q": "Kaç log kaynağı destekleniyor?"
      },
      {
        "a": "Türkiye'deki sunucularda, KVKK uyumlu altyapıda 90 gün saklanır.",
        "q": "Log verileri nerede saklanır?"
      },
      {
        "a": "Evet. Çift yönlü entegrasyon veya feed aktarımı yapılabilir.",
        "q": "Mevcut SIEM sistemimle birlikte kullanabilir miyiz?"
      }
    ],
    "monthly_price_tl": 2990,
    "setup_fee_tl": 1500,
    "category": "monitoring",
    "icon": "Server",
    "is_active": true,
    "sort_order": 8,
    "service_type": "monthly",
    "price_tl": 2990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "mini-assessment",
    "label": "Mini Güvenlik Değerlendirmesi",
    "short_description": "20 soruda siber güvenlik risk seviyenizi ölçün",
    "long_description": "",
    "features": [
      "20 soru",
      "Risk skoru",
      "AI raporu",
      "PDF indirme"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 0,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "ClipboardCheck",
    "is_active": true,
    "sort_order": 10,
    "service_type": "one_time",
    "price_tl": 0,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Tüm şirket büyüklükleri"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "full-assessment",
    "label": "Tam Güvenlik Değerlendirmesi",
    "short_description": "60 soruda kapsamlı güvenlik analizi. AI destekli risk skoru, öncelikli aksiyon planı ve yönetici raporu. 3-5 iş günü içinde teslim.",
    "long_description": "",
    "features": [
      "60 soru / 10 alan",
      "KVKK uyum skoru",
      "Sektör kıyaslama",
      "TL risk tahmini",
      "PDF rapor",
      "Uzman doğrulama rozeti"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 5990,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 20,
    "service_type": "one_time",
    "price_tl": 5990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 24,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "5-500 çalışan",
      "Tüm sektörler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "premium-assessment",
    "label": "Premium Danışmanlık Değerlendirmesi",
    "short_description": "Uzman ekiple 4 saatlik derinlemesine analiz",
    "long_description": "",
    "features": [
      "Tam Değerlendirme dahil",
      "4 saat uzman görüşmesi",
      "Özelleştirilmiş yol haritası",
      "Öncelikli destek 3 ay",
      "Üst yönetim sunumu"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 17990,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "Users",
    "is_active": false,
    "sort_order": 25,
    "service_type": "one_time",
    "price_tl": 17990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 4,
    "delivery_time_hours": 72,
    "sla_response_minutes": 60,
    "requirements": [],
    "target_audience": [
      "50+ çalışan",
      "Finans, sağlık, kamu"
    ],
    "is_self_service": false,
    "requires_admin_approval": true
  },
  {
    "slug": "ai-security-assessment",
    "label": "AI Güvenlik Değerlendirmesi",
    "short_description": "Kullandığınız AI araçlarının KVKK ve güvenlik risklerini ölçün",
    "long_description": "",
    "features": [
      "AI araç risk skoru",
      "KVKK uyum analizi",
      "Politika önerileri",
      "Sektöre özel riskler",
      "PDF rapor"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2900,
    "setup_fee_tl": 0,
    "category": "ai_service",
    "icon": "Bot",
    "is_active": true,
    "sort_order": 30,
    "service_type": "one_time",
    "price_tl": 2900,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 24,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "AI araç kullanan şirketler",
      "Teknoloji, finans, sağlık"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "phishing-simulation",
    "label": "AI Phishing Risk Analizi",
    "short_description": "Şirketinizi hedef alabilecek phishing saldırı senaryolarını AI ile üretir. Çalışanlarınıza farkındalık eğitiminde kullanın. Gerçek email gönderimi yapılmaz — senaryo ve bilinçlendirme raporu teslim edilir.",
    "long_description": "",
    "features": [
      "3 spear-phishing senaryosu",
      "OSINT analizi",
      "Korunma önerileri"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 1990,
    "setup_fee_tl": 0,
    "category": "ai_service",
    "icon": "Mail",
    "is_active": true,
    "sort_order": 35,
    "service_type": "one_time",
    "price_tl": 1990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 24,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "Tüm şirketler",
      "İK ve yönetim ekibi"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "eu-ai-act",
    "label": "EU AI Act Uyum Skoru",
    "short_description": "AB yapay zeka yasasına uyumunuzu ölçün",
    "long_description": "",
    "features": [
      "Risk kategorisi belirleme",
      "Etkilenen maddeler",
      "2026/2027 uyum takvimi",
      "Ceza maruziyeti (TL)",
      "Aksiyon planı"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 1990,
    "setup_fee_tl": 0,
    "category": "ai_service",
    "icon": "Scale",
    "is_active": true,
    "sort_order": 40,
    "service_type": "one_time",
    "price_tl": 1990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 24,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "AB'ye ürün/hizmet satan şirketler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "ai-red-team",
    "label": "AI Red Team Raporu",
    "short_description": "Saldırgan perspektifinden şirketinizi değerlendirin",
    "long_description": "",
    "features": [
      "OSINT analizi",
      "30 dakikalık saldırı senaryosu",
      "3 istihbarat bulgusu",
      "Quick wins listesi"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2490,
    "setup_fee_tl": 0,
    "category": "ai_service",
    "icon": "Bug",
    "is_active": true,
    "sort_order": 45,
    "service_type": "one_time",
    "price_tl": 2490,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 48,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "Orta-büyük şirketler",
      "Yönetici ekibi kamuya açık"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "deepfake-analysis",
    "label": "Deepfake ve Ses Klonu Analizi",
    "short_description": "Yöneticilerinizin deepfake ve ses klonu riskini ölçün",
    "long_description": "",
    "features": [
      "Kamuya açık ses/video tespiti",
      "Ses klonu yeterlilik analizi",
      "CEO fraud risk skoru",
      "Doğrulama protokolü"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 1490,
    "setup_fee_tl": 0,
    "category": "ai_service",
    "icon": "Video",
    "is_active": true,
    "sort_order": 50,
    "service_type": "one_time",
    "price_tl": 1490,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 24,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "CEO, CFO, kamuya açık içerik üretenler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "fake-document-scan",
    "label": "Sahte Doküman Tespiti",
    "short_description": "Fatura, sözleşme ve kimlik belgelerinde manipülasyon tespiti",
    "long_description": "",
    "features": [
      "AI manipülasyon tespiti",
      "Metadata analizi",
      "Doğruluk skoru",
      "Anomali raporu"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 49,
    "setup_fee_tl": 0,
    "category": "ai_service",
    "icon": "FileSearch",
    "is_active": true,
    "sort_order": 55,
    "service_type": "usage",
    "price_tl": 49,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 1,
    "sla_response_minutes": 60,
    "requirements": [],
    "target_audience": [
      "Muhasebe",
      "Finans",
      "Hukuk",
      "İK"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "ai-tool-monitoring",
    "label": "AI Araç İzleme Servisi",
    "short_description": "Kullandığınız AI araçlarının politika değişikliklerini izleyin",
    "long_description": "",
    "features": [
      "7/24 politika değişiklik izleme",
      "Anlık e-posta bildirimi",
      "KVKK uyum skoru",
      "Aylık özet rapor"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 490,
    "setup_fee_tl": 0,
    "category": "monitoring",
    "icon": "Eye",
    "is_active": true,
    "sort_order": 60,
    "service_type": "monthly",
    "price_tl": 490,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 0,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "AI araç kullanan tüm şirketler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "leak-monitor",
    "label": "Sızıntı İzleyici",
    "short_description": "Dark web ve sızıntı veritabanlarını 7/24 izleyin",
    "long_description": "",
    "features": [
      "Dark web forum izleme",
      "Paste site izleme",
      "Anlık bildirim",
      "Çalışan e-posta kontrolü",
      "Aylık rapor"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 241.67,
    "setup_fee_tl": 0,
    "category": "monitoring",
    "icon": "Search",
    "is_active": true,
    "sort_order": 65,
    "service_type": "annual",
    "price_tl": null,
    "price_tl_annual": 2900,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 0,
    "sla_response_minutes": 240,
    "requirements": [],
    "target_audience": [
      "Tüm şirketler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "ai-policy-autoupdate",
    "label": "AI Politika Otogüncelleme",
    "short_description": "Yapay zeka kullanım politikanızı otomatik güncel tutun",
    "long_description": "",
    "features": [
      "Yasal değişiklik takibi",
      "Otomatik politika güncelleme",
      "PDF politika belgesi",
      "KVKK uyum senkronizasyonu"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 82.5,
    "setup_fee_tl": 0,
    "category": "monitoring",
    "icon": "RefreshCw",
    "is_active": true,
    "sort_order": 70,
    "service_type": "annual",
    "price_tl": null,
    "price_tl_annual": 990,
    "usage_unit": null,
    "setup_time_hours": 1,
    "delivery_time_hours": 0,
    "sla_response_minutes": 480,
    "requirements": [],
    "target_audience": [
      "AI araç kullanan şirketler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "soc-lite",
    "label": "AI SOC Lite",
    "short_description": "7/24 otomatik tehdit izleme, temel bildirimler",
    "long_description": "",
    "features": [
      "7/24 otomatik izleme",
      "Kritik tehdit bildirimi",
      "Otomatik IP blok",
      "Aylık SOC raporu",
      "SOC dashboard"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 4900,
    "setup_fee_tl": 0,
    "category": "soc",
    "icon": "ShieldAlert",
    "is_active": true,
    "sort_order": 80,
    "service_type": "monthly",
    "price_tl": 4900,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 4,
    "delivery_time_hours": 0,
    "sla_response_minutes": 60,
    "requirements": [],
    "target_audience": [
      "5-50 çalışan",
      "Temel FortiGate koruma"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "soc-standart",
    "label": "AI SOC Standart",
    "short_description": "İş saatlerinde analist destekli 7/24 izleme",
    "long_description": "",
    "features": [
      "SOC Lite dahil",
      "İş saatleri analist desteği",
      "FortiGate Fabric entegrasyonu",
      "Haftalık analist özeti",
      "Datadog/Azure entegrasyonu"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 8500,
    "setup_fee_tl": 0,
    "category": "soc",
    "icon": "ShieldCheck",
    "is_active": true,
    "sort_order": 85,
    "service_type": "monthly",
    "price_tl": 8500,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 8,
    "delivery_time_hours": 0,
    "sla_response_minutes": 30,
    "requirements": [],
    "target_audience": [
      "50-200 çalışan",
      "FortiGate + monitoring araçları"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "soc-pro",
    "label": "AI SOC Pro",
    "short_description": "7/24 analist destekli kriz yönetimi dahil SOC",
    "long_description": "",
    "features": [
      "SOC Standart dahil",
      "7/24 analist desteği",
      "Sanal CISO dahil",
      "Kriz yönetimi",
      "Aylık executive brifing"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 16500,
    "setup_fee_tl": 0,
    "category": "soc",
    "icon": "ShieldPlus",
    "is_active": false,
    "sort_order": 90,
    "service_type": "monthly",
    "price_tl": 16500,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 24,
    "delivery_time_hours": 0,
    "sla_response_minutes": 15,
    "requirements": [],
    "target_audience": [
      "200+ çalışan",
      "Finans, sağlık, kamu"
    ],
    "is_self_service": false,
    "requires_admin_approval": true
  },
  {
    "slug": "virtual-ciso",
    "label": "Sanal CISO",
    "short_description": "Aylık stratejik güvenlik danışmanlığı ve raporlama",
    "long_description": "",
    "features": [
      "Aylık 2 saat strateji görüşmesi",
      "Yönetim kurulu raporu",
      "Güvenlik yol haritası",
      "KVKK, BTK mevzuat takibi"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 8000,
    "setup_fee_tl": 0,
    "category": "consulting",
    "icon": "Briefcase",
    "is_active": false,
    "sort_order": 95,
    "service_type": "monthly",
    "price_tl": 8000,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 24,
    "delivery_time_hours": 0,
    "sla_response_minutes": 60,
    "requirements": [],
    "target_audience": [
      "50+ çalışan",
      "Kendi CISO'su olmayan şirketler"
    ],
    "is_self_service": false,
    "requires_admin_approval": true
  },
  {
    "slug": "bundle-full-protection",
    "label": "Tam Koruma Paketi",
    "short_description": "Kapsamlı yıllık güvenlik paketi",
    "long_description": "",
    "features": [
      "Tüm değerlendirmeler",
      "Tüm AI servisleri",
      "AI Araç İzleme + Politika",
      "Sızıntı İzleyici",
      "%25 indirim"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 1665.83,
    "setup_fee_tl": 0,
    "category": "bundle",
    "icon": "Package",
    "is_active": true,
    "sort_order": 100,
    "service_type": "annual",
    "price_tl": null,
    "price_tl_annual": 19990,
    "usage_unit": null,
    "setup_time_hours": 2,
    "delivery_time_hours": 48,
    "sla_response_minutes": 240,
    "requirements": [],
    "target_audience": [
      "20-200 çalışan",
      "Kapsamlı koruma isteyenler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "easm-tek",
    "label": "EASM Tek Değerlendirme",
    "short_description": "Domain adresinizden yola çıkarak dışarıdan görünen tüm saldırı yüzeyini Shodan, crt.sh, NVD, CISA KEV ve GreyNoise ile haritalayın. Türkçe PDF rapor.",
    "long_description": "Müşteriye sorulacak tek şey: domain adresiniz. Açık portlar, alt domain envanteri, CVE eşleştirme, EPSS/CISA KEV, HIBP sızıntısı, DMARC/SPF/DKIM ve WAF analizi tek raporda. KVKK/7545 bağlamıyla önceliklendirilmiş aksiyon listesi.",
    "features": [
      "Açık port ve servis haritalaması (Shodan)",
      "Alt domain envanteri (crt.sh)",
      "CVE eşleştirme + EPSS skorlaması",
      "CISA KEV aktif istismar kontrolü",
      "GreyNoise altyapı tarama tespiti",
      "HIBP email sızıntısı sorgusu",
      "DMARC/SPF/DKIM analizi",
      "WAF durumu ve bypass riski",
      "Türkçe PDF (20-30 sayfa)",
      "Yönetici özeti (2 sayfa)",
      "KVKK/7545 bağlamı"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 5990,
    "setup_fee_tl": 0,
    "category": "easm",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 100,
    "service_type": "one_time",
    "price_tl": 5990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "KOBİ",
      "Orta ölçekli işletme",
      "Bilgi güvenliği ekibi"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "easm-ceyreklik",
    "label": "EASM Çeyreklik Tekrar",
    "short_description": "İlk EASM değerlendirmesinin ardından 3 ayda bir tekrar tarama. Değişen saldırı yüzeyini takip edin, yeni açıkları erken yakalayın.",
    "long_description": "Saldırı yüzeyi sürekli değişir. Çeyreklik tekrar paketinde her 3 ayda bir tam EASM taraması yapılır; delta raporu (neyin değiştiği) hazırlanır.",
    "features": [
      "Tam EASM taraması (3 ayda bir)",
      "Önceki taramayla delta raporu",
      "Yeni açık ve kapanan risk özeti"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 3990,
    "setup_fee_tl": 0,
    "category": "easm",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 101,
    "service_type": "one_time",
    "price_tl": 3990,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "KOBİ",
      "Orta ölçekli işletme"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "easm-yillik",
    "label": "EASM Yıllık Abonelik",
    "short_description": "Aylık 2.500 TL ile sürekli saldırı yüzeyi izleme. Yeni subdomain, açık port veya CVE tespit edildiğinde anında bildirim.",
    "long_description": "Yıllık abonelikte EASM taraması haftalık otomatik tekrarlanır; kritik değişikliklerde email/SMS bildirimi gönderilir.",
    "features": [
      "Haftalık otomatik EASM taraması",
      "Anlık kritik değişiklik bildirimi",
      "Aylık delta raporu",
      "KVKK/7545 bağlamı"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2500,
    "setup_fee_tl": 0,
    "category": "easm",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 102,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 30000,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Orta ölçekli işletme",
      "Finans",
      "Sağlık"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "bundle-enterprise-soc",
    "label": "Kurumsal SOC Paketi",
    "short_description": "Tam koruma + SOC servisi + Fortinet entegrasyonu",
    "long_description": "",
    "features": [
      "Tam Koruma Paketi dahil",
      "SOC Standart 12 ay",
      "Fortinet Fabric kurulum",
      "Sanal CISO dahil",
      "%29 indirim"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 8250,
    "setup_fee_tl": 0,
    "category": "bundle",
    "icon": "Building2",
    "is_active": false,
    "sort_order": 105,
    "service_type": "annual",
    "price_tl": null,
    "price_tl_annual": 99000,
    "usage_unit": null,
    "setup_time_hours": 24,
    "delivery_time_hours": 72,
    "sla_response_minutes": 30,
    "requirements": [],
    "target_audience": [
      "50+ çalışan",
      "FortiGate kullananlar"
    ],
    "is_self_service": false,
    "requires_admin_approval": true
  },
  {
    "slug": "tehdit-istihbarat-starter",
    "label": "Tehdit İstihbarat Starter",
    "short_description": "1 cihaz için günlük tehdit listesi. CISA KEV, ThreatFox, Feodo, URLhaus, USOM listelerini birleştirip FortiGate address object olarak push ediyoruz.",
    "long_description": "CyberStep tüm açık kaynak tehdit listelerini 6 saatte bir günceller; tek cihazınıza günlük olarak gönderir. Müşteriden veri alınmaz.",
    "features": [
      "1 cihaz desteği",
      "Günlük güncelleme",
      "CISA KEV + ThreatFox + USOM + URLhaus + Feodo",
      "FortiGate address object push",
      "Generic Webhook desteği"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 1990,
    "setup_fee_tl": 0,
    "category": "threat-intel",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 110,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 23880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "5-50 çalışan",
      "Tek FortiGate"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "tehdit-istihbarat-standart",
    "label": "Tehdit İstihbarat Standart",
    "short_description": "5 cihaza 6 saatlik tehdit listesi güncellemesi. FortiManager merkezi dağıtım veya webhook ile çok cihaz desteği.",
    "long_description": "Beş cihaza kadar 6 saatlik güncelleme. FortiManager veya webhook üzerinden dağıtım. Tüm listeler (CISA KEV, ThreatFox, USOM, URLhaus, Feodo) otomatik birleştirilir.",
    "features": [
      "5 cihaz desteği",
      "6 saatlik güncelleme",
      "FortiManager merkezi dağıtım",
      "Webhook desteği"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 3490,
    "setup_fee_tl": 0,
    "category": "threat-intel",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 111,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 41880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "50-200 çalışan",
      "FortiManager kullananlar"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "tehdit-istihbarat-pro",
    "label": "Tehdit İstihbarat Pro",
    "short_description": "Sınırsız cihaza saatlik tehdit listesi güncellemesi. FortiManager merkezi dağıtım, webhook ve gerçek zamanlı kural seti.",
    "long_description": "Sınırsız cihaza saatlik güncelleme. Tüm entegrasyon kanalları açık. Büyük Fortinet altyapısı için ideal.",
    "features": [
      "Sınırsız cihaz",
      "Saatlik güncelleme",
      "FortiManager + Webhook",
      "API erişimi"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 5990,
    "setup_fee_tl": 0,
    "category": "threat-intel",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 112,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 71880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "200+ çalışan",
      "Çok lokasyonlu",
      "Finans/Sağlık/Kamu"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "cve-izleme-lite",
    "label": "CVE İzleme Lite",
    "short_description": "1 domain için dışarıdan tech stack tespiti + yeni CVE çıkınca email bildirimi. EPSS ve CISA KEV ile önceliklendirilmiş.",
    "long_description": "Domain banner ve header analizinden tech stack tespit edilir. NVD'den yeni CVE'ler saate iki kez sorgulanır; eşleşme varsa email bildirimi gider.",
    "features": [
      "1 domain",
      "Dışarıdan tech stack tespiti",
      "NVD + CISA KEV + EPSS izleme",
      "Email bildirimi"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 990,
    "setup_fee_tl": 0,
    "category": "threat-intel",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 120,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 11880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "5-50 çalışan",
      "Tek domain"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "cve-izleme-standart",
    "label": "CVE İzleme Standart",
    "short_description": "5 domain için CVE izleme + email ve SMS bildirimi. Kritik CVE'lerde NetGSM ile anlık SMS.",
    "long_description": "Beş domaine kadar tech stack tespiti ve CVE eşleştirme. CISA KEV'de yer alan kritik CVE'lerde SMS bildirimi.",
    "features": [
      "5 domain",
      "Email + SMS bildirimi",
      "CISA KEV kritik uyarısı",
      "Telegram bildirimi (opsiyonel)"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2490,
    "setup_fee_tl": 0,
    "category": "threat-intel",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 121,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 29880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "50-200 çalışan",
      "Çoklu domain"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "cve-izleme-pro",
    "label": "CVE İzleme Pro",
    "short_description": "Sınırsız domain — Telegram bildirimi + FortiGate entegrasyonu. CVE'yi tetikleyen tehdit IP'leri tespit edildiğinde FortiGate'e blok önerisi iletilir. Otomatik blok aktivasyonu isteğe bağlıdır ve beyaz liste korumasıyla çalışır.",
    "long_description": "Sınırsız domain, Telegram gerçek zamanlı bildirim, FortiGate otomatik blok kuralı. EPSS skoruna göre önceliklendirme.",
    "features": [
      "Sınırsız domain",
      "Email + SMS + Telegram",
      "FortiGate otomatik blok",
      "EPSS önceliklendirme"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 4990,
    "setup_fee_tl": 0,
    "category": "threat-intel",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 122,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 59880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "200+ çalışan",
      "Finans/Sağlık/Kamu",
      "FortiGate kullananlar"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "eposta-guvenligi-tek",
    "label": "E-posta Güvenlik Denetimi",
    "short_description": "SPF, DMARC, DKIM, BIMI, MX analizi + mail sunucusu 15+ kara liste kontrolü + HIBP sızıntı sayısı. Düzeltme kılavuzlu PDF rapor.",
    "long_description": "DNS sorgusu tabanlı; sisteme dokunulmaz. SPF/DMARC/DKIM yapılandırması, IP itibarı, HIBP sızıntısı analiz edilir. 30 gün sonra tekrar kontrol.",
    "features": [
      "SPF/DMARC/DKIM/BIMI analizi",
      "MX kayıt denetimi",
      "15+ DNSBL kara liste kontrolü",
      "AbuseIPDB + VirusTotal itibar",
      "HIBP email sızıntısı sorgusu",
      "PDF rapor + düzeltme kılavuzu",
      "30 gün sonra ücretsiz tekrar kontrol"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2500,
    "setup_fee_tl": 0,
    "category": "email-security",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 130,
    "service_type": "one_time",
    "price_tl": 2500,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Tüm şirket büyüklükleri"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "eposta-guvenligi-izleme",
    "label": "E-posta Güvenlik İzleme",
    "short_description": "Aylık 990 TL ile SPF/DMARC/DKIM sürekli izleme. Kayıt değişikliği veya kara listeye düşme anında bildirim.",
    "long_description": "Tek seferlik denetimin yıllık abonelik versiyonu. E-posta güvenlik yapılandırması sürekli izlenir; kara listeye düşme veya yapılandırma bozulması anında bildirim.",
    "features": [
      "Sürekli SPF/DMARC/DKIM izleme",
      "Kara listeye düşme bildirimi",
      "Yapılandırma değişikliği alarmı",
      "Aylık durum raporu"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 990,
    "setup_fee_tl": 0,
    "category": "email-security",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 131,
    "service_type": "monthly",
    "price_tl": null,
    "price_tl_annual": 11880,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Tüm şirket büyüklükleri"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "tprm-5",
    "label": "Tedarikçi Risk Tarama — 5 Tedarikçi",
    "short_description": "5 tedarikçi domainini dışarıdan EASM + HIBP + DMARC + kara liste ile tarayın. A-F risk matrisi ve BDDK 3. taraf bağlamıyla PDF rapor.",
    "long_description": "Her tedarikçi için tam EASM taraması yapılır. Risk matrisi, en riskli tedarikçiler, BDDK 3. taraf risk yönetimi bağlamı ve board'a hazır PDF.",
    "features": [
      "5 tedarikçi",
      "Her tedarikçi için EASM taraması",
      "HIBP sızıntı kontrolü",
      "DMARC/SPF durumu",
      "Kara liste kontrolü",
      "A-F risk matrisi",
      "BDDK bağlamıyla PDF"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2500,
    "setup_fee_tl": 0,
    "category": "tprm",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 140,
    "service_type": "one_time",
    "price_tl": 2500,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Tüm sektörler",
      "BDDK/BRSA denetimindeki şirketler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "tprm-10",
    "label": "Tedarikçi Risk Tarama — 10 Tedarikçi",
    "short_description": "10 tedarikçi domainini kapsamlı risk taramasıyla analiz edin. A-F risk matrisi, kritik tedarikçi vurgusu.",
    "long_description": "10 tedarikçi için tam EASM taraması, risk matrisi ve board'a hazır rapor.",
    "features": [
      "10 tedarikçi",
      "Risk matrisi",
      "Kritik tedarikçi vurgusu",
      "Board'a hazır PDF"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 4000,
    "setup_fee_tl": 0,
    "category": "tprm",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 141,
    "service_type": "one_time",
    "price_tl": 4000,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Orta-büyük işletme",
      "BDDK/BRSA denetimindeki şirketler"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "tprm-20",
    "label": "Tedarikçi Risk Tarama — 20 Tedarikçi",
    "short_description": "20 tedarikçi domainini analiz edin. Çeyreklik tekrar paketi ile sürekli tedarik zinciri güvenliği.",
    "long_description": "20 tedarikçi için tam risk taraması. Çeyreklik tekrar paketinde 3000 TL/çeyrek.",
    "features": [
      "20 tedarikçi",
      "Çeyreklik tekrar seçeneği (3.000 TL/çeyrek)",
      "Risk matrisi ve trend analizi",
      "Regülatör uyum raporlaması"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 6500,
    "setup_fee_tl": 0,
    "category": "tprm",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 142,
    "service_type": "one_time",
    "price_tl": 6500,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "50+ çalışan",
      "Finans/Sağlık/Kamu",
      "Tedarik zinciri yöneticileri"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "pentest-lite-tek",
    "label": "Pasif Saldırı Yüzeyi Analizi",
    "short_description": "Dışarıdan saldırgan gözüyle bakış. Shodan, crt.sh, CVE/EPSS, GreyNoise ve MITRE ATT&CK framework kullanılarak sisteminize erişim sağlanabilecek vektörler haritalanır. Aktif exploit veya sistem erişimi yapılmaz. Türkçe teknik rapor + yönetici özeti.",
    "long_description": "Aktif exploit yapılmaz. Tüm veriler public kaynaklardan. Shodan açık port/banner, crt.sh subdomain, CVE/EPSS/CISA KEV, GreyNoise aktif tarama, OTX tehdit bağlantısı, WAF bypass analizi ve Claude ile MITRE ATT&CK saldırı senaryosu.",
    "features": [
      "1 domain",
      "Altyapı haritalama (Shodan + crt.sh)",
      "CVE önceliklendirme (NVD + EPSS + CISA KEV)",
      "GreyNoise aktif tarama tespiti",
      "OTX tehdit korelasyonu",
      "MITRE ATT&CK saldırı senaryosu (Claude)",
      "WAF bypass analizi",
      "Pasif keşif — sisteme dokunulmaz"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 7500,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 150,
    "service_type": "one_time",
    "price_tl": 7500,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "KOBİ",
      "Orta ölçekli işletme",
      "Yönetim kurulu hazırlığı"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "pentest-lite-5domain",
    "label": "Pasif Saldırı Yüzeyi Analizi (5 Domain)",
    "short_description": "5 domain için dışarıdan pasif saldırı yüzeyi analizi. Çapraz domain saldırı yolu, CVE/EPSS, GreyNoise ve MITRE ATT&CK ile konsolide risk raporu. Aktif erişim yapılmaz.",
    "long_description": "5 domaine kadar pasif pentest. Çapraz domain tehdit bağlantısı ve konsolide risk önceliklendirmesi.",
    "features": [
      "5 domain",
      "Çapraz domain saldırı yolu analizi",
      "Konsolide risk raporu",
      "MITRE ATT&CK"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 15000,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 151,
    "service_type": "one_time",
    "price_tl": 15000,
    "price_tl_annual": null,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Orta-büyük şirket",
      "Çoklu domain yöneticileri"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "pentest-lite-yillik",
    "label": "Pasif Saldırı Yüzeyi Analizi (Yıllık)",
    "short_description": "Yılda 4 kez (çeyreklik) pasif saldırı yüzeyi analizi. Saldırı yüzeyi değişikliklerini düzenli takip edin. Aktif exploit veya sistem erişimi yapılmaz.",
    "long_description": "Yılda 4 çeyreklik pasif pentest; her rapordan sonra delta analizi. Regülatör ve sigorta şirketlerine sunulmaya hazır.",
    "features": [
      "Yılda 4 pentest lite raporu",
      "Delta analizi",
      "Regülatör uyum belgesi",
      "Sigorta şirketine hazır format"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 2000,
    "setup_fee_tl": 0,
    "category": "assessment",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 152,
    "service_type": "annual",
    "price_tl": null,
    "price_tl_annual": 24000,
    "usage_unit": null,
    "setup_time_hours": 0,
    "delivery_time_hours": 0,
    "sla_response_minutes": null,
    "requirements": [],
    "target_audience": [
      "Finans",
      "Sağlık",
      "Kamu",
      "Sigorta yaptıranlar"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "noc-lite",
    "label": "AI NOC Lite",
    "short_description": "7/24 otomatik ag izleme ve uptime takibi",
    "long_description": "Pasif izleme modeli ile ag altyapinizi surekli gozetim altinda tutun. CyberStep hicbir zaman ag yapilanirmanizi degistirmez; sadece izler, analiz eder ve uyarir.",
    "features": [
      "7/24 otomatik ag izleme",
      "Interface up/down bildirimleri",
      "WAN bant genisligi kullanim izleme",
      "Kritik servis uptime takibi",
      "Aylik ag performans raporu",
      "E-posta + Telegram bildirimleri",
      "FortiGate SNMP/Syslog entegrasyonu",
      "NOC dashboard erisimi"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 3900,
    "setup_fee_tl": 0,
    "category": "noc",
    "icon": "Activity",
    "is_active": true,
    "sort_order": 200,
    "service_type": "monthly",
    "price_tl": 3900,
    "price_tl_annual": 39000,
    "usage_unit": null,
    "setup_time_hours": 4,
    "delivery_time_hours": 0,
    "sla_response_minutes": 120,
    "requirements": [],
    "target_audience": [
      "5-50 calisanli",
      "Tek lokasyon",
      "Temel ag izleme ihtiyaci"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "noc-standart",
    "label": "AI NOC Standart",
    "short_description": "Anomali tespiti ve kapasite planlamasi ile profesyonel ag izleme",
    "long_description": "AI destekli anomali tespiti ile ag sorunlarini normal kullanicilari etkilemeden once yakalin. 14 gunluk baseline ogrenme ile false positive orani minimumda tutulur.",
    "features": [
      "NOC Lite dahil",
      "AI anomali tespiti (baseline ogrenme)",
      "WAN link kalite izleme",
      "Kapasite planlama raporu (aylik)",
      "Coklu lokasyon destegi",
      "SOC-NOC korelasyon",
      "Haftalik ag sagligi ozeti",
      "7/24 P1/P2 eskalasyon"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 6900,
    "setup_fee_tl": 0,
    "category": "noc",
    "icon": "BarChart2",
    "is_active": true,
    "sort_order": 205,
    "service_type": "monthly",
    "price_tl": 6900,
    "price_tl_annual": 69000,
    "usage_unit": null,
    "setup_time_hours": 8,
    "delivery_time_hours": 0,
    "sla_response_minutes": 60,
    "requirements": [],
    "target_audience": [
      "50-200 calisanli",
      "Coklu lokasyon",
      "FortiGate + WAN baglantisi"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "noc-pro",
    "label": "AI NOC Pro",
    "short_description": "Kriz yonetimi dahil kurumsal ag operasyon merkezi",
    "long_description": "Tam yonetilen NOC hizmeti. P1 kritik olaylarda sahaya destek koordinasyonu, ozel SLA anlasmasi ve aylik C-level ag raporu dahildir.",
    "features": [
      "NOC Standart dahil",
      "7/24 analist destegi",
      "Gercek zamanli trafik gorsellestime",
      "Ozel SLA anlasmasi",
      "BGP/routing anomali tespiti",
      "Aylik executive ag raporu",
      "Kriz yonetimi"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 11900,
    "setup_fee_tl": 0,
    "category": "noc",
    "icon": "Shield",
    "is_active": true,
    "sort_order": 210,
    "service_type": "monthly",
    "price_tl": 11900,
    "price_tl_annual": 119000,
    "usage_unit": null,
    "setup_time_hours": 24,
    "delivery_time_hours": 0,
    "sla_response_minutes": 30,
    "requirements": [],
    "target_audience": [
      "200+ calisanli",
      "Kritik altyapi",
      "Finans/Saglik/Kamu"
    ],
    "is_self_service": false,
    "requires_admin_approval": true
  },
  {
    "slug": "bundle-soc-noc-lite",
    "label": "AI SOC + NOC Lite",
    "short_description": "Guvenlik ve ag izlemesini tek platformda birlestirin",
    "long_description": "Sadece CyberStep her iki sinyali birlestirir: DDoS mi, hack mi, yoksa ag sorunu mu? Otomatik ayrım ve birlesik dashboard.",
    "features": [
      "AI SOC Lite dahil",
      "AI NOC Lite dahil",
      "SOC-NOC korelasyon motoru",
      "Birlesik dashboard",
      "Ataklarda agir + guvenlik sinyali",
      "%%10 indirim"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 7900,
    "setup_fee_tl": 0,
    "category": "bundle",
    "icon": "Layers",
    "is_active": true,
    "sort_order": 220,
    "service_type": "monthly",
    "price_tl": 7900,
    "price_tl_annual": 79000,
    "usage_unit": null,
    "setup_time_hours": 4,
    "delivery_time_hours": 0,
    "sla_response_minutes": 60,
    "requirements": [],
    "target_audience": [
      "5-50 calisanli",
      "Tek pencereden operasyon"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "bundle-soc-noc-standart",
    "label": "AI SOC + NOC Standart",
    "short_description": "Kurumsal operasyon merkezi — guvenlik ve ag tek ekranda",
    "long_description": "Birlesik haftalik raporlar, DDoS otomatik tespiti, veri sizdirma anomali korelasyonu. Fortinet Security Fabric + NetFlow tam entegrasyon.",
    "features": [
      "AI SOC Standart dahil",
      "AI NOC Standart dahil",
      "DDoS otomatik tespiti",
      "Veri sizdirma anomali korelasyonu",
      "Birlesik haftalik rapor",
      "Fortinet Security Fabric + NetFlow",
      "%%16 indirim"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 12900,
    "setup_fee_tl": 0,
    "category": "bundle",
    "icon": "Layers",
    "is_active": true,
    "sort_order": 225,
    "service_type": "monthly",
    "price_tl": 12900,
    "price_tl_annual": 129000,
    "usage_unit": null,
    "setup_time_hours": 8,
    "delivery_time_hours": 0,
    "sla_response_minutes": 30,
    "requirements": [],
    "target_audience": [
      "50-200 calisanli",
      "FortiGate + monitoring araclari"
    ],
    "is_self_service": true,
    "requires_admin_approval": false
  },
  {
    "slug": "bundle-soc-noc-pro",
    "label": "AI SOC + NOC Pro",
    "short_description": "7/24 tam yonetilen operasyon — guvenlik ve ag",
    "long_description": "Sanal CISO dahil, 7/24 cift disiplin analist, aylik C-level brifing. Kritik altyapi icin en kapsamli siber guvenlik + ag operasyon paketi.",
    "features": [
      "AI SOC Pro dahil",
      "AI NOC Pro dahil",
      "Sanal CISO dahil",
      "7/24 cift disiplin analist",
      "Ozel SLA anlasmasi",
      "Aylik C-level brifing",
      "%%12 indirim"
    ],
    "how_it_works": [],
    "faq": [],
    "monthly_price_tl": 24900,
    "setup_fee_tl": 0,
    "category": "bundle",
    "icon": "Layers",
    "is_active": true,
    "sort_order": 230,
    "service_type": "monthly",
    "price_tl": 24900,
    "price_tl_annual": 249000,
    "usage_unit": null,
    "setup_time_hours": 24,
    "delivery_time_hours": 0,
    "sla_response_minutes": 15,
    "requirements": [],
    "target_audience": [
      "200+ calisanli",
      "Kritik altyapi yonetimi"
    ],
    "is_self_service": false,
    "requires_admin_approval": true
  }
];

export async function maybeSeedServiceCatalog(): Promise<void> {
  try {
    const [{ value }] = await db.select({ value: count() }).from(serviceCatalogTable);
    if (Number(value) > 0) return;
    logger.info("Service catalog boş — seed başlıyor");
    for (const row of SEED_DATA) {
      await db.insert(serviceCatalogTable).values({
        slug: row.slug,
        label: row.label,
        shortDescription: row.short_description,
        longDescription: row.long_description,
        features: row.features,
        howItWorks: row.how_it_works,
        faq: row.faq,
        monthlyPriceTl: String(row.monthly_price_tl),
        setupFeeTl: String(row.setup_fee_tl),
        category: row.category,
        icon: row.icon,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        serviceType: row.service_type ?? "monthly",
        priceTl: row.price_tl != null ? String(row.price_tl) : null,
        priceTlAnnual: row.price_tl_annual != null ? String(row.price_tl_annual) : null,
        usageUnit: row.usage_unit,
        setupTimeHours: row.setup_time_hours,
        deliveryTimeHours: row.delivery_time_hours,
        slaResponseMinutes: row.sla_response_minutes,
        requirements: row.requirements,
        targetAudience: row.target_audience,
        isSelfService: row.is_self_service,
        requiresAdminApproval: row.requires_admin_approval,
      }).onConflictDoNothing();
    }
    logger.info({ count: SEED_DATA.length }, "Service catalog seed tamamlandı");
  } catch (err) {
    logger.warn({ err }, "Service catalog seed başarısız");
  }
}
