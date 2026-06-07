import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shield, CheckCircle2 } from "lucide-react";

export default function NpsPage() {
  const { lang } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isError } = useQuery<{ id?: number; customerName?: string; companyName?: string; alreadyResponded?: boolean; error?: string }>({
    queryKey: ["/api/nps", token],
    queryFn: () => fetch(`/api/nps/${token}`).then(r => r.json()),
  });

  const respond = useMutation({
    mutationFn: () => fetch(`/api/nps/${token}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score, feedbackText: feedback }) }).then(r => r.json()),
    onSuccess: () => setSubmitted(true),
  });

  const COLORS = [
    "#E53E3E","#E53E3E","#E53E3E","#E53E3E","#E53E3E","#E53E3E","#E53E3E",
    "#ECC94B","#ECC94B",
    "#48BB78","#48BB78",
  ];

  if (isLoading) return <NpsLayout><div className="text-slate-400 text-center py-20">Yükleniyor...</div></NpsLayout>;
  if (isError || data?.error) return <NpsLayout><div className="text-red-400 text-center py-20">Anket bulunamadı veya geçersiz bağlantı.</div></NpsLayout>;
  if (data?.alreadyResponded || submitted) {
    return (
      <NpsLayout>
        <div className="text-center py-12">
          <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Teşekkürler!</h2>
          <p className="text-slate-400">Görüşünüz başarıyla kaydedildi. Katkınız için teşekkür ederiz.</p>
        </div>
      </NpsLayout>
    );
  }

  return (
    <NpsLayout>
      <div className="text-center mb-8">
        <p className="text-slate-400 text-sm">Sayın {data?.companyName ?? data?.customerName},</p>
        <h1 className="text-2xl font-bold text-white mt-2">{lang === "en" ? "How likely are you to recommend CyberStep to a colleague?" : "CyberStep'i bir meslektaşınıza tavsiye etme olasılığınız nedir?"}</h1>
        <p className="text-slate-500 text-sm mt-2">{lang === "en" ? "0 = Not at all likely, 10 = Extremely likely" : "0 = Kesinlikle tavsiye etmem, 10 = Kesinlikle tavsiye ederim"}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => setScore(i)}
            className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${score === i ? "scale-110 ring-2 ring-white text-white" : "text-slate-200 hover:scale-105"}`}
            style={{ backgroundColor: score === i ? COLORS[i] : "#1e293b", borderColor: COLORS[i] }}
          >
            {i}
          </button>
        ))}
      </div>

      {score !== null && (
        <div className="max-w-md mx-auto mt-6 space-y-4">
          <div>
            <p className={`text-center font-semibold mb-4 ${score >= 9 ? "text-emerald-400" : score >= 7 ? "text-yellow-400" : "text-red-400"}`}>
              {score >= 9 ? "Harika! Bizi tavsiye ettiğiniz için teşekkürler." : score >= 7 ? "Görüşünüzü paylaştığınız için teşekkürler." : "Bunu duymak üzücü. Nasıl gelişebileceğimizi duymak isteriz."}
            </p>
            <Textarea
              className="bg-slate-800 border-slate-700 text-white"
              rows={3}
              placeholder="Bu puanı neden verdiniz? (isteğe bağlı)"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => respond.mutate()} disabled={respond.isPending}>
            {respond.isPending ? "Gönderiliyor..." : "Yanıtı Gönder"}
          </Button>
        </div>
      )}
    </NpsLayout>
  );
}

function NpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 justify-center mb-8">
          <Shield className="h-6 w-6 text-cyan-400" />
          <span className="text-white font-bold text-xl">CyberStep.io</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
