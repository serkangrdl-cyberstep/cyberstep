import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, Download, Clock, ChevronRight, RefreshCw, Shield, Zap, RotateCcw } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Layout } from "@/components/layout";

interface PolicyDoc {
  id: number; version: number; versionLabel: string; status: string;
  generatedAt: string; generationReason: string; changesSummary: string;
  changedSections: string[]; docxPath: string | null; pdfPath: string | null;
  approvedAt: string | null; nextUpdateDate: string | null;
  policyText: string;
}
interface PolicySub { id: number; status: string; autoGenerate: boolean; nextBillingDate: string | null; }

function useCustomer() {
  return useQuery({ queryKey: ["me"], queryFn: () => fetch("/api/customers/me").then(r => r.ok ? r.json() : null), retry: false, staleTime: 60_000 });
}

function LandingView() {
  return (
    <>
      <section className="py-20 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">990 TL / yıl + KDV</Badge>
          <h1 className="text-4xl font-bold text-white mb-4">AI Politika Otomatik Güncelleme</h1>
          <p className="text-xl text-muted-foreground mb-2">KVKK uyumlu yapay zeka politikanız her çeyrek otomatik güncelleniyor.</p>
          <p className="text-lg text-primary font-semibold mb-8">Siz sadece imzalayın.</p>
          <Link href="/kayit" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors">
            Politikamı Oluştur <ChevronRight className="h-5 w-5" />
          </Link>
          <p className="text-sm text-muted-foreground mt-4">Normal danışmanlık maliyeti: 3.000–8.000 TL/yıl</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {[
              { icon: FileText, title: "İlk kurulumda şirketinize özel politika", desc: "Sektörünüz, çalışan sayısı ve kullandığınız AI araçlarına göre hazırlanır." },
              { icon: RotateCcw, title: "AI araçları değişince otomatik güncelleme", desc: "ChatGPT veya Gemini gizlilik politikasını değiştirirse politikanız da güncellenir." },
              { icon: Download, title: "PDF + Word formatında indirme", desc: "Tüm versiyonlar arşivlenir. İstediğiniz zaman indirebilirsiniz." },
              { icon: Shield, title: "KVKK Madde 9 ve 12 uyumlu", desc: "Yurt dışı aktarım, açık rıza ve veri işleme yükümlülükleri dahil edilir." },
            ].map(f => (
              <div key={f.title} className="flex gap-4 p-5 rounded-xl border bg-card">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8 text-center">
            <p className="text-3xl font-bold text-primary mb-1">990 TL / yıl <span className="text-sm font-normal text-muted-foreground">+ KDV</span></p>
            <p className="text-muted-foreground mb-6">4 otomatik güncelleme — yılda bir kez faturalama</p>
            <Link href="/kayit" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              Şimdi Başla <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ManagementView({ customerId }: { customerId: number }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"current" | "history" | "settings">("current");

  const { data: sub } = useQuery<PolicySub | null>({ queryKey: ["ai-policy-sub", customerId], queryFn: () => fetch("/api/ai-policy/subscription").then(r => r.json()) });
  const { data: currentDoc, isLoading: loadingDoc } = useQuery<PolicyDoc | null>({ queryKey: ["ai-policy-current", customerId], queryFn: () => fetch("/api/ai-policy/current").then(r => r.json()), enabled: !!sub });
  const { data: versions = [] } = useQuery<PolicyDoc[]>({ queryKey: ["ai-policy-versions", customerId], queryFn: () => fetch("/api/ai-policy/versions").then(r => r.json()), enabled: activeTab === "history" && !!sub });

  const subscribeMutation = useMutation({
    mutationFn: () => fetch("/api/ai-policy/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-policy-sub"] }),
  });
  const generateMutation = useMutation({
    mutationFn: () => fetch("/api/ai-policy/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["ai-policy-current"] }), 3000),
  });
  const approveMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/ai-policy/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-policy-current"] }),
  });

  const reasonLabel = (reason: string) => {
    if (reason === "quarterly_update") return "Çeyreklik otomatik güncelleme";
    if (reason === "tool_change") return "AI aracı politika değişikliği";
    if (reason === "manual_request") return "Manuel istek";
    return "İlk oluşturma";
  };

  if (!sub) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">AI Politika Servisi</h2>
        <p className="text-muted-foreground mb-8">Şirketinize özel KVKK uyumlu AI kullanım politikası oluşturun. Her çeyrek otomatik güncellenir.</p>
        <button onClick={() => subscribeMutation.mutate()} disabled={subscribeMutation.isPending}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {subscribeMutation.isPending ? "Başlatılıyor..." : "Aboneliği Başlat — 990 TL/yıl + KDV"}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Kullanım Politikası</h1>
          <p className="text-muted-foreground text-sm">Abonelik aktif — sonraki fatura: {sub.nextBillingDate ?? "—"}</p>
        </div>
        <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
          className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-primary/10 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending ? "Üretiliyor..." : "Yeniden Üret"}
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-muted/40 rounded-lg p-1 w-fit">
        {(["current", "history", "settings"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "current" ? "Güncel Politika" : t === "history" ? "Versiyon Geçmişi" : "Abonelik Ayarları"}
          </button>
        ))}
      </div>

      {activeTab === "current" && (
        <div>
          {loadingDoc ? (
            <div className="text-center py-16 text-muted-foreground">Politika yükleniyor...</div>
          ) : !currentDoc ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">Henüz politika oluşturulmadı.</p>
              <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
                {generateMutation.isPending ? "Oluşturuluyor..." : "Politikayı Oluştur"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="p-6 border-b bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-lg">{currentDoc.versionLabel ?? `v${currentDoc.version}`}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentDoc.status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {currentDoc.status === "approved" ? "Onaylandi" : "Taslak"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{reasonLabel(currentDoc.generationReason)} · {new Date(currentDoc.generatedAt).toLocaleDateString("tr-TR")}</p>
                    {currentDoc.changesSummary && (
                      <p className="text-sm mt-2 text-foreground">{currentDoc.changesSummary}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {currentDoc.docxPath && (
                      <a href={`/api/ai-policy/${currentDoc.id}/docx`}
                        className="flex items-center gap-1.5 border border-muted-foreground/30 text-muted-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors">
                        <Download className="h-3.5 w-3.5" /> Word
                      </a>
                    )}
                    {currentDoc.status === "draft" && (
                      <button onClick={() => approveMutation.mutate(currentDoc.id)} disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
                      </button>
                    )}
                  </div>
                </div>
                {currentDoc.nextUpdateDate && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                    <Clock className="h-3.5 w-3.5" />
                    Sonraki otomatik güncelleme: {new Date(currentDoc.nextUpdateDate).toLocaleDateString("tr-TR")}
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Politika Onizleme</h3>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground max-h-96 overflow-y-auto">
                  {currentDoc.policyText}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Henüz versiyon geçmişi yok.</p>
          ) : versions.map(v => (
            <div key={v.id} className="rounded-xl border bg-card p-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{v.versionLabel ?? `v${v.version}`}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === "approved" ? "bg-green-100 text-green-700" : v.status === "superseded" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"}`}>
                    {v.status === "approved" ? "Onaylandi" : v.status === "superseded" ? "Gecerliligi Doldu" : "Taslak"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(v.generatedAt).toLocaleDateString("tr-TR")} · {reasonLabel(v.generationReason)}</p>
                {v.changesSummary && <p className="text-sm text-muted-foreground mt-1">{v.changesSummary}</p>}
              </div>
              {v.docxPath && (
                <a href={`/api/ai-policy/${v.id}/docx`}
                  className="flex items-center gap-1.5 border text-muted-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-muted shrink-0">
                  <Download className="h-3.5 w-3.5" /> Word
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Abonelik Bilgileri</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Plan</span><span className="font-medium">990 TL / yıl + KDV</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Durum</span><span className={`font-medium ${sub.status === "active" ? "text-green-600" : "text-red-500"}`}>{sub.status === "active" ? "Aktif" : "Pasif"}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Sonraki fatura</span><span>{sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString("tr-TR") : "—"}</span></div>
            <div className="flex justify-between py-2"><span className="text-muted-foreground">Otomatik güncelleme</span><span>{sub.autoGenerate ? "Açık" : "Kapalı"}</span></div>
          </div>
          <div className="mt-6 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
            <p className="text-sm text-muted-foreground">
              Ödeme işlemleri için <Link href="/iletisim" className="text-primary underline">iletişim</Link> sayfasından ulaşabilirsiniz.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiPolitika() {
  usePageMeta({ title: "AI Politika Otogüncelleme | CyberStep.io", description: "KVKK uyumlu yapay zeka kullanım politikanız otomatik güncellenir. Her çeyrek yeni versiyon, PDF + Word indirme." });
  const { data: customer, isLoading } = useCustomer();
  if (isLoading) return null;
  if (!customer?.id) return <LandingView />;
  return <ManagementView customerId={customer.id} />;
}
