import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Shield, Lock, AlertTriangle, CheckCircle, ChevronRight, Loader2, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ─── Teaser CTA ───────────────────────────────────────────────────────────────
interface CheckoutData { domain: string; score: number; grade: string; criticalCount: number; highCount: number; plan: { name: string; price: number; description: string } }

function TeaserCTA({ token, domain, score }: { token: string; domain: string; score: number }) {
  const [view, setView] = useState<"main" | "checkout" | "meeting" | "done">("main");
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [meetingForm, setMeetingForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openCheckout() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/teaser/${token}/checkout-preview`);
      const data = await res.json() as CheckoutData;
      setCheckoutData(data);
      setView("checkout");
    } catch { setError("Bir hata oluştu, tekrar deneyin."); }
    finally { setLoading(false); }
  }

  async function submitMeeting() {
    if (!meetingForm.email) { setError("E-posta zorunlu"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/preview/${token}/meeting-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meetingForm),
      });
      if (!res.ok) throw new Error();
      setView("done");
    } catch { setError("Bir hata oluştu, tekrar deneyin."); }
    finally { setLoading(false); }
  }

  function goToPayment() {
    if (!checkoutData) return;
    const plan = checkoutData.plan.name === "Zırh" ? "zirh" : "kalkan";
    window.location.href = `/odeme?plan=${plan}&domain=${encodeURIComponent(domain)}`;
  }

  const scoreColor = score >= 70 ? "#2ECC71" : score >= 50 ? "#F5A623" : "#E03A3A";
  const inp: React.CSSProperties = { background: "#060D1A", border: "1px solid #1A3050", borderRadius: 8, padding: "12px 14px", color: "#E8EDF5", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
  const card: React.CSSProperties = { margin: "32px 0 16px", background: "linear-gradient(135deg,#0D2035,#091520)", border: "1.5px solid #1A3050", borderRadius: 18, overflow: "hidden" };

  if (view === "main") return (
    <div style={card}>
      <div style={{ background: "#091520", padding: "18px 24px", borderBottom: "1px solid #1A3050", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#8896A8", marginBottom: 4 }}>{domain} için güvenlik skoru</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: scoreColor }}>{score}/100</div>
        <div style={{ fontSize: 13, color: "#8896A8", marginTop: 4 }}>Tam raporu görmek ve güvenliğinizi artırmak için bir seçenek belirleyin</div>
      </div>
      <div style={{ padding: "24px 24px 20px" }}>
        <button onClick={openCheckout} disabled={loading} style={{ width: "100%", padding: 16, background: "#00C8FF", color: "#060D1A", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 900, cursor: "pointer", marginBottom: 12, opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          Hemen Abone Ol — {"\u20BA"}2.990/ay
        </button>
        <button onClick={() => setView("meeting")} style={{ width: "100%", padding: 14, background: "transparent", color: "#E8EDF5", border: "1.5px solid #1A3050", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          Uzmanla Görüşün
        </button>
        <div style={{ display: "flex", gap: 16, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {["Dilediğiniz zaman iptal", "Türkçe destek", "KVKK uyumlu"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#8896A8" }}>
              <span style={{ color: "#2ECC71" }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (view === "checkout" && checkoutData) return (
    <div style={{ ...card, border: "1.5px solid #00C8FF" }}>
      <div style={{ background: "#091520", padding: "16px 24px", borderBottom: "1px solid #1A3050" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EDF5" }}>Sipariş Özeti</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ background: "#060D1A", border: "1px solid #1A3050", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#E8EDF5" }}>CyberStep {checkoutData.plan.name} Paketi</div>
            <div style={{ fontSize: 13, color: "#8896A8", marginTop: 4 }}>{checkoutData.domain} · {checkoutData.plan.description}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#2ECC71" }}>{"\u20BA"}{checkoutData.plan.price.toLocaleString("tr-TR")}</div>
            <div style={{ fontSize: 12, color: "#8896A8" }}>/ay · KDV dahil</div>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          {["Sürekli dış saldırı yüzeyi izleme", "SSL sertifikası takibi ve uyarıları", "E-posta güvenlik yapılandırma rehberi", "Aylık yönetici güvenlik raporu", "Türkçe teknik destek"].map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13, color: "#E8EDF5" }}>
              <span style={{ color: "#2ECC71", flexShrink: 0 }}>✓</span>{item}
            </div>
          ))}
        </div>
        <button onClick={goToPayment} style={{ width: "100%", padding: 14, background: "#2ECC71", color: "#060D1A", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 10 }}>
          Ödemeye Geç
        </button>
        <button onClick={() => setView("main")} style={{ width: "100%", padding: 12, background: "transparent", color: "#8896A8", border: "1px solid #1A3050", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>
          Geri
        </button>
        <div style={{ fontSize: 11, color: "#4A6080", textAlign: "center", marginTop: 12 }}>Güvenli ödeme · İstediğiniz zaman iptal</div>
      </div>
    </div>
  );

  if (view === "meeting") return (
    <div style={{ ...card, border: "1.5px solid #1A3050" }}>
      <div style={{ background: "#091520", padding: "16px 24px", borderBottom: "1px solid #1A3050" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EDF5" }}>Uzmanla Görüşün</div>
        <div style={{ fontSize: 12, color: "#8896A8", marginTop: 4 }}>Güvenlik uzmanımız 24 saat içinde sizi arayacak</div>
      </div>
      <div style={{ padding: 24 }}>
        {error && <div style={{ background: "rgba(224,58,58,0.1)", border: "1px solid #E03A3A", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#E03A3A", marginBottom: 14 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Adınız Soyadınız" value={meetingForm.name} onChange={e => setMeetingForm(p => ({ ...p, name: e.target.value }))} style={inp} />
          <input type="email" placeholder="E-posta adresiniz *" value={meetingForm.email} onChange={e => setMeetingForm(p => ({ ...p, email: e.target.value }))} style={inp} />
          <input type="tel" placeholder="Telefon numaranız" value={meetingForm.phone} onChange={e => setMeetingForm(p => ({ ...p, phone: e.target.value }))} style={inp} />
          <textarea placeholder="Merak ettiğiniz bir şey var mı? (opsiyonel)" value={meetingForm.message} onChange={e => setMeetingForm(p => ({ ...p, message: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} />
        </div>
        <button onClick={submitMeeting} disabled={loading} style={{ width: "100%", padding: 14, background: "#00C8FF", color: "#060D1A", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 900, cursor: "pointer", marginTop: 16, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Gönderiliyor..." : "Görüşme Talep Et →"}
        </button>
        <button onClick={() => setView("main")} style={{ width: "100%", padding: 12, background: "transparent", color: "#8896A8", border: "1px solid #1A3050", borderRadius: 10, fontSize: 14, cursor: "pointer", marginTop: 8 }}>
          Geri
        </button>
      </div>
    </div>
  );

  if (view === "done") return (
    <div style={{ margin: "32px 0 16px", background: "rgba(46,204,113,0.06)", border: "1.5px solid #2ECC71", borderRadius: 18, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#2ECC71", marginBottom: 8 }}>Talebiniz Alındı</div>
      <div style={{ fontSize: 14, color: "#8896A8", lineHeight: 1.6 }}>
        Güvenlik uzmanımız en geç <strong style={{ color: "#E8EDF5" }}>24 saat</strong> içinde
        {meetingForm.email && <> <strong style={{ color: "#E8EDF5" }}>{meetingForm.email}</strong> adresine</>} ulaşacak.
      </div>
    </div>
  );

  return null;
}

interface Finding {
  title: string;
  severity: string;
  locked: boolean;
  preview_text: string | null;
}

interface PreviewData {
  domain: string;
  companyName: string;
  overall_score: number;
  risk_level: string;
  teaser_headline: string;
  teaser_findings: Finding[];
  attack_scenario_preview: string;
  locked_sections_hint: string;
  urgency_note: string;
  cta_clicked: boolean;
}

function RiskGauge({ score, level }: { score: number; level: string }) {
  const color = level === "KRİTİK" ? "#ef4444" : level === "YÜKSEK" ? "#f97316" : level === "ORTA" ? "#eab308" : "#22c55e";
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="12" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${score * 2.51} 251`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>
      <div>
        <div className="text-sm text-slate-400">Risk Seviyesi</div>
        <div className="text-xl font-bold mt-0.5" style={{ color }}>{level}</div>
      </div>
    </div>
  );
}

