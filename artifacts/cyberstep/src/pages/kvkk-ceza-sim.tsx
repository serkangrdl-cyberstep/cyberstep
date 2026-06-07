import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, AlertTriangle, ChevronRight, Info, RotateCcw, Scale, FileText,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/language-context";

interface ViolationType {
  id: string;
  label: string;
  article: string;
  baseMin: number;
  baseMax: number;
  desc: string;
}

const VIOLATIONS: ViolationType[] = [
  { id: "aydınlatma", label: "Aydınlatma yükümlülüğünü yerine getirmeme", article: "Md.10 + Md.18/1-a", baseMin: 47_334, baseMax: 946_737, desc: "Kişisel veri işlerken ilgili kişiyi bilgilendirmemek" },
  { id: "verbis", label: "VERBİS'e kayıt yaptırmama", article: "Md.16 + Md.18/1-b", baseMin: 94_668, baseMax: 1_577_793, desc: "Yükümlü veri sorumlusunun sicile kaydolmaması" },
  { id: "ihlal_bildirim", label: "Veri ihlalini bildirmeme", article: "Md.12 + Md.18/1-b", baseMin: 94_668, baseMax: 1_577_793, desc: "72 saat içinde ihlali Kurula bildirmemek" },
  { id: "teknik_tedbir", label: "Teknik/idari tedbirleri almama", article: "Md.12 + Md.18/1-b", baseMin: 94_668, baseMax: 1_577_793, desc: "Kişisel verileri korumak için gerekli önlemleri almamak" },
  { id: "karar_ihlal", label: "Kurul kararlarına uymama", article: "Md.15 + Md.18/1-c", baseMin: 236_684, baseMax: 3_944_727, desc: "Kurul'un bağlayıcı kararlarına riayet etmemek" },
  { id: "ihlal_seve", label: "Veri ihlali — ihmalden kaynaklanan", article: "Md.12 + Md.18", baseMin: 94_668, baseMax: 1_577_793, desc: "Dikkatsizlik veya ihmal sonucu veri ihlali meydana gelmesi" },
  { id: "aktarim", label: "Yurt dışına yasadışı veri aktarımı", article: "Md.9 + Md.18/1-b", baseMin: 94_668, baseMax: 1_577_793, desc: "Gereken koşullar sağlanmadan kişisel veri yurt dışına aktarılması" },
];

const AGGRAVATING = [
  { id: "repeat", label: "Tekrarlayan ihlal (son 3 yılda aynı tür)", multiplier: 1.5 },
  { id: "sensitive", label: "Özel nitelikli veri işleniyor (sağlık, biyometrik, vb.)", multiplier: 1.4 },
  { id: "mass", label: "50.000+ kişi etkilendi", multiplier: 1.6 },
  { id: "deliberate", label: "Kasıtlı/planlı ihlal", multiplier: 2.0 },
];

