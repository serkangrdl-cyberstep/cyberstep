import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Phone, Copy } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface SalesScript { opening: string; talkingPoints: string[]; objections: { objection: string; answer: string }[]; emailDraft: string; doNot: string[] }
interface Lead {
  id: number; noticeId: number; url: string; companyName: string; publishedAt: string | null; decisionNo: string | null;
  affectedCount: number | null; summary: string; supplierLinked: boolean; supplierSignals: string[] | null; isLead: boolean;
  status: string; salesScript: SalesScript | null; notes: string | null; contactedAt: string | null;
}

const STATUS: Record<string, string> = { new: "Yeni", contacted: "Arandı", interested: "İlgilendi", closed: "Kapandı", not_fit: "Uygun değil" };
const BASE = "/api/admin-panel/kvkk-leads";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Hata");
  return res.json();
}

export default function KvkkLeadPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["kvkk-leads", showAll],
    queryFn: () => fetch(`${BASE}${showAll ? "?all=1" : ""}`, { credentials: "include" }).then(r => r.json()),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["kvkk-leads"] });
  const patch = useMutation({
    mutationFn: (p: { id: number; status?: string; notes?: string }) => call(`${BASE}/${p.id}`, "PATCH", { status: p.status, notes: p.notes }),
    onSuccess: () => { refresh(); toast({ title: "Kaydedildi" }); },
    onError: (e) => toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }),
  });
  const runNow = useMutation({
    mutationFn: () => call(`${BASE}/run-now`, "POST"),
    onSuccess: () => toast({ title: "Tarama başladı", description: "Birkaç dakika sonra listeyi yenileyin." }),
  });
  const regen = useMutation({
    mutationFn: (id: number) => call(`${BASE}/${id}/regenerate-script`, "POST"),
    onSuccess: () => { refresh(); toast({ title: "Metin yenilendi" }); setOpen(null); },
    onError: () => toast({ title: "Metin üretilemedi", variant: "destructive" }),
  });
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast({ title: "Kopyalandı" }); };

  const newCount = rows.filter(r => r.isLead && r.status === "new").length;

  return (
    <AdminLayout title="KVKK Lead" description="KVKK veri ihlali duyurularından, tedarikçi bağlantılı olanlar. Her gün 08:20'de taranır.">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Badge>{newCount} yeni lead</Badge>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Tüm duyuruları göster (lead olmayanlar dahil)
        </label>
        <Button size="sm" variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending}><RefreshCw className="h-4 w-4 mr-1" /> Şimdi tara</Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Yükleniyor...</p>}
      {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">Henüz lead yok. "Şimdi tara" ile ilk taramayı başlatabilirsiniz.</p>}
      <div className="space-y-3">
        {rows.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    Duyuru: {r.publishedAt ?? "-"}{r.decisionNo ? ` · Kurul kararı ${r.decisionNo}` : ""}{r.affectedCount ? ` · ${r.affectedCount.toLocaleString("tr-TR")} kişi` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!r.isLead && <Badge variant="outline">{r.supplierLinked ? "Kurumsal değil / yurt dışı" : "Tedarikçi bağlantısı yok"}</Badge>}
                  {r.supplierSignals?.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{r.summary}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select className="rounded-md border bg-background px-2 py-1 text-sm" value={r.status} onChange={e => patch.mutate({ id: r.id, status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {r.salesScript && <Button size="sm" onClick={() => { setOpen(r); setNotes(r.notes ?? ""); }}><Phone className="h-4 w-4 mr-1" /> Arama metni</Button>}
                {!r.salesScript && r.isLead && <Button size="sm" variant="outline" onClick={() => regen.mutate(r.id)}>Metin üret</Button>}
                <a href={`https://web.archive.org/web/2026/${r.url}`} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1">Arşiv <ExternalLink className="h-3 w-3" /></a>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center gap-1">KVKK duyurusu <ExternalLink className="h-3 w-3" /></a>
              </div>
              {r.notes && <p className="text-xs">Not: {r.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={o => { if (!o) setOpen(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open?.companyName}: arama metni</DialogTitle></DialogHeader>
          {open?.salesScript && (
            <div className="space-y-4 text-sm">
              <section>
                <p className="font-medium mb-1">Açılış</p>
                <p className="whitespace-pre-wrap">{open.salesScript.opening}</p>
              </section>
              <section>
                <p className="font-medium mb-1">Konuşma maddeleri</p>
                <ul className="list-disc pl-5 space-y-1">{open.salesScript.talkingPoints.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </section>
              <section>
                <p className="font-medium mb-1">Olası itirazlar</p>
                <ul className="space-y-2">{open.salesScript.objections.map((o, i) => <li key={i}><span className="font-medium">{o.objection}</span><br />{o.answer}</li>)}</ul>
              </section>
              <section>
                <p className="font-medium mb-1 flex items-center gap-2">E-posta taslağı <Button size="sm" variant="ghost" onClick={() => copy(open.salesScript!.emailDraft)}><Copy className="h-3 w-3" /></Button></p>
                <p className="whitespace-pre-wrap rounded-md border p-2">{open.salesScript.emailDraft}</p>
              </section>
              <section>
                <p className="font-medium mb-1">Söylemeyin</p>
                <ul className="list-disc pl-5 space-y-1">{open.salesScript.doNot.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </section>
              <section>
                <p className="font-medium mb-1">Görüşme notu</p>
                <textarea className="w-full rounded-md border bg-background p-2" rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => patch.mutate({ id: open.id, notes })}>Notu kaydet</Button>
                  <Button size="sm" variant="outline" onClick={() => regen.mutate(open.id)} disabled={regen.isPending}>Metni yenile</Button>
                </div>
              </section>
              <p className="text-xs text-muted-foreground">Metin yalnızca KVKK'nın kamuya açık duyurusuna dayanır. İhlali satış kozu yapmayın, suçlama veya uyum garantisi vermeyin.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
