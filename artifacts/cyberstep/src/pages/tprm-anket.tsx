import { usePageMeta } from "@/hooks/use-page-meta";
import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Building2, Globe,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

const ANSWER_OPTIONS = [
  { value: "evet", label: "Evet", score: 10, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-emerald-500/30" },
  { value: "kismen", label: "Kısmen", score: 5, cls: "border-amber-500/40 bg-amber-500/10 text-amber-400 ring-amber-500/30" },
  { value: "hayir", label: "Hayır", score: 0, cls: "border-red-500/40 bg-red-500/10 text-red-400 ring-red-500/30" },
] as const;

type AnswerValue = "evet" | "kismen" | "hayir";

interface Question { id: number; text: string; weight: number; category?: string }

interface QuestionnaireData {
  companyName: string;
  companySector: string;
  supplierDomain: string;
  supplierName: string | null;
  expiresAt: string;
  questions: Question[];
  alreadyCompleted: boolean;
  existingResult: { completedAt: string } | null;
  kind?: "initial" | "reassess";
  report?: { score: number; grade: string; risk: string; scannedAt: string | null; actions: Array<{ oncelik: number; aksiyon: string; neden: string }> } | null;
  previousAnswers?: Array<{ questionId: number; answer: AnswerValue }>;
  contradictions?: Array<{ questionId: number; text: string; beyan: string; bulgu: string }>;
}

interface SubmitResult {
  ok: boolean;
}

export default function TprmAnket() {
  usePageMeta({ title: "Tedarikçi Güvenlik Anketi", description: "Müşteriniz tarafından gönderilen tedarikçi siber güvenlik anketi.", noIndex: true });
  const { lang } = useLanguage();
  const [, params] = useRoute("/tprm/anket/:token");
  const token = params?.token ?? "";

  const [data, setData] = useState<QuestionnaireData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [subs, setSubs] = useState<Array<{ name: string; domain: string; dataTypes: string; country: string }>>([]);
  const [evFiles, setEvFiles] = useState<Array<{ name: string; kind: string }>>([]);
  const [evKind, setEvKind] = useState("iso27001");
  const [evError, setEvError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/tprm/questionnaire/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        const qd = d as QuestionnaireData;
        setData(qd);
        if (qd.previousAnswers?.length) {
          setAnswers(Object.fromEntries(qd.previousAnswers.map(a => [a.questionId, a.answer])));
        }
      })
      .catch(e => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  function setAnswer(questionId: number, val: AnswerValue) {
    setAnswers(prev => ({ ...prev, [questionId]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const unanswered = data.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      setSubmitError(`Lütfen tüm soruları yanıtlayın (${unanswered.length} soru yanıtsız)`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/tprm/questionnaire/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierContactName: contactName,
          supplierContactEmail: contactEmail,
          answers: data.questions.map(q => ({ questionId: q.id, answer: answers[q.id] })),
          subprocessors: subs.filter(x => x.name.trim()),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Gönderilemedi");
      setSubmitResult(result as SubmitResult);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadEvidence(file: File) {
    setEvError(null);
    try {
      const dataBase64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("Dosya okunamadı"));
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/tprm/questionnaire/${token}/evidence`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, kind: evKind, dataBase64 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Yüklenemedi");
      setEvFiles(f => [...f, { name: file.name, kind: evKind }]);
    } catch (e) { setEvError((e as Error).message); }
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = data?.questions.length ?? 0;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const riskColor = (level: string) =>
    level === "Düşük" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : level === "Orta" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
    : "text-red-400 bg-red-500/10 border-red-500/30";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Anket yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="font-bold text-lg mb-2">Anket Bulunamadı</h2>
            <p className="text-muted-foreground text-sm">
              {loadError ?? "Bu bağlantı geçersiz veya süresi dolmuş."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.alreadyCompleted && data.existingResult && !submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-bold text-xl mb-2">Anket Tamamlandı</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Bu anketi daha önce tamamladınız.{" "}
              {new Date(data.existingResult.completedAt).toLocaleDateString("tr-TR")} tarihinde gönderildi.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-bold text-xl mb-2">Anket Gönderildi</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {data.kind === "reassess"
                ? "Talebiniz alındı. Yeni tarama başlatıldı; sonuç tamamlandığında " + data.companyName + " ilgilisine bildirilecek. Teşekkürler."
                : `Yanıtlarınız ${data.companyName} ekibine iletildi. Teşekkürler.`}
            </p>

          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-7 w-7 text-violet-400" />
            <span className="font-bold text-lg">CyberStep.io</span>
          </div>
          <Badge variant="outline" className="mb-3 border-violet-500/40 text-violet-400 bg-violet-500/5">
            {lang === "en" ? "Supplier Cybersecurity Survey" : "Tedarikçi Siber Güvenlik Anketi"}
          </Badge>
          <h1 className="text-2xl font-bold mb-2">{lang === "en" ? "Cybersecurity Self-Assessment" : "Siber Güvenlik Öz-Değerlendirmesi"}</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{data.companyName} tarafından gönderildi</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
            <Globe className="h-4 w-4" />
            <span>{data.supplierDomain}</span>
          </div>
        </div>

        {/* Context */}
        <Card className="mb-6 border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{data.companyName}</strong> tedarik zinciri risk yönetimi (TPRM)
              çerçevesinde sizinle iş ortaklığını değerlendiriyor. Bu anket yaklaşık <strong>3 dakika</strong> sürer.
              Yanıtlarınız yalnızca bu anketi gönderen şirkete iletilir.
            </p>
          </CardContent>
        </Card>

        {data.kind === "reassess" && data.report && (
          <Card className="mb-6 border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Değerlendirme Raporunuz</CardTitle>
              <CardDescription>
                Skor: <strong>{data.report.score}/100</strong> ({data.report.grade}) · {data.report.risk} risk
                {data.report.scannedAt ? ` · Tarama: ${new Date(data.report.scannedAt).toLocaleDateString("tr-TR")}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.report.actions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5">Öncelikli aksiyonlar</p>
                  <ol className="space-y-1.5 text-sm list-decimal pl-5">
                    {data.report.actions.map(a => (
                      <li key={a.oncelik}><span className="font-medium">{a.aksiyon}</span><span className="text-muted-foreground"> — {a.neden}</span></li>
                    ))}
                  </ol>
                </div>
              )}
              {!!data.contradictions?.length && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs space-y-1">
                  <p className="font-semibold text-red-400">Beyanınız ile tarama bulgusu çelişiyor</p>
                  {data.contradictions.map(c => <p key={c.questionId}>• {c.text} — Beyan: {c.beyan}. {c.bulgu}</p>)}
                </div>
              )}
              <a href={`/api/tprm/questionnaire/${token}/report.pdf`} className="inline-block text-sm text-violet-400 underline">Raporu PDF olarak indir</a>
              <p className="text-xs text-muted-foreground">
                Aksiyonları kendi sisteminizde tamamladıktan sonra anketi güncelleyip gönderin; yeni bir tarama otomatik başlatılır ve sonuç {data.companyName} ilgilisine bildirilir.
              </p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={submit}>
          {/* İletişim bilgileri */}
          <Card className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">İletişim Bilgileriniz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ad Soyad *</Label>
                  <Input
                    required
                    placeholder="Ad Soyad"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kurumsal E-posta *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="ad@firmaniz.com"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* İlerleme */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span>{answeredCount}/{totalQuestions} soru yanıtlandı</span>
            <span>%{progress}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted mb-5 overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          {/* Sorular */}
          <div className="space-y-4">
            {data.questions.map((q, i) => {
              const selected = answers[q.id];
              return (
                <div key={q.id}>
                {q.category && q.category !== data.questions[i - 1]?.category && (
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">{q.category}</h2>
                )}
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs text-muted-foreground">Soru {i + 1}</CardDescription>
                    <CardTitle className="text-sm font-medium leading-relaxed">{q.text}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-2">
                      {ANSWER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAnswer(q.id, opt.value)}
                          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            selected === opt.value
                              ? `${opt.cls} ring-1`
                              : "border-border hover:border-primary/40 text-muted-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                </div>
              );
            })}
          </div>

          {data.questions.some(q => q.category === "Alt hizmet sağlayıcılar") && (
            <Card className="mt-6">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Alt hizmet sağlayıcılarınız (isteğe bağlı)</p>
                  <p className="text-xs text-muted-foreground">Müşterinizin verisini işleyen veya barındıran alt sağlayıcıları ekleyin. Beyanınız doğrulanmamış olarak saklanır.</p>
                </div>
                {subs.map((x, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <input className="rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="Ad (ör. Microsoft Azure)" maxLength={120} value={x.name} onChange={e => setSubs(subs.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} />
                    <input className="rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="Alan adı (azure.com)" value={x.domain} onChange={e => setSubs(subs.map((y, j) => j === i ? { ...y, domain: e.target.value } : y))} />
                    <input className="rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="İşlenen veri (ör. e-posta)" maxLength={200} value={x.dataTypes} onChange={e => setSubs(subs.map((y, j) => j === i ? { ...y, dataTypes: e.target.value } : y))} />
                    <div className="flex gap-2">
                      <input className="flex-1 min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="Ülke" maxLength={60} value={x.country} onChange={e => setSubs(subs.map((y, j) => j === i ? { ...y, country: e.target.value } : y))} />
                      <button type="button" className="text-xs text-red-400" onClick={() => setSubs(subs.filter((_, j) => j !== i))}>Sil</button>
                    </div>
                  </div>
                ))}
                {subs.length < 20 && (
                  <button type="button" className="text-xs text-primary" onClick={() => setSubs([...subs, { name: "", domain: "", dataTypes: "", country: "" }])}>+ Alt sağlayıcı ekle</button>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Kanıt belgesi (isteğe bağlı)</p>
              <p className="text-xs text-muted-foreground">ISO 27001 sertifikası, sızma testi özeti gibi belgeleri ekleyebilirsiniz (PDF/PNG/JPG, en fazla 5 dosya, her biri 3 MB). Müşteriniz görür; doğrulanmamış beyan olarak saklanır.</p>
              <div className="flex gap-2 items-center">
                <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={evKind} onChange={e => setEvKind(e.target.value)}>
                  <option value="iso27001">ISO 27001</option><option value="pentest">Sızma testi</option><option value="soc2">SOC 2</option><option value="diger">Diğer</option>
                </select>
                <input type="file" accept="application/pdf,image/png,image/jpeg" className="text-xs min-w-0" onChange={e => { const f = e.target.files?.[0]; if (f) uploadEvidence(f); e.target.value = ""; }} />
              </div>
              {evFiles.map((f, i) => <p key={i} className="text-xs text-emerald-400">✓ {f.name}</p>)}
              {evError && <p className="text-xs text-red-400">{evError}</p>}
            </CardContent>
          </Card>

          {submitError && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <Card className="mt-6 border-border/60">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">{lang === "en" ? "Privacy Notice (KVKK Art. 10)" : "KVKK Aydınlatma Metni"}</h3>
              {lang === "en" ? (
                <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
                  <p><strong>Controller:</strong> {data.companyName}, which sent you this survey. CyberStep (Kuzey Digital Ventures) provides the platform and processes the data on the controller's behalf.</p>
                  <p><strong>Data:</strong> your name, e-mail address, your survey answers and publicly observable technical information about your domain (DNS, e-mail security, TLS, exposed services, reputation lists).</p>
                  <p><strong>Purpose and legal basis:</strong> supplier cyber-risk assessment — the controller's legitimate interest (KVKK Art. 5/2-f) and performance of the business relationship.</p>
                  <p><strong>Recipients:</strong> only the company that sent the survey. Data is not sold or shared for advertising.</p>
                  <p><strong>Retention:</strong> for the duration of the business relationship, then deleted or anonymised.</p>
                  <p><strong>Your rights (KVKK Art. 11):</strong> to learn whether your data is processed, request information, correction, deletion, object, and claim damages. Apply to {data.companyName} or to info@cyberstep.io.</p>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
                  <p><strong>Veri sorumlusu:</strong> Bu anketi size gönderen <strong>{data.companyName}</strong>. CyberStep (Kuzey Digital Ventures) platformu sağlar ve veri sorumlusu adına veri işleyen olarak hareket eder.</p>
                  <p><strong>İşlenen veriler:</strong> ad-soyad, e-posta adresi, anket yanıtlarınız ve alan adınıza ilişkin kamuya açık teknik bilgiler (DNS, e-posta güvenliği, TLS, internete açık servisler, itibar listeleri).</p>
                  <p><strong>Amaç ve hukuki sebep:</strong> tedarikçi siber risk değerlendirmesi; veri sorumlusunun meşru menfaati (KVKK m.5/2-f) ve ticari ilişkinin yürütülmesi.</p>
                  <p><strong>Aktarım:</strong> veriler yalnızca anketi gönderen şirkete aktarılır; satılmaz, reklam amacıyla paylaşılmaz.</p>
                  <p><strong>Saklama süresi:</strong> ticari ilişki süresince; sonrasında silinir veya anonim hale getirilir.</p>
                  <p><strong>Haklarınız (KVKK m.11):</strong> verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme, itiraz etme ve zararın giderilmesini talep etme. Başvuru: {data.companyName} veya info@cyberstep.io.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full mt-6 bg-violet-600 hover:bg-violet-700 text-white"
            disabled={submitting || !contactName || !contactEmail}
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gönderiliyor...</>
              : <><CheckCircle2 className="h-4 w-4 mr-2" /> {data.kind === "reassess" ? "Düzeltmeleri tamamladım — yeniden değerlendirme talep et" : "Anketi Gönder"}</>}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            Yanıtlarınız yalnızca tedarikçi risk değerlendirmesi amacıyla kullanılır.
            Bağlantı geçerlilik tarihi: {new Date(data.expiresAt).toLocaleDateString("tr-TR")}
          </p>
        </form>
      </div>
    </div>
  );
}
