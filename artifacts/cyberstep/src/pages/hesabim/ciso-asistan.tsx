/**
 * Portal — CISO Asistan Paketi sayfası
 * Uyum skoru, board raporları, politika kütüphanesi
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, CheckCircle2, XCircle, FileText, BookOpen,
  BarChart3, RefreshCw, Send, ChevronDown, ChevronUp, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

interface ComplianceItem {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  note: string | null;
}

interface ComplianceData {
  subscription: {
    hasDedicatedCiso: boolean;
    cisoName: string | null;
    boardReportEmail: string | null;
    hasIncidentResponsePlan: boolean;
    hasDataInventory: boolean;
    kvkkVerbisRegistered: boolean;
    employeeCount: number | null;
    sector: string | null;
    policiesCount: number;
    policiesGeneratedAt: string | null;
  } | null;
  complianceScore: {
    score7545: number;
    scoreKvkk: number;
    checklist7545: ComplianceItem[];
    checklistKvkk: ComplianceItem[];
    calculatedAt: string;
  } | null;
}

interface BoardReport {
  id: number;
  reportMonth: number;
  reportYear: number;
  currentScore: number | null;
  previousScore: number | null;
  riskLevel: string | null;
  executiveSummary: string | null;
  status: string;
  criticalFindings: number | null;
  estimatedRiskTl: number | null;
}

interface SecurityPolicy {
  id: number;
  policyType: string;
  title: string | null;
  status: string | null;
  content: string | null;
  approvedAt: string | null;
  generatedAt: string;
}

const POLICY_LABELS: Record<string, string> = {
  information_security: "Bilgi Güvenliği Politikası",
  password: "Şifre Yönetimi Politikası",
  remote_work: "Uzaktan Çalışma Güvenlik Politikası",
  byod: "Kişisel Cihaz (BYOD) Politikası",
  data_classification: "Veri Sınıflandırma Politikası",
  incident_response: "Siber Olay Müdahale Prosedürü",
  vendor_assessment: "Tedarikçi Güvenlik Değerlendirme Formu",
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-foreground">%{score}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function CisoAsistanPortal() {
  usePageMeta({ title: "CISO Asistan | Hesabım — CyberStep.io" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState<Record<string, unknown>>({});
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  const { data: complianceData, isLoading: loadingCompliance } = useQuery<ComplianceData>({
    queryKey: ["ciso-compliance"],
    queryFn: async () => {
      const r = await fetch("/api/portal/ciso/compliance");
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<ComplianceData>;
    },
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery<BoardReport[]>({
    queryKey: ["ciso-board-reports"],
    queryFn: async () => {
      const r = await fetch("/api/portal/ciso/board-reports");
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<BoardReport[]>;
    },
  });

  const { data: policies = [], isLoading: loadingPolicies } = useQuery<SecurityPolicy[]>({
    queryKey: ["ciso-policies"],
    queryFn: async () => {
      const r = await fetch("/api/portal/ciso/policies");
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<SecurityPolicy[]>;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const r = await fetch("/api/portal/ciso/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Güncellenemedi");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ciso-compliance"] });
      toast({ title: "Profil güncellendi" });
    },
    onError: () => toast({ title: "Hata", description: "Güncelleme başarısız", variant: "destructive" }),
  });

  const approvePolicy = useMutation({
    mutationFn: async (type: string) => {
      const r = await fetch(`/api/portal/ciso/policies/${type}/approve`, { method: "POST" });
      if (!r.ok) throw new Error("Onaylanamadı");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ciso-policies"] });
      toast({ title: "Politika onaylandı" });
    },
  });

  const sendReport = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/portal/ciso/board-reports/${id}/send`, { method: "POST" });
      if (!r.ok) throw new Error("Gönderilemedi");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ciso-board-reports"] });
      toast({ title: "Rapor e-posta ile gönderildi" });
    },
    onError: () => toast({ title: "Hata", description: "Gönderme başarısız", variant: "destructive" }),
  });

  const sub = complianceData?.subscription;
  const score = complianceData?.complianceScore;

  const initProfile = () => {
    setProfileForm({
      hasDedicatedCiso: sub?.hasDedicatedCiso ?? false,
      cisoName: sub?.cisoName ?? "",
      boardReportEmail: sub?.boardReportEmail ?? "",
      hasIncidentResponsePlan: sub?.hasIncidentResponsePlan ?? false,
      hasDataInventory: sub?.hasDataInventory ?? false,
      kvkkVerbisRegistered: sub?.kvkkVerbisRegistered ?? false,
    });
  };

  const monthLabel = (m: number, y: number) => {
    const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    return `${months[m - 1] ?? m} ${y}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-10">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">

        {/* Başlık */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CISO Asistan Paketi</h1>
            <p className="text-sm text-muted-foreground mt-1">Aylık rapor, uyum takibi ve politika kütüphanesi</p>
          </div>
          <Badge variant="outline" className="border-green-500/40 text-green-600 bg-green-500/5">Aktif</Badge>
        </div>

        {/* ─── Uyum Skoru ─────────────────────────────────────────── */}
        <section className="border border-border/50 rounded-2xl p-6 bg-card/30 space-y-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Uyum Durumu</h2>
            {score && (
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(score.calculatedAt).toLocaleDateString("tr-TR")}
              </span>
            )}
          </div>

          {loadingCompliance ? (
            <div className="text-sm text-muted-foreground">Yükleniyor...</div>
          ) : score ? (
            <>
              <div className="grid sm:grid-cols-2 gap-5">
                <ScoreBar score={score.score7545} label="7545 Kanunu Uyumu" />
                <ScoreBar score={score.scoreKvkk} label="KVKK Uyumu" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eksik Maddeler</p>
                {[...score.checklist7545, ...score.checklistKvkk]
                  .filter(item => !item.passed)
                  .map(item => (
                    <div key={item.id} className="flex items-start gap-2 p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-800/30 rounded-lg">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-foreground">{item.label}</p>
                        {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
                      </div>
                    </div>
                  ))}
                {[...score.checklist7545, ...score.checklistKvkk].every(i => i.passed) && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Tüm maddeler tamam
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Uyum skoru henüz hesaplanmadı.</p>
          )}
        </section>

        {/* ─── Profil Güncelle ─────────────────────────────────────── */}
        <section className="border border-border/50 rounded-2xl p-6 bg-card/30 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Uyum Bilgilerimi Güncelle</h2>
            </div>
            {Object.keys(profileForm).length === 0 && (
              <Button variant="outline" size="sm" onClick={initProfile}>Düzenle</Button>
            )}
          </div>

          {Object.keys(profileForm).length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CISO / Güvenlik Sorumlusu Adı</Label>
                  <Input
                    value={String(profileForm["cisoName"] ?? "")}
                    onChange={e => setProfileForm(f => ({ ...f, cisoName: e.target.value }))}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Board Raporu E-posta Adresi</Label>
                  <Input
                    type="email"
                    value={String(profileForm["boardReportEmail"] ?? "")}
                    onChange={e => setProfileForm(f => ({ ...f, boardReportEmail: e.target.value }))}
                    placeholder="ceo@sirket.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "hasDedicatedCiso", label: "Siber Güvenlik Sorumlusu atandı" },
                  { key: "hasIncidentResponsePlan", label: "Olay müdahale planı onaylandı" },
                  { key: "hasDataInventory", label: "Kişisel veri envanteri oluşturuldu" },
                  { key: "kvkkVerbisRegistered", label: "VERBİS kaydı yapıldı" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={Boolean(profileForm[key])}
                      onCheckedChange={v => setProfileForm(f => ({ ...f, [key]: Boolean(v) }))}
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  size="sm"
                  onClick={() => updateProfile.mutate(profileForm)}
                  disabled={updateProfile.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {updateProfile.isPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setProfileForm({})}>İptal</Button>
              </div>
            </div>
          )}
        </section>

        {/* ─── Board Raporları ──────────────────────────────────────── */}
        <section className="border border-border/50 rounded-2xl p-6 bg-card/30 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Aylık Yönetim Kurulu Raporları</h2>
          </div>

          {loadingReports ? (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz rapor oluşturulmadı. Her ayın 25'inde otomatik üretilir.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <div key={r.id} className="border border-border/40 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpandedReport(expandedReport === r.id ? null : r.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm text-foreground">{monthLabel(r.reportMonth, r.reportYear)}</span>
                      {r.currentScore !== null && (
                        <Badge variant="outline" className="text-xs border-border/50">
                          Skor: {r.currentScore}/100
                        </Badge>
                      )}
                      {r.status === "sent" && (
                        <Badge variant="outline" className="text-xs border-green-500/40 text-green-600 bg-green-500/5">Gönderildi</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={e => { e.stopPropagation(); sendReport.mutate(r.id); }}
                        disabled={sendReport.isPending}
                        className="text-xs"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        E-posta
                      </Button>
                      {expandedReport === r.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {expandedReport === r.id && r.executiveSummary && (
                    <div className="px-4 pb-4 border-t border-border/40 pt-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">{r.executiveSummary}</p>
                      {r.estimatedRiskTl !== null && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Tahmini risk: <strong className="text-foreground">{r.estimatedRiskTl.toLocaleString("tr-TR")} TL</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Politika Kütüphanesi ─────────────────────────────────── */}
        <section className="border border-border/50 rounded-2xl p-6 bg-card/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Güvenlik Politikası Kütüphanesi</h2>
            </div>
            <span className="text-xs text-muted-foreground">{policies.length} / 7 şablon</span>
          </div>

          {loadingPolicies ? (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          ) : policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Politikalar henüz üretilmedi. Ekibimiz paketinizi aktive ettiğinde otomatik olarak oluşturulacak.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(POLICY_LABELS).map(([type, label]) => {
                const policy = policies.find(p => p.policyType === type);
                if (!policy) return (
                  <div key={type} className="flex items-center gap-3 p-3 border border-border/30 rounded-lg opacity-40">
                    <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">Oluşturuluyor...</span>
                  </div>
                );

                return (
                  <div key={type} className="border border-border/40 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => setExpandedPolicy(expandedPolicy === type ? null : type)}
                    >
                      {policy.status === "approved" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground flex-1">{label}</span>
                      <div className="flex items-center gap-2">
                        {policy.status === "approved" ? (
                          <Badge variant="outline" className="text-xs border-green-500/40 text-green-600 bg-green-500/5">Onaylı</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={e => { e.stopPropagation(); approvePolicy.mutate(type); }}
                            disabled={approvePolicy.isPending}
                          >
                            Onayla
                          </Button>
                        )}
                        {expandedPolicy === type ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {expandedPolicy === type && policy.content && (
                      <div className="px-4 pb-4 border-t border-border/40 pt-3">
                        <pre className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
                          {policy.content}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="text-center pt-4">
          <Link href="/hesabim" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Hesabıma Dön
          </Link>
        </div>

      </div>
    </div>
  );
}
