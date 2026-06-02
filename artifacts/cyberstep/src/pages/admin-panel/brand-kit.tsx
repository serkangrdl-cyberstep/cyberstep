import { AdminLayout } from "@/components/admin-layout";
import { CyberStepIcon, CyberStepWordmark, CyberStepBadge } from "@/components/brand-logo";

// ─── Renk paleti verisi ────────────────────────────────────────────────────────

const PALETTE = [
  { name: "Cyan",        hex: "#00C8FF", oklch: "oklch(78% 0.155 212)", role: "Birincil Vurgu",    dark: true },
  { name: "Navy",        hex: "#060D1A", oklch: "oklch(9%  0.022 250)", role: "Ana Arka Plan",     dark: true },
  { name: "Navy Mid",    hex: "#0A1628", oklch: "oklch(14% 0.027 248)", role: "Yüzey / Kart",      dark: true },
  { name: "Navy Light",  hex: "#0F2040", oklch: "oklch(19% 0.040 246)", role: "Kenarlık",          dark: true },
  { name: "White",       hex: "#E8EDF5", oklch: "oklch(94% 0.010 255)", role: "Birincil Metin",    dark: false },
  { name: "Gray",        hex: "#7B8FAF", oklch: "oklch(61% 0.030 250)", role: "İkincil Metin",     dark: false },
  { name: "Blue",        hex: "#0080FF", oklch: "oklch(55% 0.170 248)", role: "Gradient Bitiş",    dark: true },
];

const CYAN_SCALE = [
  { shade: "50",  hex: "#E5F9FF" },
  { shade: "100", hex: "#CCF3FF" },
  { shade: "200", hex: "#99E7FF" },
  { shade: "300", hex: "#66DAFF" },
  { shade: "400", hex: "#33CDFF" },
  { shade: "500", hex: "#00C8FF", primary: true },
  { shade: "600", hex: "#00A3CC" },
  { shade: "700", hex: "#007A99" },
  { shade: "800", hex: "#005266" },
  { shade: "900", hex: "#002933" },
];

const NAVY_SCALE = [
  { shade: "50",  hex: "#E8EDF5" },
  { shade: "100", hex: "#C5D0E4" },
  { shade: "200", hex: "#90A4CB" },
  { shade: "300", hex: "#6080B0" },
  { shade: "400", hex: "#3A5E92" },
  { shade: "500", hex: "#1E3C6E" },
  { shade: "600", hex: "#0F2040", primary: true },
  { shade: "700", hex: "#0A1628" },
  { shade: "800", hex: "#060D1A" },
  { shade: "900", hex: "#03070E" },
];

const WCAG = [
  { fg: "#00C8FF", bg: "#060D1A", ratio: "13.8:1", level: "AAA" },
  { fg: "#E8EDF5", bg: "#060D1A", ratio: "17.2:1", level: "AAA" },
  { fg: "#E8EDF5", bg: "#0A1628", ratio: "14.8:1", level: "AAA" },
  { fg: "#7B8FAF", bg: "#060D1A", ratio: "5.1:1",  level: "AA"  },
  { fg: "#00C8FF", bg: "#0F2040", ratio: "8.4:1",  level: "AAA" },
];

// ─── Kopyala butonu ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const copy = () => navigator.clipboard?.writeText(text).catch(() => {});
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[#7B8FAF] hover:text-[#00C8FF] transition-colors font-mono"
      title="Kopyala"
    >
      {text}
    </button>
  );
}

// ─── Renk kartı ────────────────────────────────────────────────────────────────

function ColorCard({ name, hex, oklch, role, dark }: typeof PALETTE[number]) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="w-full h-16 rounded-lg border border-[#0F2040]"
        style={{ background: hex }}
      />
      <div>
        <div className="text-[#E8EDF5] text-sm font-semibold">{name}</div>
        <div className="text-[#7B8FAF] text-xs">{role}</div>
        <div className="flex gap-1 mt-1 flex-wrap">
          <CopyButton text={hex} />
        </div>
        <div className="text-[#7B8FAF] text-[10px] font-mono mt-1">{oklch}</div>
      </div>
      {!dark && (
        <div className="text-[10px] text-amber-400 bg-amber-950/30 rounded px-1.5 py-0.5 w-fit">
          Koyu arka plan üzerinde kullan
        </div>
      )}
    </div>
  );
}

