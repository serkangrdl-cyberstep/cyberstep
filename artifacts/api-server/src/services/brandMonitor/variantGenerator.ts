const QWERTY_NEIGHBORS: Record<string, string[]> = {
  q: ["w", "a", "s"],
  w: ["q", "e", "a", "s", "d"],
  e: ["w", "r", "s", "d", "f"],
  r: ["e", "t", "d", "f", "g"],
  t: ["r", "y", "f", "g", "h"],
  y: ["t", "u", "g", "h", "j"],
  u: ["y", "i", "h", "j", "k"],
  i: ["u", "o", "j", "k", "l"],
  o: ["i", "p", "k", "l"],
  p: ["o", "l"],
  a: ["q", "w", "s", "z"],
  s: ["a", "w", "e", "d", "z", "x"],
  d: ["s", "e", "r", "f", "x", "c"],
  f: ["d", "r", "t", "g", "c", "v"],
  g: ["f", "t", "y", "h", "v", "b"],
  h: ["g", "y", "u", "j", "b", "n"],
  j: ["h", "u", "i", "k", "n", "m"],
  k: ["j", "i", "o", "l", "m"],
  l: ["k", "o", "p"],
  z: ["a", "s", "x"],
  x: ["z", "s", "d", "c"],
  c: ["x", "d", "f", "v"],
  v: ["c", "f", "g", "b"],
  b: ["v", "g", "h", "n"],
  n: ["b", "h", "j", "m"],
  m: ["n", "j", "k"],
};

const HOMOGLYPHS: Record<string, string> = {
  o: "0",
  i: "1",
  l: "1",
  a: "@",
  e: "3",
  s: "5",
};

const COMMON_TLDS = [".com", ".net", ".org", ".io", ".co", ".biz"];
const TR_TLDS = [".com.tr", ".net.tr", ".org.tr"];

const PREFIXES = ["my-", "get-", "www-"];
const SUFFIXES = ["-tr", "-guvenlik", "ai", "security", "online", "app"];

function parseDomain(domain: string): {
  name: string;
  tld: string;
  isTR: boolean;
} {
  const lower = domain.toLowerCase();
  if (lower.endsWith(".com.tr")) {
    return { name: lower.slice(0, -7), tld: ".com.tr", isTR: true };
  }
  if (lower.endsWith(".net.tr")) {
    return { name: lower.slice(0, -7), tld: ".net.tr", isTR: true };
  }
  if (lower.endsWith(".org.tr")) {
    return { name: lower.slice(0, -7), tld: ".org.tr", isTR: true };
  }
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx === -1) return { name: lower, tld: "", isTR: false };
  return {
    name: lower.slice(0, dotIdx),
    tld: lower.slice(dotIdx),
    isTR: false,
  };
}

function unique<T extends { variant: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => {
    if (seen.has(x.variant)) return false;
    seen.add(x.variant);
    return true;
  });
}

export function generateVariants(
  domain: string
): { variant: string; type: string }[] {
  const results: { variant: string; type: string }[] = [];
  const { name, tld, isTR } = parseDomain(domain);

  // 1. TLD swap
  const tldTargets = isTR
    ? COMMON_TLDS
    : [...COMMON_TLDS.filter((t) => t !== tld), ...TR_TLDS];
  for (const t of tldTargets) {
    results.push({ variant: name + t, type: "tld_swap" });
  }

  // 2. Hyphen manipulation
  if (name.includes("-")) {
    results.push({ variant: name.replace(/-/g, "") + tld, type: "hyphen_remove" });
  } else {
    for (let i = 1; i < name.length - 1; i++) {
      const candidate = name.slice(0, i) + "-" + name.slice(i) + tld;
      results.push({ variant: candidate, type: "hyphen_insert" });
      if (results.filter((r) => r.type === "hyphen_insert").length >= 4) break;
    }
  }

  // 3. Char swap (QWERTY typo) — max 15 from name
  const typoVariants: { variant: string; type: string }[] = [];
  for (let i = 0; i < name.length && typoVariants.length < 15; i++) {
    const ch = name[i];
    const neighbors = QWERTY_NEIGHBORS[ch] ?? [];
    for (const nb of neighbors) {
      const candidate = name.slice(0, i) + nb + name.slice(i + 1) + tld;
      typoVariants.push({ variant: candidate, type: "char_swap" });
      if (typoVariants.length >= 15) break;
    }
  }
  results.push(...typoVariants);

  // 4. Char addition/deletion — max 10
  const addDelVariants: { variant: string; type: string }[] = [];
  // Double char
  for (let i = 0; i < name.length && addDelVariants.length < 5; i++) {
    const candidate = name.slice(0, i + 1) + name[i] + name.slice(i + 1) + tld;
    addDelVariants.push({ variant: candidate, type: "char_double" });
  }
  // Missing char
  for (let i = 0; i < name.length && addDelVariants.length < 10; i++) {
    if (name.length <= 3) break;
    const candidate = name.slice(0, i) + name.slice(i + 1) + tld;
    addDelVariants.push({ variant: candidate, type: "char_omit" });
  }
  results.push(...addDelVariants);

  // 5. Prefix/Suffix
  for (const pfx of PREFIXES) {
    results.push({ variant: pfx + name + tld, type: "prefix_suffix" });
  }
  for (const sfx of SUFFIXES) {
    if (sfx.startsWith("-")) {
      results.push({ variant: name + sfx + tld, type: "prefix_suffix" });
    } else {
      results.push({ variant: name + sfx + tld, type: "prefix_suffix" });
    }
  }

  // 6. Homoglyph — max 5
  const homoglyphVariants: { variant: string; type: string }[] = [];
  for (let i = 0; i < name.length && homoglyphVariants.length < 5; i++) {
    const ch = name[i];
    const glyph = HOMOGLYPHS[ch];
    if (glyph) {
      const candidate = name.slice(0, i) + glyph + name.slice(i + 1) + tld;
      homoglyphVariants.push({ variant: candidate, type: "homoglyph" });
    }
  }
  results.push(...homoglyphVariants);

  // Deduplicate, remove original, cap at 60
  const originalLower = domain.toLowerCase();
  return unique(results)
    .filter((r) => r.variant !== originalLower)
    .slice(0, 60);
}
