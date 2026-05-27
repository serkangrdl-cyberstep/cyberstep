import { useQuery } from "@tanstack/react-query";
import { Cookie, Calendar, ChevronRight, Shield, BarChart3, Megaphone, Settings } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const COOKIE_CATEGORIES = [
  {
    icon: Shield,
    name: "Zorunlu Çerezler",
    badge: "Her zaman aktif",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/15",
    desc: "Platformun temel işlevleri için zorunludur. Bu çerezler devre dışı bırakılamaz.",
    cookies: [
      { name: "session", purpose: "Oturum yönetimi ve kimlik doğrulama", duration: "8 saat", provider: "CyberStep.io" },
      { name: "csrf_token", purpose: "Güvenlik — CSRF saldırılarını önler", duration: "Oturum", provider: "CyberStep.io" },
    ],
  },
  {
    icon: BarChart3,
    name: "Analitik Çerezler",
    badge: "Tercihe bağlı",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/15",
    desc: "Platformun nasıl kullanıldığını anlamak için kullanılır. Veriler anonimleştirilmiş olarak işlenir.",
    cookies: [
      { name: "_ga", purpose: "Ziyaretçi istatistikleri (anonim)", duration: "2 yıl", provider: "Google Analytics" },
      { name: "_ga_*", purpose: "Oturum başına istatistik", duration: "2 yıl", provider: "Google Analytics" },
    ],
  },
  {
    icon: Megaphone,
    name: "Pazarlama Çerezleri",
    badge: "Açık rıza gerektirir",
    badgeColor: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/15",
    desc: "Kişiselleştirilmiş içerik ve ilgi alanlarına göre reklamlar sunmak amacıyla kullanılır.",
    cookies: [
      { name: "_fbp", purpose: "Facebook Pixel — reklam hedefleme", duration: "90 gün", provider: "Meta (Facebook)" },
      { name: "li_sugr", purpose: "LinkedIn Insight etiket", duration: "90 gün", provider: "LinkedIn" },
    ],
  },
];

export default function CerezPolitikasi() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const lastUpdated = settings?.["cookie.lastUpdated"] ?? "2025-01-01";
  const formatted = new Date(lastUpdated).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const resetConsent = () => {
    localStorage.removeItem("cyberstep_cookie_consent");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-14">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
            <Link href="/" className="hover:text-slate-200 transition-colors">Ana Sayfa</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-200">Çerez Politikası</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Cookie className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Çerez Politikası</h1>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                <span>Son güncelleme: {formatted}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-12 space-y-8">
        {/* Intro */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-3">Çerez Nedir?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Çerezler, ziyaret ettiğiniz web sitelerinin tarayıcınıza kaydettiği küçük metin dosyalarıdır.
            Bu dosyalar sayesinde web siteleri sizi tanıyabilir, tercihlerinizi hatırlayabilir ve deneyiminizi kişiselleştirebilir.
            Çerezler, oturumunuz boyunca aktif kalan "oturum çerezleri" ve tarayıcınızda belirli bir süre saklanan "kalıcı çerezler" olarak ikiye ayrılır.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          <h2 className="font-semibold text-lg">Kullandığımız Çerezler</h2>
          {COOKIE_CATEGORIES.map(({ icon: Icon, name, badge, badgeColor, iconColor, iconBg, desc, cookies }) => (
            <div key={name} className="bg-card border rounded-xl overflow-hidden">
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl ${iconBg} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${badgeColor}`}>{badge}</span>
                    </div>
                    <p className="text-muted-foreground text-sm">{desc}</p>
                  </div>
                </div>
              </div>
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Çerez Adı", "Amaç", "Süre", "Sağlayıcı"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cookies.map(c => (
                      <tr key={c.name} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{c.purpose}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{c.duration}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{c.provider}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Browser settings */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Çerez Tercihlerinizi Yönetin</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
            Çerez tercihlerinizi aşağıdaki yöntemlerle yönetebilirsiniz:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 mb-5">
            <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span>Platform çerez tercih panelini kullanarak kategorileri ayrı ayrı yönetebilirsiniz</li>
            <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span>Tarayıcı ayarlarından tüm çerezleri silebilir veya engelleyebilirsiniz</li>
            <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span>Zorunlu çerezlerin devre dışı bırakılması platformun bazı işlevlerini kısıtlayabilir</li>
          </ul>
          <Button variant="outline" size="sm" onClick={resetConsent} className="gap-2">
            <Cookie className="h-3.5 w-3.5" />
            Çerez Tercihlerimi Sıfırla
          </Button>
        </div>

        {/* Related links */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Gizlilik Politikası", href: "/gizlilik-politikasi" },
            { label: "KVKK Aydınlatma Metni", href: "/kvkk" },
            { label: "Kullanım Koşulları", href: "/kullanim-kosullari" },
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
