import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Summary { vendorCount: number; limit: number | null; plan: string | null; monitored: number; neverScanned: number; scannedLast7Days: number; questionnairesCompleted: number; lastScanAt: string | null }
interface Grant { id: number; state: "pending" | "active" | "expired" | "declined" | "revoked"; reason: string; requestedBy: string | null; requestedAt: string; expiresAt: string | null }
interface LogRow { id: number; actor: string; actor_label: string | null; action: string; at: string }
interface Vendor { id: number; domain: string; name: string | null; score: number | null; risk: string | null; criticality: string; lastScanAt: string | null; monitored: boolean; questionnaire: string }

const STATE_LABEL: Record<Grant["state"], string> = { pending: "Müşteri onayı bekleniyor", active: "Aktif", expired: "Süresi doldu", declined: "Müşteri reddetti", revoked: "Sonlandırıldı" };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("tr-TR") : "—");

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "İşlem başarısız");
  return j as T;
}

export function AdminTprmSupport({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const base = `/api/admin-panel/customers/${customerId}`;

  const summary = useQuery<Summary>({ queryKey: [base, "tprm-summary"], queryFn: () => api(`${base}/tprm-summary`) });
  const access = useQuery<{ current: Grant | null; log: LogRow[] }>({ queryKey: [base, "support-access"], queryFn: () => api(`${base}/support-access`), refetchInterval: 15000 });
  const active = access.data?.current?.state === "active";
  const vendors = useQuery<{ expiresAt: string; vendors: Vendor[] }>({ queryKey: [base, "vendors"], queryFn: () => api(`${base}/support-access/vendors`), enabled: active, retry: false });

  const refresh = () => { qc.invalidateQueries({ queryKey: [base, "support-access"] }); qc.invalidateQueries({ queryKey: [base, "vendors"] }); };
  const request = useMutation({
    mutationFn: () => api(`${base}/support-access`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { setReason(""); refresh(); toast({ title: "İstek gönderildi", description: "Müşteri onayı bekleniyor." }); },
    onError: (e: Error) => toast({ title: "Gönderilemedi", description: e.message, variant: "destructive" }),
  });
  const end = useMutation({ mutationFn: () => api(`${base}/support-access/end`, { method: "POST" }), onSuccess: refresh });

  const s = summary.data;
  const cur = access.data?.current ?? null;
  const open = cur && (cur.state === "pending" || cur.state === "active");

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-sm text-slate-200">Tedarikçi riski — toplu özet</CardTitle></CardHeader>
        <CardContent>
          {summary.isLoading && <p className="text-slate-400 text-sm">Yükleniyor…</p>}
          {s && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label="Tedarikçi" value={`${s.vendorCount}${s.limit === null ? "" : ` / ${s.limit}`}`} hint={s.plan ?? "ücretsiz"} />
              <Stat label="İzlenen" value={String(s.monitored)} />
              <Stat label="Hiç taranmamış" value={String(s.neverScanned)} warn={s.neverScanned > 0} />
              <Stat label="Son 7 günde taranan" value={String(s.scannedLast7Days)} />
              <Stat label="Anket tamamlanan" value={String(s.questionnairesCompleted)} />
              <Stat label="Son tarama" value={fmt(s.lastScanAt)} />
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3">Tedarikçi adları ve alan adları müşterinin ticari verisidir; yalnızca müşteri onayıyla görülebilir.</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-slate-200">Destek erişimi</CardTitle>
          {cur && <Badge variant="outline" className={cur.state === "active" ? "border-emerald-500/40 text-emerald-300" : cur.state === "pending" ? "border-yellow-500/40 text-yellow-300" : "border-slate-600 text-slate-400"}>{STATE_LABEL[cur.state]}</Badge>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {cur && <p className="text-slate-300">Gerekçe: {cur.reason}<br /><span className="text-xs text-slate-500">{cur.requestedBy} · {fmt(cur.requestedAt)}{cur.state === "active" ? ` · bitiş ${fmt(cur.expiresAt)}` : ""}</span></p>}
          {open && <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8" onClick={() => end.mutate()} disabled={end.isPending}>{cur!.state === "pending" ? "İsteği geri çek" : "Erişimi sonlandır"}</Button>}
          {!open && (
            <div className="space-y-2">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Neden erişim gerekiyor? (ör. destek talebi #123: tarama hatası) — müşteri bunu görür" className="bg-slate-950 border-slate-700 text-slate-200" rows={2} />
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-8" onClick={() => request.mutate()} disabled={request.isPending || reason.trim().length < 10}>Müşteriden erişim iste</Button>
              <p className="text-xs text-slate-500">Müşteri portalında onaylayınca 1–72 saat (varsayılan 24) açılır. Her görüntüleme kayıt altına alınır ve müşteri görür.</p>
            </div>
          )}

          {active && vendors.data && (
            <div className="overflow-x-auto rounded border border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-400"><tr><th className="text-left p-2">Alan adı</th><th className="p-2">Skor</th><th className="p-2">Kritiklik</th><th className="p-2">İzleme</th><th className="p-2">Son tarama</th></tr></thead>
                <tbody>
                  {vendors.data.vendors.map((v) => (
                    <tr key={v.id} className="border-t border-slate-800 text-slate-300">
                      <td className="p-2">{v.name ? `${v.name} · ` : ""}{v.domain}</td>
                      <td className="p-2 text-center">{v.score ?? "—"}</td>
                      <td className="p-2 text-center">{v.criticality}</td>
                      <td className="p-2 text-center">{v.monitored ? "açık" : "kapalı"}</td>
                      <td className="p-2 text-center">{fmt(v.lastScanAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {active && vendors.error && <p className="text-red-400 text-xs">{(vendors.error as Error).message}</p>}

          {access.data && access.data.log.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">Erişim kaydı ({access.data.log.length})</summary>
              <ul className="mt-2 space-y-1">{access.data.log.map((l) => <li key={l.id}>{fmt(l.at)} · {l.actor === "customer" ? "müşteri" : l.actor_label ?? l.actor} · {l.action}</li>)}</ul>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-base font-semibold ${warn ? "text-yellow-300" : "text-slate-100"}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
