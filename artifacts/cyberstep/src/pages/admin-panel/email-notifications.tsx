import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Mail, Send, CheckCircle, XCircle, Eye, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface EmailSend {
  id: number;
  templateId: number | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyHtml: string;
  status: string;
  relatedType: string | null;
  relatedId: number | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  variables: string[];
}

export default function AdminEmailNotifications() {
  const { data: admin } = useRequireAdmin();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showSendDialog, setShowSendDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sendForm, setSendForm] = useState({
    templateId: "",
    toEmail: "",
    toName: "",
    vars: {} as Record<string, string>,
  });
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  const { data: history = [], isLoading } = useQuery<EmailSend[]>({
    queryKey: ["email-history", page],
    queryFn: () =>
      adminFetchJson<EmailSend[]>(`/api/admin-panel/emails/history?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`),
  });

  const [allHistory, setAllHistory] = useState<EmailSend[]>([]);

  // Accumulate pages for "load more" behaviour
  useEffect(() => {
    if (history.length > 0) {
      setAllHistory(prev => {
        const existingIds = new Set(prev.map(h => h.id));
        const newItems = history.filter(h => !existingIds.has(h.id));
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }
  }, [history]);

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["email-templates"],
    queryFn: () => adminFetchJson<EmailTemplate[]>("/api/admin-panel/email-templates"),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/emails/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: sendForm.templateId ? parseInt(sendForm.templateId) : undefined,
          toEmail: sendForm.toEmail,
          toName: sendForm.toName || undefined,
          vars: sendForm.vars,
        }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-history"] });
      setShowSendDialog(false);
      if (data.ok) toast({ title: "E-posta gonderildi" });
      else toast({ title: "Gonderim basarisiz", description: data.error, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/email-templates/${id}/preview`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendForm.vars),
      }).then(r => r.json()),
    onSuccess: (data: { bodyHtml: string }) => setPreviewHtml(data.bodyHtml),
  });

  const selectedTemplate = templates.find(t => t.id === parseInt(sendForm.templateId));
  const hasMore = history.length === PAGE_SIZE;

  const stats = {
    total: allHistory.length,
    sent: allHistory.filter(h => h.status === "sent").length,
    failed: allHistory.filter(h => h.status === "failed").length,
  };

  return (
    <AdminLayout title="Bildirim Merkezi" description="E-posta gecmisi ve manuel gonderim">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Mail className="h-5 w-5 text-blue-600" /></div>
              <div><div className="text-2xl font-bold text-slate-900">{stats.total}</div><div className="text-xs text-slate-500">Toplam</div></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              <div><div className="text-2xl font-bold text-slate-900">{stats.sent}</div><div className="text-xs text-slate-500">Gonderildi</div></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><XCircle className="h-5 w-5 text-red-600" /></div>
              <div><div className="text-2xl font-bold text-slate-900">{stats.failed}</div><div className="text-xs text-slate-500">Basarisiz</div></div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-700">Gonderim Gecmisi</h2>
          <Button size="sm" onClick={() => setShowSendDialog(true)}>
            <Send className="h-4 w-4 mr-1.5" /> Manuel Gonder
          </Button>
        </div>

        {/* History list */}
        <Card>
          <CardContent className="p-0">
            {isLoading && allHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">Yükleniyor...</div>
            ) : allHistory.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-400">Henüz gönderim yok.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {allHistory.map(row => (
                  <div key={row.id} className="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors">
                    <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${
                      row.status === "sent" ? "bg-green-100" : "bg-red-100"
                    }`}>
                      {row.status === "sent"
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        : <XCircle className="h-3.5 w-3.5 text-red-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 truncate">{row.subject}</span>
                        {row.relatedType && (
                          <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">
                            {row.relatedType} #{row.relatedId}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium">{row.toEmail}</span>
                        {row.toName && <span className="text-slate-400"> ({row.toName})</span>}
                      </div>
                      {row.error && (
                        <p className="text-xs text-red-500 mt-1">{row.error}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-xs text-slate-400">
                        {row.sentAt ? format(new Date(row.sentAt), "d MMM HH:mm", { locale: tr }) : "—"}
                      </span>
                      <button
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        onClick={() => setPreviewHtml(row.bodyHtml)}
                      >
                        <Eye className="h-3 w-3" /> Goruntule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {hasMore && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
              <ChevronDown className="h-4 w-4 mr-1.5" />
              {isLoading ? "Yükleniyor..." : "Daha Fazla Göster"}
            </Button>
          </div>
        )}
      </div>

      {/* Send dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manuel E-posta Gonder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sablon</Label>
              <Select value={sendForm.templateId} onValueChange={v => setSendForm(f => ({ ...f, templateId: v, vars: {} }))}>
                <SelectTrigger><SelectValue placeholder="Sablon sec..." /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Alici E-posta *</Label>
                <Input value={sendForm.toEmail} onChange={e => setSendForm(f => ({ ...f, toEmail: e.target.value }))} placeholder="ornek@firma.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Alici Adi</Label>
                <Input value={sendForm.toName} onChange={e => setSendForm(f => ({ ...f, toName: e.target.value }))} placeholder="Ahmet Yilmaz" />
              </div>
            </div>

            {/* Dynamic variable fields for selected template */}
            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p className="text-xs font-medium text-slate-600">Sablon Degiskenleri</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.variables.map(v => (
                    <div key={v} className="space-y-1">
                      <Label className="text-xs font-mono text-blue-600">{`{{${v}}}`}</Label>
                      <Input
                        className="h-7 text-xs"
                        value={sendForm.vars[v] ?? ""}
                        onChange={e => setSendForm(f => ({ ...f, vars: { ...f.vars, [v]: e.target.value } }))}
                        placeholder={v}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {sendForm.templateId && (
              <Button variant="outline" size="sm" onClick={() => previewMutation.mutate(parseInt(sendForm.templateId))}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Onizle
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Iptal</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !sendForm.toEmail}
            >
              {sendMutation.isPending ? "Gonderiliyor..." : "Gonder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewHtml} onOpenChange={open => !open && setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>E-posta Onizleme</DialogTitle></DialogHeader>
          {previewHtml && (
            <div className="border rounded-lg overflow-hidden">
              <iframe srcDoc={previewHtml} className="w-full" style={{ height: "500px", border: "none" }} title="Onizleme" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
