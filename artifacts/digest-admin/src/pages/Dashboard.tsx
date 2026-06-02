import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Stats {
  activeSources: number;
  totalNewsItems: number;
  totalDigests: number;
  latestDigest: {
    id: number;
    weekYear: number;
    weekNumber: number;
    status: string;
    createdAt: string;
  } | null;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Dashboard() {
  const qc = useQueryClient();
  const [collectMsg, setCollectMsg] = useState("");
  const [enrichMsg, setEnrichMsg] = useState("");
  const [generateMsg, setGenerateMsg] = useState("");

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["digest-stats"],
    queryFn: () => apiFetch("/api/digest/stats"),
    refetchInterval: 30000,
  });

  const collectMut = useMutation({
    mutationFn: () => apiFetch("/api/digest/collect", { method: "POST" }),
    onSuccess: () => {
      setCollectMsg("Haber toplama başlatıldı — birkaç dakika içinde tamamlanacak.");
      qc.invalidateQueries({ queryKey: ["digest-stats"] });
      setTimeout(() => setCollectMsg(""), 5000);
    },
  });

  const enrichMut = useMutation({
    mutationFn: () => apiFetch("/api/digest/enrich", { method: "POST" }),
    onSuccess: () => {
      setEnrichMsg("AI zenginleştirme başlatıldı — özet ve CVE çıkarma işleniyor...");
      setTimeout(() => setEnrichMsg(""), 8000);
    },
  });

  const generateMut = useMutation({
    mutationFn: () => apiFetch("/api/digest/generate", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      setGenerateMsg("Digest oluşturma başlatıldı — Claude AI işleniyor...");
      qc.invalidateQueries({ queryKey: ["digest-stats"] });
      setTimeout(() => setGenerateMsg(""), 8000);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Genel Bakis</h1>
        <p className="text-muted-foreground text-sm mt-1">Haftalik siber guvenlik digest yonetim paneli</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Aktif Kaynaklar</p>
            <p className="text-3xl font-bold text-foreground mt-1">{stats?.activeSources ?? 0}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Toplam Haber</p>
            <p className="text-3xl font-bold text-foreground mt-1">{stats?.totalNewsItems ?? 0}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Toplam Digest</p>
            <p className="text-3xl font-bold text-foreground mt-1">{stats?.totalDigests ?? 0}</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Son Digest Durumu</p>
            <p className="text-lg font-semibold text-foreground mt-1 capitalize">
              {stats?.latestDigest
                ? `H${stats.latestDigest.weekNumber}/${stats.latestDigest.weekYear} — ${stats.latestDigest.status}`
                : "—"}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-1">Haber Topla</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tum aktif RSS kaynaklarindan haber ceker ve veritabanina kaydeder.
            Otomatik olarak her gun 06:00'da calisir.
          </p>
          <button
            onClick={() => collectMut.mutate()}
            disabled={collectMut.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {collectMut.isPending ? "Calistirilıyor..." : "Simdi Topla"}
          </button>
          {collectMsg && <p className="text-sm text-green-600 mt-2">{collectMsg}</p>}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-1">AI Zenginlestir</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Toplanmis haberleri Claude AI ile isler: Turkce ozet uretir, CVE ID'lerini cikarir
            ve bulten icin skorlar. Otomatik 06:30'da calisir.
          </p>
          <button
            onClick={() => enrichMut.mutate()}
            disabled={enrichMut.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {enrichMut.isPending ? "Isleniyor..." : "Simdi Zenginlestir"}
          </button>
          {enrichMsg && <p className="text-sm text-purple-600 mt-2">{enrichMsg}</p>}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-1">Digest Olustur</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Bu haftanin haberlerini Claude AI ile analiz ederek 5 farkli icerik formati olusturur.
            Otomatik olarak her Cuma 07:00'da calisir.
          </p>
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {generateMut.isPending ? "Olusturuluyor..." : "Simdi Olustur"}
          </button>
          {generateMsg && <p className="text-sm text-blue-600 mt-2">{generateMsg}</p>}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-6">
        <h2 className="font-semibold text-foreground mb-3">Otomatik Zamanlama</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-muted-foreground">Her gun 06:00 (Istanbul) — RSS haber toplama (36 kaynak)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            <span className="text-muted-foreground">Her gun 06:30 (Istanbul) — Claude AI zenginlestirme (ozet + CVE)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            <span className="text-muted-foreground">Her Cuma 07:00 (Istanbul) — Claude AI digest olusturma</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            <span className="text-muted-foreground">Onay sonrasi — Admin e-posta bildirimi + webhook</span>
          </div>
        </div>
      </div>
    </div>
  );
}
