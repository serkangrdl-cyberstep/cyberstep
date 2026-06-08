import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Trash2, RefreshCw, Globe, Shield, AlertTriangle,
  CheckCircle2, Clock, Loader2, ClipboardList, Copy, CheckCheck,
  TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface Vendor {
  id: number;
  customerEmail: string;
  supplierDomain: string;
  supplierName: string | null;
  lastScanScore: number | null;
  prevScanScore: number | null;
  lastScanAt: string | null;
  questionnaireStatus: string;
  questionnaireToken: string | null;
  combinedScore: number | null;
  riskLevel: string | null;
  crosssellSentAt: string | null;
  alertSentAt: string | null;
  monitoringActive: boolean;
  addedAt: string;
}

const SECTORS = [
  "Üretim / İmalat", "Perakende / E-ticaret", "Lojistik / Taşımacılık",
  "Finans / Muhasebe", "Sağlık / Klinik", "Yazılım / BT Hizmetleri",
  "İnşaat / Gayrimenkul", "Hukuk / Danışmanlık", "Gıda / Restoran",
  "Diğer",
];

function riskColors(level: string | null) {
  if (level === "Düşük") return { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500" };
  if (level === "Orta")  return { badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",   bar: "bg-amber-500" };
  return { badge: "bg-red-500/20 text-red-400 border-red-500/30", bar: "bg-red-500" };
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">Bekleniyor...</span>;
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums">{score}/100</span>
    </div>
  );
}

function TrendIcon({ current, prev }: { current: number | null; prev: number | null }) {
  if (current === null || prev === null) return null;
  const diff = current - prev;
  if (diff > 5)  return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (diff < -5) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function TedarikciPortfoyu() {
  const customerQuery = useRequireCustomer();
  const customer = customerQuery.data;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newName, setNewName] = useState("");

  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companySector, setCompanySector] = useState("");

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const email = customer?.email ?? "";

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["tprm-vendors", email],
    queryFn: () => fetch(`/api/tprm/vendors?email=${encodeURIComponent(email)}`).then(r => r.json()),
    enabled: !!email,
    refetchInterval: 15000,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "");
      const res = await fetch("/api/tprm/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail: email, supplierDomain: domain, supplierName: newName.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      setAddOpen(false);
      setNewDomain("");
      setNewName("");
      toast({ title: "Tedarikçi eklendi", description: "Arka planda tarama başlatıldı." });
    },
    onError: (e) => toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/tprm/vendors/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tprm-vendors", email] }),
  });

  const rescanMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/tprm/vendors/${id}/rescan`, { method: "POST" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      toast({ title: "Yeniden tarama başlatıldı", description: "Sonuç birkaç dakika içinde güncellenir." });
    },
  });

  const questionnaireMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVendor) throw new Error("Tedarikçi seçilmedi");
      const res = await fetch(`/api/tprm/vendors/${selectedVendor.id}/send-questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companySector }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Hata");
      return res.json() as Promise<{ token: string; link: string; expiresAt: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tprm-vendors", email] });
      setQuestionnaireOpen(false);
      copyToClipboard(data.link, data.token);
      toast({ title: "Anket linki oluşturuldu", description: "Bağlantı panoya kopyalandı." });
    },
    onError: (e) => toast({ title: "Hata", description: (e as Error).message, variant: "destructive" }),
  });

  function copyToClipboard(link: string, token: string) {
    const url = window.location.origin + (link.startsWith("http") ? link.replace(window.location.origin, "") : link);
    navigator.clipboard.writeText(url.startsWith("http") ? url : window.location.origin + link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  function openQuestionnaire(vendor: Vendor) {
    setSelectedVendor(vendor);
    setCompanyName("");
    setCompanySector("");
    setQuestionnaireOpen(true);
  }

  const stats = {
    total: vendors.length,
    high: vendors.filter(v => v.riskLevel === "Yüksek").length,
    mid: vendors.filter(v => v.riskLevel === "Orta").length,
    low: vendors.filter(v => v.riskLevel === "Düşük").length,
    pending: vendors.filter(v => v.lastScanScore === null).length,
  };

  if (!customer) return null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tedarikçi Portföyü</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tedarikçilerinizin siber güvenlik skorlarını sürekli izleyin
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Tedarikçi Ekle
        </Button>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Toplam</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-red-400 mb-1">Yüksek Risk</p>
            <p className="text-2xl font-bold text-red-400">{stats.high}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-amber-400 mb-1">Orta Risk</p>
            <p className="text-2xl font-bold text-amber-400">{stats.mid}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-400 mb-1">Düşük Risk</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.low}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tedarikçi listesi */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vendors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground">Henüz tedarikçi eklenmedi</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Tedarikçilerinizi ekleyin — CyberStep domain taraması yaparak siber güvenlik skorlarını otomatik hesaplar.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              İlk Tedarikçiyi Ekle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {vendors.map(v => {
            const rc = riskColors(v.riskLevel);
            const isExp = expanded === v.id;
            const isRescanning = rescanMutation.isPending && rescanMutation.variables === v.id;

            return (
              <Card key={v.id} className="transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Domain & isim */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate">{v.supplierDomain}</span>
                        {v.supplierName && (
                          <span className="text-xs text-muted-foreground truncate">{v.supplierName}</span>
                        )}
                        {v.riskLevel && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${rc.badge}`}>
                            {v.riskLevel} Risk
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <ScoreBar score={v.lastScanScore} />
                        <TrendIcon current={v.lastScanScore} prev={v.prevScanScore} />
                        {v.lastScanAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Son tarama: {new Date(v.lastScanAt).toLocaleDateString("tr-TR")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Yeniden tara"
                        onClick={() => rescanMutation.mutate(v.id)}
                        disabled={isRescanning}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Tedarikçiyi sil"
                        onClick={() => deleteMutation.mutate(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setExpanded(isExp ? null : v.id)}
                      >
                        {isExp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Detay paneli */}
                  {isExp && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      {/* Anket durumu */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Öz-Değerlendirme Anketi</span>
                          {v.questionnaireStatus === "completed" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Tamamlandı
                            </Badge>
                          )}
                          {v.questionnaireStatus === "pending" && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                              <Clock className="h-3 w-3 mr-1" /> Bekliyor
                            </Badge>
                          )}
                          {v.questionnaireStatus === "none" && (
                            <Badge variant="outline" className="text-[10px]">Gönderilmedi</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {v.questionnaireToken && (
                            <Button
                              variant="outline" size="sm" className="h-7 text-xs gap-1"
                              onClick={() => {
                                const link = `/tprm/anket/${v.questionnaireToken}`;
                                copyToClipboard(link, v.questionnaireToken!);
                              }}
                            >
                              {copiedToken === v.questionnaireToken
                                ? <><CheckCheck className="h-3 w-3" /> Kopyalandı</>
                                : <><Copy className="h-3 w-3" /> Linki Kopyala</>}
                            </Button>
                          )}
                          <Button
                            variant="outline" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => openQuestionnaire(v)}
                          >
                            <ClipboardList className="h-3 w-3" />
                            {v.questionnaireStatus === "none" ? "Anket Gönder" : "Yeni Anket"}
                          </Button>
                        </div>
                      </div>

                      {/* Bileşik skor */}
                      {v.combinedScore !== null && (
                        <div className="rounded-lg bg-muted/30 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Bileşik Skor (Tarama + Anket)</p>
                            <p className="text-2xl font-bold mt-0.5">{v.combinedScore}/100</p>
                          </div>
                          <Shield className={`h-8 w-8 ${v.combinedScore >= 70 ? "text-emerald-400" : v.combinedScore >= 40 ? "text-amber-400" : "text-red-400"}`} />
                        </div>
                      )}

                      {/* Uyarı bildirimleri */}
                      {v.alertSentAt && (
                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Skor düşüşü uyarısı gönderildi — {new Date(v.alertSentAt).toLocaleDateString("tr-TR")}
                        </div>
                      )}

                      {/* Tedarikçi URL */}
                      <a
                        href={`https://${v.supplierDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {v.supplierDomain} sitesini aç
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tedarikçi Ekle Dialogu */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tedarikçi Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Domain Adresi *</Label>
              <Input
                placeholder="ornek.com"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">https:// olmadan yazın. Tarama otomatik başlar.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tedarikçi Adı (opsiyonel)</Label>
              <Input
                placeholder="ABC Yazılım A.S."
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Vazgeç</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!newDomain.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Ekleniyor...</> : "Ekle ve Tara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anket Linki Oluştur Dialogu */}
      <Dialog open={questionnaireOpen} onOpenChange={setQuestionnaireOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Anket Linki Oluştur</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{selectedVendor?.supplierDomain}</strong> için tedarikçiye gönderilecek öz-değerlendirme linki.
          </p>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Şirket Adınız *</Label>
              <Input
                placeholder="Kendi şirket adınız"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sektörünüz *</Label>
              <Select value={companySector} onValueChange={setCompanySector}>
                <SelectTrigger>
                  <SelectValue placeholder="Sektör seçin" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionnaireOpen(false)}>Vazgeç</Button>
            <Button
              onClick={() => questionnaireMutation.mutate()}
              disabled={!companyName.trim() || !companySector || questionnaireMutation.isPending}
            >
              {questionnaireMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Oluşturuluyor...</>
                : <><ClipboardList className="h-4 w-4 mr-1.5" />Linki Oluştur</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
