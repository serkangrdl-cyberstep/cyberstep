import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Mail,
  RotateCcw, Eye, Lock, ArrowRight, Info,
} from "lucide-react";
import { Link } from "wouter";

interface PhishingEmail {
  id: string;
  subject: string;
  sender: string;
  senderDomain: string;
  preview: string;
  body: string;
  isPhishing: boolean;
  difficulty: "kolay" | "orta" | "zor";
  redFlags: string[];
  legitimateClues?: string[];
  explanation: string;
}

const EMAILS: PhishingEmail[] = [
  {
    id: "1",
    subject: "Hesabınız askıya alındı — 24 saat içinde doğrulayın",
    sender: "Microsoft Güvenlik Ekibi",
    senderDomain: "microsoftonlline.com",
    preview: "Hesabınızda şüpheli etkinlik tespit edildi. Hemen doğrulayın.",
    body: "Sayın Kullanıcı,\n\nHesabınızda yetkisiz giriş denemesi tespit edildi. Hesabınız 24 saat içinde doğrulanmazsa kalıcı olarak kapatılacaktır.\n\nBuraya tıklayarak şifrenizi sıfırlayın:\nhttps://microsoft-account-verify.xyz/reset\n\nMicrosoft Güvenlik Ekibi",
    isPhishing: true,
    difficulty: "kolay",
    redFlags: ["Gönderici alan adı 'microsoftonlline.com' — Microsoft değil", "Bağlantı 'microsoft-account-verify.xyz' — resmi Microsoft alan adı değil", "Aciliyet yaratma: '24 saat içinde kapatılır'", "Genel hitap: 'Sayın Kullanıcı'"],
    explanation: "Bu klasik bir kimlik avı e-postasıdır. 'microsoftonlline.com' alan adındaki çift 'l' harfini fark etmek zor olabilir. Microsoft hiçbir zaman .xyz alan adı kullanmaz.",
  },
  {
    id: "2",
    subject: "Fatura #INV-2024-8873 — Ödeme gerekli",
    sender: "Muhasebe Departmanı",
    senderDomain: "sirketiniz-muhasebe.net",
    preview: "Gecikmiş fatura ödemeniz bulunmaktadır. Ödeme detayları için ek inceleyiniz.",
    body: "Merhaba,\n\nAşağıdaki faturanın vadesi geçmiştir. Gecikme faizi uygulanmadan önce lütfen ödemenizi gerçekleştirin.\n\nFatura No: INV-2024-8873\nTutar: 47.350 TL\nVade: 3 gün önce\n\nÖdeme talimatları için lütfen ekteki PDF'i açın.\n\nSaygılarımızla",
    isPhishing: true,
    difficulty: "orta",
    redFlags: ["Gönderici alan adı şirketle ilgisiz: 'sirketiniz-muhasebe.net'", "Ek dosya açmaları isteniyor (sıkça kötücül yazılım içerir)", "Beklenmedik fatura", "Belirsiz gönderici — muhasebe departmanı kim?"],
    explanation: "BEC (Business Email Compromise) saldırısı. Alan adı şirketin gerçek alan adına benzemiyor. Muhasebe ekibi içeriden e-posta atar, dışarıdan değil. Ek açmadan önce telefon ile teyit edin.",
  },
  {
    id: "3",
    subject: "Yeni bir faks belgeniz var",
    sender: "eFax Hizmetleri",
    senderDomain: "efax.com",
    preview: "3 sayfalık faks belgeniz sisteme ulaştı. Görüntülemek için tıklayın.",
    body: "eFax Bildirimi\n\nBir faks belgeniz sisteme ulaştı.\n\nGönderen: +90 212 XXX XX XX\nSayfa sayısı: 3\nAlınma tarihi: Bugün, 14:23\n\nBelgenizi görüntülemek için giriş yapın:\nhttps://www.efax.com/inbound-fax/view\n\nTeşekkürler,\neFax Ekibi",
    isPhishing: false,
    difficulty: "orta",
    legitimateClues: ["efax.com resmi ve yaygın kullanılan bir servis", "Bağlantı efax.com'un kendi alan adında", "Acil eylem veya tehdit yok", "Detaylı gönderici bilgisi"],
    redFlags: [],
    explanation: "Bu meşru bir eFax bildirimidir. efax.com köklü bir eFax servisidir. Bağlantı kendi alan adında. Şüpheliyseniz efax.com'a doğrudan gidin ve faksınızı oradan kontrol edin.",
  },
  {
    id: "4",
    subject: "İK: Maaş güncellemesi ve yeni bordro sistemi",
    sender: "İnsan Kaynakları",
    senderDomain: "sirketiniz.com.tr",
    preview: "Tüm çalışanlar için maaş güncelleme bilgisi ve yeni bordro sistemi hakkında.",
    body: "Değerli Çalışanımız,\n\nYeni bordro sistemimize geçiş nedeniyle banka bilgilerinizi güncellemenizi rica ederiz.\n\nBanka IBAN güncelleme formu:\nhttps://hrportal-sirketiniz.tk/update-iban\n\nLütfen 48 saat içinde tamamlayın.\n\nİnsan Kaynakları Departmanı",
    isPhishing: true,
    difficulty: "zor",
    redFlags: ["IBAN bilgisi talep ediliyor — meşru şirketler bunu e-posta ile yapmaz", "Alan adı 'hrportal-sirketiniz.tk' — .tk ücretsiz alan adı, şüpheli", "Gönderici alan adı doğru görünse de bağlantı farklı alan adında", "Banka bilgisi değişikliği her zaman yüz yüze veya IT ile doğrulanmalıdır"],
    explanation: "Zor bir örnek. Gönderici alan adı meşru görünüyor ama bağlantı .tk uzantılı sahte bir alan adına yönlendiriyor. Banka bilgisi talebi her zaman yüzde yüz doğrulanmalıdır.",
  },
  {
    id: "5",
    subject: "Siparişiniz gönderildi — Kargo takip numaranız",
    sender: "Kargo Bildirimleri",
    senderDomain: "yurticikargo.com",
    preview: "Siparişiniz kargoya verildi. Takip etmek için tıklayın.",
    body: "Merhaba,\n\nSiparişiniz bugün kargoya verildi.\n\nTakip Numarası: TRK-2024-98773\nTahmini Teslimat: 2-3 iş günü\n\nKargonuzu takip etmek için:\nhttps://www.yurticikargo.com/kargo-takip?no=TRK-2024-98773\n\nYurtiçi Kargo",
    isPhishing: false,
    difficulty: "kolay",
    legitimateClues: ["yurticikargo.com resmi Yurtiçi Kargo alanı", "Bağlantı kendi resmi alan adında", "Kişisel bilgi veya şifre talep edilmiyor", "Takip numarası gerçekçi formatta"],
    redFlags: [],
    explanation: "Bu meşru bir kargo bildirim e-postasıdır. yurticikargo.com Türkiye'nin en büyük kargo şirketlerinden Yurtiçi Kargo'nun resmi alan adı. Bağlantı da aynı alanda.",
  },
  {
    id: "6",
    subject: "CEO'dan Acil: Havale onayı gerekiyor",
    sender: "Genel Müdür",
    senderDomain: "sirket-iniz.com",
    preview: "Toplantıdayım, telefona bakamıyorum. Acil ödeme onayı gerekiyor.",
    body: "Merhaba,\n\nÖnemli bir toplantıdayım, telefona bakamıyorum. Acil olarak 85.000 TL havale yapılması gerekiyor — tedarikçi sözleşmesini bugün imzalamak zorundayız.\n\nAşağıdaki hesaba havale yapılmasını onaylıyorum:\nBanka: Garanti BBVA\nIBAN: TR12 0006 2000 1234 0006 2996 69\n\nBu konuyu kimseyle konuşma, gizlilik önemli. En geç 2 saat içinde işlemi tamamla.\n\nGn. Md.",
    isPhishing: true,
    difficulty: "zor",
    redFlags: ["Gönderici alan adı 'sirket-iniz.com' — gerçek alan adı 'sirketiniz.com' (tire fark)", "CEO doğrudan havale emri vermez, prosedür dışı", "'Kimseyle konuşma' — sosyal mühendislik baskısı", "Aşırı aciliyet ve zaman baskısı", "IBAN doğrulaması talep edilemiyor diyor"],
    explanation: "CEO fraud / BEC saldırısı. Alan adında küçük bir fark var (tire). Gerçek yöneticiler güvensiz kanallardan havale emri vermez. Her büyük ödeme talebi prosedüre uygun olmalı ve doğrudan telefonla teyit edilmeli.",
  },
];

