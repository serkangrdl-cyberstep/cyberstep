import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MailOpen,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  UserPlus,
  Zap,
  ExternalLink,
  Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeaserData {
  id: number;
  status: string;
  overall_risk_score: number | null;
  risk_level: string | null;
  teaser_headline: string | null;
  email_sent_at: string | null;
  followup_1_sent_at: string | null;
  followup_2_sent_at: string | null;
  preview_token: string | null;
}

interface ProspectDashRow {
  id: number;
  companyName: string;
  domain: string;
  sector: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  status: string;
  lastActivityAt: string;
  notes: string | null;
  teaser: TeaserData | null;
  contactComplete: boolean;
  followup1Sent: boolean;
  followup2Sent: boolean;
}

interface ReplyRow {
  reply: {
    id: number;
    fromEmail: string | null;
    fromName: string | null;
    subject: string | null;
    bodyText: string | null;
    receivedAt: string;
    isHandled: boolean;
    handlerNotes: string | null;
  };
  prospect: {
    id: number;
    companyName: string;
    domain: string;
    status: string;
  } | null;
}

interface WebLead {
  id: number;
  domain: string;
  sector: string | null;
  scanStatus: string;
  contactEmail: string | null;
  contactName: string | null;
  riskScore: number | null;
  isrNotes: string | null;
  createdAt: string;
  hasDomainScan: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    scanning:    { label: "Taranıyor", variant: "secondary" },
    scanned:     { label: "Tarandı", variant: "outline" },
    teaser_sent: { label: "Gönderildi", variant: "default" },
    interested:  { label: "İlgileniyor", variant: "default" },
  };
  const m = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function riskBadge(level: string | null) {
  if (!level) return null;
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${map[level] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[level] ?? level}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} gün önce`;
  if (h > 0) return `${h} saat önce`;
  return "Az önce";
}

function getBaseUrl(): string {
  const host = window.location.host;
  return `${window.location.protocol}//${host}`;
}

// ─── Contact Modal ─────────────────────────────────────────────────────────────

