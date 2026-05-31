import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle, Trash2, User, Calendar, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CrmTask {
  id: number;
  customer_id: number | null;
  customer_full_name: string | null;
  customer_company: string | null;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const PRIORITY_COLORS: Record<string, string> = { high: "text-red-400", medium: "text-yellow-400", low: "text-green-400" };
const PRIORITY_LABELS: Record<string, string> = { high: "Yüksek", medium: "Orta", low: "Düşük" };
const TYPE_LABELS: Record<string, string> = { general: "Genel", call: "Arama", followup: "Takip", renewal: "Yenileme", support: "Destek", demo: "Demo" };

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }
function isOverdue(d: string | null) { return d ? new Date(d) < new Date() : false; }

export default function AdminGorevler() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");

  const { data: tasks = [] } = useQuery<CrmTask[]>({
    queryKey: ["/api/crm/tasks", statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ status: statusFilter });
      return fetch(`/api/crm/tasks?${p}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const complete = useMutation({
    mutationFn: (id: number) => fetch(`/api/crm/tasks/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/tasks"] }); toast({ title: "Görev tamamlandı" }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/crm/tasks/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/tasks"] }); toast({ title: "Görev silindi" }); },
  });

  const grouped = {
    high: tasks.filter(t => t.priority === "high"),
    medium: tasks.filter(t => t.priority === "medium"),
    low: tasks.filter(t => t.priority === "low"),
  };

  return (
    <AdminLayout title="Görev Motoru" description="CRM görevleri, hatırlatıcılar ve takip listesi">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {(["open", "completed", "all"] as const).map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} className={statusFilter === s ? "bg-emerald-600 hover:bg-emerald-700" : "border-slate-700 text-slate-300"} onClick={() => setStatusFilter(s)}>
              {s === "open" ? "Açık" : s === "completed" ? "Tamamlanan" : "Tümü"}
            </Button>
          ))}
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Görev Ekle
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center text-slate-500 py-20">Görev bulunamadı</div>
      ) : (
        <div className="space-y-6">
          {(["high", "medium", "low"] as const).map(p => grouped[p].length > 0 && (
            <div key={p}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${PRIORITY_COLORS[p]}`}>
                <Flag className="h-4 w-4" /> {PRIORITY_LABELS[p]} Öncelik ({grouped[p].length})
              </h3>
              <div className="space-y-2">
                {grouped[p].map(task => (
                  <Card key={task.id} className={`bg-slate-900 border-slate-800 ${task.status === "completed" ? "opacity-60" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${task.status === "completed" ? "line-through text-slate-500" : "text-white"}`}>{task.title}</span>
                            {task.task_type !== "general" && (
                              <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{TYPE_LABELS[task.task_type] ?? task.task_type}</Badge>
                            )}
                          </div>
                          {task.description && <p className="text-slate-400 text-xs mt-1 truncate">{task.description}</p>}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {task.customer_full_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.customer_company ?? task.customer_full_name}</span>}
                            {task.due_date && <span className={`flex items-center gap-1 ${isOverdue(task.due_date) && task.status === "open" ? "text-red-400" : ""}`}><Calendar className="h-3 w-3" />{fmtDate(task.due_date)}</span>}
                            {task.assigned_to && <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.assigned_to}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {task.status === "open" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300" onClick={() => complete.mutate(task.id)} title="Tamamla">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-red-400" onClick={() => { if (confirm("Silinsin mi?")) del.mutate(task.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["/api/crm/tasks"] }); setCreateOpen(false); }} />
    </AdminLayout>
  );
}

function CreateTaskDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", description: "", taskType: "general", priority: "medium", dueDate: "", assignedTo: "" });

  const create = useMutation({
    mutationFn: () => fetch("/api/crm/tasks", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json()),
    onSuccess: (d) => { if (d.id) { toast({ title: "Görev eklendi" }); onCreated(); } else toast({ title: d.error ?? "Hata", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle>Yeni Görev</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div><Label className="text-slate-300">Başlık *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Tür</Label>
              <Select value={form.taskType} onValueChange={v => setForm(p => ({ ...p, taskType: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Öncelik</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Yüksek</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="low">Düşük</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-slate-300">Son Tarih</Label><Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
            <div><Label className="text-slate-300">Atanan</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} /></div>
          </div>
          <div><Label className="text-slate-300">Açıklama</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-slate-700" onClick={onClose}>İptal</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
