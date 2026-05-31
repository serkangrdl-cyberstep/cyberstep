import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Plus, Pencil, Trash2, Eye, Lock, Copy, PowerOff, Power } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface EmailTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  deal:       { label: "Deal",          color: "bg-blue-100 text-blue-700" },
  assessment: { label: "Degerlendirme", color: "bg-purple-100 text-purple-700" },
  custom:     { label: "Ozel",          color: "bg-slate-100 text-slate-600" },
};

const VARIABLE_HINTS: Record<string, string> = {
  companyName:   "Musteri sirket adi",
  contactName:   "Iletisim kisisi",
  dealId:        "Deal ID",
  assessmentId:  "Degerlendirme ID",
  riskLevel:     "Risk seviyesi",
  scorePercent:  "Yuzde puan",
  tenantName:    "Workspace adi",
  senderName:    "Gonderen adi",
  senderEmail:   "Gonderen e-posta",
  baseUrl:       "Site URL",
  date:          "Bugunun tarihi",
  validUntil:    "Gecerlilik tarihi",
  revisionNotes: "Revizyon notlari",
};

const BLANK_FORM = {
  name: "",
  description: "",
  category: "custom",
  subject: "",
  bodyHtml: "",
};

export default function AdminEmailTemplates() {
  const { data: admin } = useRequireAdmin();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["email-templates", showInactive],
    queryFn: () =>
      adminFetchJson<EmailTemplate[]>(`/api/admin-panel/email-templates${showInactive ? "?showInactive=true" : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof BLANK_FORM) =>
      fetch("/api/admin-panel/email-templates", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setShowEditor(false);
      toast({ title: "Şablon oluşturuldu" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof BLANK_FORM }) =>
      fetch(`/api/admin-panel/email-templates/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setShowEditor(false);
      toast({ title: "Şablon güncellendi" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/email-templates/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setDeleteId(null);
      toast({ title: "Şablon silindi" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/email-templates/${id}/preview`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then(r => r.json()),
    onSuccess: (data: { bodyHtml: string }) => setPreviewHtml(data.bodyHtml),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/email-templates/${id}/clone`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: "Şablon kopyalandı" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/email-templates/${id}/toggle-active`, { method: "PATCH", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowEditor(true);
  }

  function openEdit(tpl: EmailTemplate) {
    setEditingId(tpl.id);
    setForm({ name: tpl.name, description: tpl.description ?? "", category: tpl.category, subject: tpl.subject, bodyHtml: tpl.bodyHtml });
    setShowEditor(true);
  }

  function handleSave() {
    if (editingId) updateMutation.mutate({ id: editingId, body: form });
    else createMutation.mutate(form);
  }

  function insertVar(varName: string) {
    setForm(f => ({ ...f, bodyHtml: f.bodyHtml + `{{${varName}}}` }));
  }

  const filtered = templates.filter(t => categoryFilter === "all" || t.category === categoryFilter);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout title="E-posta Sablonlari" description="Yeniden kullanilabilir e-posta sablonlari olusturun ve yonetin">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["all", "deal", "assessment", "custom"].map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {c === "all" ? "Tümü" : CATEGORY_LABELS[c]?.label ?? c}
              </button>
            ))}
            <button
              onClick={() => setShowInactive(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                showInactive ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 text-slate-400 hover:text-slate-600"
              }`}
            >
              {showInactive ? "Pasifleri Gizle" : "Pasifleri Göster"}
            </button>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Yeni Şablon
          </Button>
        </div>

        {/* Template cards */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-slate-400">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Henuz sablon yok. Yeni bir sablon olusturun.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(tpl => {
              const cat = CATEGORY_LABELS[tpl.category] ?? { label: tpl.category, color: "bg-slate-100 text-slate-600" };
              return (
                <Card key={tpl.id} className={`flex flex-col ${!tpl.isActive ? "opacity-60" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <Badge className={`${cat.color} border-0 text-xs`}>{cat.label}</Badge>
                          {tpl.isDefault && (
                            <span className="flex items-center gap-0.5 text-xs text-slate-400">
                              <Lock className="h-3 w-3" /> Varsayılan
                            </span>
                          )}
                          {!tpl.isActive && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Pasif</span>
                          )}
                        </div>
                        <CardTitle className="text-sm leading-tight line-clamp-2">{tpl.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                    {tpl.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>
                    )}
                    <p className="text-xs text-slate-400 font-mono truncate">Konu: {tpl.subject}</p>
                    {tpl.variables && tpl.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tpl.variables.slice(0, 4).map(v => (
                          <span key={v} className="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded font-mono">
                            {`{{${v}}}`}
                          </span>
                        ))}
                        {tpl.variables.length > 4 && (
                          <span className="text-xs text-slate-400">+{tpl.variables.length - 4}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-auto">
                      {format(new Date(tpl.updatedAt), "d MMM yyyy", { locale: tr })}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => previewMutation.mutate(tpl.id)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Önizle
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(tpl)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        title={tpl.isActive ? "Pasif yap" : "Aktif yap"}
                        onClick={() => toggleActiveMutation.mutate(tpl.id)}
                        className={tpl.isActive ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                      >
                        {tpl.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        title="Kopyala"
                        onClick={() => cloneMutation.mutate(tpl.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {!tpl.isDefault && (
                        <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(tpl.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sablonu Duzenle" : "Yeni Sablon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sablon Adi *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="orn. Teklif Takip" />
              </div>
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal">Deal</SelectItem>
                    <SelectItem value="assessment">Degerlendirme</SelectItem>
                    <SelectItem value="custom">Ozel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Aciklama</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Bu sablon ne icin kullanilir?" />
            </div>
            <div className="space-y-1.5">
              <Label>Konu Satiri *</Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="orn. {{companyName}} — Teklifiniz Hazir" className="font-mono text-sm" />
            </div>

            {/* Variable chips */}
            <div className="space-y-1.5">
              <Label>Kullanilabilir Degiskenler (tikla ekle)</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(VARIABLE_HINTS).map(([k, desc]) => (
                  <button key={k} type="button" onClick={() => insertVar(k)}
                    title={desc}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-mono transition-colors">
                    {`{{${k}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>HTML Icerik *</Label>
              <Textarea
                value={form.bodyHtml}
                onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))}
                rows={14}
                className="font-mono text-xs"
                placeholder="<div>...</div>"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Iptal</Button>
            <Button onClick={handleSave} disabled={isPending || !form.name || !form.subject || !form.bodyHtml}>
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewHtml} onOpenChange={open => !open && setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onizleme (Ornek Verilerle)</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="w-full"
                style={{ height: "500px", border: "none" }}
                title="E-posta onizleme"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sablonu sil?</AlertDialogTitle>
            <AlertDialogDescription>Bu islem geri alinamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Iptal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
