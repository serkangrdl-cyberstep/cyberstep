/**
 * Blog Autopilot — CyberStep.io
 *
 * Pazartesi 09:00 ve Perşembe 09:00'da (İstanbul, UTC+3) bir blog yazısı
 * üretir ve yayınlar. 1 yıllık (104 yazı) içerik planı bu dosyada saklıdır.
 * İlerleme site_settings tablosunda "blog_autopilot_index" anahtarıyla tutulur.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { blogPostsTable, siteSettingsTable, newsletterSubscribersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendNewsletterEmail } from "./email";

// ─── Yardımcı: Türkçe başlıktan URL-safe slug ─────────────────────────────────
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").slice(0, 80)
    + "-" + Date.now().toString(36);
}

// ─── 1 Yıllık İçerik Planı (104 Yazı) ────────────────────────────────────────
// Her yazı için: kategori, başlık, anahtar kelimeler, editorial açı
export const BLOG_PLAN: Array<{
  category: string;
  title: string;
  keywords: string;
  angle: string;
}> = [
  // ── Hafta 1 ──────────────────────────────────────────────────────────────────
  { category: "KVKK & Uyumluluk", title: "KOBİ'ler İçin KVKK'ya Uyum Rehberi: Nereden Başlamalı?", keywords: "KVKK uyum KOBİ, kişisel veri koruma kanunu başlangıç", angle: "5 adımlı pratik başlangıç rehberi, teknik bilgi gerektirmez" },
  { category: "Siber Tehditler", title: "2025'te KOBİ'leri Hedef Alan En Yaygın 5 Siber Saldırı", keywords: "KOBİ siber saldırı 2025, fidye yazılımı phishing istatistik", angle: "Türkiye verilerine dayanan istatistik ve gerçek vaka örnekleri" },
  // ── Hafta 2 ──────────────────────────────────────────────────────────────────
  { category: "Phishing & Sosyal Mühendislik", title: "Phishing Saldırısı Nedir? Çalışanlarınızı Nasıl Korursunuz?", keywords: "phishing nedir, oltalama saldırısı çalışan farkındalığı", angle: "Gerçekten gelen sahte e-posta örnekleriyle açıklama" },
  { category: "Kimlik & Erişim", title: "Güçlü Parola Politikası Nasıl Oluşturulur?", keywords: "güçlü parola politikası, şifre yönetimi KOBİ", angle: "Uygulanabilir şirket içi parola standartları ve araçlar" },
  // ── Hafta 3 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "SPF, DKIM ve DMARC: İşletmenizi Sahte E-postadan Koruyan 3 Yapılandırma", keywords: "SPF DKIM DMARC nedir, e-posta sahteciliği engelleme", angle: "Teknik terimleri sade Türkçeyle anlatan pratik kurulum rehberi" },
  { category: "Fidye Yazılımı", title: "Fidye Yazılımı Saldırısında İlk 24 Saat: Ne Yapmalı, Ne Yapmamalı?", keywords: "fidye yazılımı saldırısı ne yapmalı, ransomware müdahale", angle: "Saldırı anı kriz yönetimi rehberi — saatler kritik" },
  // ── Hafta 4 ──────────────────────────────────────────────────────────────────
  { category: "Kimlik & Erişim", title: "İki Faktörlü Kimlik Doğrulama (2FA) Neden Artık Zorunlu?", keywords: "iki faktörlü doğrulama 2FA MFA KOBİ, hesap güvenliği", angle: "Gerçek ihlal vakaları eşliğinde 2FA'nın kritik önemi" },
  { category: "KVKK & Uyumluluk", title: "KVKK'da Teknik Tedbir Yükümlülüğü: Madde 12 Ne Diyor?", keywords: "KVKK madde 12 teknik tedbir, kişisel veri güvenliği yükümlülük", angle: "Mevzuat metnini KOBİ'ler için pratik adımlara dönüştüren rehber" },
  // ── Hafta 5 ──────────────────────────────────────────────────────────────────
  { category: "Cihaz & Endpoint", title: "Çalışan Dizüstü Güvenliği: Şirket Verilerini Kaybetmeden Uzaktan Çalışmak", keywords: "uzaktan çalışma güvenliği, dizüstü şifrele VPN KOBİ", angle: "Hibrit çalışma modelinde kaçırılan güvenlik açıkları" },
  { category: "Sosyal Mühendislik", title: "CEO Dolandırıcılığı (BEC): Sahte E-postalar Şirketleri Nasıl Soyuyor?", keywords: "CEO dolandırıcılığı BEC saldırısı, iş e-postası ihlali Türkiye", angle: "Türkiye'den gerçek BEC vaka örnekleri ve korunma yöntemleri" },
  // ── Hafta 6 ──────────────────────────────────────────────────────────────────
  { category: "Yedekleme & Kurtarma", title: "3-2-1 Yedekleme Kuralı: Verilerinizi Gerçekten Kurtarabilir misiniz?", keywords: "3-2-1 yedekleme stratejisi, veri yedekleme KOBİ en iyi uygulama", angle: "Yedek almak yetmez — test edilmemiş yedek yoktur" },
  { category: "Yapay Zeka & Siber Güvenlik", title: "Yapay Zeka Siber Saldırılarda Nasıl Kullanılıyor?", keywords: "yapay zeka siber saldırı, AI destekli phishing deepfake tehdit", angle: "2025 tehdit manzarası: saldırganlar AI'yı nasıl silahlandırıyor" },
  // ── Hafta 7 ──────────────────────────────────────────────────────────────────
  { category: "Alan Adı & Web", title: "Alan Adı Güvenlik Skoru Nedir ve Neden Önemlidir?", keywords: "alan adı güvenlik taraması, domain güvenlik skoru nedir", angle: "Domain güvenliğini 5 dakikada ücretsiz nasıl test edersiniz" },
  { category: "Bulut Güvenliği", title: "Microsoft 365 Güvenliği: KOBİ'lerin Gözden Kaçırdığı 7 Ayar", keywords: "Microsoft 365 güvenlik ayarları, Office 365 KOBİ güvenlik", angle: "Varsayılan M365 ayarları yeterli değil — değiştirmeniz gerekenler" },
  // ── Hafta 8 ──────────────────────────────────────────────────────────────────
  { category: "KVKK & Uyumluluk", title: "VERBİS'e Kayıt: Kimler Yükümlü, Nasıl Yapılır?", keywords: "VERBİS kayıt zorunluluğu, kişisel veri envanteri KOBİ", angle: "VERBİS sürecini adım adım anlatan pratik rehber" },
  { category: "Siber Sigorta", title: "Siber Sigorta Nedir? KOBİ'ler İçin Gerekli mi?", keywords: "siber sigorta nedir, KOBİ siber güvenlik sigortası Türkiye", angle: "Siber sigortanın kapsadıkları ve kapsamadıkları" },
  // ── Hafta 9 ──────────────────────────────────────────────────────────────────
  { category: "Fidye Yazılımı", title: "Fidye Ödemeli mi? Siber Uzmanlarının Gerçek Cevabı", keywords: "fidye ödeme ransomware, siber saldırı fidye ne yapmalı", angle: "Fidye ödemenin görünmez maliyetleri ve alternatifleri" },
  { category: "Kimlik & Erişim", title: "Ayrıcalıklı Erişim Yönetimi (PAM): Neden Yönetici Hesabınız Hedef?", keywords: "ayrıcalıklı erişim yönetimi PAM, yönetici hesabı güvenliği KOBİ", angle: "Yönetici yetkilerinin minimize edilmesi neden kritik?" },
  // ── Hafta 10 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "İş E-postanız Kara Listede mi? Kontrol Etme ve Temizleme Rehberi", keywords: "e-posta kara liste spam blacklist, iş e-postası itibar", angle: "E-posta itibarını kaybetmenin nedenleri ve kurtarma yolları" },
  { category: "Sosyal Mühendislik", title: "Smishing ve Vishing: Telefon Üzerinden Gelen Siber Tehditler", keywords: "smishing nedir vishing telefon dolandırıcılığı, SMS phishing", angle: "WhatsApp ve SMS dolandırıcılığına karşı çalışan eğitim rehberi" },
  // ── Hafta 11 ──────────────────────────────────────────────────────────────────
  { category: "Bulut Güvenliği", title: "Google Workspace Güvenliği: KOBİ'ler İçin Kontrol Listesi", keywords: "Google Workspace güvenlik ayarları, Google Drive KOBİ güvenlik", angle: "G Suite güvenlik kontrol listesi ve varsayılan risk ayarları" },
  { category: "KVKK & Uyumluluk", title: "Veri İhlali Olduğunda KVKK'ya 72 Saat İçinde Bildirmeniz Gerekenler", keywords: "KVKK veri ihlali bildirimi, kişisel veri sızıntısı 72 saat", angle: "Veri ihlali anında yapılması gereken hukuki adımlar" },
  // ── Hafta 12 ──────────────────────────────────────────────────────────────────
  { category: "KOBİ Stratejisi", title: "Sıfır Bütçeyle Siber Güvenlik: Ücretsiz Araçlarla Başlangıç", keywords: "ücretsiz siber güvenlik araçları KOBİ, bütçesiz siber güvenlik", angle: "Para harcamadan hemen uygulanabilecek 10 temel önlem" },
  { category: "Alan Adı & Web", title: "SSL Sertifikası Olmayan Web Sitesinin Zararları", keywords: "SSL sertifikası zorunlu mu, HTTPS güvenlik web sitesi KOBİ", angle: "SSL'siz site hem güvensiz hem de Google'da aşağıda" },
  // ── Hafta 13 ──────────────────────────────────────────────────────────────────
  { category: "Yapay Zeka & Siber Güvenlik", title: "ChatGPT ve Copilot Kullanırken Şirket Verileriniz Ne Kadar Güvende?", keywords: "ChatGPT veri güvenliği, yapay zeka kurumsal gizlilik riski", angle: "AI araçlarına verilen kurumsal verilerin gizlilik riskleri" },
  { category: "Cihaz & Endpoint", title: "Kişisel Telefon İş Amaçlı Kullanımı (BYOD): Risk mi, Avantaj mı?", keywords: "BYOD politikası KOBİ, kişisel cihaz iş güvenliği", angle: "BYOD'un görünmez güvenlik açıkları ve yönetim politikası" },
  // ── Hafta 14 ──────────────────────────────────────────────────────────────────
  { category: "Kimlik & Erişim", title: "İşten Ayrılan Çalışan Hesapları: Kapatmazsanız Ne Olur?", keywords: "işten ayrılan çalışan hesap kapatma, offboarding güvenlik riski", angle: "Eski çalışan hesapları en büyük iç tehdit kaynaklarından biri" },
  { category: "Fidye Yazılımı", title: "Fidye Yazılımına Karşı Segmentasyon: Yayılmayı Nasıl Durdurursunuz?", keywords: "ağ segmentasyon fidye yazılımı, ransomware lateral hareket engelleme", angle: "Küçük ağ değişiklikleriyle büyük fidye saldırısını sınırlama" },
  // ── Hafta 15 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "E-posta Arşivleme ve KVKK: Ne Kadar Süre Saklayabilirsiniz?", keywords: "e-posta arşivleme KVKK, iş e-postası saklama süresi", angle: "Hem hukuki hem teknik perspektiften e-posta saklama rehberi" },
  { category: "Sektör: Finans", title: "Finans Sektöründe Siber Güvenlik: Muhasebe Firmaları İçin Zorunlu Önlemler", keywords: "muhasebe bürosu siber güvenlik, finans KOBİ veri koruma", angle: "Banka ve muhasebe verilerini korumanın kritik adımları" },
  // ── Hafta 16 ──────────────────────────────────────────────────────────────────
  { category: "Bulut Güvenliği", title: "Bulut Depolamada Veri Sızıntısı: S3 Bucket Açıklıklarından Ders Çıkarmak", keywords: "bulut depolama veri sızıntısı, AWS S3 açık bucket güvenlik", angle: "Dünya genelinde büyük veri sızıntılarından Türk KOBİ dersleri" },
  { category: "KOBİ Stratejisi", title: "Siber Güvenlik Bütçesi Nasıl Planlanır? CFO'ya Sunulacak Argümanlar", keywords: "siber güvenlik bütçe planlaması, güvenlik yatırımı ROI KOBİ", angle: "Finansal dille yazılmış ROI hesabı ve üst yönetimi ikna etme" },
  // ── Hafta 17 ──────────────────────────────────────────────────────────────────
  { category: "Yapay Zeka & Siber Güvenlik", title: "Deepfake Saldırıları İşletmeleri Nasıl Tehdit Ediyor?", keywords: "deepfake işletme riski, yapay zeka ses video sahteciliği", angle: "Ses ve video deepfake'lerin iş dünyasına yönelik kullanımı" },
  { category: "Alan Adı & Web", title: "WHOIS Gizlilik Koruması Neden Önemlidir?", keywords: "WHOIS gizlilik, alan adı kişisel veri koruma KVKK", angle: "Alan adı kaydında kişisel veri ifşasının riskleri" },
  // ── Hafta 18 ──────────────────────────────────────────────────────────────────
  { category: "Olay Yönetimi", title: "Siber Olay Müdahale Planı: KOBİ'ler İçin Şablon", keywords: "siber olay müdahale planı şablon, incident response KOBİ", angle: "Hemen kullanılabilecek saldırı müdahale planı taslağı" },
  { category: "Phishing & Sosyal Mühendislik", title: "Phishing Simülasyonu Neden Her Şirkette Yapılmalı?", keywords: "phishing simülasyonu çalışan eğitimi, oltalama testi KOBİ", angle: "Test edilmemiş çalışan en büyük güvenlik açığıdır" },
  // ── Hafta 19 ──────────────────────────────────────────────────────────────────
  { category: "KVKK & Uyumluluk", title: "Çalışanların Kişisel Verileri: İşveren Ne Kadar Saklayabilir?", keywords: "çalışan kişisel veri işleme KVKK, işveren veri yükümlülüğü", angle: "İK ve bordro verilerinin KVKK kapsamında sınırları" },
  { category: "Cihaz & Endpoint", title: "Eski İşletim Sistemi Kullanan Şirkete Siber Saldırı Garantisi", keywords: "Windows 10 destek sonu güvenlik, eski işletim sistemi riski KOBİ", angle: "Yamalı olmayan sistemlerin yarattığı somut saldırı yüzeyi" },
  // ── Hafta 20 ──────────────────────────────────────────────────────────────────
  { category: "Tedarik Zinciri", title: "Tedarikçi Güvenliği: Küçük Firmanız Üzerinden Büyük Şirket Nasıl Hackleniyor?", keywords: "tedarik zinciri saldırısı TPRM, küçük firma hack büyük şirket", angle: "Supply chain saldırılarında KOBİ'ler bilinçsiz araç haline geliyor" },
  { category: "Yapay Zeka & Siber Güvenlik", title: "AI Destekli Siber Güvenlik Araçları: KOBİ'ler Kullanabilir mi?", keywords: "AI siber güvenlik araçları KOBİ, yapay zeka güvenlik çözümleri", angle: "AI tabanlı güvenlik araçlarının maliyet-fayda analizi" },
  // ── Hafta 21 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "Microsoft 365 Anti-Spam Ayarları: Varsayılan Neden Yeterli Değil?", keywords: "Microsoft 365 anti-spam, Office 365 e-posta güvenlik politikası", angle: "M365'in varsayılan spam filtrelerinin atlanan önemli açıkları" },
  { category: "KOBİ Stratejisi", title: "Siber Güvenlik Sorumlusu Olmayan KOBİ'ler Ne Yapmalı?", keywords: "CISO olmayan KOBİ, siber güvenlik sorumlusu olmadan yönetim", angle: "CISO'suz küçük firmalarda güvenlik sorumluluğunu kimin taşıdığı" },
  // ── Hafta 22 ──────────────────────────────────────────────────────────────────
  { category: "Sektör: Sağlık", title: "Klinik ve Hastanelerde Siber Güvenlik: Hasta Verisi Neden Yüksek Risk?", keywords: "hastane klinik siber güvenlik, hasta verisi KVKK sağlık sektörü", angle: "Sağlık verilerinin kara borsadaki değeri ve koruma yöntemleri" },
  { category: "Kimlik & Erişim", title: "Parola Yöneticisi Nedir? Şirketinizde Nasıl Kullanılır?", keywords: "parola yöneticisi kurumsal, password manager KOBİ uygulama", angle: "Ücretsiz ve ücretli en iyi kurumsal parola yöneticileri karşılaştırması" },
  // ── Hafta 23 ──────────────────────────────────────────────────────────────────
  { category: "Bulut Güvenliği", title: "SaaS Uygulamalarını Güvenle Kullanmak: Riskli Entegrasyonlardan Kaçınmak", keywords: "SaaS güvenlik riski, üçüncü taraf uygulama entegrasyon tehlikesi", angle: "Her SaaS'a verilen izin şirket verilerinize açık kapı olabilir" },
  { category: "Fidye Yazılımı", title: "Fidye Yazılımının Görünmez Maliyeti: Ödenen Fidyeden Fazlası", keywords: "fidye yazılımı toplam maliyet, ransomware gerçek zarar hesabı", angle: "Sigorta, itibar kaybı, yasal ceza dahil gerçek maliyet tablosu" },
  // ── Hafta 24 ──────────────────────────────────────────────────────────────────
  { category: "Alan Adı & Web", title: "Web Sitenizdeki Zararlı Kod: Nasıl Anlar, Nasıl Temizlersiniz?", keywords: "web sitesi zararlı kod tespiti, site hack temizleme KOBİ", angle: "Hacklenmiş web sitesinin işaretleri ve hızlı müdahale adımları" },
  { category: "KVKK & Uyumluluk", title: "Çerez Politikası KVKK'ya Uygun mu? Web Sitenizi Kontrol Edin", keywords: "çerez politikası KVKK uyum, cookie consent web sitesi", angle: "Türkiye'deki web siteleri için yasal çerez yönetimi rehberi" },
  // ── Hafta 25 ──────────────────────────────────────────────────────────────────
  { category: "Yapay Zeka & Siber Güvenlik", title: "Yapay Zeka ile Üretilen Sahte Belgeler: İşletmeleri Tehdit Eden Yeni Dolandırıcılık", keywords: "yapay zeka sahte belge, AI üretilmiş fatura kimlik dolandırıcılık", angle: "AI ile üretilen sahte evrak dolandırıcılığını tanıma rehberi" },
  { category: "Cihaz & Endpoint", title: "USB Bellekle Gelen Tehlike: Şirket Cihazlarında Fiziksel Güvenlik", keywords: "USB güvenlik tehdidi, şirket fiziksel güvenlik politikası", angle: "Fiziksel erişim kontrolünün ihmal edilen boyutu" },
  // ── Hafta 26 ──────────────────────────────────────────────────────────────────
  { category: "Olay Yönetimi", title: "Siber Saldırı Sonrası Müşterilere Ne Söylenmeli? Kriz İletişimi Rehberi", keywords: "siber saldırı kriz iletişimi, müşteri bilgilendirme veri ihlali", angle: "Şeffaflık mı, sessizlik mi? Veri ihlali sonrası doğru iletişim" },
  { category: "KOBİ Stratejisi", title: "Siber Güvenlik Olgunluk Modeli: Şirketiniz Hangi Seviyede?", keywords: "siber güvenlik olgunluk seviyesi KOBİ, CMMI güvenlik değerlendirme", angle: "5 seviyeli olgunluk modeli üzerinden kendinizi değerlendirin" },
  // ── Hafta 27 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "E-posta Şifreleme: Hassas İş Yazışmalarını Nasıl Korursunuz?", keywords: "e-posta şifreleme KOBİ, S/MIME PGP iş yazışması güvenlik", angle: "Kritik belgeleri e-postayla güvenle göndermenin pratik yolları" },
  { category: "Phishing & Sosyal Mühendislik", title: "LinkedIn'deki Sahte İş Teklifleri: Kurumsal Casusluk mu?", keywords: "LinkedIn sahte iş teklifi siber tehdit, sosyal mühendislik sosyal medya", angle: "Sosyal medya üzerinden hedefli sosyal mühendislik saldırıları" },
  // ── Hafta 28 ──────────────────────────────────────────────────────────────────
  { category: "Sektör: E-ticaret", title: "E-ticaret Sitesi Güvenliği: Müşteri Kart Bilgilerini Koruma", keywords: "e-ticaret güvenlik PCI DSS, kart bilgisi koruma online mağaza", angle: "Küçük e-ticaret sitelerinin sıklıkla ihmal ettiği PCI DSS zorunlulukları" },
  { category: "Bulut Güvenliği", title: "Yanlış Yapılandırılmış Bulut: En Yaygın Veri Sızıntısı Nedeni", keywords: "bulut yanlış yapılandırma veri sızıntısı, cloud misconfiguration güvenlik", angle: "Küçük bir ayar hatası büyük veri ihlallerine nasıl yol açıyor?" },
  // ── Hafta 29 ──────────────────────────────────────────────────────────────────
  { category: "Kimlik & Erişim", title: "Sıfır Güven Mimarisi (Zero Trust): KOBİ'ler İçin Gerçekçi mi?", keywords: "sıfır güven mimarisi zero trust KOBİ, VPN alternatifi güvenlik", angle: "Zero Trust'ın KOBİ ölçeğinde uygulanabilir küçük adımları" },
  { category: "KVKK & Uyumluluk", title: "Muhasebe ve Finans Verilerinin KVKK Kapsamında Korunması", keywords: "muhasebe verisi KVKK, bordro finansal veri kişisel bilgi koruma", angle: "Finans departmanlarının gözden kaçırdığı KVKK yükümlülükleri" },
  // ── Hafta 30 ──────────────────────────────────────────────────────────────────
  { category: "Fidye Yazılımı", title: "RaaS (Hizmet Olarak Fidye Yazılımı): Artık Herkes Saldırgan", keywords: "RaaS hizmet olarak fidye yazılımı, ransomware as a service tehdit", angle: "Teknik bilgisi olmayan kişilerin bile saldırı başlatabildği karanlık pazar" },
  { category: "Yapay Zeka & Siber Güvenlik", title: "AI ile Otomatik Güvenlik Taraması: Küçük Firmalar Nasıl Yararlanır?", keywords: "otomatik güvenlik taraması yapay zeka, AI vulnerability scanner KOBİ", angle: "AI destekli ücretsiz veya uygun fiyatlı güvenlik tarama araçları" },
  // ── Hafta 31 ──────────────────────────────────────────────────────────────────
  { category: "Alan Adı & Web", title: "Subdomain Takeovers: Alan Adı Ele Geçirme Saldırıları Nasıl Çalışır?", keywords: "subdomain takeover saldırısı, alt alan adı güvenlik açığı", angle: "Terk edilmiş alt alan adlarının nasıl saldırı aracına dönüştüğü" },
  { category: "KOBİ Stratejisi", title: "Siber Güvenlik Eğitimi ROI'si: Çalışan Farkındalığı Ne Kadar Değer?", keywords: "siber güvenlik farkındalık eğitimi ROI, çalışan eğitim yatırım getirisi", angle: "Eğitimli çalışanın kaçırdığı saldırının parasal değeri" },
  // ── Hafta 32 ──────────────────────────────────────────────────────────────────
  { category: "Cihaz & Endpoint", title: "Antivirüs Yeter mi? 2025'te Endpoint Güvenliğinin Gerçeği", keywords: "antivirüs yeterli mi, EDR endpoint detection KOBİ güvenlik", angle: "Klasik antivirüsün sınırları ve modern EDR'ın farkı" },
  { category: "Sosyal Mühendislik", title: "Sahte Teknik Destek Dolandırıcılığı: 'Microsoft'tan Aranıyorum' Diyenlere Dikkat", keywords: "sahte teknik destek Microsoft dolandırıcılığı, tech support scam Türkiye", angle: "Türkiye'de yaygınlaşan sahte destek dolandırıcılığına karşı rehber" },
  // ── Hafta 33 ──────────────────────────────────────────────────────────────────
  { category: "Bulut Güvenliği", title: "Cloud-Native Uygulama Güvenliği: DevOps Ekiplerinin Atlayamaçağı Adımlar", keywords: "cloud native uygulama güvenliği, DevSecOps KOBİ geliştirme", angle: "Yazılım geliştiren KOBİ'ler için güvenli DevOps pratikleri" },
  { category: "KVKK & Uyumluluk", title: "KVKK Para Cezaları 2025: En Yüksek Cezaları Alan Sektörler", keywords: "KVKK para cezası 2025, kişisel veri ihlal ceza Türkiye", angle: "KVKK Kurulu'nun son kararları ve KOBİ'ler için çıkarılacak dersler" },
  // ── Hafta 34 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "Bülten Gönderiminde KVKK: Açık Rıza Olmadan Pazarlama Yasak mı?", keywords: "e-posta pazarlama KVKK onayı, bülten açık rıza zorunluluğu", angle: "E-posta pazarlamanın yasal sınırlarını bilmeden abone toplanmaz" },
  { category: "Fidye Yazılımı", title: "Fidye Yazılımına Karşı En Etkili 5 Teknik Önlem", keywords: "fidye yazılımı teknik önlem, ransomware korunma yöntemi KOBİ", angle: "Uygulanabilirlik sıralamasıyla beş teknik önlem ve maliyet tahmini" },
  // ── Hafta 35 ──────────────────────────────────────────────────────────────────
  { category: "Sektör: Üretim", title: "OT/ICS Güvenliği: Üretim Tesislerinde Siber Tehditler", keywords: "OT ICS güvenlik üretim tesis, endüstriyel kontrol sistemi siber tehdit", angle: "Fabrika otomasyon sistemlerini hedef alan siber saldırılar" },
  { category: "Yapay Zeka & Siber Güvenlik", title: "Büyük Dil Modeli Güvenliği: Şirket Verisi Prompt'a Yazıldığında Ne Olur?", keywords: "LLM veri güvenliği, prompt injection kurumsal yapay zeka riski", angle: "Çalışanların AI araçlarına veri girmesinin görünmez riskleri" },
  // ── Hafta 36 ──────────────────────────────────────────────────────────────────
  { category: "KOBİ Stratejisi", title: "Siber Güvenlik Risk Yönetimi: KOBİ'ler İçin 5 Adımlı Çerçeve", keywords: "siber güvenlik risk yönetimi çerçeve, risk analizi KOBİ metodoloji", angle: "NIST ve ISO 27001'den ilham alan basitleştirilmiş risk çerçevesi" },
  { category: "Kimlik & Erişim", title: "LDAP ve Active Directory Güvenliği: Şirket Ağınızın Kalbi", keywords: "Active Directory güvenlik, LDAP saldırısı KOBİ ağ güvenliği", angle: "AD ihlallerinin şirket geneline nasıl yayıldığı" },
  // ── Hafta 37 ──────────────────────────────────────────────────────────────────
  { category: "Alan Adı & Web", title: "HTTPS Bile Yetmez: Web Uygulama Güvenliğinin Görünmez Açıkları", keywords: "web uygulama güvenliği OWASP, XSS CSRF SQL injection KOBİ", angle: "OWASP Top 10'dan Türk KOBİ'lere en çok dokunan 3 açık" },
  { category: "Olay Yönetimi", title: "Siber Saldırı Tatbikatı: Masa Başı Alıştırması Nasıl Yapılır?", keywords: "siber tatbikat masa başı alıştırma, tabletop exercise KOBİ güvenlik", angle: "Saldırı olmadan önce saldırıyı deneyimlemek" },
  // ── Hafta 38 ──────────────────────────────────────────────────────────────────
  { category: "Phishing & Sosyal Mühendislik", title: "QR Kod Phishinge (Quishing) Dikkat: Yeni Nesil Tuzak", keywords: "QR kod phishing quishing, karekod dolandırıcılığı tehdit", angle: "QR kodların phishing vektörü olarak artan kullanımı" },
  { category: "Bulut Güvenliği", title: "CASB Nedir? Bulut Uygulamalarını Kurumsal Düzeyde Denetleme", keywords: "CASB bulut erişim güvenlik, cloud application security broker KOBİ", angle: "KOBİ'ler için CASB'ın ne olduğu ve neden ihtiyaç duyulduğu" },
  // ── Hafta 39 ──────────────────────────────────────────────────────────────────
  { category: "KVKK & Uyumluluk", title: "Kişisel Veri Envanteri Nedir ve Nasıl Oluşturulur?", keywords: "kişisel veri envanteri oluşturma, data mapping KVKK", angle: "İlk veri envanterini üç adımda çıkarmak" },
  { category: "Cihaz & Endpoint", title: "Mobil Cihaz Yönetimi (MDM): KOBİ'ler Neden Kullanmalı?", keywords: "MDM mobil cihaz yönetimi KOBİ, mobil güvenlik politikası", angle: "Telefon ve tablet güvenliğini merkezi yönetmenin pratik yolları" },
  // ── Hafta 40 ──────────────────────────────────────────────────────────────────
  { category: "Yapay Zeka & Siber Güvenlik", title: "AI Destekli SIEM: Küçük Firmalarda Güvenlik Olayı Tespiti", keywords: "SIEM KOBİ yapay zeka, güvenlik olayı tespiti küçük firma", angle: "Büyük şirketlerin güvenlik araçlarının KOBİ'ye uyarlanmış versiyonları" },
  { category: "KOBİ Stratejisi", title: "İş Sürekliliği Planı (BCP): Siber Saldırıya Rağmen Çalışmak", keywords: "iş sürekliliği planı siber saldırı, BCP disaster recovery KOBİ", angle: "Küçük şirketlerde iş sürekliliği planı yapmanın pratik yolu" },
  // ── Hafta 41 ──────────────────────────────────────────────────────────────────
  { category: "E-posta Güvenliği", title: "Outlook ve Gmail'de Güvenli E-posta Alışkanlıkları", keywords: "e-posta güvenli kullanım Outlook Gmail, kurum içi güvenlik alışkanlık", angle: "Her çalışanın bilmesi gereken 7 e-posta güvenlik kuralı" },
  { category: "Tedarik Zinciri", title: "Yazılım Tedarik Zinciri Güvenliği: SolarWinds'ten Öğrenilenler", keywords: "yazılım tedarik zinciri güvenlik, software supply chain saldırısı ders", angle: "Büyük yazılım saldırılarından KOBİ'ler için çıkarılabilecek dersler" },
  // ── Hafta 42 ──────────────────────────────────────────────────────────────────
  { category: "Sektör: Lojistik", title: "Lojistik Firmalarda Veri Güvenliği: Müşteri Teslimat Bilgisi Kime Açık?", keywords: "lojistik firma siber güvenlik, kargo müşteri veri KVKK", angle: "Lojistik sektöründe müşteri ve taşıma verisinin korunması" },
  { category: "Fidye Yazılımı", title: "Sağlık Sektörü Fidye Yazılımı Hedefinde: Klinikler Nasıl Korunuyor?", keywords: "sağlık fidye yazılımı, hastane ransomware korunma yöntemi", angle: "Sağlık sektörü verilerinin neden bu kadar değerli olduğu" },
  // ── Hafta 43 ──────────────────────────────────────────────────────────────────
  { category: "Kimlik & Erişim", title: "Biyometrik Kimlik Doğrulama: Güvenli mi, Riskli mi?", keywords: "biyometrik kimlik doğrulama güvenlik, parmak izi yüz tanıma iş hayatı", angle: "Biyometrik sistemlerin güvenlik avantajları ve gizlilik riskleri" },
  { category: "Alan Adı & Web", title: "DNS Hijacking: Alan Adınız Ele Geçirilirse Ne Olur?", keywords: "DNS hijacking alan adı çalınması, domain güvenlik tehdit", angle: "DNS manipülasyonuyla müşterileriniz nasıl sahte sitelere yönlendirilir" },
  // ── Hafta 44 ──────────────────────────────────────────────────────────────────
  { category: "Bulut Güvenliği", title: "Hybrid Cloud Güvenliği: Yerinde ve Bulut Sistemlerin Bir Arada Güvenliği", keywords: "hybrid cloud güvenlik, karma bulut altyapı KOBİ güvenlik yönetimi", angle: "İki dünya arasındaki güvenlik boşluklarını kapatmak" },
  { category: "KVKK & Uyumluluk", title: "Çocuklara Ait Kişisel Veri: Eğitim Sektöründe KVKK Yükümlülükleri", keywords: "çocuk kişisel veri KVKK, eğitim kurumu veri işleme zorunlulukları", angle: "Okul ve kursların öğrenci verisi işlemede dikkat etmesi gerekenler" },
  // ── Hafta 45 ──────────────────────────────────────────────────────────────────
  { category: "Yapay Zeka & Siber Güvenlik", title: "Adversarial AI: Saldırganlar Yapay Zeka Savunmalarını Nasıl Aldatıyor?", keywords: "adversarial AI saldırı, yapay zeka savunma aldatma siber güvenlik", angle: "AI güvenlik araçlarının kör noktaları ve yeni nesil atlatma yöntemleri" },
  { category: "KOBİ Stratejisi", title: "Siber Güvenlik Sigortası Tazminat Almak: Şirketlerin Bilmediği Şartlar", keywords: "siber sigorta tazminat şartları, siber güvenlik poliçe reddi", angle: "Sigorta şirketlerinin tazminatı reddettiği yaygın durumlar" },
  // ── Hafta 46 ──────────────────────────────────────────────────────────────────
  { category: "Phishing & Sosyal Mühendislik", title: "Spear Phishing: Sizi Tanıyan Saldırı", keywords: "spear phishing hedefli oltalama, kişiselleştirilmiş phishing saldırısı", angle: "Sosyal medyadan toplanan verilerle kişiselleştirilmiş saldırılar" },
  { category: "Cihaz & Endpoint", title: "Yazıcı ve IoT Cihazları: Ağınızdaki Görünmez Tehdit", keywords: "yazıcı güvenlik açığı IoT siber tehdit, ağ IoT cihaz güvenlik", angle: "Ağa bağlı 'küçük' cihazların nasıl büyük saldırılara kapı araladığı" },
  // ── Hafta 47 ──────────────────────────────────────────────────────────────────
  { category: "Olay Yönetimi", title: "Dijital Adli Analiz: Saldırı Sonrası Ne Kadar Geriye Bakabilirsiniz?", keywords: "dijital adli analiz, siber saldırı sonrası delil toplama log", angle: "Log tutmayan şirket saldırıyı ispat edemez" },
  { category: "E-posta Güvenliği", title: "E-posta Hesabınız Ele Geçirildiyse: Anında Yapmanız Gereken 8 Adım", keywords: "e-posta hesabı ele geçirildi, email hack müdahale adımları", angle: "Panik olmadan, hızlı ve sistematik müdahale rehberi" },
  // ── Hafta 48 ──────────────────────────────────────────────────────────────────
  { category: "Sektör: Turizm", title: "Otel ve Turizm Firmalarında Müşteri Verisi Güvenliği", keywords: "otel müşteri veri güvenliği, turizm KVKK kişisel bilgi koruma", angle: "Turizm sektöründe rezervasyon ve ödeme verilerinin korunması" },
  { category: "Bulut Güvenliği", title: "Buluta Geçerken Neleri Taşımamalısınız? Hassas Veri Sınıflandırma", keywords: "buluta geçiş hassas veri, cloud migration güvenlik sınıflandırma", angle: "Tüm veriler buluta gitmez — sınıflandırma yapmak zorunlu" },
  // ── Hafta 49 ──────────────────────────────────────────────────────────────────
  { category: "Yapay Zeka & Siber Güvenlik", title: "Yapay Zeka ile Tehdit İstihbaratı: Proaktif Savunma Mümkün mü?", keywords: "yapay zeka tehdit istihbaratı, AI threat intelligence KOBİ", angle: "Gelecekteki saldırıları tahmin eden AI araçları gerçekten çalışıyor mu?" },
  { category: "KVKK & Uyumluluk", title: "Yıllık KVKK Denetimi: Şirketinizin Uyum Durumunu Gözden Geçirin", keywords: "yıllık KVKK denetim kontrol listesi, kişisel veri uyum gözden geçirme", angle: "Yıl sonu KVKK kontrol listesi ve eksik kalan yükümlülükler" },
  // ── Hafta 50 ──────────────────────────────────────────────────────────────────
  { category: "KOBİ Stratejisi", title: "2025 Siber Güvenlik Trendleri: KOBİ'ler Ne Beklemeli?", keywords: "2025 siber güvenlik trendleri, KOBİ gelecek tehditler öngörü", angle: "2025'te KOBİ'leri en çok etkileyecek 5 siber güvenlik trendi" },
  { category: "Fidye Yazılımı", title: "Çift Gasp (Double Extortion) Saldırısı: Hem Şifreleme Hem Sızıntı", keywords: "çift gasp ransomware, double extortion siber saldırı tehdit", angle: "Fidye ödesen de veriler sızdırılabiliyor — yeni nesil şantaj" },
  // ── Hafta 51 ──────────────────────────────────────────────────────────────────
  { category: "Alan Adı & Web", title: "Typosquatting: Şirket Adınıza Benzer Sahte Alan Adları", keywords: "typosquatting sahte alan adı, marka koruma domain siber tehdit", angle: "Rakipler ve dolandırıcılar marka adınızı nasıl kullanıyor?" },
  { category: "Kimlik & Erişim", title: "Kimlik Sahtekarlığı (Identity Theft): Kurumsal Boyutu ve Korunma Yolları", keywords: "kimlik sahtekarlığı kurumsal, identity theft şirket güvenlik", angle: "Kurumsal kimlik hırsızlığının görünmez boyutları" },
  // ── Hafta 52 ──────────────────────────────────────────────────────────────────
  { category: "Olay Yönetimi", title: "Siber Güvenlik Yılı Kapanırken: Şirketinizin 2025 Güvenlik Değerlendirmesi", keywords: "yıllık siber güvenlik değerlendirme, 2025 güvenlik raporu KOBİ özeti", angle: "Yıl sonu kapsamlı güvenlik değerlendirme rehberi" },
  { category: "KOBİ Stratejisi", title: "Yeni Yılda Güvenli Başlangıç: KOBİ'ler İçin Siber Güvenlik Çözümü Yol Haritası", keywords: "yeni yıl siber güvenlik planı, KOBİ güvenlik yol haritası 2026", angle: "Gelecek yıl için siber güvenlik önceliklerini belirleme rehberi" },
];

// ─── Site Settings'ten mevcut indeksi oku ─────────────────────────────────────
async function getAutopilotIndex(): Promise<number> {
  const [row] = await db.select().from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, "blog_autopilot_index"));
  return row ? Math.max(0, parseInt(row.value, 10) || 0) : 0;
}

async function setAutopilotIndex(index: number): Promise<void> {
  await db.insert(siteSettingsTable)
    .values({ key: "blog_autopilot_index", value: String(index), updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(index), updatedAt: new Date() } });
}

// ─── Claude ile blog yazısı üret ─────────────────────────────────────────────
async function generateBlogPostContent(topic: typeof BLOG_PLAN[number]): Promise<{
  title: string; slug: string; excerpt: string; content: string;
  seoTitle: string; metaDescription: string; focusKeyword: string;
  seoTags: string[]; socialTextTr: string;
}> {
  const prompt = `Sen CyberStep.io için içerik üreten bir siber güvenlik uzmanı ve blog yazarısın.
CyberStep.io, Türk KOBİ'leri (küçük ve orta büyüklükteki işletmeler) için Türkçe siber güvenlik risk analizi platformudur.

Aşağıdaki konuda SEO uyumlu, Türkçe bir blog yazısı üret:

Başlık: ${topic.title}
Kategori: ${topic.category}
Anahtar Kelimeler: ${topic.keywords}
Editorial Açı: ${topic.angle}

YAZIM KURALLARI:
- Hedef okuyucu: Teknik olmayan KOBİ yöneticileri ve işletme sahipleri
- Dil: Profesyonel ama anlaşılır Türkçe, jargon varsa açıkla
- Uzunluk: 900-1200 kelime
- Format: Başlıklar h2/h3 HTML etiketiyle, listeler ul/li ile
- Giriş: Dikkat çekici, gerçek bir problem veya istatistikle başla
- Sonuç: Somut aksiyona çağrı (CTA) içermeli
- Emoji kullanma
- CyberStep.io'yu yazar olarak sunma — sadece içerik üret

ÇIKTI FORMATI: Aşağıdaki JSON formatında yanıt ver (başka hiçbir şey yazma):
{
  "title": "Türkçe başlık (60 karakteri geçme)",
  "excerpt": "160 karakterlik özet paragraf",
  "content": "<article>HTML formatında tam makale içeriği</article>",
  "seoTitle": "SEO başlığı (60 karakter)",
  "metaDescription": "Meta açıklama (155-160 karakter)",
  "focusKeyword": "Ana anahtar kelime",
  "seoTags": ["etiket1", "etiket2", "etiket3", "etiket4", "etiket5"],
  "socialTextTr": "LinkedIn paylaşımı için 3-4 cümle (280 karakter)"
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  const raw = block?.type === "text" ? block.text.trim() : "";

  // JSON bloğunu çıkar (markdown code block varsa temizle)
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(jsonStr) as {
    title: string; excerpt: string; content: string;
    seoTitle: string; metaDescription: string; focusKeyword: string;
    seoTags: string[]; socialTextTr: string;
  };

  return {
    ...parsed,
    slug: toSlug(parsed.title || topic.title),
  };
}

// ─── Ana fonksiyon: Sıradaki yazıyı üret ve yayınla ─────────────────────────
export async function generateAndPublishBlogPost(): Promise<void> {
  const index = await getAutopilotIndex();
  const total = BLOG_PLAN.length;

  if (index >= total) {
    logger.info({ index, total }, "Blog autopilot: tüm plan tamamlandı, baştan başlanıyor");
    await setAutopilotIndex(0);
  }

  const currentIndex = index >= total ? 0 : index;
  const topic = BLOG_PLAN[currentIndex];

  logger.info({ index: currentIndex, title: topic.title }, "Blog autopilot: yazı üretiliyor");

  const generated = await generateBlogPostContent(topic);

  // Veritabanına kaydet ve yayınla
  const [post] = await db.insert(blogPostsTable).values({
    title: generated.title,
    slug: generated.slug,
    excerpt: generated.excerpt,
    content: generated.content,
    authorName: "CyberStep.io",
    status: "published",
    publishedAt: new Date(),
    seoTitle: generated.seoTitle,
    metaDescription: generated.metaDescription,
    focusKeyword: generated.focusKeyword,
    seoTags: generated.seoTags,
    socialTextTr: generated.socialTextTr,
  }).returning();

  logger.info({ postId: post.id, slug: post.slug, title: post.title }, "Blog autopilot: yazı yayınlandı");

  // Bülten abonelerine gönder
  void (async () => {
    try {
      const subscribers = await db.select()
        .from(newsletterSubscribersTable)
        .where(eq(newsletterSubscribersTable.isActive, true));
      if (subscribers.length > 0) {
        await sendNewsletterEmail({ post, subscribers });
        logger.info({ postId: post.id, count: subscribers.length }, "Blog autopilot: bülten gönderildi");
      }
    } catch (err) {
      logger.warn({ err, postId: post.id }, "Blog autopilot: bülten gönderilemedi");
    }
  })();

  // Sonraki indekse ilerle
  await setAutopilotIndex(currentIndex + 1);
}

// ─── Admin durum bilgisi ──────────────────────────────────────────────────────
export async function getBlogAutopilotStatus() {
  const index = await getAutopilotIndex();
  const safeIndex = Math.min(index, BLOG_PLAN.length - 1);
  const nextTopic = BLOG_PLAN[safeIndex];
  const [lastPost] = await db.select({
    id: blogPostsTable.id,
    title: blogPostsTable.title,
    publishedAt: blogPostsTable.publishedAt,
  }).from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(blogPostsTable.publishedAt)
    .limit(1);

  return {
    totalPlanned: BLOG_PLAN.length,
    currentIndex: index,
    completedCount: Math.min(index, BLOG_PLAN.length),
    weeksCompleted: Math.floor(Math.min(index, BLOG_PLAN.length) / 2),
    nextTopic: {
      index: safeIndex,
      category: nextTopic.category,
      title: nextTopic.title,
    },
    lastPublished: lastPost ?? null,
  };
}
