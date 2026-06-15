import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  UserPlus, Mail, Bot, Search, RefreshCw, ChevronDown, ChevronUp,
  Building2, Globe, AlertTriangle, Phone, ExternalLink, Send, Sparkles,
  Loader2, CheckCircle2, Copy,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: number;
  domain: string;
  companyName: string | null;
  scrapedCompanyName: string | null;
  sector: string | null;
  city: string | null;
  riskScore: number | null;
  criticalFindings: number;
  findingHighlights: string[] | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  scrapedPhone: string | null;
  teaserSubject: string | null;
  teaserBody: string | null;
  teaserGeneratedAt: string | null;
  teaserSentAt: string | null;
  isrNotes: string | null;
  tier: string | null;
  createdAt: string;
}

interface WorkList {
  notContacted: Lead[];
  contacted: Lead[];
  teaserSent: Lead[];
}

interface CopilotContent {
  musteri_ozeti: string;
  satis_acisi: string;
  aciliyet_faktoru: string;
  onerilen_paket: { isim: string; fiyat: string; neden: string[] };
  gorusmede_sor: Array<{ soru: string; amac: string }>;
  itirazlar: Array<{ itiraz: string; cevap: string }>;
  linkedin_mesaji: string;
  followup_mail_d3: { konu: string; icerik: string };
  followup_mail_d7: { konu: string; icerik: string };
  bir_sonraki_adim: string;
  upsell_zamani: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function companyLabel(lead: Lead) {
  return lead.companyName ?? lead.scrapedCompanyName ?? lead.domain;
}

function riskColor(score: number | null) {
  if (!score) return "text-slate-400";
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-orange-400";
  return "text-green-400";
}

function riskBadgeColor(score: number | null) {
  if (!score) return "bg-slate-800 text-slate-400";
  if (score >= 70) return "bg-red-900/60 text-red-300 border border-red-700/50";
  if (score >= 40) return "bg-orange-900/60 text-orange-300 border border-orange-700/50";
  return "bg-green-900/60 text-green-300 border border-green-700/50";
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    contactName: lead.contactName ?? "",
    contactEmail: lead.contactEmail ?? "",
    contactTitle: lead.contactTitle ?? "",
    scrapedPhone: lead.scrapedPhone ?? "",
    isrNotes: lead.isrNotes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin-panel/isr/leads/${lead.id}/contact`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Kayıt başarısız");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isr-work-list"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Kontak Bilgisi Kaydet</DialogTitle>
          <p className="text-sm text-slate-400">{lead.domain}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Ad Soyad</Label>
              <Input
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="Ahmet Yılmaz"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Unvan</Label>
              <Input
                value={form.contactTitle}
                onChange={e => setForm(f => ({ ...f, contactTitle: e.target.value }))}
                placeholder="IT Müdürü"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Email *</Label>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
              placeholder="ahmet@sirket.com.tr"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Telefon</Label>
            <Input
              value={form.scrapedPhone}
              onChange={e => setForm(f => ({ ...f, scrapedPhone: e.target.value }))}
              placeholder="+90 212 XXX XX XX"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">ISR Notları</Label>
            <Textarea
              value={form.isrNotes}
              onChange={e => setForm(f => ({ ...f, isrNotes: e.target.value }))}
              placeholder="Kontak kaynağı, görüşme notu..."
              rows={3}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300 hover:bg-slate-800">
            Vazgec
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.contactEmail}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Teaser Panel (Tab 2 row expansion) ──────────────────────────────────────

function TeaserPanel({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [localTeaser, setLocalTeaser] = useState<{ subject: string; body: string } | null>(
    lead.teaserSubject && lead.teaserBody ? { subject: lead.teaserSubject, body: lead.teaserBody } : null,
  );

  const generate = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin-panel/isr/leads/${lead.id}/teaser/generate`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Üretim başarısız");
      return r.json() as Promise<{ subject: string; body: string }>;
    },
    onSuccess: (data) => {
      setLocalTeaser(data);
      queryClient.invalidateQueries({ queryKey: ["isr-work-list"] });
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin-panel/isr/leads/${lead.id}/teaser/send`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Gönderim başarısız");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isr-work-list"] });
    },
  });

  const teaser = localTeaser;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-4">
      {!teaser ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400 flex-1">
            Bu lead icin kisisellestirilmis teaser email uretilecek.
          </p>
          <Button
            size="sm"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          >
            {generate.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Uretiliyor...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Teaser Uret</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Konu</p>
            <p className="text-sm font-medium text-white bg-slate-900/60 rounded px-3 py-2">
              {teaser.subject}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email Govdesi</p>
            <div
              className="text-sm text-slate-200 bg-slate-900/60 rounded px-3 py-3 leading-relaxed max-h-64 overflow-y-auto prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: teaser.body
                  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                  .split(/\n\n+/)
                  .map(para => `<p style="margin:0 0 0.75em 0">${para.replace(/\n/g, "<br/>")}</p>`)
                  .join(""),
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs"
            >
              {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Yeniden Uret
            </Button>
            <Button
              size="sm"
              onClick={() => { void navigator.clipboard.writeText(teaser.body); }}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" /> Kopyala
            </Button>
            <Button
              size="sm"
              onClick={() => send.mutate()}
              disabled={send.isPending || send.isSuccess}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:ml-auto w-full sm:w-auto justify-center"
            >
              {send.isPending ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" />Gonderiliyor...</>
              ) : send.isSuccess ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />Gonderildi</>
              ) : (
                <><Send className="h-3 w-3 mr-1" />Gonder: {lead.contactEmail}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Copilot Panel (Tab 3) ────────────────────────────────────────────────────

function CopilotPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [tab, setTab] = useState<"ozet" | "soru" | "itiraz" | "followup">("ozet");

  const copilotQ = useQuery<{ copilot: CopilotContent }>({
    queryKey: ["isr-lead-copilot", lead.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin-panel/isr/leads/${lead.id}/lead-copilot`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Copilot uretim hatasi");
      return r.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const c = copilotQ.data?.copilot;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-xl bg-slate-900 border-l border-slate-700 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-400" />
              <span className="font-semibold text-white text-sm">ISR Copilot</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{companyLabel(lead)} — {lead.contactName ?? lead.contactEmail}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {copilotQ.isPending && (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            <span className="text-sm">AI analiz yapiliyor...</span>
          </div>
        )}
        {copilotQ.isError && (
          <div className="p-6 text-red-400 text-sm">Copilot yukleme hatasi. Tekrar deneyin.</div>
        )}

        {c && (
          <div className="flex-1 p-4 space-y-4">
            <div className="rounded-lg bg-violet-900/20 border border-violet-700/40 p-3">
              <p className="text-xs font-medium text-violet-300 mb-1">Musteri Ozeti</p>
              <p className="text-sm text-slate-200 leading-relaxed">{c.musteri_ozeti}</p>
            </div>

            <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 p-3">
              <p className="text-xs font-medium text-emerald-300 mb-1">Aciliyet Faktoru</p>
              <p className="text-sm text-slate-200 leading-relaxed">{c.aciliyet_faktoru}</p>
            </div>

            <div className="rounded-lg bg-blue-900/20 border border-blue-700/40 p-3">
              <p className="text-xs font-medium text-blue-300 mb-1">Bir Sonraki Adim</p>
              <p className="text-sm text-slate-200 leading-relaxed">{c.bir_sonraki_adim}</p>
            </div>

            <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
              <p className="text-xs font-medium text-slate-300 mb-1">Onerilen Paket</p>
              <p className="text-sm font-bold text-white">{c.onerilen_paket.isim} — {c.onerilen_paket.fiyat}</p>
              <ul className="mt-1.5 space-y-1">
                {c.onerilen_paket.neden.map((n, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5"><span className="text-emerald-400 shrink-0">•</span>{n}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-1 border border-slate-700 rounded-lg p-1 bg-slate-800/40">
              {(["ozet", "soru", "itiraz", "followup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {t === "ozet" ? "Satis Acisi" : t === "soru" ? "Sorular" : t === "itiraz" ? "Itirazlar" : "Follow-up"}
                </button>
              ))}
            </div>

            {tab === "ozet" && (
              <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{c.satis_acisi}</p>
              </div>
            )}

            {tab === "soru" && (
              <div className="space-y-2">
                {c.gorusmede_sor.map((q, i) => (
                  <div key={i} className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                    <p className="text-sm font-medium text-white mb-1">{i + 1}. {q.soru}</p>
                    <p className="text-xs text-slate-400">{q.amac}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "itiraz" && (
              <div className="space-y-2">
                {c.itirazlar.map((obj, i) => (
                  <div key={i} className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                    <p className="text-xs font-semibold text-orange-400 mb-1">{obj.itiraz}</p>
                    <p className="text-sm text-slate-200 leading-relaxed">{obj.cevap}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "followup" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                  <p className="text-xs font-medium text-blue-300 mb-1">D+3 Mail — {c.followup_mail_d3.konu}</p>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {c.followup_mail_d3.icerik}
                  </pre>
                </div>
                <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                  <p className="text-xs font-medium text-violet-300 mb-1">D+7 Mail — {c.followup_mail_d7.konu}</p>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {c.followup_mail_d7.icerik}
                  </pre>
                </div>
                <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                  <p className="text-xs font-medium text-slate-400 mb-1">LinkedIn Mesaji</p>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {c.linkedin_mesaji}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: Kontak Olmayanlar ─────────────────────────────────────────────────

function NotContactedTab({ leads }: { leads: Lead[] }) {
  const [contactTarget, setContactTarget] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");

  const filtered = leads.filter(l =>
    !search || companyLabel(l).toLowerCase().includes(search.toLowerCase()) || l.domain.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sirket veya domain ara..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <p className="text-xs text-slate-500">{filtered.length} lead</p>
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400 text-xs">Sirket / Domain</TableHead>
              <TableHead className="text-slate-400 text-xs">Sektor</TableHead>
              <TableHead className="text-slate-400 text-xs">Sehir</TableHead>
              <TableHead className="text-slate-400 text-xs">Risk</TableHead>
              <TableHead className="text-slate-400 text-xs">Kritik</TableHead>
              <TableHead className="text-slate-400 text-xs w-40"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-8 text-sm">
                  Kontak bekleyen lead yok
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => (
              <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/40">
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-white">{companyLabel(lead)}</p>
                    <a
                      href={`https://${lead.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      {lead.domain} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-400">{lead.sector ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-400">{lead.city ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-bold ${riskColor(lead.riskScore)}`}>
                    {lead.riskScore ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {lead.criticalFindings > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="h-3 w-3" />{lead.criticalFindings}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">0</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => setContactTarget(lead)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                  >
                    <UserPlus className="h-3 w-3 mr-1" /> Kontak Kaydet
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {contactTarget && (
        <ContactModal lead={contactTarget} onClose={() => setContactTarget(null)} />
      )}
    </div>
  );
}

// ─── Tab 2: Kontak Olanlar ────────────────────────────────────────────────────

function ContactedTab({ leads }: { leads: Lead[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Lead | null>(null);

  const filtered = leads.filter(l =>
    !search || companyLabel(l).toLowerCase().includes(search.toLowerCase()) || (l.contactEmail ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sirket veya email ara..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <p className="text-xs text-slate-500">{filtered.length} lead</p>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 py-8 text-sm rounded-lg border border-slate-800">
            Kontak bilgisi girilmis lead yok
          </div>
        )}
        {filtered.map((lead) => (
          <div key={lead.id} className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-white truncate">{companyLabel(lead)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${riskBadgeColor(lead.riskScore)}`}>
                    {lead.riskScore ?? "?"}/100
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.contactEmail}</span>
                  {lead.contactName && <span>{lead.contactName}</span>}
                  {lead.scrapedPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.scrapedPhone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditTarget(lead)}
                  className="border-slate-600 text-slate-400 hover:bg-slate-800 text-xs h-7"
                >
                  Duzenle
                </Button>
                <Button
                  size="sm"
                  onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                  className="bg-violet-700 hover:bg-violet-600 text-white text-xs h-7"
                >
                  {expanded === lead.id ? (
                    <><ChevronUp className="h-3 w-3 mr-1" />Kapat</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" />Teaser</>
                  )}
                </Button>
              </div>
            </div>
            {expanded === lead.id && (
              <div className="px-4 pb-4">
                <TeaserPanel lead={lead} />
              </div>
            )}
          </div>
        ))}
      </div>

      {editTarget && (
        <ContactModal lead={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}

// ─── Tab 3: Teaser Gnderilenler ──────────────────────────────────────────────

function TeaserSentTab({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState("");
  const [copilotLead, setCopilotLead] = useState<Lead | null>(null);

  const filtered = leads.filter(l =>
    !search ||
    companyLabel(l).toLowerCase().includes(search.toLowerCase()) ||
    (l.contactEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
    l.domain.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sirket, domain veya email ara..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <p className="text-xs text-slate-500">{filtered.length} lead</p>
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400 text-xs">Sirket / Domain</TableHead>
              <TableHead className="text-slate-400 text-xs">Kontak</TableHead>
              <TableHead className="text-slate-400 text-xs">Gonderim Tarihi</TableHead>
              <TableHead className="text-slate-400 text-xs">Risk</TableHead>
              <TableHead className="text-slate-400 text-xs w-44"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8 text-sm">
                  {search ? "Eslesen sonuc bulunamadi" : "Henuz teaser gonderilmemis"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => (
              <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/40">
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-white">{companyLabel(lead)}</p>
                    <a
                      href={`https://${lead.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      {lead.domain} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-xs text-slate-200">{lead.contactName ?? "—"}</p>
                    <p className="text-xs text-slate-500">{lead.contactEmail}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {lead.teaserSentAt ? (
                    <span className="text-xs text-slate-300">
                      {format(new Date(lead.teaserSentAt), "d MMM yyyy", { locale: tr })}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-bold ${riskColor(lead.riskScore)}`}>
                    {lead.riskScore ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => setCopilotLead(lead)}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-7"
                  >
                    <Bot className="h-3 w-3 mr-1" /> Copilot Basla
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {copilotLead && (
        <CopilotPanel lead={copilotLead} onClose={() => setCopilotLead(null)} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "notContacted" | "contacted" | "teaserSent";

export default function IsrIsListesi() {
  const [activeTab, setActiveTab] = useState<Tab>("notContacted");

  const { data, isLoading, refetch, isFetching } = useQuery<WorkList>({
    queryKey: ["isr-work-list"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/isr/work-list", { credentials: "include" });
      if (!r.ok) throw new Error("Veri yuklenemedi");
      return r.json();
    },
    staleTime: 60 * 1000,
  });

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count: number | undefined }> = [
    {
      id: "notContacted",
      label: "Kontak Olmayanlar",
      icon: <UserPlus className="h-4 w-4" />,
      count: data?.notContacted.length,
    },
    {
      id: "contacted",
      label: "Kontak Olanlar",
      icon: <Mail className="h-4 w-4" />,
      count: data?.contacted.length,
    },
    {
      id: "teaserSent",
      label: "Teaser Gonderilenler",
      icon: <Send className="h-4 w-4" />,
      count: data?.teaserSent.length,
    },
  ];

  return (
    <AdminLayout title="ISR Is Listesi">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">ISR Is Listesi</h1>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Qualified leadler — kontak bulma, teaser gonderme ve Copilot akisi
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""} sm:mr-1.5`} />
            <span className="hidden sm:inline">Yenile</span>
          </Button>
        </div>

        {/* KPI row */}
        {data && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {tabs.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-all border ${activeTab === t.id ? "bg-slate-800 border-slate-600" : "bg-slate-900/60 border-slate-800 hover:border-slate-700"}`}
                onClick={() => setActiveTab(t.id)}
              >
                <CardContent className="p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${
                    t.id === "notContacted" ? "bg-blue-500/20 text-blue-400" :
                    t.id === "contacted" ? "bg-violet-500/20 text-violet-400" :
                    "bg-emerald-500/20 text-emerald-400"
                  }`}>
                    {t.icon}
                  </div>
                  <div className="text-center sm:text-left min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-white leading-none">{t.count ?? "—"}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-tight">{t.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="flex border-b border-slate-800 min-w-max">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  activeTab === t.id
                    ? "border-blue-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.icon}
                {t.label}
                {t.count !== undefined && (
                  <Badge className={`text-[10px] h-4 px-1.5 ${
                    activeTab === t.id ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"
                  }`}>
                    {t.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Yukl&uuml;yor...</span>
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-slate-500 text-sm">Veri yuklenemedi</div>
        ) : (
          <>
            {activeTab === "notContacted" && <NotContactedTab leads={data.notContacted} />}
            {activeTab === "contacted" && <ContactedTab leads={data.contacted} />}
            {activeTab === "teaserSent" && <TeaserSentTab leads={data.teaserSent} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
