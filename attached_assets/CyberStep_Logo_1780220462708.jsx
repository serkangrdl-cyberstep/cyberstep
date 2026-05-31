import { useState } from "react";

// ─── RENK SİSTEMİ ────────────────────────────────────────────
const C = {
  navy:    "#060D1A",
  navyMid: "#0A1628",
  navyLt:  "#0F2040",
  cyan:    "#00C8FF",
  cyanDim: "rgba(0,200,255,0.15)",
  cyanGlow:"rgba(0,200,255,0.35)",
  white:   "#E8EDF5",
  gray:    "#7B8FAF",
};

// ─── İKON BİLEŞENİ ───────────────────────────────────────────
// Kalkan + içinde stilize "adım" / devre izi
function CyberStepIcon({ size = 48, glow = true }) {
  const id = `cs-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C8FF" />
          <stop offset="100%" stopColor="#0080FF" />
        </linearGradient>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`shield-clip-${id}`}>
          {/* Kalkan şekli */}
          <path d="M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z" />
        </clipPath>
      </defs>

      {/* Kalkan arka planı */}
      <path
        d="M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z"
        fill={C.navyMid}
        stroke={`url(#grad-${id})`}
        strokeWidth="1.5"
      />

      {/* İç parlak kenar */}
      <path
        d="M24 6 L39 12 L39 26 C39 33.5 32.5 40 24 43.5 C15.5 40 9 33.5 9 26 L9 12 Z"
        fill="none"
        stroke={C.cyan}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Stilize "S" / adım izi / devre yolu */}
      <g
        filter={glow ? `url(#glow-${id})` : undefined}
        clipPath={`url(#shield-clip-${id})`}
      >
        {/* Devre izi yolu — S harfi + adım metaforu */}
        <path
          d="M 17 30
             L 17 26
             L 22 26
             L 22 22
             L 17 22
             L 17 18
             L 31 18
             L 31 22
             L 26 22
             L 26 26
             L 31 26
             L 31 30
             Z"
          fill={`url(#grad-${id})`}
          fillOpacity="0.9"
        />

        {/* Devre noktaları */}
        <circle cx="17" cy="18" r="2" fill={C.cyan} />
        <circle cx="31" cy="18" r="2" fill={C.cyan} />
        <circle cx="17" cy="30" r="2" fill={C.cyan} />
        <circle cx="31" cy="30" r="2" fill={C.cyan} />

        {/* İnce yatay çizgiler — devre estetiği */}
        <line x1="10" y1="22" x2="14" y2="22" stroke={C.cyan} strokeWidth="1" strokeOpacity="0.4" />
        <line x1="34" y1="26" x2="38" y2="26" stroke={C.cyan} strokeWidth="1" strokeOpacity="0.4" />
      </g>

      {/* Kalkan alt glow */}
      <path
        d="M24 44 C16 41 8 35 8 27"
        stroke={C.cyan}
        strokeWidth="0.8"
        strokeOpacity="0.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── WORDMARK BİLEŞENİ ───────────────────────────────────────
function CyberStepWordmark({ size = "md", dark = true }) {
  const sizes = {
    sm: { icon: 28, title: 16, sub: 9 },
    md: { icon: 40, title: 22, sub: 11 },
    lg: { icon: 56, title: 30, sub: 14 },
    xl: { icon: 80, title: 42, sub: 18 },
  };
  const s = sizes[size] || sizes.md;
  const textColor = dark ? C.white : C.navy;
  const subColor  = dark ? C.gray  : "#4A5568";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.icon * 0.28 }}>
      <CyberStepIcon size={s.icon} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{
          fontSize: s.title,
          fontWeight: 800,
          color: textColor,
          letterSpacing: "-0.02em",
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}>
          Cyber
          <span style={{ color: C.cyan }}>Step</span>
        </span>
        <span style={{
          fontSize: s.sub,
          color: subColor,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 500,
          marginTop: 2,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}>
          .io
        </span>
      </div>
    </div>
  );
}

