import { useState, useEffect } from "react";
import { Shield, Download, FileText, Lock, CheckCircle, Mail, Building2, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const REPORT_TYPES = [
  {
    type: "easm",
    title: "Dış Saldırı Yüzeyi Analizi",
    subtitle: "EASM Raporu",
    description: "Maruz kalan alt alan adları, açık portlar, SSL sertifika durumu ve risk puanlaması içeren kapsamlı EASM tarama örneği.",
    icon: "🌐",
    tags: ["DNS", "Port Tarama", "SSL", "Alt Alan Adları"],
    score: 62,
    riskColor: "bg-yellow-500",
    riskLabel: "Orta Risk",
  },
  {
    type: "email_security",
    title: "E-posta Güvenlik Değerlendirmesi",
    subtitle: "SPF / DMARC / DKIM",
    description: "SPF, DMARC, DKIM kayıtlarının analizi ile phishing ve e-posta sahtekarlığına karşı açıklık tespiti.",
    icon: "📧",
    tags: ["SPF", "DMARC", "DKIM", "Phishing"],
    score: 45,
    riskColor: "bg-red-500",
    riskLabel: "Yüksek Risk",
  },
  {
    type: "board_report",
    title: "Yönetim Kurulu Raporu",
    subtitle: "Üst Yönetime Özet",
    description: "Teknik detaylar olmadan yönetim kuruluna sunulmak üzere hazırlanmış siber güvenlik durum özeti.",
    icon: "📊",
    tags: ["Yönetim Kurulu", "Risk", "Özet", "KPI"],
    score: 71,
    riskColor: "bg-green-500",
    riskLabel: "Düşük Risk",
  },
  {
    type: "cve_alert",
    title: "CVE Güvenlik Açığı Alarmı",
    subtitle: "Kritik CVE Uyarıları",
    description: "Teknoloji yığınına özgü aktif istismar edilen CVE'lerin tespiti ve Türkiye etkisi değerlendirmesi.",
    icon: "⚠️",
    tags: ["CVE", "CVSS", "CISA KEV", "Patch"],
    score: 38,
    riskColor: "bg-red-600",
    riskLabel: "Kritik Risk",
  },
  {
    type: "tprm",
    title: "Tedarikçi Risk Yönetimi",
    subtitle: "3. Taraf Risk (TPRM)",
    description: "Kritik tedarikçilerin güvenlik duruşu, domain sağlığı ve compliance riski değerlendirmesi.",
    icon: "🔗",
    tags: ["Tedarikçi", "TPRM", "Compliance", "Risk"],
    score: 58,
    riskColor: "bg-yellow-500",
    riskLabel: "Orta Risk",
  },
  {
    type: "threat_intel",
    title: "Tehdit İstihbaratı Özeti",
    subtitle: "Sektörel Tehdit Analizi",
    description: "Sektöre özel tehdit aktörleri, aktif kampanyalar ve MITRE ATT&CK haritalama özeti.",
    icon: "🎯",
    tags: ["Tehdit Aktörü", "MITRE", "IOC", "Sektör"],
    score: 55,
    riskColor: "bg-orange-500",
    riskLabel: "Orta-Yüksek",
  },
];

interface LeadForm {
  name: string;
  email: string;
  company: string;
}

interface DownloadState {
  loading: boolean;
  done: boolean;
  pdfUrl?: string;
}

export default function DemoPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", company: "" });
  const [state, setState] = useState<DownloadState>({ loading: false, done: false });
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rapor = params.get("rapor");
    if (rapor && REPORT_TYPES.some((r) => r.type === rapor)) {
      setSelected(rapor);
      setState({ loading: false, done: false });
      setForm({ name: "", email: "", company: "" });
    }
  }, []);

  function openModal(type: string) {
    setSelected(type);
    setState({ loading: false, done: false });
    setForm({ name: "", email: "", company: "" });
  }

  function closeModal() {
    setSelected(null);
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setState({ loading: true, done: false });
    try {
      const res = await fetch("/api/public/demo/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: selected, ...form }),
      });
      if (!res.ok) throw new Error("Sunucu hatası");
      const data = await res.json() as { pdfUrl?: string };
      setState({ loading: false, done: true, pdfUrl: data.pdfUrl });
      toast({ title: "Rapor hazır", description: "PDF indirmeniz başlıyor." });
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }
    } catch {
      setState({ loading: false, done: false });
      toast({ title: "Hata", description: "Rapor indirilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }

  const selectedReport = REPORT_TYPES.find((r) => r.type === selected);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-muted/30 py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            Örnek Raporlar
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Gerçek Tarama Verisiyle Hazırlanmış Demo Raporlar
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            CyberStep.io'nun ürettiği raporların kalitesini görmek için aşağıdan bir örnek indirin.
            Veriler anonimleştirilmiş gerçek taramalardan alınmıştır.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {REPORT_TYPES.map((r) => (
            <div key={r.type} className="border rounded-xl p-5 bg-card hover:shadow-md transition-shadow flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <span className="text-3xl">{r.icon}</span>
                <span className={`text-xs text-white px-2 py-0.5 rounded-full font-medium ${r.riskColor}`}>
                  {r.riskLabel}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{r.subtitle}</p>
                <h3 className="font-semibold text-base mt-0.5">{r.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground flex-1">{r.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Risk Skoru: <strong>{r.score}/100</strong></span>
                <Button size="sm" onClick={() => openModal(r.type)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  PDF İndir
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 border rounded-xl p-6 bg-muted/20 text-center">
          <p className="text-sm font-medium mb-4 text-muted-foreground">Demo raporlar hakkında</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Gerçek taramadan anonimleştirildi</span>
            <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-blue-500" /> Bilgileriniz güvenle saklanır</span>
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-orange-500" /> PDF formatında teslim</span>
            <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-purple-500" /> Spam gönderilmez</span>
          </div>
        </div>
      </div>

      {/* Download Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedReport?.icon}</span>
              {selectedReport?.title}
            </DialogTitle>
            <DialogDescription>
              PDF'yi indirmek için bilgilerinizi girin. Spam göndermeyiz.
            </DialogDescription>
          </DialogHeader>

          {state.done ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold text-lg">Rapor hazır!</p>
              <p className="text-muted-foreground text-sm">Yeni sekmede PDF açılıyor olmalı.</p>
              {state.pdfUrl && (
                <Button asChild className="mt-2" size="sm" variant="outline">
                  <a href={state.pdfUrl} target="_blank" rel="noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Tekrar İndir
                  </a>
                </Button>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                CyberStep.io ekibi kısa sürede sizinle iletişime geçebilir.
              </p>
            </div>
          ) : (
            <form onSubmit={handleDownload} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="demo-name">Ad Soyad <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="demo-name"
                    className="pl-9"
                    placeholder="Ali Yılmaz"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-email">Kurumsal E-posta <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="demo-email"
                    type="email"
                    className="pl-9"
                    placeholder="ali@sirket.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-company">Şirket Adı</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="demo-company"
                    className="pl-9"
                    placeholder="Şirket A.Ş."
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Bilgileriniz yalnızca demo rapor talebi kapsamında kullanılacak. Üçüncü taraflarla paylaşılmaz.</span>
              </div>
              <Button type="submit" className="w-full" disabled={state.loading}>
                {state.loading ? "Rapor oluşturuluyor..." : (
                  <><Download className="w-4 h-4 mr-2" />PDF İndir</>
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
