import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";
import { useLanguage } from "@/contexts/language-context";

const config: ToolSeoConfig = {
  slug: "dark-web-sorgulama",
  title: "Ücretsiz Dark Web Sızıntı Sorgulama — Şirket Verileriniz Satışta mı?",
  metaDescription: "Şirket e-postanız veya domain'iniz dark web'de satışa sunulmuş mu? Ücretsiz sorgulayın, veri sızıntısı varsa anında öğrenin.",
  h1: "Dark Web Sızıntı Sorgulama — Ücretsiz",
  whatIsIt: "Dark web, yasadışı içeriklerin ve çalıntı verilerin alışverişinin yapıldığı, normal tarayıcılarla erişilemeyen internet katmanıdır. Siber saldırganlar ele geçirdikleri kullanıcı adı, şifre ve kurumsal verileri dark web'de satışa çıkarır. Bu araç, şirketinizin e-posta adresleri veya domain'inin bilinen veri ihlali veritabanlarıyla eşleşip eşleşmediğini sorgular. Sızıntı erken tespit edildiğinde hasarı minimuma indirmek mümkündür.",
  howItWorks: [
    "Sorgulamak istediğiniz e-posta veya domain adresini girin",
    "Sorgula butonuna basın",
    "Bilinen veri ihlali tablolarıyla karşılaştırılır",
    "Sızıntı tespit edilirse hangi ihlalden kaynaklandığı gösterilir",
    "Önemsediğiniz adresler için sürekli izleme aktif edin",
  ],
  faq: [
    { q: "Dark web sorgulaması nasıl çalışır?", a: "Sorgu, Have I Been Pwned gibi bilinen veri ihlali veritabanları ve CyberStep'in kendi tehdit istihbaratı kaynaklarıyla karşılaştırılır. Gerçek zamanlı dark web izlemesi Premium planda mevcuttur." },
    { q: "Adresim bulunduysa ne yapmalıyım?", a: "İlgili servislerinizdeki şifreleri hemen değiştirin. 2FA (iki faktörlü doğrulama) aktif edin. Hangi verilerin sızdığını tespit için CyberStep raporu alın." },
    { q: "Kurumsal e-postalar neden dark web'e düşer?", a: "Çalışanlarınızın kullandığı 3. parti servislerin (LinkedIn, Dropbox, Adobe vb.) veri ihlallerinde kurumsal e-postalar da ele geçirilir. Bu nedenle kurumsal ve kişisel şifre kullanımı kesinlikle ayrılmalıdır." },
    { q: "Dark web izleme ile sorgulaması arasındaki fark?", a: "Sorgu tek seferlik bir kontrol yapar. İzleme ise sürekli tarayarak yeni sızıntılar ortaya çıktığında anında bildirim gönderir. İzleme özelliğimiz Başlangıç planında mevcuttur." },
    { q: "Kaç e-posta adresi sorgulanabilir?", a: "Ücretsiz sorgulama tek bir adres için geçerlidir. Toplu kurumsal sorgulama ve sürekli izleme için Başlangıç veya Büyüme planına geçin." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "ssl-kontrol",             label: "SSL Kontrol" },
  ],
  toolComponent: "DarkWeb",
};

export default function DarkWebSorgulama() {
  const { lang } = useLanguage();
  return <ToolSeoPage config={config} />;
}
