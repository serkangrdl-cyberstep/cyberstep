import { useQuery } from "@tanstack/react-query";
import { Shield, Users, Target, Award } from "lucide-react";

export default function Hakkimizda() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const title = settings?.["about.title"] ?? "CyberStep.io Hakkında";
  const content = settings?.["about.content"] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-emerald-400" />
            <h1 className="text-4xl font-bold">{title}</h1>
          </div>
          <p className="text-slate-400 text-lg">KOBİ'ler için siber güvenlik risk analizi</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-16">
        <div className="bg-card border rounded-2xl p-8 mb-12">
          <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">{content}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Target, title: "Misyonumuz", desc: "KOBİ'lerin siber güvenlik farkındalığını artırmak ve uygulanabilir aksiyon planları sunmak." },
            { icon: Users, title: "Kitleimiz", desc: "1'den 250'ye kadar çalışanı olan tüm sektörlerden Türkiye'deki küçük ve orta ölçekli işletmeler." },
            { icon: Award, title: "Yöntemimiz", desc: "Yapay zeka destekli analiz ile uzman incelemesini birleştiren hibrit bir değerlendirme modeli." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border rounded-xl p-6">
              <Icon className="h-8 w-8 text-emerald-500 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
