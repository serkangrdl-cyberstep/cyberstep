import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupportTask { id: number; title: string; description: string; priority: string; status: string; created_at: string; }

const PRIORITY_LABELS: Record<string, string> = { high: "Acil", medium: "Normal", low: "Düşük" };
const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Açık", variant: "secondary" },
  completed: { label: "Çözüldü", variant: "default" },
};

function fmtDate(d: string) { return new Date(d).toLocaleDateString("tr-TR"); }

export default function HesabimDestek() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ subject: "", message: "", priority: "medium" });
  const [showForm, setShowForm] = useState(false);

  const { data: tickets = [] } = useQuery<SupportTask[]>({
    queryKey: ["/api/portal/support"],
    queryFn: () => fetch("/api/portal/support", { credentials: "include" }).then(r => r.json()),
  });

  const submit = useMutation({
    mutationFn: () => fetch("/api/portal/support", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.ok) {
        toast({ title: "Destek talebiniz alındı. Ekibimiz en kısa sürede dönecektir." });
        setForm({ subject: "", message: "", priority: "medium" });
        setShowForm(false);
        qc.invalidateQueries({ queryKey: ["/api/portal/support"] });
      } else {
        toast({ title: d.error ?? "Hata", variant: "destructive" });
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Destek</h2>
          <p className="text-slate-400 text-sm">Sorularınız ve sorunlarınız için destek talebi oluşturun.</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Yeni Talep
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-slate-800 border-cyan-500/20">
          <CardHeader><CardTitle className="text-white text-base">Destek Talebi Oluştur</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-slate-300">Konu *</Label>
                <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Destek talebinizin konusu" />
              </div>
              <div>
                <Label className="text-slate-300">Öncelik</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Acil</SelectItem>
                    <SelectItem value="medium">Normal</SelectItem>
                    <SelectItem value="low">Düşük</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Mesaj *</Label>
              <Textarea className="bg-slate-800 border-slate-700 text-white mt-1" rows={4} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Sorununuzu detaylıca açıklayın..." />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" className="border-slate-700" onClick={() => setShowForm(false)}>İptal</Button>
              <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => submit.mutate()} disabled={!form.subject || !form.message || submit.isPending}>
                {submit.isPending ? "Gönderiliyor..." : "Gönder"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tickets.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Henüz destek talebiniz bulunmuyor.</p>
            <p className="text-slate-500 text-xs mt-1">Yeni bir talep oluşturmak için yukarıdaki butona tıklayın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => {
            const st = STATUS_LABELS[t.status] ?? STATUS_LABELS["open"]!;
            return (
              <Card key={t.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">{t.title.replace("Destek: ", "")}</span>
                        <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">{PRIORITY_LABELS[t.priority] ?? t.priority}</Badge>
                      </div>
                      {t.description && <p className="text-slate-400 text-xs mt-1">{t.description}</p>}
                      <p className="text-slate-600 text-xs mt-2">{fmtDate(t.created_at)}</p>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
