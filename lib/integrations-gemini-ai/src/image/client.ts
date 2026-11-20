import { Modality } from "@google/genai";
// Ortak istemci: Replit (AI_INTEGRATIONS_*) veya Replit dışı (GEMINI_API_KEY) — bkz. ../client.ts
import { ai } from "../client";

export { ai };

// Görsel modeli: GEMINI_IMAGE_MODEL ile zorlanabilir. Yoksa sırayla denenir. Google görsel modellerini
// kısa aralıklarla kapattığı için (2.5-flash-image için duyurulan kapanış tarihi 2 Ekim 2026) tek ada
// güvenilmez; her hata modelle birlikte kayda geçer.
const DEFAULT_IMAGE_MODELS = [
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
];

function imageModels(): string[] {
  const forced = process.env.GEMINI_IMAGE_MODEL?.split(",").map((m) => m.trim()).filter(Boolean);
  return forced && forced.length > 0 ? forced : DEFAULT_IMAGE_MODELS;
}

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  const errors: string[] = [];
  for (const model of imageModels()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find(
        (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData?.data
      );
      if (!imagePart?.inlineData?.data) {
        errors.push(`${model}: yanıtta görsel yok`);
        continue;
      }
      return {
        b64_json: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || "image/png",
      };
    } catch (err) {
      errors.push(`${model}: ${String(err instanceof Error ? err.message : err).slice(0, 200)}`);
    }
  }
  throw new Error(`Görsel üretilemedi. ${errors.join(" | ")}`);
}
