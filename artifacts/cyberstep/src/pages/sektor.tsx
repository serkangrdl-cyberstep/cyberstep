import { useRoute } from "wouter";
import { Link } from "wouter";
import { Shield, AlertTriangle, CheckCircle2, ChevronRight, TrendingUp, FileWarning, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";

interface SectorData {
  slug: string;
  name: string;
  headline: string;
  subheadline: string;
  metaTitle: string;
  metaDesc: string;
  badge: string;
  stat1: { value: string; label: string };
  stat2: { value: string; label: string };
  stat3: { value: string; label: string };
  threats: Array<{ title: string; desc: string }>;
  regulations: Array<{ title: string; desc: string }>;
  ctaText: string;
}

const SECTORS: Record<string, SectorData> = {
  saglik: {
    slug: "saglik",
    name: "Sağlık",
    headline: "Sağlık Sektörü İçin Siber Güvenlik Risk Analizi",
    subheadline: "Hasta verileri ve tıbbi kayıtlar Türkiye'deki en değerli ve en korumasız varlıkların başında geliyor. KVKK Özel Nitelikli Veri yükümlülükleri her geçen gün daha sıkı denetleniyor.",
    metaTitle: "Sağlık Sektörü Siber Güvenlik | KOBİ Hastane & Klinik | CyberStep.io",
    metaDesc: "Özel klinikler, muayenehaneler ve sağlık kuruluşları için KVKK uyumlu siber güvenlik değerlendirmesi. Hasta verisi ihlali riskinizi ücretsiz hesaplayın.",
    badge: "Sağlık Sektörü",
    stat1: { value: "%83", label: "Sağlık ihlallerinde hasta verisi hedef alınıyor" },
    stat2: { value: "2.4M TL", label: "Türkiye'de sağlık sektörü ihlali ortalama maliyeti" },
    stat3: { value: "188 gün", label: "Ortalama ihlal tespit süresi (küresel)" },
    threats: [
      { title: "Fidye Yazılımı (Ransomware)", desc: "Tıbbi kayıt sistemleri, PACS ve HBYS yazılımlarını kilitleyen saldırılar. Ameliyat iptaline kadar uzanan operasyonel kriz riski." },
      { title: "Hasta Verisi Sızıntısı", desc: "KVKK kapsamında özel nitelikli sağlık verisi — normal veri ihlalinden 2 kat daha ağır ceza riski taşıyor. Minimum 94.000 TL." },
      { title: "Tıbbi Cihaz Güvenliği", desc: "İnternet bağlantılı tıbbi cihazlar (IoMT) güncelleme almadan çalışıyor. Üreticinin kontrolü dışında ağ maruziyeti." },
      { title: "Sosyal Mühendislik", desc: "Yoğun mesai altında çalışan sağlık personeli phishing saldırılarına karşı en savunmasız grupta yer alıyor." },
    ],
    regulations: [
      { title: "KVKK Özel Nitelikli Veri", desc: "Sağlık ve genetik veriler 'özel nitelikli' statüsünde — işleme, aktarma ve güvenlik koşulları çok daha katı." },
      { title: "Hasta Hakları Yönetmeliği", desc: "Sağlık kayıtlarının gizliliği ve güvenliği yasal zorunluluk. İhlal durumunda hem idari hem cezai sorumluluk doğuyor." },
      { title: "ISO 27799", desc: "Sağlık bilişimi güvenliği standardı. Büyük hastane ve özel sağlık kuruluşları için giderek artan akreditasyon şartı." },
    ],
    ctaText: "Kliniğinizin Siber Risk Skorunu Ücretsiz Öğrenin",
  },
  finans: {
    slug: "finans",
    name: "Finans",
    headline: "Finans & Muhasebe Firmaları İçin Siber Güvenlik",
    subheadline: "Muhasebe büroları, finansal danışmanlar ve mali müşavirler için siber saldırılar artık birinci tehdit. BDDK ve SPK uyum gereklilikleri 2025'te kapsamı genişletti.",
    metaTitle: "Finans Sektörü Siber Güvenlik | Muhasebe & Mali Müşavir | CyberStep.io",
    metaDesc: "Muhasebe büroları, mali müşavirler ve finans şirketleri için KVKK + BDDK uyumlu siber güvenlik değerlendirmesi. Finansal veri ihlali riskinizi ücretsiz hesaplayın.",
    badge: "Finans Sektörü",
    stat1: { value: "%74", label: "Finans sektörü ihlallerinde finansal kazanç güdüsü" },
    stat2: { value: "3.1M TL", label: "Finans sektörü ihlali ortalama maliyeti (Türkiye)" },
    stat3: { value: "186 gün", label: "Ortalama ihlal tespit süresi (finans)" },
    threats: [
      { title: "BEC (İş E-Postası Ele Geçirme)", desc: "CFO, muhasebe yöneticisi ve yönetici e-posta hesaplarının ele geçirilmesi. Türkiye'de tespit edilen en yüksek TL kayıplı saldırı türü." },
      { title: "Kimlik Avı (Phishing)", desc: "Banka, e-Devlet ve vergi dairesi kılığına giren sahte e-postalar. Muhasebe personeli hedefli spear-phishing kampanyaları artıyor." },
      { title: "Tedarik Zinciri Saldırısı", desc: "Muhasebe yazılımı (Logo, Mikro, Netsis vb.) üzerinden gerçekleştirilen saldırılar müşteri portföyünü tehlikeye atıyor." },
      { title: "Veri Sızıntısı & İç Tehdit", desc: "Müşteri finansal verilerinin rakiplere ya da karanlık web'e satılması. Sigortalı zararın ötesinde müşteri güveni kaybı." },
    ],
    regulations: [
      { title: "KVKK Md. 12 Teknik Tedbir", desc: "Müşteri finansal verilerinin teknik güvenliği zorunlu. VERBİS kaydı ve veri envanteri işlemleri denetim kapsamında." },
      { title: "BDDK Bilgi Güvenliği Tebliği", desc: "2021 yılında güncellenen tebliğ banka ve finansal kuruluşlarda sıkı BT güvenlik standartları getirdi. 2025'te KOBİ kapsamı genişliyor." },
      { title: "SPK Kurumsal Yönetim", desc: "Halka açık şirketler ve aracı kurumlar için siber güvenlik raporlama yükümlülüğü her yıl daha fazla önem kazanıyor." },
    ],
    ctaText: "Firmanızın Mali Veri Güvenliğini Ücretsiz Değerlendirin",
  },
  perakende: {
    slug: "perakende",
    name: "Perakende & E-Ticaret",
    headline: "Perakende & E-Ticaret İçin Siber Güvenlik",
    subheadline: "Müşteri kredi kartı verileri, sipariş geçmişi ve kişisel bilgilerin korunması hem KVKK hem PCI-DSS kapsamında zorunlu. Küçük e-ticaret siteleri de hedeften muaf değil.",
    metaTitle: "Perakende & E-Ticaret Siber Güvenlik | KOBİ Mağaza | CyberStep.io",
    metaDesc: "E-ticaret siteleri ve perakende zincirleri için KVKK + PCI-DSS uyumlu siber güvenlik değerlendirmesi. Müşteri verisi ihlali riskinizi ücretsiz hesaplayın.",
    badge: "Perakende & E-Ticaret",
    stat1: { value: "%62", label: "KOBİ e-ticaret sitelerinde temel güvenlik eksiklikleri var" },
    stat2: { value: "1.8M TL", label: "Perakende sektörü ihlali ortalama maliyeti" },
    stat3: { value: "7 dakika", label: "Kart verisi çalan bot saldırısı süresi" },
    threats: [
      { title: "Skimming (Kart Hırsızlığı)", desc: "Ödeme sayfasına enjekte edilen zararlı JavaScript kodu müşteri kart bilgilerini anında çalıyor. Magecart saldırıları Türk e-ticaret sitelerini hedef alıyor." },
      { title: "Hesap Ele Geçirme", desc: "Müşteri hesaplarının zayıf şifreler veya credential stuffing ile ele geçirilmesi. Puan/para iadesi suistimali ve sahte sipariş riski." },
      { title: "DDoS Saldırısı", desc: "Özellikle kampanya dönemlerinde (11.11, Black Friday) rakip kaynaklı DDoS saldırıları ile siteyi çökertme. Saatlik satış kaybı yüz binlerce TL." },
      { title: "Sahte İnceleme & SEO Sabotajı", desc: "Marka itibarı saldırıları ve Google sıralamasını bozmaya yönelik negatif SEO kampanyaları." },
    ],
    regulations: [
      { title: "KVKK Çerez & İzin Yönetimi", desc: "E-ticaret sitelerinde çerez politikası, açık rıza altyapısı ve kişisel veri envanteri KVKK'nın en sık denetlediği alanlar." },
      { title: "PCI-DSS v4.0", desc: "Kart ödemesi alan her işletme — büyüklüğünden bağımsız — PCI-DSS standartlarına uymak zorunda. 2024'te v4.0 yürürlüğe girdi." },
      { title: "E-Ticaret Kanunu & Mesafeli Satış", desc: "Müşteri verilerinin saklanma süresi, güvenliği ve silinme hakları açısından Tüketicinin Korunması Kanunu da ek yükümlülükler getiriyor." },
    ],
    ctaText: "E-Ticaret Sitenizin Güvenlik Skorunu Ücretsiz Öğrenin",
  },
  bilisim: {
    slug: "bilisim",
    name: "Bilişim & Yazılım",
    headline: "Yazılım & BT Şirketleri İçin Siber Güvenlik",
    subheadline: "Müşteri verisi emanet edilen yazılım şirketleri ve BT hizmet sağlayıcıları, tedarik zinciri saldırılarının ana hedefi. KVKK 'veri işleyen' statüsü kapsamlı sorumluluk getiriyor.",
    metaTitle: "Bilişim & Yazılım Şirketleri Siber Güvenlik | SaaS & BT | CyberStep.io",
    metaDesc: "Yazılım şirketleri, SaaS sağlayıcıları ve BT hizmet sağlayıcıları için KVKK uyumlu güvenlik değerlendirmesi. Tedarik zinciri riski ve veri işleyen yükümlülüklerini öğrenin.",
    badge: "Bilişim & Yazılım",
    stat1: { value: "%89", label: "Veri ihlallerinde yazılım güvenlik açıkları etken" },
    stat2: { value: "4x", label: "BT şirketinin ihlali müşteri firmalarına yayma riski" },
    stat3: { value: "245 gün", label: "Yazılım sektörü ihlal tespit süresi (küresel ort.)" },
    threats: [
      { title: "Tedarik Zinciri Saldırısı", desc: "Geliştirdiğiniz yazılım veya bağımlılıklar üzerinden müşteri sistemlerine sıçrayan saldırılar. SolarWinds, XZ Utils tarzı senaryolar KOBİ yazılım firmaları için de geçerli." },
      { title: "CI/CD Pipeline İhlali", desc: "Kaynak kod deposu, build sistemi ve deployment pipeline'ının ele geçirilmesi. Gizli anahtarlar (API keys, tokens) sızdırılıyor." },
      { title: "Müşteri Veri İhlali", desc: "Barındırdığınız müşteri verilerinin çalınması. Siz 'veri işleyen' bile olsanız KVKK kapsamında sorumluluğunuz devam ediyor." },
      { title: "Açık Kaynak Güvenlik Açığı", desc: "Log4j, OpenSSL gibi bağımlılıklardaki zero-day açıkları. Düzeltme sürecini yönetemeyen şirketler aylarca riskle yaşıyor." },
    ],
    regulations: [
      { title: "KVKK Veri İşleyen Statüsü", desc: "Müşteri adına veri işleyen her yazılım şirketi KVKK Md.12 kapsamında teknik tedbir almakla yükümlü. Sözleşme zorunluluğu dahil." },
      { title: "ISO/IEC 27001:2022", desc: "Bilgi güvenliği yönetim sistemi sertifikası — büyük kurumsal müşterilerin tedarikçi yeterlilik şartı haline geliyor." },
      { title: "Siber Güvenlik Kanunu (Tasarı)", desc: "2025'te gündeme gelen kritik altyapı ve yazılım güvenliği yükümlülükleri Türk yazılım şirketlerini doğrudan etkiliyor." },
    ],
    ctaText: "Şirketinizin Yazılım Güvenlik Açıklarını Ücretsiz Değerlendirin",
  },
  imalat: {
    slug: "imalat",
    name: "İmalat & Üretim",
    headline: "İmalat & Üretim Sektörü İçin Siber Güvenlik",
    subheadline: "OT/IT yakınsama süreci, üretim hatlarını siber saldırılara açık hale getirdi. Endüstriyel kontrol sistemleri (SCADA/ICS) artık internet bağlantılı ve saldırıların hedefinde.",
    metaTitle: "İmalat Sektörü Siber Güvenlik | Üretim & SCADA | CyberStep.io",
    metaDesc: "İmalat şirketleri ve üretim tesisleri için OT/IT güvenlik değerlendirmesi. SCADA, endüstriyel kontrol sistemleri ve KVKK uyumunu ücretsiz değerlendirin.",
    badge: "İmalat & Üretim",
    stat1: { value: "%68", label: "İmalat sektörü fidye yazılımı hedef oranı (2024)" },
    stat2: { value: "72 saat", label: "Üretim hattı duruşunun ortalama maliyet eşiğini aşması" },
    stat3: { value: "%41", label: "OT sistemleri hiç güncellenmemiş KOBİ oranı" },
    threats: [
      { title: "Fidye Yazılımı & Üretim Duruşu", desc: "ERP, MES ve üretim planlama sistemlerinin kilitlenmesi. Günlük 500K TL üzerinde üretim duruşu maliyeti yaşayan orta ölçekli fabrikalar var." },
      { title: "SCADA / ICS Saldırısı", desc: "PLC ve endüstriyel kontrolörlere erişim sağlayan saldırılar makine hasarına, yangına ve iş güvenliği olaylarına yol açabiliyor." },
      { title: "Fikri Mülkiyet Hırsızlığı", desc: "Ürün tasarımı, üretim formülü ve tedarikçi bilgilerini hedef alan ekonomik casusluk. Rakip ülke kaynaklı APT grupları aktif." },
      { title: "Tedarik Zinciri Manipülasyonu", desc: "Tedarikçi ve lojistik sistemlerine sızarak stok takibi, sipariş ve teslimat verilerinin değiştirilmesi ya da çalınması." },
    ],
    regulations: [
      { title: "KVKK Çalışan ve Müşteri Verisi", desc: "Üretim takip sistemleri, CCTV ve biyometrik erişim verileri KVKK kapsamında. Çalışan verisi özel işlem prosedürü gerektiriyor." },
      { title: "IEC 62443 (OT Güvenliği)", desc: "Endüstriyel otomasyon ve kontrol sistemleri güvenlik standardı. OEM tedarikçiler ve entegratörler bu standardı talep ediyor." },
      { title: "İş Güvenliği Kanunu Ek Yükümlülükleri", desc: "Siber saldırı kaynaklı iş güvenliği olaylarında işveren sorumluluğu 2024 yargı kararlarıyla netleşti." },
    ],
    ctaText: "Üretim Tesisinin Siber Risk Profilini Ücretsiz Öğrenin",
  },
};

function SectorPageContent({ data }: { data: SectorData }) {
  usePageMeta({
    title: data.metaTitle,
    description: data.metaDesc,
  });

  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="py-16 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">{data.badge}</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 max-w-2xl">{data.headline}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mb-8">{data.subheadline}</p>
          <Link href="/assessment/start">
            <Button size="lg" className="text-base">
              {data.ctaText} <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-8 border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
            {[data.stat1, data.stat2, data.stat3].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Threats */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-2xl font-bold">Sektörünüze Özgü Tehditler</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            {data.name} sektöründeki şirketler bu saldırı türlerine karşı daha savunmasız.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {data.threats.map((t) => (
              <Card key={t.title} className="border-l-4 border-l-destructive/60">
                <CardContent className="p-5">
                  <p className="font-semibold mb-1">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Regulations */}
      <section className="py-14 bg-muted/20 border-t border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <FileWarning className="h-5 w-5 text-amber-500" />
            <h2 className="text-2xl font-bold">Uyumluluk ve Yasal Yükümlülükler</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            {data.name} sektöründeki firmalar bu düzenlemelere tabi.
          </p>
          <div className="space-y-4">
            {data.regulations.map((r) => (
              <div key={r.title} className="flex gap-4 p-4 rounded-xl border bg-background">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KVKK comparison */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border-2 border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700/50 p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">KVKK minimum idari ceza</p>
                <p className="text-4xl font-bold text-amber-600">94.000 TL</p>
                <p className="text-sm text-muted-foreground mt-1">İhlal tespiti olmasa bile teknik tedbir eksikliği cezalandırılıyor</p>
              </div>
              <div className="text-2xl font-bold text-muted-foreground hidden sm:block">vs.</div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">CyberStep Tam Değerlendirme</p>
                <p className="text-4xl font-bold text-primary">5.990 TL</p>
                <p className="text-sm text-muted-foreground mt-1">Tek seferlik — 7 günlük memnuniyet garantisi</p>
              </div>
            </div>
          </div>

          {/* CTA card */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">Risk Profilinizi Ücretsiz Öğrenin</h2>
            </div>
            <p className="text-muted-foreground mb-2 max-w-xl mx-auto">
              20 soruluk mini değerlendirme ile {data.name.toLowerCase()} sektörüne özgü riskleri anlık olarak analiz edin.
              Yapay zeka destekli kişiselleştirilmiş rapor 3 dakikada hazır.
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
              Kredi kartı gerekmez. Kayıt zorunlu değil.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/assessment/start">
                <Button size="lg" className="text-base px-8">
                  {data.ctaText} <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/domain-tarama">
                <Button variant="outline" size="lg" className="text-base px-8">
                  Alan Adı Taraması Yap
                </Button>
              </Link>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Users, step: "1", title: "Firma bilgilerinizi girin", desc: "Şirket adı, sektör ve çalışan sayısı — 2 dakika" },
              { icon: Shield, step: "2", title: "20 soruyu yanıtlayın", desc: "5 güvenlik alanında pratik sorular" },
              { icon: TrendingUp, step: "3", title: "Raporunuzu alın", desc: "AI destekli kişisel risk analizi ve aksiyon planı" },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold mb-1">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SektorPage() {
  const [, params] = useRoute("/sektor/:slug");
  const slug = params?.slug ?? "";
  const data = SECTORS[slug];

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Sektör bulunamadı</h1>
        <p className="text-muted-foreground mb-6">Desteklenen sektörler: sağlık, finans, perakende, bilişim, imalat</p>
        <Link href="/assessment/start">
          <Button>Değerlendirmeye Başla</Button>
        </Link>
      </div>
    );
  }

  return <SectorPageContent data={data} />;
}
