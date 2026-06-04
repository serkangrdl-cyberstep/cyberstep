import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronRight, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/use-page-meta";

export interface ToolSeoConfig {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  whatIsIt: string;
  howItWorks: string[];
  faq: { q: string; a: string }[];
  relatedTools: { slug: string; label: string }[];
  toolComponent: "DomainScanner" | "SSLChecker" | "KVKKPenalty" | "DmarcChecker" | "DarkWeb" | "RoiCalc";
}

const ALL_TOOLS: { slug: string; label: string }[] = [
  { slug: "ssl-kontrol",              label: "SSL Kontrol" },
  { slug: "domain-guvenlik-taramasi", label: "Domain Tarama" },
  { slug: "kvkk-ceza-hesaplayici",    label: "KVKK Ceza Sim." },
  { slug: "dmarc-kontrol",            label: "DMARC Kontrol" },
  { slug: "dark-web-sorgulama",       label: "Dark Web Sorgu" },
  { slug: "siber-risk-roi",           label: "Siber Risk ROI" },
];

// ── Embedded tool components ─────────────────────────────────────────────────

function DomainScanEmbed() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const check = async () => {
    if (!domain) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const clean = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
      const r = await fetch(`/api/public/domain-score/${encodeURIComponent(clean)}`);
      if (!r.ok) { setErr("Domain bulunamadi veya hata olustu."); return; }
      setResult(await r.json());
    } catch { setErr("Baglanti hatasi."); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 space-y-4">
      <div className="flex gap-3">
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="ornek.com.tr"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
          onKeyDown={e => e.key === "Enter" && check()} />
        <button onClick={check} disabled={loading || !domain}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Taraniyor..." : "Tara"}
        </button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {result && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">{String(result["domain"] ?? "")}</p>
            <span className={`text-2xl font-bold ${Number(result["score"] ?? 0) >= 70 ? "text-emerald-400" : Number(result["score"] ?? 0) >= 45 ? "text-yellow-400" : "text-red-400"}`}>
              {String(result["score"] ?? "—")}/100
            </span>
          </div>
          {result["details"] ? (
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: "SPF",   val: Boolean((result["details"] as Record<string, Record<string, unknown>>)?.["spf"]?.["configured"]) },
                { label: "DKIM",  val: Boolean((result["details"] as Record<string, Record<string, unknown>>)?.["dkim"]?.["configured"]) },
                { label: "DMARC", val: Boolean((result["details"] as Record<string, Record<string, unknown>>)?.["dmarc"]?.["configured"]) },
              ].map(({ label, val }) => (
                <div key={label} className={`rounded-lg border p-2 text-center ${val ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                  <p className="font-bold text-white">{label}</p>
                  <p className={`text-xs mt-0.5 ${val ? "text-emerald-400" : "text-red-400"}`}>{val ? "Var" : "Yok"}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SSLCheckerEmbed() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!domain) return;
    setLoading(true); setResult(null);
    try {
      const clean = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
      const r = await fetch(`/api/public/domain-score/${encodeURIComponent(clean)}`);
      if (r.ok) setResult(await r.json());
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 space-y-4">
      <div className="flex gap-3">
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="ornek.com.tr"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
          onKeyDown={e => e.key === "Enter" && check()} />
        <button onClick={check} disabled={loading || !domain}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Kontrol..." : "Kontrol Et"}
        </button>
      </div>
      {result && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-2">
          <p className="font-semibold text-white">{String(result["domain"] ?? "")}</p>
          {(result["details"] as any)?.ssl ? (
            <div className={`rounded-lg border p-3 ${(result["details"] as any).ssl.valid ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
              <p className={`font-semibold ${(result["details"] as any).ssl.valid ? "text-emerald-400" : "text-red-400"}`}>
                SSL: {(result["details"] as any).ssl.valid ? "Gecerli" : "Gecersiz veya Eksik"}
              </p>
              {(result["details"] as any).ssl.expiresAt && (
                <p className="text-xs text-slate-400 mt-1">
                  Bitis: {new Date((result["details"] as any).ssl.expiresAt).toLocaleDateString("tr-TR")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">SSL detayi alinamadi.</p>
          )}
        </div>
      )}
    </div>
  );
}

function KVKKCalcEmbed() {
  const [size, setSize] = useState<"small" | "medium" | "large">("small");
  const [violations, setViolations] = useState<string[]>([]);
  const [result, setResult] = useState<number | null>(null);

  const FINES: Record<string, Record<string, number>> = {
    small:  { kvkk_breach: 94_688, no_dpa: 28_406, no_verbis: 94_688 },
    medium: { kvkk_breach: 283_128, no_dpa: 56_816, no_verbis: 113_636 },
    large:  { kvkk_breach: 472_130, no_dpa: 94_688, no_verbis: 189_000 },
  };
  const VIOLATION_LABELS: Record<string, string> = {
    kvkk_breach: "Veri ihlali bildirmeme (md. 12)",
    no_dpa:      "DPA sozlesmesi yok (md. 11)",
    no_verbis:   "VERBIS kaydi yok (md. 8)",
  };

  const toggle = (v: string) => setViolations(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-white mb-2">Sirket Buyuklugu</label>
        <div className="flex flex-wrap gap-3">
          {[{ v: "small", l: "Kucuk (1-50)" }, { v: "medium", l: "Orta (51-250)" }, { v: "large", l: "Buyuk (250+)" }].map(o => (
            <button key={o.v} onClick={() => setSize(o.v as "small" | "medium" | "large")}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${size === o.v ? "border-primary bg-primary/20 text-primary" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-white mb-2">Tespit Edilen Ihlaller</label>
        <div className="space-y-2">
          {Object.entries(VIOLATION_LABELS).map(([k, l]) => (
            <label key={k} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={violations.includes(k)} onChange={() => toggle(k)}
                className="w-4 h-4 rounded border-slate-600 accent-primary" />
              <span className="text-sm text-slate-300">{l}</span>
            </label>
          ))}
        </div>
      </div>
      <button onClick={() => { const total = violations.reduce((s, v) => s + (FINES[size]?.[v] ?? 0), 0); setResult(total); }}
        disabled={violations.length === 0}
        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
        Ceza Riskini Hesapla
      </button>
      {result !== null && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-center">
          <p className="text-slate-400 text-sm">Tahmini ceza riski</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">{result.toLocaleString("tr-TR")} TL</p>
          <p className="text-xs text-slate-500 mt-2">2026 KVKK ceza skalasina gore hesaplanmistir.</p>
        </div>
      )}
    </div>
  );
}

function DmarcCheckerEmbed() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!domain) return;
    setLoading(true); setResult(null);
    try {
      const clean = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
      const r = await fetch(`/api/public/domain-score/${encodeURIComponent(clean)}`);
      if (r.ok) setResult(await r.json());
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 space-y-4">
      <div className="flex gap-3">
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="ornek.com.tr"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
          onKeyDown={e => e.key === "Enter" && check()} />
        <button onClick={check} disabled={loading || !domain}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Sorgulanıyor..." : "DMARC Kontrol"}
        </button>
      </div>
      {result && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <p className="font-semibold text-white">{String(result["domain"] ?? "")}</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: "SPF",   val: (result["details"] as any)?.spf?.configured },
              { label: "DKIM",  val: (result["details"] as any)?.dkim?.configured },
              { label: "DMARC", val: (result["details"] as any)?.dmarc?.configured },
            ].map(({ label, val }) => (
              <div key={label} className={`rounded-lg border p-2 text-center ${val ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                <p className="font-bold text-white">{label}</p>
                <p className={`text-xs mt-0.5 ${val ? "text-emerald-400" : "text-red-400"}`}>{val ? "Var" : "Yok"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DarkWebEmbed() {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-8 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto text-3xl">🔍</div>
      <p className="text-white font-semibold">Dark Web Sizinti Sorgulama</p>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        Sirket e-postanizin veya domain'inizin dark web'de satisa sunulup sunulmadigini kontrol edin.
      </p>
      <Link href="/sizinti-izleyici"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
        Sizinti Kontrolu Basla <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function RoiCalcEmbed() {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-8 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto text-3xl">📊</div>
      <p className="text-white font-semibold">Siber Guvenlik Yatirim ROI Hesaplayici</p>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        Siber guvenlik yatiriminin sirketinize net katkisini ve geri donus suresini hesaplayin.
      </p>
      <Link href="/roi-hesaplayici"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
        ROI Hesapla <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ToolEmbed({ type }: { type: ToolSeoConfig["toolComponent"] }) {
  switch (type) {
    case "DomainScanner": return <DomainScanEmbed />;
    case "SSLChecker":    return <SSLCheckerEmbed />;
    case "KVKKPenalty":  return <KVKKCalcEmbed />;
    case "DmarcChecker": return <DmarcCheckerEmbed />;
    case "DarkWeb":      return <DarkWebEmbed />;
    case "RoiCalc":      return <RoiCalcEmbed />;
    default:             return null;
  }
}

// ── Main page component ──────────────────────────────────────────────────────

export function ToolSeoPage({ config }: { config: ToolSeoConfig }) {
  const relatedTools = ALL_TOOLS.filter(t => config.relatedTools.some(r => r.slug === t.slug));

  usePageMeta({
    title: config.title,
    description: config.metaDescription,
    canonicalPath: `/araclar/${config.slug}`,
    keywords: `${config.h1}, ücretsiz araç, siber güvenlik, domain tarama, CyberStep.io`,
  });

  // SoftwareApplication + FAQPage JSON-LD — Google zengin sonuçları için
  useEffect(() => {
    const schemas: object[] = [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": config.h1,
        "applicationCategory": "SecurityApplication",
        "operatingSystem": "Web",
        "url": `https://cyberstep.io/araclar/${config.slug}`,
        "description": config.metaDescription,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "TRY",
          "description": "Ücretsiz",
        },
        "provider": {
          "@type": "Organization",
          "name": "CyberStep.io",
          "url": "https://cyberstep.io",
        },
        "inLanguage": "tr-TR",
      },
    ];
    if (config.faq.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": config.faq.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      });
    }
    const id = `ld-json-tool-${config.slug}`;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schemas);
    return () => { el?.remove(); };
  }, [config.slug, config.h1, config.metaDescription, config.faq]);

  return (
    <div>
      {/* Hero */}
      <section className="py-16 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Link href="/araclar" className="hover:text-white transition-colors">Araclar</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white">{config.h1}</span>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">Ucretsiz Arac</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{config.h1}</h1>
          <p className="text-lg text-white/80 max-w-2xl">{config.metaDescription}</p>
        </div>
      </section>

      {/* Tool embed */}
      <section className="py-10 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <ToolEmbed type={config.toolComponent} />
        </div>
      </section>

      {/* What is it */}
      <section className="py-12 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 max-w-3xl space-y-5">
          <h2 className="text-2xl font-bold text-secondary-foreground">Bu Arac Ne Ise Yarar?</h2>
          <p className="text-secondary-foreground/80 leading-relaxed">{config.whatIsIt}</p>
          {config.howItWorks.length > 0 && (
            <>
              <h3 className="font-semibold text-secondary-foreground">Nasil Calisir?</h3>
              <ol className="space-y-2">
                {config.howItWorks.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-secondary-foreground/70 text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 bg-muted">
        <div className="container mx-auto px-4 max-w-3xl space-y-5">
          <h2 className="text-2xl font-bold text-foreground">Sik Sorulan Sorular</h2>
          <div className="space-y-4">
            {config.faq.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <p className="font-semibold text-foreground mb-2">{f.q}</p>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related tools */}
      {relatedTools.length > 0 && (
        <section className="py-10 bg-secondary text-secondary-foreground">
          <div className="container mx-auto px-4 max-w-3xl space-y-4">
            <h2 className="text-xl font-bold text-secondary-foreground">Ilgili Araclar</h2>
            <div className="flex flex-wrap gap-3">
              {relatedTools.map(t => (
                <Link key={t.slug} href={`/araclar/${t.slug}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-secondary-foreground/20 bg-secondary-foreground/10 text-sm hover:border-primary/60 hover:text-primary transition-colors text-secondary-foreground/80">
                  {t.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8 text-center">
            <h3 className="text-xl font-bold text-foreground mb-2">Tam Guvenlik Raporunuzu Alin</h3>
            <p className="text-muted-foreground mb-6">
              20 soruda sirketinizin guvenlik durumunu ogrenin. Ucretsiz, aninda sonuc.
            </p>
            <Link href="/degerlendirme/baslat"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              Ucretsiz Degerlendirme Basla <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
