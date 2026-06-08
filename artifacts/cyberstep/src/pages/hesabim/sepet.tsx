import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ShoppingCart, X, CreditCard, CheckCircle2,
  Loader2, Shield, AlertCircle, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/cart-context";
import { useRequireCustomer } from "@/hooks/use-customer";
import { usePageMeta } from "@/hooks/use-page-meta";

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const KDV_RATE = 0.20;
const ANNUAL_DISCOUNT = 0.15;

function calcItemPrice(monthlyTl: number, cycle: "monthly" | "annual") {
  const base = cycle === "annual"
    ? +(monthlyTl * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(2)
    : +monthlyTl.toFixed(2);
  const kdv = +(base * KDV_RATE).toFixed(2);
  return { base, kdv, total: +(base + kdv).toFixed(2) };
}

export default function SepetPage() {
  usePageMeta({ title: "Sepetim | CyberStep.io", noIndex: true });

  const { items, billingCycle, setBillingCycle, removeItem, clearCart } = useCart();
  const { data: customer } = useRequireCustomer();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState({
    cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    if (!contactName) setContactName((customer as { fullName?: string }).fullName ?? "");
    if (!email) setEmail((customer as { email?: string }).email ?? "");
    if (!companyName) setCompanyName((customer as { companyName?: string }).companyName ?? "");
  }, [customer]);

  const totals = items.reduce(
    (acc, item) => {
      const { base, kdv, total } = calcItemPrice(item.monthlyPriceTl, billingCycle);
      return { base: acc.base + base, kdv: acc.kdv + kdv, total: acc.total + total };
    },
    { base: 0, kdv: 0, total: 0 },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const rawCard = card.cardNumber.replace(/\s/g, "");
    if (!contactName.trim()) { setError("Ad soyad zorunlu."); return; }
    if (!email.trim()) { setError("E-posta zorunlu."); return; }
    if (rawCard.length < 15) { setError("Geçerli kart numarası girin."); return; }
    if (!card.expireMonth || !card.expireYear) { setError("Son kullanma tarihi seçin."); return; }
    if (card.cvc.length < 3) { setError("Geçerli CVC girin."); return; }
    if (card.cardHolderName.trim().split(" ").length < 2) { setError("Kart üzerindeki ad soyadı girin."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/cart-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ serviceSlug: i.slug, billingCycle })),
          contactName, companyName, email, phone,
          cardHolderName: card.cardHolderName,
          cardNumber: rawCard,
          expireMonth: card.expireMonth,
          expireYear: card.expireYear,
          cvc: card.cvc,
        }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        clearCart();
        setSuccess(true);
        setTimeout(() => navigate("/hesabim/servislerim"), 3000);
      } else {
        setError(data.error ?? "Ödeme başarısız. Kart bilgilerinizi kontrol edin.");
      }
    } catch {
      setError("Ödeme servisiyle bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Satın Alma Tamamlandı!</h2>
          <p className="text-slate-400">
            {items.length > 0 ? `${items.length} servisiniz` : "Servisleriniz"} aktif edildi. Onay e-postası gönderildi.
          </p>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-sky-400" />
          <p className="text-sm text-slate-500">Hesabınıza yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center flex-col gap-4">
        <ShoppingCart className="h-12 w-12 text-slate-600" />
        <p className="text-slate-400 text-lg">Sepetiniz boş.</p>
        <Button variant="outline" className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10" onClick={() => navigate("/hesabim/servislerim")}>
          Servislere Göz At
        </Button>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/hesabim/servislerim")} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-sky-400" /> Sepetim
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} servis — tek ödemede satın alın</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: döngü + müşteri + kart */}
        <div className="lg:col-span-2 space-y-5">

          {/* Fatura dönemi */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-4">
              <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Fatura Dönemi</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${billingCycle === "monthly" ? "bg-sky-600/20 border-sky-500/50 text-sky-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
                >
                  Aylık
                </button>
                <button
                  onClick={() => setBillingCycle("annual")}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${billingCycle === "annual" ? "bg-sky-600/20 border-sky-500/50 text-sky-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
                >
                  Yıllık
                  <Badge className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border">%15 indirim</Badge>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Sepet kalemleri */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0 divide-y divide-slate-800">
              {items.map(item => {
                const { base, total } = calcItemPrice(item.monthlyPriceTl, billingCycle);
                return (
                  <div key={item.slug} className="flex items-center justify-between p-4 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{item.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        KDV dahil: {total.toLocaleString("tr-TR")} TL &bull; {billingCycle === "annual" ? "yıllık" : "aylık"}
                      </p>
                    </div>
                    <span className="text-sky-400 font-semibold text-sm shrink-0">
                      {base.toLocaleString("tr-TR")} TL
                    </span>
                    <button
                      onClick={() => removeItem(item.slug)}
                      className="text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Fatura bilgileri */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Fatura Bilgileri</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs">Ad Soyad</Label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ahmet Yılmaz" className="mt-1 bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Şirket Adı</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Örnek A.Ş." className="mt-1 bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">E-posta</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ahmet@sirket.com" className="mt-1 bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Telefon</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" className="mt-1 bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kart bilgileri */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-sky-400" /> Kart Bilgileri
              </p>
              <div>
                <Label className="text-slate-400 text-xs">Kart Sahibi Adı</Label>
                <Input
                  value={card.cardHolderName}
                  onChange={e => setCard(c => ({ ...c, cardHolderName: e.target.value }))}
                  placeholder="AHMET YILMAZ"
                  className="mt-1 bg-slate-800 border-slate-700 text-white uppercase"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Kart Numarası</Label>
                <Input
                  value={card.cardNumber}
                  onChange={e => setCard(c => ({
                    ...c,
                    cardNumber: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(),
                  }))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="mt-1 bg-slate-800 border-slate-700 text-white font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-slate-400 text-xs">Son Kullanma</Label>
                  <div className="flex gap-2 mt-1">
                    <select
                      value={card.expireMonth}
                      onChange={e => setCard(c => ({ ...c, expireMonth: e.target.value }))}
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">AA</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                      value={card.expireYear}
                      onChange={e => setCard(c => ({ ...c, expireYear: e.target.value }))}
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">YYYY</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">CVC</Label>
                  <Input
                    value={card.cvc}
                    onChange={e => setCard(c => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="123"
                    maxLength={4}
                    className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-center"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                256-bit SSL ile güvenli ödeme — kart bilgileriniz saklanmaz
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ: özet + ödeme butonu */}
        <div>
          <Card className="bg-slate-900 border-slate-800 sticky top-6">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-300">Sipariş Özeti</p>
              <div className="space-y-2 text-sm">
                {items.map(item => {
                  const { base } = calcItemPrice(item.monthlyPriceTl, billingCycle);
                  return (
                    <div key={item.slug} className="flex justify-between gap-2">
                      <span className="text-slate-400 truncate text-xs">{item.label}</span>
                      <span className="text-slate-300 shrink-0 text-xs">{base.toLocaleString("tr-TR")} TL</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-800 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Ara toplam</span>
                  <span>{totals.base.toLocaleString("tr-TR")} TL</span>
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>KDV (%20)</span>
                  <span>{totals.kdv.toLocaleString("tr-TR")} TL</span>
                </div>
                {billingCycle === "annual" && (
                  <div className="flex justify-between text-emerald-400 text-xs">
                    <span>Yıllık indirim (%15)</span>
                    <span>uygulandı</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white border-t border-slate-800 pt-2 mt-2">
                  <span>Toplam</span>
                  <span className="text-sky-400 text-base">₺{totals.total.toLocaleString("tr-TR")}</span>
                </div>
              </div>

              <Button
                className="w-full bg-sky-600 hover:bg-sky-500 font-semibold gap-2 py-5 text-base"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Ödeme işleniyor...</>
                  : <><CreditCard className="h-4 w-4" /> {items.length} Servis Satın Al</>
                }
              </Button>

              <p className="text-center text-xs text-slate-600">
                {billingCycle === "annual" ? "Yıllık" : "Aylık"} faturalama &bull; {items.length} servis
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
