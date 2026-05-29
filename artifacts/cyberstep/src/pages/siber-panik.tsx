import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Shield, AlertTriangle, Phone, ExternalLink, ChevronDown, ChevronUp,
  Clock, FileText, CheckCircle2, Loader2, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ATTACK_TYPES = [
  { value: "Ransomware / Fidye Yazılımı", label: "Fidye Yazılımı (Ransomware)" },
  { value: "DDoS / Servis Engelleme", label: "Servis Engelleme Saldırısı (DDoS)" },
  { value: "Kimlik Avı / Phishing", label: "Kimlik Avı / Phishing" },
  { value: "Veri İhlali / Sızıntı", label: "Veri İhlali / Yetkisiz Erişim" },
  { value: "Hesap Ele Geçirme", label: "Hesap / E-posta Ele Geçirme" },
  { value: "Malware / Virüs", label: "Zararlı Yazılım / Virüs" },
  { value: "Sosyal Mühendislik", label: "Sosyal Mühendislik / Dolandırıcılık" },
  { value: "Diğer / Bilmiyorum", label: "Diğer / Ne Olduğunu Bilmiyorum" },
];

const TIME_OPTIONS = [
  { value: "0-30 dakika", label: "Az önce (0-30 dk)" },
  { value: "1-4 saat", label: "1-4 saat önce" },
  { value: "4-24 saat", label: "4-24 saat önce" },
  { value: "1-3 gün", label: "1-3 gün önce" },
  { value: "Bilmiyorum", label: "Ne zaman başladığını bilmiyorum" },
];

const IMMEDIATE_STEPS = [
  { icon: "1", title: "Etkilenen cihazları ağdan ayırın", desc: "WiFi'yi kapatın, ethernet kablosunu çekin. Virüsün yayılmasını durdurun." },
  { icon: "2", title: "Yetkili kişileri arayın", desc: "IT sorumlusunu, müdürü ve hukuk danışmanını hemen bilgilendirin." },
  { icon: "3", title: "Belgelemeye başlayın", desc: "Ekran görüntüsü alın, her şeyi not edin. Silin." },
  { icon: "4", title: "Parolalarınızı değiştirin", desc: "Temiz bir cihazdan kurumsal e-posta, bankacılık ve kritik sistemler." },
  { icon: "5", title: "Yedeğe geçin", label: "Varsa", desc: "Son yedekten hangi dosyaların kurtarılabileceğini tespit edin." },
];

const KVKK_CHECKLIST = [
  "Kişisel veri (TC kimlik, e-posta, telefon, sağlık vb.) etkilendi mi? → Etkilendiyse bildirim zorunludur",
  "Olay tarih/saatini belgeleyin — 72 saat sayacı buradan başlar",
  "KVKK'ya bildirim: sgd@kvkk.gov.tr (veya verbis.kvkk.gov.tr)",
  "Etkilenen kişileri 'makul sürede' bilgilendirin",
  "Bir veri ihlali tutanağı tutun (tarih, kapsam, önlem)",
];

const EMERGENCY_CONTACTS = [
  { name: "TR-CERT (Siber Olaylar)", tel: "0850 811 9799", url: "https://www.usom.gov.tr", badge: "7/24" },
  { name: "BTK İhbar Hattı", tel: "0800 315 0703", url: "https://www.btk.gov.tr", badge: "Ücretsiz" },
  { name: "KVKK Bildirim", tel: "", url: "https://verbis.kvkk.gov.tr", badge: "72 saat içinde" },
  { name: "Emniyet Siber Suçlar", tel: "155", url: "https://www.egm.gov.tr", badge: "Acil" },
];

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={key++} className="text-base font-bold text-slate-800 mt-5 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-red-500 rounded-full inline-block shrink-0" />
          {line.replace("## ", "")}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={key++} className="flex items-start gap-2 mb-1.5">
          <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
          <p className="text-sm text-slate-700 leading-relaxed">{line.replace("- ", "")}</p>
        </div>
      );
    } else if (line.trim()) {
      elements.push(<p key={key++} className="text-sm text-slate-700 mb-2 leading-relaxed">{line}</p>);
    }
  }
  return elements;
}

