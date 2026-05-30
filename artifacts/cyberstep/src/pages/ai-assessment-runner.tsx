import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ArrowRight, ArrowLeft, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AnswerType = "evet" | "kismen" | "hayir" | "bilmiyorum";

const ANSWER_OPTIONS: { value: AnswerType; label: string; sublabel: string; activeClass: string; hoverClass: string }[] = [
  { value: "evet",       label: "Evet",       sublabel: "Tam anlamıyla uygulanıyor",  activeClass: "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 dark:border-green-600",    hoverClass: "hover:border-green-300 hover:bg-green-50 hover:text-green-700" },
  { value: "kismen",     label: "Kısmen",     sublabel: "Kısmen uygulanıyor",         activeClass: "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-600", hoverClass: "hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700" },
  { value: "hayir",      label: "Hayır",      sublabel: "Henüz uygulanmıyor",         activeClass: "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-600",                  hoverClass: "hover:border-red-300 hover:bg-red-50 hover:text-red-700" },
  { value: "bilmiyorum", label: "Bilmiyorum", sublabel: "Bu konuda bilgim yok",       activeClass: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-600", hoverClass: "hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700" },
];

// Veri maruz kalma soruları (ters puanlama — hayır=iyi)
const REVERSE_QUESTIONS = new Set([6, 7, 8, 9, 10, 11, 12, 13]);

const SECTIONS = [
  {
    id: "AI1", title: "Yapay Zeka Araç Yönetimi",
    questions: [
      { id: 1,  text: "Şirketinizde çalışanların hangi yapay zeka araçlarını kullandığı takip ediliyor mu?",                                                                                          weight: 3 as const, helpText: "ChatGPT, Gemini, Copilot gibi araçların kimler tarafından, ne amaçla kullanıldığını biliyor musunuz?" },
      { id: 2,  text: "IT departmanının onaylamadığı yapay zeka araçlarının kullanımı kısıtlanıyor mu?",                                                                                            weight: 2 as const, helpText: "Çalışanlar herhangi bir yapay zeka aracını serbestçe kullanabiliyor mu? Onay mekanizması var mı?" },
      { id: 3,  text: "Yapay zeka araçları kullanımı için yazılı bir şirket politikası veya kural seti var mı?",                                                                                    weight: 2 as const, helpText: '"Yapay zekaya şu tür veri girilmez" gibi yazılı bir kural belgesi hazırlandı mı?' },
      { id: 4,  text: "Çalışanlara hangi yapay zeka araçlarını kullanabilecekleri ve nasıl güvenli kullanacakları konusunda eğitim verildi mi?",                                                   weight: 1 as const, helpText: "Farkındalık eğitimi olmadan çalışanlar risk oluşturduğunun farkında olmayabilir." },
      { id: 5,  text: "Şirkette kullanılan yapay zeka araçları için kurumsal (işletme) hesap mı yoksa kişisel hesap mı kullanılıyor?",                                                             weight: 2 as const, helpText: "Kişisel hesapla kullanılan araçlar şirket kontrolü dışında. Kurumsal hesap veri güvenliğini artırır." },
    ]
  },
  {
    id: "AI2", title: "Veri Maruz Kalma Riski",
    questions: [
      { id: 6,  text: "Çalışanlar müşteri adı, telefon veya e-posta gibi kişisel bilgileri yapay zeka araçlarına giriyor mu?",                                                                     weight: 3 as const, helpText: "KVKK kapsamındaki kişisel veri, açık rıza olmadan yurt dışı bir AI sunucusuna gönderilemez." },
      { id: 7,  text: "Finansal veriler (fatura detayı, banka bilgisi, maaş bilgisi) yapay zeka araçlarına kopyalanıyor mu?",                                                                      weight: 3 as const, helpText: "Finansal veri hem KVKK hem ticari sır kapsamında. AI aracına yapıştırılması ciddi risk." },
      { id: 8,  text: "Şirket sözleşmeleri, teklifler veya gizlilik anlaşmaları yapay zeka araçlarına yükleniyor mu?",                                                                             weight: 3 as const, helpText: "Sözleşme içeriği rakiplerin veya kötü niyetli kişilerin eline geçebilir. Ticari sır riski yüksek." },
      { id: 9,  text: "Çalışan özlük dosyası, maaş bilgisi veya performans değerlendirmesi gibi personel verileri AI araçlarında işleniyor mu?",                                                   weight: 3 as const, helpText: "Personel verisi KVKK özel kategorisine yakın. AI araçlarına girişi ciddi hukuki risk doğurur." },
      { id: 10, text: "Müşterilere ait sağlık, inanç veya biyometrik gibi özel nitelikli veriler yapay zeka araçlarında işleniyor mu?",                                                            weight: 3 as const, helpText: "Özel nitelikli kişisel veri en yüksek KVKK korumasına tabi. AI araçlarına girişi doğrudan ihlal." },
      { id: 11, text: "Şirketin ticari sırları, stratejik planları veya rakip analizleri yapay zeka araçlarına yazılıyor mu?",                                                                    weight: 2 as const, helpText: "Yapay zeka sağlayıcısı bu bilgilere erişebilir. Rekabet avantajı kaybolabilir." },
      { id: 12, text: "Müşteri veya iş ortağı e-postaları yapay zeka araçlarına doğrudan kopyalanıyor mu?",                                                                                        weight: 2 as const, helpText: "E-posta içeriğinde yer alan kişisel veriler AI aracına iletilmiş olur. KVKK açısından riskli." },
      { id: 13, text: "Ses kayıtları veya görüntüler (toplantı kaydı, müşteri fotoğrafı) yapay zeka araçlarına yükleniyor mu?",                                                                   weight: 3 as const, helpText: "Ses verisi KVKK kapsamında biyometrik veri sayılabilir. Ses AI araçlarına yüklenmesi çok yüksek risk." },
    ]
  },
  {
    id: "AI3", title: "Araç Konfigürasyonu ve Kontrol",
    questions: [
      { id: 14, text: "Kullanılan AI araçlarında veri eğitiminden çıkış (opt-out) ayarı yapılandırıldı mı?",                                                                                      weight: 2 as const, helpText: 'Çoğu AI aracında "Verilerimi eğitim için kullanma" seçeneği var. Bu ayar aktive edildi mi?' },
      { id: 15, text: "Kurumsal AI araçları için hizmet sağlayıcıyla Veri İşleme Sözleşmesi (DPA) imzalandı mı?",                                                                                helpText: "KVKK'ya göre kişisel veri işleten üçüncü taraflarla DPA imzalanması zorunlu.", weight: 2 as const },
      { id: 16, text: "AI araçlarına erişimde çalışanlara kişisel hesap yerine kurumsal hesap zorunluluğu getiriliyor mu?",                                                                       weight: 2 as const, helpText: "Kurumsal hesap, hangi çalışanın ne zaman ne kullandığını izlemeyi mümkün kılar." },
      { id: 17, text: "Hangi yapay zeka araçlarının kullanıldığı ve bunların ne için kullanıldığı kayıt altında tutuluyor mu?",                                                                   weight: 1 as const, helpText: "Audit trail olmadan KVKK denetiminde 'ne işlendi' sorusunu yanıtlamak çok zorlaşır." },
      { id: 18, text: "AI ile üretilen içeriklerin doğruluğu kontrol edilmeden dışarıya (müşteri, resmi kurum) gönderilmemesi için kural var mı?",                                                weight: 1 as const, helpText: "AI 'hallüsinasyon' yapabilir: olmayan bilgi üretebilir. Bu içerik müşteriye giderse hukuki sorumluluk doğar." },
      { id: 19, text: "Deepfake veya yapay zeka ile oluşturulmuş sahte içerik (ses taklidi, görsel manipülasyon) konusunda çalışan farkındalığı oluşturuldu mu?",                                weight: 1 as const, helpText: "'CEO'nuzun sesi gibi konuşan biri para istiyor' — bu saldırı Türkiye'de artıyor. Hazırlıklı mısınız?" },
    ]
  },
  {
    id: "AI4", title: "KVKK ve Hukuki Uyum",
    questions: [
      { id: 20, text: "Yapay zeka araçlarına kişisel veri girişinin KVKK kapsamında yurt dışına veri aktarımı sayılabileceği bilinciyle hareket ediliyor mu?",                                    weight: 2 as const, helpText: "ChatGPT, Gemini gibi ABD menşeli araçlara kişisel veri göndermek KVKK Madde 9 kapsamında yurt dışı aktarım." },
      { id: 21, text: "Yapay zeka araçlarının kullanımı, şirketin KVKK Aydınlatma Metni ve Gizlilik Politikasına yansıtıldı mı?",                                                               weight: 2 as const, helpText: '"Verileriniz AI araçlarıyla işlenebilir" ifadesi aydınlatma metninde yer alıyor mu?' },
      { id: 22, text: "AI araçlarıyla işlenen kişisel veriler için VERBİS kaydında gerekli başlık oluşturuldu mu?",                                                                               weight: 1 as const, helpText: "Yeni bir veri işleme faaliyeti başladığında VERBİS'in güncellenmesi KVKK gereği." },
      { id: 23, text: "Çalışanlara yapay zeka kullanımında KVKK yükümlülükleri ve sorumlulukları anlatıldı mı?",                                                                                 weight: 1 as const, helpText: "Çalışan farkındalığı hem hukuki yükümlülük hem etkin koruma için zorunlu." },
      { id: 24, text: "Yapay zeka aracından kaynaklanan veri ihlali senaryosu olay müdahale planına eklendi mi?",                                                                                 weight: 2 as const, helpText: '"AI aracına yanlışlıkla müşteri verisi girdik" — bu durumda 72 saatlik KVKK bildirimi prosedürü hazır mı?' },
      { id: 25, text: "Otomatik karar veren yapay zeka sistemi kullanılıyorsa (kredi skoru, işe alım filtresi) KVKK Madde 11 kapsamı değerlendirildi mi?",                                        weight: 2 as const, helpText: "Tamamen otomatik kararlar KVKK kapsamında özel yükümlülükler gerektirir." },
    ]
  },
];

export default function AiAssessmentRunner() {
  const [, params] = useRoute("/ai-guvenlik/:id/sorular");
  const id = Number(params?.id ?? 0);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerType>>({});
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const section = SECTIONS[currentSectionIndex];
  const isLastSection = currentSectionIndex === SECTIONS.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  const totalQuestions = useMemo(() => SECTIONS.reduce((acc, s) => acc + s.questions.length, 0), []);
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;
  const sectionComplete = section.questions.every(q => answers[q.id] !== undefined);

  const handleAnswer = (qId: number, ans: AnswerType) => {
    setAnswers(prev => ({ ...prev, [qId]: ans }));
  };

  const switchSection = (dir: "next" | "prev") => {
    setAnimating(true);
    setTimeout(() => {
      if (dir === "next") setCurrentSectionIndex(p => p + 1);
      else setCurrentSectionIndex(p => p - 1);
      setAnimating(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  };

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) {
      toast({ title: "Eksik Cevaplar", description: "Lütfen tüm soruları cevaplayınız.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const answerList = Object.entries(answers).map(([qId, ans]) => ({
        questionNumber: Number(qId),
        answer: ans,
      }));
      const res1 = await fetch(`/api/ai-assessment/${id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers: answerList }),
      });
      if (!res1.ok) throw new Error("Cevaplar kaydedilemedi");

      const res2 = await fetch(`/api/ai-assessment/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res2.ok) throw new Error("Değerlendirme tamamlanamadı");

      navigate(`/ai-guvenlik/${id}/rapor`);
    } catch (err) {
      toast({
        title: "Hata",
        description: err instanceof Error ? err.message : "Bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Brain className="h-4 w-4 text-violet-600" />
              </div>
              <span className="font-semibold text-sm text-slate-900 dark:text-white">AI Güvenlik Değerlendirmesi</span>
            </div>
            <span className="text-xs text-slate-500">{answeredCount}/{totalQuestions} cevaplandı</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="flex gap-1.5 mt-2">
            {SECTIONS.map((s, i) => (
              <div
                key={s.id}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i < currentSectionIndex ? "bg-violet-500" :
                  i === currentSectionIndex ? "bg-violet-300" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={`max-w-3xl mx-auto px-4 py-8 transition-opacity duration-200 ${animating ? "opacity-0" : "opacity-100"}`}>
        <div className="mb-2 text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider">
          Alan {currentSectionIndex + 1} / {SECTIONS.length}
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{section.title}</h2>

        <div className="space-y-6">
          {section.questions.map((q) => {
            const isReverse = REVERSE_QUESTIONS.has(q.id);
            const selectedAnswer = answers[q.id];
            return (
              <Card key={q.id} className={`border ${selectedAnswer ? "border-violet-200 dark:border-violet-800" : "border-slate-200 dark:border-slate-800"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-slate-400 mt-0.5 shrink-0">S{q.id}</span>
                    <div>
                      <CardTitle className="text-base font-medium text-slate-900 dark:text-white leading-snug">
                        {q.text}
                      </CardTitle>
                      {q.weight === 3 && (
                        <Badge className="mt-1.5 text-xs bg-red-50 text-red-700 border border-red-200">
                          Kritik Kontrol
                        </Badge>
                      )}
                      {q.weight === 2 && (
                        <Badge className="mt-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200">
                          Önemli Kontrol
                        </Badge>
                      )}
                    </div>
                  </div>
                  {q.helpText && (
                    <div className="ml-6 mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-400">{q.helpText}</p>
                    </div>
                  )}
                  {isReverse && (
                    <div className="ml-6 mt-1 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Bu soruda "Evet" yanıtı risk göstergesidir
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {ANSWER_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswer(q.id, opt.value)}
                        className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left ${
                          selectedAnswer === opt.value
                            ? opt.activeClass
                            : `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${opt.hoverClass}`
                        }`}
                      >
                        <span className="font-semibold text-sm">{opt.label}</span>
                        <span className="text-xs opacity-70 mt-0.5">{opt.sublabel}</span>
                        {opt.value === "bilmiyorum" && (
                          <span className="text-xs text-orange-600 mt-0.5 font-medium">= 0 puan</span>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => switchSection("prev")}
            disabled={isFirstSection || animating}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Geri
          </Button>

          {isLastSection ? (
            <Button
              onClick={handleSubmit}
              disabled={!sectionComplete || submitting}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tamamlanıyor...</>
              ) : (
                <>Raporu Oluştur <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => switchSection("next")}
              disabled={!sectionComplete || animating}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Sonraki Alan <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        {!sectionComplete && (
          <p className="text-center text-xs text-slate-400 mt-3">
            Devam etmek için bu alandaki tüm soruları cevaplayın ({section.questions.filter(q => !answers[q.id]).length} kaldı)
          </p>
        )}
      </div>
    </div>
  );
}
