import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ChevronRight, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AiTool {
  id: number;
  toolName: string;
  provider: string | null;
  category: string | null;
  tier: string | null;
  riskLevel: string | null;
  riskSummary: string | null;
  kvkkCompatible: boolean | null;
  dpaAvailable: boolean | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  llm: "Büyük Dil Modeli",
  image_gen: "Görsel AI",
  translation: "Çeviri",
  coding: "Kod Yardımcısı",
  productivity: "Üretkenlik",
  voice: "Ses AI",
  video: "Video AI",
};

const RISK_CONFIG: Record<string, { label: string; cls: string }> = {
  KRITIK: { label: "Kritik Risk",  cls: "bg-red-100 text-red-700 border-red-200" },
  YUKSEK: { label: "Yüksek Risk",  cls: "bg-orange-100 text-orange-700 border-orange-200" },
  ORTA:   { label: "Orta Risk",    cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  DUSUK:  { label: "Düşük Risk",   cls: "bg-green-100 text-green-700 border-green-200" },
};

export default function AiAssessmentTools() {
  const [, params] = useRoute("/ai-guvenlik/:id/araclar");
  const id = Number(params?.id ?? 0);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/ai-tools", { credentials: "include" })
      .then(r => r.json())
      .then((data: AiTool[]) => setTools(data))
      .catch(() => toast({ title: "Araçlar yüklenemedi", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (toolId: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-assessment/${id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toolIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Kaydedilemedi");
      navigate(`/ai-guvenlik/${id}/sorular`);
    } catch {
      toast({ title: "Hata", description: "Araçlar kaydedilemedi.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Kategorilere göre grupla
  const grouped = tools.reduce<Record<string, AiTool[]>>((acc, tool) => {
    const cat = tool.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {});

  // Risk özeti için seçili araçlar
  const selectedTools = tools.filter(t => selected.has(t.id));
  const riskCounts = selectedTools.reduce<Record<string, number>>((acc, t) => {
    const r = t.riskLevel ?? "BILINMIYOR";
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Adım 1 / 3</p>
              <p className="font-semibold text-slate-900 dark:text-white text-sm">AI Araçlarını Seçin</p>
            </div>
          </div>
          <Button
            onClick={handleContinue}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>Devam <ChevronRight className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Şirketinizde hangi yapay zeka araçları kullanılıyor?
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Çalışanlarınızın kullandığı araçları seçin. Emin değilseniz tahmin edin — sonuçlarda düzeltebilirsiniz.
          </p>
        </div>

        {/* Seçim özeti */}
        {selected.size > 0 && (
          <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-violet-900 dark:text-violet-300 mb-2">
              {selected.size} araç seçildi — Risk profili:
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(riskCounts).map(([risk, count]) => (
                <Badge key={risk} className={`border text-xs ${(RISK_CONFIG[risk] ?? { cls: "bg-slate-100 text-slate-700 border-slate-200" }).cls}`}>
                  {(RISK_CONFIG[risk] ?? { label: risk }).label}: {count} araç
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Kategorilere göre araçlar */}
        {Object.entries(grouped).map(([cat, catTools]) => (
          <div key={cat} className="mb-8">
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catTools.map(tool => {
                const isSelected = selected.has(tool.id);
                const riskConf = RISK_CONFIG[tool.riskLevel ?? ""] ?? { label: tool.riskLevel ?? "?", cls: "bg-slate-100 text-slate-700 border-slate-200" };
                return (
                  <button
                    key={tool.id}
                    onClick={() => toggle(tool.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-violet-300"
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-violet-600" />
                    )}
                    <div className="font-medium text-slate-900 dark:text-white mb-1">{tool.toolName}</div>
                    {tool.provider && <div className="text-xs text-slate-500 mb-2">{tool.provider}</div>}
                    <div className="flex flex-wrap gap-2">
                      <Badge className={`text-xs border ${riskConf.cls}`}>{riskConf.label}</Badge>
                      {tool.tier && (
                        <Badge variant="outline" className="text-xs capitalize">{tool.tier === "free" ? "Ücretsiz" : tool.tier === "enterprise" ? "Kurumsal" : tool.tier === "business" ? "Business" : tool.tier}</Badge>
                      )}
                      {tool.kvkkCompatible && (
                        <Badge className="text-xs bg-green-50 text-green-700 border-green-200 border">KVKK Uyumlu</Badge>
                      )}
                    </div>
                    {tool.riskSummary && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{tool.riskSummary}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-8 text-center">
          <Button
            onClick={handleContinue}
            disabled={saving}
            size="lg"
            className="bg-violet-600 hover:bg-violet-700 text-white px-8"
          >
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...</> : (
              <>Sorulara Geç <ChevronRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
          <p className="text-xs text-slate-400 mt-2">Araç seçmeden de devam edebilirsiniz</p>
        </div>
      </div>
    </div>
  );
}