function ContactModal({
  prospect,
  onClose,
  onSaved,
}: {
  prospect: ProspectDashRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    contactName: prospect.contactName ?? "",
    contactTitle: "",
    contactEmail: prospect.contactEmail ?? "",
    contactPhone: prospect.contactPhone ?? "",
    linkedinUrl: prospect.linkedinUrl ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/enterprise/prospects/${prospect.id}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kontak Bilgisi — {prospect.companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Ad Soyad</Label>
              <Input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} placeholder="İsim" />
            </div>
            <div className="space-y-1">
              <Label>Unvan</Label>
              <Input value={form.contactTitle} onChange={e => setForm(p => ({ ...p, contactTitle: e.target.value }))} placeholder="IT Müdürü" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>E-posta</Label>
            <Input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="isim@sirket.com" />
          </div>
          <div className="space-y-1">
            <Label>Telefon</Label>
            <Input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="+90 5xx xxx xx xx" />
          </div>
          <div className="space-y-1">
            <Label>LinkedIn</Label>
            <Input value={form.linkedinUrl} onChange={e => setForm(p => ({ ...p, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">İptal</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Teaser Send Modal ────────────────────────────────────────────────────────

function TeaserPreviewModal({
  prospect,
  onClose,
  onSent,
}: {
  prospect: ProspectDashRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const teaser = prospect.teaser;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const sendTeaser = async () => {
    if (!teaser) return;
    setSending(true);
    setErr("");
    try {
      const res = await fetch(`/api/enterprise/teaser/${teaser.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setErr(d.error ?? "Gönderilemedi");
        return;
      }
      setSent(true);
      setTimeout(() => { onSent(); onClose(); }, 1500);
    } finally {
      setSending(false);
    }
  };

  const previewUrl = teaser?.preview_token
    ? `${getBaseUrl()}/preview/${teaser.preview_token}`
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Teaser Gözden Geçir — {prospect.companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {teaser ? (
            <>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Skoru</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{teaser.overall_risk_score ?? "—"}/100</span>
                    {riskBadge(teaser.risk_level)}
                  </div>
                </div>
                {teaser.teaser_headline && (
                  <p className="text-sm text-muted-foreground italic">{teaser.teaser_headline}</p>
                )}
              </div>

              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Gönderilecek adres</p>
                <p className="text-sm font-medium">{prospect.contactName ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{prospect.contactEmail ?? "E-posta eksik"}</p>
              </div>

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink size={14} />
                  Teaser önizlemesini aç
                </a>
              )}

              {err && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle size={14} /> {err}
                </div>
              )}

              {sent ? (
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 size={16} /> Teaser gönderildi!
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={sendTeaser}
                    disabled={sending || !prospect.contactEmail}
                    className="flex-1 gap-2"
                  >
                    <Send size={14} />
                    {sending ? "Gönderiliyor..." : "Teaser Gönder"}
                  </Button>
                  <Button variant="outline" onClick={onClose} className="flex-1">Kapat</Button>
                </div>
              )}
              {!prospect.contactEmail && (
                <p className="text-xs text-destructive">E-posta adresi girilmeden gönderilemez.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Teaser raporu yükleniyor...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reply Handle Modal ────────────────────────────────────────────────────────

function ReplyModal({
  row,
  onClose,
  onHandled,
}: {
  row: ReplyRow;
  onClose: () => void;
  onHandled: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    setSaving(true);
    try {
      await fetch(`/api/enterprise/isr/replies/${row.reply.id}/handle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ handledBy: "admin", handlerNotes: notes }),
      });
      onHandled();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gelen Yanıt — {row.prospect?.companyName ?? row.reply.fromEmail}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Gönderen: </span>
              <span className="font-medium">{row.reply.fromName || row.reply.fromEmail}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Alındı: </span>
              <span className="font-medium">{new Date(row.reply.receivedAt).toLocaleString("tr-TR")}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Konu</p>
            <p className="text-sm font-medium">{row.reply.subject}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mesaj</p>
            <div className="rounded-lg border bg-muted/30 p-3 max-h-52 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{row.reply.bodyText}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>ISR Notları</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Görüşme notu, sonraki adım..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handle} disabled={saving} className="flex-1">
              {saving ? "Kaydediliyor..." : "Yanıt İşlendi Olarak İşaretle"}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">Kapat</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IsrCalisma() {
  const [prospects, setProspects] = useState<ProspectDashRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [missingContactOnly, setMissingContactOnly] = useState(false);
  const [contactModal, setContactModal] = useState<ProspectDashRow | null>(null);
  const [teaserModal, setTeaserModal] = useState<ProspectDashRow | null>(null);
  const [replyModal, setReplyModal] = useState<ReplyRow | null>(null);
  const [unhandledCount, setUnhandledCount] = useState(0);
  // ─── Web Leadleri state ──────────────────────────────────────────────────
  const [webLeads, setWebLeads] = useState<WebLead[]>([]);
  const [webLeadsLoading, setWebLeadsLoading] = useState(false);
  const [webDomainInput, setWebDomainInput] = useState("");
  const [webSectorInput, setWebSectorInput] = useState("");
  const [webNotesInput, setWebNotesInput] = useState("");
  const [webLeadAdding, setWebLeadAdding] = useState(false);
  const [webLeadError, setWebLeadError] = useState<string | null>(null);
  const [webNoteEdit, setWebNoteEdit] = useState<{ id: number; notes: string } | null>(null);

  const loadWebLeads = useCallback(async () => {
    setWebLeadsLoading(true);
    const r = await fetch("/api/admin-panel/isr/web-leads", { credentials: "include" }).then(r => r.json());
    setWebLeads(Array.isArray(r) ? r as WebLead[] : []);
    setWebLeadsLoading(false);
  }, []);

  const addWebLead = async () => {
    if (!webDomainInput.trim()) return;
    setWebLeadAdding(true);
    setWebLeadError(null);
    const r = await fetch("/api/admin-panel/isr/web-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ domain: webDomainInput.trim(), sector: webSectorInput.trim() || undefined, notes: webNotesInput.trim() || undefined }),
    });
    if (r.status === 409) {
      setWebLeadError("Bu domain zaten listede.");
    } else if (!r.ok) {
      const err = await r.json().catch(() => ({})) as { error?: string };
      setWebLeadError(err.error ?? "Bir hata oluştu.");
    } else {
      setWebDomainInput("");
      setWebSectorInput("");
      setWebNotesInput("");
      await loadWebLeads();
    }
    setWebLeadAdding(false);
  };

  const deleteWebLead = async (id: number) => {
    await fetch(`/api/admin-panel/isr/web-leads/${id}`, { method: "DELETE", credentials: "include" });
    await loadWebLeads();
  };

  const saveWebNote = async () => {
    if (!webNoteEdit) return;
    await fetch(`/api/admin-panel/isr/web-leads/${webNoteEdit.id}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ notes: webNoteEdit.notes }),
    });
    setWebNoteEdit(null);
    await loadWebLeads();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [prosp, rep] = await Promise.all([
      fetch("/api/enterprise/isr/dashboard", { credentials: "include" }).then(r => r.json()),
      fetch("/api/enterprise/isr/replies", { credentials: "include" }).then(r => r.json()),
    ]);
    setProspects(Array.isArray(prosp) ? prosp as ProspectDashRow[] : []);
    const repArr = Array.isArray(rep) ? rep as ReplyRow[] : [];
    setReplies(repArr);
    setUnhandledCount(repArr.filter(r => !r.reply.isHandled).length);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const generateTeaser = async (p: ProspectDashRow) => {
    setGenerating(p.id);
    await fetch(`/api/enterprise/prospects/${p.id}/scan`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Poll until status changes from scanning
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      await load();
      if (tries > 30) { clearInterval(poll); setGenerating(null); }
    }, 4000);
    setGenerating(null);
  };

  const filtered = prospects.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (missingContactOnly && p.contactComplete) return false;
    return true;
  });

  return (
    <AdminLayout title="ISR Satış Paneli">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ISR Satış Paneli</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Nitelikli aday yönetimi, teaser gönderim ve yanıt takibi
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw size={14} />
            Yenile
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Tarandı", value: prospects.filter(p => p.status === "scanned").length, icon: Zap, color: "text-blue-600" },
            { label: "Gönderildi", value: prospects.filter(p => p.status === "teaser_sent").length, icon: Mail, color: "text-indigo-600" },
            { label: "İlgileniyor", value: prospects.filter(p => p.status === "interested").length, icon: MessageSquare, color: "text-green-600" },
            { label: "Yeni Yanıt", value: unhandledCount, icon: MailOpen, color: "text-orange-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
              <s.icon className={`${s.color} shrink-0`} size={22} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="prospects" onValueChange={v => { if (v === "web-leadleri") void loadWebLeads(); }}>
          <TabsList>
            <TabsTrigger value="prospects">Nitelikli Adaylar</TabsTrigger>
            <TabsTrigger value="web-leadleri">Web Leadleri</TabsTrigger>
            <TabsTrigger value="replies" className="relative">
              Gelen Yanıtlar
              {unhandledCount > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unhandledCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Web Leadleri ─────────────────────────────────────── */}
          <TabsContent value="web-leadleri" className="mt-4">
            {/* Domain ekleme formu */}
            <div className="rounded-lg border bg-card p-4 mb-4 space-y-3">
              <p className="text-sm font-semibold">Yeni Domain Ekle</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="sirket.com.tr"
                  value={webDomainInput}
                  onChange={e => { setWebDomainInput(e.target.value); setWebLeadError(null); }}
                  onKeyDown={e => { if (e.key === "Enter") void addWebLead(); }}
                  className="h-8 text-sm flex-1"
                />
                <Input
                  placeholder="Sektör (opsiyonel)"
                  value={webSectorInput}
                  onChange={e => setWebSectorInput(e.target.value)}
                  className="h-8 text-sm w-40"
                />
                <Input
                  placeholder="Not (opsiyonel)"
                  value={webNotesInput}
                  onChange={e => setWebNotesInput(e.target.value)}
                  className="h-8 text-sm w-48"
                />
                <Button
                  size="sm"
                  onClick={() => void addWebLead()}
                  disabled={webLeadAdding || !webDomainInput.trim()}
                  className="h-8 shrink-0"
                >
                  {webLeadAdding ? "Ekleniyor..." : "Ekle"}
                </Button>
              </div>
              {webLeadError && <p className="text-xs text-destructive">{webLeadError}</p>}
              <p className="text-xs text-muted-foreground">
                Domain domain_scans tablosunda yoksa otomatik olarak tarama pipeline'ına sokulur.
              </p>
            </div>

            {/* Not düzenleme */}
            {webNoteEdit && (
              <div className="rounded-lg border bg-card p-3 mb-4 flex gap-2 items-start">
                <Textarea
                  value={webNoteEdit.notes}
                  onChange={e => setWebNoteEdit(n => n ? { ...n, notes: e.target.value } : n)}
                  rows={2}
                  placeholder="Not..."
                  className="text-sm flex-1"
                />
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" className="h-7 text-xs" onClick={() => void saveWebNote()}>Kaydet</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setWebNoteEdit(null)}>Vazgec</Button>
                </div>
              </div>
            )}

            {/* Lead tablosu */}
            {webLeadsLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Yükleniyor...</div>
            ) : webLeads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                Henüz web lead eklenmedi. Yukarıdaki formu kullanarak domain ekleyin.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Domain</TableHead>
                      <TableHead>Sektör</TableHead>
                      <TableHead>Tarama</TableHead>
                      <TableHead>Risk Skoru</TableHead>
                      <TableHead>Not</TableHead>
                      <TableHead>Eklendi</TableHead>
                      <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webLeads.map(wl => (
                      <TableRow key={wl.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm font-mono">{wl.domain}</p>
                            {wl.contactEmail && <p className="text-xs text-muted-foreground">{wl.contactEmail}</p>}
                            {!wl.hasDomainScan && wl.scanStatus === "pending" && (
                              <span className="text-[10px] text-amber-600 font-medium">Tarama bekleniyor...</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{wl.sector ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          {statusBadge(wl.scanStatus)}
                        </TableCell>
                        <TableCell>
                          {wl.riskScore != null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm">{wl.riskScore}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground max-w-[140px] line-clamp-1">
                            {wl.isrNotes ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(wl.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => setWebNoteEdit({ id: wl.id, notes: wl.isrNotes ?? "" })}
                            >
                              Not
                            </Button>
                            {wl.riskScore != null && (
                              <a
                                href={`/domain-scan?domain=${encodeURIComponent(wl.domain)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                  Rapor
                                </Button>
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              onClick={() => { if (confirm(`"${wl.domain}" listeden çıkarılsın mı?`)) void deleteWebLead(wl.id); }}
                            >
                              Sil
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 1: Nitelikli Adaylar ──────────────────────────────── */}
          <TabsContent value="prospects" className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <Filter size={14} className="text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="scanning">Taranıyor</SelectItem>
                  <SelectItem value="scanned">Tarandı</SelectItem>
                  <SelectItem value="teaser_sent">Gönderildi</SelectItem>
                  <SelectItem value="interested">İlgileniyor</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={missingContactOnly}
                  onChange={e => setMissingContactOnly(e.target.checked)}
                  className="rounded"
                />
                Sadece eksik kontak
              </label>
              <span className="text-xs text-muted-foreground ml-auto">{filtered.length} aday</span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-muted-foreground">Yükleniyor...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Uygun aday bulunamadı.</div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Şirket / Domain</TableHead>
                      <TableHead>Kontak</TableHead>
                      <TableHead>Teaser</TableHead>
                      <TableHead>Takip</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Son Aktivite</TableHead>
                      <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.companyName}</p>
                            <p className="text-xs text-muted-foreground">{p.domain}</p>
                            {p.sector && <p className="text-xs text-muted-foreground/70">{p.sector}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.contactComplete ? (
                            <div>
                              <p className="text-sm font-medium">{p.contactName}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail size={10} /> {p.contactEmail}
                              </p>
                              {p.contactPhone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone size={10} /> {p.contactPhone}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle size={12} className="text-orange-500" />
                              <span className="text-xs text-orange-600 font-medium">Kontak eksik</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.teaser ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                {riskBadge(p.teaser.risk_level)}
                                <span className="text-sm font-bold">{p.teaser.overall_risk_score}/100</span>
                              </div>
                              {p.teaser.email_sent_at && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Gönderildi: {timeAgo(p.teaser.email_sent_at)}
                                </p>
                              )}
                            </div>
                          ) : p.status === "scanning" ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <RefreshCw size={12} className="animate-spin" />
                              <span className="text-xs">Üretiliyor...</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Teaser yok</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${p.followup1Sent ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                              {p.followup1Sent ? "D+3 gönderildi" : "D+3 bekliyor"}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${p.followup2Sent ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                              {p.followup2Sent ? "D+7 gönderildi" : "D+7 bekliyor"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(p.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={10} />
                            {timeAgo(p.lastActivityAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => setContactModal(p)}
                            >
                              <UserPlus size={11} />
                              {p.contactComplete ? "Düzenle" : "Kontak Ekle"}
                            </Button>

                            {p.teaser && p.status !== "scanning" ? (
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => setTeaserModal(p)}
                              >
                                {p.teaser.email_sent_at ? (
                                  <><Eye size={11} /> Gözden Geçir</>
                                ) : (
                                  <><Send size={11} /> Gönder</>
                                )}
                              </Button>
                            ) : p.status !== "scanning" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => generateTeaser(p)}
                                disabled={generating === p.id}
                              >
                                <Zap size={11} />
                                {generating === p.id ? "Üretiliyor..." : "Teaser Oluştur"}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Gelen Yanıtlar ─────────────────────────────────── */}
          <TabsContent value="replies" className="mt-4">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">Yükleniyor...</div>
            ) : replies.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <MailOpen size={32} className="mx-auto mb-3 opacity-30" />
                Henüz yanıt yok. IMAP poller her 15 dakikada bir kontrol eder.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Gönderen</TableHead>
                      <TableHead>Şirket / Domain</TableHead>
                      <TableHead>Konu</TableHead>
                      <TableHead>Alındı</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {replies.map((r) => (
                      <TableRow key={r.reply.id} className={`hover:bg-muted/20 ${!r.reply.isHandled ? "bg-orange-50/30" : ""}`}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{r.reply.fromName || "—"}</p>
                            <p className="text-xs text-muted-foreground">{r.reply.fromEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.prospect ? (
                            <div>
                              <p className="text-sm font-medium">{r.prospect.companyName}</p>
                              <p className="text-xs text-muted-foreground">{r.prospect.domain}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Eşleşme yok</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm max-w-xs truncate">{r.reply.subject}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.reply.receivedAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.reply.isHandled ? (
                            <Badge variant="outline" className="text-green-700 border-green-300 gap-1">
                              <CheckCircle2 size={11} /> İşlendi
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-orange-700 bg-orange-100 border-0 gap-1">
                              <Clock size={11} /> Yeni
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={r.reply.isHandled ? "outline" : "default"}
                            className="h-7 px-2 text-xs"
                            onClick={() => setReplyModal(r)}
                          >
                            {r.reply.isHandled ? "Görüntüle" : "İşle"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {contactModal && (
        <ContactModal
          prospect={contactModal}
          onClose={() => setContactModal(null)}
          onSaved={load}
        />
      )}
      {teaserModal && (
        <TeaserPreviewModal
          prospect={teaserModal}
          onClose={() => setTeaserModal(null)}
          onSent={load}
        />
      )}
      {replyModal && (
        <ReplyModal
          row={replyModal}
          onClose={() => setReplyModal(null)}
          onHandled={load}
        />
      )}
    </AdminLayout>
  );
}
