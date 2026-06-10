import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DigestDashboard {
  pipeline: {
    newsTotal: number;
    newsTurkeyTotal: number;
    newsLast7d: number;
    enriched: number;
    pendingEnrichment: number;
    lastCollectAt: string | null;
  };
  thisWeek: {
    weekNumber: number;
    weekYear: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  recentDigests: Array<{
    id: number;
    weekNumber: number;
    weekYear: number;
    status: string;
    createdAt: string;
    approvedAt: string | null;
    sentAt: string | null;
  }>;
  recentBulletins: Array<{
    id: number;
    weekNumber: number;
    year: number;
    status: string;
    sentAt: string | null;
    recipientCount: number | null;
    openRate: number | null;
    clickRate: number | null;
    createdAt: string;
  }>;
  subscribers: {
    total: number;
    digestSubs: number;
    blogSubs: number;
    newLast30d: number;
    churnedLast30d: number;
  };
}

interface Stats {
  activeSources: number;
  totalNewsItems: number;
  totalDigests: number;
  latestDigest: { id: number; weekYear: number; weekNumber: number; status: string; createdAt: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak", approved: "Onaylandı", sent: "Gönderildi",
  pending: "Bekliyor", generating: "Oluşturuluyor",
};

const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-700 text-slate-300",
  approved: "bg-blue-700/60 text-blue-300",
  sent: "bg-green-700/60 text-green-300",
  pending: "bg-yellow-700/60 text-yellow-300",
  generating: "bg-purple-700/60 text-purple-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[status] ?? "bg-slate-700 text-slate-300"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── Pipeline adımı ───────────────────────────────────────────────────────────

function PipelineStep({
  label, value, sub, color = "bg-primary", active = false,
}: { label: string; value: number | string; sub?: string; color?: string; active?: boolean }) {
  return (
    <div className={`flex-1 rounded-xl border p-3 text-center transition-all ${active ? "border-primary/60 bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      <div className={`mt-2 h-1 rounded-full ${color} opacity-60`} />
    </div>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ type: "collect" | "enrich" | "generate"; text: string } | null>(null);

  const dashQ = useQuery<DigestDashboard>({
    queryKey: ["digest-dashboard"],
    queryFn: () => apiFetch("/api/digest/dashboard"),
    refetchInterval: 60_000,
  });

  const statsQ = useQuery<Stats>({
    queryKey: ["digest-stats"],
    queryFn: () => apiFetch("/api/digest/stats"),
    refetchInterval: 60_000,
  });

  const notify = (type: "collect" | "enrich" | "generate", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 8_000);
  };

  const collectMut = useMutation({
    mutationFn: () => apiFetch("/api/digest/collect", { method: "POST" }),
    onSuccess: () => { notify("collect", "Haber toplama başlatıldı — birkaç dakika içinde tamamlanacak."); qc.invalidateQueries({ queryKey: ["digest-dashboard"] }); },
  });
  const enrichMut = useMutation({
    mutationFn: () => apiFetch("/api/digest/enrich", { method: "POST" }),
    onSuccess: () => notify("enrich", "AI zenginleştirme başlatıldı — özet ve CVE çıkarma işleniyor..."),
  });
  const generateMut = useMutation({
    mutationFn: () => apiFetch("/api/digest/generate", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { notify("generate", "Digest oluşturma başlatıldı — Claude AI işleniyor..."); qc.invalidateQueries({ queryKey: ["digest-dashboard"] }); },
  });

  const d = dashQ.data;
  const s = statsQ.data;
  const isLoading = dashQ.isLoading;

  // Zenginleştirme yüzdesi
  const enrichPct = d ? Math.round((d.pipeline.enriched / Math.max(d.pipeline.newsTotal, 1)) * 100) : 0;

  return (
    <div className="space-y-8">

      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pazarlama Merkezi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Digest, bülten ve içerik hattı — gerçek zamanlı operasyon özeti
        </p>
      </div>

      {/* ── Haber Toplama Pipeline ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-0.5 h-4 bg-primary rounded-full" />
          <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">İçerik Hattı</h2>
          {d && (
            <span className="text-xs text-muted-foreground">
              {s?.activeSources ?? "?"} aktif kaynak · son toplama {timeAgo(d.pipeline.lastCollectAt)}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        ) : (
          <div className="flex gap-3">
            <PipelineStep label="Toplam Haber"     value={d?.pipeline.newsTotal ?? 0}         sub="veritabanında"   color="bg-slate-500" />
            <PipelineStep label="Türkiye İlgili"   value={d?.pipeline.newsTurkeyTotal ?? 0}   sub="TR filtreli"     color="bg-blue-500"  />
            <PipelineStep label="Son 7 Gün"         value={d?.pipeline.newsLast7d ?? 0}        sub="yeni haber"      color="bg-primary"    active />
            <PipelineStep label="Zenginleştirilen"  value={d?.pipeline.enriched ?? 0}          sub={`%${enrichPct} tamamlandı`} color="bg-purple-500" />
            <PipelineStep label="Zenginleştirme Bekliyor" value={d?.pipeline.pendingEnrichment ?? 0} sub="TR filtreli" color={d?.pipeline.pendingEnrichment ? "bg-orange-500" : "bg-emerald-500"} />
          </div>
        )}

        {/* Pipeline progress bar */}
        {d && d.pipeline.newsTotal > 0 && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 flex items-center gap-4">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500 transition-all"
                style={{ width: `${enrichPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {enrichPct}% zenginleştirme tamamlandı
            </span>
          </div>
        )}
      </section>

      {/* ── Hızlı Aksiyonlar ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-0.5 h-4 bg-primary rounded-full" />
          <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Hızlı Aksiyonlar</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="font-semibold text-foreground text-sm">Haber Topla</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Aktif RSS kaynaklarından haberleri çeker. Her gün 06:00'da otomatik çalışır.</p>
            <button
              onClick={() => collectMut.mutate()}
              disabled={collectMut.isPending}
              className="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors"
            >
              {collectMut.isPending ? "Çalışıyor..." : "Şimdi Topla"}
            </button>
            {msg?.type === "collect" && <p className="text-xs text-emerald-400 mt-2">{msg.text}</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <h3 className="font-semibold text-foreground text-sm">AI Zenginleştir</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Claude AI ile Türkçe özet üretir, CVE ID çıkarır. Her gün 06:30'da otomatik.</p>
            <button
              onClick={() => enrichMut.mutate()}
              disabled={enrichMut.isPending}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-purple-700 transition-colors"
            >
              {enrichMut.isPending ? "İşleniyor..." : "Şimdi Zenginleştir"}
            </button>
            {msg?.type === "enrich" && <p className="text-xs text-purple-400 mt-2">{msg.text}</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-foreground text-sm">Digest Oluştur</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Bu haftanın haberlerini analiz edip 5 format oluşturur. Her Cuma 07:00'da otomatik.</p>
            <button
              onClick={() => generateMut.mutate()}
              disabled={generateMut.isPending}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {generateMut.isPending ? "Oluşturuluyor..." : "Şimdi Oluştur"}
            </button>
            {msg?.type === "generate" && <p className="text-xs text-blue-400 mt-2">{msg.text}</p>}
          </div>
        </div>
      </section>

      {/* ── Bu Hafta + Digest Geçmişi ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bu hafta kategori breakdown */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-0.5 h-4 bg-primary rounded-full" />
            <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Bu Hafta</h2>
            {d && <span className="text-xs text-muted-foreground">Hafta {d.thisWeek.weekNumber}/{d.thisWeek.weekYear}</span>}
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {isLoading ? (
              <div className="h-48 animate-pulse bg-muted/20" />
            ) : d?.thisWeek.byCategory.length ? (
              <div className="divide-y divide-border">
                {d.thisWeek.byCategory.map((cat, i) => {
                  const max = d.thisWeek.byCategory[0]?.count ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                      <span className="text-sm text-foreground flex-1">{cat.category}</span>
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(cat.count / max * 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground w-5 text-right">{cat.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">Bu hafta henüz haber yok</div>
            )}
          </div>
        </section>

        {/* Son 5 digest */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-4 bg-primary rounded-full" />
              <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Son Digestler</h2>
            </div>
            <a href="/digests" className="text-xs text-muted-foreground hover:text-primary transition-colors">Tümünü gör</a>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {isLoading ? (
              <div className="h-48 animate-pulse bg-muted/20" />
            ) : d?.recentDigests.length ? (
              <div className="divide-y divide-border">
                {d.recentDigests.map(dg => (
                  <a key={dg.id} href={`/digests/${dg.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">H{dg.weekNumber}/{dg.weekYear}</span>
                        <StatusBadge status={dg.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {dg.sentAt ? `Gönderildi: ${fmtDate(dg.sentAt)}` : dg.approvedAt ? `Onaylandı: ${fmtDate(dg.approvedAt)}` : `Oluşturuldu: ${fmtDate(dg.createdAt)}`}
                      </div>
                    </div>
                    <span className="text-muted-foreground group-hover:text-primary text-xs transition-colors">→</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">Henüz digest yok</div>
            )}
          </div>
        </section>
      </div>

      {/* ── Bülten Geçmişi ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-0.5 h-4 bg-primary rounded-full" />
          <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Son Bültenler</h2>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Hafta</th>
                <th className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">Durum</th>
                <th className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">Alıcı</th>
                <th className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">Açılma</th>
                <th className="text-center px-4 py-2.5 text-xs text-muted-foreground font-medium">Tıklama</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Gönderildi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Yükleniyor...</td></tr>
              ) : d?.recentBulletins.length ? (
                d.recentBulletins.map(b => (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">H{b.weekNumber}/{b.year}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-center text-foreground">{b.recipientCount?.toLocaleString("tr-TR") ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {b.openRate != null
                        ? <span className={`font-bold ${b.openRate >= 30 ? "text-emerald-400" : b.openRate >= 20 ? "text-yellow-400" : "text-red-400"}`}>{b.openRate.toFixed(1)}%</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {b.clickRate != null
                        ? <span className="text-primary font-bold">{b.clickRate.toFixed(1)}%</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{b.sentAt ? fmtDate(b.sentAt) : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Bülten bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Abone Metrikleri ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-0.5 h-4 bg-primary rounded-full" />
          <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Abone Metrikleri</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Toplam Aktif",    value: d?.subscribers.total ?? 0,          highlight: true },
            { label: "Digest Abonesi",  value: d?.subscribers.digestSubs ?? 0,     highlight: false },
            { label: "Blog Abonesi",    value: d?.subscribers.blogSubs ?? 0,       highlight: false },
            { label: "Son 30g Yeni",    value: `+${d?.subscribers.newLast30d ?? 0}`,  highlight: (d?.subscribers.newLast30d ?? 0) > 0 },
            { label: "Son 30g Çıkış",   value: d?.subscribers.churnedLast30d ?? 0, warn: (d?.subscribers.churnedLast30d ?? 0) > 5 },
          ].map((t, i) => (
            <div key={i} className={`rounded-xl border p-4 ${
              "warn" in t && t.warn ? "border-red-800 bg-red-950/20" :
              t.highlight ? "border-primary/40 bg-primary/5" :
              "border-border bg-card"
            }`}>
              <div className="text-xs text-muted-foreground mb-1">{t.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${"warn" in t && t.warn ? "text-red-400" : "text-foreground"}`}>{t.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Zamanlama ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-0.5 h-4 bg-primary rounded-full" />
          <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">Otomatik Zamanlama</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { color: "bg-emerald-500", text: "Her gün 06:00 (İstanbul) — RSS haber toplama" },
            { color: "bg-purple-500",  text: "Her gün 06:30 (İstanbul) — Claude AI zenginleştirme (özet + CVE)" },
            { color: "bg-blue-500",    text: "Her Cuma 07:00 (İstanbul) — Claude AI digest oluşturma" },
            { color: "bg-yellow-500",  text: "Onay sonrası — E-posta bildirimi + webhook" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
              <span className="text-sm text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
