import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, CreditCard, Lock, CheckCircle2, Loader2, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

interface ServiceCatalogItem {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  monthlyPriceTl: string;
  setupFeeTl: string;
  category: string;
  icon: string;
  isActive: boolean;
}

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

const KDV_RATE = 0.20;
const ANNUAL_DISCOUNT = 0.15;

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function calcPrices(monthlyTl: number, billingCycle: "monthly" | "annual") {
  const base = billingCycle === "annual"
    ? +(monthlyTl * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(2)
    : +monthlyTl.toFixed(2);
  const kdv = +(base * KDV_RATE).toFixed(2);
  const total = +(base + kdv).toFixed(2);
  return { base, kdv, total };
}

export default function SatinAl() {
  const { lang } = useLanguage();
  const [, params] = useRoute("/satin-al/:slug");
  const slug = params?.slug ?? "";
  const [, setLocation] = useLocation();

  usePageMeta({ title: "Servis Satın Al | CyberStep.io", noIndex: true });

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const prefill = (() => {
    const q = new URLSearchParams(window.location.search);
    return {
      contactName: q.get("contactName") ?? "",
      companyName: q.get("companyName") ?? "",
      email: q.get("email") ?? "",
      phone: "",
    };
  })();

  const [customerForm, setCustomerForm] = useState(prefill);
  const [cardForm, setCardForm] = useState({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: services = [], isLoading } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["service-catalog-public"],
    queryFn: () => fetch("/api/public/service-catalog").then(r => r.json()),
  });

  const service = services.find(s => s.slug === slug);
  const monthlyTl = service ? Number(service.monthlyPriceTl) : 0;
  const { base, kdv, total } = calcPrices(monthlyTl, billingCycle);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCard = cardForm.cardNumber.replace(/\s/g, "");
    if (rawCard.length < 15) { setError("Geçerli bir kart numarası girin."); return; }
    if (!cardForm.expireMonth || !cardForm.expireYear) { setError("Son kullanma tarihini seçin."); return; }
    if (cardForm.cvc.length < 3) { setError("Geçerli bir CVC girin."); return; }
    if (cardForm.cardHolderName.trim().split(" ").length < 2) { setError("Kart üzerindeki ad soyadı giriniz."); return; }
    if (!customerForm.contactName.trim()) { setError("Ad soyad gereklidir."); return; }
    if (!customerForm.email.trim()) { setError("E-posta adresi gereklidir."); return; }

    setLoading(true);
    try {
      const clientIp = await fetch("https://api.ipify.org?format=json")
        .then(r => r.json())
        .then((d: { ip: string }) => d.ip)
        .catch(() => "127.0.0.1");

      const body = {
        serviceSlug: slug,
        billingCycle,
        contactName: customerForm.contactName,
        companyName: customerForm.companyName,
        email: customerForm.email,
        phone: customerForm.phone,
        cardHolderName: cardForm.cardHolderName,
        cardNumber: rawCard,
        expireMonth: cardForm.expireMonth,
        expireYear: cardForm.expireYear,
        cvc: cardForm.cvc,
        ip: clientIp,
      };

      const res = await fetch("/api/payments/service-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; error?: string };

      if (data.success) {
        setSuccess(true);
        setTimeout(() => setLocation("/hesabim/servislerim"), 3000);
      } else {
        setError(data.error ?? "Ödeme başarısız. Lütfen kart bilgilerinizi kontrol edin.");
      }
    } catch {
      setError("Ödeme servisiyle bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Servis bulunamadı.</p>
        <Button variant="outline" onClick={() => setLocation("/servisler")}>Servislere Dön</Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Satın Alma Tamamlandı!</h2>
          <p className="text-muted-foreground"><strong>{service.label}</strong> servisiniz aktif edildi. Onay e-postası gönderildi.</p>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Hesabınıza yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-10">
        <Badge className="bg-primary/10 text-primary border-primary/20 mb-3">{lang === "en" ? "Secure Payment" : "Güvenli Ödeme"}</Badge>
        <h1 className="text-3xl font-bold mb-2">{service.label}</h1>
        <p className="text-muted-foreground">{service.shortDescription}</p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Aylık
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annual")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${billingCycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Yıllık
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${billingCycle === "annual" ? "bg-white/20" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
              %15 indirim
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Order summary */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Sipariş Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{service.label}</span>
                  <span>{base.toLocaleString("tr-TR")} TL</span>
                </div>
                {billingCycle === "annual" && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-xs">
                    <span>Yıllık indirim (%15)</span>
                    <span>-{(monthlyTl * 12 * 0.15).toLocaleString("tr-TR")} TL</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KDV (%20)</span>
                  <span>{kdv.toLocaleString("tr-TR")} TL</span>
                </div>
                <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border text-base">
                  <span>Toplam</span>
                  <span>₺{total.toLocaleString("tr-TR")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {billingCycle === "annual" ? "Yıllık ödeme, anında aktif" : "Aylık ödeme, anında aktif"}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Kart bilgileriniz Iyzico altyapısı ile şifrelenerek işlenir. CyberStep.io kart bilgilerinizi saklamaz.</span>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            {["Anında aktivasyon", "Ödeme onayı e-postası", "7/24 teknik destek"].map(f => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Forms */}
        <div className="md:col-span-3 space-y-5">
          {/* Customer info */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Müşteri Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Ad Soyad</Label>
                  <Input
                    id="contactName"
                    placeholder="Ad Soyad"
                    value={customerForm.contactName}
                    onChange={e => setCustomerForm(f => ({ ...f, contactName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Şirket Adı</Label>
                  <Input
                    id="companyName"
                    placeholder="Şirket A.Ş."
                    value={customerForm.companyName}
                    onChange={e => setCustomerForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ornek@sirket.com"
                    value={customerForm.email}
                    onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    placeholder="0532 000 00 00"
                    value={customerForm.phone}
                    onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card info */}
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
                  <Label htmlFor="cardHolder">Kart Üzerindeki Ad Soyad</Label>
                  <Input
                    id="cardHolder"
                    placeholder="AD SOYAD"
                    value={cardForm.cardHolderName}
                    onChange={e => setCardForm(f => ({ ...f, cardHolderName: e.target.value.toUpperCase() }))}
                    autoComplete="cc-name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Kart Numarası</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.cardNumber}
                      onChange={e => setCardForm(f => ({ ...f, cardNumber: formatCardNumber(e.target.value) }))}
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
                    <Select value={cardForm.expireMonth} onValueChange={v => setCardForm(f => ({ ...f, expireMonth: v }))}>
                      <SelectTrigger><SelectValue placeholder="AA" /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Yıl</Label>
                    <Select value={cardForm.expireYear} onValueChange={v => setCardForm(f => ({ ...f, expireYear: v }))}>
                      <SelectTrigger><SelectValue placeholder="YYYY" /></SelectTrigger>
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
                      value={cardForm.cvc}
                      onChange={e => setCardForm(f => ({ ...f, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
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
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Ödeme İşleniyor...</>
                  ) : (
                    <><Lock className="mr-2 h-5 w-5" /> ₺{total.toLocaleString("tr-TR")} Güvenli Öde</>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Ödemeyi tamamlayarak <a href="/kullanim-kosullari" className="underline hover:text-foreground">Kullanım Koşulları</a>'nı kabul etmiş olursunuz.
                  Faturanız e-posta adresinize iletilecektir.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