type UserAnswer = "phishing" | "legit" | null;

interface AnswerRecord {
  answer: UserAnswer;
  correct: boolean;
}

export default function PhishingSim() {
  usePageMeta({
    title: "Kimlik Avı Simülasyonu | CyberStep.io",
    description: "Phishing e-postalarını tanımayı öğrenin. Gerçekçi örneklerle siber güvenlik farkındalık testi.",
    noIndex: false,
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [finished, setFinished] = useState(false);

  const email = EMAILS[currentIdx];
  const currentAnswer = answers[email?.id];
  const totalAnswered = Object.keys(answers).length;
  const correct = Object.values(answers).filter((a) => a.correct).length;
  const score = totalAnswered > 0 ? Math.round((correct / EMAILS.length) * 100) : 0;

  function answer(choice: "phishing" | "legit") {
    if (currentAnswer) return;
    const isCorrect = (choice === "phishing") === email.isPhishing;
    setAnswers((s) => ({ ...s, [email.id]: { answer: choice, correct: isCorrect } }));
    setShowExplanation(true);
  }

  function next() {
    setShowExplanation(false);
    if (currentIdx >= EMAILS.length - 1) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }

  function reset() {
    setCurrentIdx(0);
    setAnswers({});
    setShowExplanation(false);
    setFinished(false);
  }

  const diffColor: Record<string, string> = {
    kolay: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
    orta: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    zor: "text-red-500 border-red-500/30 bg-red-500/10",
  };

  if (finished) {
    const level = score >= 80 ? "Uzman" : score >= 60 ? "Orta Düzey" : "Yeni Başlayan";
    const levelColor = score >= 80 ? "emerald" : score >= 60 ? "amber" : "red";
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-6 w-6 text-primary" />
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Kimlik Avı Simülasyonu</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Sonuçlarınız</h1>
        </div>

        <Card className={`shadow-sm border-2 mb-6 ${levelColor === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : levelColor === "amber" ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <CardContent className="pt-6 text-center">
            <p className="text-5xl font-bold mb-2">{score}%</p>
            <p className="text-lg font-semibold mb-1">{level}</p>
            <p className="text-sm text-muted-foreground">{correct} / {EMAILS.length} doğru cevap</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm mb-6">
          <CardHeader><CardTitle className="text-base">Cevaplarınız</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {EMAILS.map((e) => {
              const a = answers[e.id];
              return (
                <div key={e.id} className={`flex items-start gap-2 p-2 rounded-lg ${a?.correct ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                  {a?.correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-sm font-medium">{e.subject}</p>
                    <p className="text-xs text-muted-foreground">{e.isPhishing ? "Kimlik avı" : "Meşru"} — {a?.answer === "phishing" ? "Kimlik avı dediniz" : "Meşru dediniz"}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {score < 80 && (
          <Card className="shadow-sm border-primary/20 bg-primary/5 mb-6">
            <CardContent className="pt-5">
              <p className="font-medium text-sm mb-2">Dikkat edilecek ipuçları:</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />Gönderici alan adını her zaman kontrol edin, adı değil</li>
                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />Bağlantıların üzerine gelin, gerçek URL'yi görün</li>
                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />Aciliyet ve tehdit içeren mesajlara şüpheyle yaklaşın</li>
                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />IBAN veya şifre talep eden e-postalar her zaman şüphelidir</li>
                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />Şüpheli durumlarda IT veya yöneticiye danışın</li>
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Tekrar Dene</Button>
          <Link href="/assessment/start">
            <Button variant="outline"><Shield className="mr-2 h-4 w-4" /> Güvenlik Değerlendirmesi Yap</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Kimlik Avı Simülasyonu</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Phishing E-posta Testi</h1>
        <p className="text-muted-foreground">Her e-postanın gerçek mi yoksa kimlik avı mı olduğunu belirleyin.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">E-posta {currentIdx + 1} / {EMAILS.length}</span>
        <span className="text-xs text-muted-foreground">{correct} doğru</span>
      </div>
      <Progress value={(currentIdx / EMAILS.length) * 100} className="h-1.5 mb-6" />

      {/* Email card */}
      <Card className="shadow-sm mb-4">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-bold text-base leading-snug">{email.subject}</p>
                <Badge variant="outline" className={`text-xs shrink-0 ${diffColor[email.difficulty]}`}>{email.difficulty}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email.sender}</span>
                {" "}<span className="font-mono text-xs">&lt;noreply@{email.senderDomain}&gt;</span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="bg-muted/20 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Eye className="h-4 w-4" /> Ön İzleme
            </p>
            <p className="text-sm italic text-muted-foreground">{email.preview}</p>
          </div>
          <div className="rounded-lg border bg-background p-4 whitespace-pre-line text-sm">
            {email.body}
          </div>
        </CardContent>
      </Card>

      {/* Answer buttons */}
      {!currentAnswer && (
        <div className="flex gap-3 mb-4">
          <Button variant="outline" className="flex-1 border-red-500/40 hover:bg-red-500/10 hover:border-red-500 text-red-600" onClick={() => answer("phishing")}>
            <AlertTriangle className="mr-2 h-4 w-4" /> Kimlik Avı
          </Button>
          <Button variant="outline" className="flex-1 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500 text-emerald-600" onClick={() => answer("legit")}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Meşru E-posta
          </Button>
        </div>
      )}

      {/* Explanation */}
      {showExplanation && currentAnswer && (
        <Card className={`shadow-sm mb-4 border-2 ${currentAnswer.correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              {currentAnswer.correct
                ? <><CheckCircle2 className="h-5 w-5 text-emerald-500" /><span className="font-semibold text-emerald-600">Doğru!</span></>
                : <><XCircle className="h-5 w-5 text-red-500" /><span className="font-semibold text-red-600">Yanlış</span></>
              }
              <Badge variant="outline">{email.isPhishing ? "Bu bir kimlik avı e-postasıydı" : "Bu meşru bir e-postaydı"}</Badge>
            </div>
            <p className="text-sm mb-3">{email.explanation}</p>
            {email.redFlags.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-red-500 mb-1">Kırmızı bayraklar:</p>
                <ul className="space-y-0.5">
                  {email.redFlags.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-red-500" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {email.legitimateClues && email.legitimateClues.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-500 mb-1">Meşruiyet işaretleri:</p>
                <ul className="space-y-0.5">
                  {email.legitimateClues.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="mt-4 w-full sm:w-auto" onClick={next}>
              {currentIdx >= EMAILS.length - 1 ? "Sonuçları Gör" : "Sonraki E-posta"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <Info className="inline h-3 w-3 mr-1" />Bu simülasyon eğitim amaçlıdır. Gerçek phishing e-postaları çok daha sofistike olabilir.
      </p>
    </div>
  );
}
