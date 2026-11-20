import { buildCoverSvg } from "./blogCoverSvg";

export { isTprmTitle } from "./blogCoverSvg";

/** Başlık yazılı SVG kapak üretir (yapay zeka görseli kullanılmaz; koyu degrade arka plan + başlık + logo). */
export async function generateBlogCoverDataUrl(opts: {
  title: string; excerpt: string | null; tprm: boolean;
}): Promise<{ dataUrl: string }> {
  const svg = buildCoverSvg({
    title: opts.title,
    label: opts.tprm ? "Tedarikçi risk yönetimi" : undefined,
  });
  return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}` };
}
