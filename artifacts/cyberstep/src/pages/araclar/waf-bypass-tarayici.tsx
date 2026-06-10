import { ToolSeoPage, type ToolSeoConfig } from "./tool-seo-page";

const config: ToolSeoConfig = {
  slug: "WAF-bypass-tarayıcı",
  title: "WAF Bypass Tarayıcı — CDN Arkasındaki Gerçek IP Tespiti",
  metaDescription: "Web sitenizin WAF veya CDN tarafından korunup korunmadığını kontrol edin. Gerçek sunucu IP'si açığa çıkmış mı? Ücretsiz analiz.",
  h1: "WAF Bypass Tarayıcı — Origin IP Keşfi",
  whatIsIt: "WAF (Web Application Firewall) ve CDN servisleri, web sunucunuzun gerçek IP adresini gizleyerek trafiği filtreler. Ancak yanlış yapılandırma, eski DNS kayıtları veya sertifika şeffaflık kayıtları aracılığıyla bu koruma aşılabilir: saldırganlar gerçek sunucu IP'nizi tespit ederek WAF'ı bypass edebilir. Bu araç, domain'inizin arkasındaki WAF/CDN varlığını analiz eder; origin sunucunuzun doğrudan erişime açık olup olmadığını kontrol eder ve tespit edilen riskleri raporlar. WAF bypass riskini öğrenmek, alınması gereken önlemlerin ilk adımıdır.",
  howItWorks: [
    "Domain adresinizi alana girin (örnek: sirketiniz.com.tr)",
    "Tara butonuna basın — WAF/CDN tespiti ve origin IP analizi başlatılır",
    "Tespit edilen WAF sağlayıcısı ve koruma düzeyi görüntülenir",
    "Origin IP açığa çıkmışsa 'Yüksek Risk' uyarısı ve düzeltme önerileri sunulur",
    "Riskler için CyberStep ile tam güvenlik değerlendirmesi başlatabilirsiniz",
  ],
  faq: [
    { q: "WAF bypass neden kritik bir risktir?", a: "WAF, SQL enjeksiyonu ve XSS gibi saldırılara karşı birincil savunma katmanıdır. Origin IP bilinirse saldırgan trafiği doğrudan sunucuya yönlendirerek WAF'ı tamamen devre dışı bırakabilir. Bu, tüm uygulama katmanı savunmanızı işlevsiz kılar." },
    { q: "Origin IP nasıl sızdırılır?", a: "En yaygın sızıntı yolları şunlardır: CDN'e geçmeden önceki eski DNS kayıtları, mail (MX) kayıtlarında açığa çıkan IP, SSL sertifika geçmişi (crt.sh), hata sayfaları veya yanlış yapılandırılmış subdomain'ler." },
    { q: "Hangi WAF sağlayıcıları tespit edilebilir?", a: "Cloudflare, AWS WAF, Akamai, Imperva, Sucuri, Fortinet FortiWeb ve diğer büyük sağlayıcılar HTTP başlıkları, IP aralıkları ve yanıt davranışları analiz edilerek tespit edilir." },
    { q: "WAF bypass riskini nasıl azaltırım?", a: "Origin sunucuya gelen tüm trafiği WAF IP'lerine kısıtlayan güvenlik duvarı kuralları ekleyin. Eski DNS kayıtlarını temizleyin. Mail sunucusunu ana domain'den farklı bir IP'de barındırın. CDN'de kayıtlı olmayan subdomain'leri kaldırın." },
    { q: "CDN kullanıyorum ama WAF kullanmıyorum, risk var mı?", a: "CDN öncelikle performans için kullanılır; WAF ise güvenlik katmanıdır. CDN tek başına SQL enjeksiyonu veya OWASP Top 10 saldırılarına karşı yeterli koruma sağlamaz. CDN sağlayıcınızın WAF eklentisini aktifleştirmeniz önerilir." },
  ],
  relatedTools: [
    { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
    { slug: "subdomain-tarayıcı",       label: "Subdomain Tarayıcı" },
    { slug: "ssl-kontrol",              label: "SSL Kontrol" },
  ],
  toolComponent: "WAFChecker",
};

export default function WafBypassTarayici() {
  return <ToolSeoPage config={config} />;
}
