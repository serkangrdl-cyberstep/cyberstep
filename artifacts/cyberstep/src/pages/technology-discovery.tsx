import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield, CheckCircle, FileText, Users, Clock, ChevronRight, ChevronDown,
  ChevronUp, Lock, AlertTriangle, Loader2, ArrowRight, Building2,
  Cpu, Network, Database, Cloud, HardDrive, BarChart2, Bot, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

// ─── Survey data ─────────────────────────────────────────────────────────────

interface SurveyOption { value: string; label: string }
interface SurveyField {
  key: string;
  label: string;
  hasVersion?: boolean;
  hasModel?: boolean;
  hasHA?: boolean;
}
interface SurveySectionDef {
  key: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  options: SurveyOption[];
  fields?: SurveyField[];
  freeTextLabel?: string;
}

const SURVEY_SECTIONS: SurveySectionDef[] = [
  {
    key: "identity_email",
    title: "Kimlik ve E-posta",
    icon: <Users className="h-5 w-5" />,
    description: "Kurumsal e-posta ve kimlik yönetimi altyapınız",
    options: [
      { value: "m365", label: "Microsoft 365" },
      { value: "google_workspace", label: "Google Workspace" },
      { value: "exchange_onprem", label: "Exchange On-Premise" },
      { value: "zimbra", label: "Zimbra" },
      { value: "yandex", label: "Yandex Mail (Kurumsal)" },
      { value: "none", label: "Kurumsal e-posta yok / bilmiyorum" },
    ],
    freeTextLabel: "Eklemek istediğiniz bilgi (aktif kullanıcı sayısı vb.)",
  },
  {
    key: "firewall",
    title: "Güvenlik Duvarı (Firewall)",
    icon: <Shield className="h-5 w-5" />,
    description: "Ağ çevrenizi koruyan güvenlik duvarı ve UTM cihazları",
    options: [
      { value: "fortinet", label: "Fortinet FortiGate" },
      { value: "paloalto", label: "Palo Alto Networks" },
      { value: "sophos", label: "Sophos XGS / XG" },
      { value: "checkpoint", label: "Check Point" },
      { value: "sonicwall", label: "SonicWall" },
      { value: "cisco_asa", label: "Cisco ASA / FTD" },
      { value: "juniper", label: "Juniper SRX" },
      { value: "pfsense", label: "pfSense / OPNsense" },
      { value: "none", label: "Dedicated firewall yok" },
    ],
    fields: [
      { key: "fortinet", label: "Fortinet model (örn: FortiGate 100F)", hasVersion: true, hasHA: true },
      { key: "paloalto", label: "Palo Alto model (örn: PA-820)", hasVersion: true },
      { key: "sophos", label: "Sophos model", hasVersion: true },
      { key: "checkpoint", label: "Check Point model", hasVersion: true },
    ],
    freeTextLabel: "HA yapılandırması, cluster durumu veya ek notlar",
  },
  {
    key: "endpoint",
    title: "Uç Nokta Koruması (EDR/AV)",
    icon: <ShieldCheck className="h-5 w-5" />,
    description: "Bilgisayar ve sunucularınızda çalışan güvenlik yazılımları",
    options: [
      { value: "defender", label: "Microsoft Defender (ATP/EDR)" },
      { value: "crowdstrike", label: "CrowdStrike Falcon" },
      { value: "sentinelone", label: "SentinelOne" },
      { value: "trendmicro", label: "Trend Micro" },
      { value: "eset", label: "ESET Endpoint" },
      { value: "kaspersky", label: "Kaspersky" },
      { value: "symantec", label: "Symantec / Broadcom" },
      { value: "none", label: "EDR/AV yok" },
    ],
    freeTextLabel: "Lisans kapsamı, yönetilen uç nokta sayısı",
  },
  {
    key: "server",
    title: "Sunucu Altyapısı",
    icon: <HardDrive className="h-5 w-5" />,
    description: "Fiziksel, sanal ve bulut sunucu altyapınız",
    options: [
      { value: "physical", label: "Fiziksel Sunucular (on-premise)" },
      { value: "vmware", label: "VMware vSphere / vCenter" },
      { value: "hyperv", label: "Microsoft Hyper-V" },
      { value: "nutanix", label: "Nutanix" },
      { value: "azure", label: "Microsoft Azure" },
      { value: "aws", label: "Amazon AWS" },
      { value: "gcp", label: "Google Cloud" },
      { value: "hetzner", label: "Hetzner / Yerel veri merkezi" },
    ],
    freeTextLabel: "Sunucu sayısı, kritik workload'lar",
  },
  {
    key: "backup",
    title: "Yedekleme Çözümü",
    icon: <Database className="h-5 w-5" />,
    description: "Veri yedekleme ve felaket kurtarma altyapınız",
    options: [
      { value: "veeam", label: "Veeam Backup & Replication" },
      { value: "commvault", label: "Commvault" },
      { value: "acronis", label: "Acronis Cyber Backup" },
      { value: "azure_backup", label: "Azure Backup / Site Recovery" },
      { value: "aws_backup", label: "AWS Backup" },
      { value: "veritas", label: "Veritas NetBackup" },
      { value: "local_disk", label: "Yerel disk / NAS yedekleme" },
      { value: "none", label: "Düzenli yedek alınmıyor" },
    ],
    freeTextLabel: "Son geri yükleme testi tarihi, RPO/RTO hedefleri",
  },
  {
    key: "erp",
    title: "ERP / Muhasebe Sistemi",
    icon: <BarChart2 className="h-5 w-5" />,
    description: "İş süreçleri ve finans yönetim yazılımları",
    options: [
      { value: "sap", label: "SAP (ECC / S4HANA / B1)" },
      { value: "logo", label: "Logo Tiger / İdea / GO" },
      { value: "mikro", label: "Mikro" },
      { value: "netsis", label: "Netsis" },
      { value: "oracle_ebs", label: "Oracle E-Business Suite" },
      { value: "dynamics", label: "Microsoft Dynamics 365" },
      { value: "isbasi", label: "İşbaşı" },
      { value: "none", label: "ERP yok / muhasebe firması kullanılıyor" },
    ],
    freeTextLabel: "On-premise mi SaaS mı, bulunduğu ortam",
  },
  {
    key: "saas",
    title: "Kritik SaaS Uygulamaları",
    icon: <Cloud className="h-5 w-5" />,
    description: "İş süreçlerinizde kritik rol oynayan bulut uygulamalar",
    options: [
      { value: "salesforce", label: "Salesforce CRM" },
      { value: "hubspot", label: "HubSpot" },
      { value: "jira", label: "Jira / Confluence (Atlassian)" },
      { value: "github", label: "GitHub / GitLab" },
      { value: "slack", label: "Slack / Teams" },
      { value: "zoom", label: "Zoom / Webex" },
      { value: "servicenow", label: "ServiceNow" },
      { value: "zendesk", label: "Zendesk" },
    ],
    freeTextLabel: "Kritik iş süreçleri bu uygulamalara bağlı mı?",
  },
  {
    key: "ot_scada",
    title: "OT / SCADA / Endüstriyel Sistemler",
    icon: <Network className="h-5 w-5" />,
    description: "Üretim, tesis ve endüstriyel kontrol sistemleri",
    options: [
      { value: "none", label: "OT/SCADA sistemi yok / uygulanamaz" },
      { value: "siemens", label: "Siemens S7 / TIA Portal" },
      { value: "rockwell", label: "Rockwell / Allen-Bradley" },
      { value: "schneider", label: "Schneider Electric" },
      { value: "yokogawa", label: "Yokogawa" },
      { value: "honeywell", label: "Honeywell" },
      { value: "scada_custom", label: "Özel/yerli SCADA sistemi" },
    ],
    freeTextLabel: "BT/OT ağ ayrımı var mı? Air-gap uygulaması?",
  },
  {
    key: "ai_usage",
    title: "Yapay Zeka (AI) Araç Kullanımı",
    icon: <Bot className="h-5 w-5" />,
    description: "Kurumsal veya bireysel olarak kullanılan AI araçları",
    options: [
      { value: "chatgpt", label: "ChatGPT (OpenAI)" },
      { value: "gemini", label: "Gemini (Google)" },
      { value: "claude", label: "Claude (Anthropic)" },
      { value: "copilot_ms", label: "Microsoft Copilot / M365 Copilot" },
      { value: "copilot_github", label: "GitHub Copilot" },
      { value: "midjourney", label: "Midjourney / DALL-E" },
      { value: "none", label: "Henüz AI araç kullanılmıyor" },
    ],
    freeTextLabel: "Kurumsal veri AI'a iletiliyor mu? API entegrasyonu var mı?",
  },
  {
    key: "compliance",
    title: "Uyumluluk ve Sertifikasyon",
    icon: <FileText className="h-5 w-5" />,
    description: "Tabi olduğunuz yasal ve sektörel düzenlemeler",
    options: [
      { value: "kvkk", label: "KVKK (Kişisel Verilerin Korunması)" },
      { value: "iso27001", label: "ISO 27001 (sertifikalı veya hedef)" },
      { value: "pci_dss", label: "PCI DSS (kart verisi)" },
      { value: "nis2", label: "NIS2 (AB direktifi)" },
      { value: "tisax", label: "TISAX (otomotiv tedarik zinciri)" },
      { value: "soc2", label: "SOC 2 (bulut/SaaS)" },
      { value: "bddk", label: "BDDK / SPK bilgi güvenliği tebliğleri" },
      { value: "none", label: "Zorunlu uyumluluk yükümlülüğü yok" },
    ],
    freeTextLabel: "Yaklaşan denetim tarihleri veya ceza riski",
  },
];

