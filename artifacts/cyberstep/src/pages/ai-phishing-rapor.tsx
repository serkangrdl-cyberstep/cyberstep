import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Clock } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Layout } from "@/components/layout";
import { Link } from "wouter";

interface OsintSource { id: number; sourceType: string; dataFound: string; riskContribution: string; }
interface EmailPayload { from_display: string; to: string; subject: string; body: string; manipulation_technique: string; }
interface Scenario {
  scenario_id: number; attack_type: string; attack_type_icon: string;
  why_effective: string; public_data_used: string[];
  email: EmailPayload;
  red_flags: string[]; if_successful: string; prevention: string;
}
interface SimReport {
  id: number; companyName: string; domain: string; status: string;
  osintData: Record<string, unknown>; scenarios: Scenario[];
  osintSources: OsintSource[]; createdAt: string;
}

const RISK_COL: Record<string, string> = { high: "text-red-600", medium: "text-amber-600", low: "text-green-600" };

export default function AiPhishingRapor() {
  usePageMeta({ title: "AI Phishing Simülasyon Raporu | CyberStep.io", description: "Şirketinize yönelik AI tabanlı phishing simülasyon sonuçları." });
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery<SimReport>({
    queryKey: ["phishing-sim-report", id],
    queryFn: () => fetch(`/api/phishing-sim/${id}/report`).then(r => { if (!r.ok) throw new Error("Rapor yüklenemedi"); return r.json(); }),
    retry: false,
  });

  if (isLoading) return (
    <Layout>
      <div className="container mx-auto px-4 max-w-3xl py-16 text-center">
        <Clock className="h-8 w-8 text-primary animate-pulse mx-auto mb-3" />
        <p className="text-muted-foreground">Rapor yükleniyor...</p>
      </div>
    </Layout>
  );

  if (isError || !data) return (
    <Layout>
      <div className="container mx-auto px-4 max-w-xl py-16 text-center">
        <p className="text-muted-foreground">Rapor bulunamadı veya erişim izniniz yok.</p>
        <Link href="/ai-phishing-simulasyonu" className="text-primary underline text-sm mt-3 inline-block">Yeni simülasyon başlat</Link>
      </div>
    </Layout>
  );

  const osint = (data.osintData ?? {}) as Record<string, unknown>;
  const scenarios: Scenario[] = Array.isArray(data.scenarios) ? data.scenarios : [];

  return (
    <Layout>
      {/* Warning banner */}
      <div className="bg-red-600 text-white py-3 text-center text-sm font-semibold">
        SIMÜLASYON RAPORU — GERÇEK E-POSTALAR GÖNDERİLMEDİ — YALNIZCA FARKINDALIK AMAÇLIDIR
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-10">
        <div className="mb-8">
          <Badge variant="outline" className="mb-3">Phishing Simülasyon Raporu</Badge>
          <h1 className="text-3xl font-bold mb-1">{data.companyName}</h1>
          <p className="text-muted-foreground">{data.domain} · {new Date(data.createdAt).toLocaleDateString("tr-TR")}</p>
        </div>

        {/* OSINT summary */}
        <div className="rounded-xl border bg-card mb-8">
          <div className="p-5 border-b bg-muted/30">
            <h2 className="font-bold text-lg mb-1">Kamuya Açık Veri Özeti</h2>
            <p className="text-sm text-muted-foreground">Bir saldırgan bu bilgilere 5 dakikada ulaşabilir.</p>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            {Boolean(osint["websiteTitle"]) && (
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Web Sitesi Başlığı</p>
                <p className="text-sm">{String(osint["websiteTitle"])}</p>
              </div>
            )}
            {Array.isArray(osint["technologyStack"]) && (osint["technologyStack"] as string[]).length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Teknoloji Altyapısı</p>
                <p className="text-sm">{(osint["technologyStack"] as string[]).join(", ")}</p>
              </div>
            )}
            {Array.isArray(osint["emailPatterns"]) && (osint["emailPatterns"] as string[]).length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-700/50">
                <p className="text-xs font-semibold text-red-600 uppercase mb-1">E-posta Formatı Tespit Edildi</p>
                <p className="text-sm font-mono">{(osint["emailPatterns"] as string[])[0]}</p>
              </div>
            )}
            <div className={`p-3 rounded-lg border ${Number(osint["haveIBeenPwnedCount"] ?? 0) > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-muted/30"}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Veri İhlali Geçmişi</p>
              <p className={`text-sm font-semibold ${Number(osint["haveIBeenPwnedCount"] ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                {Number(osint["haveIBeenPwnedCount"] ?? 0)} ihlal kayıtlı
              </p>
            </div>
            <div className={`p-3 rounded-lg border ${!osint["spfConfigured"] ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-muted/30"}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">SPF Kaydı</p>
              <p className={`text-sm font-semibold ${osint["spfConfigured"] ? "text-green-600" : "text-red-600"}`}>
                {osint["spfConfigured"] ? "Var — E-posta taklit koruması aktif" : "Yok — E-posta taklit riski!"}
              </p>
            </div>
            <div className={`p-3 rounded-lg border ${!osint["dmarcConfigured"] ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-muted/30"}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">DMARC Kaydı</p>
              <p className={`text-sm font-semibold ${osint["dmarcConfigured"] ? "text-green-600" : "text-red-600"}`}>
                {osint["dmarcConfigured"] ? "Var — Phishing koruması aktif" : "Yok — Phishing riski!"}
              </p>
            </div>
          </div>
        </div>

        {/* Scenarios */}
        <h2 className="text-xl font-bold mb-5">Simülasyon Senaryoları</h2>
        <div className="space-y-6 mb-10">
          {scenarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-xl">Senaryolar henüz hazırlanıyor...</div>
          ) : scenarios.map(sc => (
            <div key={sc.scenario_id} className="rounded-xl border bg-card overflow-hidden">
              <div className="p-5 border-b bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{sc.attack_type_icon}</span>
                  <h3 className="font-bold text-lg">Senaryo {sc.scenario_id}: {sc.attack_type}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{sc.why_effective}</p>
                {sc.public_data_used?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sc.public_data_used.map(d => (
                      <span key={d} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">{d}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulated email */}
              <div className="p-5">
                <div className="rounded-lg border bg-background overflow-hidden mb-4">
                  <div className="bg-muted/50 px-4 py-2 border-b text-xs font-mono space-y-1">
                    <div><span className="text-muted-foreground">Kimden:</span> {sc.email.from_display}</div>
                    <div><span className="text-muted-foreground">Kime:</span> {sc.email.to}</div>
                    <div><span className="text-muted-foreground">Konu:</span> <strong>{sc.email.subject}</strong></div>
                  </div>
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{sc.email.body}</pre>
                  </div>
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t text-xs text-red-600 font-semibold text-center">
                    ⚠️ BU BİR SİMÜLASYONDUR — GERÇEK E-POSTA DEĞİLDİR
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Red flags */}
                  <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-700 dark:text-red-300">Dikkat Edilmesi Gerekenler</span>
                    </div>
                    <ul className="space-y-1">
                      {sc.red_flags?.map(f => (
                        <li key={f} className="text-xs text-red-700 dark:text-red-300 flex gap-1.5"><span className="shrink-0 mt-0.5">→</span>{f}</li>
                      ))}
                    </ul>
                  </div>
                  {/* Prevention */}
                  <div className="p-4 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">Koruma Yöntemi</span>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300">{sc.prevention}</p>
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700/50">
                      <p className="text-xs font-medium text-muted-foreground">Başarılı olursa:</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sc.if_successful}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Upsell */}
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8 text-center">
          <h3 className="text-lg font-bold mb-2">Bu Senaryolardan Korunmak İçin</h3>
          <p className="text-muted-foreground text-sm mb-6">Tam güvenlik değerlendirmesi yapın, AI araç izleme ve politika servisleriyle korumanızı tamamlayın.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/degerlendirme-baslat" className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              Tam Degerlendirme Yaptir
            </Link>
            <Link href="/ai-arac-izleme" className="border border-primary text-primary px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/10 transition-colors">
              AI Araç İzleme Başlat
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