// ─── BADGE VARYANTI ──────────────────────────────────────────
function CyberStepBadge({ size = 120 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      background: `linear-gradient(145deg, ${C.navyLt} 0%, ${C.navy} 100%)`,
      border: `${size * 0.02}px solid ${C.navyLt}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 ${size * 0.08}px ${size * 0.25}px rgba(0,0,0,0.5), 0 0 ${size * 0.2}px ${C.cyanGlow}`,
    }}>
      <CyberStepIcon size={size * 0.6} />
    </div>
  );
}

// ─── ANA SHOWCASE ────────────────────────────────────────────
export default function LogoShowcase() {
  const [bg, setBg] = useState("dark");

  const isDark = bg === "dark";
  const pageBg = bg === "dark" ? C.navy : bg === "mid" ? "#1A2535" : "#F0F4F8";

  return (
    <div style={{
      minHeight: "100vh",
      background: pageBg,
      transition: "background 0.3s",
      padding: "40px 32px",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>

      {/* Başlık */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, color: C.cyan, letterSpacing: 3, marginBottom: 8, fontWeight: 700 }}>
          CYBERSTEP.IO
        </div>
        <div style={{ fontSize: 22, color: isDark ? C.white : C.navy, fontWeight: 700 }}>
          Logo Varyantları
        </div>
      </div>

      {/* Arka Plan Seçici */}
      <div style={{ display: "flex", gap: 8, marginBottom: 48 }}>
        {[
          { id: "dark",  label: "Koyu" },
          { id: "mid",   label: "Ara Ton" },
          { id: "light", label: "Açık" },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setBg(opt.id)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: `1px solid ${bg === opt.id ? C.cyan : C.navyLt}`,
              background: bg === opt.id ? `${C.cyan}20` : "transparent",
              color: bg === opt.id ? C.cyan : C.gray,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ─── BÖLÜM 1: Wordmark Varyantları ─── */}
      <Section title="Wordmark — Boyut Varyantları" isDark={isDark}>
        <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: "24px 0" }}>
          {["xl", "lg", "md", "sm"].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ width: 24, fontSize: 10, color: C.gray, textAlign: "right" }}>{s.toUpperCase()}</div>
              <CyberStepWordmark size={s} dark={isDark} />
            </div>
          ))}
        </div>
      </Section>

      {/* ─── BÖLÜM 2: İkon Varyantları ─── */}
      <Section title="İkon — Boyut Varyantları" isDark={isDark}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 32, padding: "24px 0", flexWrap: "wrap" }}>
          {[80, 64, 48, 32, 24, 16].map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <CyberStepIcon size={s} />
              <span style={{ fontSize: 9, color: C.gray }}>{s}px</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── BÖLÜM 3: App Badge (iOS/Android) ─── */}
      <Section title="App Badge — Mobil Uygulama İkonu" isDark={isDark}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, padding: "24px 0", flexWrap: "wrap" }}>
          {[120, 80, 60, 40].map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <CyberStepBadge size={s} />
              <span style={{ fontSize: 9, color: C.gray }}>{s}px</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── BÖLÜM 4: Kullanım Senaryoları ─── */}
      <Section title="Kullanım Senaryoları" isDark={isDark}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 20 }}>

          {/* Navbar simülasyonu */}
          <div>
            <div style={{ fontSize: 10, color: C.gray, marginBottom: 8, letterSpacing: 1 }}>NAVİGASYON ÇUBUĞU</div>
            <div style={{
              background: C.navyMid,
              borderRadius: 10,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: `1px solid ${C.navyLt}`,
            }}>
              <CyberStepWordmark size="sm" dark={true} />
              <div style={{ display: "flex", gap: 20 }}>
                {["Platform", "AI Güvenlik", "Araçlar", "Fiyatlar"].map(item => (
                  <span key={item} style={{ fontSize: 12, color: C.gray }}>{item}</span>
                ))}
              </div>
              <div style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: C.cyan,
                color: C.navy,
                fontSize: 11,
                fontWeight: 700,
              }}>
                Ücretsiz Başla
              </div>
            </div>
          </div>

          {/* E-posta başlığı */}
          <div>
            <div style={{ fontSize: 10, color: C.gray, marginBottom: 8, letterSpacing: 1 }}>E-POSTA BAŞLIĞI</div>
            <div style={{
              background: C.navyMid,
              borderRadius: 10,
              padding: "20px 24px",
              border: `1px solid ${C.navyLt}`,
              textAlign: "center",
            }}>
              <CyberStepWordmark size="md" dark={true} />
              <div style={{ marginTop: 12, height: 1, background: C.navyLt }} />
            </div>
          </div>

          {/* Favicon satırı */}
          <div>
            <div style={{ fontSize: 10, color: C.gray, marginBottom: 8, letterSpacing: 1 }}>FAVİCON / SEKME</div>
            <div style={{
              background: "#2A2A35",
              borderRadius: 8,
              padding: "8px 16px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: `1px solid #3A3A45`,
            }}>
              <CyberStepIcon size={16} glow={false} />
              <span style={{ fontSize: 11, color: "#CCC" }}>CyberStep.io</span>
              <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>×</span>
            </div>
          </div>

        </div>
      </Section>

      {/* ─── BÖLÜM 5: Renk Paleti ─── */}
      <Section title="Renk Paleti" isDark={isDark}>
        <div style={{ display: "flex", gap: 12, padding: "20px 0", flexWrap: "wrap" }}>
          {[
            { color: C.cyan,    name: "Cyan",      hex: "#00C8FF", role: "Primary Accent" },
            { color: C.navy,    name: "Navy",       hex: "#060D1A", role: "Background" },
            { color: C.navyMid, name: "Navy Mid",   hex: "#0A1628", role: "Surface" },
            { color: C.navyLt,  name: "Navy Light", hex: "#0F2040", role: "Border" },
            { color: C.white,   name: "White",      hex: "#E8EDF5", role: "Text" },
            { color: C.gray,    name: "Gray",       hex: "#7B8FAF", role: "Muted Text" },
          ].map(p => (
            <div key={p.hex} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{
                width: 72,
                height: 48,
                borderRadius: 8,
                background: p.color,
                border: `1px solid ${C.navyLt}`,
              }} />
              <div style={{ fontSize: 10, color: isDark ? C.white : C.navy, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 9, color: C.gray, fontFamily: "monospace" }}>{p.hex}</div>
              <div style={{ fontSize: 9, color: C.gray }}>{p.role}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer notu */}
      <div style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: `1px solid ${C.navyLt}`,
        fontSize: 11,
        color: C.gray,
        lineHeight: 1.6,
      }}>
        <p>Logo format: SVG (vektör) — Her boyutta net görünür.</p>
        <p>Favicon: 16×16 ve 32×32 için ikon varyantı kullan.</p>
        <p>Sosyal medya profil: App Badge varyantı, 400×400.</p>
        <p>Birincil renk: #00C8FF (cyan) — koyu arka plana karşı kullan.</p>
      </div>

    </div>
  );
}

// ─── YARDIMCI BÖLÜM BİLEŞENİ ─────────────────────────────────
function Section({ title, isDark, children }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        color: C.cyan,
        textTransform: "uppercase",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{ width: 3, height: 14, background: C.cyan, borderRadius: 2 }} />
        {title}
      </div>
      <div style={{
        background: isDark ? `${C.navyMid}80` : "rgba(255,255,255,0.6)",
        border: `1px solid ${isDark ? C.navyLt : "#DDE3ED"}`,
        borderRadius: 14,
        padding: "20px 24px",
      }}>
        {children}
      </div>
    </div>
  );
}
