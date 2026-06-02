import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, RefreshCw, AlertCircle, CheckCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TokenInfo {
  subscriptionId: number;
  serviceSlug: string;
  serviceLabel: string;
  status: string;
  expiresAt: string | null;
  hasStoredCard: boolean;
}

interface RenewalCard {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}

const EMPTY_CARD: RenewalCard = { cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" };

export default function YenilePage() {
  const [, navigate] = useLocation();

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [info, setInfo] = useState<TokenInfo | null>(null);

  const [useNewCard, setUseNewCard] = useState(false);
  const [card, setCard] = useState<RenewalCard>(EMPTY_CARD);

  const [payStatus, setPayStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [payError, setPayError] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadStatus("error");
      setLoadError("Geçersiz veya eksik yenileme linki.");
      return;
    }

    fetch(`/api/public/renewal-token/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string };
          if (res.status === 410) throw new Error("Bu yenileme linkinin süresi dolmuş. Lütfen hesabınıza giriş yaparak yenileme yapın.");
          if (res.status === 404) throw new Error("Geçersiz yenileme linki.");
          throw new Error(d.error ?? "Bir hata oluştu.");
        }
        return res.json() as Promise<TokenInfo>;
      })
      .then((data) => {
        setInfo(data);
        setUseNewCard(!data.hasStoredCard);
        setLoadStatus("ok");
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        setLoadStatus("error");
      });
  }, [token]);

  async function handleRenew() {
    if (!info) return;

    if (useNewCard) {
      if (!card.cardHolderName || !card.cardNumber || !card.expireMonth || !card.expireYear || !card.cvc) {
        setPayError("Lütfen tüm kart alanlarını doldurun.");
        return;
      }
    }

    setPayStatus("loading");
    setPayError("");

    const body: Record<string, string> = {};
    if (useNewCard) {
      body.cardHolderName = card.cardHolderName;
      body.cardNumber = card.cardNumber.replace(/\s/g, "");
      body.expireMonth = card.expireMonth;
      body.expireYear = card.expireYear;
      body.cvc = card.cvc;
    }

    try {
      const res = await fetch(`/api/public/renewal-token/${encodeURIComponent(token)}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { success?: boolean; error?: string; newExpiresAt?: string; serviceLabel?: string };

      if (!res.ok) {
        setPayError(data.error ?? "Ödeme başarısız. Lütfen tekrar deneyin.");
        setPayStatus("error");
        return;
      }

      setNewExpiresAt(data.newExpiresAt ?? null);
      setPayStatus("success");
    } catch {
      setPayError("Bağlantı hatası. Lütfen tekrar deneyin.");
      setPayStatus("error");
    }
  }

  if (loadStatus === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-sky-400 mx-auto" />
          <p className="text-slate-400">Yenileme linki doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Link Geçersiz</h1>
          <p className="text-slate-400 text-sm">{loadError}</p>
          <Button onClick={() => navigate("/giris")} className="bg-sky-600 hover:bg-sky-500">
            Hesabıma Giriş Yap
          </Button>
        </div>
      </div>
    );
  }

  if (payStatus === "success") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Abonelik Yenilendi</h1>
          <p className="text-slate-300 text-sm">
            <strong>{info?.serviceLabel}</strong> aboneliğiniz başarıyla yenilendi.
          </p>
          {newExpiresAt && (
            <p className="text-slate-400 text-sm">
              Yeni bitiş tarihi:{" "}
              <span className="text-white font-medium">
                {new Date(newExpiresAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </p>
          )}
          <p className="text-slate-400 text-xs">Onay e-postası gönderildi.</p>
          <Button onClick={() => navigate("/giris")} className="bg-sky-600 hover:bg-sky-500 w-full">
            Hesabıma Giriş Yap
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-xl space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-7 h-7 text-sky-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Abonelik Yenileme</h1>
          <p className="text-slate-400 text-sm mt-1">Giriş yapmadan tek tıkla yenileyin</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Servis</span>
            <span className="text-white font-medium">{info?.serviceLabel}</span>
          </div>
          {info?.expiresAt && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Mevcut bitiş</span>
              <span className="text-white">
                {new Date(info.expiresAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          )}
          {info?.hasStoredCard && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs pt-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Kayıtlı kartınız mevcut</span>
            </div>
          )}
        </div>

        {info?.hasStoredCard && (
          <div className="flex gap-2">
            <button
              onClick={() => setUseNewCard(false)}
              className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${!useNewCard ? "bg-sky-600/20 border-sky-500/50 text-sky-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
            >
              Kayıtlı Kart
            </button>
            <button
              onClick={() => setUseNewCard(true)}
              className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${useNewCard ? "bg-sky-600/20 border-sky-500/50 text-sky-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
            >
              Yeni Kart
            </button>
          </div>
        )}

        {(!info?.hasStoredCard || useNewCard) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <CreditCard className="w-4 h-4" />
              <span>Kart Bilgileri</span>
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Kart Sahibi</Label>
              <Input
                value={card.cardHolderName}
                onChange={e => setCard(c => ({ ...c, cardHolderName: e.target.value }))}
                placeholder="Ad Soyad"
                className="mt-1 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Kart Numarası</Label>
              <Input
                value={card.cardNumber}
                onChange={e => setCard(c => ({ ...c, cardNumber: e.target.value }))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className="mt-1 bg-slate-800 border-slate-700 text-white font-mono"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-slate-300 text-xs">Ay</Label>
                <Input
                  value={card.expireMonth}
                  onChange={e => setCard(c => ({ ...c, expireMonth: e.target.value }))}
                  placeholder="MM"
                  maxLength={2}
                  className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-center"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Yıl</Label>
                <Input
                  value={card.expireYear}
                  onChange={e => setCard(c => ({ ...c, expireYear: e.target.value }))}
                  placeholder="YY"
                  maxLength={2}
                  className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-center"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">CVC</Label>
                <Input
                  type="password"
                  value={card.cvc}
                  onChange={e => setCard(c => ({ ...c, cvc: e.target.value }))}
                  placeholder="•••"
                  maxLength={4}
                  className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-center"
                />
              </div>
            </div>
          </div>
        )}

        {info?.hasStoredCard && !useNewCard && (
          <p className="text-slate-400 text-xs text-center">
            Kayıtlı kartınız ile tek tıkla ödeme yapılacak.
          </p>
        )}

        {payError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded p-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{payError}</p>
          </div>
        )}

        <Button
          onClick={handleRenew}
          disabled={payStatus === "loading"}
          className="w-full bg-sky-600 hover:bg-sky-500 gap-2"
          size="lg"
        >
          {payStatus === "loading" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Ödeme yapılıyor...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Aboneliği Yenile</>
          )}
        </Button>

        <p className="text-slate-500 text-xs text-center">
          Bu link 7 gün geçerlidir.{" "}
          <button onClick={() => navigate("/giris")} className="text-sky-500 hover:text-sky-400 underline">
            Hesabıma giriş yap
          </button>
        </p>
      </div>
    </div>
  );
}
