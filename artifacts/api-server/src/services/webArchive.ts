import { logger } from "../lib/logger";
import { isSnapshotUrl, needsArchive, applyArchive, type Ref } from "./webArchiveParse";

const UA = "CyberStepBot/1.0 (+https://cyberstep.io)";

/** Bağlantı için Web Archive kopyası döndürür: önce mevcut kopya, yoksa Save Page Now. Başarısızlıkta null. */
export async function archiveUrl(url: string, timeoutMs = 70_000): Promise<string | null> {
  try {
    const av = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (av.ok) {
      const j = (await av.json()) as { archived_snapshots?: { closest?: { available?: boolean; url?: string; status?: string } } };
      const c = j.archived_snapshots?.closest;
      if (c?.available && c.url && c.status === "200") return c.url.replace(/^http:/, "https:");
    }
  } catch (err) { logger.debug({ err: String(err) }, "Web Archive mevcut kopya sorgusu başarısız"); }
  try {
    const res = await fetch(`https://web.archive.org/save/${url}`, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (isSnapshotUrl(res.url)) return res.url;
    const loc = res.headers.get("content-location");
    if (loc && /^\/web\/\d{14}/.test(loc)) return `https://web.archive.org${loc}`;
  } catch (err) { logger.warn({ err: String(err).slice(0, 200), url }, "Web Archive kaydı başarısız"); }
  return null;
}

/** Yazının kaynaklarını sırayla arşivler (hız sınırı için aralıklı); başarılı olanları yazıya geri yazar. */
export async function archivePostRefs(refs: Ref[]): Promise<{ refs: Ref[]; archived: number; failed: number }> {
  const map: Record<string, string> = {};
  let failed = 0;
  for (const r of refs) {
    if (!needsArchive(r.url)) continue;
    const a = await archiveUrl(r.url);
    if (a) map[r.url] = a; else failed++;
    await new Promise(res => setTimeout(res, 4000));
  }
  return { refs: applyArchive(refs, map), archived: Object.keys(map).length, failed };
}
