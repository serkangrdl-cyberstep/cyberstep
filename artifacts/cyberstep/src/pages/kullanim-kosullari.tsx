import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const SECTIONS = [
  {
    title: "1. Taraflar ve Kapsam",
    content: `Bu Kullanım Koşulları ("Koşullar"), CyberStep.io ("Platform") ile Platformu kullanan gerçek veya tüzel kişiler ("Kullanıcı") arasındaki hukuki ilişkiyi düzenlemektedir. Platforma erişim sağlayarak bu Koşulları kabul etmiş sayılırsınız.`,
  },
  {
    title: "2. Hizmetin Tanımı",
    content: `CyberStep.io, küçük ve orta ölçekli işletmelere (KOBİ) yönelik siber güvenlik risk değerlendirmesi sunan bir SaaS platformudur. Platform; anket tabanlı değerlendirme, yapay zeka destekli analiz ve uzman inceleme hizmetlerini kapsamaktadır. Platform, siber güvenlik konusunda genel bilgi ve rehberlik sunmakta olup kesin güvenlik garantisi vermemektedir.`,
  },
  {
    title: "3. Kullanıcı Yükümlülükleri",
    content: `Kullanıcı aşağıdaki hususları kabul ve taahhüt eder:\n• Platforma sağlanan bilgilerin doğru, güncel ve eksiksiz olduğu\n• Platform üzerinden üçüncü kişilere zarar verecek herhangi bir işlem gerçekleştirilmeyeceği\n• Yürürlükteki mevzuata aykırı hareket edilmeyeceği\n• Platformun güvenlik açıklarını araştırmak, tersine mühendislik uygulamak veya yetkisiz erişim girişiminde bulunulmayacağı`,
  },
  {
    title: "4. Hizmet Bedeli ve Ödeme",
    content: `Ücretsiz Mini Değerlendirme hizmeti herhangi bir ücret gerektirmemektedir. Ücretli hizmetler için fiyatlandırma ve ödeme koşulları ilgili hizmet sayfasında belirtilmektedir. Tüm fiyatlara %20 KDV eklenmektedir. Ödemeler iyzico güvenli ödeme altyapısı üzerinden gerçekleştirilmektedir. Dijital içerik niteliğindeki hizmetlerde, hizmet sunumuna başlanması halinde cayma hakkı kullanılamaz.`,
  },
  {
    title: "5. Fikri Mülkiyet",
    content: `Platform üzerindeki tüm içerik, tasarım, yazılım ve materyaller CyberStep.io'nun münhasır mülkiyetindedir ve 5846 sayılı Fikir ve Sanat Eserleri Kanunu kapsamında korunmaktadır. Kullanıcılar, Platform içeriğini izin almaksızın kopyalayamaz, çoğaltamaz veya ticari amaçla kullanamaz.`,
  },
  {
    title: "6. Sorumluluk Sınırı",
    content: `Platform, siber güvenlik değerlendirmesi konusunda tavsiye niteliğinde bilgi sunmaktadır. Değerlendirme sonuçları kesin bir güvenlik güvencesi teşkil etmez. Platform'un kullanımından doğabilecek dolaylı, arızi veya sonuçsal zararlardan CyberStep.io sorumlu tutulamaz.`,
  },
  {
    title: "7. Hesap Güvenliği",
    content: `Kullanıcı, hesap bilgilerinin gizliliğini korumakla yükümlüdür. Hesap bilgilerinin yetkisiz kullanımı derhal bildirilmelidir. Bildirim yapılmadan önce gerçekleşen işlemlerden CyberStep.io sorumlu tutulamaz.`,
  },
  {
    title: "8. Gizlilik",
    content: `Kişisel verilerinizin işlenmesine ilişkin detaylı bilgi için Gizlilik Politikamızı ve KVKK Aydınlatma Metnimizi incelemenizi rica ederiz.`,
  },
  {
    title: "9. Hizmetin Askıya Alınması",
    content: `CyberStep.io; bu Koşulları ihlal eden, yasadışı faaliyetlerde bulunan veya platformun bütünlüğünü tehdit eden kullanıcıların hesaplarını önceden bildirim yapmaksızın askıya alma veya sonlandırma hakkını saklı tutar.`,
  },
  {
    title: "10. Uygulanacak Hukuk ve Yetkili Mahkeme",
    content: `Bu Koşullar Türk Hukuku'na tabidir. Uyuşmazlık halinde İstanbul Merkez Mahkemeleri ve İcra Daireleri yetkilidir. 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuat hükümleri saklıdır.`,
  },
  {
    title: "11. Değişiklikler",
    content: `CyberStep.io, bu Koşulları güncelleyebilir. Önemli değişiklikler kayıtlı e-posta adresine bildirilir. Güncel Koşullar Platform'da yayımlandığı tarihten itibaren geçerlilik kazanır.`,
  },
];

export default function KullanimKosullari() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const lastUpdated = settings?.["terms.lastUpdated"] ?? "2025-01-01";
  const formatted = new Date(lastUpdated).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-14">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
            <Link href="/" className="hover:text-slate-200 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-200">Kullanım Koşulları</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Kullanım Koşulları</h1>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                <span>Son güncelleme: {formatted}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-12">
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 mb-8 text-sm text-amber-800 dark:text-amber-300">
          Bu Platformu kullanarak aşağıdaki koşulları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.
        </div>

        <div className="space-y-8">
          {SECTIONS.map(({ title, content }) => (
            <div key={title} className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-3">{title}</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm">{content}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-900 border rounded-xl">
          <h3 className="font-semibold mb-3">İlgili Belgeler</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Gizlilik Politikası", href: "/gizlilik-politikasi" },
              { label: "Çerez Politikası", href: "/cerez-politikasi" },
              { label: "KVKK Aydınlatma Metni", href: "/kvkk" },
              { label: "İletişim", href: "/iletisim" },
            ].map(({ label, href }) => (
              <Link key={href} href={href} className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border rounded-lg text-sm hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                <FileText className="h-3.5 w-3.5" /> {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