const MITIGATING = [
  { id: "self_report", label: "İhlali proaktif olarak Kurula bildirdi", multiplier: 0.7 },
  { id: "cooperation", label: "Soruşturmayla tam işbirliği yapıldı", multiplier: 0.85 },
  { id: "remediation", label: "İhlal derhal giderildi ve önlem alındı", multiplier: 0.8 },
  { id: "small", label: "Küçük ölçekli işletme (< 50 çalışan)", multiplier: 0.85 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

export default function KvkkCezaSim() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "KVKK İdari Para Cezası Hesaplayıcı | CyberStep.io",
    description: "KVKK ihlali durumunda uygulanabilecek idari para cezasını tahmin edin. Ücretsiz simülatör.",
    noIndex: false,
  });

  const [violation, setViolation] = useState<string>("");
  const [aggravating, setAggravating] = useState<Record<string, boolean>>({});
  const [mitigating, setMitigating] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{ min: number; max: number; mid: number } | null>(null);

  const selectedViolation = VIOLATIONS.find((v) => v.id === violation);

  function calculate() {
    if (!selectedViolation) return;
    let minMult = 1;
    let maxMult = 1;
    AGGRAVATING.forEach((a) => { if (aggravating[a.id]) { minMult *= a.multiplier; maxMult *= a.multiplier; } });
    MITIGATING.forEach((m) => { if (mitigating[m.id]) { minMult *= m.multiplier; maxMult *= m.multiplier; } });
    const min = selectedViolation.baseMin * minMult;
    const max = selectedViolation.baseMax * maxMult;
    setResult({ min, max, mid: (min + max) / 2 });
  }

  function reset() {
    setViolation("");
    setAggravating({});
    setMitigating({});
    setResult(null);
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{lang === "en" ? "KVKK Simulator" : "KVKK Simülatör"}</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{lang === "en" ? "KVKK Penalty Simulator" : "KVKK Ceza Simülatörü"}</h1>
        <p className="text-muted-foreground max-w-xl">
          KVKK ihlali durumunda Kurul'un uygulayabileceği idari para cezasını tahmin edin. 2024 yılı güncel taban rakamlarına dayanmaktadır.
        </p>
      </div>

      <div className="space-y-6">
        {/* Violation type */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">İhlal Türü</CardTitle>
            <CardDescription>Oluşan veya oluşabilecek KVKK ihlaline en yakın türü seçin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {VIOLATIONS.map((v) => (
              <button key={v.id} onClick={() => { setViolation(v.id); setResult(null); }}
                className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${violation === v.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{v.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs mt-0.5">{v.article}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Aggravating */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ağırlaştırıcı Koşullar</CardTitle>
            <CardDescription>Varsa işaretleyin — ceza üst sınırını artırır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {AGGRAVATING.map((a) => (
              <label key={a.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${aggravating[a.id] ? "border-red-500/40 bg-red-500/5" : "border-border hover:border-red-500/30"}`}>
                <input type="checkbox" checked={!!aggravating[a.id]} onChange={(e) => { setAggravating((s) => ({ ...s, [a.id]: e.target.checked })); setResult(null); }} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">+{Math.round((a.multiplier - 1) * 100)}% artış</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Mitigating */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Hafifletici Koşullar</CardTitle>
            <CardDescription>Varsa işaretleyin — ceza miktarını azaltabilir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {MITIGATING.map((m) => (
              <label key={m.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${mitigating[m.id] ? "border-emerald-500/40 bg-emerald-500/5" : "border-border hover:border-emerald-500/30"}`}>
                <input type="checkbox" checked={!!mitigating[m.id]} onChange={(e) => { setMitigating((s) => ({ ...s, [m.id]: e.target.checked })); setResult(null); }} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">-%{Math.round((1 - m.multiplier) * 100)} azalış</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={calculate} disabled={!violation}>
            Ceza Tahminini Hesapla <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Sıfırla
          </Button>
        </div>

        {result && selectedViolation && (
          <Card className="shadow-sm border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" /> Tahmini Ceza Aralığı
              </CardTitle>
              <CardDescription>{selectedViolation.label} — {selectedViolation.article}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-background rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Alt Sınır</p>
                  <p className="text-xl font-bold">{fmt(result.min)} TL</p>
                </div>
                <div className="bg-background rounded-lg border p-3 text-center border-primary/40">
                  <p className="text-xs text-muted-foreground mb-1">Tahmini Orta</p>
                  <p className="text-xl font-bold text-primary">{fmt(result.mid)} TL</p>
                </div>
                <div className="bg-background rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Üst Sınır</p>
                  <p className="text-xl font-bold">{fmt(result.max)} TL</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-background border">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Ceza aralığı, taban rakamların ağırlaştırıcı ve hafifletici koşullarla çarpılmasıyla oluşturulmuştur. Kurul, ihlal koşullarını kapsamlı değerlendirerek nihai cezayı belirler.
                </p>
              </div>
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">Bu cezayı önlemek için:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground"><ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />Veri envanterinizi oluşturun ve VERBİS'e kaydolun</li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground"><ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />Aydınlatma metinlerinizi güncelleyin</li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground"><ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />Teknik ve idari tedbirlerinizi belgeleyin</li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground"><ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />İhlal bildirim prosedürü hazırlayın (72 saat)</li>
                </ul>
              </div>

              {/* Contextual CTA — fiyat karşılaştırması */}
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs text-muted-foreground mb-1">KVKK minimum ceza</p>
                    <p className="text-xl font-bold text-red-600">94.000 TL</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Mini Değerlendirme</p>
                    <p className="text-xl font-bold text-emerald-600">Ücretsiz</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Şirketinizin KVKK teknik tedbir uyum durumunu 20 dakikada öğrenin.
                </p>
                <Link href="/assessment/start">
                  <Button className="w-full">
                    <Shield className="mr-2 h-4 w-4" /> Ücretsiz KVKK Uyum Değerlendirmesi
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Bu simülatör 2024 yılı taban ceza rakamlarını kullanmaktadır. Gerçek ceza miktarı KVK Kurulu'nun takdir yetkisine bağlıdır. Hukuki danışmanlık için bir KVKK avukatına başvurun.
      </p>
    </div>
  );
}
