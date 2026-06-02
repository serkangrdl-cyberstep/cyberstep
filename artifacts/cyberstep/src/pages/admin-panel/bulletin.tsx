import { useState } from "react";
import { AdminLayout } from "../../components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function adminFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

interface Bulletin {
  id: number;
  weekNumber: number;
  year: number;
  weekSlug: string;
  status: string;
  headline: string | null;
  introText: string | null;
  threatRadar: string | null;
  turkeyData: string | null;
  regulationSection: string | null;
  weeklyTip: string | null;
  toolResource: string | null;
  emailSubject: string | null;
  emailHtml: string | null;
  linkedinMiniPost: string | null;
  recipientCount: number;
  sentAt: string | null;
  totalScansThisWeek: number | null;
  newCriticalCves: number | null;
  topFindingType: string | null;
  notableSector: string | null;
  createdAt: string;
}

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  source: string | null;
  lastOpenedAt: string | null;
  engagementScore: number;
  isActive: boolean;
  subscribedAt: string;
}

interface Stats { totalSubscribers: number; newThisWeek: number; totalSent: number; }

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft:   { label: "Taslak",           variant: "secondary" },
  review:  { label: "Onay Bekliyor",    variant: "default" },
  sent:    { label: "Gönderildi",       variant: "outline" },
  skipped: { label: "Atlandı",          variant: "destructive" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

function BulletinDetailEditor({ bulletin, onClose }: { bulletin: Bulletin; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    headline: bulletin.headline ?? "",
    introText: bulletin.introText ?? "",
    threatRadar: bulletin.threatRadar ?? "",
    turkeyData: bulletin.turkeyData ?? "",
    regulationSection: bulletin.regulationSection ?? "",
    weeklyTip: bulletin.weeklyTip ?? "",
    toolResource: bulletin.toolResource ?? "",
    emailSubject: bulletin.emailSubject ?? "",
  });
  const [testEmail, setTestEmail] = useState("");
  const [showHtml, setShowHtml] = useState(false);

  const saveMut = useMutation({
    mutationFn: () => adminFetch(`/api/admin-panel/bulletin/${bulletin.id}`, { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulletin-list"] }),
  });

  const sendMut = useMutation({
    mutationFn: () => adminFetch(`/api/admin-panel/bulletin/${bulletin.id}/send`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bulletin-list"] }); onClose(); },
  });

  const testMut = useMutation({
    mutationFn: () => adminFetch(`/api/admin-panel/bulletin/${bulletin.id}/send-test`, {
      method: "POST", body: JSON.stringify({ email: testEmail }),
    }),
  });

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-auto p-4">
      <div className="max-w-3xl mx-auto bg-[#060D1A] border border-[#111F35] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">
            Hafta {bulletin.weekNumber}/{bulletin.year} — Düzenle
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Kapat</Button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-400">E-posta Konusu</Label>
          <Input value={form.emailSubject} onChange={f("emailSubject")} className="bg-[#0A1020] border-[#1A2A40]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Başlık</Label>
          <Input value={form.headline} onChange={f("headline")} className="bg-[#0A1020] border-[#1A2A40]" />
        </div>

        {(["introText", "threatRadar", "turkeyData", "regulationSection", "weeklyTip", "toolResource"] as const).map(k => (
          <div key={k} className="space-y-1">
            <Label className="text-xs text-slate-400">
              {k === "introText" ? "Giriş" : k === "threatRadar" ? "Tehdit Radarında" :
               k === "turkeyData" ? "Türkiye Verisi" : k === "regulationSection" ? "Mevzuat" :
               k === "weeklyTip" ? "Bu Hafta Yapın" : "Araç / Kaynak"}
            </Label>
            <Textarea value={form[k]} onChange={f(k)} rows={3} className="bg-[#0A1020] border-[#1A2A40] text-sm" />
          </div>
        ))}

        {bulletin.emailHtml && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setShowHtml(v => !v)} className="text-xs">
              {showHtml ? "HTML Gizle" : "HTML Önizle"}
            </Button>
            {showHtml && (
              <iframe
                srcDoc={bulletin.emailHtml}
                className="w-full h-[500px] border border-[#1A2A40] rounded mt-2"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-[#111F35]">
          <Input
            placeholder="Test e-posta adresi"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            className="bg-[#0A1020] border-[#1A2A40] w-56"
          />
          <Button variant="outline" size="sm" onClick={() => testMut.mutate()} disabled={!testEmail || testMut.isPending}>
            {testMut.isPending ? "Gönderiliyor..." : "Test Gönder"}
          </Button>
          {testMut.isSuccess && <span className="text-xs text-green-400">Test gönderildi</span>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          {bulletin.status === "review" && (
            <Button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending}
              className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
            >
              {sendMut.isPending ? "Gönderiliyor..." : "Onayla ve Gönder"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminBulletin() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Bulletin | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: bulletins = [] } = useQuery<Bulletin[]>({
    queryKey: ["bulletin-list"],
    queryFn: () => adminFetch("/api/admin-panel/bulletin/list"),
    refetchInterval: 10000,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["bulletin-stats"],
    queryFn: () => adminFetch("/api/admin-panel/bulletin/stats"),
  });

  const { data: subscribers = [] } = useQuery<Subscriber[]>({
    queryKey: ["bulletin-subscribers"],
    queryFn: () => adminFetch("/api/admin-panel/bulletin/subscribers"),
  });

  async function handleGenerate() {
    setGenerating(true);
    try {
      await adminFetch("/api/admin-panel/bulletin/generate", { method: "POST" });
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["bulletin-list"] }); setGenerating(false); }, 3000);
    } catch (e) {
      alert(String(e));
      setGenerating(false);
    }
  }

  return (
    <AdminLayout title="Haftalık Bülten">
      {selected && <BulletinDetailEditor bulletin={selected} onClose={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["bulletin-list"] }); }} />}

      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-200">CISO Haftalık Bülten</h1>
            <p className="text-sm text-slate-400 mt-1">Haftalık istihbarat bülteni yönetimi</p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#00C8FF] text-[#060D1A] hover:bg-[#00A8D8]"
          >
            {generating ? "Üretiliyor..." : "Bu Hafta Üret"}
          </Button>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Toplam Abone", value: stats?.totalSubscribers ?? "—" },
            { label: "Bu Hafta Yeni", value: stats?.newThisWeek ?? "—" },
            { label: "Gönderilen Bülten", value: stats?.totalSent ?? "—" },
          ].map(s => (
            <Card key={s.label} className="bg-[#060D1A] border-[#111F35]">
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-[#00C8FF]">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="bulletins">
          <TabsList className="bg-[#060D1A] border border-[#111F35]">
            <TabsTrigger value="bulletins">Bültenler</TabsTrigger>
            <TabsTrigger value="subscribers">Abone Listesi</TabsTrigger>
          </TabsList>

          <TabsContent value="bulletins" className="mt-4">
            <Card className="bg-[#060D1A] border-[#111F35]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Son Bültenler</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#111F35]">
                      <TableHead className="text-slate-400">Hafta</TableHead>
                      <TableHead className="text-slate-400">Başlık</TableHead>
                      <TableHead className="text-slate-400">Durum</TableHead>
                      <TableHead className="text-slate-400">Alıcı</TableHead>
                      <TableHead className="text-slate-400">Tarih</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulletins.map(b => {
                      const s = STATUS_MAP[b.status] ?? { label: b.status, variant: "secondary" as const };
                      return (
                        <TableRow key={b.id} className="border-[#111F35]">
                          <TableCell className="text-slate-300 font-mono text-sm">H{b.weekNumber}/{b.year}</TableCell>
                          <TableCell className="text-slate-300 max-w-[220px] truncate">{b.headline ?? "—"}</TableCell>
                          <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                          <TableCell className="text-slate-400">{b.recipientCount}</TableCell>
                          <TableCell className="text-slate-400 text-sm">{fmtDate(b.sentAt ?? b.createdAt)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => setSelected(b)} className="text-[#00C8FF]">
                              Düzenle
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {bulletins.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Henüz bülten yok</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscribers" className="mt-4">
            <Card className="bg-[#060D1A] border-[#111F35]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Abone Listesi ({subscribers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#111F35]">
                      <TableHead className="text-slate-400">E-posta</TableHead>
                      <TableHead className="text-slate-400">Isim</TableHead>
                      <TableHead className="text-slate-400">Sirket</TableHead>
                      <TableHead className="text-slate-400">Kaynak</TableHead>
                      <TableHead className="text-slate-400">Skor</TableHead>
                      <TableHead className="text-slate-400">Abone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map(s => (
                      <TableRow key={s.id} className="border-[#111F35]">
                        <TableCell className="text-slate-300 text-sm font-mono">{s.email}</TableCell>
                        <TableCell className="text-slate-300 text-sm">{s.name ?? "—"}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{s.company ?? "—"}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{s.source ?? "website"}</TableCell>
                        <TableCell>
                          <Badge variant={s.engagementScore >= 70 ? "default" : "secondary"}>
                            {s.engagementScore}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{fmtDate(s.subscribedAt)}</TableCell>
                      </TableRow>
                    ))}
                    {subscribers.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Henüz abone yok</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
