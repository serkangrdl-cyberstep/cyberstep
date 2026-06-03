import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Eye, EyeOff, CheckCircle2, Lock, Gift } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PLAN_LABELS: Record<string, string> = {
  mini: "Mini Değerlendirme",
  tam: "Tam Değerlendirme",
  premium: "Premium Danışmanlık",
};

export default function CustomerRegister() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const [refValidation, setRefValidation] = useState<{ valid: boolean; reward?: string; error?: string } | null>(null);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    companyName: "",
    referralCode: "",
  });

  // Pre-fill referral code from URL ?ref=CODE
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ref = params.get("ref");
    if (ref) {
      setForm(f => ({ ...f, referralCode: ref.toUpperCase() }));
      // Auto-validate
      fetch(`/api/referral/validate/${encodeURIComponent(ref)}`, { method: "POST" })
        .then(r => r.json())
        .then(j => setRefValidation(j))
        .catch(() => {});
    }
  }, [search]);

  function validateReferralCode(code: string) {
    if (!code) { setRefValidation(null); return; }
    fetch(`/api/referral/validate/${encodeURIComponent(code)}`, { method: "POST" })
      .then(r => r.json())
      .then(j => setRefValidation(j))
      .catch(() => setRefValidation(null));
  }

  const registerMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Kayıt başarısız");
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      toast({ title: "Hesap oluşturuldu", description: "2FA kurulumunu yapabilir veya atlayabilirsiniz." });
      navigate("/totp-kurulum");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast({ title: "Hata", description: "Şifre en az 8 karakter olmalıdır", variant: "destructive" });
      return;
    }
    if (!kvkkAccepted) {
      toast({ title: "Hata", description: "Devam etmek için KVKK metnini onaylamanız gerekir.", variant: "destructive" });
      return;
    }
    registerMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
            <Shield className="h-7 w-7" />
            <span className="font-bold text-2xl text-white">CyberStep.io</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Hesap Oluşturun</h1>
          <p className="text-muted-foreground mt-1">Tam Değerlendirme platformuna erişim için kayıt olun</p>
        </div>

        {/* Plan highlight */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex gap-3 items-start">
          <Lock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-emerald-300 font-medium">Tam Değerlendirme Erişimi</p>
            <p className="text-emerald-400/80 text-xs mt-1">60 soruluk derinlemesine analiz, PDF rapor ve uzman danışmanlık hizmetine erişin.</p>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Kayıt Formu</CardTitle>
            <CardDescription className="text-slate-400">Tüm alanları doğru doldurun</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Ad Soyad <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Ahmet Yılmaz"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">E-posta <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ahmet@sirket.com"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Şirket Adı <span className="text-slate-500">(isteğe bağlı)</span></label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="Şirket A.Ş."
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Şifre <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="En az 8 karakter"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${form.password.length >= 8 ? "text-emerald-400" : "text-slate-600"}`} />
                    <span className={form.password.length >= 8 ? "text-emerald-400" : "text-slate-500"}>En az 8 karakter</span>
                  </div>
                )}
              </div>

              {/* Referral code */}
              <div className="space-y-1.5 border-t border-slate-700 pt-4">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-emerald-400" />
                  Referral Kodu <span className="text-slate-500 font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  type="text"
                  value={form.referralCode}
                  onChange={e => {
                    const v = e.target.value.toUpperCase();
                    setForm(f => ({ ...f, referralCode: v }));
                    validateReferralCode(v);
                  }}
                  placeholder="AHMET-X7K2"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500 font-mono uppercase"
                />
                {refValidation && (
                  <div className={`flex items-center gap-1.5 text-xs ${refValidation.valid ? "text-emerald-400" : "text-red-400"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {refValidation.valid ? `Gecerli kod — ${refValidation.reward ?? "1 ay ucretsiz!"}` : refValidation.error ?? "Gecersiz kod"}
                  </div>
                )}
              </div>

              {/* KVKK onayı */}
              <div className="border-t border-slate-700 pt-4">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kvkkAccepted}
                    onChange={e => setKvkkAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 accent-emerald-500 shrink-0"
                  />
                  <span className="text-xs text-slate-400 leading-relaxed">
                    <a href="/kvkk" target="_blank" className="text-emerald-400 hover:underline font-medium">Kişisel Verilerin Korunması (KVKK)</a> kapsamında kişisel verilerimin işlenmesini
                    ve{" "}
                    <a href="/kullanim-kosullari" target="_blank" className="text-emerald-400 hover:underline font-medium">Kullanım Koşulları</a>'nı okudum, kabul ediyorum.
                    <span className="text-red-400 ml-1">*</span>
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Hesap oluşturuluyor..." : "Hesap Oluştur"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          Zaten hesabınız var mı?{" "}
          <Link href="/giris" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
