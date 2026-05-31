import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield, LogOut, Building2, TrendingUp, FileText, CheckCircle2,
  AlertTriangle, Clock, Lock, ChevronRight, Loader2, Telescope,
  Mail, Phone, MessageSquare, Star, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";
import { useMutation as useLogout, useQueryClient } from "@tanstack/react-query";

interface ProspectData {
  id: number;
  domain: string;
  companyName: string;
  status: string;
  overallRiskScore: number | null;
  riskLevel: string | null;
  previewToken: string | null;
  teaserHeadline: string | null;
  criticalCount: number | null;
  highCount: number | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Analiz Bekliyor", color: "text-slate-400" },
  scanning: { label: "Taranıyor...", color: "text-yellow-400" },
  scanned: { label: "Tarandı", color: "text-blue-400" },
  teaser_sent: { label: "Rapor Gönderildi", color: "text-purple-400" },
  interested: { label: "Ilgileniyor", color: "text-emerald-400" },
  won: { label: "Musteri", color: "text-emerald-500" },
  lost: { label: "Ilgilenmiyor", color: "text-slate-500" },
};

const RISK_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-emerald-400",
};

export default function EnterpriseTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: customer } = useRequireCustomer();
  const [contactOpen, setContactOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  const logoutMutation = useLogout({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  const { data: prospect, isLoading } = useQuery<ProspectData | null>({
    queryKey: ["my-enterprise-prospect"],
    queryFn: () => fetch("/api/enterprise/my-prospect", { credentials: "include" }).then(async r => {
      if (r.status === 404) return null;
      return r.json();
    }),
    enabled: !!customer,
    staleTime: 1000 * 30,
    refetchInterval: (query) => {
      const d = query.state.data as ProspectData | null | undefined;
      return d?.status === "scanning" ? 5000 : false;
    },
  });

  const contactMutation = useMutation({
    mutationFn: (data: { name: string; phone: string; message: string }) =>
      fetch(`/api/enterprise/my-prospect/contact`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Mesajınız iletildi", description: "En kısa sürede sizi arayacağız." });
      setContactOpen(false);
      setForm({ name: "", phone: "", message: "" });
    },
    onError: () => toast({ title: "Hata", description: "Mesaj gönderilemedi.", variant: "destructive" }),
  });

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-500" />
              <span className="font-bold text-lg text-white">CyberStep.io</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/hesabim" className="text-slate-400 hover:text-white text-sm transition-colors">Hesabım</Link>
              <Link href="/raporlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Raporlarım</Link>
              <Link href="/entegrasyonlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Entegrasyonlar</Link>
              <Link href="/pentest-lite" className="text-slate-400 hover:text-white text-sm transition-colors">Pentest Lite</Link>
              <Link href="/hesabim/yonetim-raporu" className="text-slate-400 hover:text-white text-sm transition-colors">YK Raporu</Link>
              <Link href="/hesabim/enterprise" className="text-white text-sm font-medium">Enterprise</Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Telescope className="h-6 w-6 text-purple-400" /> Enterprise Güvenlik
          </h1>
          <p className="text-slate-400 mt-1">
            Kurumsal siber güvenlik analizi ve yönetilen hizmet teklifiniz
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
          </div>
        )}

        {!isLoading && !prospect && (
          <NoProspectCard customerEmail={customer.email} customerName={customer.fullName} />
        )}

        {prospect && (
          <>
            {/* Status card */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-purple-400" />
                      {prospect.companyName || prospect.domain}
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-1">{prospect.domain}</CardDescription>
                  </div>
                  <Badge className={`${STATUS_LABELS[prospect.status]?.color ?? "text-slate-400"} bg-slate-800 border-slate-700 text-xs`}>
                    {STATUS_LABELS[prospect.status]?.label ?? prospect.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {prospect.status === "scanning" && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <Loader2 className="h-5 w-5 text-yellow-400 animate-spin shrink-0" />
                    <div>
                      <p className="text-yellow-300 text-sm font-medium">Domain'iniz taranıyor</p>
                      <p className="text-slate-400 text-xs mt-0.5">Bu işlem 1-2 dakika sürer. Sayfa otomatik güncellenecek.</p>
                    </div>
                  </div>
                )}

                {prospect.overallRiskScore !== null && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Risk Skoru</p>
                      <p className={`text-2xl font-bold ${RISK_COLORS[prospect.riskLevel ?? ""] ?? "text-white"}`}>
                        {prospect.overallRiskScore}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">/100</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Risk Seviyesi</p>
                      <p className={`text-sm font-semibold capitalize ${RISK_COLORS[prospect.riskLevel ?? ""] ?? "text-white"}`}>
                        {prospect.riskLevel === "critical" ? "Kritik" :
                          prospect.riskLevel === "high" ? "Yüksek" :
                          prospect.riskLevel === "medium" ? "Orta" : "Düsük"}
                      </p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Kritik Bulgu</p>
                      <p className="text-2xl font-bold text-red-400">{prospect.criticalCount ?? 0}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Yüksek Bulgu</p>
                      <p className="text-2xl font-bold text-orange-400">{prospect.highCount ?? 0}</p>
                    </div>
                  </div>
                )}

                {prospect.teaserHeadline && (
                  <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                    <p className="text-slate-300 text-sm leading-relaxed">{prospect.teaserHeadline}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  {prospect.previewToken && (
                    <Link href={`/preview/${prospect.previewToken}`}>
                      <Button className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white">
                        <FileText className="h-4 w-4 mr-2" /> Teaser Raporu Görüntüle
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-slate-600 text-slate-300 hover:text-white hover:border-slate-500"
                    onClick={() => setContactOpen(true)}
                  >
                    <Phone className="h-4 w-4 mr-2" /> Uzman ile Görüş
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Enterprise features */}
            <EnterpriseFeatureList />

            {/* Contact form */}
            {contactOpen && (
              <Card className="bg-slate-900 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-400" /> Uzman ile İletişim
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Ekibimiz sizi en kısa sürede arayacak.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 text-xs">Ad Soyad</Label>
                      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Ad Soyad" />
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs">Telefon</Label>
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="+90 5xx xxx xx xx" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Mesaj (opsiyonel)</Label>
                    <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white mt-1 min-h-[80px]"
                      placeholder="İhtiyacınızı kısaca açıklayın..." />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="ghost" className="text-slate-400" onClick={() => setContactOpen(false)}>İptal</Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={!form.name || !form.phone || contactMutation.isPending}
                      onClick={() => contactMutation.mutate(form)}
                    >
                      {contactMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Gönder
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NoProspectCard({ customerEmail, customerName }: { customerEmail: string; customerName: string }) {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-purple-500/20">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Telescope className="h-7 w-7 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Enterprise Analizi Henüz Hazır Değil</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Uzman ekibimiz domain'inizi proaktif olarak tarayarak kişiselleştirilmiş bir teaser raporu hazırlayacak.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Clock className="h-3.5 w-3.5" />
            <span>Analiz talebi oluşturduktan sonra 24 saat içinde hazır</span>
          </div>
          <a href="mailto:enterprise@cyberstep.io?subject=Enterprise%20Analiz%20Talebi&body=Merhaba%2C%20kurumsal%20güvenlik%20analizi%20hakkında%20bilgi%20almak%20istiyorum.%0A%0AAd%20Soyad%3A%20">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white mt-2">
              <Mail className="h-4 w-4 mr-2" /> Enterprise Analiz Talep Et
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </a>
        </CardContent>
      </Card>

      <EnterpriseFeatureList />
    </div>
  );
}

function EnterpriseFeatureList() {
  const features = [
    { icon: Shield, title: "Proaktif Domain Taraması", desc: "Saldırganların bakış açısıyla 200+ kontrol noktası" },
    { icon: AlertTriangle, title: "MITRE ATT&CK Analizi", desc: "Sektörünüze özgü saldırı senaryoları ve zincir analizi" },
    { icon: TrendingUp, title: "Sürekli İzleme", desc: "7/24 otomatik yeniden tarama ve anlık uyarı sistemi" },
    { icon: CheckCircle2, title: "Uyum Raporlama", desc: "ISO 27001, KVKK, BDDK için hazır rapor şablonları" },
    { icon: Star, title: "Yönetilen SOC Desteği", desc: "Dedike güvenlik analistleri ile olay müdahale" },
    { icon: Lock, title: "Sıfır Kurulum", desc: "Altyapınıza erişim gerektirmez, tamamen pasif analiz" },
  ];

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base">Enterprise Paketi Kapsamı</CardTitle>
        <CardDescription className="text-slate-400">
          Standart planın ötesinde kurumsal düzey koruma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map(f => (
            <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800">
              <f.icon className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium">{f.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
