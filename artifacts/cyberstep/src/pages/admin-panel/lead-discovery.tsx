import { useState } from "react";
import { AdminLayout } from "../../components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/admin-panel";

interface Stats {
  total: number;
  pending: number;
  scanning: number;
  scanned: number;
  qualified: number;
  withContact: number;
  teaserReady: number;
  teaserSent: number;
  bySource: Array<{ source: string; count: number }>;
}

interface DiscoveryRun {
  id: number;
  source: string;
  runParams: Record<string, unknown>;
  status: string;
  totalFound: number;
  totalAdded: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface ShodanQuery {
  index: number;
  q: string;
  label: string;
  priority: number;
}

interface LeadCandidate {
  id: number;
  domain: string;
  companyName: string | null;
  sector: string | null;
  city: string | null;
  source: string;
  hasFortigate: boolean;
  scanStatus: string;
  riskScore: number | null;
  criticalFindings: number;
  findingHighlights: string[] | null;
  isQualified: boolean;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  teaserSubject: string | null;
  teaserBody: string | null;
  teaserGeneratedAt: string | null;
  teaserSentAt: string | null;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    scanning: "bg-blue-100 text-blue-700",
    scanned: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    disqualified: "bg-orange-100 text-orange-700",
  };
  const labels: Record<string, string> = {
    pending: "Bekliyor", scanning: "Taranıyor", scanned: "Tarandı",
    failed: "Hata", disqualified: "Elendi",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function runStatusBadge(status: string) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-700">Tamamlandı</Badge>;
  if (status === "running") return <Badge className="bg-blue-100 text-blue-700">Çalışıyor</Badge>;
  if (status === "failed") return <Badge className="bg-red-100 text-red-700">Hata</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

interface CertstreamStatusData {
  id: number;
  status: string;
  startedAt: string | null;
  lastCertAt: string | null;
  totalReceived: number;
  totalTrFound: number;
  totalQualified: number;
  queuePending: number;
  last24hReceived: number;
  totalQueued: number;
}

function CertstreamWidget() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cs, isLoading } = useQuery<CertstreamStatusData>({
    queryKey: ["certstream-status"],
    queryFn: () => fetch(`${BASE}/lead-discovery/certstream/status`).then((r) => r.json()),
    refetchInterval: 10_000,
  });

