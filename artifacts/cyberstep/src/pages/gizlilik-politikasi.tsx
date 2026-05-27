import { useQuery } from "@tanstack/react-query";
import { Shield, Calendar, ChevronRight, Eye, Database, Lock, UserCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";

const SECTIONS = [
  {
    icon: Database,
    title: "1. Veri Sorumlusu",
    content: `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu sıfatıyla CyberStep.io hareket etmektedir. Bu Gizlilik Politikası; KVKK ve AB Genel Veri Koruma Tüzüğü (GDPR) gerekliliklerine uygun şekilde hazırlanmıştır.`,
  },
  {
    icon: Eye,
    title: "2. İşlenen Kişisel Veriler",
    content: `Platform aracılığıyla aşağıdaki kişisel veriler işlenmektedir:\n\n• Kimlik verileri: Ad, soyad, firma adı, unvan\n• İletişim verileri: E-posta adresi, telefon numarası\n• Değerlendirme verileri: Anket cevapları, rapor içerikleri, sektör bilgisi\n• Teknik veriler: IP adresi, tarayıcı bilgisi, oturum verileri, çerezler\n• Finansal veriler: Ödeme işlem kaydı (kart verileri işlenmez; ödeme iyzico güvenli altyapısı üzerinden gerçekleştirilir)`,
  },
  {
    icon: UserCheck,
    title: "3. Veri İşleme Amaçları ve Hukuki Dayanaklar",
    content: `Verileriniz aşağıdaki amaçlarla ve yasal dayanaklarla işlenmektedir:\n\n• Sözleşmenin ifası (KVKK m.5/2-c): Değerlendirme hizmetinin sunulması, raporların oluşturulması\n• Meşru menfaat (KVKK m.5/2-f): Platform güvenliği, hizmet kalitesinin iyileştirilmesi, istatistik tutulması\n• Yasal yükümlülük (KVKK m.5/2-ç): Vergi, muhasebe ve yasal kayıt gereksinimleri\n• Açık rıza (KVKK m.5/1): Ticari elektronik ileti gönderimi, pazarlama amaçlı profilleme`,
  },
  {
    icon: Lock,
    title: "4. Veri Güvenliği",
    content: `Verilerinizin korunması için aşağıdaki teknik ve idari tedbirler uygulanmaktadır:\n\n• TLS/SSL şifrelemesi ile veri transferi güvenliği\n• Rol tabanlı erişim kontrolü (yalnızca yetkili personel)\n• Düzenli güvenlik denetimleri ve sızma testleri\n• Veri ihlali tespit ve bildirim prosedürleri (KVKK m.12 kapsamında 72 saat içinde bildirim)\n• Sunucu düzeyinde şifreleme (encryption at rest)`,
  },
  {
    icon: Database,
    title: "5. Veri Saklama Süreleri",
    content: `• Değerlendirme ve rapor verileri: Hizmet ilişkisinin sona ermesinden itibaren 3 yıl\n• Finansal kayıtlar: Vergi mevzuatı gereği 10 yıl\n• Teknik log kayıtları: 90 gün\n• Pazarlama rızası geri alındığında: Derhal silme`,
  },
  {
    icon: Eye,
    title: "6. Üçüncü Taraflarla Veri Paylaşımı",
    content: `Kişisel verileriniz, aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:\n\n• Hizmet sağlayıcılar: iyzico (ödeme işleme), Google (yapay zeka altyapısı) — veri işleme sözleşmeleri mevcuttur\n• Yasal zorunluluk: Mahkeme kararı veya yetkili kurum talebi halinde\n• Şirket yapısı değişikliği: Birleşme veya devralma durumunda kullanıcı bildirimli aktarım`,
  },
  {
    icon: UserCheck,
    title: "7. KVKK Kapsamındaki Haklarınız",
    content: `KVKK'nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:\n\n• Kişisel verilerinizin işlenip işlenmediğini öğrenme\n• İşlenmişse bilgi talep etme\n• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme\n• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri öğrenme\n• Eksik veya yanlış işlenmiş olması halinde düzeltilmesini talep etme\n• KVKK m.7 kapsamında silinmesini veya yok edilmesini talep etme\n• Otomatik sistemler vasıtasıyla aleyhinize sonuç doğuran kararlara itiraz etme\n• Kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme\n\nBaşvurularınız için: info@cyberstep.io`,
  },
  {
    icon: Trash2,
    title: "8. Çerezler",
    content: `Platform, hizmet sunumu ve deneyim iyileştirme amacıyla çerezler kullanmaktadır. Çerez tercihleri için Çerez Politikamızı inceleyebilirsiniz. Çerez tercihlerinizi dilediğiniz zaman değiştirebilirsiniz.`,
  },
  {
    icon: Shield,
    title: "9. Politika Güncellemeleri",
    content: `Bu Politika, KVKK veya GDPR kapsamındaki mevzuat değişikliklerine uyum sağlamak amacıyla güncellenebilir. Önemli değişiklikler, kayıtlı e-posta adresine bildirilir. Güncel politika her zaman bu sayfada yayımlanır.`,
  },
];

export default function GizlilikPolitikasi() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const lastUpdated = settings?.["privacy.lastUpdated"] ?? "2025-01-01";
  const formatted = new Date(lastUpdated).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-14">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
            <Link href="/" className="hover:text-slate-200 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-200">Gizlilik Politikası</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Gizlilik Politikası</h1>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                <span>Son güncelleme: {formatted}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-12">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 mb-8 flex items-start gap-3">
          <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Bu Politika, 6698 sayılı KVKK ve AB GDPR kapsamında hazırlanmış olup verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklamaktadır.
          </p>
        </div>

        <div className="space-y-6">
          {SECTIONS.map(({ icon: Icon, title, content }) => (
            <div key={title} className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-emerald-500" />
                </div>
                <h2 className="font-semibold">{title}</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm pl-11">{content}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-900 border rounded-xl">
          <h3 className="font-semibold mb-1">Başvuru İletişim Bilgileri</h3>
          <p className="text-muted-foreground text-sm mb-3">KVKK kapsamındaki haklarınızı kullanmak için:</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "info@cyberstep.io", href: "mailto:info@cyberstep.io" },
            ].map(({ label, href }) => (
              <a key={href} href={href} className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border rounded-lg text-sm hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                {label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { label: "Kullanım Koşulları", href: "/kullanim-kosullari" },
              { label: "Çerez Politikası", href: "/cerez-politikasi" },
              { label: "KVKK Aydınlatma Metni", href: "/kvkk" },
            ].map(({ label, href }) => (
              <Link key={href} href={href} className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border rounded-lg text-sm hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
