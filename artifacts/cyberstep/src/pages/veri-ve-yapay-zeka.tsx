import { usePageMeta } from "@/hooks/use-page-meta";
import { Shield, ChevronRight, Database, Cpu, Server, Globe2 } from "lucide-react";
import { Link } from "wouter";

/** Kurumsal müşterilerin sık sorduğu üç soru: yapay zekâ, barındırma, veri. Yalnızca kod incelemesiyle doğrulanan bilgiler yazılır. */
const SECTIONS = [
  {
    icon: Cpu,
    title: "Tedarikçi izleme modülünde yapay zekâ kullanımı",
    content:
      "Tedarikçi portföyünüz (alan adları, risk skorları, bulgular, anket yanıtları ve yüklenen belgeler) yapay zekâ modellerine gönderilmez. Risk skoru ve anket yorumu kural tabanlı hesaplanır; aynı veri her zaman aynı sonucu verir.\n\nPlatformun tedarikçi izleme dışındaki bazı modüllerinde (örneğin içerik üretimi veya bazı değerlendirme araçlarında) yapay zekâ modelleri kullanılabilir. Bu modüller tedarikçi portföyünüzden bağımsızdır.",
  },
  {
    icon: Globe2,
    title: "Tedarikçi taramasında sorgulanan dış kaynaklar",
    content:
      "Tarama pasif ve dışarıdan yapılır: yalnızca kamuya açık internet kayıtları ve tehdit istihbaratı kaynakları sorgulanır. Sorgularda tedarikçinin alan adı kullanılır; bazı kaynaklarda (ör. fidye yazılımı sızıntı duyuruları) firma adıyla eşleşme de aranabilir. Müşteri verisi, anket yanıtı veya belge bu kaynaklara gönderilmez.",
  },
  {
    icon: Server,
    title: "Barındırma",
    content:
      "Uygulama sunucusu Avrupa Birliği içinde, Hollanda (Amsterdam bölgesi) veri merkezinde çalışır. Alan adı ve bağlantı trafiği TLS ile şifrelenir.",
  },
  {
    icon: Database,
    title: "Hangi veriler saklanır",
    content:
      "• Müşteri hesabı bilgileri (ad, e-posta, firma)\n• Eklediğiniz tedarikçi alan adları ve kritiklik bilgisi\n• Tarama sonuçları ve risk skorları\n• Tedarikçinin doldurduğu anket yanıtları ve yüklediği kanıt belgeleri\n\nVerilerin saklama süreleri ve haklarınız için Gizlilik Politikası'na bakın. Hukuki ve sözleşmesel sorularınız için info@cyberstep.io adresine yazabilirsiniz.",
  },
];

export default function VeriVeYapayZeka() {
  usePageMeta({
    title: "Veri, Yapay Zekâ ve Barındırma",
    description: "CyberStep tedarikçi izleme modülünde yapay zekâ kullanımı, barındırma konumu ve saklanan veriler.",
  });
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-14">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
            <Link href="/" className="hover:text-slate-200 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-200">Veri, Yapay Zekâ ve Barındırma</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Veri, Yapay Zekâ ve Barındırma</h1>
              <p className="text-slate-400 text-sm">Kurumsal müşterilerin tedarikçi değerlendirmesinde sık sorduğu sorular</p>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-4xl py-12">
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
        <div className="mt-8 flex flex-wrap gap-3">
          {[
            { label: "Gizlilik Politikası", href: "/gizlilik-politikasi" },
            { label: "KVKK Aydınlatma Metni", href: "/kvkk" },
            { label: "Metodoloji", href: "/metodoloji" },
          ].map(({ label, href }) => (
            <Link key={href} href={href} className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border rounded-lg text-sm hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
