import { useState } from "react";
import { Calendar, Bell, CheckCircle2, ArrowRight, Clock, FileText, AlertTriangle, RefreshCw, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageMeta } from "@/hooks/use-page-meta";

const DEADLINES_STATIC = [
  { regulation: "KVKK", task: "VERBİS Yıllık Güncelleme", deadline: "Ekim 2026", urgency: "medium", recurring: "Yıllık" },
  { regulation: "KVKK", task: "Veri İhlali Bildirimi Tatbikatı", deadline: "Sürekli", urgency: "high", recurring: "Yıllık" },
  { regulation: "BTK", task: "Elektronik Haberleşme Güvenlik Bildirimi", deadline: "Her yıl Mart", urgency: "medium", recurring: "Yıllık" },
  { regulation: "SİBER GÜV. BAŞKANLIĞI", task: "Ulusal Siber Güvenlik Stratejisi Uyum Raporu", deadline: "2025 sonuna kadar", urgency: "high", recurring: "Tek seferlik" },
  { regulation: "BDDK", task: "BT Risk Yönetimi Değerlendirmesi", deadline: "Her yıl Haziran", urgency: "high", recurring: "Yıllık" },
  { regulation: "ISO 27001", task: "Gözetim Denetimi", deadline: "Sertifika tarihinden 1 yıl sonra", urgency: "medium", recurring: "Yıllık" },
  { regulation: "PCI DSS", task: "Yıllık Güvenlik Değerlendirmesi", deadline: "Sözleşme yıl dönümü", urgency: "high", recurring: "Yıllık" },
  { regulation: "KVKK", task: "Açık Rıza Beyanları Gözden Geçirme", deadline: "Yılda 2 kez", urgency: "low", recurring: "6 Ayda bir" },
];

const NOTIFICATION_CHANNELS = [
  { channel: "E-posta", detail: "30, 14 ve 7 gün öncesi bildirim" },
  { channel: "WhatsApp", detail: "7 ve 1 gün öncesi acil hatırlatıcı" },
  { channel: "Tarayıcı bildirimi", detail: "Portalda anlık bildirim" },
  { channel: "Takvim daveti (.ics)", detail: "Google / Outlook / Apple Takvim'e aktarım" },
];

const SECTORS_REQS: Record<string, string[]> = {
  "finans": ["BDDK BT Yönetmeliği", "PCI DSS", "SWIFT CSCF", "FATF Siber Güvenlik", "SPK Siber Güvenlik Tebliği"],
  "saglik": ["Sağlık Bakanlığı Veri Güvenliği", "KVKK Özel Nitelikli Veri", "HIPAA (uluslararası ortaklar için)"],
  "enerji": ["EPDK Siber Güvenlik Düzenlemesi", "Kritik Altyapı Koruma", "SCADA Güvenliği"],
  "savunma": ["SSB Siber Güvenlik Gereksinimleri", "CMMC (ABD iş ortakları)", "ISO 27001 zorunlu"],
  "genel": ["KVKK / VERBİS", "BTK Elektronik Haberleşme Güvenliği", "Siber Güvenlik Başkanlığı Tebliği"],
};

type FormState = { company: string; email: string; phone: string; sector: string };
const EMPTY: FormState = { company: "", email: "", phone: "", sector: "" };

const urgencyColor = (u: string) =>
  u === "high" ? "text-red-500 bg-red-500/10 border-red-200" :
  u === "medium" ? "text-yellow-500 bg-yellow-500/10 border-yellow-200" :
  "text-blue-400 bg-blue-500/10 border-blue-200";

const urgencyLabel = (u: string) =>
  u === "high" ? "Yüksek" : u === "medium" ? "Orta" : "Düşük";

