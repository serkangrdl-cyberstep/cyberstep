import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Shield, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PublicResult {
  domain: string;
  score: number;
  letterGrade: string | null;
  scanDate: string;
  token: string;
}

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-green-100",  text: "text-green-700",  label: "Güvenlik Profili İyi" },
  B: { bg: "bg-lime-100",   text: "text-lime-700",   label: "Kabul Edilebilir Seviye" },
  C: { bg: "bg-orange-100", text: "text-orange-700", label: "İyileştirme Gerekiyor" },
  D: { bg: "bg-red-100",    text: "text-red-700",    label: "Ciddi Riskler Var" },
  F: { bg: "bg-red-200",    text: "text-red-800",    label: "Kritik Güvenlik Açıkları" },
};

export default function SonucPage() {
  const [, params] = useRoute("/sonuc/:id");
  const token = params?.id ?? "";

  const [data, setData] = useState<PublicResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/result/${token}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        setData(await r.json() as PublicResult);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const ogImageUrl = `${window.location.origin}/api/public/result/${token}/og-image.png`;
  const canonicalUrl = `${window.location.origin}/sonuc/${token}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Shield className="h-6 w-6 animate-pulse text-cyan-400" />
          <span className="text-sm">Sonuç yükleniyor…</span>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-4">
        <AlertTriangle className="h-12 w-12 text-orange-400" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">Sonuç Bulunamadı</h1>
          <p className="text-slate-400 text-sm max-w-xs">Bu bağlantı geçersiz veya paylaşım kapatılmış olabilir.</p>
        </div>
        <Link href="/domain-tarama">
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
            Ücretsiz Tarama Yap
          </Button>
        </Link>
      </div>
    );
  }

  const grade = data.letterGrade ?? "F";
  const style = GRADE_STYLE[grade] ?? GRADE_STYLE["F"]!;
  const scoreColor = data.score >= 80 ? "text-green-400" : data.score >= 60 ? "text-yellow-400" : data.score >= 40 ? "text-orange-400" : "text-red-400";
  const scanDateStr = new Date(data.scanDate.endsWith("Z") ? data.scanDate : data.scanDate + "Z")
    .toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      {/* OG meta tags — injected into <head> via useEffect */}
      <OgMeta
        title={`${data.domain} — ${data.score}/100 Güvenlik Skoru | CyberStep`}
        description={`${data.domain} domain'inin siber güvenlik tarama sonucu: ${data.score}/100 puan, ${grade} notu. CyberStep.io tarafından analiz edildi.`}
        image={ogImageUrl}
        url={canonicalUrl}
      />

      <div className="min-h-screen bg-slate-950 text-white">
        {/* Top bar */}
        <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/">
              <span className="font-bold text-cyan-400 tracking-widest text-sm cursor-pointer">CYBERSTEP.IO</span>
            </Link>
            <Link href="/domain-tarama">
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
                Ücretsiz Tarama Yap
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16 max-w-2xl">
          {/* Domain card */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-8 mb-6 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Siber Güvenlik Tarama Sonucu</p>
            <h1 className="text-2xl font-bold text-white mb-6 break-all">{data.domain}</h1>

            <div className="flex items-center justify-center gap-8 mb-8">
              {/* Score */}
              <div>
                <div className={`text-7xl font-black ${scoreColor}`}>{data.score}</div>
                <div className="text-xs text-slate-500 mt-1">/ 100 puan</div>
              </div>

              {/* Grade */}
              <div>
                <div className={`text-7xl font-black ${style.text.replace("text-", "text-")}`}>{grade}</div>
                <div className="text-xs text-slate-500 mt-1">Güvenlik Notu</div>
              </div>
            </div>

            <Badge className={`${style.bg} ${style.text} border-0 text-sm px-4 py-1`}>
              {grade === "A" || grade === "B" ? <CheckCircle className="h-3.5 w-3.5 mr-1.5 inline" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5 inline" />}
              {style.label}
            </Badge>

            <p className="text-xs text-slate-500 mt-6">Tarama tarihi: {scanDateStr}</p>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-6 text-center">
            <p className="text-sm text-slate-300 mb-1 font-medium">Bu tarama otomatik olarak oluşturulmuştur.</p>
            <p className="text-xs text-slate-500 mb-4">
              E-posta güvenliği, SSL/TLS, DNS yapılandırması, kara liste, HIBP veri ihlalleri,
              Shodan port analizi ve CVE eşleştirmesi dahil 15+ kontrol gerçekleştirildi.
            </p>
            <Link href="/domain-tarama">
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                <ExternalLink className="h-4 w-4 mr-2" />
                Kendi Domain'inizi Ücretsiz Tarayın
              </Button>
            </Link>
          </div>

          <p className="text-center text-xs text-slate-600 mt-8">
            Powered by{" "}
            <a href="/" className="text-cyan-700 hover:text-cyan-500">CyberStep.io</a>
            {" "}— KOBİ'ler için Türkçe Siber Güvenlik Platformu
          </p>
        </main>
      </div>
    </>
  );
}

function OgMeta({ title, description, image, url }: { title: string; description: string; image: string; url: string }) {
  useEffect(() => {
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const setName = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    document.title = title;
    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:image", image);
    setMeta("og:url", url);
    setMeta("og:type", "website");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:image", image);
    setName("description", description);
  }, [title, description, image, url]);
  return null;
}
