import sanitizeHtml from "sanitize-html";

/**
 * Blog içeriğini kaydederken biçimi güvenceye alır.
 * Düz metin (blok etiketi olmayan) yapıştırılmışsa satırları paragraflara çevirir;
 * kısa, noktayla bitmeyen satırları ara başlık (h2) yapar. HTML içerik aynen kalır.
 */
const BLOCK_TAG = /<(p|h[1-6]|ul|ol|li|blockquote|table|div|pre|hr|figure)\b/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function normalizeBlogHtml(input: string): string {
  const raw = (input ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return raw;

  // Tek <p> içinde, <br> veya satır sonlarıyla birleşmiş uzun metin: paragraflara aç.
  const onlyOneParagraph = /^<p>[\s\S]*<\/p>$/i.test(raw) && (raw.match(/<p\b/gi) ?? []).length === 1;
  if (BLOCK_TAG.test(raw) && !onlyOneParagraph) return raw;

  const text = onlyOneParagraph
    ? raw.replace(/^<p>|<\/p>$/gi, "").replace(/<br\s*\/?>/gi, "\n")
    : raw;
  const hasTags = /<\/?[a-z][^>]*>/i.test(text);

  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1 && !onlyOneParagraph) {
    return hasTags ? `<p>${text}</p>` : `<p>${escapeHtml(text)}</p>`;
  }
  return lines.map(l => {
    const plain = l.replace(/<[^>]+>/g, "");
    const isHeading = plain.length <= 80 && !/[.!:;,]$/.test(plain) && !hasTags;
    const body = hasTags ? l : escapeHtml(l);
    return isHeading ? `<h2>${body}</h2>` : `<p>${body}</p>`;
  }).join("\n");
}

const ALLOWED_TAGS = [
  "article", "section", "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
  "a", "img", "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption",
];

/** Yönetici editöründen gelen blog HTML'ini izin listesiyle temizler (script, on*, javascript: gider; p/h2/ul kalır). */
export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      "*": ["style", "class"],
    },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: { a: (tag, attribs) => ({ tagName: tag, attribs: attribs.target ? { ...attribs, rel: "noopener noreferrer" } : attribs }) },
  });
}

export function prepareBlogContent(input: string): string {
  return normalizeBlogHtml(sanitizeBlogHtml(input ?? ""));
}