function SeverityDot({ sev }: { sev: string }) {
  const c = sev === "critical" ? "bg-red-500" : sev === "high" ? "bg-orange-500" : sev === "medium" ? "bg-yellow-500" : "bg-blue-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${c} flex-shrink-0 mt-1.5`} />;
}

function CTAForm({ token }: { token: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/preview/${token}/cta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-white font-semibold text-lg">Talebiniz alındı</h3>
        <p className="text-slate-400 mt-2">24 saat içinde sizinle iletişime geçeceğiz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-slate-300 text-xs">Ad Soyad *</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Ahmet Yılmaz" required />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">E-posta *</Label>
        <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="bg-slate-800 border-slate-600 text-white mt-1" type="email" placeholder="ahmet@sirket.com" required />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Telefon</Label>
        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="+90 212 555 0000" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Mesajınız (isteğe bağlı)</Label>
        <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          className="bg-slate-800 border-slate-600 text-white mt-1" rows={2} placeholder="Kısaca belirtmek istediğiniz varsa..." />
      </div>
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold"
        disabled={!form.name || !form.email || submitMutation.isPending}
        onClick={() => submitMutation.mutate(form)}
      >
        {submitMutation.isPending ? "Gönderiliyor..." : "Gönder →"}
      </Button>
    </div>
  );
}

