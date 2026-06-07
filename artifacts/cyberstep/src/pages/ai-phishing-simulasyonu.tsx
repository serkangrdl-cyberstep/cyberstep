import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useServicePrices, formatPrice } from "@/hooks/use-service-prices";
import { ChevronRight, Search, Mail, Shield, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

const SECTORS = [
  "Finans / Bankacılık", "Saglik", "Perakende / E-ticaret",
  "Bilisim / Yazilim", "Imalat / Uretim", "Hizmet", "Diger",
];

function LandingPage({ onStart }: { onStart: () => void }) {
  const { data: prices } = useServicePrices();
  const p = prices?.["ai-phishing"];
  const priceLabel = p ? `${formatPrice(p.amount, p.unit)} + KDV` : "1.990 TL + KDV · Tek Seferlik";
  return (
    <>
      <section className="py-20 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">{priceLabel}</Badge>
          <h1 className="text-4xl font-bold text-white mb-4">Yapay Zeka ile Sizi Hedef Alan Saldırı Böyle Görünür</h1>
          <p className="text-lg text-white/80 mb-6">
            Saldırganlar artık şirketinizin web sitesini, LinkedIn profilini ve kamuya açık verilerini yapay zeka ile analiz edip çalışanlarınıza özel e-postalar hazırlıyor.
          </p>
          <p className="text-lg text-white/80 mb-8">CyberStep, sizi hedef alan bir saldırının nasıl görüneceğini <strong className="text-white">3 farklı senaryoyla</strong> gösteriyor.</p>
          <button onClick={onStart} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors">
            Simülasyonu Başlat <ChevronRight className="h-5 w-5" />
          </button>
          <p className="text-xs text-muted-foreground mt-4">Hiçbir e-posta gönderilmez. Yalnızca farkındalık amaçlıdır.</p>

          <div className="grid grid-cols-3 gap-4 mt-10">
            {[
              { value: "%65,2", label: "Türk şirketleri geçen yıl saldırıya uğradı" },
              { value: "%71,3", label: "Çalışanlar yetersiz siber güvenlik eğitimi aldı" },
              { value: "14,6", label: "Ortalama yıllık saldırı sayısı (şirket başına)" },
            ].map(s => (
              <div key={s.value} className="rounded-xl bg-white/10 border border-white/20 p-4">
                <div className="text-3xl font-bold text-primary mb-1">{s.value}</div>
                <div className="text-xs text-white/70 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/40 mt-2">Kaynak: Fortinet / DORinsight 2025 Türkiye Siber Güvenlik Araştırması</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-10">Simülasyon Neyi İçerir?</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {[
              { icon: Search, title: "Şirketinize Özel Senaryolar", desc: "Genel şablonlar değil — domain'iniz, çalışan yapınız ve sektörünüze göre AI tarafından üretilen gerçekçi phishing senaryoları." },
              { icon: Mail, title: "3 Kritik Saldırı Vektörü", desc: "CEO Fraud, IT Destek Taklit, Tedarikçi/Fatura Dolandırıcılığı — Türkiye'de en sık kullanılan 3 senaryo türü." },
              { icon: Shield, title: "OSINT Tabanlı Analiz", desc: "Saldırganların sizi araştırmak için kullandığı kamuya açık veriler analiz edilir — DMARC açıkları, sızdırılmış veriler, dijital ayak izi." },
              { icon: AlertTriangle, title: "Raporla, Önlem Al", desc: "Hangi çalışan profili risk altında? Hangi departman önce eğitilmeli? Somut aksiyon önerileriyle hazır rapor." },
            ].map(f => (
              <div key={f.title} className="flex gap-4 p-5 rounded-xl border bg-card">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 text-center">Neden Beklememelisiniz?</h3>
            <ul className="space-y-3">
              {[
                "Saldırıların %91'i e-posta ile başlar — en savunmasız noktanız çalışanlarınız",
                "Ortalama bir phishing saldırısının maliyeti: 500.000 TL+ (BEC dahil)",
                "KVKK: Çalışan hatası sonucu veri ihlalinde şirket sorumluluğu devam eder",
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-2" />
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Etik Güvence</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Bu araç yalnızca farkındalık amaçlıdır. Hiçbir gerçek e-posta gönderilmez. Tüm veriler kamuya açık kaynaklardan alınır. Simülasyon raporları yalnızca sizi hedef aldığınızı size gösterir. Bu simülasyon yalnızca kendi şirketiniz için kullanılabilir. Gerçek phishing saldırısı gerçekleştirmez — yalnızca risk analizi ve eğitim senaryoları üretir.</p>
          </div>
        </div>
      </section>
    </>
  );
}

interface SimForm {
  companyName: string; domain: string; contactEmail: string;
  sector: string; employeeCount: string; consentAccepted: boolean;
}

function ConsentForm({ onCreated }: { onCreated: (id: number) => void }) {
  const { data: prices } = useServicePrices();
  const _p = prices?.["ai-phishing"];
  const submitLabel = _p ? `Simülasyonu Başlat — ${formatPrice(_p.amount, _p.unit)} + KDV` : "Simülasyonu Başlat — 1.990 TL + KDV";
  const [form, setForm] = useState<SimForm>({ companyName: "", domain: "", contactEmail: "", sector: "", employeeCount: "", consentAccepted: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof SimForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consentAccepted) { setError("Onay vermeniz gerekli."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/phishing-sim/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await r.json() as { id?: number; error?: string };
      if (!r.ok) { setError(data.error ?? "Hata oluştu"); return; }
      onCreated(data.id!);
    } catch { setError("Bir hata oluştu, lütfen tekrar deneyin."); }
    finally { setLoading(false); }
  };

  return (
    <div className="container mx-auto px-4 max-w-xl py-12">
      <div className="mb-6">
        <Badge variant="outline" className="mb-3">Simülasyon Bilgileri</Badge>
        <h2 className="text-2xl font-bold mb-1">Şirket Bilgilerini Girin</h2>
        <p className="text-muted-foreground text-sm">Kamuya açık veriler bu bilgiler kullanılarak toplanacak.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Şirket Adı *</label>
          <input value={form.companyName} onChange={set("companyName")} required placeholder="Örnek A.Ş." className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Domain (alan adı) *</label>
          <input value={form.domain} onChange={set("domain")} required placeholder="ornek.com.tr" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">İletişim E-postası</label>
          <input value={form.contactEmail} onChange={set("contactEmail")} type="email" placeholder="bilgi@ornek.com.tr" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Sektör</label>
            <select value={form.sector} onChange={set("sector")} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 outline-none">
              <option value="">Seçin</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Çalışan Sayısı</label>
            <select value={form.employeeCount} onChange={set("employeeCount")} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 outline-none">
              <option value="">Seçin</option>
              {["1-10", "11-50", "51-200", "201-500", "500+"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700/50 p-4">
          <label className="flex gap-3 cursor-pointer">
            <input type="checkbox" checked={form.consentAccepted} onChange={e => setForm(p => ({ ...p, consentAccepted: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Bu simülasyonun yalnızca farkındalık amaçlı olduğunu ve hiçbir gerçek saldırı veya e-posta gönderimi yapılmayacağını anlıyorum. Simülasyonda kullanılan veriler kamuya açık kaynaklardan alınacak.
            </span>
          </label>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={loading || !form.consentAccepted}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Başlatılıyor..." : submitLabel}
        </button>
      </form>
    </div>
  );
}

function ProgressView({ simId }: { simId: number }) {
  const { data } = useQuery<{ status: string; progress: number }>({
    queryKey: ["phishing-sim-status", simId],
    queryFn: () => fetch(`/api/phishing-sim/${simId}/status`).then(r => r.json()),
    refetchInterval: d => (d.state.data?.status === "ready" ? false : 2000),
  });
  const [, setLocation] = useLocation();

  if (data?.status === "ready") {
    setLocation(`/ai-phishing-simulasyonu/${simId}/rapor`);
    return null;
  }

  const steps = [
    { label: "Kamuya açık veriler toplanıyor", done: (data?.progress ?? 0) >= 20 },
    { label: "Web sitesi ve DNS analiz ediliyor", done: (data?.progress ?? 0) >= 40 },
    { label: "AI saldırı senaryoları oluşturuluyor", done: (data?.progress ?? 0) >= 60 },
    { label: "Rapor hazırlanıyor", done: (data?.progress ?? 0) >= 100 },
  ];

  return (
    <div className="container mx-auto px-4 max-w-md py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Clock className="h-8 w-8 text-primary animate-pulse" />
      </div>
      <h2 className="text-xl font-bold mb-2">Simülasyon Hazırlanıyor</h2>
      <p className="text-muted-foreground text-sm mb-8">Tahmini süre: 2–4 dakika</p>
      <div className="space-y-3 text-left">
        {steps.map(s => (
          <div key={s.label} className="flex items-center gap-3">
            {s.done ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
            <span className={`text-sm ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${data?.progress ?? 5}%` }} />
      </div>
    </div>
  );
}

type ViewMode = "landing" | "form" | "progress";

export default function AiPhishingSimulasyonu() {
  usePageMeta({ title: "AI Phishing Simülasyonu | CyberStep.io", description: "Şirketinize yönelik yapay zeka destekli saldırının nasıl görüneceğini öğrenin. 3 gerçekçi senaryo ile farkındalık." });
  const [view, setView] = useState<ViewMode>("landing");
  const [simId, setSimId] = useState<number | null>(null);

  return (
    <div>
      {view === "landing" && <LandingPage onStart={() => setView("form")} />}
      {view === "form" && <ConsentForm onCreated={id => { setSimId(id); setView("progress"); }} />}
      {view === "progress" && simId && <ProgressView simId={simId} />}
    </div>
  );
}