export default function SiberPanik() {
  const [attackType, setAttackType] = useState("");
  const [currentImpact, setCurrentImpact] = useState("");
  const [timeElapsed, setTimeElapsed] = useState("");
  const [affectedSystems, setAffectedSystems] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [kvkkOpen, setKvkkOpen] = useState(false);

  const { mutate, isPending, data, isError } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/panic-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attackType, currentImpact, timeElapsed, affectedSystems, companyType }),
      });
      if (!res.ok) throw new Error("Müdahale planı oluşturulamadı");
      return res.json() as Promise<{ advice: string; attackType: string; timestamp: string }>;
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-red-600 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 rounded-full p-3">
              <Shield className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Siber Panik Butonu</h1>
          <p className="text-red-100 text-sm max-w-md mx-auto">
            Siber saldırı altındaysanız, sakin kalın. Adımları takip edin ve AI destekli acil müdahale planınızı alın.
          </p>
          <Badge className="mt-3 bg-white/20 text-white border-white/30 text-xs">Ücretsiz — Kayıt Gerektirmez</Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Immediate Steps */}
        <Card className="border-red-200 bg-red-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <Zap className="h-4 w-4" /> Hemen Yapın — İlk 15 Dakika
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {IMMEDIATE_STEPS.map((step) => (
              <div key={step.icon} className="flex items-start gap-3">
                <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">{step.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-red-900">{step.title}</p>
                  <p className="text-xs text-red-700 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* KVKK Accordion */}
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4">
            <button
              className="w-full flex items-center justify-between text-left"
              onClick={() => setKvkkOpen(!kvkkOpen)}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-900">KVKK 72 Saat Bildirimi Kontrol Listesi</span>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Zorunlu</Badge>
              </div>
              {kvkkOpen ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
            </button>
            {kvkkOpen && (
              <div className="mt-4 space-y-2.5 border-t border-amber-200 pt-4">
                {KVKK_CHECKLIST.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Advice Form */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" />
              Kişiselleştirilmiş Müdahale Planı Al
            </CardTitle>
            <CardDescription>
              Durumunuzu anlatın, AI size özel adım adım müdahale planı oluştursun.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Saldırı Türü</Label>
              <Select onValueChange={setAttackType}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Saldırı türünü seçin" />
                </SelectTrigger>
                <SelectContent>
                  {ATTACK_TYPES.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Ne Zaman Fark Ettiniz?</Label>
              <Select onValueChange={setTimeElapsed}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Süreyi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Firma Türü (İsteğe bağlı)</Label>
              <Input
                placeholder="Örn: e-ticaret, muhaseme, klinik, üretim..."
                value={companyType}
                onChange={e => setCompanyType(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Etkilenen Sistemler (İsteğe bağlı)</Label>
              <Input
                placeholder="Örn: e-posta, web sitesi, muhasebe yazılımı, sunucu..."
                value={affectedSystems}
                onChange={e => setAffectedSystems(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Şu An Ne Oluyor? <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Örn: Tüm dosyalar şifrelenmiş, ekranda fidye notu var. Muhasebe verilerimize erişemiyoruz..."
                value={currentImpact}
                onChange={e => setCurrentImpact(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!attackType || !currentImpact || isPending}
              onClick={() => mutate()}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Plan Oluşturuluyor...</>
              ) : (
                <><Shield className="h-4 w-4 mr-2" /> Müdahale Planı Oluştur</>
              )}
            </Button>

            {isError && (
              <p className="text-xs text-red-500 text-center">Plan oluşturulamadı. Lütfen tekrar deneyin.</p>
            )}
          </CardContent>
        </Card>

        {/* AI Response */}
        {data?.advice && (
          <Card className="border-green-200 bg-green-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-green-800">
                <Shield className="h-4 w-4" />
                Müdahale Planınız — {data.attackType}
              </CardTitle>
              <CardDescription className="text-xs">
                {new Date(data.timestamp).toLocaleString("tr-TR")} tarihli AI analizi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {renderMarkdown(data.advice)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Emergency Contacts */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-600" />
              Acil İletişim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {EMERGENCY_CONTACTS.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  {c.tel && <p className="text-xs text-slate-500 font-mono">{c.tel}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{c.badge}</Badge>
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CTA to full assessment */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold text-slate-800">Saldırıyı Önleyin</p>
              <p className="text-xs text-slate-500 mt-0.5">
                20 soruluk ücretsiz risk analizinizi yapın — saldırıdan önce açıklarınızı kapatın.
              </p>
            </div>
            <a href="/assessment/start">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                Risk Analizi
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
