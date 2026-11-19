import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Grant { id: number; state: "pending" | "active" | "expired" | "declined" | "revoked"; reason: string; requestedBy: string | null; expiresAt: string | null }
interface LogRow { id: number; actor: string; actor_label: string | null; action: string; at: string }
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("tr-TR") : "");

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!r.ok) throw new Error("İşlem başarısız");
}

/** CyberStep destek ekibinin tedarikçi listesine erişim isteği: müşteri onaylar, reddeder veya iptal eder. */
export function SupportAccessBanner() {
  const qc = useQueryClient();
  const { data } = useQuery<{ current: Grant | null; log: LogRow[] }>({
    queryKey: ["tprm-support-access"],
    queryFn: () => fetch("/api/tprm/support-access", { credentials: "include" }).then((r) => (r.ok ? r.json() : { current: null, log: [] })),
    refetchInterval: 30000,
  });
  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => post(`/api/tprm/support-access/${data!.current!.id}/${path}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tprm-support-access"] }),
  });
  const g = data?.current;
  if (!g || (g.state !== "pending" && g.state !== "active")) return null;

  return (
    <div className={`rounded-lg border p-4 ${g.state === "pending" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0 text-slate-700" />
        <div className="flex-1 space-y-2 text-sm text-slate-800">
          {g.state === "pending" ? (
            <>
              <p className="font-semibold">CyberStep destek ekibi tedarikçi listenize erişmek istiyor</p>
              <p>Gerekçe: {g.reason}</p>
              <p className="text-xs text-slate-600">Onaylarsanız ekip yalnızca tedarikçi alan adlarını, skorlarını ve tarama durumunu görür; bulgu ayrıntılarını göremez. Erişim süreli olur, her görüntüleme aşağıda kayıt altına alınır, istediğiniz an iptal edebilirsiniz.</p>
              <div className="flex flex-wrap gap-2">
                {[{ h: 4, l: "4 saat" }, { h: 24, l: "24 saat" }, { h: 72, l: "72 saat" }].map((o) => (
                  <Button key={o.h} size="sm" onClick={() => act.mutate({ path: "approve", body: { hours: o.h } })} disabled={act.isPending}>Onayla · {o.l}</Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => act.mutate({ path: "decline" })} disabled={act.isPending}>Reddet</Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Destek ekibi erişimi açık — bitiş {fmt(g.expiresAt)}</p>
              <p>Gerekçe: {g.reason}</p>
              <Button size="sm" variant="outline" onClick={() => act.mutate({ path: "revoke" })} disabled={act.isPending}>Erişimi iptal et</Button>
            </>
          )}
          {data!.log.length > 0 && (
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer">Erişim kaydı ({data!.log.length})</summary>
              <ul className="mt-1 space-y-0.5">{data!.log.map((l) => <li key={l.id}>{fmt(l.at)} · {l.actor === "customer" ? "siz" : l.actor_label ?? "destek ekibi"} · {l.action}</li>)}</ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
