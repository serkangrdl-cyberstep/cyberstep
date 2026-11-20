const W = 1600;
const H = 900;

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Başlığı kelime sınırından satırlara böler; sığmayan kısmı kırpar. */
export function wrapTitle(title: string, maxChars = 24, maxLines = 4): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s.,;:]*$/, "") + "…";
    return kept;
  }
  return lines;
}

/** Arka plan (isteğe bağlı) + başlık metni içeren 16:9 kapak SVG'si. Türkçe karakterler UTF-8 olarak gömülür. */
export function buildCoverSvg(opts: { title: string; label?: string; backgroundDataUrl?: string }): string {
  const lines = wrapTitle(opts.title);
  const fontSize = lines.length > 3 ? 64 : 76;
  const lineH = Math.round(fontSize * 1.2);
  const startY = Math.round(H / 2 - ((lines.length - 1) * lineH) / 2) + 10;
  const bg = opts.backgroundDataUrl
    ? `<image href="${opts.backgroundDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : "";
  const label = opts.label
    ? `<text x="100" y="${startY - lineH - 30}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="4" fill="#2EC4B6">${esc(opts.label.toLocaleUpperCase("tr-TR"))}</text>`
    : "";
  const tspans = lines
    .map((l, i) => `<tspan x="100" y="${startY + i * lineH}">${esc(l)}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1628"/><stop offset="1" stop-color="#10284A"/></linearGradient>
<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0A1628" stop-opacity="0.92"/><stop offset="0.75" stop-color="#0A1628" stop-opacity="0.55"/><stop offset="1" stop-color="#0A1628" stop-opacity="0.3"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#base)"/>
${bg}
<rect width="${W}" height="${H}" fill="url(#shade)"/>
<rect x="0" y="0" width="${W}" height="8" fill="#2EC4B6"/>
${label}
<text font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#E9EDF5">${tspans}</text>
<text x="100" y="${H - 60}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#E9EDF5">Cyber<tspan fill="#2EC4B6">Step</tspan><tspan font-size="24" font-weight="400" fill="#A9B4C7">.io</tspan></text>
</svg>`;
}

export function buildCoverBackgroundPrompt(title: string, excerpt: string | null, tprm: boolean): string {
  const motif = tprm
    ? "Abstract network of interconnected nodes representing suppliers and a supply chain, one node subtly highlighted in amber as a risk signal."
    : "Abstract digital security visualization.";
  return [
    "Professional cybersecurity blog cover background, 16:9 landscape.",
    "Dark navy (#0A1628) base with teal accents, clean and minimal, cinematic lighting.",
    motif,
    `Theme: "${title}".`,
    excerpt ? `Context: ${excerpt.slice(0, 120)}.` : "",
    "Absolutely no text, no letters, no numbers, no logos in the image. Leave the left half calmer and darker for overlaid text.",
  ].filter(Boolean).join(" ");
}

export function isTprmTitle(title: string): boolean {
  return /tedarik|tprm|üçüncü taraf/i.test(title);
}
