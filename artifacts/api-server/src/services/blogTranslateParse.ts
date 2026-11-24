/** Blog çevirisi: model çıktısını bölümlere ayırır (JSON kaçışları uzun HTML'de kırılgan olduğu için işaretli bölümler kullanılır). */
export interface BlogEnglish {
  titleEn: string; excerptEn: string; contentEn: string;
  seoTitleEn: string | null; metaDescriptionEn: string | null; focusKeywordEn: string | null;
}

const SECTIONS = ["TITLE", "EXCERPT", "SEO_TITLE", "META_DESCRIPTION", "FOCUS_KEYWORD", "CONTENT"] as const;

export function parseTranslation(raw: string): BlogEnglish | null {
  const out: Record<string, string> = {};
  for (let i = 0; i < SECTIONS.length; i++) {
    const name = SECTIONS[i];
    const start = raw.indexOf(`<<<${name}>>>`);
    if (start < 0) continue;
    const from = start + name.length + 6;
    let end = raw.length;
    for (const other of SECTIONS) {
      const idx = raw.indexOf(`<<<${other}>>>`, from);
      if (idx >= 0 && idx < end) end = idx;
    }
    out[name] = raw.slice(from, end).trim();
  }
  if (!out.TITLE || !out.EXCERPT || !out.CONTENT) return null;
  // Çeviri anlamlı uzunlukta olmalı (kesik çıktıyı kaydetme)
  if (!/<(p|h2|ul|ol)\b/i.test(out.CONTENT)) return null;
  return {
    titleEn: out.TITLE, excerptEn: out.EXCERPT, contentEn: out.CONTENT,
    seoTitleEn: out.SEO_TITLE || null, metaDescriptionEn: out.META_DESCRIPTION || null, focusKeywordEn: out.FOCUS_KEYWORD || null,
  };
}

/** Çeviride href adresleri değişmemeli: kaynak ve çeviri bağlantı listeleri aynı olmalı. */
export function sameLinks(sourceHtml: string, translatedHtml: string): boolean {
  const hrefs = (h: string) => [...h.matchAll(/href="([^"]+)"/g)].map(m => m[1]).sort().join("|");
  return hrefs(sourceHtml) === hrefs(translatedHtml);
}

export function buildTranslatePrompt(p: { title: string; excerpt: string; content: string; seoTitle?: string | null; metaDescription?: string | null; focusKeyword?: string | null }): string {
  return `Translate this Turkish cybersecurity blog post (CyberStep.io, a Turkish supplier cyber-risk company) into natural, professional English for risk, compliance and security managers.

RULES:
- Keep every HTML tag and attribute exactly as is. Do not change, add or remove any href. Translate only visible text.
- Do not add, remove or strengthen any claim, number, date, company name or legal statement. Keep hedges ("may", "reportedly", "not confirmed") as hedged.
- Turkish laws and bodies: write "KVKK (Turkish Personal Data Protection Authority/Law)" on first mention, then "KVKK". Keep names like Arçelik as is.
- Keep URLs and cyberstep.io links unchanged. Currency stays in TL.
- Output ONLY the sections below, each starting with its marker on its own line. No commentary.

<<<TITLE>>>
<<<EXCERPT>>>
<<<SEO_TITLE>>> (max 60 characters; skip the section if the source has none)
<<<META_DESCRIPTION>>> (max 155 characters; skip if none)
<<<FOCUS_KEYWORD>>> (skip if none)
<<<CONTENT>>>

SOURCE
TITLE: ${p.title}
EXCERPT: ${p.excerpt}
SEO_TITLE: ${p.seoTitle ?? ""}
META_DESCRIPTION: ${p.metaDescription ?? ""}
FOCUS_KEYWORD: ${p.focusKeyword ?? ""}
CONTENT:
${p.content}`;
}