export default function ComplianceCalendar() {
  usePageMeta({
    title: "Compliance Calendar | CyberStep.io",
    description: "KVKK, VERBİS, BTK, BDDK ve ISO 27001 deadline takibi — otomatik hatırlatıcı sistemi.",
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [selectedSector, setSelectedSector] = useState("genel");

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company || !form.email) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sector: selectedSector, leadType: "compliance-calendar" }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-500/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 mb-4">Compliance Calendar</Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight max-w-2xl">
            Hiçbir Regülasyon Deadline'ını<br />Kaçırmayın
          </h1>
          <p className="text-white/80 text-base mb-6 max-w-xl leading-relaxed">
            KVKK yıllık bildirimi, VERBİS güncelleme tarihleri, BTK bildirim süreleri, BDDK değerlendirmeleri —
            hepsini tek takvimde takip edin. 30-14-7 gün öncesi WhatsApp ve e-posta hatırlatıcısı.
          </p>
          <div className="flex flex-wrap gap-3">
            {["KVKK / VERBİS", "BTK", "BDDK", "ISO 27001", "PCI DSS", "Siber Güvenlik Başkanlığı"].map(t => (
              <span key={t} className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Deadline table preview */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Örnek Takvim</h2>
            <span className="text-xs text-muted-foreground">Sektörünüze göre kişiselleştirilir</span>
          </div>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-4 bg-muted/30 border-b border-border/30 px-4 py-2">
              {["Düzenleme", "Yükümlülük", "Deadline", "Öncelik"].map(h => (
                <span key={h} className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {DEADLINES_STATIC.map((d, i) => (
              <div key={i} className="grid grid-cols-4 items-center px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                <span className="text-xs font-bold text-primary">{d.regulation}</span>
                <span className="text-sm text-foreground pr-3">{d.task}</span>
                <span className="text-xs text-muted-foreground">{d.deadline}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border w-fit ${urgencyColor(d.urgency)}`}>{urgencyLabel(d.urgency)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Gerçek takvim Gemini AI ile sektörünüze ve şirket büyüklüğüne göre hesaplanır</p>
        </div>
      </section>

      {/* Sector-based requirements */}
      <section className="py-14 bg-muted/20 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-xl font-bold text-foreground mb-4">Sektöre Göre Gereksinimler</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.keys(SECTORS_REQS).map(s => (
              <button
                key={s}
                onClick={() => setSelectedSector(s)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium capitalize transition-colors
                  ${selectedSector === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                {s === "genel" ? "Genel KOBİ" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-border/50 bg-card/30 p-5">
            <ul className="space-y-2">
              {(SECTORS_REQS[selectedSector] ?? []).map(req => (
                <li key={req} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4 text-primary" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Notification + form */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-5">Bildirim Kanalları</h2>
              <div className="space-y-3 mb-6">
                {NOTIFICATION_CHANNELS.map(n => (
                  <div key={n.channel} className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/30 p-4">
                    <Bell className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{n.channel}</p>
                      <p className="text-xs text-muted-foreground">{n.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">White-Label Seçeneği</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  KVKK danışmanları ve muhasebe firmaları için white-label olarak sunulabilir.
                  Kendi markanızla müşterilerinize compliance takip servisi sağlayın.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <Calendar className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-bold text-foreground text-base mb-1">Compliance Takvimi Oluşturun</h3>
              <p className="text-xs text-muted-foreground mb-5">Sektörünüzü seçin, şirket bilgilerinizi girin — Gemini AI ile kişiselleştirilmiş takvim 24 saat içinde e-postanızda.</p>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="font-semibold text-foreground">Talebiniz alındı</p>
                  <p className="text-xs text-muted-foreground">Kişiselleştirilmiş compliance takvimi 24 saat içinde e-postanıza gelecek.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder="Şirket adı" value={form.company} onChange={set("company")} required />
                  <Input placeholder="E-posta" type="email" value={form.email} onChange={set("email")} required />
                  <Input placeholder="Telefon (isteğe bağlı)" value={form.phone} onChange={set("phone")} />
                  <Select value={selectedSector} onValueChange={setSelectedSector}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Sektör seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="genel">Genel KOBİ</SelectItem>
                      <SelectItem value="finans">Finans / Bankacılık</SelectItem>
                      <SelectItem value="saglik">Sağlık</SelectItem>
                      <SelectItem value="enerji">Enerji / Kritik Altyapı</SelectItem>
                      <SelectItem value="savunma">Savunma Sanayii</SelectItem>
                    </SelectContent>
                  </Select>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button type="submit" disabled={sending} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                    {sending ? "Gönderiliyor..." : <>Takvim Oluştur <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </form>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center">Standart aboneliklere dahil &mdash; White-label: 990 TL/ay</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
