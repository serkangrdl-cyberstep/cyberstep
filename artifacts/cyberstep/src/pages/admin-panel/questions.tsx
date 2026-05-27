import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, Pencil, Trash2, Plus, Check, X, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface Question {
  id: number; number: number; type: string; domain: string; text: string;
  weight: number; isRedAlarm: boolean; isActive: boolean; sortOrder: number;
}

const DOMAINS_ORDER = [
  "Firma ve Yönetişim",
  "Kimlik ve Erişim",
  "E-posta ve İnsan Faktörü",
  "Cihaz Güvenliği",
  "Veri Koruma ve Yedekleme",
];

const EMPTY_NEW = { number: 0, domain: "", text: "", weight: 1, isRedAlarm: false, isActive: true };

export default function AdminQuestions() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["admin-questions", "mini"],
    queryFn: () =>
      fetch("/api/admin-panel/questions?type=mini", { credentials: "include" }).then(r => r.json()),
  });

  const [openDomain, setOpenDomain] = useState<string | null>(DOMAINS_ORDER[0] ?? null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Question>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_NEW });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Question> }) =>
      fetch(`/api/admin-panel/questions/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
      toast({ title: "Soru güncellendi" });
      setEditId(null);
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_NEW) =>
      fetch("/api/admin-panel/questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, type: "mini" }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
      toast({ title: "Soru eklendi" });
      setShowAdd(false);
      setAddForm({ ...EMPTY_NEW });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/questions/${id}`, { method: "DELETE", credentials: "include" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error ?? "Hata"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
      setConfirmDeleteId(null);
      toast({ title: "Soru silindi" });
    },
    onError: () => { setConfirmDeleteId(null); toast({ title: "Hata", variant: "destructive" }); },
  });

  const domains = [
    ...DOMAINS_ORDER.filter(d => questions.some(q => q.domain === d)),
    ...questions.map(q => q.domain).filter(d => !DOMAINS_ORDER.includes(d)).filter((d, i, arr) => arr.indexOf(d) === i),
  ];

  const totalQuestions = questions.length;
  const alarmCount = questions.filter(q => q.isRedAlarm).length;
  const criticalCount = questions.filter(q => q.weight >= 2).length;

  return (
    <AdminLayout
      title="Soru Yönetimi"
      description={`${totalQuestions} soru — ${alarmCount} kırmızı alarm — ${criticalCount} kritik`}
    >
      <div className="max-w-4xl space-y-4">
        {/* ─── Özet & Yeni Soru ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <Badge className="bg-slate-700 text-slate-300">{totalQuestions} soru</Badge>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{alarmCount} kırmızı alarm</Badge>
            <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">{criticalCount} kritik x2</Badge>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Yeni Soru
          </Button>
        </div>

        {/* ─── Yeni Soru Formu ───────────────────────────────────────────── */}
        {showAdd && (
          <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">Yeni Soru Ekle</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Soru Numarası</label>
                <Input type="number" value={addForm.number || ""} onChange={e => setAddForm(f => ({ ...f, number: Number(e.target.value) }))}
                  placeholder="21" className="bg-slate-900 border-slate-600 text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Alan (Domain)</label>
                <Input value={addForm.domain} onChange={e => setAddForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="Cihaz Güvenliği" list="domain-list" className="bg-slate-900 border-slate-600 text-white" />
                <datalist id="domain-list">
                  {domains.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Soru Metni</label>
              <Textarea value={addForm.text} onChange={e => setAddForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Şirketinizde..." className="bg-slate-900 border-slate-600 text-white min-h-[80px]" />
            </div>
            <div className="flex items-center gap-6">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ağırlık</label>
                <div className="flex gap-2">
                  {[1, 2].map(w => (
                    <button key={w} onClick={() => setAddForm(f => ({ ...f, weight: w }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${addForm.weight === w ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-slate-600 bg-slate-700 text-slate-300"}`}>
                      {w === 1 ? "Normal (x1)" : "Kritik (x2)"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setAddForm(f => ({ ...f, isRedAlarm: !f.isRedAlarm }))}
                  className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${addForm.isRedAlarm ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-slate-600 bg-slate-700 text-slate-400"}`}>
                  Kırmızı Alarm
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { if (!addForm.number || !addForm.domain || !addForm.text) { toast({ title: "Tüm alanlar zorunludur", variant: "destructive" }); return; } createMutation.mutate(addForm); }}
                disabled={createMutation.isPending}>
                <Check className="h-4 w-4 mr-1" /> Ekle
              </Button>
              <Button variant="ghost" className="text-slate-400" onClick={() => { setShowAdd(false); setAddForm({ ...EMPTY_NEW }); }}>
                <X className="h-4 w-4 mr-1" /> İptal
              </Button>
            </div>
          </div>
        )}

        {/* ─── Sorular (alan bazlı) ──────────────────────────────────────── */}
        {isLoading ? (
          <div className="text-slate-400 text-center py-12">Yükleniyor...</div>
        ) : (
          domains.map(domain => {
            const qs = questions.filter(q => q.domain === domain).sort((a, b) => a.number - b.number);
            const isOpen = openDomain === domain;
            return (
              <Card key={domain} className="bg-slate-800 border-slate-700 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-750 transition-colors"
                  onClick={() => setOpenDomain(isOpen ? null : domain)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{domain}</span>
                    <Badge className="bg-slate-700 text-slate-300">{qs.length} soru</Badge>
                    {qs.filter(q => q.isRedAlarm).length > 0 && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        {qs.filter(q => q.isRedAlarm).length} alarm
                      </Badge>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {isOpen && (
                  <CardContent className="border-t border-slate-700 divide-y divide-slate-700/50 p-0">
                    {qs.map(q => (
                      <div key={q.id}>
                        {editId === q.id ? (
                          /* ─── Düzenleme Modu ───────────────────────────────── */
                          <div className="px-6 py-4 space-y-3 bg-slate-700/30">
                            <Textarea
                              value={editForm.text ?? ""}
                              onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                              className="bg-slate-900 border-slate-600 text-white min-h-[80px] text-sm"
                            />
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Alan</label>
                              <Input value={editForm.domain ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))}
                                list="domain-list-edit"
                                className="bg-slate-900 border-slate-600 text-white text-sm" />
                              <datalist id="domain-list-edit">
                                {domains.map(d => <option key={d} value={d} />)}
                              </datalist>
                            </div>
                            <div className="flex items-center gap-4">
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">Ağırlık</label>
                                <div className="flex gap-2">
                                  {[1, 2].map(w => (
                                    <button key={w} onClick={() => setEditForm(f => ({ ...f, weight: w }))}
                                      className={`px-2.5 py-1 rounded text-xs border transition-colors ${editForm.weight === w ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-slate-600 bg-slate-700 text-slate-300"}`}>
                                      {w === 1 ? "x1" : "Kritik x2"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => setEditForm(f => ({ ...f, isRedAlarm: !f.isRedAlarm }))}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${editForm.isRedAlarm ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-slate-600 bg-slate-700 text-slate-400"}`}>
                                Kırmızı Alarm
                              </button>
                              <button onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
                                className="text-slate-400 flex items-center gap-1 text-xs">
                                {editForm.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                                {editForm.isActive ? "Aktif" : "Pasif"}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => updateMutation.mutate({ id: q.id, data: editForm })}
                                disabled={updateMutation.isPending}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Kaydet
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setEditId(null)}>
                                <X className="h-3.5 w-3.5 mr-1" /> İptal
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ─── Görüntüleme Modu ─────────────────────────────── */
                          <div className="px-4 lg:px-6 py-4 flex items-start gap-3">
                            <span className="text-slate-500 text-sm w-6 flex-shrink-0 pt-0.5 tabular-nums">{q.number}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-200 text-sm leading-relaxed">{q.text}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {!q.isActive && <Badge className="bg-slate-700 text-slate-500 text-xs">Pasif</Badge>}
                                {q.weight === 2 && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">Kritik x2</Badge>}
                                {q.isRedAlarm && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Alarm</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {confirmDeleteId === q.id ? (
                                /* ─── Silme onayı ──── */
                                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
                                  <span className="text-red-400 text-xs whitespace-nowrap">Emin misiniz?</span>
                                  <Button size="sm" className="h-6 px-2 bg-red-600 hover:bg-red-700 text-white text-xs"
                                    onClick={() => deleteMutation.mutate(q.id)}
                                    disabled={deleteMutation.isPending}>
                                    Evet
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-slate-400 text-xs"
                                    onClick={() => setConfirmDeleteId(null)}>
                                    Hayır
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                                    onClick={() => { setEditId(q.id); setEditForm(q); setConfirmDeleteId(null); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                                    onClick={() => setConfirmDeleteId(q.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}

        {!isLoading && questions.length === 0 && (
          <div className="text-slate-500 text-center py-16">
            Henüz soru eklenmemiş. "Yeni Soru" ile ekleyebilirsiniz.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
