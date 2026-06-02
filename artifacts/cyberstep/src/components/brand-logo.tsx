/**
 * CyberStep.io — Brand Logo Components
 *
 * Exported components:
 *   <CyberStepIcon size={48} glow={true} />
 *   <CyberStepWordmark size="md" dark={true} />
 *   <CyberStepBadge size={120} />
 *   <CyberStepNavLogo />  — pre-sized for nav bar
 */

// ─── Renk sabitleri ───────────────────────────────────────────────────────────

const C = {
  navy:    "#060D1A",
  navyMid: "#0A1628",
  navyLt:  "#0F2040",
  cyan:    "#00C8FF",
  cyanGlow:"rgba(0,200,255,0.35)",
  white:   "#E8EDF5",
  gray:    "#7B8FAF",
} as const;

// ─── Boyut tipleri ────────────────────────────────────────────────────────────

type WordmarkSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<WordmarkSize, { icon: number; title: number; sub: number }> = {
  xs: { icon: 20, title: 12, sub:  7 },
  sm: { icon: 28, title: 16, sub:  9 },
  md: { icon: 40, title: 22, sub: 11 },
  lg: { icon: 56, title: 30, sub: 14 },
  xl: { icon: 80, title: 42, sub: 18 },
};

// ─── Icon (kalkan + devre yolu) ───────────────────────────────────────────────

interface IconProps {
  size?: number;
  glow?: boolean;
  className?: string;
}

export function CyberStepIcon({ size = 48, glow = true, className }: IconProps) {
  const id = `cs-icon-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="CyberStep.io"
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={C.cyan} />
          <stop offset="100%" stopColor="#0080FF" />
        </linearGradient>
        {glow && (
          <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
        <clipPath id={`${id}-clip`}>
          <path d="M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z" />
        </clipPath>
      </defs>

      {/* Kalkan arka plan */}
      <path
        d="M24 3 L42 10 L42 26 C42 35 34 42 24 46 C14 42 6 35 6 26 L6 10 Z"
        fill={C.navyMid}
        stroke={`url(#${id}-grad)`}
        strokeWidth="1.5"
      />

      {/* İç kenar çizgisi */}
      <path
        d="M24 6 L39 12 L39 26 C39 33.5 32.5 40 24 43.5 C15.5 40 9 33.5 9 26 L9 12 Z"
        fill="none"
        stroke={C.cyan}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Devre yolu (S motifi) */}
      <g
        filter={glow ? `url(#${id}-glow)` : undefined}
        clipPath={`url(#${id}-clip)`}
      >
        <path
          d="M 17 30 L 17 26 L 22 26 L 22 22 L 17 22 L 17 18 L 31 18 L 31 22 L 26 22 L 26 26 L 31 26 L 31 30 Z"
          fill={`url(#${id}-grad)`}
          fillOpacity="0.9"
        />
        <circle cx="17" cy="18" r="2" fill={C.cyan} />
        <circle cx="31" cy="18" r="2" fill={C.cyan} />
        <circle cx="17" cy="30" r="2" fill={C.cyan} />
        <circle cx="31" cy="30" r="2" fill={C.cyan} />
        <line x1="10" y1="22" x2="14" y2="22" stroke={C.cyan} strokeWidth="1" strokeOpacity="0.4" />
        <line x1="34" y1="26" x2="38" y2="26" stroke={C.cyan} strokeWidth="1" strokeOpacity="0.4" />
      </g>

      {/* Alt glow yayı */}
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

// ─── Wordmark (icon + text) ───────────────────────────────────────────────────

interface WordmarkProps {
  size?: WordmarkSize;
  dark?: boolean;
  className?: string;
}

export function CyberStepWordmark({ size = "md", dark = true, className }: WordmarkProps) {
  const s = SIZES[size] ?? SIZES.md;
  const textColor = dark ? C.white : C.navy;
  const subColor  = dark ? C.gray  : "#4A5568";

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: Math.round(s.icon * 0.28) }}
      className={className}
    >
      <CyberStepIcon size={s.icon} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          style={{
            fontSize: s.title,
            fontWeight: 800,
            color: textColor,
            letterSpacing: "-0.02em",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}
        >
          Cyber
          <span style={{ color: C.cyan }}>Step</span>
        </span>
        <span
          style={{
            fontSize: s.sub,
            color: subColor,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            fontWeight: 500,
            marginTop: 2,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}
        >
          .io
        </span>
      </div>
    </div>
  );
}

// ─── Badge (app icon variant) ─────────────────────────────────────────────────

interface BadgeProps {
  size?: number;
  className?: string;
}

export function CyberStepBadge({ size = 120, className }: BadgeProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: `linear-gradient(145deg, ${C.navyLt} 0%, ${C.navy} 100%)`,
        border: `${Math.max(1, Math.round(size * 0.02))}px solid ${C.navyLt}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 ${Math.round(size * 0.08)}px ${Math.round(size * 0.25)}px rgba(0,0,0,0.5), 0 0 ${Math.round(size * 0.2)}px ${C.cyanGlow}`,
        flexShrink: 0,
      }}
    >
      <CyberStepIcon size={Math.round(size * 0.6)} />
    </div>
  );
}

// ─── Pre-sized nav logo ───────────────────────────────────────────────────────

export function CyberStepNavLogo({ className }: { className?: string }) {
  return <CyberStepWordmark size="sm" dark={true} className={className} />;
}

// ─── Default export — full showcase (for Storybook/brand kit use) ─────────────

export default CyberStepWordmark;
