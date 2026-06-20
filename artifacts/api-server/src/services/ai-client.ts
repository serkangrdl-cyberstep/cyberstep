/**
 * Tenant-aware AI client factory.
 * Returns a `generateContent(prompt) → string` function routed to the
 * correct provider based on the tenant's plan and aiProvider setting.
 *
 * Plan-based routing (when aiProvider = "gemini-replit" default):
 *   free    → Gemini 2.5 Flash  (Replit-managed, ücretsiz)
 *   starter → Claude Sonnet 4.6 (Replit-managed, ücretli)
 *   pro     → Claude Sonnet 4.6 (Replit-managed, ücretli)
 *
 * Custom aiProvider overrides plan routing:
 *   gemini    → Tenant's own Google API key
 *   openai    → Tenant's own OpenAI key
 *   anthropic → Tenant's own Anthropic key (or Replit Claude if no key)
 */

import { GoogleGenAI } from "@google/genai";
import { ai as replitAi } from "@workspace/integrations-gemini-ai";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getModel } from "@workspace/ai";
import { db } from "@workspace/db";
import { tenantsTable, aiUsageLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Pricing per 1M tokens (USD) ─────────────────────────────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash":  { input: 0.075,  output: 0.300  },
  "gemini-2.0-flash":  { input: 0.075,  output: 0.300  },
  "claude-sonnet-4-6": { input: 3.00,   output: 15.00  },
  "claude-sonnet-4-5": { input: 3.00,   output: 15.00  },
  "gpt-4o":            { input: 2.50,   output: 10.00  },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function logAiUsage(opts: {
  model: string;
  prompt: string;
  response: string;
  customerId?: number | null;
  useCase?: string;
}) {
  try {
    const { model, prompt, response, customerId, useCase } = opts;
    const pricing = MODEL_PRICING[model] ?? { input: 0.075, output: 0.300 };
    const inputTokens  = estimateTokens(prompt);
    const outputTokens = estimateTokens(response);
    const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    await db.insert(aiUsageLogTable).values({
      customerId:   customerId ?? null,
      model,
      useCase:      useCase ?? "general",
      tier:         0,
      inputTokens,
      outputTokens,
      costUsd,
      cached:       false,
    });
  } catch {
    // non-critical — never throw
  }
}

export type AiGenerateFn = (prompt: string) => Promise<string>;

const PAID_PLANS = new Set(["starter", "pro"]);

// ─── Replit-managed Gemini 2.5 Flash (ücretsiz plan) ─────────────────────────
function makeReplitGemini(model = "gemini-2.5-flash", useCase?: string): AiGenerateFn {
  return async (prompt: string) => {
    const result = await replitAi.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.15 },
    });
    const text = result.text?.trim() ?? "";
    void logAiUsage({ model, prompt, response: text, useCase });
    return text;
  };
}

// ─── Replit-managed Claude Sonnet (ücretli plan, API key gerekmez) ────────────
function makeReplitClaude(model?: string, useCase?: string): AiGenerateFn {
  const resolvedModel = model ?? getModel("ai-client-claude");
  return async (prompt: string) => {
    const message = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block?.type === "text" ? block.text.trim() : "";
    void logAiUsage({ model: resolvedModel, prompt, response: text, useCase });
    return text;
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

// ─── Tenant's own OpenAI key ──────────────────────────────────────────────────
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

// ─── Tenant's own Anthropic key ───────────────────────────────────────────────
function makeAnthropic(apiKey: string, model = "claude-sonnet-4-6"): AiGenerateFn {
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
        max_tokens: 8192,
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
 *
 * Plan-based auto-routing (when aiProvider = "gemini-replit"):
 *   - free → Gemini 2.5 Flash
 *   - starter / pro → Claude Sonnet 4.6 (Replit-managed, no API key needed)
 *
 * Custom aiProvider settings always override plan-based routing.
 */
export function getClaudeAiFn(model = "claude-sonnet-4-6"): AiGenerateFn {
  return makeReplitClaude(model);
}

export async function getTenantAiFn(tenantId?: number): Promise<AiGenerateFn> {
  if (!tenantId) return makeReplitGemini();

  try {
    const [tenant] = await db.select({
      plan: tenantsTable.plan,
      aiProvider: tenantsTable.aiProvider,
      aiApiKey: tenantsTable.aiApiKey,
      aiModel: tenantsTable.aiModel,
    }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));

    if (!tenant) return makeReplitGemini();

    const { plan, aiProvider, aiApiKey, aiModel } = tenant;
    const isPaid = PAID_PLANS.has(plan ?? "free");

    switch (aiProvider) {
      case "gemini-replit":
      default:
        // Plan-based auto-routing: paid → Claude Sonnet, free → Gemini Flash
        if (isPaid) {
          logger.info({ tenantId, plan }, "Using Claude Sonnet for paid plan tenant");
          return makeReplitClaude();
        }
        return makeReplitGemini(aiModel ?? undefined);

      case "gemini":
        if (!aiApiKey) {
          logger.warn({ tenantId }, "Tenant has gemini provider but no API key, falling back");
          return isPaid ? makeReplitClaude() : makeReplitGemini(aiModel ?? undefined);
        }
        return makeTenantGemini(aiApiKey, aiModel ?? undefined);

      case "openai":
        if (!aiApiKey) {
          logger.warn({ tenantId }, "Tenant has openai provider but no API key, falling back");
          return isPaid ? makeReplitClaude() : makeReplitGemini();
        }
        return makeOpenAi(aiApiKey, aiModel ?? undefined);

      case "anthropic":
        if (!aiApiKey) {
          // No custom key → use Replit-managed Claude regardless of plan
          return makeReplitClaude(aiModel ?? undefined);
        }
        return makeAnthropic(aiApiKey, aiModel ?? undefined);
    }
  } catch (err) {
    logger.error({ err, tenantId }, "Failed to load tenant AI config, using Replit Gemini");
    return makeReplitGemini();
  }
}
