/**
 * NVD kaydının, tespit edilen ürün sürümünü gerçekten etkileyip etkilemediğini doğrular.
 * Amaç: "WordPress anahtar kelimesiyle bulunan herhangi bir kritik CVE"yi tedarikçiye
 * atfetmek yerine yalnızca sürüm aralığı eşleşen kayıtları kabul etmek.
 */

export interface NvdCpeMatch {
  vulnerable?: boolean;
  criteria?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

export interface NvdConfiguration { nodes?: Array<{ cpeMatch?: NvdCpeMatch[] }> }

/** "6.4.2" ile "6.10" gibi noktalı sürümleri sayısal karşılaştırır. -1 / 0 / 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-_]/).map((x) => parseInt(x, 10));
  const pb = b.split(/[.\-_]/).map((x) => parseInt(x, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = Number.isNaN(pa[i] ?? 0) ? 0 : (pa[i] ?? 0);
    const y = Number.isNaN(pb[i] ?? 0) ? 0 : (pb[i] ?? 0);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * configurations yoksa null döner (doğrulanamadı); varsa ürün (vendor:product) için
 * sürüm aralığı veya tam sürüm eşleşmesine göre true/false.
 */
export function cveAffectsVersion(
  configurations: NvdConfiguration[] | undefined,
  vendorProduct: string,
  version: string,
): boolean | null {
  if (!configurations || configurations.length === 0) return null;
  const needle = `:${vendorProduct}:`;
  let sawProduct = false;
  let sawPlatformOnly = false;
  for (const cfg of configurations) {
    for (const node of cfg.nodes ?? []) {
      for (const m of node.cpeMatch ?? []) {
        if (m.criteria?.includes(needle) && m.vulnerable === false) { sawPlatformOnly = true; continue; }
        if (m.vulnerable === false || !m.criteria?.includes(needle)) continue;
        sawProduct = true;
        const parts = m.criteria.split(":");
        const cpeVersion = parts[5] ?? "*";
        const hasRange = m.versionStartIncluding || m.versionStartExcluding || m.versionEndIncluding || m.versionEndExcluding;
        if (hasRange) {
          if (m.versionStartIncluding && compareVersions(version, m.versionStartIncluding) < 0) continue;
          if (m.versionStartExcluding && compareVersions(version, m.versionStartExcluding) <= 0) continue;
          if (m.versionEndIncluding && compareVersions(version, m.versionEndIncluding) > 0) continue;
          if (m.versionEndExcluding && compareVersions(version, m.versionEndExcluding) >= 0) continue;
          return true;
        }
        if (cpeVersion === "*" || cpeVersion === "-") return true;
        if (compareVersions(version, cpeVersion) === 0) return true;
      }
    }
  }
  // Ürün yalnızca "üzerinde çalıştığı platform" (vulnerable:false) olarak geçiyorsa (ör. WordPress eklentisi CVE'si)
  // zafiyet platformun kendisinde değildir → etkilenmiyor.
  return sawProduct || sawPlatformOnly ? false : null;
}
