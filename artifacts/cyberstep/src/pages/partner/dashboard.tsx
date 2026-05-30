import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Shield, Package, CheckCircle2, Clock, Loader2, LogOut,
  TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Building2,
  Link2, Copy, Check, Users, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRequirePartner } from "@/hooks/use-partner";

interface ReferralAssessment {
  id: number;
  companyName: string;
  sector: string;
  status: string;
  riskLevel: string | null;
  scorePercent: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface ReferralStats {
  referralCode: string | null;
  total: number;
  completed: number;
  reportReady: number;
  assessments: ReferralAssessment[];
}

interface WorkPackage {
  id: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  estimatedCost: number | null;
  commissionRate: number;
  status: string;
  companyName: string | null;
  domain: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  completionNote: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Açık", assigned: "Atandı", in_progress: "Devam Ediyor",
  completed: "Tamamlandı", verified: "Doğrulandı",
};
const STATUS_COLOR: Record<string, string> = {
  open: "text-slate-400",
  assigned: "text-blue-400",
  in_progress: "text-amber-400",
  completed: "text-violet-400",
  verified: "text-emerald-400",
};

function ReferralSection() {
  const [copied, setCopied] = useState(false);

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ["partner-referral-stats"],
    queryFn: () => fetch("/api/partner-portal/referral-stats", { credentials: "include" }).then(r => r.json()),
  });

  const baseUrl = window.location.origin;
  const referralLink = stats?.referralCode ? `${baseUrl}/?ref=${stats.referralCode}` : null;

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const RISK_COLOR: Record<string, string> = {
    "Kritik": "text-red-400",
    "Yüksek": "text-orange-400",
    "Orta": "text-amber-400",
    "Düşük": "text-emerald-400",
  };

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    "in_progress": { label: "Devam Ediyor", cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    "completed":   { label: "Tamamlandı",  cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    "report_ready":{ label: "Rapor Hazır", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  };

  return (
    <div className="space-y-4">
      <h2 className="text-white font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4 text-emerald-400" />
        Referral Linkim
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Toplam Yönlendirme", value: stats?.total ?? 0, icon: Users, color: "text-blue-400" },
          { label: "Tamamlanan",         value: stats?.completed ?? 0, icon: CheckCircle2, color: "text-violet-400" },
          { label: "Rapor Hazır",        value: stats?.reportReady ?? 0, icon: FileText, color: "text-emerald-400" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Link box */}
      {referralLink ? (
        <Card className="bg-slate-900 border-emerald-700/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-slate-400">Bu linki müşterilerinizle paylaşın. Linkinizden gelen her değerlendirme burada takip edilir.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-800 rounded px-3 py-2 text-emerald-400 text-xs font-mono truncate">
                {referralLink}
              </code>
              <Button size="sm" variant="outline" className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-500/10 shrink-0" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
            <p className="text-xs text-slate-600">Referral kodunuz: <span className="text-slate-400 font-mono">{stats?.referralCode}</span></p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900 border-slate-800 border-dashed">
          <CardContent className="p-4 text-center text-slate-500 text-sm">
            Referral kodunuz henüz atanmadı. Destek ile iletişime geçin.
          </CardContent>
        </Card>
      )}

      {/* Assessments table */}
      {(stats?.assessments ?? []).length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Yönlendirilen Değerlendirmeler</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {(stats?.assessments ?? []).map(a => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{a.companyName}</p>
                    <p className="text-slate-500 text-xs">{a.sector} · {new Date(a.createdAt).toLocaleDateString("tr-TR")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.riskLevel && (
                      <span className={`text-xs font-semibold ${RISK_COLOR[a.riskLevel] ?? "text-slate-400"}`}>{a.riskLevel}</span>
                    )}
                    {a.scorePercent !== null && (
                      <span className="text-slate-400 text-xs">%{a.scorePercent}</span>
                    )}
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE[a.status]?.cls ?? "border-slate-700 text-slate-500"}`}>
                      {STATUS_BADGE[a.status]?.label ?? a.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PartnerDashboard() {
  const { partner, isLoading: partnerLoading } = useRequirePartner();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [completePkg, setCompletePkg] = useState<WorkPackage | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: packages, isLoading } = useQuery<WorkPackage[]>({
    queryKey: ["partner-work-packages"],
    queryFn: () => fetch("/api/partner-portal/work-packages", { credentials: "include" }).then(r => r.json()),
    enabled: !!partner,
  });

  const startMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/partner-portal/work-packages/${id}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Başlatılamadı");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-work-packages"] }),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await fetch(`/api/partner-portal/work-packages/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ completionNote: note }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Tamamlanamadı");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-work-packages"] });
      setCompletePkg(null);
      setCompletionNote("");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/partner-auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => setLocation("/ortak/giris"),
  });

  if (partnerLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const active = (packages ?? []).filter(p => ["assigned", "in_progress"].includes(p.status));
  const completed = (packages ?? []).filter(p => p.status === "completed");
  const verified = (packages ?? []).filter(p => p.status === "verified");

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{partner?.companyName}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${partner?.tier === "gold" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>
                  {partner?.tier === "gold" ? "Gold Partner" : "Silver Partner"}
                </Badge>
                <span className="text-slate-500 text-xs">{partner?.email}</span>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-400 hover:bg-slate-800"
            onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-4 w-4 mr-1" /> Çıkış
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Referral Section */}
        <ReferralSection />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Aktif İş", value: active.length, color: "text-blue-400", icon: Clock },
            { label: "Tamamlanan", value: completed.length, color: "text-violet-400", icon: CheckCircle2 },
            { label: "Doğrulandı", value: verified.length + (partner?.totalProjectsCompleted ?? 0), color: "text-emerald-400", icon: TrendingUp },
          ].map(s => (
            <Card key={s.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Packages */}
        <div>
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            Aktif İş Paketleri
          </h2>
          {isLoading && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400 mx-auto" />
              </CardContent>
            </Card>
          )}
          {!isLoading && active.length === 0 && (
            <Card className="bg-slate-900 border-slate-800 border-dashed">
              <CardContent className="p-6 text-center">
                <Package className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Henüz atanmış iş paketi yok</p>
                <p className="text-slate-600 text-xs mt-1">Yeni paketler atandığında burada görünecek</p>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {active.map(pkg => (
              <Card key={pkg.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-white font-medium text-sm">{pkg.title}</p>
                        <Badge variant="outline" className={`text-xs ${PRIORITY_BADGE[pkg.priority] ?? ""}`}>
                          {PRIORITY_LABEL[pkg.priority] ?? pkg.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
                          {pkg.category}
                        </Badge>
                      </div>
                      {pkg.description && (
                        <p className="text-slate-400 text-xs mb-2 leading-relaxed">{pkg.description}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                        {pkg.companyName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {pkg.companyName}
                          </span>
                        )}
                        {pkg.estimatedCost && (
                          <span>₺{pkg.estimatedCost.toLocaleString("tr-TR")} değerinde</span>
                        )}
                        {pkg.assignedAt && (
                          <span>Atandı: {new Date(pkg.assignedAt).toLocaleDateString("tr-TR")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <span className={`text-xs font-medium ${STATUS_COLOR[pkg.status] ?? ""}`}>
                        {STATUS_LABEL[pkg.status] ?? pkg.status}
                      </span>
                      {pkg.status === "assigned" && (
                        <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-7"
                          disabled={startMutation.isPending}
                          onClick={() => startMutation.mutate(pkg.id)}>
                          Başlat
                        </Button>
                      )}
                      {(pkg.status === "assigned" || pkg.status === "in_progress") && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                          onClick={() => { setCompletePkg(pkg); setCompletionNote(""); }}>
                          Tamamladım
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Completed / Awaiting Verification */}
        {completed.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-violet-400" />
              Doğrulama Bekleniyor
            </h2>
            <div className="space-y-3">
              {completed.map(pkg => (
                <Card key={pkg.id} className="bg-slate-900 border-violet-700/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-medium text-sm">{pkg.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{pkg.category}</p>
                        {pkg.completionNote && (
                          <p className="text-slate-400 text-xs mt-1.5 bg-slate-800 rounded p-2">{pkg.completionNote}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs bg-violet-500/20 text-violet-400 border-violet-500/30 shrink-0">
                        Doğrulama Bekliyor
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Verified history */}
        {verified.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Tamamlanan Projeler
            </h2>
            <div className="space-y-2">
              {verified.map(pkg => (
                <Card key={pkg.id} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-3">
                    <button className="w-full text-left" onClick={() => setExpandedId(expandedId === pkg.id ? null : pkg.id)}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <p className="text-slate-200 text-sm">{pkg.title}</p>
                          <Badge variant="outline" className="text-xs text-slate-500 border-slate-700">{pkg.category}</Badge>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {pkg.scoreBefore !== null && pkg.scoreAfter !== null && (
                            <span className="text-emerald-400 text-xs font-bold">+{pkg.scoreAfter - pkg.scoreBefore} puan</span>
                          )}
                          {expandedId === pkg.id
                            ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                            : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                          }
                        </div>
                      </div>
                    </button>
                    {expandedId === pkg.id && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                        {pkg.companyName && <p className="text-slate-400"><span className="text-slate-600">Müşteri:</span> {pkg.companyName}</p>}
                        {pkg.estimatedCost && (
                          <p className="text-slate-400">
                            <span className="text-slate-600">Proje değeri:</span> ₺{pkg.estimatedCost.toLocaleString("tr-TR")}
                            <span className="text-slate-600 ml-2">CyberStep komisyonu (%{pkg.commissionRate}):</span>{" "}
                            <span className="text-amber-400">₺{Math.round(pkg.estimatedCost * pkg.commissionRate / 100).toLocaleString("tr-TR")}</span>
                          </p>
                        )}
                        {pkg.verifiedAt && (
                          <p className="text-slate-500">Doğrulandı: {new Date(pkg.verifiedAt).toLocaleDateString("tr-TR")}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Complete Modal */}
      {completePkg && (
        <Dialog open onOpenChange={() => setCompletePkg(null)}>
          <DialogContent className="max-w-sm bg-slate-900 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle>İşi Tamamla</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-300">{completePkg.title}</p>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Tamamlama Notu (opsiyonel)</label>
                <Textarea
                  className="bg-slate-800 border-slate-600 text-slate-100 resize-none text-sm"
                  rows={3}
                  placeholder="Yapılan işlemler, müşteriye iletilecek notlar..."
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">
                Tamamlandı olarak işaretlendikten sonra CyberStep ekibi doğrulayacak.
              </p>
              {completeMutation.isError && (
                <p className="text-red-400 text-xs">{(completeMutation.error as Error).message}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-slate-600 text-slate-300"
                  onClick={() => setCompletePkg(null)}>İptal</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={completeMutation.isPending}
                  onClick={() => completeMutation.mutate({ id: completePkg.id, note: completionNote })}>
                  {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tamamladım"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
