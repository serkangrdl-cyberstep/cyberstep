import { useState } from "react";
import { Link } from "wouter";
import { Shield, CheckCircle, ArrowRight, Briefcase, Globe, Users, Building2, Handshake, Award, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

const PARTNER_TYPES = [
  {
    icon: Briefcase,
    title: "Mali Müşavirlik / SMMM Ofisleri",
    desc: "Müşterilerinizin KVKK uyum durumunu ve siber risk maliyetini somutlaştırın. Yüksek katma değerli hizmet olarak siber güvenlik risk analizi sunun.",
  },
  {
    icon: Globe,
    title: "Bölgesel IT Bayileri / Sistem Odaları",
    desc: "Hizmet portföyünüze siber güvenlik taraması ekleyin. CyberStep altyapısını marka adınızla sunun, teknik destek bizden.",
  },
  {
    icon: Building2,
    title: "Ticaret Odaları & Sektör Dernekleri",
    desc: "Üyelerinize toplu lisans modeliyle kurumsal fiyatta siber güvenlik değerlendirmesi sağlayın. Kurumsal ciddiyet, somut fayda.",
  },
];

const STEPS = [
  { num: "1", title: "Başvurun ve onaylanın", desc: "Kısa başvuru formu — 2 iş günü içinde yanıt." },
  { num: "2", title: "Modelinizi seçin", desc: "Komisyon, whitelabel veya toplu lisans — iş modelinize uygun seçenek." },
  { num: "3", title: "Sunmaya başlayın", desc: "Müşterilerinize hemen tarama sunun. Teknik altyapı, destek, raporlar bizden." },
];

const MODELS = [
  {
    icon: Percent,
    title: "Komisyon / Referral",
    desc: "Müşteri yönlendirirsiniz, her abonelikten %20 komisyon kazanırsınız. Sıfır teknik sorumluluk.",
    highlight: false,
  },
  {
    icon: Award,
    title: "Whitelabel / Wholesale",
    desc: "CyberStep platformunu kendi markanızla sunun. Müşteri sizin, raporlar sizin logonuzla, fiyat farkı sizin kârınız.",
    highlight: true,
  },
  {
    icon: Handshake,
    title: "Toplu Lisans",
    desc: "Dernekler ve odalar için toplu üyelik paketi. Üye sayısına göre indirimli kurumsal fiyatlandırma.",
    highlight: false,
  },
];

const COMPANY_TYPES = [
  "Mali Müşavirlik / SMMM Ofisi",
  "Bölgesel IT Bayisi / Sistem Odası",
  "Ticaret Odası / Sektör Derneği",
  "KVKK / Siber Güvenlik Danışmanı",
  "Sigorta Aracısı",
  "Diğer",
];

export default function IsOrtakligi() {
  usePageMeta({
    title: "İş Ortaklığı | CyberStep.io",
    description: "CyberStep iş ortağı olun. Mali müşavirler, IT bayileri ve ticaret odaları için komisyon, whitelabel ve toplu lisans modelleri. Altyapı bizden, marka sizden.",
    canonicalPath: "/is-ortakligi",
  });

  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", phone: "",
    companyType: "", estimatedCustomers: "", message: "",
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.companyName,
          name: form.contactName,
          email: form.email,
          phone: form.phone,
          type: "partner",
          companyType: form.companyType,
          estimatedCustomers: form.estimatedCustomers,
          message: form.message,
          inquiryType: "partner",
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060D1A] text-[#E8EDF5]">
      {/* HERO */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00C8FF08] to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00C8FF]/30 bg-[#00C8FF]/10 mb-6">
            <Handshake className="h-4 w-4 text-[#00C8FF]" />
            <span className="text-xs font-medium text-[#00C8FF] tracking-wide">İş Ortaklığı Programı</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            CyberStep <span className="text-[#00C8FF]">İş Ortağı</span> Olun
          </h1>
          <p className="text-lg text-[#7B8FAF] max-w-2xl mx-auto mb-8 leading-relaxed">
            Müşterilerinize siber güvenlik taraması sunun — altyapı bizden, marka sizden.
          </p>
          <a href="#basvuru">
            <Button className="bg-[#00C8FF] hover:bg-[#00B0E0] text-[#060D1A] font-bold px-8 py-3 text-base">
              Başvuru Formu <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* KİMLER İÇİN */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Kimler İçin?</h2>
          <p className="text-center text-[#7B8FAF] text-sm mb-10">Farklı iş modelleri için farklı ortaklık çerçeveleri</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PARTNER_TYPES.map((pt) => (
              <div key={pt.title} className="border border-[#1A2540] rounded-xl p-6 hover:border-[#00C8FF]/30 hover:bg-[#00C8FF08] transition-all">
                <pt.icon className="h-8 w-8 text-[#00C8FF] mb-4" />
                <h3 className="font-bold text-base mb-2">{pt.title}</h3>
                <p className="text-[#7B8FAF] text-sm leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NASIL ÇALIŞIR */}
      <section className="py-16 px-4 border-y border-[#1A2540]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Nasıl Çalışır?</h2>
          <p className="text-center text-[#7B8FAF] text-sm mb-10">3 adımda müşterilerinize değer katın</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#00C8FF]/10 border border-[#00C8FF]/30 flex items-center justify-center mb-4">
                  <span className="text-[#00C8FF] font-bold text-lg">{s.num}</span>
                </div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-[#7B8FAF] text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODELLER */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Ortaklık Modelleri</h2>
          <p className="text-center text-[#7B8FAF] text-sm mb-10">İş modelinize uygun çerçeveyi seçin</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MODELS.map((m) => (
              <div key={m.title} className={`border rounded-xl p-6 ${m.highlight ? "border-[#F5A623]/40 bg-[#F5A62308]" : "border-[#1A2540]"}`}>
                {m.highlight && (
                  <div className="text-xs font-semibold text-[#F5A623] uppercase tracking-wider mb-3">Önerilen</div>
                )}
                <m.icon className={`h-7 w-7 mb-4 ${m.highlight ? "text-[#F5A623]" : "text-[#00C8FF]"}`} />
                <h3 className="font-bold text-base mb-2">{m.title}</h3>
                <p className="text-[#7B8FAF] text-sm leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BAŞVURU FORMU */}
      <section id="basvuru" className="py-16 px-4 bg-[#0A1628]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Başvuru Formu</h2>
          <p className="text-center text-[#7B8FAF] text-sm mb-10">2 iş günü içinde size ulaşıyoruz</p>

          {sent ? (
            <div className="text-center py-12">
              <CheckCircle className="h-14 w-14 text-[#00C8FF] mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Başvurunuz Alındı</h3>
              <p className="text-[#7B8FAF]">En kısa sürede sizinle iletişime geçeceğiz.</p>
              <Link href="/">
                <Button variant="outline" className="mt-6 border-[#1A2540] text-[#E8EDF5] hover:bg-[#1A2540]">
                  Ana Sayfaya Dön
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#7B8FAF] mb-1 block">Şirket Adı *</label>
                  <input
                    required
                    value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50"
                    placeholder="Şirketinizin adı"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7B8FAF] mb-1 block">İletişim Kişisi *</label>
                  <input
                    required
                    value={form.contactName}
                    onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                    className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50"
                    placeholder="Ad Soyad"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#7B8FAF] mb-1 block">E-posta *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50"
                    placeholder="mail@sirket.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7B8FAF] mb-1 block">Telefon</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50"
                    placeholder="0532 xxx xx xx"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#7B8FAF] mb-1 block">Şirket Türü *</label>
                  <select
                    required
                    value={form.companyType}
                    onChange={e => setForm(f => ({ ...f, companyType: e.target.value }))}
                    className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50"
                  >
                    <option value="">Seçiniz</option>
                    {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#7B8FAF] mb-1 block">Tahmini Müşteri Sayısı</label>
                  <select
                    value={form.estimatedCustomers}
                    onChange={e => setForm(f => ({ ...f, estimatedCustomers: e.target.value }))}
                    className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50"
                  >
                    <option value="">Seçiniz</option>
                    <option value="1-10">1–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-200">51–200</option>
                    <option value="200+">200+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#7B8FAF] mb-1 block">Mesaj (opsiyonel)</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full bg-[#060D1A] border border-[#1A2540] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF5] focus:outline-none focus:border-[#00C8FF]/50 resize-none"
                  placeholder="Hedefleriniz veya sorularınız hakkında kısaca bilgi verin..."
                />
              </div>
              <Button
                type="submit"
                disabled={sending}
                className="w-full bg-[#00C8FF] hover:bg-[#00B0E0] text-[#060D1A] font-bold py-3"
              >
                {sending ? "Gönderiliyor..." : "Başvuruyu Gönder"}
              </Button>
              <p className="text-center text-xs text-[#5A6A80]">
                Mevcut partner programı hakkında bilgi almak için{" "}
                <Link href="/partner" className="text-[#00C8FF] hover:underline">partner.tsx</Link> sayfasını da inceleyebilirsiniz.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-12 px-4 text-center border-t border-[#1A2540]">
        <Shield className="h-10 w-10 text-[#00C8FF] mx-auto mb-4" />
        <p className="text-[#7B8FAF] text-sm max-w-md mx-auto">
          Sorularınız için <a href="mailto:partner@cyberstep.io" className="text-[#00C8FF] hover:underline">partner@cyberstep.io</a> adresine yazabilirsiniz.
        </p>
      </section>
    </div>
  );
}