const STATUS_LABELS: Record<string, string> = {
  pending_nda: "NDA Bekleniyor",
  survey_in_progress: "Anket Devam Ediyor",
  survey_complete: "Anket Tamamlandı",
  workshop_scheduled: "Workshop Planlandı",
  workshop_complete: "Workshop Tamamlandı",
  cmdb_created: "Teknoloji Kaydı Oluşturuldu",
};

const STATUS_COLORS: Record<string, string> = {
  pending_nda: "bg-yellow-100 text-yellow-800 border-yellow-300",
  survey_in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  survey_complete: "bg-green-100 text-green-800 border-green-300",
  workshop_scheduled: "bg-purple-100 text-purple-800 border-purple-300",
  workshop_complete: "bg-purple-200 text-purple-900 border-purple-400",
  cmdb_created: "bg-emerald-100 text-emerald-800 border-emerald-400",
};

// ─── Sub-views ────────────────────────────────────────────────────────────────

function StartForm({ onCreated }: { onCreated: (token: string) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", contactName: "", companyName: "", phone: "", sector: "", domain: "" });
  const [loading, setLoading] = useState(false);

  const SECTORS = ["Finans / Bankacılık", "Sağlık", "Perakende / E-ticaret", "Üretim / Sanayi", "Bilişim / Teknoloji", "Enerji / Altyapı", "Hukuk / Danışmanlık", "Eğitim", "Kamu", "Diğer"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.contactName || !form.companyName) {
      toast({ title: "Lütfen zorunlu alanları doldurun", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/tech-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json() as { token?: string; error?: string };
      if (!r.ok || !data.token) throw new Error(data.error ?? "Hata");
      onCreated(data.token);
    } catch (err) {
      toast({ title: "Kayıt oluşturulamadı", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">Technology Discovery</Badge>
        <h1 className="text-3xl font-bold mb-3">Teknoloji Keşif Sürecini Başlatın</h1>
        <p className="text-muted-foreground">
          Ortamınızı anlamamıza yardımcı olun. Bilgilerinizi girin — NDA imzaladıktan sonra teknoloji anketi açılacak.
        </p>
      </div>

      <Card className="p-6 border shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ad Soyad <span className="text-destructive">*</span></Label>
              <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Ahmet Yılmaz" required />
            </div>
            <div className="space-y-1.5">
              <Label>E-posta <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ahmet@sirket.com" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Şirket Adı <span className="text-destructive">*</span></Label>
            <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Şirket A.Ş." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+90 532 000 00 00" />
            </div>
            <div className="space-y-1.5">
              <Label>Sektör</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.sector}
                onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
              >
                <option value="">Seçin</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Web / Domain (opsiyonel — otomatik doldurmak için)</Label>
            <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="sirketiniz.com.tr" />
            <p className="text-xs text-muted-foreground">Domain girerseniz daha önce taradığımız bilgileri ankete önceden yükleriz.</p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Devam Et — NDA Adımına Geç
          </Button>
        </form>
      </Card>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
        {[
          { icon: <Lock className="h-5 w-5 mx-auto mb-1 text-primary" />, text: "Gizlilik sözleşmesi (NDA) ile korunan süreç" },
          { icon: <Users className="h-5 w-5 mx-auto mb-1 text-primary" />, text: "Yetkili partner iş ortağı ile 1 saatlik workshop" },
          { icon: <Database className="h-5 w-5 mx-auto mb-1 text-primary" />, text: "Kişiselleştirilmiş Teknoloji Kaydı (CMDB) çıktısı" },
        ].map((item, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3">
            {item.icon}
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NdaView({ token, onAccepted }: { token: string; onAccepted: () => void }) {
  const [partnerConsent, setPartnerConsent] = useState(false);
  const [generalConsent, setGeneralConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleAccept() {
    if (!generalConsent) {
      toast({ title: "NDA'yı onaylamanız gerekiyor", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/tech-discovery/${token}/accept-nda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerSharingConsent: partnerConsent }),
      });
      if (!r.ok) throw new Error("İstek başarısız");
      onAccepted();
    } catch {
      toast({ title: "NDA kabul edilemedi, lütfen tekrar deneyin", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Gizlilik Sözleşmesi (NDA)</h2>
        <p className="text-muted-foreground text-sm">Teknoloji anketine geçmeden önce lütfen gizlilik koşullarını okuyun ve onaylayın.</p>
      </div>

      <Card className="p-6 border mb-4 text-sm space-y-4 leading-relaxed text-muted-foreground max-h-96 overflow-y-auto">
        <p className="font-semibold text-foreground text-base">GİZLİLİK SÖZLEŞMESİ (NDA)</p>

        <p><strong className="text-foreground">1. Taraflar</strong><br />
          Bu sözleşme, <strong>CyberStep Bilgi Teknolojileri A.Ş.</strong> ("CyberStep") ile yukarıda bilgileri girilen kuruluş ("Müşteri") arasında akdedilmektedir.
        </p>

        <p><strong className="text-foreground">2. Kapsam</strong><br />
          Müşteri, Technology Discovery süreci kapsamında paylaşacağı tüm teknik ve organizasyonel bilgilerin (kullanılan yazılım, donanım, versiyon bilgileri, ağ topolojisi vb.) gizli bilgi niteliği taşıdığını kabul eder.
        </p>

        <p><strong className="text-foreground">3. CyberStep Yükümlülükleri</strong><br />
          CyberStep; Müşteri'nin paylaştığı gizli bilgileri yalnızca hizmet kapsamında kullanacağını, üçüncü taraflarla paylaşmayacağını ve bu bilgileri hizmet süresi boyunca ve sonrasında 5 (beş) yıl süreyle gizli tutacağını taahhüt eder.
        </p>

        <p><strong className="text-foreground">4. Yetkili İş Ortağı (Partner) Paylaşımı</strong><br />
          CyberStep, vCISO hizmetinin sunumunda yetkili iş ortaklarından yararlanmaktadır. Müşteri, onay vermesi durumunda teknoloji envanteri bilgilerinin yalnızca CyberStep ile gizlilik sözleşmesi imzalamış <strong>yetkili delivery partner</strong>'a aktarılabileceğini kabul eder. Partner, bu bilgileri hizmet dışı amaçlarla kullanamaz ve üçüncü taraflarla paylaşamaz. Müşteri bu onayı vermek zorunda değildir; ancak onay verilmemesi halinde workshop yetkili CyberStep personeli ile yürütülür.
        </p>

        <p><strong className="text-foreground">5. Veri Güvenliği</strong><br />
          Paylaşılan bilgiler CyberStep altyapısında şifreli olarak saklanır. KVKK kapsamındaki kişisel verilerin işlenmesine ilişkin detaylar CyberStep Gizlilik Politikası'nda yer almaktadır.
        </p>

        <p><strong className="text-foreground">6. Hukuki Çerçeve</strong><br />
          Bu sözleşme Türk Hukuku'na tabi olup uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
        </p>

        <p className="text-xs italic text-muted-foreground/70">
          Not: Bu NDA taslak olup avukat incelemesinden geçirilmeden önce bağlayıcı olarak sunulamaz. Lütfen hukuki danışmanlık alınız.
        </p>
      </Card>

      <div className="space-y-3 mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={generalConsent} onCheckedChange={(v) => setGeneralConsent(v === true)} className="mt-0.5" />
          <span className="text-sm">
            Yukarıdaki Gizlilik Sözleşmesi'ni okudum, anladım ve kabul ediyorum. Bu onayın elektronik imza hükmünde olduğunu ve kayıt altına alındığını anlıyorum.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={partnerConsent} onCheckedChange={(v) => setPartnerConsent(v === true)} className="mt-0.5" />
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">(Opsiyonel)</strong> Teknoloji envanteri bilgilerimin, CyberStep ile gizlilik sözleşmesi imzalamış yetkili delivery partner ile paylaşılmasına onay veriyorum.
          </span>
        </label>
      </div>

      <Button onClick={handleAccept} disabled={!generalConsent || loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
        NDA'yı Kabul Et — Ankete Geç
      </Button>
    </div>
  );
}

function SurveyView({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; freeText: string }>>({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { toast } = useToast();

  const section = SURVEY_SECTIONS[currentIdx];
  const current = answers[section.key] ?? { selected: [], freeText: "" };

  function toggleOption(value: string) {
    setAnswers(prev => {
      const cur = prev[section.key] ?? { selected: [], freeText: "" };
      const alreadySelected = cur.selected.includes(value);
      return {
        ...prev,
        [section.key]: {
          ...cur,
          selected: alreadySelected ? cur.selected.filter(v => v !== value) : [...cur.selected, value],
        },
      };
    });
  }

  async function saveSection() {
    setSaving(true);
    try {
      await fetch(`/api/tech-discovery/${token}/survey/${section.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedProducts: current.selected,
          freeText: current.freeText,
          completedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // silent — will retry on complete
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveSection();
    if (currentIdx < SURVEY_SECTIONS.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      await handleComplete();
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const r = await fetch(`/api/tech-discovery/${token}/complete-survey`, { method: "POST" });
      if (!r.ok) throw new Error();
      onComplete();
    } catch {
      toast({ title: "Tamamlanamadı, lütfen tekrar deneyin", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  }

  const progress = Math.round(((currentIdx + 1) / SURVEY_SECTIONS.length) * 100);
  const isLast = currentIdx === SURVEY_SECTIONS.length - 1;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Bölüm {currentIdx + 1} / {SURVEY_SECTIONS.length}</span>
          <span>%{progress} tamamlandı</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Card className="p-6 border">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{section.icon}</div>
          <div>
            <h3 className="font-bold text-lg">{section.title}</h3>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
        </div>

        <hr className="my-4" />

        <p className="text-sm font-medium mb-3">Kullanılan ürünleri seçin (birden fazla seçilebilir):</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {section.options.map(opt => {
            const isSelected = current.selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${isSelected ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}
              >
                {isSelected && <CheckCircle className="h-3.5 w-3.5 inline mr-1.5 text-primary" />}
                {opt.label}
              </button>
            );
          })}
        </div>

        {section.freeTextLabel && (
          <div className="space-y-1.5">
            <Label className="text-sm">{section.freeTextLabel} <span className="text-muted-foreground">(opsiyonel)</span></Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              value={current.freeText}
              onChange={e => setAnswers(prev => ({ ...prev, [section.key]: { ...current, freeText: e.target.value } }))}
              placeholder="Serbest not..."
            />
          </div>
        )}
      </Card>

      <div className="flex gap-3 mt-4">
        {currentIdx > 0 && (
          <Button variant="outline" onClick={() => setCurrentIdx(i => i - 1)} className="flex-1">
            Geri
          </Button>
        )}
        <Button onClick={handleNext} disabled={saving || completing} className={currentIdx > 0 ? "flex-1" : "w-full"}>
          {(saving || completing) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isLast ? "Anketi Tamamla" : "Sonraki Bölüm"}
          {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 mt-5 justify-center">
        {SURVEY_SECTIONS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => i < currentIdx && setCurrentIdx(i)}
            className={`w-7 h-7 rounded-full text-xs font-medium border transition-all ${i === currentIdx ? "bg-primary text-primary-foreground border-primary" : i < currentIdx ? "bg-green-500 text-white border-green-500 cursor-pointer" : "bg-muted text-muted-foreground border-border cursor-default"}`}
          >
            {i < currentIdx ? "✓" : i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompletionView({ token }: { token: string }) {
  const STEPS = [
    { label: "NDA Kabul Edildi", icon: <Lock className="h-4 w-4" />, done: true },
    { label: "Teknoloji Anketi Tamamlandı", icon: <CheckCircle className="h-4 w-4" />, done: true },
    { label: "Workshop Planlanıyor", icon: <Users className="h-4 w-4" />, done: false },
    { label: "Teknoloji Kaydı (CMDB) Oluşturulacak", icon: <Database className="h-4 w-4" />, done: false },
  ];

  return (
    <div className="max-w-xl mx-auto text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
        <CheckCircle className="h-8 w-8 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Anket Tamamlandı</h2>
      <p className="text-muted-foreground mb-8">
        Teknoloji envanterinizi aldık. Ekibimiz inceleyecek ve 1-2 iş günü içinde workshop için sizinle iletişime geçecek.
      </p>

      <Card className="p-5 text-left mb-6">
        <p className="text-sm font-semibold mb-4">Sonraki adımlar:</p>
        <ul className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <div className={`p-1.5 rounded-full ${step.done ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                {step.icon}
              </div>
              <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
              {step.done && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
              {!step.done && <Clock className="h-4 w-4 text-muted-foreground ml-auto" />}
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-muted-foreground">
        Referans kodunuz: <span className="font-mono bg-muted px-2 py-0.5 rounded">{token.slice(0, 8).toUpperCase()}</span>
      </p>
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onStart }: { onStart: () => void }) {
  const PHASES = [
    { num: "1", title: "Gizlilik Sözleşmesi (NDA)", desc: "Dijital NDA — bir tıkla onaylayın. Bilgileriniz şifreli olarak saklanır.", icon: <Lock className="h-5 w-5 text-primary" /> },
    { num: "2", title: "Teknoloji Anketi (10 bölüm)", desc: "Firewall, EDR, ERP, bulut, uyumluluk ve AI kullanımı dahil 10 kategoride wizard.", icon: <Cpu className="h-5 w-5 text-primary" /> },
    { num: "3", title: "Doğrulama Workshop'u (1 saat)", desc: "Yetkili vCISO partner ile online toplantı. Anket verileri doğrulanır ve sorular sorulur.", icon: <Users className="h-5 w-5 text-primary" /> },
    { num: "4", title: "Teknoloji Kaydı (CMDB)", desc: "Ortamınızın tam haritası. CVE feed'leriyle sürekli güncellenen risk korelasyonu.", icon: <Database className="h-5 w-5 text-primary" /> },
  ];

  return (
    <div>
      <section className="py-16 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">Tek Seferlik Servis</Badge>
          <h1 className="text-4xl font-bold text-white mb-4">
            CyberStep Technology Discovery
          </h1>
          <p className="text-white/80 text-lg mb-6">
            Dış tarama güçlü bir başlangıç. Gerçek vCISO değeri ise ortamınızın içini bilmekten geliyor.
            NDA + anket + workshop ile teknoloji envanterinizi oluşturuyoruz.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">9.900 TL</p>
              <p className="text-white/60 text-sm">+ KDV — tek seferlik</p>
            </div>
            <Button size="lg" onClick={onStart} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Hemen Başlat <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-10">4 Fazlı Süreç</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PHASES.map(p => (
              <div key={p.num} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{p.num}</div>
                  <div className="p-2 rounded-lg bg-primary/10">{p.icon}</div>
                </div>
                <h3 className="font-semibold mb-1 text-sm">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-xl font-bold text-center mb-8">Neden Teknoloji Envanteri Kritik?</h2>
          <div className="grid md:grid-cols-3 gap-5 text-sm">
            {[
              { title: "Kör nokta riski", desc: "Ortamda ne çalıştığını bilmeden hangi CVE'nin sizi etkilediğini söyleyemezsiniz." },
              { title: "CVE korelasyonu", desc: "FortiOS sürümünüzü bilince, yeni kritik açık çıktığında anında sizi uyarabiliyoruz." },
              { title: "vCISO değeri", desc: "Gerçek vCISO çalışmasının %70'i 'inside-out' güvenliktir — dışarıdan görünen kısım değil." },
            ].map(item => (
              <Card key={item.title} className="p-4 border">
                <p className="font-semibold mb-1">{item.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-xl font-bold mb-3">Servis Çıktısı</h2>
          <p className="text-muted-foreground text-sm mb-6">Workshop sonrasında elde ettiğinizler:</p>
          <ul className="text-left space-y-2 mb-8">
            {[
              "Kategori bazlı Teknoloji Kaydı (CMDB): ürün, marka, model, versiyon",
              "Confidence Score: beyan + dış tarama + Shodan verisi karşılaştırması",
              "CVE korelasyonu: mevcut teknolojilerinize etki eden aktif açıklar",
              "12 aylık güvenlik yol haritası (öncelikli aksiyon listesi)",
              "vCISO / SOC / EASM servisleri için hazır baseline",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button size="lg" onClick={onStart}>
            Hemen Başlat <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TechnologyDiscovery() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"landing" | "start" | "nda" | "survey" | "done">("landing");
  const [token, setToken] = useState<string | null>(null);

  // Allow deep-linking via /technology-discovery/:token
  const [matchToken] = useRoute("/technology-discovery/:token");

  function handleCreated(t: string) {
    setToken(t);
    setView("nda");
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {view === "landing" && (
        <LandingPage onStart={() => setView("start")} />
      )}

      {view === "start" && (
        <div className="py-12 container mx-auto px-4">
          <StartForm onCreated={handleCreated} />
        </div>
      )}

      {view === "nda" && token && (
        <div className="py-12 container mx-auto px-4">
          <NdaView token={token} onAccepted={() => setView("survey")} />
        </div>
      )}

      {view === "survey" && token && (
        <div className="py-12 container mx-auto px-4">
          <SurveyView token={token} onComplete={() => setView("done")} />
        </div>
      )}

      {view === "done" && token && (
        <div className="py-12 container mx-auto px-4">
          <CompletionView token={token} />
        </div>
      )}
    </div>
  );
}
