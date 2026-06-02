import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, CheckCircle2, XCircle, Download, Search, AlertTriangle,
  BarChart3, Shield, Loader2, ChevronLeft, ChevronRight,
  Play, Trash2, FileDown, Eye, FileCheck, Clock, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface DomainScanStats {
  total: number;
  avgScore: number;
  passRates: {
    spf: number; dmarc: number; dkim: number; mx: number; ssl: number;
    cleanBlacklist: number; cleanHibp: number;
  };
  monthly: Array<{ month: string; scan_count: number; avg_score: number }>;
}

interface DomainScanRow {
  id: number;
  domain: string;
  email: string | null;
  overallScore: number;
  spfPass: boolean;
  dmarcPass: boolean;
  dkimPass: boolean;
  mxPass: boolean;
  sslPass: boolean;
  hibpBreachCount: number;
  blacklisted: boolean;
  shadowItServices: Array<{ name: string; category: string; risk: string; description: string }>;
  createdAt: string;
}

interface DomainScanDetail extends DomainScanRow {
  spfRecord: string | null;
  dmarcRecord: string | null;
  dkimSelectors: string[];
  mxRecords: Array<{ exchange: string; priority: number }>;
  sslExpiry: string | null;
  sslIssuer: string | null;
  sslDaysUntilExpiry: number | null;
  hibpBreaches: Array<{ name: string; breachDate: string; pwnCount: number; dataClasses: string[] }>;
  blacklistCount: number;
  blacklistResults: Array<{ list: string; listed: boolean }>;
  httpHeadersScore: number;
  httpHeadersDetails: { hsts: boolean; xFrameOptions: boolean; xContentTypeOptions: boolean; csp: boolean; referrerPolicy: boolean } | null;
  urlhausListed: boolean;
  urlhausThreat: string | null;
  usomListed: boolean;
  virusTotalReputation: number | null;
  virusTotalMalicious: number;
  virusTotalSuspicious: number;
  abuseIpdbScore: number | null;
  abuseIpdbTotalReports: number;
  shodanVulnCount: number;
  shodanOpenPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  cveSummary: Array<{ service: string; cveId: string; description: string; cvssScore: number }>;
  safeBrowsingFlagged: boolean | null;
  safeBrowsingThreats: string[];
  sslLabsGrade: string | null;
}

interface SmartCheck {
  label: string;
  pass: boolean;
  critical: boolean;
  category: string;
}

function buildSmartMatrix(scan: DomainScanDetail): SmartCheck[] {
  const checks: SmartCheck[] = [
    { label: "SPF Kaydı", pass: scan.spfPass, critical: !scan.spfPass, category: "DNS" },
    { label: "DMARC Kaydı", pass: scan.dmarcPass, critical: !scan.dmarcPass, category: "DNS" },
    { label: "DKIM Kaydı", pass: scan.dkimPass, critical: !scan.dkimPass, category: "DNS" },
    { label: "MX Kayıtları", pass: scan.mxPass, critical: false, category: "DNS" },
    { label: "SSL Sertifikası", pass: scan.sslPass, critical: !scan.sslPass, category: "SSL" },
    { label: "DNSBL Kara Liste Temiz", pass: !scan.blacklisted, critical: scan.blacklisted, category: "İtibar" },
    { label: "Veri İhlali Yok (HIBP)", pass: scan.hibpBreachCount === 0, critical: scan.hibpBreachCount > 0, category: "İtibar" },
    { label: "URLhaus Temiz", pass: !scan.urlhausListed, critical: scan.urlhausListed, category: "Tehdit" },
    { label: "USOM Temiz", pass: !scan.usomListed, critical: scan.usomListed, category: "Tehdit" },
    { label: "HTTP Güvenlik Başlıkları", pass: scan.httpHeadersScore >= 3, critical: scan.httpHeadersScore === 0, category: "Web" },
  ];
  if (scan.sslDaysUntilExpiry !== null) {
    const days = scan.sslDaysUntilExpiry ?? 999;
    checks.push({ label: "SSL Sona Erme (>30 gün)", pass: days > 30, critical: days < 14, category: "SSL" });
  }
  if (scan.virusTotalReputation !== null) {
    checks.push({ label: "VirusTotal Temiz", pass: scan.virusTotalMalicious === 0, critical: scan.virusTotalMalicious > 0, category: "Tehdit" });
  }
  if (scan.abuseIpdbScore !== null) {
    const score = scan.abuseIpdbScore ?? 0;
    checks.push({ label: "AbuseIPDB İtibarı", pass: score < 25, critical: score >= 50, category: "İtibar" });
  }
  if (scan.shodanOpenPorts !== null) {
    checks.push({ label: "Kritik Açık Yok (Shodan)", pass: scan.shodanVulnCount === 0, critical: scan.shodanVulnCount > 0, category: "Altyapı" });
  }
  if (scan.safeBrowsingFlagged !== null) {
    checks.push({ label: "Google Safe Browsing", pass: !scan.safeBrowsingFlagged, critical: scan.safeBrowsingFlagged === true, category: "İtibar" });
  }
  if (scan.sslLabsGrade) {
    const gradeOk = ["A+", "A", "A-", "B"].includes(scan.sslLabsGrade);
    const gradeCrit = ["D", "E", "F", "T", "M"].includes(scan.sslLabsGrade);
    checks.push({ label: `SSLLabs Notu (${scan.sslLabsGrade})`, pass: gradeOk, critical: gradeCrit, category: "SSL" });
  }
  return checks;
}

