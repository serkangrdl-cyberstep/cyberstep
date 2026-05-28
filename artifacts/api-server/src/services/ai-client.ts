/**
 * Tenant-aware AI client factory.
 * Returns a `generateContent(prompt) → string` function routed to the
 * correct provider based on the tenant's aiProvider setting.
 *
 * Providers:
 *   gemini-replit → Replit-managed Gemini (env vars, no key needed)
 *   gemini        → Google Gemini with tenant's own API key
 *   openai        → OpenAI Chat Completions API (fetch-based)
 *   anthropic     → Anthropic Messages API (fetch-based)
 */

import { GoogleGenAI } from "@google/genai";
import { ai as replitAi } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export type AiGenerateFn = (prompt: string) => Promise<string>;

// ─── Replit-managed Gemini (default, free) ────────────────────────────────────
function makeReplitGemini(model = "gemini-2.5-flash"): AiGenerateFn {
  return async (prompt: string) => {
    const result = await replitAi.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.15 },
    });
    return result.text?.trim() ?? "";
  };
}

// ─── Tenant's own Google Gemini key ──────────────────────────────────────────
function makeTenantGemini(apiKey: string, model = "gemini-2.5-flash"): AiGenerateFn {
  const client = new GoogleGenAI({ apiKey });
  return async (prompt: string) => {
    const result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.15 },
    });
    return result.text?.trim() ?? "";
  };
}

// ─── OpenAI Chat Completions (fetch) ─────────────────────────────────────────
function makeOpenAi(apiKey: string, model = "gpt-4o"): AiGenerateFn {
  return async (prompt: string) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.15,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content.trim() ?? "";
  };
}

// ─── Anthropic Messages (fetch) ───────────────────────────────────────────────
function makeAnthropic(apiKey: string, model = "claude-3-5-sonnet-20241022"): AiGenerateFn {
  return async (prompt: string) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    return data.content.find(c => c.type === "text")?.text.trim() ?? "";
  };
}

// ─── Public factory ───────────────────────────────────────────────────────────
/**
 * Returns an AI generate function for the given tenant.
 * Falls back to Replit Gemini if tenant has no AI config or tenantId is absent.
 */
export async function getTenantAiFn(tenantId?: number): Promise<AiGenerateFn> {
  if (!tenantId) return makeReplitGemini();

  try {
    const [tenant] = await db.select({
      aiProvider: tenantsTable.aiProvider,
      aiApiKey: tenantsTable.aiApiKey,
      aiModel: tenantsTable.aiModel,
    }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));

    if (!tenant) return makeReplitGemini();

    const { aiProvider, aiApiKey, aiModel } = tenant;

    switch (aiProvider) {
      case "gemini":
        if (!aiApiKey) {
          logger.warn({ tenantId }, "Tenant has gemini provider but no API key, falling back to Replit");
          return makeReplitGemini(aiModel ?? undefined);
        }
        return makeTenantGemini(aiApiKey, aiModel ?? undefined);

      case "openai":
        if (!aiApiKey) {
          logger.warn({ tenantId }, "Tenant has openai provider but no API key, falling back to Replit");
          return makeReplitGemini();
        }
        return makeOpenAi(aiApiKey, aiModel ?? undefined);

      case "anthropic":
        if (!aiApiKey) {
          logger.warn({ tenantId }, "Tenant has anthropic provider but no API key, falling back to Replit");
          return makeReplitGemini();
        }
        return makeAnthropic(aiApiKey, aiModel ?? undefined);

      case "gemini-replit":
      default:
        return makeReplitGemini(aiModel ?? undefined);
    }
  } catch (err) {
    logger.error({ err, tenantId }, "Failed to load tenant AI config, using Replit Gemini");
    return makeReplitGemini();
  }
}
