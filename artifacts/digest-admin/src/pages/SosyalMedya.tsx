import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

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

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE()}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", instagram: "Instagram", x: "X (Twitter)",
};

const POST_TYPE_LABEL: Record<string, string> = {
  data_insight: "Veri Insight", special_day: "Ozel Gun",
  security_tip: "Guvenlik Ipucu", cve_alert: "CVE Alert",
  spontaneous: "Spontane", standard: "Standart",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: "Taslak",      cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    approved:  { label: "Onaylandi",   cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    rejected:  { label: "Reddedildi",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    published: { label: "Yayinlandi",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

function PostCard({ post, onRefresh }: { post: SocialPost; onRefresh: () => void }) {
  const [reviseNote, setReviseNote] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const act = async (action: "approve" | "reject" | "publish") => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/social/posts/${post.id}/${action}`, { method: "POST" });
      setActionMsg(action === "approve" ? "Onaylandi" : action === "reject" ? "Reddedildi" : "Yayinlandi");
      onRefresh();
    } catch {
      setActionMsg("Hata olustu");
    } finally { setBusy(false); }
  };

  const sendRevision = async () => {
    if (!reviseNote.trim()) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/social/posts/${post.id}/revise`, {
        method: "POST",
        body: JSON.stringify({ revisionNote: reviseNote }),
      });
      setActionMsg("Revizyon istegi gonderildi");
      setReviseNote(""); setShowRevise(false);
      setTimeout(onRefresh, 4000);
    } catch {
      setActionMsg("Hata olustu");
    } finally { setBusy(false); }
  };

  return (
    <div className="border border-border rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">{PLATFORM_LABEL[post.platform] ?? post.platform}</span>
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
            {POST_TYPE_LABEL[post.postType] ?? post.postType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          {post.scheduledDate && (
            <span className="text-xs text-muted-foreground">{post.scheduledDate}</span>
          )}
        </div>
      </div>

      {post.imageSvg && (
        <div className="rounded-lg overflow-hidden border border-border max-h-40"
          dangerouslySetInnerHTML={{ __html: post.imageSvg }}
          style={{ lineHeight: 0 }}
        />
      )}

      {post.caption && (
        <p className="text-foreground text-sm whitespace-pre-line leading-relaxed line-clamp-4">{post.caption}</p>
      )}
      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-primary/70 text-xs">{post.hashtags.join(" ")}</p>
      )}

      {actionMsg && (
        <p className="text-xs text-green-600 dark:text-green-400">{actionMsg}</p>
      )}

      {post.status === "draft" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act("approve")} disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50">
              Onayla
            </button>
            <button onClick={() => setShowRevise(!showRevise)} disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-600/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50">
              Yeniden Yaz
            </button>
            <button onClick={() => act("reject")} disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-600/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
              Reddet
            </button>
          </div>
          {showRevise && (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={2}
                placeholder="Revizyon notu (hangi degisiklik istiyorsunuz?)..."
                value={reviseNote}
                onChange={e => setReviseNote(e.target.value)}
              />
              <button onClick={sendRevision} disabled={busy || !reviseNote.trim()}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                Gonder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SosyalMedya() {
  const qc = useQueryClient();
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "published">("draft");
  const [genMsg, setGenMsg] = useState("");
  const [genBusy, setGenBusy] = useState(false);

  const { data: calendars = [] } = useQuery<CalendarEntry[]>({
    queryKey: ["digest-social-calendars"],
    queryFn: () => adminFetch("/api/admin/social/calendar"),
    refetchInterval: 30000,
  });

  const { data: allPosts = [], refetch: refetchPosts } = useQuery<SocialPost[]>({
    queryKey: ["digest-social-posts", activeWeek, filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (activeWeek !== null) params.set("calendarId", String(activeWeek));
      const data = await adminFetch(`/api/admin/social/posts?${params}`);
      return Array.isArray(data) ? data : (data.posts ?? []);
    },
    refetchInterval: 30000,
  });

  const generateWeekMut = useMutation({
    mutationFn: () => adminFetch("/api/admin/social/generate-week", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-social-calendars"] });
      qc.invalidateQueries({ queryKey: ["digest-social-posts"] });
      setGenMsg("Haftalik icerik uretimi baslatildi. Birkaç dakika icinde gozukecek.");
    },
    onError: () => setGenMsg("Hata olustu."),
  });

  const generateSpontaneous = async () => {
    setGenBusy(true);
    try {
      await adminFetch("/api/admin/social/generate", {
        method: "POST",
        body: JSON.stringify({ topic: "guncel siber guvenlik tehditleri" }),
      });
      setGenMsg("Spontane icerik uretildi. Listede gozukecek.");
      await refetchPosts();
    } catch {
      setGenMsg("Hata olustu.");
    } finally { setGenBusy(false); }
  };

  const selectedCal = calendars.find(c => c.id === activeWeek);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sosyal Medya</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI tarafindan olusturulan sosyal medya icerikleri — onayla, reddet veya yeniden yaz.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generateWeekMut.mutate()} disabled={generateWeekMut.isPending}
            className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {generateWeekMut.isPending ? "Uretiliyor..." : "Hafta Icerigi Uret"}
          </button>
          <button onClick={generateSpontaneous} disabled={genBusy}
            className="text-xs px-3 py-2 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors disabled:opacity-50">
            {genBusy ? "Uretiliyor..." : "Spontane Post"}
          </button>
        </div>
      </div>

      {genMsg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          {genMsg}
          <button onClick={() => setGenMsg("")} className="ml-3 underline text-xs">Kapat</button>
        </div>
      )}

      {calendars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Haftalik Takvim</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveWeek(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeWeek === null ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
              }`}>
              Tumu
            </button>
            {calendars.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => setActiveWeek(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeWeek === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                }`}>
                {c.weekStart ? format(new Date(c.weekStart), "d MMM", { locale: tr }) : `#${c.id}`}
                <span className="ml-1 opacity-60">({c.approvedPosts}/{c.totalPosts})</span>
              </button>
            ))}
          </div>
          {selectedCal && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Toplam: {selectedCal.totalPosts}</span>
              <span className="text-green-600 dark:text-green-400">Onaylandi: {selectedCal.approvedPosts}</span>
              <span className="text-blue-600 dark:text-blue-400">Yayinlandi: {selectedCal.publishedPosts}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {(["draft", "approved", "published", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
            }`}>
            {f === "draft" ? "Taslaklar" : f === "approved" ? "Onaylananlar" : f === "published" ? "Yayinlananlar" : "Tumu"}
          </button>
        ))}
      </div>

      {allPosts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>Bu filtrede icerik bulunamadi.</p>
          <p className="mt-1 text-xs">Icerik uretmek icin "Hafta Icerigi Uret" butonunu kullanin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allPosts.map(post => (
            <PostCard key={post.id} post={post} onRefresh={() => {
              qc.invalidateQueries({ queryKey: ["digest-social-posts"] });
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