interface ScanList {
  total: number;
  page: number;
  rows: DomainScanRow[];
}

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  if (s >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(s: number) {
  if (s >= 80) return "bg-emerald-500/20";
  if (s >= 60) return "bg-amber-500/20";
  if (s >= 40) return "bg-orange-500/20";
  return "bg-red-500/20";
}

function PassBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}>%{pct}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CheckDot({ label, pass }: { label: string; pass: boolean }) {
  return (
    <span
      title={label}
      className={`text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold ${pass ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
    >
      {label}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const cls = risk === "Yüksek" ? "bg-red-500/20 text-red-400 border-red-500/30"
    : risk === "Orta" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-slate-700 text-slate-400 border-slate-600";
  return <Badge className={`${cls} text-xs`}>{risk}</Badge>;
}

function DetailModal({ scanId, onClose }: { scanId: number; onClose: () => void }) {
  const { data: scan, isLoading } = useQuery<DomainScanDetail>({
    queryKey: ["admin-domain-detail", scanId],
    queryFn: () => fetch(`/api/admin-panel/domain-scans/${scanId}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white font-mono text-base">
            {isLoading ? "Yükleniyor..." : scan?.domain}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        )}

        {scan && (
          <div className="space-y-5">
            {/* Smart Matrix */}
            {(() => {
              const checks = buildSmartMatrix(scan);
              const total = checks.length;
              const passed = checks.filter(c => c.pass).length;
              const failed = checks.filter(c => !c.pass);
              const criticalCount = failed.filter(c => c.critical).length;
              const warningCount = failed.filter(c => !c.critical).length;
              return (
                <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{total} güvenlik denetimi tamamlandı</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {passed} başarılı
                        {criticalCount > 0 && <span className="text-red-400 ml-1">· {criticalCount} acil müdahale gerektiriyor</span>}
                        {warningCount > 0 && <span className="text-amber-400 ml-1">· {warningCount} öneri</span>}
                      </div>
                    </div>
                    <div className={`text-2xl font-black ${passed === total ? "text-emerald-400" : criticalCount > 0 ? "text-red-400" : "text-amber-400"}`}>
                      {passed}/{total}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex gap-0.5">
                    <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${(passed / total) * 100}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${(criticalCount / total) * 100}%` }} />
                    <div className="h-full bg-amber-500 rounded-r-full" style={{ width: `${(warningCount / total) * 100}%` }} />
                  </div>
                  {failed.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {failed.map(c => (
                        <div key={c.label} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded ${c.critical ? "bg-red-500/10 border border-red-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                          <XCircle className={`h-3 w-3 shrink-0 ${c.critical ? "text-red-400" : "text-amber-400"}`} />
                          <span className={c.critical ? "text-red-300" : "text-amber-300"}>{c.label}</span>
                          <span className="text-slate-600 text-xs ml-1">{c.category}</span>
                          {c.critical && <span className="ml-auto text-red-500 font-semibold text-xs">Acil</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Score */}
            <div className={`flex items-center gap-4 p-4 rounded-lg ${scoreBg(scan.overallScore)}`}>
              <div className={`text-5xl font-black ${scoreColor(scan.overallScore)}`}>{scan.overallScore}</div>
              <div>
                <div className="text-slate-300 text-sm font-medium">Genel Güvenlik Skoru</div>
                <div className="text-slate-500 text-xs mt-0.5">
                  {new Date(scan.createdAt).toLocaleString("tr-TR")}
                  {scan.email && <> · {scan.email}</>}
                </div>
              </div>
            </div>

            {/* DNS Checks */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">DNS & E-posta Güvenliği</h3>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
                  {scan.spfPass ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">SPF</div>
                    {scan.spfRecord
                      ? <p className="text-xs text-slate-400 font-mono break-all mt-0.5">{scan.spfRecord}</p>
                      : <p className="text-xs text-red-400 mt-0.5">SPF kaydı bulunamadı</p>
                    }
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
                  {scan.dmarcPass ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">DMARC</div>
                    {scan.dmarcRecord
                      ? <p className="text-xs text-slate-400 font-mono break-all mt-0.5">{scan.dmarcRecord}</p>
                      : <p className="text-xs text-red-400 mt-0.5">DMARC kaydı bulunamadı</p>
                    }
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
                  {scan.dkimPass ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">DKIM</div>
                    {scan.dkimSelectors.length > 0
                      ? <div className="flex flex-wrap gap-1 mt-1">{scan.dkimSelectors.map(s => <span key={s} className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded font-mono">{s}</span>)}</div>
                      : <p className="text-xs text-red-400 mt-0.5">Bilinen DKIM selektörleri bulunamadı</p>
                    }
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
                  {scan.mxPass ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">MX Kayıtları</div>
                    {scan.mxRecords.length > 0
                      ? <div className="flex flex-col gap-0.5 mt-1">{scan.mxRecords.map(m => <span key={m.exchange} className="text-xs text-slate-400 font-mono">{m.priority} {m.exchange}</span>)}</div>
                      : <p className="text-xs text-red-400 mt-0.5">MX kaydı bulunamadı</p>
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* SSL */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">SSL / TLS</h3>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
                {scan.sslPass ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                <div>
                  {scan.sslIssuer && <p className="text-sm text-white">{scan.sslIssuer}</p>}
                  {scan.sslExpiry && (
                    <p className={`text-xs mt-0.5 ${(scan.sslDaysUntilExpiry ?? 999) < 30 ? "text-amber-400" : "text-slate-400"}`}>
                      Bitiş: {new Date(scan.sslExpiry).toLocaleDateString("tr-TR")}
                      {scan.sslDaysUntilExpiry != null && ` (${scan.sslDaysUntilExpiry} gün kaldı)`}
                    </p>
                  )}
                  {!scan.sslPass && !scan.sslIssuer && <p className="text-xs text-red-400">SSL sertifikası geçersiz veya bulunamadı</p>}
                {scan.sslLabsGrade && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">SSLLabs Notu:</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${["A+", "A"].includes(scan.sslLabsGrade) ? "bg-emerald-500/15 text-emerald-400" : ["A-", "B"].includes(scan.sslLabsGrade) ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                      {scan.sslLabsGrade}
                    </span>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Google Safe Browsing */}
            {scan.safeBrowsingFlagged === true && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-red-400" />
                  Google Safe Browsing — Tehdit Tespit Edildi
                </h3>
                <div className="p-3 rounded-lg bg-slate-800 border border-red-500/30">
                  <p className="text-sm text-red-300 font-medium">Bu domain Google tarafından tehlikeli olarak işaretlenmiş</p>
                  {scan.safeBrowsingThreats.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {scan.safeBrowsingThreats.map(t => (
                        <span key={t} className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded border border-red-500/20">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HIBP */}
            {scan.hibpBreachCount > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-red-400" />
                  Veri İhlalleri ({scan.hibpBreachCount})
                </h3>
                <div className="space-y-2">
                  {scan.hibpBreaches.map(b => (
                    <div key={b.name} className="p-3 rounded-lg bg-slate-800 border border-red-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-red-300">{b.name}</span>
                        <span className="text-xs text-slate-500">{b.breachDate}</span>
                      </div>
                      <p className="text-xs text-slate-400">{b.pwnCount.toLocaleString("tr-TR")} hesap etkilendi</p>
                      {b.dataClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {b.dataClasses.map(d => <span key={d} className="bg-red-500/10 text-red-400 text-xs px-1.5 py-0.5 rounded">{d}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blacklist */}
            {scan.blacklisted && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <XCircle className="h-3.5 w-3.5 inline mr-1 text-red-400" />
                  Kara Liste ({scan.blacklistCount} liste)
                </h3>
                <div className="space-y-1">
                  {scan.blacklistResults.filter(r => r.listed).map(r => (
                    <div key={r.list} className="flex items-center gap-2 p-2 rounded bg-slate-800">
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-xs text-red-300 font-mono">{r.list}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shadow IT */}
            {scan.shadowItServices.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Gölge BT Servisleri ({scan.shadowItServices.length})
                </h3>
                <div className="space-y-2">
                  {scan.shadowItServices.map(s => (
                    <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
                      <RiskBadge risk={s.risk} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{s.name}</span>
                          <span className="text-xs text-slate-500">{s.category}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDomainTaramalar() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [scanDomain, setScanDomain] = useState("");
  const [scanEmail, setScanEmail] = useState("");
  const [showScanForm, setShowScanForm] = useState(false);

  const { data: stats } = useQuery<DomainScanStats>({
    queryKey: ["admin-domain-stats"],
    queryFn: () => fetch("/api/admin-panel/domain-scans/stats", { credentials: "include" }).then(r => r.json()),
  });

  interface ScheduledScanRow {
    id: number; domain: string; email: string | null;
    overall_score: number; created_at: string; notified_at: string | null;
  }
  const { data: scheduled } = useQuery<{ overdue: ScheduledScanRow[]; upcoming: ScheduledScanRow[]; completed: ScheduledScanRow[] }>({
    queryKey: ["admin-domain-scheduled"],
    queryFn: () => fetch("/api/admin-panel/domain-scans/scheduled", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: list, isLoading } = useQuery<ScanList>({
    queryKey: ["admin-domain-scans", q, page],
    queryFn: () => fetch(`/api/admin-panel/domain-scans?q=${encodeURIComponent(q)}&page=${page}`, { credentials: "include" }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/domain-scans/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-domain-scans"] });
      qc.invalidateQueries({ queryKey: ["admin-domain-stats"] });
      setDeleteId(null);
      toast({ title: "Tarama silindi" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/domain-scans/scan", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: scanDomain.trim(), email: scanEmail.trim() || undefined }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "Tarama başarısız", description: data.error, variant: "destructive" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-domain-scans"] });
      qc.invalidateQueries({ queryKey: ["admin-domain-stats"] });
      setShowScanForm(false);
      setScanDomain(""); setScanEmail("");
      toast({ title: `Tarama tamamlandı — skor: ${data.overallScore}` });
      if (data.id) setDetailId(data.id);
    },
    onError: () => toast({ title: "Tarama hatası", variant: "destructive" }),
  });

  async function downloadPDF(id: number, domain: string) {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/domain-scan/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Domain_${domain}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "PDF indirilemedi", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

  const [passportId, setPassportId] = useState<number | null>(null);
  async function downloadPassport(id: number, domain: string) {
    setPassportId(id);
    try {
      const res = await fetch(`/api/domain-scan/${id}/passport`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Pasaport_${domain}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Pasaport indirilemedi", variant: "destructive" });
    } finally {
      setPassportId(null);
    }
  }

  function exportCSV() {
    window.open("/api/admin-panel/domain-scans/export", "_blank");
  }

  const monthlyData = (stats?.monthly ?? []).map(m => ({
    month: m.month.slice(5),
    Tarama: m.scan_count,
    "Ort. Skor": m.avg_score,
  }));

  const totalPages = Math.ceil((list?.total ?? 0) / 50);

  return (
    <AdminLayout title="Alan Adı Taramaları" description="Tüm domain güvenlik taramalarını yönetin">
      <div className="space-y-6 max-w-6xl">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Toplam Tarama</p>
                <p className="text-3xl font-bold text-white">{stats?.total ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Ortalama Güvenlik Skoru</p>
                <p className={`text-3xl font-bold ${scoreColor(stats?.avgScore ?? 0)}`}>{stats?.avgScore ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-6 w-6 text-sky-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">SSL Geçiş Oranı</p>
                <p className={`text-3xl font-bold ${scoreColor(stats?.passRates?.ssl ?? 0)}`}>%{stats?.passRates?.ssl ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Kontrol Geçiş Oranları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats ? <>
                <PassBar label="SPF" pct={stats.passRates.spf} />
                <PassBar label="DMARC" pct={stats.passRates.dmarc} />
                <PassBar label="DKIM" pct={stats.passRates.dkim} />
                <PassBar label="MX" pct={stats.passRates.mx} />
                <PassBar label="SSL/TLS" pct={stats.passRates.ssl} />
                <PassBar label="Kara Liste Temiz" pct={stats.passRates.cleanBlacklist} />
                <PassBar label="HIBP Temiz" pct={stats.passRates.cleanHibp} />
              </> : <p className="text-slate-500 text-sm">Yükleniyor...</p>}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Aylık Tarama Aktivitesi</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#10b981" }}
                    />
                    <Bar dataKey="Tarama" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-500 text-sm pt-8 text-center">Henüz yeterli veri yok</p>}
            </CardContent>
          </Card>
        </div>

        {/* Scheduled / Upcoming Re-Scans */}
        {scheduled && (scheduled.overdue.length > 0 || scheduled.upcoming.length > 0 || scheduled.completed.length > 0) && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-sky-400" />
                Otomatik Yeniden Taramalar
                <span className="text-xs font-normal text-slate-400 ml-1">(30 günde bir, e-posta kayıtlı domainler)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-400">{scheduled.overdue.length}</p>
                  <p className="text-xs text-red-300 mt-0.5">Vadesi Geçmiş</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">30+ gün önce tarandı</p>
                </div>
                <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3">
                  <p className="text-2xl font-bold text-amber-400">{scheduled.upcoming.length}</p>
                  <p className="text-xs text-amber-300 mt-0.5">Yaklaşıyor</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">25-30 gün önce tarandı</p>
                </div>
                <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-3">
                  <p className="text-2xl font-bold text-emerald-400">{scheduled.completed.length}</p>
                  <p className="text-xs text-emerald-300 mt-0.5">Tamamlanan</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Yeniden tarandı</p>
                </div>
              </div>

              {scheduled.overdue.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Vadesi Geçmiş — Cron Bu Gece Tarayacak
                  </p>
                  <div className="space-y-1">
                    {scheduled.overdue.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-slate-900 rounded px-3 py-2 text-sm">
                        <span className="text-white font-medium">{r.domain}</span>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{r.email}</span>
                          <span className={scoreColor(r.overall_score)}>Skor: {r.overall_score}</span>
                          <span>{new Date(r.created_at).toLocaleDateString("tr-TR")}</span>
                          <Button size="sm" variant="ghost"
                            className="h-6 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 px-2 py-0"
                            onClick={() => { setScanDomain(r.domain); setScanEmail(r.email ?? ""); setShowScanForm(true); }}>
                            Şimdi Tara
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scheduled.upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Yakında Yeniden Taranacak (5 gün içinde)
                  </p>
                  <div className="space-y-1">
                    {scheduled.upcoming.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-slate-900 rounded px-3 py-2 text-sm">
                        <span className="text-white font-medium">{r.domain}</span>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{r.email}</span>
                          <span className={scoreColor(r.overall_score)}>Skor: {r.overall_score}</span>
                          <span>{new Date(r.created_at).toLocaleDateString("tr-TR")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Domain veya e-posta..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setQ(search); setPage(1); } }}
                className="pl-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              onClick={() => { setQ(search); setPage(1); }}>
              Ara
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={exportCSV}>
              <FileDown className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowScanForm(true)}>
              <Play className="h-4 w-4 mr-1.5" /> Yeni Tarama
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Domain</th>
                  <th className="px-4 py-3 text-left">E-posta</th>
                  <th className="px-4 py-3 text-center">Skor</th>
                  <th className="px-4 py-3 text-center">Kontroller</th>
                  <th className="px-4 py-3 text-center">HIBP</th>
                  <th className="px-4 py-3 text-center">Kara Liste</th>
                  <th className="px-4 py-3 text-center">Gölge BT</th>
                  <th className="px-4 py-3 text-center">KEP</th>
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Yükleniyor...
                  </td></tr>
                )}
                {!isLoading && (list?.rows ?? []).length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Tarama bulunamadı</td></tr>
                )}
                {(list?.rows ?? []).map(scan => {
                  const highRisk = (scan.shadowItServices ?? []).filter(s => s.risk === "Yüksek").length;
                  return (
                    <tr key={scan.id}
                      className="hover:bg-slate-700/40 cursor-pointer transition-colors"
                      onClick={() => setDetailId(scan.id)}
                    >
                      <td className="px-4 py-3 font-mono text-white font-medium text-xs">{scan.domain}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{scan.email ?? <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-bold ${scoreColor(scan.overallScore)}`}>{scan.overallScore}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <CheckDot label="S" pass={scan.spfPass} />
                          <CheckDot label="D" pass={scan.dmarcPass} />
                          <CheckDot label="K" pass={scan.dkimPass} />
                          <CheckDot label="M" pass={scan.mxPass} />
                          <CheckDot label="L" pass={scan.sslPass} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {scan.hibpBreachCount > 0
                          ? <span className="text-red-400 text-xs font-medium flex items-center justify-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" />{scan.hibpBreachCount}
                            </span>
                          : <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {scan.blacklisted
                          ? <XCircle className="h-4 w-4 text-red-400 inline" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {highRisk > 0
                          ? <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">{highRisk} yüksek</Badge>
                          : <span className="text-slate-600 text-xs">{(scan.shadowItServices ?? []).length} servis</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(scan as any).kepConfigured === true
                          ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Aktif</Badge>
                          : (scan as any).kepConfigured === false
                          ? <span className="text-slate-600 text-xs">Yok</span>
                          : <span className="text-slate-700 text-xs">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(scan.createdAt).toLocaleDateString("tr-TR")}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm" variant="outline"
                            className="h-7 w-7 p-0 border-slate-600 text-slate-300 hover:bg-slate-700"
                            onClick={() => setDetailId(scan.id)}
                            title="Detay"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-7 w-7 p-0 border-slate-600 text-slate-300 hover:bg-slate-700"
                            onClick={() => downloadPDF(scan.id, scan.domain)}
                            disabled={downloadingId === scan.id}
                            title="PDF İndir"
                          >
                            {downloadingId === scan.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Download className="h-3.5 w-3.5" />
                            }
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-7 w-7 p-0 border-slate-600 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                            onClick={() => downloadPassport(scan.id, scan.domain)}
                            disabled={passportId === scan.id}
                            title="Dijital Pasaport PDF"
                          >
                            {passportId === scan.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <FileCheck className="h-3.5 w-3.5" />
                            }
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-7 w-7 p-0 border-slate-600 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
                            onClick={() => setDeleteId(scan.id)}
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
              <span className="text-slate-500 text-xs">{list?.total ?? 0} tarama, sayfa {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 px-2"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Detail modal */}
      {detailId && <DetailModal scanId={detailId} onClose={() => setDetailId(null)} />}

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Taramayı Sil</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Bu domain tarama kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New scan dialog */}
      <Dialog open={showScanForm} onOpenChange={setShowScanForm}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Yeni Domain Tarama</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Alan Adı <span className="text-red-400">*</span></label>
              <Input
                placeholder="örn. sirketiniz.com"
                value={scanDomain}
                onChange={e => setScanDomain(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                onKeyDown={e => e.key === "Enter" && !scanMutation.isPending && scanDomain.trim() && scanMutation.mutate()}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">E-posta (isteğe bağlı)</label>
              <Input
                placeholder="örn. info@sirket.com"
                value={scanEmail}
                onChange={e => setScanEmail(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <p className="text-xs text-slate-500">Tarama DNS, SSL, HIBP ve Shadow IT kontrollerini çalıştırır. Birkaç saniye sürebilir.</p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => { setShowScanForm(false); setScanDomain(""); setScanEmail(""); }}>
                Vazgeç
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!scanDomain.trim() || scanMutation.isPending}
                onClick={() => scanMutation.mutate()}
              >
                {scanMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Taranıyor...</>
                  : <><Play className="h-4 w-4 mr-2" /> Taramayı Başlat</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
