import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { logger } from "../lib/logger";
import { buildCoverBackgroundPrompt, buildCoverSvg } from "./blogCoverSvg";

export { isTprmTitle } from "./blogCoverSvg";

/**
 * Başlık yazılı kapağı üretir. Gemini arka planı üretemezse yazılı, düz arka planlı kapağa düşer;
 * böylece yayına giden her yazının başlıklı bir kapağı olur.
 */
export async function generateBlogCoverDataUrl(opts: {
  title: string; excerpt: string | null; tprm: boolean;
}): Promise<{ dataUrl: string; backgroundOk: boolean; backgroundError?: string }> {
  let backgroundDataUrl: string | undefined;
  let backgroundError: string | undefined;
  try {
    const { b64_json, mimeType } = await generateImage(buildCoverBackgroundPrompt(opts.title, opts.excerpt, opts.tprm));
    backgroundDataUrl = `data:${mimeType};base64,${b64_json}`;
  } catch (err) {
    backgroundError = String(err instanceof Error ? err.message : err).slice(0, 500);
    logger.warn(`Kapak arka planı üretilemedi, düz arka planla devam ediliyor: ${backgroundError}`);
  }
  const svg = buildCoverSvg({
    title: opts.title,
    label: opts.tprm ? "Tedarikçi risk yönetimi" : undefined,
    backgroundDataUrl,
  });
  return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`, backgroundOk: !!backgroundDataUrl, backgroundError };
}
