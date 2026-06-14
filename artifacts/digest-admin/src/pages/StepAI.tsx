import { useState } from "react";

// ─── Veri ─────────────────────────────────────────────────────────────────────

const PALETTE = [
  { name: "Cyan",       hex: "#00C8FF", role: "Birincil Vurgu",  dark: true },
  { name: "Navy",       hex: "#060D1A", role: "Ana Arka Plan",   dark: true },
  { name: "Navy Mid",   hex: "#0A1628", role: "Yüzey / Kart",   dark: true },
  { name: "Navy Light", hex: "#0F2040", role: "Kenarlık",        dark: true },
  { name: "White",      hex: "#E8EDF5", role: "Birincil Metin",  dark: false },
  { name: "Gray",       hex: "#7B8FAF", role: "İkincil Metin",   dark: false },
  { name: "Amber",      hex: "#F5A623", role: "Step AI Vurgu",   dark: true },
];

const CYAN_SCALE = [
  { shade: "50",  hex: "#E5F9FF" }, { shade: "100", hex: "#CCF3FF" },
  { shade: "200", hex: "#99E7FF" }, { shade: "300", hex: "#66DAFF" },
  { shade: "400", hex: "#33CDFF" }, { shade: "500", hex: "#00C8FF", primary: true },
  { shade: "600", hex: "#00A3CC" }, { shade: "700", hex: "#007A99" },
  { shade: "800", hex: "#005266" }, { shade: "900", hex: "#002933" },
];

const NAVY_SCALE = [
  { shade: "50",  hex: "#E8EDF5" }, { shade: "100", hex: "#C5D0E4" },
  { shade: "200", hex: "#90A4CB" }, { shade: "300", hex: "#6080B0" },
  { shade: "400", hex: "#3A5E92" }, { shade: "500", hex: "#1E3C6E" },
  { shade: "600", hex: "#0F2040", primary: true }, { shade: "700", hex: "#0A1628" },
  { shade: "800", hex: "#060D1A" }, { shade: "900", hex: "#03070E" },
];

const WCAG = [
  { fg: "#00C8FF", bg: "#060D1A", ratio: "13.8:1", level: "AAA" },
  { fg: "#E8EDF5", bg: "#060D1A", ratio: "17.2:1", level: "AAA" },
  { fg: "#E8EDF5", bg: "#0A1628", ratio: "14.8:1", level: "AAA" },
  { fg: "#7B8FAF", bg: "#060D1A", ratio: "5.1:1",  level: "AA"  },
  { fg: "#00C8FF", bg: "#0F2040", ratio: "8.4:1",  level: "AAA" },
];

const TOKEN_CSS = `/* CyberStep.io Design Tokens */
--cs-navy:      #060D1A;  /* oklch(9%  0.022 250) */
--cs-navy-mid:  #0A1628;  /* oklch(14% 0.027 248) */
--cs-navy-lt:   #0F2040;  /* oklch(19% 0.040 246) */
--cs-cyan:      #00C8FF;  /* oklch(78% 0.155 212) */
--cs-amber:     #F5A623;  /* Step AI vurgu */
--cs-white:     #E8EDF5;  /* oklch(94% 0.010 255) */
--cs-gray:      #7B8FAF;  /* oklch(61% 0.030 250) */
--cs-gradient:  linear-gradient(135deg, #00C8FF 0%, #0080FF 100%);`;

const TOKEN_TW = `// tailwind.config.ts extend.colors
cyberstep: {
  navy:    "#060D1A",
  surface: "#0A1628",
  border:  "#0F2040",
  cyan:    "#00C8FF",
  blue:    "#0080FF",
  amber:   "#F5A623",
  white:   "#E8EDF5",
  gray:    "#7B8FAF",
}`;

