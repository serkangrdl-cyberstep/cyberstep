import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

interface CVEBreakdown {
  total: number;
  critical: number;
  high: number;
  medium: number;
  informational: number;
  cisaKev: number;
}

interface SourceData {
  ip?: string;
  org?: string;
  port?: number;
  httpTitle?: string | null;
  shodanQuery?: string;
  product?: string;
  cveBreakdown?: CVEBreakdown;
  registeredDomain?: string;
  tld?: string;
  subdomains?: string[];
  issuer?: string;
  notBefore?: string;
  [key: string]: unknown;
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
  sourceData: SourceData | null;
  contactSource: string | null;
  officerName: string | null;
  officerTitle: string | null;
  isrNotes: string | null;
  httpStatus: number | null;
  isAlive: boolean | null;
  responseTimeMs: number | null;
  scrapedPhone: string | null;
  scrapedAddress: string | null;
  scrapedCompanyName: string | null;
  webScrapedAt: string | null;
  createdAt: string;
}

interface DomainScan {
  id: number;
  domain: string;
  overallScore: number;
  spfPass: boolean;
  spfRecord: string | null;
  dmarcPass: boolean;
  dmarcRecord: string | null;
  dkimPass: boolean;
  dkimSelectors: string[];
  mxPass: boolean;
  mxRecords: Array<{ exchange: string; priority: number }>;
  sslPass: boolean;
  sslExpiry: string | null;
  sslIssuer: string | null;
  sslDaysUntilExpiry: number | null;
  hibpBreachCount: number;
  hibpBreaches: Array<{ name: string; breachDate: string; pwnCount: number; dataClasses: string[] }>;
  blacklisted: boolean;
  blacklistCount: number;
  shadowItServices: Array<{ name: string; category: string; risk: string; description: string; version?: string }>;
  httpHeadersScore: number;
  httpHeadersDetails: { hsts: boolean; xFrameOptions: boolean; xContentTypeOptions: boolean; csp: boolean; referrerPolicy: boolean } | null;
  urlhausListed: boolean;
  urlhausThreat: string | null;
  usomListed: boolean;
  cveSummary: Array<{ service: string; cveId: string; description: string; cvssScore: number }>;
  shodanOpenPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  shodanVulnCount: number;
  virusTotalMalicious: number;
  virusTotalSuspicious: number;
  safeBrowsingFlagged: boolean | null;
  wafDetected: boolean | null;
  wafProvider: string | null;
  ctSubdomainCount: number;
  ctSubdomains: string[];
  sslLabsGrade: string | null;
  createdAt: string;
}

const CVE_DESCS: Record<string, string> = {
  "CVE-2007-6013": "Eski Wordpress gizli anahtar ifşası — güncelleme gerekli",
  "CVE-2016-1209": "Crypt_Blowfish sabit zamanlı karşılaştırma bypass — kimlik doğrulama riski",
  "CVE-2014-3704": "Drupal SQL injection (Drupalgeddon) — kritik",
  "CVE-2017-5638": "Apache Struts RCE — uzaktan kod çalıştırma",
  "CVE-2021-44228": "Log4Shell — Java Log4j uzaktan kod çalıştırma",
};