// ─── Ton skala satırı ──────────────────────────────────────────────────────────

function ScaleRow({ shade, hex, primary }: { shade: string; hex: string; primary?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 text-right text-[10px] text-[#7B8FAF] font-mono">{shade}</div>
      <div
        className="w-8 h-6 rounded flex-shrink-0"
        style={{ background: hex, outline: primary ? "2px solid #00C8FF" : undefined, outlineOffset: 1 }}
      />
      <CopyButton text={hex} />
      {primary && <span className="text-[10px] text-[#00C8FF] font-semibold">PRIMARY</span>}
    </div>
  );
}

// ─── Logo varyant kartı ────────────────────────────────────────────────────────

function LogoCard({ title, bg, children }: { title: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">{title}</div>
      <div
        className="rounded-xl p-6 flex items-center justify-center border border-[#0F2040]"
        style={{ background: bg }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Token kodu bloğu ─────────────────────────────────────────────────────────

const TOKEN_CSS = `/* CyberStep.io Design Tokens */
--cs-navy:       #060D1A;  /* oklch(9%  0.022 250) */
--cs-navy-mid:   #0A1628;  /* oklch(14% 0.027 248) */
--cs-navy-lt:    #0F2040;  /* oklch(19% 0.040 246) */
--cs-cyan:       #00C8FF;  /* oklch(78% 0.155 212) */
--cs-white:      #E8EDF5;  /* oklch(94% 0.010 255) */
--cs-gray:       #7B8FAF;  /* oklch(61% 0.030 250) */
--cs-gradient:   linear-gradient(135deg, #00C8FF 0%, #0080FF 100%);`.trim();

const TOKEN_TW = `// tailwind.config.ts extend.colors
cyberstep: {
  navy:    "#060D1A",
  surface: "#0A1628",
  border:  "#0F2040",
  cyan:    "#00C8FF",
  blue:    "#0080FF",
  white:   "#E8EDF5",
  gray:    "#7B8FAF",
}`.trim();

function CodeBlock({ code, label }: { code: string; label: string }) {
  const copy = () => navigator.clipboard?.writeText(code).catch(() => {});
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">{label}</div>
        <button
          onClick={copy}
          className="text-[10px] text-[#7B8FAF] hover:text-[#00C8FF] transition-colors"
        >
          Kopyala
        </button>
      </div>
      <pre className="bg-[#03070E] border border-[#0F2040] rounded-lg p-4 text-[11px] text-[#E8EDF5] font-mono overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function BrandKit() {
  return (
    <AdminLayout
      title="Marka Kılavuzu"
      description="CyberStep.io renk sistemi, tipografi, logo varyantları ve tasarım tokenleri"
    >
      <div className="space-y-12 max-w-5xl">

        {/* ── Bölüm 1: Logo varyantları ────────────────────────────────── */}
        <section>
          <SectionHeader label="Logo Varyantları" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <LogoCard title="Koyu Arka Plan" bg="#060D1A">
              <CyberStepWordmark size="lg" dark />
            </LogoCard>
            <LogoCard title="Orta Ton" bg="#0A1628">
              <CyberStepWordmark size="lg" dark />
            </LogoCard>
            <LogoCard title="Açık Arka Plan" bg="#F0F4F8">
              <CyberStepWordmark size="lg" dark={false} />
            </LogoCard>
            <LogoCard title="İkon — Boyutlar" bg="#060D1A">
              <div className="flex items-end gap-4">
                {[64, 48, 32, 24, 16].map(s => (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    <CyberStepIcon size={s} />
                    <span className="text-[9px] text-[#7B8FAF]">{s}</span>
                  </div>
                ))}
              </div>
            </LogoCard>
            <LogoCard title="App Badge" bg="#060D1A">
              <div className="flex items-end gap-4">
                {[80, 60, 40].map(s => (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    <CyberStepBadge size={s} />
                    <span className="text-[9px] text-[#7B8FAF]">{s}</span>
                  </div>
                ))}
              </div>
            </LogoCard>
            <LogoCard title="Navigasyon Simülasyonu" bg="#0A1628">
              <div className="w-full flex items-center justify-between border border-[#0F2040] rounded-lg px-4 py-2.5">
                <CyberStepWordmark size="sm" dark />
                <div
                  className="text-[10px] font-bold rounded px-3 py-1"
                  style={{ background: "#00C8FF", color: "#060D1A" }}
                >
                  Ücretsiz Başla
                </div>
              </div>
            </LogoCard>
          </div>

          {/* SVG asset linkleri */}
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { label: "logo-wordmark.svg",        href: "/logo-wordmark.svg" },
              { label: "logo-wordmark-light.svg",  href: "/logo-wordmark-light.svg" },
              { label: "logo-mono.svg",             href: "/logo-mono.svg",            note: "koyu bg için beyaz, açık bg için siyah" },
              { label: "logo-badge-512.svg",        href: "/logo-badge-512.svg" },
              { label: "favicon.svg",               href: "/favicon.svg" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                download={label}
                className="inline-flex items-center gap-1.5 text-xs text-[#00C8FF] border border-[#0F2040] rounded px-3 py-1.5 hover:bg-[#0F2040] transition-colors font-mono"
              >
                ↓ {label}
              </a>
            ))}
          </div>
        </section>

        {/* ── Bölüm 2: Renk paleti ─────────────────────────────────────── */}
        <section>
          <SectionHeader label="Renk Paleti" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {PALETTE.map(p => <ColorCard key={p.hex} {...p} />)}
          </div>
        </section>

        {/* ── Bölüm 3: Ton skaları ─────────────────────────────────────── */}
        <section>
          <SectionHeader label="Ton Skaları" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <div className="text-[11px] text-[#00C8FF] font-semibold uppercase tracking-widest mb-3">Cyan</div>
              <div className="space-y-2">
                {CYAN_SCALE.map(s => <ScaleRow key={s.shade} {...s} />)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#00C8FF] font-semibold uppercase tracking-widest mb-3">Navy</div>
              <div className="space-y-2">
                {NAVY_SCALE.map(s => <ScaleRow key={s.shade} {...s} />)}
              </div>
            </div>
          </div>
        </section>

        {/* ── Bölüm 4: Tipografi ───────────────────────────────────────── */}
        <section>
          <SectionHeader label="Tipografi" />
          <div className="bg-[#0A1628] border border-[#0F2040] rounded-xl p-6 space-y-5">
            <div>
              <div className="text-[10px] text-[#7B8FAF] uppercase tracking-widest mb-1">Font ailesi</div>
              <div className="font-mono text-sm text-[#E8EDF5]">Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif</div>
            </div>
            <div className="border-t border-[#0F2040] pt-5 space-y-4">
              {[
                { label: "H1 — 48px / 800", cls: "text-5xl font-extrabold", text: "Siber Güvenlik" },
                { label: "H2 — 36px / 700", cls: "text-4xl font-bold",      text: "Risk Analizi" },
                { label: "H3 — 24px / 700", cls: "text-2xl font-bold",      text: "Domain Taraması" },
                { label: "Body — 16px / 400", cls: "text-base",             text: "Türkiye'nin KOBİ odaklı siber güvenlik platformu. AI destekli risk değerlendirmesi." },
                { label: "Small — 14px / 400", cls: "text-sm text-[#7B8FAF]", text: "Son güncelleme: 2 Haziran 2026" },
                { label: "Caption — 12px / 500", cls: "text-xs text-[#7B8FAF] uppercase tracking-widest font-medium", text: "SİBER GÜVENLİK PLATFORMU" },
              ].map(({ label, cls, text }) => (
                <div key={label}>
                  <div className="text-[10px] text-[#7B8FAF] mb-1">{label}</div>
                  <div className={`text-[#E8EDF5] ${cls}`}>{text}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#0F2040] pt-5">
              <div className="text-[10px] text-[#7B8FAF] mb-2">Minimum boyutlar (erişilebilirlik)</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-[#060D1A] rounded-lg p-3 text-center">
                  <div className="text-[#00C8FF] font-bold text-lg">16px</div>
                  <div className="text-[#7B8FAF] text-xs">Web gövde metni</div>
                </div>
                <div className="bg-[#060D1A] rounded-lg p-3 text-center">
                  <div className="text-[#00C8FF] font-bold text-lg">14px</div>
                  <div className="text-[#7B8FAF] text-xs">Mobil gövde</div>
                </div>
                <div className="bg-[#060D1A] rounded-lg p-3 text-center">
                  <div className="text-[#00C8FF] font-bold text-lg">44px</div>
                  <div className="text-[#7B8FAF] text-xs">Touch hedefi</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bölüm 5: WCAG Kontrastları ───────────────────────────────── */}
        <section>
          <SectionHeader label="WCAG 2.2 Kontrast Denetimi" />
          <div className="bg-[#0A1628] border border-[#0F2040] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#0F2040]">
                  <th className="text-left px-4 py-3 text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">Metin rengi</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">Arka plan</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">Oran</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">Seviye</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#7B8FAF] font-semibold uppercase tracking-widest">Örnek</th>
                </tr>
              </thead>
              <tbody>
                {WCAG.map(({ fg, bg, ratio, level }) => (
                  <tr key={`${fg}-${bg}`} className="border-b border-[#0F2040] last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: fg }}>{fg}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 rounded border border-[#0F2040]" style={{ background: bg }} />
                        <span className="font-mono text-xs text-[#7B8FAF]">{bg}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#E8EDF5]">{ratio}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${level === "AAA" ? "bg-emerald-950/50 text-emerald-400" : "bg-blue-950/50 text-blue-400"}`}>
                        {level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-3 py-1 rounded"
                        style={{ color: fg, background: bg }}
                      >
                        Örnek metin
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Bölüm 6: Tasarım Tokenleri ───────────────────────────────── */}
        <section>
          <SectionHeader label="Tasarım Tokenleri" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CodeBlock code={TOKEN_CSS} label="CSS Özel Özellikler" />
            <CodeBlock code={TOKEN_TW}  label="Tailwind Config" />
          </div>
          <div className="mt-4">
            <a
              href="/brand-tokens.css"
              target="_blank"
              className="inline-flex items-center gap-2 text-sm text-[#00C8FF] border border-[#0F2040] rounded-lg px-4 py-2 hover:bg-[#0F2040] transition-colors"
            >
              ↓ brand-tokens.css indir
            </a>
          </div>
        </section>

        {/* ── Bölüm 7: Kullanım Kuralları ──────────────────────────────── */}
        <section>
          <SectionHeader label="Kullanım Kuralları" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RuleCard color="emerald" title="Yapılacaklar">
              <RuleItem ok>Cyan (#00C8FF) sadece koyu arka planlarda kullan</RuleItem>
              <RuleItem ok>Logo'yu minimum 28px boyutunda göster</RuleItem>
              <RuleItem ok>Metin öğeleri için Inter kullan</RuleItem>
              <RuleItem ok>Dark mode varsayılan — navy palet kullan</RuleItem>
              <RuleItem ok>Touch hedeflerini ≥44px tut</RuleItem>
            </RuleCard>
            <RuleCard color="red" title="Yapılmayacaklar">
              <RuleItem ok={false}>Cyan rengini açık arka planda kullanma</RuleItem>
              <RuleItem ok={false}>Logo'yu 16px altında gösterme</RuleItem>
              <RuleItem ok={false}>Brand renklerini gradient olmadan beyaza karıştırma</RuleItem>
              <RuleItem ok={false}>Logoya gölge veya efekt ekleme</RuleItem>
              <RuleItem ok={false}>Yalnızca renkle anlam iletme (erişilebilirlik)</RuleItem>
            </RuleCard>
          </div>
        </section>

      </div>
    </AdminLayout>
  );
}

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-0.5 h-4 bg-[#00C8FF] rounded-full" />
      <h2 className="text-xs font-bold text-[#00C8FF] uppercase tracking-[0.18em]">{label}</h2>
    </div>
  );
}

function RuleCard({ color, title, children }: { color: "emerald" | "red"; title: string; children: React.ReactNode }) {
  const border = color === "emerald" ? "border-emerald-800" : "border-red-900";
  const bg     = color === "emerald" ? "bg-emerald-950/30"  : "bg-red-950/30";
  const text   = color === "emerald" ? "text-emerald-400"   : "text-red-400";
  return (
    <div className={`rounded-xl border ${border} ${bg} p-5`}>
      <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${text}`}>{title}</div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function RuleItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#E8EDF5]">
      <span className={`mt-0.5 flex-shrink-0 ${ok ? "text-emerald-400" : "text-red-400"}`}>
        {ok ? "✓" : "✗"}
      </span>
      {children}
    </li>
  );
}
