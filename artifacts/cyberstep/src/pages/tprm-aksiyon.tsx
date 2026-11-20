import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Loader2 } from "lucide-react";

interface Action { id: number; title: string; detail: string; due_date: string; status: string; supplier_note: string | null }
interface View { supplierDomain: string; supplierName: string | null; actions: Action[] }

export default function TprmAksiyon() {
  usePageMeta({ title: "Güvenlik aksiyon listesi", description: "Müşteriniz tarafından paylaşılan güvenlik aksiyonları" });
  const [, params] = useRoute("/tprm/aksiyon/:token");
  const token = params?.token ?? "";
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => fetch(`/api/tprm/actions/${token}`).then(async r => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Yüklenemedi");
    setData(j);
  }).catch(e => setError((e as Error).message));
  useEffect(() => { if (token) load(); }, [token]);

  async function done(id: number) {
    setBusy(id);
    await fetch(`/api/tprm/actions/${token}/${id}/done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: notes[id] ?? "" }) });
    setBusy(null);
    load();
  }

  if (error) return <div className="max-w-xl mx-auto p-6 text-red-400">{error}</div>;
  if (!data) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const label: Record<string, string> = { open: "Açık", supplier_done: "Bildirildi, müşteri onayı bekleniyor", verified: "Onaylandı" };
  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-lg font-semibold">Güvenlik aksiyon listesi</h1>
      <p className="text-xs text-muted-foreground">{data.supplierName ?? data.supplierDomain} için müşteriniz aşağıdaki aksiyonları talep etti. Tamamladıklarınızı işaretleyin; müşteriniz doğrular.</p>
      {data.actions.length === 0 && <p className="text-sm text-muted-foreground">Şu an açık aksiyon yok.</p>}
      {data.actions.map(a => {
        const overdue = a.status === "open" && new Date(a.due_date).getTime() < Date.now();
        return (
          <Card key={a.id}>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.detail}</p>
              <p className={`text-xs ${overdue ? "text-red-400" : "text-muted-foreground"}`}>Son tarih: {new Date(a.due_date).toLocaleDateString("tr-TR")}{overdue ? " (geçti)" : ""} · {label[a.status] ?? a.status}</p>
              {a.status === "open" && (
                <div className="space-y-2">
                  <textarea className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" rows={2} maxLength={500} placeholder="Ne yaptığınızı kısaca yazın" value={notes[a.id] ?? ""} onChange={e => setNotes({ ...notes, [a.id]: e.target.value })} />
                  <Button size="sm" disabled={busy === a.id} onClick={() => done(a.id)}>Tamamladım</Button>
                </div>
              )}
              {a.supplier_note && a.status !== "open" && <p className="text-xs">Notunuz: {a.supplier_note}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
