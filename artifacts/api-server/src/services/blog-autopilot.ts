/**
 * Blog Autopilot — CyberStep.io
 *
 * Pazartesi 09:00 ve Perşembe 09:00'da (İstanbul, UTC+3) bir blog yazısı
 * üretir ve yayınlar. 1 yıllık (104 yazı) içerik planı bu dosyada saklıdır.
 * İlerleme site_settings tablosunda "blog_autopilot_index" anahtarıyla tutulur.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { blogPostsTable, blogContentCalendarTable, siteSettingsTable, newsletterSubscribersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendNewsletterEmail } from "./email";
import { logAiCost } from "./aiCostTracker";

interface CarouselSlide { slide: number; text: string; }
interface VisualPrompts { blog: string; linkedin: string; instagram: string; x: string; }

// ─── Yardımcı: Türkçe başlıktan URL-safe slug (benzersiz) ─────────────────────
async function toSlugUnique(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").slice(0, 80);

  let candidate = base;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: blogPostsTable.id })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
    if (suffix > 99) return `${base}-${Date.now().toString(36)}`;
  }
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

// ─── Kategori kodu çıkar ──────────────────────────────────────────────────────
const VALID_CODES = new Set<string>(["FA", "RE", "SE", "DU", "CO"]);

function getCategoryCode(category: string): "FA" | "RE" | "SE" | "DU" | "CO" {
  if (VALID_CODES.has(category)) return category as "FA" | "RE" | "SE" | "DU" | "CO";
  if (category.startsWith("Sektör:")) return "SE";
  if (category === "KVKK & Uyumluluk") return "DU";
  const faCategories = [
    "Siber Tehditler", "Phishing & Sosyal Mühendislik", "Sosyal Mühendislik",
    "Yapay Zeka & Siber Güvenlik", "Fidye Yazılımı", "Tedarik Zinciri",
  ];
  if (faCategories.includes(category)) return "FA";
  return "RE";
}

// ─── Kategori bazlı prompt varyantları ────────────────────────────────────────
const CATEGORY_VARIANTS: Record<"FA" | "RE" | "SE" | "DU" | "CO", string> = {
  FA: `KATEGORİ MODU — FARKINDALIK (FA):
- Bu yazı geniş kitleye ulaşmayı hedefliyor. Paylaşılabilir olmalı.
- İlk paragrafta şaşırtıcı istatistik veya gerçek senaryo kullan. "Bu benim başıma da gelebilir" hissi yarat.
- Teknik çözüm yerine risk bilinci ön planda.
- Başlık formatı: Rakam + Tehdit + Ülke/Sektör (örn: "Türkiye'de 2025'te X Şirket Hacklenişi: Nasıl Oluyor?")
- Son bölüm: "Kendinizi Test Edin" CTA ile bitir.`,

  RE: `KATEGORİ MODU — REHBERLİK (RE):
- Okuyucu bu yazıyı okuduktan sonra bir şeyi yapabilir olmalı.
- Numaralı adım listesi kullan (en az 5, en fazla 10 adım).
- Her adım: Ne yapılır + Neden önemli (kısa). Markdown tablo veya kontrol listesiyle bitir.
- Başlık formatı: Sayı + "Adımda/Yolda" + Sonuç (örn: "5 Adımda KVKK Uyum Kontrolü")
- CyberStep araçları adım içinde doğal yer bulsun.`,

  SE: `KATEGORİ MODU — SEKTÖREL (SE):
- Bu sektörün kendine özgü düzenleyici yükümlülüklerini dahil et.
  E-ticaret: KVKK + PCI-DSS. Sağlık: KVKK + Sağlık Bakanlığı tebliği. Finans: BDDK + KVKK.
- Sektöre özel anonim senaryo veya örnek kullan.
- "Bu sektörde en yaygın 3 güvenlik açığı" bölümü zorunlu.
- Başlık formatı: Sektör + Problem + Çözüm sinyali.
- CyberStep sektörel kıyaslama sayfasına (/sektorel-kiyaslama) yönlendirme ekle.`,

  DU: `KATEGORİ MODU — DÜZENLEYİCİ/UYUM (DU):
- Ceza, mevzuat, zorunluluk odaklı yaz. Somut TL ceza miktarları ver (mümkünse gerçek KVK Kurulu kararlarından [DOĞRULA]).
- "Bu uyumu sağlamazsanız ne olur?" bölümü zorunlu.
- Aciliyet hissi yarat ama paniğe sevk etme.
- Başlık formatı: Rakam veya acil soru formatı.
- Son bölüm: spesifik aksiyon adımı + CyberStep assessment CTA.`,

  CO: `KATEGORİ MODU — CONVERSION (CO):
- Bu yazının amacı okuyucuyu CyberStep'e yönlendirmek.
- Problem-Çözüm-Sonuç yapısı kullan. Somut ROI rakamı ver.
- CTA yazı boyunca 3 kez, farklı formatlarda:
  1. Ortada: Ücretsiz araç dene. 2. Alt bölümde: Mini değerlendirme başlat. 3. Son: Tam değerlendirme.
- Başlık formatı: Fayda + Hedef Kitle + Çerçeve.`,
};

// ─── Master Blog Prompt ile içerik üret ───────────────────────────────────────
interface GeneratedContent {
  title: string; slug: string; excerpt: string; content: string;
  seoTitle: string; metaDescription: string; focusKeyword: string; seoTags: string[];
  linkedinPostTr: string;
  instagramCaptionTr: string;
  instagramCarouselTr: CarouselSlide[];
  socialTextTr: string;
  visualPromptsTr: VisualPrompts;
}

async function generateBlogPostContent(topic: typeof BLOG_PLAN[number]): Promise<GeneratedContent> {
  const categoryCode = getCategoryCode(topic.category);
  const categoryVariant = CATEGORY_VARIANTS[categoryCode];
  const focusKeyword = topic.keywords.split(",")[0].trim();

  const prompt = `Sen CyberStep.io adlı Türk siber güvenlik platformunun içerik direktörüsün.
Türkiye'deki işletme sahiplerine, IT yöneticilerine ve KVKK danışmanlarına yönelik blog yazıları üretiyorsun.

═══════════════════════════════════════════
YAZI PARAMETRELERİ
═══════════════════════════════════════════

KONU BAŞLIĞI: ${topic.title}
KATEGORİ: ${topic.category} [${categoryCode}]
SEO ODAK KELİMESİ: ${focusKeyword}
İKİNCİL ANAHTAR KELİMELER: ${topic.keywords}
EDİTORYAL AÇI: ${topic.angle}

═══════════════════════════════════════════
${categoryVariant}

═══════════════════════════════════════════
GENEL YAZIM KURALLARI — BUNLARI ASLA İHLAL ETME
═══════════════════════════════════════════

TON VE DİL:
- Hedef okuyucu teknik bilgisi olmayan işletme sahibi.
  "Saldırı yüzey alanı" değil "açık kapılar"; "exploit" değil "açık"; "authentication" değil "kimlik doğrulama".
- Samimi ama profesyonel. Patrona danışmanlık veren biri gibi konuş.
- Aktif çatı kullan. "Yapılabilir" değil "Yapın".
- Emoji kullanma.

RAKAMLAR VE İSTATİSTİKLER:
- İstatistik kullandığında MUTLAKA [DOĞRULA: kaynak adı] etiketi ekle.
  Örnek: "Türkiye'de her 3 KOBİ'den 1'i siber saldırıya uğruyor [DOĞRULA: IAMRC 2025]"
- TL bazında maliyet örnekleri ver. Dolar değil, TL önce.
- Türkiye verisi varsa önce Türkiye; yoksa "Dünya genelinde..." bağla.

YAPI ZORUNLULUKLARI:
- Giriş (max 100 kelime): Dikkat çekici problem/istatistik/senaryo ile başla. "Bu yazıda..." ile başlama.
- Alt başlıklar: h2 ve h3 HTML etiketiyle, 4-6 ana bölüm.
- Paragraflar max 4 satır.
- Listeler: 3-5 madde ul/li ile.
- CyberStep entegrasyonu: EN AZ 2, EN FAZLA 4 referans — doğal, reklam hissi vermemeli.
  Format: "CyberStep'in ücretsiz [araç adı] ile bunu 30 saniyede kontrol edebilirsiniz → cyberstep.io/[yol]"
- Son bölüm başlığı: <h2>Sonuç: Bugün Yapabileceğiniz 1 Şey</h2>
- Toplam: 900-1200 kelime. Format: Tam HTML (h2/h3/ul/li/strong/p).

═══════════════════════════════════════════
SOSYAL MEDYA ÜRETİMİ
═══════════════════════════════════════════

LİNKEDİN (150-250 kelime):
- İlk 2 satır: Rakam VEYA şaşırtıcı gerçek (kırpma noktası).
- Paragraflar max 3 satır, aralarında boş satır.
- En fazla 4 emoji. Link sadece sona.
- Yapı: Hook → Problem → Insight (3-5 madde) → CyberStep köprüsü → 🔗 Tam yazı: cyberstep.io/blog/[slug]
- Sonunda tam olarak 5 hashtag: #SiberGüvenlik #KOBİ #KVKK #Türkiye + 1 konuya özel.

INSTAGRAM CAPTION (max 150 kelime):
- İlk satır: Hook (büyük harf veya emoji ile).
- 3-4 madde liste (emoji başlıklı).
- CTA: "Detaylar ve ücretsiz tarama → link in bio"
- Hashtagler (20 adet): #siberguvenlik #kobi #kvkk #türkiye #girişim #dijitalguvenlik #hackleme #verikoruma #cybersecurity #startup #teknoloji #işdünyası #cyberstep #rizik #guvenlik + 5 konuya özel.

INSTAGRAM CAROUSEL (6-8 slayt, her biri max 15 kelime):
- Slayt 1: Hook — şaşırtıcı soru veya istatistik.
- Slayt 2-6+: Blog'dan 1 ana nokta/istatistik.
- Son slayt: CTA — "Ücretsiz Kontrol Edin → cyberstep.io".

X THREAD (5-7 tweet, her tweet max 280 karakter):
- Tweet 1 (Hook): Bağımsız değer taşımalı, retweet edilebilir. "🧵" ile bitmeli.
- Tweet 2: Problemi somutlaştır. Türkiye verisi kullan.
- Tweet 3: En şaşırtıcı gerçek veya istatistik.
- Tweet 4-5: Pratik, hemen uygulanabilir insight.
- Tweet 6: CyberStep köprüsü (doğal geçiş, ücretsiz araç).
- Tweet 7: Blog linki + domain tarama linki.
Tweet'leri "---" ile ayır.

GÖRSEL PROMPTLARI (Gemini'ye verilecek):
Her görsel için: Koyu lacivert arka plan (#0A1628), beyaz/turuncu metin, CyberStep logosu sağ alt, minimal profesyonel.

═══════════════════════════════════════════
ÇIKTI FORMATI — Sadece bu JSON'u döndür, başka hiçbir şey yazma:
═══════════════════════════════════════════

{
  "title": "Türkçe başlık (max 60 karakter)",
  "excerpt": "160 karakterlik özet",
  "content": "<article>HTML formatında tam makale</article>",
  "seoTitle": "SEO başlığı (max 60 karakter)",
  "metaDescription": "Meta açıklama (155-160 karakter)",
  "focusKeyword": "Ana anahtar kelime",
  "seoTags": ["etiket1", "etiket2", "etiket3", "etiket4", "etiket5"],
  "linkedinPost": "LinkedIn post metni (150-250 kelime, 5 hashtag sonunda)",
  "instagramCaption": "Instagram caption metni (max 150 kelime + 20 hashtag)",
  "instagramCarousel": [{"slide": 1, "text": "..."}, {"slide": 2, "text": "..."}, ...],
  "xThread": "Tweet 1 (max 280 karakter)\n---\nTweet 2\n---\nTweet 3\n---\nTweet 4\n---\nTweet 5\n---\nTweet 6\n---\nTweet 7",
  "visualPromptBlog": "Gemini prompt for blog cover: Koyu lacivert arka plan...",
  "visualPromptLinkedin": "Gemini prompt for LinkedIn image...",
  "visualPromptInstagram": "Gemini prompt for Instagram feed image...",
  "visualPromptX": "Gemini prompt for X/Twitter image..."
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });

  logAiCost({
    service: "blog_autopilot",
    model: "claude-sonnet-4-6",
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    metadata: { title: topic.title },
  }).catch(() => {});

  const block = message.content[0];
  const raw = block?.type === "text" ? block.text.trim() : "";

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(jsonStr) as {
    title: string; excerpt: string; content: string;
    seoTitle: string; metaDescription: string; focusKeyword: string; seoTags: string[];
    linkedinPost: string;
    instagramCaption: string;
    instagramCarousel: CarouselSlide[];
    xThread: string;
    visualPromptBlog: string;
    visualPromptLinkedin: string;
    visualPromptInstagram: string;
    visualPromptX: string;
  };

  return {
    title: parsed.title,
    slug: await toSlugUnique(parsed.title || topic.title),
    excerpt: parsed.excerpt,
    content: parsed.content,
    seoTitle: parsed.seoTitle,
    metaDescription: parsed.metaDescription,
    focusKeyword: parsed.focusKeyword,
    seoTags: parsed.seoTags,
    linkedinPostTr: parsed.linkedinPost,
    instagramCaptionTr: parsed.instagramCaption,
    instagramCarouselTr: parsed.instagramCarousel ?? [],
    socialTextTr: parsed.xThread,
    visualPromptsTr: {
      blog: parsed.visualPromptBlog,
      linkedin: parsed.visualPromptLinkedin,
      instagram: parsed.visualPromptInstagram,
      x: parsed.visualPromptX,
    },
  };
}

// ─── Ana fonksiyon: Sıradaki yazıyı üret ve yayınla ─────────────────────────
// Önce blog_content_calendar tablosundan sıradaki planlanmış yazıyı alır.
// Tablo boşaldıysa BLOG_PLAN dizisine (hardcoded 104 yazı) döner.
export async function generateAndPublishBlogPost(): Promise<void> {
  // 1. Paneldeki içerik takviminden sıradaki "planned" girdiyi al
  const [calendarEntry] = await db
    .select()
    .from(blogContentCalendarTable)
    .where(eq(blogContentCalendarTable.status, "planned"))
    .orderBy(asc(blogContentCalendarTable.sortOrder))
    .limit(1);

  let topic: typeof BLOG_PLAN[number];
  let calendarId: number | null = null;

  if (calendarEntry) {
    // Panel takviminden oluştur
    calendarId = calendarEntry.id;
    const angleparts: string[] = [];
    if (calendarEntry.targetAudience) angleparts.push(`Hedef kitle: ${calendarEntry.targetAudience}`);
    if (calendarEntry.cyberstepTool) angleparts.push(`CyberStep aracı öne çıkar: ${calendarEntry.cyberstepTool}`);
    if (calendarEntry.aiPromptNotes) angleparts.push(calendarEntry.aiPromptNotes);
    topic = {
      category: calendarEntry.category,
      title: calendarEntry.titleTr,
      keywords: calendarEntry.seoKeyword ?? calendarEntry.titleTr,
      angle: angleparts.join(". ") || "Pratik, uygulanabilir rehber",
    };
    logger.info(
      { calendarId, sortOrder: calendarEntry.sortOrder, title: topic.title },
      "Blog autopilot: takvimden yazı üretiliyor",
    );
  } else {
    // Takvim bitti veya boş — BLOG_PLAN'a dön
    const index = await getAutopilotIndex();
    const total = BLOG_PLAN.length;
    if (index >= total) {
      logger.info({ index, total }, "Blog autopilot: tüm plan tamamlandı, baştan başlanıyor");
      await setAutopilotIndex(0);
    }
    const currentIndex = index >= total ? 0 : index;
    topic = BLOG_PLAN[currentIndex];
    logger.info({ index: currentIndex, title: topic.title }, "Blog autopilot: BLOG_PLAN'dan yazı üretiliyor");
  }

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
    linkedinPostTr: generated.linkedinPostTr,
    instagramCaptionTr: generated.instagramCaptionTr,
    instagramCarouselTr: generated.instagramCarouselTr,
    visualPromptsTr: generated.visualPromptsTr,
  }).returning();

  logger.info({ postId: post.id, slug: post.slug, title: post.title }, "Blog autopilot: yazı yayınlandı");

  // Takvim satırını "published" olarak işaretle
  if (calendarId !== null) {
    await db
      .update(blogContentCalendarTable)
      .set({ status: "published", publishedAt: new Date(), slug: post.slug })
      .where(eq(blogContentCalendarTable.id, calendarId));
  } else {
    // BLOG_PLAN indeksini ilerlet
    const index = await getAutopilotIndex();
    await setAutopilotIndex(index + 1);
  }

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
}

// ─── Taslak üret (yayınlamadan kaydet) ───────────────────────────────────────
export async function generateAndSaveDraft(): Promise<{ postId: number; slug: string; title: string }> {
  const index = await getAutopilotIndex();
  const total = BLOG_PLAN.length;
  const currentIndex = index >= total ? 0 : index;
  const topic = BLOG_PLAN[currentIndex];

  logger.info({ index: currentIndex, title: topic.title }, "Blog autopilot: taslak üretiliyor");

  const generated = await generateBlogPostContent(topic);

  const [post] = await db.insert(blogPostsTable).values({
    title: generated.title,
    slug: generated.slug,
    excerpt: generated.excerpt,
    content: generated.content,
    authorName: "CyberStep.io",
    status: "draft",
    publishedAt: null,
    seoTitle: generated.seoTitle,
    metaDescription: generated.metaDescription,
    focusKeyword: generated.focusKeyword,
    seoTags: generated.seoTags,
    socialTextTr: generated.socialTextTr,
    linkedinPostTr: generated.linkedinPostTr,
    instagramCaptionTr: generated.instagramCaptionTr,
    instagramCarouselTr: generated.instagramCarouselTr,
    visualPromptsTr: generated.visualPromptsTr,
  }).returning();

  logger.info({ postId: post.id, slug: post.slug, title: post.title }, "Blog autopilot: taslak kaydedildi");
  await setAutopilotIndex(currentIndex + 1);
  return { postId: post.id, slug: post.slug, title: post.title };
}

// ─── Admin durum bilgisi ──────────────────────────────────────────────────────
export async function getBlogAutopilotStatus() {
  // Takvim istatistikleri
  const allCalendar = await db.select({ status: blogContentCalendarTable.status }).from(blogContentCalendarTable);
  const calendarTotal = allCalendar.length;
  const calendarPublished = allCalendar.filter(r => r.status === "published").length;
  const calendarPlanned = calendarTotal - calendarPublished;

  // Sıradaki takvim girişi
  const [nextCalendarEntry] = await db
    .select()
    .from(blogContentCalendarTable)
    .where(eq(blogContentCalendarTable.status, "planned"))
    .orderBy(asc(blogContentCalendarTable.sortOrder))
    .limit(1);

  // BLOG_PLAN yedek indeksi
  const index = await getAutopilotIndex();
  const safeIndex = Math.min(index, BLOG_PLAN.length - 1);

  const nextTopic = nextCalendarEntry
    ? { title: nextCalendarEntry.titleTr, category: nextCalendarEntry.category }
    : BLOG_PLAN[safeIndex];

  // En son yayınlanan yazı (publishedAt DESC)
  const [lastPost] = await db.select({
    id: blogPostsTable.id,
    title: blogPostsTable.title,
    publishedAt: blogPostsTable.publishedAt,
  }).from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(asc(blogPostsTable.publishedAt))
    .limit(1);

  return {
    totalPlanned: calendarTotal > 0 ? calendarTotal : BLOG_PLAN.length,
    currentIndex: calendarPublished,
    completedCount: calendarPublished,
    weeksCompleted: Math.floor(calendarPublished / 2),
    calendarPlanned,
    nextTopic: {
      index: calendarPublished,
      category: nextTopic.category,
      categoryCode: getCategoryCode(nextTopic.category),
      title: nextTopic.title,
    },
    lastPublished: lastPost ?? null,
  };
}
