import { useQuery } from "@tanstack/react-query";
import { FileText, Shield } from "lucide-react";

export default function Kvkk() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const content = settings?.["kvkk.content"] ?? "KVKK metni yükleniyor...";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="h-10 w-10 text-emerald-400" />
            <h1 className="text-4xl font-bold">KVKK Aydinlatma Metni</h1>
          </div>
          <p className="text-slate-400">6698 Sayili Kisisel Verilerin Korunmasi Kanunu</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-16">
        <div className="bg-card border rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b">
            <Shield className="h-6 w-6 text-emerald-500" />
            <div>
              <div className="font-semibold">Veri Sorumlusu</div>
              <div className="text-sm text-muted-foreground">CyberStep.io</div>
            </div>
          </div>
          <div className="prose prose-slate max-w-none">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{content}</p>
          </div>
          <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
            Son guncelleme: {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}
