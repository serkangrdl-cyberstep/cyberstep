import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, CreditCard, Lock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageMeta } from "@/hooks/use-page-meta";

interface AssessmentInfo {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  assessmentType: string;
}

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear + i));
const KDV_RATE = 0.20;

interface PricingPlan {
  id: number;
  slug: string;
  name: string;
  price: string;
  currency: string;
  isActive: boolean;
}

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export default function Payment() {
  const [, params] = useRoute("/payment/:id");
  const assessmentId = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();

  usePageMeta({ title: "Odeme | CyberStep.io", noIndex: true });

  const [form, setForm] = useState({
    cardHolderName: "",
    cardNumber: "",
    expireMonth: "",
    expireYear: "",
    cvc: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: plans = [] } = useQuery<PricingPlan[]>({
    queryKey: ["pricing-plans"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
  });
  const fullPlan = plans.find(p => p.slug === "full" && p.isActive);
  const basePrice = fullPlan ? parseFloat(fullPlan.price) : 4900;
  const kdvAmount = +(basePrice * KDV_RATE).toFixed(2);
  const totalPrice = +(basePrice + kdvAmount).toFixed(2);

  const { data: assessment, isLoading: assessmentLoading } = useQuery<AssessmentInfo>({
    queryKey: ["assessment-info", assessmentId],
    queryFn: () =>
      fetch(`/api/assessments/${assessmentId}`, { credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      }),
    enabled: !!assessmentId,
    retry: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCard = form.cardNumber.replace(/\s/g, "");
    if (rawCard.length < 15) { setError("Geçerli bir kart numarası girin."); return; }
    if (!form.expireMonth || !form.expireYear) { setError("Son kullanma tarihini seçin."); return; }
    if (form.cvc.length < 3) { setError("Geçerli bir CVC girin."); return; }
    if (form.cardHolderName.trim().split(" ").length < 2) { setError("Kart üzerindeki ad soyad giriniz."); return; }

    setLoading(true);
    try {
      const clientIp = await fetch("https://api.ipify.org?format=json")
        .then(r => r.json())
        .then(d => d.ip as string)
        .catch(() => "127.0.0.1");

      const body = {
        assessmentId,
        planSlug: "full",
        companyName: assessment?.companyName ?? "Bilinmiyor",
        contactName: assessment?.contactName ?? form.cardHolderName,
        email: assessment?.email ?? "",
        cardHolderName: form.cardHolderName,
        cardNumber: rawCard,
        expireMonth: form.expireMonth,
        expireYear: form.expireYear,
        cvc: form.cvc,
        ip: clientIp,
      };

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; error?: string };

      if (data.success) {
        setSuccess(true);
        setTimeout(() => setLocation(`/assessment/full/${assessmentId}`), 2500);
      } else {
        setError(data.error ?? "Odeme basarisiz. Lutfen kart bilgilerinizi kontrol edin.");
      }
    } catch {
      setError("Odeme servisiyle baglanti kurulamadi. Lutfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (assessmentLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Odeme Basarili!</h2>
          <p className="text-muted-foreground">Tam Degerlendirme kilitlendi. Yonlendiriliyorsunuz...</p>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-10">
        <Badge className="bg-primary/10 text-primary border-primary/20 mb-3">Guvenli Odeme</Badge>
        <h1 className="text-3xl font-bold mb-2">Tam Degerlendirme - Odeme</h1>
        <p className="text-muted-foreground">256-bit SSL sifreleme ile guvenli odeme</p>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Order summary */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Siparis Ozeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {assessment && (
                <div className="space-y-1 pb-3 border-b border-border">
                  <p className="font-medium text-foreground">{assessment.companyName}</p>
                  <p className="text-muted-foreground">{assessment.contactName}</p>
                  <p className="text-muted-foreground">{assessment.email}</p>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tam Değerlendirme</span>
                  <span>{basePrice.toLocaleString("tr-TR")} TL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KDV (%20)</span>
                  <span>{kdvAmount.toLocaleString("tr-TR")} TL</span>
                </div>
                <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border text-base">
                  <span>Toplam</span>
                  <span>₺{totalPrice.toLocaleString("tr-TR")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Kart bilgileriniz Iyzico altyapisi ile sifrelenerek islenur. CyberStep.io kart bilgilerinizi saklamaz.</span>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            {["55 kapsamli soru, 10 guvenlik alani", "PDF rapor indirme", "Detayli oncelikli aksiyon plani", "Birebir uzman danismanlik gorusmeleri (1 saat)", "KVKK uyumluluk degerlendirmesi"].map(f => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card form */}
        <div className="md:col-span-3">
          <Card className="shadow-sm border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Kart Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="cardHolder">Kart Uzerindeki Ad Soyad</Label>
                  <Input
                    id="cardHolder"
                    placeholder="AD SOYAD"
                    value={form.cardHolderName}
                    onChange={e => setForm(f => ({ ...f, cardHolderName: e.target.value.toUpperCase() }))}
                    autoComplete="cc-name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Kart Numarasi</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={form.cardNumber}
                      onChange={e => setForm(f => ({ ...f, cardNumber: formatCardNumber(e.target.value) }))}
                      inputMode="numeric"
                      autoComplete="cc-number"
                      maxLength={19}
                      required
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ay</Label>
                    <Select value={form.expireMonth} onValueChange={v => setForm(f => ({ ...f, expireMonth: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="AA" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Yil</Label>
                    <Select value={form.expireYear} onValueChange={v => setForm(f => ({ ...f, expireYear: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="YYYY" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      placeholder="000"
                      value={form.cvc}
                      onChange={e => setForm(f => ({ ...f, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-500"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Odeme Isleniyor...</>
                  ) : (
                    <><Lock className="mr-2 h-5 w-5" /> ₺{totalPrice.toLocaleString("tr-TR")} Güvenli Öde</>

                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Odemeyi tamamlayarak <a href="/kullanim-kosullari" className="underline hover:text-foreground">Kullanim Kosullari</a>'ni kabul etmis olursunuz.
                  Faturaniz e-posta adresinize iletilecektir.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
