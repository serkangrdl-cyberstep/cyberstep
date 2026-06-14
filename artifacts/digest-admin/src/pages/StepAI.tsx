import { useState } from "react";

const BRAND_COLORS = [
  { name: "Siyan (Ana Renk)", hex: "#00C8FF", bg: "bg-[#00C8FF]", text: "text-slate-900" },
  { name: "Amber (Vurgu)", hex: "#F5A623", bg: "bg-[#F5A623]", text: "text-slate-900" },
  { name: "Koyu Lacivert", hex: "#060D1A", bg: "bg-[#060D1A]", text: "text-white", border: true },
  { name: "Orta Lacivert", hex: "#0D2035", bg: "bg-[#0D2035]", text: "text-white", border: true },
  { name: "Açık Mavi", hex: "#1A4A6B", bg: "bg-[#1A4A6B]", text: "text-white" },
];

const ASSETS = [
  {
    id: "card",
    label: "Step AI Kart (600×600)",
    desc: "Tam gövde, koyu arka plan, \"Step AI / by CyberStep.io\" yazısı. Sosyal medya ve sunum için idealdir.",
    src: "/step-ai-card.svg",
    srcPng: "/step-ai-card.png",
    bg: "bg-slate-800",
    size: "h-64",
  },
  {
    id: "maskot",
    label: "Step AI Maskot (400×500)",
    desc: "Tam gövde, şeffaf arka plan, \"POWERED BY CYBERSTEP.IO\" tabanlı. E-posta ve PDF için kullanılır.",
    src: "/step-ai-maskot.svg",
    srcPng: "/step-ai-maskot.png",
    bg: "bg-slate-900",
    size: "h-64",
  },
  {
    id: "avatar",
    label: "Step AI Avatar (300×300)",
    desc: "Sadece yüz/kafa, daire içinde. Profil ikonu, yorum balonu, küçük ikonlar için kullanılır.",
    src: "/step-ai-avatar.svg",
    srcPng: "/step-ai-avatar.png",
    bg: "bg-slate-800",
    size: "h-48",
  },
];

export default function StepAI() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <img src="/step-ai-avatar.svg" alt="Step AI" className="w-16 h-16 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Step AI — Marka Varlıkları</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            CyberStep'in yapay zeka güvenlik analisti. Maskot görselleri, renk paleti ve kullanım kılavuzu.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-medium">
              CyberStep'in Yapay Zeka Güvenlik Analisti
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
              by CyberStep.io
            </span>
          </div>
        </div>
      </div>

      {/* Brand Name Usage */}
      <div className="border border-border rounded-xl bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Marka Adı Kullanımı</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: "Ana kullanım", value: "Step AI", note: "Her zaman büyük S, büyük A, aralarında boşluk" },
            { label: "Uzun form", value: "Step AI — CyberStep'in yapay zeka güvenlik analisti", note: "Tanıtım metinleri için" },
            { label: "İngilizce", value: "Step AI — CyberStep's AI Security Analyst", note: "EN içerik için" },
            { label: "PDF/E-posta footer", value: "Bu rapor, Step AI — CyberStep'in yapay zeka güvenlik analisti — tarafından hazırlanmıştır.", note: "Mevcut şablon" },
          ].map(item => (
            <div key={item.label} className="border border-border rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-sm font-medium text-foreground font-mono">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1 italic">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Color Palette */}
      <div className="border border-border rounded-xl bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Renk Paleti</h3>
        <div className="flex flex-wrap gap-3">
          {BRAND_COLORS.map(c => (
            <button
              key={c.hex}
              onClick={() => copyHex(c.hex)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:scale-105 ${c.border ? "border-border" : "border-transparent"}`}
              title={`Kopyala: ${c.hex}`}
            >
              <div className={`w-14 h-14 rounded-lg ${c.bg} border border-white/10`} />
              <span className="text-xs font-medium text-foreground">{c.name}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {copied === c.hex ? "Kopyalandı!" : c.hex}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Üzerine tıklayın → hex kodu kopyalanır</p>
      </div>

      {/* Assets */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Görsel Varlıklar</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {ASSETS.map(asset => (
            <div key={asset.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <div className={`${asset.bg} flex items-center justify-center p-4 ${asset.size}`}>
                <img src={asset.src} alt={asset.label} className="h-full object-contain" />
              </div>
              <div className="p-4 space-y-2">
                <p className="font-semibold text-foreground text-sm">{asset.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{asset.desc}</p>
                <div className="flex gap-2 pt-1">
                  <a
                    href={asset.src}
                    download
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors"
                  >
                    SVG indir
                  </a>
                  <a
                    href={asset.srcPng}
                    download
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors"
                  >
                    PNG indir
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Guide */}
      <div className="border border-border rounded-xl bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Kullanım Kılavuzu</h3>
        <div className="space-y-2">
          {[
            { where: "Landing Page", asset: "Kart (SVG)", note: "bg-slate-900 bölümünde, sağ sütunda. Drop-shadow: rgba(0,200,255,0.25)" },
            { where: "E-posta Teaser", asset: "Metin attribution", note: "<strong style='color:#00C8FF'>Step AI</strong> — CyberStep'in yapay zeka güvenlik analisti" },
            { where: "PDF Rapor", asset: "Maskot (PNG/SVG)", note: "Sayfa altı footer'da, sağ kenarda" },
            { where: "Sosyal Medya", asset: "Kart (PNG/SVG)", note: "1:1 kare format zaten mevcut (600×600)" },
            { where: "Assessment Report", asset: "Metin attribution", note: "\"Step AI ön analizi tamamlandı\" — mevcut durum" },
            { where: "CVE Uyarı E-postası", asset: "Metin attribution", note: "Step AI tarafından otomatik tespit — mevcut durum" },
          ].map(item => (
            <div key={item.where} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <div className="w-36 shrink-0">
                <span className="text-xs font-semibold text-foreground">{item.where}</span>
              </div>
              <div className="flex-1">
                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium mr-2">{item.asset}</span>
                <span className="text-xs text-muted-foreground">{item.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
