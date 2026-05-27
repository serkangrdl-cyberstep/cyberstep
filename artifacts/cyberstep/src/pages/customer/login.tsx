import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Eye, EyeOff, KeyRound, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CustomerLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [totpToken, setTotpToken] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Giriş başarısız");
        return j;
      }),
    onSuccess: (data) => {
      if (data.requiresTotp) {
        setStep("totp");
      } else {
        qc.invalidateQueries({ queryKey: ["customer-me"] });
        navigate("/hesabim");
      }
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const totpMutation = useMutation({
    mutationFn: (token: string) =>
      fetch("/api/auth/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Doğrulama başarısız");
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      navigate("/hesabim");
    },
    onError: (e: Error) => toast({ title: "Geçersiz kod", description: e.message, variant: "destructive" }),
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
            <Shield className="h-7 w-7" />
            <span className="font-bold text-2xl text-white">CyberStep.io</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Müşteri Girişi</h1>
          <p className="text-muted-foreground mt-1">Tam Değerlendirme platformuna erişin</p>
        </div>

        {/* Test credentials info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">Test Hesabı</p>
            <p className="text-blue-400/80">E-posta: <code className="text-blue-300">demo@cyberstep.io</code></p>
            <p className="text-blue-400/80">Şifre: <code className="text-blue-300">Demo2024!</code></p>
            <p className="text-blue-400/80 text-xs mt-1">Henüz hesabınız yoksa kayıt olun.</p>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">
              {step === "credentials" ? "Giriş Yap" : "İki Faktörlü Doğrulama"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {step === "credentials"
                ? "Hesabınıza erişmek için bilgilerinizi girin"
                : "Authenticator uygulamanızdaki 6 haneli kodu girin"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "credentials" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">E-posta</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@sirketiniz.com"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Şifre</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <KeyRound className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Doğrulama Kodu</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpToken}
                    onChange={e => setTotpToken(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-3 text-2xl text-center tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                </div>
                <Button
                  onClick={() => totpMutation.mutate(totpToken)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={totpToken.length !== 6 || totpMutation.isPending}
                >
                  {totpMutation.isPending ? "Doğrulanıyor..." : "Doğrula"}
                </Button>
                <button
                  onClick={() => { setStep("credentials"); setTotpToken(""); }}
                  className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Geri dön
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Kayıt olun
          </Link>
        </p>
      </div>
    </div>
  );
}
