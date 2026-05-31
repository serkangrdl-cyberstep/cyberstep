import { Link } from "wouter";
import { Shield, CheckCircle, ArrowRight, Building2, Layers, Zap, Globe, Lock, Users, BarChart3, HeadphonesIcon, CalendarCheck } from "lucide-react";
import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Kurumsal() {
  usePageMeta({
    title: "Kurumsal Siber Güvenlik Platformu | CyberStep.io",
    description: "Orta ve büyük ölçekli şirketler için sürekli maruz kalma yönetimi. Firewall entegrasyonu, white-label, SLA garantisi, kurumsal onboarding.",
    canonicalPath: "/kurumsal",
    lang: "tr",
  });

  const [form, setForm] = useState({ name: "", company: "", title: "", email: "", phone: "", employees: "", notes: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "kurumsal" }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  const DIFFERENTIATORS = [
    { icon: Globe, title: "Türkiye'ye Özgü İstihbarat", desc: "USOM korelasyonu, KVKK entegrasyonu, Türkiye sektör benchmarkları. Global araçların yapamadığı şey." },
    { icon: Layers, title: "Entegrasyon Ekosistemi", desc: "Fortinet, Check Point, Palo Alto, QRadar, CrowdStrike ile native entegrasyon. Mevcut altyapınıza eklenir." },
    { icon: Lock, title: "Kapalı Döngü Doğrulama", desc: "Sadece tespit etmiyoruz. Bulguyu güvenlik sisteminize iletiyoruz, düzeltilince yeniden tarayıp doğruluyoruz." },
    { icon: BarChart3, title: "Yönetim Kurulu Raporlaması", desc: "Teknik raporun yanı sıra CFO ve yönetim kuruluna sunulabilecek finansal risk özeti. TL bazında." },
    { icon: Zap, title: "Sürekli Maruz Kalma Yönetimi", desc: "Haftalık delta raporu, otomatik yeniden tarama, anlık alarm. Tek seferlik değerlendirme değil, canlı platform." },
    { icon: HeadphonesIcon, title: "Dedike Destek", desc: "Kurumsal müşterilere özel hesap yöneticisi, öncelikli destek hattı ve SLA garantisi." },
  ];

  const FEATURES = [
    "Sınırsız domain ve subdomain taraması",
    "Firewall entegrasyonu (Fortinet, Palo Alto, Check Point)",
    "White-label portal — kendi markanızla",
    "API erişimi ve SIEM entegrasyonu",
    "Yönetim kurulu raporu (otomatik, aylık)",
    "AI güvenlik servisleri paketi dahil",
    "KVKK DPA sözleşme yönetimi",
    "Haftalık tehdit istihbaratı özeti",
    "Dedike hesap yöneticisi",
    "SLA garantisi — 4 saat kritik olay yanıtı",
    "EU AI Act uyum skoru ve raporlaması",
    "Çok kullanıcılı panel — ekip erişimi",
  ];

  const TIMELINE = [
    { day: "Gün 1", title: "Onboarding ve Keşif", desc: "Mevcut altyapı haritalaması, entegrasyon kurulumu, ilk tam tarama." },
    { day: "Hafta 1", title: "İlk Risk Raporları", desc: "Dış saldırı yüzeyi raporu, AI güvenlik skoru, KVKK uyum durumu." },
    { day: "Hafta 2", title: "Entegrasyon Tamamlama", desc: "Firewall kuralları senkronize, SIEM alarm akışı aktif, takım eğitimi." },
    { day: "Ay 1+", title: "Sürekli İzleme", desc: "Haftalık delta raporu, aylık yönetim kurulu özeti, çeyreklik politika güncellemesi." },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
              <Building2 className="h-4 w-4" />
              Kurumsal
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Sürekli Maruz Kalma Yönetimi.<br />
              <span className="text-emerald-400">Türkçe. Türkiye'ye Özel.</span>
            </h1>
            <p className="text-slate-300 text-lg mb-4 leading-relaxed">
              Dış saldırı yüzeyi, AI araç güvenliği, KVKK uyumu, firewall entegrasyonu ve otomatik raporlama — tek platformda. Orta ve büyük ölçekli şirketler için tasarlandı.
            </p>
            <p className="text-slate-400 text-sm mb-8">
              SecurityScorecard veya BitSight'ın İngilizce kurumsal fiyatlandırmasına alternatif. Türkiye'ye özgü istihbarat ile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="#demo-form"
                className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-base"
              >
                Demo Talep Et
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <Link
                href="/fiyatlar"
                className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 font-medium px-8 py-4 rounded-lg transition-colors text-base"
              >
                Fiyat Karşılaştırması
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">Global Araçlar vs CyberStep</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Global araçlar büyük kurumsal müşteriye İngilizce konuşur. CyberStep Türkiye'nin her ölçekteki şirketine Türkçe konuşur.
            </p>
          </div>

          {/* Comparison table */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-16">
            <div className="grid grid-cols-4 bg-slate-50 dark:bg-slate-800/50 border-b text-sm font-semibold">
              <div className="px-4 py-3 text-slate-500 border-r">Özellik</div>
              <div className="px-4 py-3 text-slate-400 border-r text-center">SecurityScorecard</div>
              <div className="px-4 py-3 text-slate-400 border-r text-center">BitSight</div>
              <div className="px-4 py-3 text-emerald-600 text-center">CyberStep</div>
            </div>
            {[
              ["Türkçe arayüz", false, false, true],
              ["KVKK entegrasyonu", false, false, true],
              ["USOM korelasyonu", false, false, true],
              ["AI araç güvenliği", false, false, true],
              ["EU AI Act uyumu", false, false, true],
              ["Kapalı döngü doğrulama", false, false, true],
              ["Türkiye sektör benchmark", false, false, true],
              ["TL bazında risk tahmini", false, false, true],
            ].map(([feature, ss, bs, cs], i) => (
              <div key={i} className="grid grid-cols-4 border-b last:border-0 text-sm">
                <div className="px-4 py-3 text-foreground border-r font-medium">{feature as string}</div>
                <div className="px-4 py-3 text-center border-r">{ss ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</div>
                <div className="px-4 py-3 text-center border-r">{bs ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</div>
                <div className="px-4 py-3 text-center">{cs ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-slate-300">—</span>}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border rounded-xl p-6 space-y-3">
                <div className="h-11 w-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Kurumsal Paketin İçeriği</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3 bg-card border rounded-xl px-5 py-4">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Onboarding Timeline */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Onboarding Süreci</h2>
            <p className="text-muted-foreground mt-3">İlk günden itibaren değer üretmeye başlıyoruz.</p>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border md:left-1/2" />
            <div className="space-y-10">
              {TIMELINE.map((item, i) => (
                <div key={i} className={`flex gap-6 items-start ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                  <div className="hidden md:block w-1/2" />
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold z-10 relative">
                      {i + 1}
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-5 flex-1">
                    <p className="text-xs text-emerald-600 font-semibold mb-1">{item.day}</p>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo Form */}
      <section id="demo-form" className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <CalendarCheck className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-3">Demo Talep Edin</h2>
            <p className="text-slate-400">
              Size özel bir demo toplantısı ayarlıyoruz. Mevcut altyapınızı inceleyip CyberStep'in nasıl entegre olacağını gösteriyoruz.
            </p>
          </div>

          {sent ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Talebiniz alındı.</h3>
              <p className="text-slate-400">En geç 1 iş günü içinde size ulaşacağız.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad Soyad *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Mehmet Yılmaz" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Ünvan</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="IT Direktörü / CISO" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Şirket *</label>
                <input required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Şirket Adı A.Ş." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Kurumsal E-posta *</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="mehmet@sirket.com.tr" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefon</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="+90 5XX XXX XX XX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Çalışan Sayısı</label>
                <select value={form.employees} onChange={e => setForm(f => ({ ...f, employees: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="">Seçin</option>
                  <option value="50-250">50–250</option>
                  <option value="250-1000">250–1.000</option>
                  <option value="1000+">1.000+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notlar / Sorularınız</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                  placeholder="Mevcut güvenlik altyapısı, öncelikli ihtiyaçlar..." />
              </div>
              <button type="submit" disabled={sending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-4 rounded-lg transition-colors text-base">
                {sending ? "Gönderiliyor..." : "Demo Talep Et"}
              </button>
              <p className="text-xs text-center text-slate-500">Verileriniz yalnızca sizinle iletişim kurmak için kullanılır. Üçüncü taraflarla paylaşılmaz.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
