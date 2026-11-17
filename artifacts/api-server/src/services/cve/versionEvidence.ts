/** Saf yardımcılar (DB bağımlılığı yok) — CVE ↔ shadow-IT eşleşmesinde sürüm kanıtı. */
/** Simple version comparison without semver — returns true if currentVersion falls in [start, end) */
export function isVersionVulnerable(
  currentVersion: string,
  startInclusive?: string,
  endExclusive?: string,
): boolean {
  if (!startInclusive && !endExclusive) return true;
  try {
    const parse = (v: string) => v.split(".").map(p => parseInt(p.replace(/[^0-9]/g, "")) || 0);
    const cmp = (a: number[], b: number[]): number => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    };
    const curr = parse(currentVersion);
    if (startInclusive && cmp(curr, parse(startInclusive)) < 0) return false;
    if (endExclusive && cmp(curr, parse(endExclusive)) >= 0) return false;
    return true;
  } catch {
    return true;
  }
}


/**
 * Shadow-IT ürün eşleşmesinin kanıt düzeyi. Yalnızca ürün adı eşleşmesi "etkileniyor" demek değildir:
 *  - sürüm yoksa → doğrulanmadı (güven en fazla 50)
 *  - sürüm + CVE sürüm aralığı varsa → aralık dışındaysa eşleşme reddedilir, içindeyse "doğrulandı"
 *  - sürüm var ama aralık verisi yoksa → "sürüm tespit edildi, aralık doğrulanamadı" (güven en fazla 65)
 */
export function evaluateVersionEvidence(
  version: string | null | undefined,
  product: { versionStartIncluding?: string; versionEndExcluding?: string },
  baseConfidence: number,
  baseNote: string | null | undefined,
): { skip: boolean; confidence: number; note: string } {
  const join = (n: string) => (baseNote ? `${baseNote} · ${n}` : n);
  const v = (version ?? "").trim();
  if (!v || v === "unknown") {
    return { skip: false, confidence: Math.min(baseConfidence, 50), note: join("Sürüm tespit edilemedi — yalnızca ürün adı eşleşmesi, doğrulanmadı") };
  }
  const hasRange = !!(product.versionStartIncluding || product.versionEndExcluding);
  if (hasRange) {
    if (!isVersionVulnerable(v, product.versionStartIncluding, product.versionEndExcluding)) {
      return { skip: true, confidence: 0, note: "" };
    }
    return { skip: false, confidence: baseConfidence, note: join(`Sürüm aralığı doğrulandı (${v})`) };
  }
  return { skip: false, confidence: Math.min(baseConfidence, 65), note: join(`Sürüm tespit edildi (${v}); CVE aralık verisi yok, doğrulanamadı`) };
}

