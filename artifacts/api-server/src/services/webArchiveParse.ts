export interface Ref { title: string; url: string }

const SNAPSHOT_RE = /^https:\/\/web\.archive\.org\/web\/\d{14}[a-z_]*\/https?:\/\//;

export function isSnapshotUrl(u: string): boolean { return SNAPSHOT_RE.test(u); }

/** Arşivlenmesi gereken bağlantı: http(s) ve henüz arşiv kopyası olmayan. */
export function needsArchive(u: string): boolean {
  return /^https?:\/\//.test(u) && !/^https?:\/\/(web\.)?archive\.org\//.test(u);
}

/** Başlığa "arşiv kopyası" notu ekler (zaten varsa dokunmaz). */
export function archivedTitle(title: string): string {
  return /arşiv kopyası/i.test(title) ? title : title.replace(/\)\s*$/, "; arşiv kopyası)").replace(/^(.*[^)])$/, (m) => (m.includes("arşiv kopyası") ? m : `${m} (arşiv kopyası)`));
}

/** Kaynak listesini arşiv eşlemesine göre günceller; eşlemesi olmayanlar olduğu gibi kalır. */
export function applyArchive(refs: Ref[], map: Record<string, string>): Ref[] {
  return refs.map(r => map[r.url] ? { title: archivedTitle(r.title), url: map[r.url] } : r);
}
