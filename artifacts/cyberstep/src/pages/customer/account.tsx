import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, ShieldOff, QrCode, KeyRound, LogOut, CheckCircle2, AlertTriangle, ArrowRight, User, Building2, Mail, CreditCard, FileText, Heart, TrendingDown, TrendingUp, Search, Users, Package, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";
import { useQuery } from "@tanstack/react-query";

interface MyServiceItem {
  subscription: { serviceSlug: string; serviceLabel: string; status: string };
  onboardingSteps: { side: string; status: string }[];
  onboardingProgress: number;
}

function ActiveServicesWidget() {
  const { data: myServices = [] } = useQuery<MyServiceItem[]>({
    queryKey: ["my-services"],
    queryFn: async () => {
      const res = await fetch("/api/customer/my-services", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const active = myServices.filter(m => m.subscription.status === "active");
  const pendingSteps = active.flatMap(m => m.onboardingSteps.filter(s => s.side === "customer" && s.status === "pending"));

  if (active.length === 0) return null;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-sky-400" /> Aktif Servislerim
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-slate-400 text-sm">{active.length} aktif servis</span>
            {pendingSteps.length > 0 && (
              <Badge className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/30 gap-1">
                <Settings className="w-2.5 h-2.5" />
                {pendingSteps.length} adim bekliyor
              </Badge>
            )}
          </div>
        </div>
        <Link href="/hesabim/servislerim">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 shrink-0 gap-2">
            <Package className="h-4 w-4" />
            Servisleri Yonet <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function CustomerAccount() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: customer } = useRequireCustomer();

  const [totpStep, setTotpStep] = useState<"idle" | "setup" | "done">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      fetch("/api/auth/totp-setup", { method: "POST", credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json() as Promise<{ secret: string; qrDataUrl: string }>;
      }),
    onSuccess: (data) => {
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setTotpStep("setup");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (tok: string) =>
      fetch("/api/auth/totp-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      setTotpStep("done");
      setError(null);
      toast({ title: "2FA Aktif", description: "İki faktörlü doğrulama etkinleştirildi." });
    },
    onError: (e: Error) => setError(e.message),
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      fetch("/api/auth/totp-disable", { method: "POST", credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      setTotpStep("idle");
      toast({ title: "2FA Devre Dışı", description: "İki faktörlü doğrulama kapatıldı." });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const { data: healthScore } = useQuery<{
    healthScore: number; healthTier: string; churnProbability: string; churnRiskFactors: string[];
  }>({
    queryKey: ["my-health-score"],
    queryFn: () => fetch("/api/health/my-score", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
    staleTime: 1000 * 60 * 10,
  });

  if (!customer) return null;

  const subscriptionLabel: Record<string, string> = {
    active: "Aktif",
    inactive: "Pasif",
    trial: "Deneme",
  };

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
              <Link href="/hesabim" className="text-white text-sm font-medium">Hesabım</Link>
              <Link href="/hesabim/servislerim" className="text-slate-400 hover:text-white text-sm transition-colors">Servislerim</Link>
              <Link href="/raporlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Raporlarım</Link>
              <Link href="/entegrasyonlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Entegrasyonlar</Link>
              <Link href="/hesabim/fortinet-entegrasyonu" className="text-slate-400 hover:text-white text-sm transition-colors">Fortinet</Link>
              <Link href="/pentest-lite" className="text-slate-400 hover:text-white text-sm transition-colors">Pentest Lite</Link>
              <Link href="/hesabim/yonetim-raporu" className="text-slate-400 hover:text-white text-sm transition-colors">YK Raporu</Link>
              <Link href="/hesabim/davet" className="text-slate-400 hover:text-white text-sm transition-colors">Davet</Link>
              <Link href="/hesabim/enterprise" className="text-slate-400 hover:text-white text-sm transition-colors">Enterprise</Link>
            </nav>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Hesabım</h1>
          <p className="text-slate-400 mt-1">Profil ve güvenlik ayarlarınızı yönetin</p>
        </div>

        {/* Health Score Widget */}
        {healthScore && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Health score card */}
            <Card className={`col-span-2 border ${healthScore.healthTier === "healthy" ? "bg-emerald-500/5 border-emerald-500/30" : healthScore.healthTier === "at_risk" ? "bg-yellow-500/5 border-yellow-500/30" : "bg-red-500/5 border-red-500/30"}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Hesap Sağlığı</p>
                    <p className={`text-3xl font-bold ${healthScore.healthTier === "healthy" ? "text-emerald-400" : healthScore.healthTier === "at_risk" ? "text-yellow-400" : "text-red-400"}`}>
                      {healthScore.healthScore}
                      <span className="text-base font-normal text-slate-400">/100</span>
                    </p>
                    <p className={`text-xs mt-1 ${healthScore.healthTier === "healthy" ? "text-emerald-400" : healthScore.healthTier === "at_risk" ? "text-yellow-400" : "text-red-400"}`}>
                      {healthScore.healthTier === "healthy" ? "Saglikli" : healthScore.healthTier === "at_risk" ? "Risk Altinda" : healthScore.healthTier === "critical" ? "Kritik" : "Dikkat Gerekiyor"}
                    </p>
                  </div>
                  <Heart className={`h-8 w-8 ${healthScore.healthTier === "healthy" ? "text-emerald-400" : "text-red-400"}`} />
                </div>
              </CardContent>
            </Card>
            {/* Quick actions */}
            <Link href="/pentest-lite">
              <Card className="border border-slate-700 bg-slate-900 hover:border-slate-600 transition-colors cursor-pointer h-full">
                <CardContent className="pt-4 pb-4 flex flex-col items-center justify-center text-center gap-1">
                  <Search className="h-5 w-5 text-emerald-400" />
                  <p className="text-xs text-slate-300 font-medium">Pentest Lite</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/hesabim/davet">
              <Card className="border border-slate-700 bg-slate-900 hover:border-slate-600 transition-colors cursor-pointer h-full">
                <CardContent className="pt-4 pb-4 flex flex-col items-center justify-center text-center gap-1">
                  <Users className="h-5 w-5 text-blue-400" />
                  <p className="text-xs text-slate-300 font-medium">Arkadas Davet Et</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Profile */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-400" /> Profil Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Ad Soyad</p>
              <p className="text-white font-medium">{customer.fullName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-posta</p>
              <p className="text-white">{customer.email}</p>
            </div>
            {customer.companyName && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Şirket</p>
                <p className="text-white">{customer.companyName}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Üyelik</p>
              <div className="flex items-center gap-2">
                <span className="text-white">{customer.subscriptionPlan ?? "Ücretsiz"}</span>
                <Badge className={customer.subscriptionStatus === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400 border-slate-600"}>
                  {subscriptionLabel[customer.subscriptionStatus] ?? customer.subscriptionStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aktif Servisler Widget */}
        <ActiveServicesWidget />

        {/* My Reports */}
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" /> Raporlarım
              </h3>
              <p className="text-slate-400 text-sm mt-1">Geçmiş değerlendirmelerinizi ve alan adı taramalarınızı görün</p>
            </div>
            <Link href="/raporlarim">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 shrink-0">
                Raporları Gör <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Plan Features Card */}
        {(() => {
          const isFullPlan = customer.subscriptionPlan === "full" || customer.subscriptionPlan === "premium";
          const miniFeatures = [
            "20 soruluk hızlı risk değerlendirmesi",
            "5 güvenlik alanı (A-E)",
            "Yapay zeka destekli temel rapor",
            "Domain tarama: SPF, DMARC, DKIM, MX, SSL",
            "HIBP veri sızıntısı & kara liste kontrolü",
            "Shadow IT servis tespiti",
          ];
          const fullOnlyFeatures = [
            "55 soruluk kapsamlı değerlendirme",
            "HTTP güvenlik başlıkları analizi",
            "URLhaus & USOM zararlı alan taraması",
            "crt.sh Alt Alan Şeffaflığı (subdomain tespiti)",
            "NIST NVD CVE güvenlik açığı taraması",
            "KVKK Madde 12 Teknik Tedbir Haritası",
            "NIST CSF 2.0 Uyum Seviyesi",
            "PDF rapor indirme",
            "Sektörel karşılaştırma",
            "Birebir uzman danışmanlık görüşmesi",
          ];
          return (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" /> Hizmet Planım
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {isFullPlan
                    ? "Tam Değerlendirme — tüm özellikler aktif"
                    : "Mini Değerlendirme (Ücretsiz) — Tam Değerlendirme ile genişletin"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Aktif Özellikler</p>
                  <div className="space-y-1.5">
                    {(isFullPlan ? [...miniFeatures, ...fullOnlyFeatures] : miniFeatures).map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                {!isFullPlan && (
                  <>
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Tam Değerlendirme ile Açılır</p>
                      <div className="space-y-1.5">
                        {fullOnlyFeatures.map(f => (
                          <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                            <ShieldOff className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Link href="/assessment/full/start">
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                        Tam Değerlendirmeye Geç <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* TOTP Management */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {customer.totpEnabled
                ? <ShieldCheck className="h-5 w-5 text-emerald-400" />
                : <ShieldOff className="h-5 w-5 text-slate-400" />}
              İki Faktörlü Doğrulama
            </CardTitle>
            <CardDescription className="text-slate-400">
              Hesabınıza yetkisiz erişimi engelleyin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totpStep === "idle" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={customer.totpEnabled
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-700 text-slate-400 border-slate-600"}>
                    {customer.totpEnabled ? "Aktif" : "Pasif"}
                  </Badge>
                  <span className="text-slate-300 text-sm">
                    {customer.totpEnabled ? "Hesabınız 2FA ile korunuyor" : "2FA henüz etkinleştirilmedi"}
                  </span>
                </div>
                {customer.totpEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                    onClick={() => disableMutation.mutate()}
                    disabled={disableMutation.isPending}
                  >
                    <ShieldOff className="h-4 w-4 mr-2" /> Devre Dışı Bırak
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setupMutation.mutate()}
                    disabled={setupMutation.isPending}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {setupMutation.isPending ? "Hazırlanıyor..." : "2FA Etkinleştir"}
                  </Button>
                )}
              </div>
            )}

            {totpStep === "setup" && qrDataUrl && (
              <div className="space-y-5">
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qrDataUrl} alt="TOTP QR" className="w-40 h-40" />
                  </div>
                </div>
                {secret && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Manuel giriş için gizli anahtar:</p>
                    <code className="text-emerald-400 text-xs font-mono break-all">{secret}</code>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-slate-400" /> Doğrulama Kodu
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={token}
                    onChange={e => { setToken(e.target.value.replace(/\D/g, "")); setError(null); }}
                    placeholder="123456"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 text-xl tracking-widest text-center outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                  {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertTriangle className="h-4 w-4" /> {error}</div>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                    onClick={() => { setTotpStep("idle"); setQrDataUrl(null); setSecret(null); setToken(""); }}>
                    İptal
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => token.length === 6 && confirmMutation.mutate(token)}
                    disabled={token.length !== 6 || confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? "Doğrulanıyor..." : "Etkinleştir"}
                  </Button>
                </div>
              </div>
            )}

            {totpStep === "done" && (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <p className="text-emerald-300 text-sm">2FA başarıyla etkinleştirildi. Artık hesabınız korunuyor.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
