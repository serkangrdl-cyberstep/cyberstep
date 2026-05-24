import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Send, Save, AlertTriangle, Plus, Trash2, Building2, User, Mail, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Assessment {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  sector: string;
  employeeCount: string;
  riskLevel: string;
  totalScore: number;
  maxScore: number;
  redAlarmCount: number;
  assessmentType: string;
  createdAt: string;
}

interface Report {
  id: number;
  assessmentId: number;
  scorePercent: number;
  riskLevel: string;
  redAlarmCount: number;
  aiAnalysis: string;
  recommendations: string[];
  domainScores: Array<{ domain: string; score: number; maxScore: number; percent: number }>;
  adminNotes: string | null;
  reviewStatus: string;
  reviewedAt: string | null;
}

const RISK_BADGE: Record<string, string> = {
  "Kritik": "bg-red-100 text-red-700 border-red-200",
  "Yüksek": "bg-orange-100 text-orange-700 border-orange-200",
  "Orta":   "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Düşük":  "bg-green-100 text-green-700 border-green-200",
};

export default function AdminReview() {
  const [, params] = useRoute("/admin/review/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [data, setData] = useState<{ assessment: Assessment; report: Report } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [newRec, setNewRec] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/admin/review/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setAiAnalysis(d.report.aiAnalysis ?? "");
        setRecommendations(d.report.recommendations ?? []);
        setAdminNotes(d.report.adminNotes ?? "");
      })
      .catch(() => setError("Bağlantı hatası. Lütfen sayfayı yenileyin."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/review/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiAnalysis, recommendations, adminNotes }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      toast({ title: "Kaydedildi", description: "Taslak başarıyla kaydedildi." });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(`${data?.assessment.companyName} için raporu onaylayıp müşteriye göndermek istiyor musunuz?`)) return;
    setApproving(true);
    try {
      const r = await fetch(`/api/admin/review/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(prev => prev ? { ...prev, report: d.report } : prev);
      toast({ title: "Gönderildi!", description: `Rapor ${data?.assessment.email} adresine iletildi.` });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const addRec = () => {
    const trimmed = newRec.trim();
    if (!trimmed) return;
    setRecommendations(prev => [...prev, trimmed]);
    setNewRec("");
  };

  const removeRec = (i: number) => setRecommendations(prev => prev.filter((_, idx) => idx !== i));

  const updateRec = (i: number, val: string) =>
    setRecommendations(prev => prev.map((r, idx) => idx === i ? val : r));

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Erişim Hatası</h2>
      <p className="text-muted-foreground">{error}</p>
    </div>
  );

  if (!data) return null;

  const { assessment, report } = data;
  const isEmailed = report.reviewStatus === "emailed";
  const statusLabel = isEmailed ? "Gönderildi" : report.reviewStatus === "approved" ? "Onaylandı" : "Inceleme Bekliyor";
  const statusClass = isEmailed ? "bg-green-100 text-green-700" : report.reviewStatus === "approved" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold">{assessment.companyName}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge className={RISK_BADGE[report.riskLevel] ?? ""}>{report.riskLevel} Risk</Badge>
            <Badge className={statusClass}>{statusLabel}</Badge>
            <Badge variant="outline">%{report.scorePercent} · {report.redAlarmCount} Alarm</Badge>
            <Badge variant="outline">{assessment.assessmentType === "full" ? "Tam" : "Mini"} Değerlendirme</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving || isEmailed}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Kaydet
          </Button>
          <Button onClick={handleApprove} disabled={approving || isEmailed} className="bg-green-600 hover:bg-green-700 text-white">
            {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEmailed ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
            {isEmailed ? "Gönderildi" : "Onayla ve Gönder"}
          </Button>
        </div>
      </div>

      {isEmailed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">Bu rapor <strong>{assessment.email}</strong> adresine gönderildi. Artık düzenleme yapılamaz.</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4 shrink-0" />
          {assessment.contactName}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0" />
          {assessment.email}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          {assessment.sector} · {assessment.employeeCount} çalışan
        </div>
      </div>

      {/* Domain Scores */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alan Puanları</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {report.domainScores.map((d) => (
              <div key={d.domain} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1 truncate">{d.domain}</p>
                <div className="flex items-end justify-between">
                  <span className={`text-lg font-bold ${d.percent >= 70 ? "text-green-600" : d.percent >= 40 ? "text-yellow-600" : "text-red-600"}`}>%{d.percent}</span>
                  <span className="text-xs text-muted-foreground">{d.score}/{d.maxScore}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${d.percent >= 70 ? "bg-green-500" : d.percent >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${d.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Analizi</CardTitle>
          <CardDescription>Gemini tarafından oluşturuldu — düzenleyebilirsiniz</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={aiAnalysis}
            onChange={e => setAiAnalysis(e.target.value)}
            disabled={isEmailed}
            className="min-h-[200px] text-sm leading-relaxed resize-y font-mono"
            placeholder="AI analiz metni burada görünecek..."
          />
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aksiyon Önerileri</CardTitle>
          <CardDescription>Müşteriye gönderilecek öncelikli öneriler</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-1">{i + 1}</span>
              <Textarea
                value={rec}
                onChange={e => updateRec(i, e.target.value)}
                disabled={isEmailed}
                className="text-sm resize-none min-h-[60px]"
              />
              {!isEmailed && (
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive mt-0.5" onClick={() => removeRec(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!isEmailed && (
            <div className="flex gap-2 pt-1">
              <input
                value={newRec}
                onChange={e => setNewRec(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addRec()}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Yeni öneri ekle (Enter ile kaydet)"
              />
              <Button variant="outline" size="icon" onClick={addRec}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card className="mb-8 border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-blue-800">Uzman Notu (Müşteriye Gönderilecek)</CardTitle>
          <CardDescription>Boş bırakırsanız e-postada bu bölüm gösterilmez</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            disabled={isEmailed}
            className="min-h-[120px] text-sm resize-y"
            placeholder="Müşteriye iletmek istediğiniz kişiselleştirilmiş uzman notunuzu buraya yazın..."
          />
        </CardContent>
      </Card>

      {/* Bottom actions */}
      {!isEmailed && (
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Taslak Kaydet
          </Button>
          <Button onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700 text-white">
            {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Onayla ve Müşteriye Gönder
          </Button>
        </div>
      )}
    </div>
  );
}
