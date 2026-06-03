import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, RotateCcw, Send, Plus, Calendar,
  Linkedin, Instagram, Twitter, FileText, Sparkles, Clock,
} from "lucide-react";

interface SocialPost {
  id: number;
  platform: string;
  postType: string;
  scheduledDate: string;
  caption: string | null;
  hashtags: string[] | null;
  imageSvg: string | null;
  status: string;
  revisionCount: number;
  createdAt: string;
}

interface CalendarEntry {
  id: number;
  weekStart: string;
  status: string;
  totalPosts: number;
  approvedPosts: number;
  publishedPosts: number;
  generatedAt: string | null;
}

interface SocialStats {
  total: number;
  pending: number;
  approved: number;
  published: number;
}

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  linkedin:  <Linkedin className="h-4 w-4 text-[#0077B5]" />,
  instagram: <Instagram className="h-4 w-4 text-[#E4405F]" />,
  x:         <Twitter className="h-4 w-4 text-slate-200" />,
};

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", instagram: "Instagram", x: "X",
};

const POST_TYPE_LABEL: Record<string, string> = {
  data_insight: "Veri Insight", special_day: "Ozel Gun",
  security_tip: "Guvenlik Ipucu", cve_alert: "CVE Alert",
  spontaneous: "Spontane", standard: "Standart",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Taslak",   cls: "bg-slate-700 text-slate-300 border-slate-600" },
  approved: { label: "Onaylı",   cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Reddedildi", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  published:{ label: "Yayınlandı", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

function adminFetch(url: string, opts?: RequestInit) {
  return fetch(url, { credentials: "include", ...opts });
}

function PostCard({ post, onRefresh }: { post: SocialPost; onRefresh: () => void }) {
  const { toast } = useToast();
  const [reviseNote, setReviseNote] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (action: "approve" | "reject" | "publish") => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/social/posts/${post.id}/${action}`, { method: "POST" });
      toast({ title: action === "approve" ? "Onaylandı" : action === "reject" ? "Reddedildi" : "Yayınlandı" });
      onRefresh();
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const sendRevision = async () => {
    if (!reviseNote.trim()) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/social/posts/${post.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNote: reviseNote }),
      });
      toast({ title: "Revizyon isteği gönderildi" });
      setReviseNote(""); setShowRevise(false);
      setTimeout(onRefresh, 4000);
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const sb = STATUS_BADGE[post.status] ?? STATUS_BADGE["draft"];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {PLATFORM_ICON[post.platform] ?? <FileText className="h-4 w-4" />}
          <span className="text-white font-medium text-sm">{PLATFORM_LABEL[post.platform] ?? post.platform}</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-600 text-slate-400">
            {POST_TYPE_LABEL[post.postType] ?? post.postType}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-xs px-2 py-0 ${sb.cls}`}>{sb.label}</Badge>
          {post.scheduledDate && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" />{post.scheduledDate}
            </span>
          )}
        </div>
      </div>

      {post.imageSvg && (
        <div className="rounded-lg overflow-hidden border border-slate-700 max-h-48"
          dangerouslySetInnerHTML={{ __html: post.imageSvg }}
          style={{ lineHeight: 0 }}
        />
      )}

      {post.caption && (
        <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{post.caption}</p>
      )}
      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-blue-400/70 text-xs">{post.hashtags.join(" ")}</p>
      )}

      {post.status === "draft" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => act("approve")} disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-3">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Onayla
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowRevise(!showRevise)} disabled={busy}
            className="border-amber-700 text-amber-400 hover:bg-amber-900/20 text-xs h-7 px-3">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />Yeniden Yaz
          </Button>
          <Button size="sm" variant="outline" onClick={() => act("reject")} disabled={busy}
            className="border-red-800 text-red-400 hover:bg-red-900/20 text-xs h-7 px-3">
            <XCircle className="h-3.5 w-3.5 mr-1" />Reddet
          </Button>
        </div>
      )}

      {post.status === "approved" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => act("publish")} disabled={busy}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7 px-3">
            <Send className="h-3.5 w-3.5 mr-1" />Yayınla
          </Button>
        </div>
      )}

      {showRevise && (
        <div className="space-y-2 pt-1">
          <Textarea
            value={reviseNote}
            onChange={e => setReviseNote(e.target.value)}
            placeholder="Düzeltme notu: örn. 'Daha çarpıcı yaz, ilk cümle dikkat çeksin'"
            className="bg-slate-900 border-slate-600 text-white text-xs resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={sendRevision} disabled={busy || !reviseNote.trim()}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 px-3">
              Gönder
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRevise(false)}
              className="border-slate-600 text-slate-400 text-xs h-7 px-3">
              İptal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSosyalMedya() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekInput, setWeekInput] = useState("");
  const [spontPlatform, setSpontPlatform] = useState<"linkedin" | "instagram" | "x">("linkedin");
  const [spontTopic, setSpontTopic] = useState("");
  const [spontNotes, setSpontNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["social-posts"] });
    qc.invalidateQueries({ queryKey: ["social-stats"] });
    qc.invalidateQueries({ queryKey: ["social-calendar"] });
  };

  const { data: stats } = useQuery<SocialStats>({
    queryKey: ["social-stats"],
    queryFn: () => adminFetch("/api/admin/social/stats").then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: posts, isLoading: postsLoading } = useQuery<SocialPost[]>({
    queryKey: ["social-posts", "pending"],
    queryFn: () => adminFetch("/api/admin/social/posts/pending").then(r => r.json()),
    refetchInterval: 8000,
  });

  const { data: calendar } = useQuery<CalendarEntry[]>({
    queryKey: ["social-calendar"],
    queryFn: () => adminFetch("/api/admin/social/calendar").then(r => r.json()),
    refetchInterval: 30000,
  });

  const filteredPosts = platformFilter === "all"
    ? posts
    : posts?.filter(p => p.platform === platformFilter);

  const generateWeek = async () => {
    if (!weekInput) { toast({ title: "Tarih girin (YYYY-MM-DD)", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      await adminFetch("/api/admin/social/generate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekInput }),
      });
      toast({ title: "İçerik üretimi başladı. Birkaç dakika bekleyin." });
      setTimeout(invalidate, 5000);
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const generateSpontaneous = async () => {
    if (!spontTopic.trim()) { toast({ title: "Konu girin", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      await adminFetch("/api/admin/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: spontPlatform, topic: spontTopic, notes: spontNotes }),
      });
      toast({ title: "Spontane içerik üretiliyor..." });
      setSpontTopic(""); setSpontNotes("");
      setTimeout(invalidate, 5000);
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  return (
    <AdminLayout title="Sosyal Medya Icerik Yonetimi" description="Claude Haiku ile haftalik icerik uretimi, onay ve yayin.">
      {/* İstatistik */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Post", val: stats?.total ?? 0, cls: "text-slate-300" },
          { label: "Taslak", val: stats?.pending ?? 0, cls: "text-amber-400" },
          { label: "Onaylı", val: stats?.approved ?? 0, cls: "text-emerald-400" },
          { label: "Yayınlandı", val: stats?.published ?? 0, cls: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.cls}`}>{s.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="bg-slate-800 border border-slate-700 mb-6">
          <TabsTrigger value="pending" className="data-[state=active]:bg-slate-700">
            Bekleyenler {stats?.pending ? <Badge variant="outline" className="ml-1 text-xs px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">{stats.pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-slate-700">Takvim</TabsTrigger>
          <TabsTrigger value="generate" className="data-[state=active]:bg-slate-700">Uret</TabsTrigger>
        </TabsList>

        {/* ─── BEKLEYENLER ─── */}
        <TabsContent value="pending">
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "linkedin", "instagram", "x"].map(p => (
              <Button
                key={p}
                size="sm"
                variant={platformFilter === p ? "default" : "outline"}
                onClick={() => setPlatformFilter(p)}
                className={`text-xs h-7 px-3 ${platformFilter === p ? "bg-blue-600 hover:bg-blue-500" : "border-slate-600 text-slate-400 hover:bg-slate-700"}`}
              >
                {p === "all" ? "Tümü" : PLATFORM_LABEL[p]}
              </Button>
            ))}
          </div>

          {postsLoading && (
            <div className="text-slate-400 text-sm py-8 text-center">
              <Clock className="h-5 w-5 animate-spin mx-auto mb-2" />
              Yükleniyor...
            </div>
          )}

          {!postsLoading && filteredPosts?.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
              Bekleyen içerik yok. "Üret" sekmesinden haftalık içerik üretin.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPosts?.map(post => (
              <PostCard key={post.id} post={post} onRefresh={invalidate} />
            ))}
          </div>
        </TabsContent>

        {/* ─── TAKVİM ─── */}
        <TabsContent value="calendar">
          <div className="space-y-3">
            {calendar?.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
                Henüz takvim yok. "Üret" sekmesinden başlayın.
              </div>
            )}
            {calendar?.map(c => (
              <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-white font-medium text-sm">Hafta: {c.weekStart}</span>
                    <Badge variant="outline" className={`text-xs px-2 py-0 ${
                      c.status === "generated" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                      c.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                      "bg-slate-700 text-slate-400 border-slate-600"
                    }`}>{c.status}</Badge>
                  </div>
                  <div className="text-xs text-slate-400 flex gap-4">
                    <span>Toplam: <b className="text-white">{c.totalPosts}</b></span>
                    <span>Onaylı: <b className="text-emerald-400">{c.approvedPosts}</b></span>
                    <span>Yayında: <b className="text-blue-400">{c.publishedPosts}</b></span>
                  </div>
                </div>
                {c.generatedAt && (
                  <p className="text-xs text-slate-600 mt-1">
                    Üretildi: {new Date(c.generatedAt).toLocaleString("tr-TR")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── ÜRET ─── */}
        <TabsContent value="generate">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Haftalık üretim */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Haftalık İçerik Üret
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-sm">
                  Belirtilen haftanın Pazartesi tarihi için LinkedIn, Instagram ve X platformlarına
                  otomatik içerik üretilir (12 post, ~2 dakika).
                </p>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hafta Başlangıcı (Pazartesi)</label>
                  <Input
                    type="date"
                    value={weekInput}
                    onChange={e => setWeekInput(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <Button onClick={generateWeek} disabled={generating}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white">
                  {generating ? "Üretiliyor..." : "Haftalık İçerik Üret"}
                </Button>
              </CardContent>
            </Card>

            {/* Spontane */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-400" />
                  Spontane İçerik
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-sm">
                  Anlık konu için hızlı içerik üretimi (~30 saniye).
                </p>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Platform</label>
                  <select
                    value={spontPlatform}
                    onChange={e => setSpontPlatform(e.target.value as typeof spontPlatform)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-white"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                    <option value="x">X (Twitter)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Konu</label>
                  <Input
                    value={spontTopic}
                    onChange={e => setSpontTopic(e.target.value)}
                    placeholder="örn. Türkiye'de RDP güvenlik riski"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Ek Notlar (isteğe bağlı)</label>
                  <Textarea
                    value={spontNotes}
                    onChange={e => setSpontNotes(e.target.value)}
                    placeholder="İçerik yönlendirmesi..."
                    className="bg-slate-900 border-slate-600 text-white resize-none"
                    rows={2}
                  />
                </div>
                <Button onClick={generateSpontaneous} disabled={generating || !spontTopic.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                  {generating ? "Üretiliyor..." : "Claude'dan İçerik İste"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-sm text-slate-400">
            <b className="text-slate-300">Not:</b> İçerik üretimi arka planda çalışır. Tamamlandığında "Bekleyenler" sekmesinde görünür.
            Haftalık maliyet: ~$0.05 (claude-haiku-4-5).
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
