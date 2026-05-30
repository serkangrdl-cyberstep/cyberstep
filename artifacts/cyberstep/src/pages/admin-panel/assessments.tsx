import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Eye, Clock, CheckCircle, AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import { useRequireAdmin } from "@/hooks/use-admin";

interface Assessment {
  id: number; companyName: string; contactName: string; email: string;
  sector: string; employeeCount: string; assessmentType: string; status: string;
  totalScore: number | null; maxScore: number | null; riskLevel: string | null;
  redAlarmCount: number | null; createdAt: string; completedAt: string | null;
  verificationToken: string | null;
}

const RISK_COLORS: Record<string, string> = {
  "Kritik": "bg-red-500/20 text-red-400 border-red-500/30",
  "Yüksek": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Orta":   "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Düşük":  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function AdminAssessments() {
  const [, navigate] = useLocation();
  const { data: admin } = useRequireAdmin();
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<"issue" | "revoke" | null>(null);
  const [durationYears, setDurationYears] = useState<1 | 2>(1);
  const [certificationTier, setCertificationTier] = useState<1 | 2 | 3>(1);

  const { data: assessments, isLoading } = useQuery<Assessment[]>({
    queryKey: ["admin-assessments"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/analytics/assessments", { credentials: "include" });
      if (!r.ok) throw new Error("Yetkisiz");
      return r.json();
    },
    enabled: !!admin,
  });

  const issueVerification = useMutation({
    mutationFn: async ({ id, years }: { id: number; years: 1 | 2 }) => {
      const r = await fetch(`/api/admin-panel/assessments/${id}/issue-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ durationYears: years, certificationTier }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-assessments"] });
      setConfirmId(null);
      setConfirmAction(null);
      setDurationYears(1);
      setCertificationTier(1);
    },
  });

  const revokeVerification = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin-panel/assessments/${id}/issue-verification`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-assessments"] });
      setConfirmId(null);
      setConfirmAction(null);
    },
  });

  const list = Array.isArray(assessments) ? assessments : [];

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const isPending = issueVerification.isPending || revokeVerification.isPending;

  return (
    <AdminLayout title="Değerlendirmeler" description={`Tüm anket sonuçları (${list.length} kayıt)`}>
      {/* Onay diyaloğu */}
      {confirmId !== null && confirmAction !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              {confirmAction === "issue"
                ? <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
                : <ShieldOff className="h-6 w-6 text-red-400 shrink-0" />}
              <h3 className="font-semibold text-white text-sm">
                {confirmAction === "issue" ? "Doğrulama Rozeti Ver" : "Doğrulama Rozetini İptal Et"}
              </h3>
            </div>
            <p className="text-slate-400 text-sm">
              {confirmAction === "issue"
                ? "Bu değerlendirme için CyberStep Doğrulandı rozeti verilecek ve müşteriye doğrulama bağlantısı oluşturulacak."
                : "Bu değerlendirmenin doğrulama rozeti iptal edilecek ve müşterinin doğrulama bağlantısı çalışmayacak. Devam etmek istediğinizden emin misiniz?"}
            </p>
            {confirmAction === "issue" && (
              <div className="space-y-4">
                {/* Sertifikasyon Katmanı */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Sertifikasyon Katmanı</label>
                  <div className="space-y-1.5">
                    {([
                      { value: 1, title: "Katman 1 — Risk Skoru", desc: "Beyan bazlı otomatik değerlendirme. Sertifika niteliği taşımaz." },
                      { value: 2, title: "Katman 2 — Değerlendirildi", desc: "Uzman incelemeli kapsamlı rapor. 2.500–5.000 TL ücretli." },
                      { value: 3, title: "Katman 3 — Sertifikalı Platform", desc: "Kanıt doğrulama + yerinde/uzaktan denetim. 15.000–20.000 TL." },
                    ] as const).map(t => (
                      <button
                        key={t.value}
                        onClick={() => setCertificationTier(t.value)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          certificationTier === t.value
                            ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <div className="font-medium text-xs">{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Geçerlilik Süresi */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Geçerlilik Süresi</label>
                  <div className="flex gap-2">
                    {([1, 2] as const).map(y => (
                      <button
                        key={y}
                        onClick={() => setDurationYears(y)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          durationYears === y
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:border-emerald-500/50"
                        }`}
                      >
                        {y} Yıl
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Süre dolunca doğrulama sayfası "Süresi Doldu" uyarısı gösterecek.
                  </p>
                </div>
              </div>
            )}
            {(issueVerification.isError || revokeVerification.isError) && (
              <p className="text-red-400 text-xs">
                {(issueVerification.error as Error | null)?.message ?? (revokeVerification.error as Error | null)?.message}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-slate-400"
                onClick={() => { setConfirmId(null); setConfirmAction(null); }}
                disabled={isPending}>
                İptal
              </Button>
              <Button
                size="sm"
                className={confirmAction === "issue"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"}
                disabled={isPending}
                onClick={() => {
                  if (confirmAction === "issue") issueVerification.mutate({ id: confirmId!, years: durationYears });
                  else revokeVerification.mutate(confirmId!);
                }}>
                {isPending ? "İşleniyor..." : confirmAction === "issue" ? "Rozeti Ver" : "Rozeti İptal Et"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {isLoading || !admin ? (
        <div className="text-slate-400 text-center py-16">Yükleniyor...</div>
      ) : (
        <Card className="bg-slate-800 border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-700">
                  {["#", "Firma", "İletişim", "Sektör", "Tür", "Skor", "Risk", "Durum", "Doğrulama", "Tarih", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {list.map(a => (
                  <tr key={a.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500 text-sm">#{a.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-white text-sm font-medium">{a.companyName}</div>
                      <div className="text-slate-400 text-xs">{a.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{a.contactName}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.sector}</td>
                    <td className="px-4 py-3">
                      <Badge className={a.assessmentType === "mini"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : "bg-violet-500/20 text-violet-400 border-violet-500/30"}>
                        {a.assessmentType === "mini" ? "Mini" : "Tam"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-semibold">
                      {a.totalScore != null ? `%${Math.round((a.totalScore / (a.maxScore ?? 1)) * 100)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.riskLevel
                        ? <Badge className={RISK_COLORS[a.riskLevel] ?? "bg-slate-700 text-slate-400"}>{a.riskLevel}</Badge>
                        : <span className="text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === "report_ready" ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="h-3 w-3" /> Rapor Hazır</span>
                      ) : a.status === "completed" ? (
                        <span className="flex items-center gap-1 text-amber-400 text-xs"><Clock className="h-3 w-3" /> Tamamlandı</span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 text-xs"><AlertTriangle className="h-3 w-3" /> Devam Ediyor</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === "report_ready" ? (
                        a.verificationToken ? (
                          <button
                            className="flex items-center gap-1 text-emerald-400 text-xs hover:text-emerald-300 transition-colors"
                            onClick={() => { setConfirmId(a.id); setConfirmAction("revoke"); }}
                            title="Rozeti iptal et"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Doğrulandı
                          </button>
                        ) : (
                          <button
                            className="flex items-center gap-1 text-slate-400 text-xs hover:text-emerald-400 transition-colors"
                            onClick={() => { setConfirmId(a.id); setConfirmAction("issue"); }}
                            title="Doğrulama rozeti ver"
                          >
                            <ShieldOff className="h-3.5 w-3.5" /> Rozet Ver
                          </button>
                        )
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmt(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7 w-7 p-0"
                        onClick={() => navigate(`/panel/degerlendirmeler/${a.id}/rapor`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-12">Henüz değerlendirme yok</div>
            )}
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}