  const processQueue = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/lead-discovery/certstream/process`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "Queue işleme başlatıldı." });
      qc.invalidateQueries({ queryKey: ["certstream-status"] });
      qc.invalidateQueries({ queryKey: ["lead-discovery-stats"] });
    },
  });

  const secondsAgo = cs?.lastCertAt
    ? Math.round((Date.now() - new Date(cs.lastCertAt).getTime()) / 1000)
    : null;

  const isActive = cs?.status === "running";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Certstream Gercek Zamanli Lead Akisi</CardTitle>
            <CardDescription>
              7/24 SSL sertifika akisi. Her yeni Turk kurumsal SSL → otomatik lead adayi.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
            <span className={`text-sm font-medium ${isActive ? "text-green-700" : "text-gray-500"}`}>
              {isActive ? "Aktif" : "Durdu"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Yukleniyor...</div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Son sertifika",
                  value: secondsAgo != null
                    ? secondsAgo < 60 ? `${secondsAgo}s once` : `${Math.round(secondsAgo / 60)}dk once`
                    : "—",
                },
                { label: "Son 24s alınan", value: (cs?.last24hReceived ?? 0).toLocaleString("tr-TR") },
                { label: "Queue'da bekleyen", value: (cs?.queuePending ?? 0).toLocaleString("tr-TR") },
                { label: "Toplam alınan cert", value: (cs?.totalReceived ?? 0).toLocaleString("tr-TR") },
                { label: "TR domain bulundu", value: (cs?.totalTrFound ?? 0).toLocaleString("tr-TR") },
                { label: "Lead'e eklenen (toplam)", value: (cs?.totalQualified ?? 0).toLocaleString("tr-TR") },
              ].map((s) => (
                <div key={s.label} className="bg-muted/40 rounded-md px-3 py-2.5">
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 space-y-1">
              <div className="font-medium">Nasil calisir?</div>
              <ul className="text-xs space-y-0.5 list-disc list-inside text-blue-700">
                <li>certstream.calidog.io'dan dunya genelindeki SSL sertifika loglarini izler</li>
                <li>Turk domain (.tr) veya TR orglu sertifikalari tespit eder</li>
                <li>Subdomain analizi: erp/login/portal gibi kurumsal kalip ≥ 60 skor</li>
                <li>certstream_queue tablosuna buffer'lar (50 cert veya 30 saniyede bir toplu insert)</li>
                <li>Her saat cron ile queue → lead_candidates tablosuna tasir</li>
                <li>Var olan domain bulunursa cert_org ile sirket adini tamamlar</li>
              </ul>
            </div>

            {/* Action */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => processQueue.mutate()}
                disabled={processQueue.isPending || (cs?.queuePending ?? 0) === 0}
                variant="outline"
              >
                {processQueue.isPending ? "Isleniyor..." : `Queue Isimdi Isle (${cs?.queuePending ?? 0} bekleyen)`}
              </Button>
              <span className="text-xs text-muted-foreground">
                Otomatik: her saat isler. Manuel tetikleme de mumkun.
              </span>
            </div>

            {/* Certstream already running note */}
            <p className="text-xs text-muted-foreground border-t pt-3">
              Certstream baglantisi sunucu baslarken otomatik aktif olur (CT Monitor ozelligi ile paylasilir).
              Ayri bir baslatma/durdurma gerekmez.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminLeadDiscovery() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ─── crt.sh form state ───────────────────────────────────────────────────
  const [crtshTlds, setCrtshTlds] = useState<string[]>([".com.tr", ".net.tr"]);
  const [daysBack, setDaysBack] = useState(30);
  const [minScore, setMinScore] = useState(60);
  const [domainLimit, setDomainLimit] = useState(300);

  // ─── Shodan form state ───────────────────────────────────────────────────
  const [selectedShodanQueries, setSelectedShodanQueries] = useState<number[]>([0, 2, 4]);

  // ─── Results pagination ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [filterQualified, setFilterQualified] = useState(false);
  const [filterHasContact, setFilterHasContact] = useState(false);
  const [filterNotSent, setFilterNotSent] = useState(false);
  const [teaserPreview, setTeaserPreview] = useState<LeadCandidate | null>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<Stats>({
    queryKey: ["lead-discovery-stats"],
    queryFn: () => fetch(`${BASE}/lead-discovery/stats`).then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const { data: runs } = useQuery<DiscoveryRun[]>({
    queryKey: ["lead-discovery-runs"],
    queryFn: () => fetch(`${BASE}/lead-discovery/runs?limit=20`).then((r) => r.json()),
    refetchInterval: 10_000,
  });

  const { data: shodanQueries } = useQuery<ShodanQuery[]>({
    queryKey: ["shodan-queries"],
    queryFn: () => fetch(`${BASE}/lead-discovery/shodan/queries`).then((r) => r.json()),
  });

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery<{
    rows: LeadCandidate[]; total: number;
  }>({
    queryKey: ["lead-candidates", page, filterQualified, filterHasContact, filterNotSent],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filterHasContact) params.set("hasContact", "true");
      if (filterNotSent) params.set("notSent", "true");
      const url = filterQualified
        ? `${BASE}/lead-discovery/qualified?${params}`
        : `${BASE}/lead-discovery/candidates?${params}`;
      return fetch(url).then((r) => r.json());
    },
    refetchInterval: 15_000,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const startCrtsh = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        crtshTlds.map((query) =>
          fetch(`${BASE}/lead-discovery/crtsh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: `%${query}`, daysBack, minCorporateScore: minScore, limit: domainLimit }),
          }).then((r) => r.json())
        )
      );
      return results;
    },
    onSuccess: () => {
      toast({ description: "crt.sh taraması başlatıldı. Arka planda çalışıyor." });
      qc.invalidateQueries({ queryKey: ["lead-discovery-runs"] });
    },
  });

  const startShodan = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        selectedShodanQueries.map((queryIndex) =>
          fetch(`${BASE}/lead-discovery/shodan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queryIndex, maxResults: 100 }),
          }).then(async (r) => {
            const j = await r.json() as { error?: string };
            if (!r.ok) throw new Error(j.error ?? "Shodan hatası");
            return j;
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      toast({ description: "Shodan taraması başlatıldı." });
      qc.invalidateQueries({ queryKey: ["lead-discovery-runs"] });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", description: e.message });
    },
  });

  const startFull = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/lead-discovery/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useCrtsh: crtshTlds.length > 0,
          useShodan: selectedShodanQueries.length > 0,
          autoQualify: true,
          maxDomains: domainLimit,
          crtshQueries: crtshTlds.map((t) => `%${t}`),
          shodanQueryIndexes: selectedShodanQueries,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "Tam pipeline başlatıldı. 2-3 saat sürebilir." });
    },
  });

  const startQualify = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/lead-discovery/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "Kalifikasyon başlatıldı." });
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
    },
  });

  const generateTeaser = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}/teaser`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "Teaser üretimi başlatıldı." });
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
    },
  });

  const sendTeaser = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}/send-teaser`, { method: "POST" }).then(async (r) => {
        const j = await r.json() as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: () => {
      toast({ description: "Teaser gönderildi olarak işaretlendi." });
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
      qc.invalidateQueries({ queryKey: ["lead-discovery-stats"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const deleteCandidate = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
      qc.invalidateQueries({ queryKey: ["lead-discovery-stats"] });
    },
  });

  const TLD_OPTIONS = [".com.tr", ".net.tr", ".org.tr", ".edu.tr", ".bel.tr"];
  const DAYS_OPTIONS = [7, 14, 30, 60, 90];
  const SCORE_OPTIONS = [50, 60, 70, 80];
  const LIMIT_OPTIONS = [100, 200, 300, 500];

  return (
    <AdminLayout title="Lead Discovery">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Aday", value: stats?.total ?? 0 },
          { label: "Bekliyor", value: stats?.pending ?? 0 },
          { label: "Kalifikasyon Geçti", value: stats?.qualified ?? 0 },
          { label: "Teaser Hazır", value: stats?.teaserReady ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="crtsh">
        <TabsList className="mb-4">
          <TabsTrigger value="certstream">Certstream</TabsTrigger>
          <TabsTrigger value="crtsh">crt.sh</TabsTrigger>
          <TabsTrigger value="shodan">Shodan</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="results">Sonuclar</TabsTrigger>
          <TabsTrigger value="history">Gecmis</TabsTrigger>
        </TabsList>

        {/* ── CERTSTREAM TAB ───────────────────────────────────────────── */}
        <TabsContent value="certstream">
          <CertstreamWidget />
        </TabsContent>

        {/* ── crt.sh TAB ────────────────────────────────────────────────── */}
        <TabsContent value="crtsh">
          <Card>
            <CardHeader>
              <CardTitle>crt.sh SSL Sertifika Tarayici</CardTitle>
              <CardDescription>
                Ucretsiz, API key gerektirmez. Turkiye'deki kurumsal SSL sertifikalarini tarar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">TLD Secimi</Label>
                <div className="flex flex-wrap gap-3">
                  {TLD_OPTIONS.map((tld) => (
                    <label key={tld} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={crtshTlds.includes(tld)}
                        onCheckedChange={(v) => {
                          if (v) setCrtshTlds((p) => [...p, tld]);
                          else setCrtshTlds((p) => p.filter((x) => x !== tld));
                        }}
                      />
                      <span className="text-sm font-mono">{tld}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1 block">Son Kac Gun</Label>
                  <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} gun</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">Min Kurumsal Skor: {minScore}</Label>
                  <Select value={String(minScore)} onValueChange={(v) => setMinScore(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCORE_OPTIONS.map((s) => <SelectItem key={s} value={String(s)}>{s}+ (login/portal={'>'}=80, ERP=95)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">Maks Domain</Label>
                  <Select value={String(domainLimit)} onValueChange={(v) => setDomainLimit(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LIMIT_OPTIONS.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-muted/40 rounded-md p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1 text-foreground">Subdomain skor rehberi</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ["erp, sap", "95"], ["crm, sso", "90"], ["portal, intranet", "85"],
                    ["login, vpn", "80"], ["pos, payment", "80-85"], ["api, exchange", "65-70"],
                    ["mail, backup", "60-65"], ["www", "10"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-1">
                      <span className="font-mono text-xs">{k}</span>
                      <span className="text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => startCrtsh.mutate()}
                disabled={startCrtsh.isPending || crtshTlds.length === 0}
              >
                {startCrtsh.isPending ? "Baslatiliyor..." : "crt.sh Taramasini Basalt"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SHODAN TAB ────────────────────────────────────────────────── */}
        <TabsContent value="shodan">
          <Card>
            <CardHeader>
              <CardTitle>Shodan Ucretsiz Tarayici</CardTitle>
              <CardDescription>
                Ucretsiz API key: account.shodan.io → Kayit → API Key (2 dakika).
                Limit: 100 sonuc/sorgu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Hazir Sorgular</Label>
                <div className="space-y-2">
                  {(shodanQueries ?? []).map((q) => (
                    <label key={q.index} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-muted/40">
                      <Checkbox
                        checked={selectedShodanQueries.includes(q.index)}
                        onCheckedChange={(v) => {
                          if (v) setSelectedShodanQueries((p) => [...p, q.index]);
                          else setSelectedShodanQueries((p) => p.filter((x) => x !== q.index));
                        }}
                      />
                      <div>
                        <div className="text-sm font-medium">{q.label}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{q.q}</div>
                      </div>
                      <Badge variant="outline" className="ml-auto shrink-0">Oncelik {q.priority}</Badge>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => startShodan.mutate()}
                disabled={startShodan.isPending || selectedShodanQueries.length === 0}
              >
                {startShodan.isPending ? "Baslatiliyor..." : `Shodan Taramasini Basalt (${selectedShodanQueries.length} sorgu)`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PIPELINE TAB ─────────────────────────────────────────────── */}
        <TabsContent value="pipeline">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Tam Pipeline</CardTitle>
                <CardDescription>crt.sh + Shodan tarama → Kalifikasyon → Teaser uretimi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Bekleyen Aday", stats?.pending ?? 0],
                    ["Taranıyor", stats?.scanning ?? 0],
                    ["Tarandı", stats?.scanned ?? 0],
                    ["Gönderildi", stats?.teaserSent ?? 0],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="flex justify-between bg-muted/40 rounded px-3 py-2">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  onClick={() => startFull.mutate()}
                  disabled={startFull.isPending}
                >
                  {startFull.isPending ? "Baslatiliyor..." : "Tam Pipeline Basalt"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Tahmini sure: 2-3 saat (50 domain icin). Arka planda calisir.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sadece Kalifikasyon</CardTitle>
                <CardDescription>
                  Yeni tarama yapmadan bekleyen adaylari sira, qualify, teaser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/40 rounded-md p-3 text-sm">
                  <div className="font-medium mb-2">Kalifikasyon kriterleri</div>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• En az 1 kritik guvenlik acigi bulunmali</li>
                    <li>• Genel risk skoru ≥ 40/100</li>
                    <li>• Iletisim: Apollo → Hunter fallback</li>
                    <li>• Teaser: Claude AI ile kisisel e-posta</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => startQualify.mutate()}
                  disabled={startQualify.isPending}
                >
                  {startQualify.isPending ? "Calisıyor..." : "Kalifikasyonu Baslat (20 aday)"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── RESULTS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lead Adaylari</CardTitle>
                  <CardDescription>Toplam {candidatesData?.total ?? 0} kayit</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterQualified}
                      onCheckedChange={(v) => { setFilterQualified(!!v); setPage(1); }}
                    />
                    Sadece kalifikasyon geçenler
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterHasContact}
                      onCheckedChange={(v) => { setFilterHasContact(!!v); setPage(1); }}
                    />
                    İletişim var
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterNotSent}
                      onCheckedChange={(v) => { setFilterNotSent(!!v); setPage(1); }}
                    />
                    Gönderilmemiş
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {candidatesLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Yukleniyor...</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Kaynak</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">Risk</TableHead>
                        <TableHead className="text-right">Kritik</TableHead>
                        <TableHead>İletişim</TableHead>
                        <TableHead>Teaser</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(candidatesData?.rows ?? []).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{c.domain}</div>
                            {c.companyName && <div className="text-xs text-muted-foreground">{c.companyName}</div>}
                            {!!c.hasFortigate && <span className="text-xs text-orange-600 font-medium">FortiGate</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {c.source === "crtsh" ? "crt.sh" : "Shodan"}
                            </Badge>
                          </TableCell>
                          <TableCell>{statusBadge(c.scanStatus)}</TableCell>
                          <TableCell className="text-right">
                            {c.riskScore != null ? (
                              <span className={`font-bold ${c.riskScore >= 70 ? "text-red-600" : c.riskScore >= 40 ? "text-orange-500" : "text-gray-500"}`}>
                                {c.riskScore}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.criticalFindings > 0 ? (
                              <span className="text-red-600 font-bold">{c.criticalFindings}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {c.contactEmail ? (
                              <div>
                                <div className="text-xs font-medium">{c.contactName ?? c.contactEmail}</div>
                                <div className="text-xs text-muted-foreground">{c.contactTitle}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Yok</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {c.teaserSentAt ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">Gönderildi</Badge>
                            ) : c.teaserSubject ? (
                              <button
                                className="text-xs text-blue-600 underline hover:no-underline"
                                onClick={() => setTeaserPreview(c)}
                              >
                                Hazir (Önizle)
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {!c.teaserSubject && c.isQualified && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => generateTeaser.mutate(c.id)}
                                  disabled={generateTeaser.isPending}
                                >
                                  Teaser Uret
                                </Button>
                              )}
                              {!!c.teaserSubject && !c.teaserSentAt && c.contactEmail && (
                                <Button
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => sendTeaser.mutate(c.id)}
                                  disabled={sendTeaser.isPending}
                                >
                                  Gönder
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 text-red-500 hover:text-red-700"
                                onClick={() => { if (confirm("Aday silinsin mi?")) deleteCandidate.mutate(c.id); }}
                              >
                                Sil
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {(candidatesData?.total ?? 0) > 20 && (
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm text-muted-foreground">
                        {((page - 1) * 20) + 1}–{Math.min(page * 20, candidatesData?.total ?? 0)} / {candidatesData?.total ?? 0}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                          Önceki
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= (candidatesData?.total ?? 0)}>
                          Sonraki
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTORY TAB ──────────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Tarama Gecmisi</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Parametreler</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Bulunan</TableHead>
                    <TableHead className="text-right">Eklenen</TableHead>
                    <TableHead>Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {r.source === "crtsh" ? "crt.sh" : "Shodan"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[240px] truncate">
                        {r.runParams ? (
                          (r.runParams["query"] as string) ?? (r.runParams["label"] as string) ?? JSON.stringify(r.runParams)
                        ) : "—"}
                      </TableCell>
                      <TableCell>{runStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">{r.totalFound}</TableCell>
                      <TableCell className="text-right">{r.totalAdded}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString("tr-TR")}
                        {r.completedAt && (
                          <div className="text-[10px]">
                            {Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)}s
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!(runs?.length) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                        Henuz tarama yapilmadi. crt.sh veya Shodan taramasini basaltin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Teaser Preview Dialog */}
      {!!teaserPreview && (
        <Dialog open={!!teaserPreview} onOpenChange={() => setTeaserPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Teaser Onizleme — {teaserPreview.domain}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Konu</div>
                <div className="font-medium">{teaserPreview.teaserSubject}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Alici</div>
                <div className="text-sm">{teaserPreview.contactEmail}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Icerik</div>
                <ScrollArea className="h-48 border rounded-md p-3">
                  <pre className="text-sm whitespace-pre-wrap font-sans">{teaserPreview.teaserBody}</pre>
                </ScrollArea>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setTeaserPreview(null)}>Kapat</Button>
                {!teaserPreview.teaserSentAt && teaserPreview.contactEmail && (
                  <Button
                    onClick={() => {
                      sendTeaser.mutate(teaserPreview.id);
                      setTeaserPreview(null);
                    }}
                  >
                    Gönderildi Olarak İşaretle
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