export default function PreviewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [showForm, setShowForm] = useState(false);

  const ctaMutation = useMutation({
    mutationFn: () =>
      fetch(`/preview/${token}/cta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(r => r.json()),
  });

  const { data, isLoading, isError } = useQuery<PreviewData>({
    queryKey: ["preview", token],
    queryFn: () => fetch(`/preview/${token}`).then(r => {
      if (!r.ok) throw new Error("not_found");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertOctagon className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold">Rapor bulunamadı</h1>
          <p className="text-slate-400 mt-2">Bu bağlantı geçersiz veya süresi dolmuş.</p>
        </div>
      </div>
    );
  }

  const riskColor = data.risk_level === "KRİTİK" ? "text-red-400" : data.risk_level === "YÜKSEK" ? "text-orange-400" : "text-yellow-400";
  const unlockedFindings = data.teaser_findings.filter(f => !f.locked);
  const lockedFindings = data.teaser_findings.filter(f => f.locked);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" />
            <span className="font-bold text-white">CyberStep.io</span>
          </div>
          <span className="text-slate-400 text-sm">Güvenlik Raporu</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Domain header */}
        <div>
          <div className="text-slate-400 text-sm mb-1">{data.companyName}</div>
          <h1 className="text-2xl font-bold text-white">{data.domain}</h1>
        </div>

        {/* Risk Gauge */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <RiskGauge score={data.overall_score} level={data.risk_level} />
          <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border-l-4 border-orange-500">
            <p className="text-white font-medium leading-snug">{data.teaser_headline}</p>
          </div>
        </div>

        {/* Findings */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-white font-semibold mb-4">Tespit Edilen Bulgular</h2>
          <div className="space-y-3">
            {unlockedFindings.map((f, i) => (
              <div key={i} className="flex gap-3">
                <SeverityDot sev={f.severity} />
                <div>
                  <div className="text-white font-medium text-sm">{f.title}</div>
                  {f.preview_text && <div className="text-slate-400 text-xs mt-0.5">{f.preview_text}</div>}
                </div>
              </div>
            ))}
            {lockedFindings.map((f, i) => (
              <div key={`locked-${i}`} className="flex gap-3 opacity-60">
                <Lock className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500 font-medium text-sm">{f.title}</div>
                  <div className="text-slate-600 text-xs mt-0.5">Bu bulgunun detayları kilitli</div>
                </div>
              </div>
            ))}
          </div>
          {lockedFindings.length > 0 && (
            <div className="mt-4 p-3 bg-slate-800 rounded-lg text-slate-400 text-xs">
              {data.locked_sections_hint}
            </div>
          )}
        </div>

        {/* Attack Scenario Preview */}
        <div className="bg-slate-900 rounded-xl border border-red-900/50 p-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Saldırı Senaryosu Önizleme
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">{data.attack_scenario_preview}</p>
          <div className="mt-3 flex items-center gap-2 text-slate-500 text-xs">
            <Lock className="h-3.5 w-3.5" />
            <span>3 saldırı senaryosunun tamamı tam raporda açılır</span>
          </div>
        </div>

        {/* Urgency Note */}
        <div className="bg-orange-950/30 border border-orange-800/50 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-orange-200 text-sm">{data.urgency_note}</p>
          </div>
        </div>

        {/* CTA Block */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-900/50 rounded-xl p-6">
          <h2 className="text-white text-xl font-bold mb-2">Tam raporu alın, tüm bulgular açılsın</h2>
          <p className="text-slate-400 text-sm mb-5">
            Teknik detaylar, 3 saldırı senaryosunun tamamı, KVKK risk analizi ve öncelikli aksiyon planı.
          </p>

          {!showForm ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold py-3 text-base gap-2"
              onClick={() => {
                setShowForm(true);
                ctaMutation.mutate();
              }}
            >
              Tam Raporu Talep Et <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <CTAForm token={token!} />
          )}
        </div>

        {/* Teaser CTA */}
        <TeaserCTA token={token!} domain={data.domain} score={data.overall_score ?? 0} />

        {/* Footer */}
        <div className="text-center text-slate-600 text-xs pb-6">
          <p>Bu rapor {data.domain} domaininin kamuya açık güvenlik taramasına dayanmaktadır.</p>
          <p className="mt-1">Herhangi bir sisteminize yetkisiz erişim yapılmamıştır.</p>
          <div className="flex items-center justify-center gap-1 mt-3">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-600">CyberStep.io</span>
          </div>
        </div>
      </div>
    </div>
  );
}
