import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface Action { id: number; title: string; detail: string; due_date: string; status: string; supplier_note: string | null; closed_note?: string | null }
interface Suggestion { sourceKey: string; title: string; detail: string; dueDays: number }
interface Plan { actions: Action[]; suggestions: Suggestion[]; supplierUrl: string | null; decision: string | null; decisionNote: string | null }

const STATUS: Record<string, string> = { open: "Açık", supplier_done: "Tedarikçi tamamladı", verified: "Doğrulandı", waived: "Kabul edildi (muaf)" };
const DECISION: Record<string, string> = { accept: "Riski kabul et", monitor: "İzlemeye devam et", exit: "Tedarikçiden çık" };

export function VendorActionPlan({ vendorId }: { vendorId: number }) {
  const qc = useQueryClient();
  const key = ["tprm-actions", vendorId];
  const { data } = useQuery<Plan>({ queryKey: key, queryFn: () => fetch(`/api/tprm/vendors/${vendorId}/actions`, { credentials: "include" }).then(r => r.json()) });
  const [picked, setPicked] = useState<string[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [waiveId, setWaiveId] = useState<number | null>(null);
  const [waiveNote, setWaiveNote] = useState("");
  const [waiveErr, setWaiveErr] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const post = (path: string, method: string, body?: unknown) =>
    fetch(`/api/tprm/vendors/${vendorId}/${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

  if (!data) return null;
  const sug = data.suggestions ?? [];
  const now = Date.now();
  const shareUrl = url ?? data.supplierUrl;

  async function create() {
    const items = sug.filter(s => picked.includes(s.sourceKey)).map(s => ({ sourceKey: s.sourceKey, title: s.title, detail: s.detail, dueDate: new Date(Date.now() + s.dueDays * 86_400_000).toISOString() }));
    if (!items.length) return;
    await post("actions", "POST", { items });
    setPicked([]); refresh();
  }
  async function share() { const j = await post("actions-share", "POST"); if (j.url) setUrl(j.url); }

  return (
    <div className="rounded-lg bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-semibold">Aksiyon planı</p>

      {sug.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">Önerilen aksiyonlar: tedarikçiden istemek istediklerinizi seçin.</p>
          {sug.map(s => (
            <label key={s.sourceKey} className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={picked.includes(s.sourceKey)} onChange={e => setPicked(e.target.checked ? [...picked, s.sourceKey] : picked.filter(k => k !== s.sourceKey))} />
              <span><span className="font-medium">{s.title}</span> <span className="text-muted-foreground">({s.dueDays} gün)</span><br /><span className="text-muted-foreground">{s.detail}</span></span>
            </label>
          ))}
          <Button size="sm" variant="outline" disabled={!picked.length} onClick={create}>Seçilenleri aksiyon listesine ekle</Button>
        </div>
      )}

      {data.actions.length > 0 && (
        <div className="space-y-1.5">
          {data.actions.map(a => {
            const overdue = a.status === "open" && new Date(a.due_date).getTime() < now;
            return (
              <div key={a.id} className="text-xs border-t border-border/40 pt-1.5">
                <p><span className="font-medium">{a.title}</span> · <span className={overdue ? "text-red-400" : a.status === "verified" ? "text-emerald-400" : "text-muted-foreground"}>{overdue ? "Süresi geçti" : STATUS[a.status] ?? a.status}</span> · {new Date(a.due_date).toLocaleDateString("tr-TR")}</p>
                {a.supplier_note && <p className="text-muted-foreground">Tedarikçi notu: {a.supplier_note}</p>}
                {a.closed_note && <p className="text-emerald-400">{a.closed_note}</p>}
                <div className="flex gap-3 mt-0.5">
                  {a.status === "supplier_done" && <button className="text-emerald-400" onClick={async () => { await post(`actions/${a.id}`, "PATCH", { status: "verified" }); refresh(); }}>Doğruladım</button>}
                  {a.status === "supplier_done" && <button className="text-amber-400" onClick={async () => { await post(`actions/${a.id}`, "PATCH", { status: "open" }); refresh(); }}>Yeniden aç</button>}
                  {(a.status === "open" || a.status === "supplier_done") && <button className="text-muted-foreground" onClick={() => { setWaiveId(waiveId === a.id ? null : a.id); setWaiveNote(""); setWaiveErr(""); }}>Gerekçeyle kabul et</button>}
                </div>
                {waiveId === a.id && (
                  <div className="mt-1 space-y-1">
                    <input className="w-full rounded-md border bg-background px-2 py-1 text-xs" placeholder="Giderilmeyecekse gerekçe (zorunlu)" maxLength={500} value={waiveNote} onChange={e => setWaiveNote(e.target.value)} />
                    {waiveErr && <p className="text-red-400 text-[11px]">{waiveErr}</p>}
                    <Button size="sm" variant="outline" onClick={async () => {
                      const j = await post(`actions/${a.id}`, "PATCH", { status: "waived", note: waiveNote });
                      if (j.error) { setWaiveErr(j.error); return; }
                      setWaiveId(null); setWaiveNote(""); refresh();
                    }}>Kabul edildi olarak kaydet</Button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="pt-1">
            {shareUrl ? (
              <p className="text-[11px] break-all">Tedarikçi bağlantısı: <span className="text-primary select-all">{shareUrl}</span><br /><span className="text-muted-foreground">Bağlantıyı tedarikçiye kendiniz iletin (e-posta bildirimi henüz yok).</span></p>
            ) : (
              <Button size="sm" variant="outline" onClick={share}>Tedarikçi bağlantısı oluştur</Button>
            )}
          </div>
        </div>
      )}

      {sug.length === 0 && data.actions.length === 0 && <p className="text-[11px] text-muted-foreground">Şu an önerilen aksiyon yok.</p>}

      <div className="border-t border-border/40 pt-2 space-y-1">
        <p className="text-[11px] text-muted-foreground">Karar{data.decision ? `: ${DECISION[data.decision]}` : " (henüz verilmedi)"}{data.decisionNote ? ` — ${data.decisionNote}` : ""}</p>
        <div className="flex gap-2 items-center">
          <input className="flex-1 min-w-0 rounded-md border bg-background px-2 py-1 text-xs" placeholder="Karar notu (isteğe bağlı)" maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="flex gap-3 text-xs">
          {Object.entries(DECISION).map(([k, v]) => (
            <button key={k} className={data.decision === k ? "text-primary font-semibold" : "text-muted-foreground"} onClick={async () => { await post("decision", "PUT", { decision: k, note }); setNote(""); refresh(); }}>{v}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