const MASCOT_ASSETS = [
  {
    id: "card",
    label: "Step AI Kart",
    size: "600 × 600",
    desc: "Tam gövde + koyu arka plan + \"Step AI / by CyberStep.io\". Sosyal medya ve sunum için.",
    src: "/step-ai-card.svg",
    srcPng: "/step-ai-card.png",
    previewBg: "#0D1E33",
    previewH: "h-72",
  },
  {
    id: "maskot",
    label: "Step AI Maskot",
    size: "400 × 500",
    desc: "Tam gövde, şeffaf arka plan, \"POWERED BY CYBERSTEP.IO\" tabanlı. E-posta ve PDF için.",
    src: "/step-ai-maskot.svg",
    srcPng: "/step-ai-maskot.png",
    previewBg: "#060D1A",
    previewH: "h-72",
  },
  {
    id: "avatar",
    label: "Step AI Avatar",
    size: "300 × 300",
    desc: "Sadece yüz/kafa, daire içinde. Profil ikonu ve küçük ikonlar için.",
    src: "/step-ai-avatar.svg",
    srcPng: "/step-ai-avatar.png",
    previewBg: "#0A1628",
    previewH: "h-56",
  },
];

const LOGO_ASSETS = [
  { label: "Wordmark (Koyu)", file: "logo-wordmark.svg",       desc: "Koyu arka plan" },
  { label: "Wordmark (Açık)", file: "logo-wordmark-light.svg", desc: "Açık arka plan" },
  { label: "İkon",            file: "logo-icon.svg",            desc: "Tek başına kalkan" },
  { label: "Badge 512px",     file: "logo-badge-512.svg",       desc: "App store / favicon" },
];

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-0.5 h-4 rounded-full" style={{ background: "#00C8FF" }} />
      <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#00C8FF" }}>
        {label}
      </h2>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-0.5 rounded font-mono transition-colors"
      style={{ background: "rgba(255,255,255,0.08)", color: copied ? "#00C8FF" : "#7B8FAF" }}
      title="Kopyala"
    >
      {copied ? "Kopyalandı!" : text}
    </button>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function StepAI() {
  return (
    <div className="space-y-14 max-w-5xl" style={{ color: "#E8EDF5" }}>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8"
        style={{ background: "linear-gradient(135deg, #0D1E33 0%, #060D1A 100%)", border: "1px solid #0F2040" }}
      >
        <img src="/step-ai-avatar.svg" alt="Step AI avatar" className="w-24 h-24 shrink-0" />
        <div className="flex-1 space-y-2 text-center md:text-left">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#00C8FF" }}>
            Marka Kılavuzu
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#E8EDF5" }}>
            CyberStep.io × <span style={{ color: "#00C8FF" }}>Step AI</span>
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#7B8FAF" }}>
            CyberStep marka kimliği ve Step AI yapay zeka güvenlik analistine ait görseller, renk paleti, tipografi ve kullanım kuralları.
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "rgba(0,200,255,0.12)", color: "#00C8FF", border: "1px solid rgba(0,200,255,0.25)" }}>
              Step AI — CyberStep'in Yapay Zeka Güvenlik Analisti
            </span>
          </div>
        </div>
      </div>

      {/* ── Bölüm 1: Step AI Maskot Görselleri ─────────────────────────── */}
      <section>
        <SectionHeader label="Step AI — Maskot Görselleri" />
        <div className="grid md:grid-cols-3 gap-5">
          {MASCOT_ASSETS.map(asset => (
            <div
              key={asset.id}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #0F2040" }}
            >
              <div
                className={`flex items-center justify-center p-4 ${asset.previewH}`}
                style={{ background: asset.previewBg }}
              >
                <img
                  src={asset.src}
                  alt={asset.label}
                  className="h-full object-contain"
                  style={{ filter: "drop-shadow(0 0 24px rgba(0,200,255,0.2))" }}
                />
              </div>
              <div className="p-4 space-y-2" style={{ background: "#0A1628" }}>
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-sm" style={{ color: "#E8EDF5" }}>{asset.label}</p>
                  <span className="text-xs font-mono" style={{ color: "#7B8FAF" }}>{asset.size}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#7B8FAF" }}>{asset.desc}</p>
                <div className="flex gap-2 pt-1">
                  <a href={asset.src} download
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: "1px solid #0F2040", color: "#00C8FF", background: "rgba(0,200,255,0.06)" }}>
                    SVG indir
                  </a>
                  <a href={asset.srcPng} download
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: "1px solid #0F2040", color: "#7B8FAF", background: "rgba(255,255,255,0.04)" }}>
                    PNG indir
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Step AI Marka adı kullanımı */}
        <div className="mt-5 rounded-xl p-5 space-y-3" style={{ background: "#0A1628", border: "1px solid #0F2040" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#00C8FF" }}>
            Step AI Marka Adı Kullanımı
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Ana kullanım", value: "Step AI", note: "Büyük S, büyük A, aralarında boşluk" },
              { label: "Uzun form (TR)", value: "Step AI — CyberStep'in yapay zeka güvenlik analisti", note: "Tanıtım metinleri için" },
              { label: "İngilizce", value: "Step AI — CyberStep's AI Security Analyst", note: "EN içerik için" },
              { label: "PDF / E-posta footer", value: "Bu rapor, Step AI tarafından hazırlanmıştır.", note: "Mevcut e-posta ve PDF şablonu" },
            ].map(item => (
              <div key={item.label} className="rounded-lg p-3" style={{ background: "#060D1A", border: "1px solid #0F2040" }}>
                <p className="text-xs mb-1" style={{ color: "#7B8FAF" }}>{item.label}</p>
                <p className="text-sm font-mono" style={{ color: "#E8EDF5" }}>{item.value}</p>
                <p className="text-xs mt-1 italic" style={{ color: "#7B8FAF" }}>{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bölüm 2: CyberStep Logo Varyantları ────────────────────────── */}
      <section>
        <SectionHeader label="CyberStep.io — Logo Varyantları" />
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl p-6 flex items-center justify-center" style={{ background: "#060D1A", border: "1px solid #0F2040", minHeight: 100 }}>
            <img src="/logo-wordmark.svg" alt="Wordmark koyu" className="h-10 max-w-full" />
          </div>
          <div className="rounded-xl p-6 flex items-center justify-center" style={{ background: "#F0F4F8", border: "1px solid #0F2040", minHeight: 100 }}>
            <img src="/logo-wordmark-light.svg" alt="Wordmark açık" className="h-10 max-w-full" />
          </div>
          <div className="rounded-xl p-6 flex items-center justify-center gap-6" style={{ background: "#060D1A", border: "1px solid #0F2040", minHeight: 100 }}>
            {[48, 32, 24, 16].map(s => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <img src="/logo-icon.svg" alt="İkon" style={{ width: s, height: s }} />
                <span className="text-xs" style={{ color: "#7B8FAF" }}>{s}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-6 flex items-center justify-center gap-4" style={{ background: "#060D1A", border: "1px solid #0F2040", minHeight: 100 }}>
            {[72, 52, 36].map(s => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <img src="/logo-badge-512.svg" alt="Badge" style={{ width: s, height: s }} />
                <span className="text-xs" style={{ color: "#7B8FAF" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {LOGO_ASSETS.map(({ label, file, desc }) => (
            <a key={file} href={`/${file}`} download={file}
              className="inline-flex flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors"
              style={{ color: "#00C8FF", border: "1px solid #0F2040" }}>
              <span className="text-xs font-semibold">↓ {label}</span>
              <span className="text-xs font-mono" style={{ color: "#7B8FAF" }}>{desc}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Bölüm 3: Renk Paleti ────────────────────────────────────────── */}
      <section>
        <SectionHeader label="Renk Paleti" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
          {PALETTE.map(p => (
            <div key={p.hex} className="flex flex-col gap-2">
              <div className="w-full h-14 rounded-lg" style={{ background: p.hex, border: "1px solid #0F2040" }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: "#E8EDF5" }}>{p.name}</div>
                <div className="text-xs mb-1" style={{ color: "#7B8FAF" }}>{p.role}</div>
                <CopyButton text={p.hex} />
              </div>
              {!p.dark && (
                <div className="text-xs rounded px-1.5 py-0.5 w-fit" style={{ color: "#F5A623", background: "rgba(245,166,35,0.1)" }}>
                  Koyu arka planda kullan
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          {[{ label: "Cyan", scale: CYAN_SCALE }, { label: "Navy", scale: NAVY_SCALE }].map(({ label, scale }) => (
            <div key={label}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#00C8FF" }}>{label}</div>
              <div className="space-y-2">
                {scale.map(s => (
                  <div key={s.shade} className="flex items-center gap-3">
                    <div className="w-6 text-right text-xs font-mono" style={{ color: "#7B8FAF" }}>{s.shade}</div>
                    <div className="w-8 h-6 rounded shrink-0" style={{
                      background: s.hex,
                      outline: s.primary ? "2px solid #00C8FF" : undefined,
                      outlineOffset: 1,
                    }} />
                    <CopyButton text={s.hex} />
                    {s.primary && <span className="text-xs font-semibold" style={{ color: "#00C8FF" }}>PRIMARY</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bölüm 4: WCAG Kontrast ──────────────────────────────────────── */}
      <section>
        <SectionHeader label="WCAG 2.2 Kontrast Denetimi" />
        <div className="rounded-xl overflow-hidden" style={{ background: "#0A1628", border: "1px solid #0F2040" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #0F2040" }}>
                {["Metin", "Arka Plan", "Oran", "Seviye", "Örnek"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#7B8FAF" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WCAG.map(({ fg, bg, ratio, level }) => (
                <tr key={`${fg}-${bg}`} style={{ borderBottom: "1px solid #0F2040" }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: fg }}>{fg}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ background: bg, border: "1px solid #0F2040" }} />
                      <span className="font-mono text-xs" style={{ color: "#7B8FAF" }}>{bg}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#E8EDF5" }}>{ratio}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={level === "AAA"
                        ? { background: "rgba(46,204,113,0.15)", color: "#2ECC71" }
                        : { background: "rgba(0,128,255,0.15)", color: "#0080FF" }}>
                      {level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-3 py-1 rounded" style={{ color: fg, background: bg }}>Örnek metin</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Bölüm 5: Tasarım Tokenleri ──────────────────────────────────── */}
      <section>
        <SectionHeader label="Tasarım Tokenleri" />
        <div className="grid lg:grid-cols-2 gap-4">
          {[{ code: TOKEN_CSS, label: "CSS Özel Özellikler" }, { code: TOKEN_TW, label: "Tailwind Config" }].map(({ code, label }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#7B8FAF" }}>{label}</div>
                <button
                  onClick={() => navigator.clipboard?.writeText(code).catch(() => {})}
                  className="text-xs transition-colors"
                  style={{ color: "#7B8FAF" }}
                >
                  Kopyala
                </button>
              </div>
              <pre className="rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed"
                style={{ background: "#03070E", border: "1px solid #0F2040", color: "#E8EDF5" }}>
                {code}
              </pre>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <a href="/brand-tokens.css" download
            className="inline-flex items-center gap-2 text-sm rounded-lg px-4 py-2 transition-colors"
            style={{ color: "#00C8FF", border: "1px solid #0F2040" }}>
            ↓ brand-tokens.css indir
          </a>
        </div>
      </section>

      {/* ── Bölüm 6: Kullanım Kuralları ─────────────────────────────────── */}
      <section>
        <SectionHeader label="Kullanım Kuralları" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={{ border: "1px solid rgba(46,204,113,0.3)", background: "rgba(46,204,113,0.06)" }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2ECC71" }}>Yapılacaklar</div>
            <ul className="space-y-2">
              {[
                "Cyan (#00C8FF) sadece koyu arka planlarda kullan",
                "Logoya minimum 28px boyutunda yer ver",
                "Step AI adını her zaman 'Step AI' olarak yaz (büyük S, büyük A)",
                "Dark mode varsayılan — navy palet kullan",
                "Touch hedeflerini ≥44px tut",
              ].map(t => (
                <li key={t} className="flex items-start gap-2 text-sm" style={{ color: "#E8EDF5" }}>
                  <span style={{ color: "#2ECC71" }} className="mt-0.5 shrink-0">✓</span> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-5" style={{ border: "1px solid rgba(231,76,60,0.3)", background: "rgba(231,76,60,0.06)" }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#E74C3C" }}>Yapılmayacaklar</div>
            <ul className="space-y-2">
              {[
                "Cyan rengini açık arka planda kullanma",
                "Logoyu 16px altında gösterme",
                "Marka renklerini gradient olmadan beyaza karıştırma",
                "Step AI maskotuna arka plan ekleme (zaten dark card var)",
                "Logoya gölge veya filtre efekti ekleme",
              ].map(t => (
                <li key={t} className="flex items-start gap-2 text-sm" style={{ color: "#E8EDF5" }}>
                  <span style={{ color: "#E74C3C" }} className="mt-0.5 shrink-0">✗</span> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

    </div>
  );
}