function FindingBadges({ highlights }: { highlights: string[] | null }) {
  if (!highlights || highlights.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {highlights.map((h) => {
        const isCve = h.startsWith("CVE-");
        const desc = CVE_DESCS[h];
        return isCve ? (
          <a
            key={h}
            href={`https://nvd.nist.gov/vuln/detail/${h}`}
            target="_blank"
            rel="noopener noreferrer"
            title={desc ?? h}
            className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-mono"
          >
            {h}
          </a>
        ) : (
          <span key={h} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
            {h}
          </span>
        );
      })}
    </div>
  );
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

interface TechStackItem {
  vendor: string;
  product?: string;
  category: string;
  salesSignal: string | null;
  securityRisk: string | null;
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

function RipeDnsWidget() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const startRipe = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/lead-discovery/ripe-dns`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "RIPE DNS keşfi arka planda başlatıldı." });
      qc.invalidateQueries({ queryKey: ["lead-discovery-stats"] });
    },
    onError: () => toast({ variant: "destructive", description: "RIPE DNS keşfi başlatılamadı." }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>RIPE DNS Keşfi</CardTitle>
        <CardDescription>
          Türkiye IPv4 prefix'lerinden reverse DNS ile .tr domain keşfi — API key gerektirmez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/40 rounded-md p-4 text-sm space-y-2">
          <div className="font-medium">Nasıl çalışır?</div>
          <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
            <li>stat.ripe.net → Türkiye IPv4 prefix listesi (~2000 prefix)</li>
            <li>Her prefix'ten örneklem IP seç, HackerTarget reverse DNS sorgula</li>
            <li>.tr uzantılı root domain'leri lead_candidates'e ekle</li>
            <li>Bulunan root domain'ler için HackerTarget subdomain lookup</li>
            <li>Rate limit: ~100 istek/gün → maxPrefixes=60 güvenli; gece 02:00 otomatik çalışır</li>
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => startRipe.mutate()} disabled={startRipe.isPending}>
            {startRipe.isPending ? "Başlatılıyor..." : "RIPE DNS Keşfini Başlat"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Tahmini süre: 5-15 dk. Arka planda çalışır.
          </span>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
          Otomatik çalışma: Her gece 02:00 (İstanbul saati). Gündüz test için yukarıdaki butonu kullanın.
        </div>
      </CardContent>
    </Card>
  );
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
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-sm font-medium ${isActive ? "text-green-700" : "text-amber-700"}`}>
              {isActive ? "Aktif" : "Pasif (platform kısıtı)"}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

            {/* Platform limitation note */}
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs text-amber-700 font-medium">Platform kısıtı — Certstream bağlantısı pasif</p>
              <p className="text-xs text-muted-foreground">
                certstream.calidog.io WebSocket bağlantısı bu ortamda çalışmamaktadır.
                Aktif lead kaynağı: <span className="font-medium">crt.sh REST API</span> (günlük cron, .tr domainleri).
                Lead adayları sol taraftaki "crt.sh ile Tara" sektimasindan üretilmektedir.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ISP Grup tipi ────────────────────────────────────────────────────────────
interface IspGroup {
  normalizedName: string;
  isActivePartnership: boolean;
  partnerContact: string | null;
  count: number;
  avgRiskScore: number;
  criticalFindingsTotal: number;
  lastScannedAt: string | null;
  leads: Array<{
    id: number;
    domain: string;
    companyName: string | null;
    riskScore: number | null;
    criticalFindings: number;
    ispOrganization: string | null;
    contactEmail: string | null;
    teaserSentAt: string | null;
    tier: string | null;
  }>;
}

interface IspPartnerRow {
  id: number;
  organizationNamePattern: string;
  partnerName: string;
  partnerContact: string | null;
  isActivePartnership: boolean;
}

function exportGroupToCsv(group: IspGroup) {
  const header = "Domain,Şirket,Risk Skoru,Kritik Bulgular,E-posta,Tier,ISP\n";
  const rows = group.leads.map(l =>
    [l.domain, l.companyName ?? "", l.riskScore ?? 0, l.criticalFindings, l.contactEmail ?? "", l.tier ?? "", l.ispOrganization ?? ""].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `isp-${group.normalizedName.replace(/\s+/g, "-")}-leads.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function IspGroupsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [showPartnerMgmt, setShowPartnerMgmt] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");

  const BASE = "/api/admin-panel/lead-discovery";

  const { data: groups, isLoading } = useQuery<IspGroup[]>({
    queryKey: ["isp-groups"],
    queryFn: () => fetch(`${BASE}/isp-groups`).then(r => r.json()),
  });

  const { data: partners } = useQuery<IspPartnerRow[]>({
    queryKey: ["isp-partners"],
    queryFn: () => fetch(`${BASE}/isp-partners`).then(r => r.json()),
    enabled: showPartnerMgmt,
  });

  const togglePartnership = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      fetch(`${BASE}/isp-partners/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActivePartnership: val }) }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["isp-partners"] }); queryClient.invalidateQueries({ queryKey: ["isp-groups"] }); },
  });

  const addPartner = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/isp-partners`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationNamePattern: newPattern, partnerName: newName, partnerContact: newContact || undefined }) }).then(r => r.json()),
    onSuccess: () => {
      toast({ description: "ISP pattern eklendi." });
      setNewPattern(""); setNewName(""); setNewContact("");
      queryClient.invalidateQueries({ queryKey: ["isp-partners"] });
    },
  });

  const backfill = useMutation({
    mutationFn: () => fetch(`${BASE}/isp-backfill`, { method: "POST" }).then(r => r.json()),
    onSuccess: (d: { updated: number }) => {
      toast({ description: `${d.updated} lead güncellendi.` });
      queryClient.invalidateQueries({ queryKey: ["isp-groups"] });
    },
  });

  const toggleGroup = (name: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const riskColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 70) return "text-red-600 font-semibold";
    if (score >= 40) return "text-amber-600 font-semibold";
    return "text-green-600";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>ISP / Operatör Bazlı Lead Grupları</CardTitle>
              <CardDescription>
                Shodan org alanına göre normalize edilmiş {groups?.length ?? 0} operatör —{" "}
                {groups?.reduce((s, g) => s + g.count, 0) ?? 0} kalifikasyonlu lead
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => backfill.mutate()} disabled={backfill.isPending} className="text-xs">
                {backfill.isPending ? "Çalışıyor..." : "Backfill ISP"}
              </Button>
              <Button size="sm" variant={showPartnerMgmt ? "default" : "outline"} onClick={() => setShowPartnerMgmt(p => !p)} className="text-xs">
                Partner Yönetimi
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Partner Yönetimi Paneli */}
      {showPartnerMgmt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ISP Pattern Yönetimi</CardTitle>
            <CardDescription>Shodan org alanı bu pattern'larla ILIKE eşleştirilir ve normalize edilir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Pattern (% wildcard)</label>
                <Input placeholder="%Turk Telekomunikasyon%" value={newPattern} onChange={e => setNewPattern(e.target.value)} className="h-8 text-sm w-56" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Normalize isim</label>
                <Input placeholder="Türk Telekom" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Kontak (opsiyonel)</label>
                <Input placeholder="ornek@isp.com" value={newContact} onChange={e => setNewContact(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <Button size="sm" onClick={() => addPartner.mutate()} disabled={!newPattern || !newName || addPartner.isPending}>Ekle</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Partner Adı</TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead>İş Birliği</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(partners ?? []).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.organizationNamePattern}</TableCell>
                      <TableCell className="text-sm">{p.partnerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.partnerContact ?? "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={p.isActivePartnership ? "default" : "outline"}
                          className={`text-xs h-6 ${p.isActivePartnership ? "bg-green-600 hover:bg-green-700" : ""}`}
                          onClick={() => togglePartnership.mutate({ id: p.id, val: !p.isActivePartnership })}
                        >
                          {p.isActivePartnership ? "Aktif Partner" : "Potansiyel"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!(partners?.length) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">Henüz pattern yok.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gruplar — Accordion */}
      {isLoading && <div className="text-center text-muted-foreground py-12 text-sm">Yükleniyor...</div>}
      {!isLoading && !(groups?.length) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            ISP bilgisi olan kalifikasyonlu lead bulunamadı. Backfill butonunu çalıştırın.
          </CardContent>
        </Card>
      )}
      {(groups ?? []).map(group => {
        const isOpen = openGroups.has(group.normalizedName);
        return (
          <Card key={group.normalizedName} className={group.isActivePartnership ? "border-green-500/40" : ""}>
            <button
              className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
              onClick={() => toggleGroup(group.normalizedName)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{group.normalizedName}</span>
                  {group.isActivePartnership ? (
                    <Badge className="bg-green-100 text-green-700 border border-green-300 text-[10px] px-1.5 py-0">Partner</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Potansiyel</Badge>
                  )}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span><span className="font-medium text-foreground">{group.count}</span> lead</span>
                  <span>Ort. risk <span className={riskColor(group.avgRiskScore)}>{group.avgRiskScore}/100</span></span>
                  <span><span className="text-red-600 font-medium">{group.criticalFindingsTotal}</span> kritik bulgu</span>
                  {group.lastScannedAt && <span>Son tarama: {new Date(group.lastScannedAt).toLocaleDateString("tr-TR")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={e => { e.stopPropagation(); exportGroupToCsv(group); }}
                >
                  CSV
                </Button>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Şirket</TableHead>
                        <TableHead className="text-right">Risk</TableHead>
                        <TableHead className="text-right">Kritik</TableHead>
                        <TableHead>E-posta</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>ISP (raw)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.leads.map(lead => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-mono text-xs">{lead.domain}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{lead.companyName ?? "—"}</TableCell>
                          <TableCell className={`text-right text-xs ${riskColor(lead.riskScore)}`}>{lead.riskScore ?? "—"}</TableCell>
                          <TableCell className="text-right text-xs">{lead.criticalFindings > 0 ? <span className="text-red-600 font-semibold">{lead.criticalFindings}</span> : "0"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.contactEmail ?? "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{lead.tier ?? "—"}</Badge></TableCell>
                          <TableCell className="text-[10px] text-muted-foreground max-w-[180px] truncate">{lead.ispOrganization ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function AdminLeadDiscovery() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ─── crt.sh form state ───────────────────────────────────────────────────
  const [crtshTlds, setCrtshTlds] = useState<string[]>([".com.tr", ".net.tr"]);
  const [daysBack, setDaysBack] = useState(30);
  const [minScore, setMinScore] = useState(10);
  const [domainLimit, setDomainLimit] = useState(300);

  // ─── Shodan form state ───────────────────────────────────────────────────
  const [selectedShodanQueries, setSelectedShodanQueries] = useState<number[]>([0, 2, 4]);

  // ─── Results pagination ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [qualifiedPage, setQualifiedPage] = useState(1);
  const [filterQualified, setFilterQualified] = useState(false);
  const [filterHasContact, setFilterHasContact] = useState(false);
  const [filterNotSent, setFilterNotSent] = useState(false);
  const [teaserPreview, setTeaserPreview] = useState<LeadCandidate | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<LeadCandidate | null>(null);
  const [fingerprintResult, setFingerprintResult] = useState<{ stack: TechStackItem[]; stackCount: number; maturity: { score: number; level: string } | null } | null>(null);
  const [filterNoContact, setFilterNoContact] = useState(false);
  const [isrNotesEdit, setIsrNotesEdit] = useState("");
  const [isrOpen, setIsrOpen] = useState(false);
  const [contactEditTarget, setContactEditTarget] = useState<LeadCandidate | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");

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

  const { data: candidateTechStack } = useQuery<TechStackItem[]>({
    queryKey: ["candidate-tech-stack", detailCandidate?.id],
    queryFn: () => fetch(`${BASE}/lead-discovery/candidates/${detailCandidate!.id}/tech-stack`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!detailCandidate,
  });

  const { data: candidateDomainScan } = useQuery<DomainScan | null>({
    queryKey: ["candidate-domain-scan", detailCandidate?.domain],
    queryFn: async () => {
      const r = await fetch(`${BASE}/domain-scans/by-domain/${encodeURIComponent(detailCandidate!.domain)}`, { credentials: "include" });
      if (r.status === 404) return null;
      return r.json();
    },
    enabled: !!detailCandidate,
  });

  const { data: shodanQueries } = useQuery<ShodanQuery[]>({
    queryKey: ["shodan-queries"],
    queryFn: () => fetch(`${BASE}/lead-discovery/shodan/queries`).then((r) => r.json()),
  });

  const { data: qualifiedData, isLoading: qualifiedLoading } = useQuery<{
    rows: LeadCandidate[]; total: number;
  }>({
    queryKey: ["lead-qualified", qualifiedPage],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(qualifiedPage), pageSize: "20" });
      return fetch(`${BASE}/lead-discovery/qualified?${params}`).then((r) => r.json());
    },
    refetchInterval: 20_000,
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

  const saveContact = useMutation({
    mutationFn: ({ id, contactEmail, contactName, contactTitle }: { id: number; contactEmail: string; contactName: string; contactTitle: string }) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactEmail, contactName, contactTitle }),
      }).then(async (r) => {
        const j = await r.json() as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: () => {
      toast({ description: "Kontak bilgisi kaydedildi." });
      setContactEditTarget(null);
      qc.invalidateQueries({ queryKey: ["lead-qualified"] });
      qc.invalidateQueries({ queryKey: ["lead-discovery-stats"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const reEnrich = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}/re-enrich`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "Kontak arama başlatıldı (WHOIS + Web + MERSIS)." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["lead-qualified"] }), 15000);
    },
  });

  const webEnrich = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}/web-enrich`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ description: "Web enrichment başlatıldı (liveness + scraping)." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["lead-qualified"] }), 20000);
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const batchWebEnrich = useMutation({
    mutationFn: (limit: number) =>
      fetch(`${BASE}/lead-discovery/web-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      }).then(async (r) => {
        const j = await r.json() as { message?: string; error?: string };
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: (data) => toast({ description: (data as { message?: string }).message ?? "Web enrichment başlatıldı." }),
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const saveIsrNotes = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}/isr-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isrNotes: notes }),
      }).then(async (r) => {
        const j = await r.json() as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: () => {
      toast({ description: "ISR notları kaydedildi." });
      qc.invalidateQueries({ queryKey: ["lead-qualified"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  function buildLinkedInUrl(c: LeadCandidate): string {
    const parts = c.domain.split(".");
    const slug = parts[0] ?? "";
    const company = c.companyName ?? (slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase());
    if (c.officerName) {
      return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${c.officerName} ${company}`)}`;
    }
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company)}&titleKeyword=${encodeURIComponent("IT OR CTO OR CISO OR Genel Mudur")}`;
  }

  function buildSalesNavUrl(c: LeadCandidate): string {
    const parts = c.domain.split(".");
    const slug = parts[0] ?? "";
    const company = c.companyName ?? slug;
    return `https://www.linkedin.com/sales/search/people?query=(keywords:${encodeURIComponent(company)})`;
  }

  function exportQualifiedCsv(rows: LeadCandidate[]): void {
    const header = ["domain", "company_name", "officer_name", "officer_title", "contact_email", "risk_score", "contact_source", "linkedin_url"];
    const lines = rows.map((c) => [
      c.domain,
      c.companyName ?? "",
      c.officerName ?? "",
      c.officerTitle ?? "",
      c.contactEmail ?? "",
      String(c.riskScore ?? ""),
      c.contactSource ?? "",
      buildLinkedInUrl(c),
    ].map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cyberstep-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const deleteCandidate = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/lead-discovery/candidates/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-candidates"] });
      qc.invalidateQueries({ queryKey: ["lead-discovery-stats"] });
    },
  });

  const pushToQueue = useMutation({
    mutationFn: (c: LeadCandidate) =>
      fetch("/api/lead-gen/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain: c.domain, companyName: c.companyName ?? "" }),
      }).then(async (r) => {
        const j = await r.json() as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: () => toast({ description: "ISR kuyruğuna eklendi." }),
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const fingerprintLead = useMutation({
    mutationFn: (domain: string) =>
      fetch(`${BASE}/tech-stack/fingerprint`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      }).then(async (r) => {
        const j = await r.json() as { error?: string; stack?: TechStackItem[]; stackCount?: number; maturity?: { score: number; level: string } };
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: (data) => {
      setFingerprintResult({
        stack: data.stack ?? [],
        stackCount: data.stackCount ?? 0,
        maturity: data.maturity ?? null,
      });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const TLD_OPTIONS = [".com.tr", ".net.tr", ".org.tr", ".edu.tr", ".bel.tr"];
  const DAYS_OPTIONS = [7, 14, 30, 60, 90];
  const SCORE_OPTIONS = [50, 60, 70, 80];
  const LIMIT_OPTIONS = [100, 200, 300, 500];

  return (
    <AdminLayout title="Lead Discovery">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Toplam Aday", value: stats?.total ?? 0, color: "" },
          { label: "Nitelendirme Bekleyen", value: stats?.pending ?? 0, color: "text-amber-600" },
          { label: "Nitelendirilen", value: stats?.qualified ?? 0, color: "text-green-600" },
          { label: "Kontak Bulunan", value: stats?.withContact ?? 0, color: "text-blue-600" },
          { label: "Teaser Gönderildi", value: stats?.teaserSent ?? 0, color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="crtsh">
        <div className="overflow-x-auto mb-4">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="certstream">Certstream</TabsTrigger>
            <TabsTrigger value="crtsh">crt.sh</TabsTrigger>
            <TabsTrigger value="shodan">Shodan</TabsTrigger>
            <TabsTrigger value="ripe_dns">RIPE DNS</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="qualified">
              Qualified
              {(stats?.qualified ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-green-100 text-green-700 text-[10px] font-bold w-4 h-4">
                  {stats!.qualified}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="isp-gruplari">ISP Grupları</TabsTrigger>
            <TabsTrigger value="results">Sonuclar</TabsTrigger>
            <TabsTrigger value="history">Gecmis</TabsTrigger>
          </TabsList>
        </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* ── RIPE DNS TAB ─────────────────────────────────────────────── */}
        <TabsContent value="ripe_dns">
          <RipeDnsWidget />
        </TabsContent>

        {/* ── PIPELINE TAB ─────────────────────────────────────────────── */}
        <TabsContent value="pipeline">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* ── QUALIFIED TAB ────────────────────────────────────────────── */}
        <TabsContent value="qualified">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Qualified Leadler</CardTitle>
                  <CardDescription>
                    Kalifikasyonu geçmiş {qualifiedData?.total ?? 0} aday —
                    {" "}{stats?.withContact ?? 0} contact bulundu,
                    {" "}{stats?.teaserSent ?? 0} teaser gönderildi
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startQualify.mutate()}
                  disabled={startQualify.isPending}
                >
                  {startQualify.isPending ? "Çalışıyor..." : "Kalifikasyonu Çalıştır"}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button
                  size="sm"
                  variant={filterNoContact ? "default" : "outline"}
                  onClick={() => setFilterNoContact((f) => !f)}
                  className="text-xs"
                >
                  {filterNoContact ? "Filtre: Kontakt Eksik" : "Kontakt Eksik"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportQualifiedCsv(qualifiedData?.rows ?? [])}
                  className="text-xs"
                >
                  LinkedIn Listesi Indir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => batchWebEnrich.mutate(30)}
                  disabled={batchWebEnrich.isPending}
                  className="text-xs"
                >
                  {batchWebEnrich.isPending ? "Taranıyor..." : "Toplu Web Tarama (30)"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {qualifiedLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Yükleniyor...</div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead className="text-right">Risk</TableHead>
                          <TableHead>Contact Email</TableHead>
                          <TableHead>Contact Adı</TableHead>
                          <TableHead>Teaser</TableHead>
                          <TableHead>İşlemler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(filterNoContact
                          ? (qualifiedData?.rows ?? []).filter((c) => !c.contactEmail && !c.officerName)
                          : (qualifiedData?.rows ?? [])
                        ).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="font-medium text-sm font-mono">{c.domain}</div>
                              {(c.scrapedCompanyName ?? c.companyName) && (
                                <div className="text-xs text-muted-foreground truncate max-w-[160px]">{c.scrapedCompanyName ?? c.companyName}</div>
                              )}
                              {c.webScrapedAt != null ? (
                                c.isAlive ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 mt-0.5">
                                    Canli {c.responseTimeMs != null ? `${c.responseTimeMs}ms` : ""} {c.httpStatus ? `· ${c.httpStatus}` : ""}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 mt-0.5">
                                    Erisemiyor {c.httpStatus ? `· ${c.httpStatus}` : ""}
                                  </span>
                                )
                              ) : null}
                              {c.scrapedPhone && (
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.scrapedPhone}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {c.riskScore != null ? (
                                <div className="text-right">
                                  <span className={`font-bold text-sm ${c.riskScore >= 70 ? "text-red-600" : c.riskScore >= 40 ? "text-orange-500" : "text-gray-500"}`}>
                                    {c.riskScore}
                                  </span>
                                  {c.criticalFindings > 0 && (
                                    <div className="text-[10px] text-red-500">{c.criticalFindings} kritik</div>
                                  )}
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {c.contactEmail ? (
                                <span className="text-xs font-mono">{c.contactEmail}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium">
                                  ⚠ Bulunamadı
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">{c.contactName ?? <span className="text-muted-foreground">—</span>}</div>
                              {c.contactTitle && (
                                <div className="text-[10px] text-muted-foreground">{c.contactTitle}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {c.teaserSentAt ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
                                  ✓ Gönderildi
                                </span>
                              ) : c.teaserSubject ? (
                                <button
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors"
                                  onClick={() => setTeaserPreview(c)}
                                >
                                  Hazır — Önizle
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 min-w-[110px]">
                                {!c.contactEmail && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 w-full"
                                    onClick={() => reEnrich.mutate(c.id)}
                                    disabled={reEnrich.isPending}
                                  >
                                    Yeniden Ara
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`text-xs h-7 w-full ${c.webScrapedAt ? "text-muted-foreground" : ""}`}
                                  onClick={() => webEnrich.mutate(c.id)}
                                  disabled={webEnrich.isPending}
                                  title={c.webScrapedAt ? `Son scrape: ${new Date(c.webScrapedAt).toLocaleDateString("tr-TR")}` : "Web sitesini tara"}
                                >
                                  {c.webScrapedAt ? "Web Yenile" : "Web Scrape"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 w-full"
                                  onClick={() => {
                                    setContactEditTarget(c);
                                    setEditEmail(c.contactEmail ?? "");
                                    setEditName(c.contactName ?? "");
                                    setEditTitle(c.contactTitle ?? "");
                                  }}
                                >
                                  Kontak Düzenle
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 w-full"
                                  onClick={() => generateTeaser.mutate(c.id)}
                                  disabled={generateTeaser.isPending}
                                >
                                  {c.teaserSubject ? "Yeniden Üret" : "Teaser Üret"}
                                </Button>
                                {c.teaserSubject && !c.teaserSentAt && c.contactEmail && (
                                  <Button
                                    size="sm"
                                    className="text-xs h-7 w-full"
                                    onClick={() => sendTeaser.mutate(c.id)}
                                    disabled={sendTeaser.isPending}
                                  >
                                    Gönderildi İşaretle
                                  </Button>
                                )}
                                <a
                                  href={buildLinkedInUrl(c)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center text-xs h-7 w-full rounded-md border border-[#0A66C2]/30 bg-[#0A66C2]/5 text-[#0A66C2] hover:bg-[#0A66C2]/10 font-medium"
                                >
                                  LinkedIn
                                </a>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 w-full"
                                  onClick={() => { setFingerprintResult(null); setDetailCandidate(c); setIsrNotesEdit(c.isrNotes ?? ""); }}
                                >
                                  Detay
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!(qualifiedData?.rows?.length) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                              Henüz qualified lead yok. Pipeline veya kalifikasyonu çalıştırın.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {(qualifiedData?.total ?? 0) > 20 && (
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm text-muted-foreground">
                        {((qualifiedPage - 1) * 20) + 1}–{Math.min(qualifiedPage * 20, qualifiedData?.total ?? 0)} / {qualifiedData?.total ?? 0}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setQualifiedPage((p) => Math.max(1, p - 1))} disabled={qualifiedPage === 1}>
                          Önceki
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setQualifiedPage((p) => p + 1)} disabled={qualifiedPage * 20 >= (qualifiedData?.total ?? 0)}>
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

        {/* ── RESULTS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Lead Adaylari</CardTitle>
                  <CardDescription>Toplam {candidatesData?.total ?? 0} kayit</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
                  <div className="overflow-x-auto -mx-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain / Şirket</TableHead>
                        <TableHead>Kaynak Detay</TableHead>
                        <TableHead className="text-right">Risk</TableHead>
                        <TableHead>Bulgular</TableHead>
                        <TableHead>İletişim</TableHead>
                        <TableHead>Teaser</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(candidatesData?.rows ?? []).map((c) => {
                        const sd = c.sourceData;
                        return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{c.domain}</div>
                            {c.companyName && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{c.companyName}</div>}
                            <div className="flex gap-1 mt-0.5">
                              {!!c.hasFortigate && <span className="text-[10px] text-orange-600 font-medium">FortiGate</span>}
                              {c.isQualified && <span className="text-[10px] text-green-600 font-medium">Kalifikasyon</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-[10px] h-4">
                                {c.source === "crtsh" ? "crt.sh" : "Shodan"}
                              </Badge>
                              {sd?.ip && (
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  {sd.ip}{sd.port ? `:${sd.port}` : ""}
                                </div>
                              )}
                              {sd?.product && (
                                <div className="text-[10px] text-blue-600 truncate max-w-[130px]">{sd.product}</div>
                              )}
                              {sd?.shodanQuery && (
                                <div className="text-[10px] text-muted-foreground italic truncate max-w-[130px]">{sd.shodanQuery}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.riskScore != null ? (
                              <div className="text-right">
                                <span className={`font-bold text-sm ${c.riskScore >= 70 ? "text-red-600" : c.riskScore >= 40 ? "text-orange-500" : "text-gray-500"}`}>
                                  {c.riskScore}
                                </span>
                                {c.criticalFindings > 0 && (
                                  <div className="text-[10px] text-red-500">{c.criticalFindings} kritik</div>
                                )}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <FindingBadges highlights={c.findingHighlights} />
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
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 w-full"
                                onClick={() => { setFingerprintResult(null); setDetailCandidate(c); }}
                              >
                                Detay
                              </Button>
                              {c.isQualified && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 w-full"
                                  onClick={() => generateTeaser.mutate(c.id)}
                                  disabled={generateTeaser.isPending}
                                >
                                  {c.teaserSubject ? "Yeniden Üret" : "Teaser"}
                                </Button>
                              )}
                              {!!c.teaserSubject && !c.teaserSentAt && c.contactEmail && (
                                <Button
                                  size="sm"
                                  className="text-xs h-7 w-full"
                                  onClick={() => sendTeaser.mutate(c.id)}
                                  disabled={sendTeaser.isPending}
                                >
                                  Gönder
                                </Button>
                              )}
                              {c.isQualified && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 w-full text-purple-600 border-purple-200 hover:bg-purple-50"
                                  onClick={() => pushToQueue.mutate(c)}
                                  disabled={pushToQueue.isPending}
                                >
                                  ISR Kuyruğu
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 w-full text-red-500 hover:text-red-700"
                                onClick={() => { if (confirm("Aday silinsin mi?")) deleteCandidate.mutate(c.id); }}
                              >
                                Sil
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>

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
              <div className="overflow-x-auto -mx-1">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ISP GRUPLARI TAB ─────────────────────────────────────────── */}
        <TabsContent value="isp-gruplari">
          <IspGroupsView />
        </TabsContent>
      </Tabs>

      {/* Lead Detail Dialog */}
      {!!detailCandidate && (
        <Dialog open={!!detailCandidate} onOpenChange={() => { setDetailCandidate(null); setFingerprintResult(null); }}>
          <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b">
              <DialogTitle className="font-mono text-base flex items-center gap-2">
                {detailCandidate.domain}
                <a
                  href={`https://${detailCandidate.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-sans font-normal text-blue-600 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  Siteyi Aç ↗
                </a>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm overflow-y-auto flex-1 px-4 py-4">
              {/* Şirket bilgisi */}
              {detailCandidate.companyName && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Şirket</div>
                  <div className="font-medium">{detailCandidate.companyName}</div>
                </div>
              )}

              {/* Kaynak tespit detayı */}
              {detailCandidate.sourceData && (
                <div className="bg-slate-50 border rounded-md p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {detailCandidate.source === "crtsh" ? "crt.sh Tespit Detayı" : "Shodan Tespit Detayı"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Shodan alanları */}
                    {detailCandidate.sourceData.ip && (
                      <div>
                        <span className="text-muted-foreground">IP Adresi: </span>
                        <span className="font-mono font-medium">{detailCandidate.sourceData.ip}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.port && (
                      <div>
                        <span className="text-muted-foreground">Açık Port: </span>
                        <span className="font-mono font-medium text-orange-600">{detailCandidate.sourceData.port}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.product && (
                      <div>
                        <span className="text-muted-foreground">Ürün/Yazılım: </span>
                        <span className="font-medium">{detailCandidate.sourceData.product}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.org && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Organizasyon: </span>
                        <span>{detailCandidate.sourceData.org}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.httpTitle && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">HTTP Başlığı: </span>
                        <span className="italic">{detailCandidate.sourceData.httpTitle}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.shodanQuery && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Tetikleyen Shodan Sorgusu: </span>
                        <span className="font-mono text-blue-600">{detailCandidate.sourceData.shodanQuery}</span>
                      </div>
                    )}
                    {/* crt.sh alanları */}
                    {detailCandidate.sourceData.registeredDomain && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Kayıtlı Domain: </span>
                        <span className="font-mono font-medium">{detailCandidate.sourceData.registeredDomain}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.tld && (
                      <div>
                        <span className="text-muted-foreground">TLD: </span>
                        <span className="font-mono">{detailCandidate.sourceData.tld}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.subdomains && (detailCandidate.sourceData.subdomains as string[]).length > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Alt Domainler: </span>
                        <span className="font-mono text-xs">{(detailCandidate.sourceData.subdomains as string[]).slice(0, 8).join(", ")}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.issuer && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Sertifika Veren: </span>
                        <span>{detailCandidate.sourceData.issuer}</span>
                      </div>
                    )}
                    {detailCandidate.sourceData.notBefore && (
                      <div>
                        <span className="text-muted-foreground">Sertifika Tarihi: </span>
                        <span>{new Date(detailCandidate.sourceData.notBefore as string).toLocaleDateString("tr-TR")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Risk skoru + CVE breakdown */}
              <div className="flex items-start gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground">Risk Skoru</div>
                  <div className={`text-2xl font-bold ${(detailCandidate.riskScore ?? 0) >= 70 ? "text-red-600" : (detailCandidate.riskScore ?? 0) >= 40 ? "text-orange-500" : "text-gray-500"}`}>
                    {detailCandidate.riskScore ?? "—"}<span className="text-sm font-normal text-muted-foreground">/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Kritik Bulgu</div>
                  <div className="text-2xl font-bold text-red-600">{detailCandidate.criticalFindings}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Kaynak</div>
                  <Badge variant="outline">{detailCandidate.source === "crtsh" ? "crt.sh" : "Shodan"}</Badge>
                </div>
              </div>

              {/* CVE breakdown */}
              {detailCandidate.sourceData?.cveBreakdown && detailCandidate.sourceData.cveBreakdown.total > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">CVE Dağılımı ({detailCandidate.sourceData.cveBreakdown.total} toplam)</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {detailCandidate.sourceData.cveBreakdown.critical > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">
                        {detailCandidate.sourceData.cveBreakdown.critical} Kritik
                      </span>
                    )}
                    {detailCandidate.sourceData.cveBreakdown.high > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-200">
                        {detailCandidate.sourceData.cveBreakdown.high} Yüksek
                      </span>
                    )}
                    {detailCandidate.sourceData.cveBreakdown.medium > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                        {detailCandidate.sourceData.cveBreakdown.medium} Orta
                      </span>
                    )}
                    {detailCandidate.sourceData.cveBreakdown.informational > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {detailCandidate.sourceData.cveBreakdown.informational} Bilgi
                      </span>
                    )}
                    {detailCandidate.sourceData.cveBreakdown.cisaKev > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                        {detailCandidate.sourceData.cveBreakdown.cisaKev} CISA KEV
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Bulgular */}
              {(detailCandidate.findingHighlights?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Güvenlik Bulguları</div>
                  <div className="space-y-1.5">
                    {(detailCandidate.findingHighlights ?? []).map((h) => {
                      const isCve = h.startsWith("CVE-");
                      const desc = CVE_DESCS[h];
                      return (
                        <div key={h} className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-100">
                          <span className="text-red-600 mt-0.5">•</span>
                          <div>
                            {isCve ? (
                              <a href={`https://nvd.nist.gov/vuln/detail/${h}`} target="_blank" rel="noopener noreferrer"
                                className="font-mono text-red-700 font-medium hover:underline text-xs">{h}</a>
                            ) : (
                              <span className="font-medium text-red-700 text-xs">{h}</span>
                            )}
                            {desc && <div className="text-xs text-red-600/80 mt-0.5">{desc}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tech Stack */}
              {(candidateTechStack?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Teknoloji Yığını</div>
                  <div className="space-y-1">
                    {[...candidateTechStack!]
                      .sort((a, b) => (b.securityRisk === "Yüksek" ? 1 : 0) - (a.securityRisk === "Yüksek" ? 1 : 0))
                      .map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 font-medium truncate">{(t.vendor && t.vendor !== "none") ? t.vendor : (t.product ?? t.category)}</span>
                          <span className="text-muted-foreground text-[10px]">{t.category}</span>
                          {t.salesSignal && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              t.salesSignal === "fortinet_customer" ? "bg-red-100 text-red-700" :
                              t.salesSignal === "cms_wordpress" ? "bg-orange-100 text-orange-700" :
                              t.salesSignal === "cdn_user" ? "bg-blue-100 text-blue-700" :
                              t.salesSignal === "microsoft_shop" ? "bg-purple-100 text-purple-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>{t.salesSignal}</span>
                          )}
                          {t.securityRisk === "Yüksek" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-600 border border-red-200">risk</span>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Tech Fingerprint Sonuçları */}
              {fingerprintLead.isPending && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-md p-3 text-xs text-cyan-700 animate-pulse">
                  Tech fingerprint taraması çalışıyor...
                </div>
              )}
              {fingerprintResult && (
                <div className="border border-cyan-200 bg-cyan-50/50 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-cyan-800 uppercase tracking-wide">Tech Fingerprint Sonuçları</div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-muted-foreground">{fingerprintResult.stackCount} teknoloji</span>
                      {fingerprintResult.maturity && (
                        <span className={`font-semibold ${
                          fingerprintResult.maturity.score >= 70 ? "text-green-700" :
                          fingerprintResult.maturity.score >= 40 ? "text-yellow-700" : "text-red-700"
                        }`}>{fingerprintResult.maturity.level} ({fingerprintResult.maturity.score}/100)</span>
                      )}
                    </div>
                  </div>
                  {fingerprintResult.stack.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Teknoloji tespit edilemedi.</p>
                  ) : (
                    <div className="space-y-1">
                      {[...fingerprintResult.stack]
                        .sort((a, b) => (b.securityRisk === "Yüksek" ? 1 : 0) - (a.securityRisk === "Yüksek" ? 1 : 0))
                        .map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 font-medium truncate">{(t.vendor && t.vendor !== "none") ? t.vendor : (t.product ?? t.category)}</span>
                            <span className="text-muted-foreground text-[10px]">{t.category}</span>
                            {t.salesSignal && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                t.salesSignal === "fortinet_customer" ? "bg-red-100 text-red-700" :
                                t.salesSignal === "cms_wordpress" ? "bg-orange-100 text-orange-700" :
                                t.salesSignal === "cdn_user" ? "bg-blue-100 text-blue-700" :
                                t.salesSignal === "microsoft_shop" ? "bg-purple-100 text-purple-700" :
                                "bg-slate-100 text-slate-600"
                              }`}>{t.salesSignal}</span>
                            )}
                            {t.securityRisk === "Yüksek" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-600 border border-red-200">risk</span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Domain Tarama Sonuçları */}
              {candidateDomainScan && (
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Domain Tarama Sonuçları</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${candidateDomainScan.overallScore >= 70 ? "text-green-700" : candidateDomainScan.overallScore >= 40 ? "text-yellow-700" : "text-red-700"}`}>
                        {candidateDomainScan.overallScore}/100
                      </span>
                      {candidateDomainScan.sslLabsGrade && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          candidateDomainScan.sslLabsGrade.startsWith("A") ? "bg-green-100 text-green-700" :
                          candidateDomainScan.sslLabsGrade.startsWith("B") ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>SSL: {candidateDomainScan.sslLabsGrade}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(candidateDomainScan.createdAt).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-3 text-xs">

                    {/* E-posta Güvenliği */}
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">E-posta Güvenliği</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: "SPF", pass: candidateDomainScan.spfPass, detail: candidateDomainScan.spfRecord },
                          { label: "DMARC", pass: candidateDomainScan.dmarcPass, detail: candidateDomainScan.dmarcRecord },
                          { label: "DKIM", pass: candidateDomainScan.dkimPass, detail: candidateDomainScan.dkimSelectors?.length > 0 ? `selector: ${candidateDomainScan.dkimSelectors.join(", ")}` : null },
                          { label: "MX", pass: candidateDomainScan.mxPass, detail: candidateDomainScan.mxRecords?.[0]?.exchange ?? null },
                        ].map(({ label, pass, detail }) => (
                          <div key={label} className="flex items-start gap-1.5">
                            <span className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${pass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {pass ? "✓" : "✗"}
                            </span>
                            <div>
                              <span className="font-semibold">{label}</span>
                              {detail && <div className="text-muted-foreground font-mono text-[10px] truncate max-w-[160px]" title={detail}>{detail}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SSL */}
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">SSL Sertifikası</div>
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1">
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${candidateDomainScan.sslPass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {candidateDomainScan.sslPass ? "✓" : "✗"}
                          </span>
                          <span>{candidateDomainScan.sslPass ? "Geçerli" : "Geçersiz/Eksik"}</span>
                        </div>
                        {candidateDomainScan.sslDaysUntilExpiry !== null && (
                          <span className={candidateDomainScan.sslDaysUntilExpiry < 30 ? "text-orange-600 font-semibold" : "text-muted-foreground"}>
                            {candidateDomainScan.sslDaysUntilExpiry} gün kaldı
                          </span>
                        )}
                        {candidateDomainScan.sslIssuer && (
                          <span className="text-muted-foreground">{candidateDomainScan.sslIssuer}</span>
                        )}
                      </div>
                    </div>

                    {/* HTTP Başlıkları */}
                    {candidateDomainScan.httpHeadersDetails && (
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">HTTP Güvenlik Başlıkları</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "HSTS", pass: candidateDomainScan.httpHeadersDetails.hsts },
                            { label: "X-Frame", pass: candidateDomainScan.httpHeadersDetails.xFrameOptions },
                            { label: "X-Content-Type", pass: candidateDomainScan.httpHeadersDetails.xContentTypeOptions },
                            { label: "CSP", pass: candidateDomainScan.httpHeadersDetails.csp },
                            { label: "Referrer", pass: candidateDomainScan.httpHeadersDetails.referrerPolicy },
                          ].map(({ label, pass }) => (
                            <span key={label} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pass ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                              {pass ? "✓" : "✗"} {label}
                            </span>
                          ))}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${candidateDomainScan.httpHeadersScore >= 70 ? "bg-green-50 text-green-700 border-green-200" : candidateDomainScan.httpHeadersScore >= 40 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                            Skor: {candidateDomainScan.httpHeadersScore}/100
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tehdit İstihbaratı */}
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tehdit İstihbaratı</div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${candidateDomainScan.blacklisted ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                          {candidateDomainScan.blacklisted ? `Kara Liste: ${candidateDomainScan.blacklistCount} liste` : "Kara Liste: Temiz"}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${candidateDomainScan.hibpBreachCount > 0 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                          {candidateDomainScan.hibpBreachCount > 0 ? `HIBP: ${candidateDomainScan.hibpBreachCount} ihlal` : "HIBP: İhlal Yok"}
                        </span>
                        {candidateDomainScan.urlhausListed && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-700 border-red-200">
                            URLhaus: {candidateDomainScan.urlhausThreat ?? "Listelendi"}
                          </span>
                        )}
                        {candidateDomainScan.usomListed && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-700 border-red-200">USOM Listesi</span>
                        )}
                        {candidateDomainScan.safeBrowsingFlagged && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-700 border-red-200">Google Safe Browsing</span>
                        )}
                        {candidateDomainScan.virusTotalMalicious > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-700 border-red-200">
                            VT: {candidateDomainScan.virusTotalMalicious} zararlı
                          </span>
                        )}
                        {candidateDomainScan.wafDetected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200">
                            WAF: {candidateDomainScan.wafProvider ?? "Tespit Edildi"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Açık Portlar (Shodan) */}
                    {candidateDomainScan.shodanOpenPorts && candidateDomainScan.shodanOpenPorts.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Açık Portlar ({candidateDomainScan.shodanOpenPorts.length})
                          {candidateDomainScan.shodanVulnCount > 0 && (
                            <span className="ml-2 text-red-600">{candidateDomainScan.shodanVulnCount} CVE</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {candidateDomainScan.shodanOpenPorts.slice(0, 12).map((p, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono" title={`${p.service}${p.product ? ` (${p.product})` : ""}`}>
                              {p.port}/{p.protocol}
                            </span>
                          ))}
                          {candidateDomainScan.shodanOpenPorts.length > 12 && (
                            <span className="text-[10px] text-muted-foreground">+{candidateDomainScan.shodanOpenPorts.length - 12}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CVE Özeti */}
                    {candidateDomainScan.cveSummary && candidateDomainScan.cveSummary.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">CVE Bulguları ({candidateDomainScan.cveSummary.length})</div>
                        <div className="space-y-1">
                          {candidateDomainScan.cveSummary.slice(0, 5).map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${c.cvssScore >= 9 ? "bg-red-100 text-red-700" : c.cvssScore >= 7 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                                {c.cvssScore.toFixed(1)}
                              </span>
                              <span className="font-mono text-[10px] text-blue-700 shrink-0">{c.cveId}</span>
                              <span className="text-muted-foreground truncate text-[10px]">{c.service}</span>
                            </div>
                          ))}
                          {candidateDomainScan.cveSummary.length > 5 && (
                            <div className="text-[10px] text-muted-foreground">+{candidateDomainScan.cveSummary.length - 5} daha</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Shadow IT */}
                    {candidateDomainScan.shadowItServices && candidateDomainScan.shadowItServices.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Shadow IT ({candidateDomainScan.shadowItServices.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {candidateDomainScan.shadowItServices.map((s, i) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] border ${s.risk === "Yüksek" ? "bg-red-50 text-red-700 border-red-200" : s.risk === "Orta" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                              title={s.description}>
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CT Subdomains */}
                    {candidateDomainScan.ctSubdomainCount > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">CT Log Alt Domainleri ({candidateDomainScan.ctSubdomainCount})</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{candidateDomainScan.ctSubdomains.slice(0, 6).join(", ")}{candidateDomainScan.ctSubdomainCount > 6 ? ` +${candidateDomainScan.ctSubdomainCount - 6}` : ""}</div>
                      </div>
                    )}

                    {/* HIBP İhlaleleri */}
                    {candidateDomainScan.hibpBreaches && candidateDomainScan.hibpBreaches.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Veri İhlali Geçmişi</div>
                        <div className="space-y-1">
                          {candidateDomainScan.hibpBreaches.slice(0, 3).map((b, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <span className="font-semibold shrink-0">{b.name}</span>
                              <span className="text-muted-foreground">{b.breachDate}</span>
                              <span className="text-orange-600">{b.pwnCount.toLocaleString("tr-TR")} hesap</span>
                            </div>
                          ))}
                          {candidateDomainScan.hibpBreaches.length > 3 && (
                            <div className="text-[10px] text-muted-foreground">+{candidateDomainScan.hibpBreaches.length - 3} daha</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* ISR Aksiyonları — varsayılan kapalı */}
            <div className="mx-4 mb-2">
              <button
                onClick={() => setIsrOpen(o => !o)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide px-3 py-2 rounded-md border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span>ISR Aksiyonları</span>
                {isrOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {isrOpen && (
                <div className="mt-1 rounded-md border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20 p-3 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={buildLinkedInUrl(detailCandidate)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#0A66C2] text-white hover:bg-[#0057b7] font-medium"
                    >
                      LinkedIn&apos;de Ara
                    </a>
                    <a
                      href={buildSalesNavUrl(detailCandidate)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2]/10 font-medium"
                    >
                      Sales Nav
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="text-muted-foreground mb-0.5">MERSIS Yetkili</div>
                      <div className="font-medium">{detailCandidate.officerName ?? "Bulunamadı"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-0.5">Unvan</div>
                      <div>{detailCandidate.officerTitle ?? "—"}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-muted-foreground mb-0.5">Kontakt E-posta</div>
                      <div className="font-medium">{detailCandidate.contactEmail ?? "Boş"}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">ISR Notları</div>
                    <textarea
                      className="w-full text-xs border rounded-md p-2 resize-none bg-background"
                      rows={3}
                      placeholder="Bu lead için notlarınız..."
                      value={isrNotesEdit}
                      onChange={(e) => setIsrNotesEdit(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="mt-1 text-xs h-7"
                      onClick={() => saveIsrNotes.mutate({ id: detailCandidate.id, notes: isrNotesEdit })}
                      disabled={saveIsrNotes.isPending}
                    >
                      {saveIsrNotes.isPending ? "Kaydediliyor..." : "Notları Kaydet"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Aksiyonlar — sabit alt bar */}
            <div className="flex gap-2 px-4 py-3 border-t shrink-0 flex-wrap bg-background">
              {detailCandidate.isQualified && (
                <Button size="sm" variant="outline" onClick={() => { generateTeaser.mutate(detailCandidate.id); setDetailCandidate(null); }}>
                  {detailCandidate.teaserSubject ? "Teaser Yeniden Üret" : "Teaser Üret"}
                </Button>
              )}
              {detailCandidate.isQualified && (
                <Button size="sm" variant="outline" className="text-purple-600 border-purple-200"
                  onClick={() => { pushToQueue.mutate(detailCandidate); setDetailCandidate(null); }}>
                  ISR Kuyruğuna Ekle
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-cyan-600 border-cyan-200"
                onClick={() => { setFingerprintResult(null); fingerprintLead.mutate(detailCandidate.domain); }}
                disabled={fingerprintLead.isPending}>
                {fingerprintLead.isPending ? "Taranıyor..." : "Tech Fingerprint"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDetailCandidate(null); setFingerprintResult(null); }}>Kapat</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
                <Button
                  variant="outline"
                  onClick={() => { generateTeaser.mutate(teaserPreview.id); setTeaserPreview(null); }}
                  disabled={generateTeaser.isPending}
                >
                  Yeniden Üret
                </Button>
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
      {/* Kontak Düzenleme Dialog */}
      {!!contactEditTarget && (
        <Dialog open={!!contactEditTarget} onOpenChange={() => setContactEditTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Kontak Düzenle — {contactEditTarget.domain}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs mb-1 block">E-posta *</Label>
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="ornek@sirket.com.tr"
                  type="email"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ad Soyad</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ahmet Yılmaz"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Unvan</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="IT Müdürü"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactEditTarget(null)}>Vazgec</Button>
              <Button
                disabled={!editEmail || saveContact.isPending}
                onClick={() =>
                  saveContact.mutate({
                    id: contactEditTarget.id,
                    contactEmail: editEmail,
                    contactName: editName,
                    contactTitle: editTitle,
                  })
                }
              >
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
