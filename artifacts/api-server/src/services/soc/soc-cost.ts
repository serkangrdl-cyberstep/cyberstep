/**
 * AI cost estimation + usage logging for the SOC service.
 *
 * The Replit-managed AI client returns text only (no token counts), so cost is
 * ESTIMATED from a char→token heuristic (~4 chars/token) and a per-model price
 * table (USD per 1M tokens). Every AI call is logged to `ai_usage_log` so the
 * AI cost dashboard can report monthly/tier/per-customer spend.
 */

import { db, aiUsageLogTable } from "@workspace/db";
import { logger } from "../../lib/logger";

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  tier: number; // 0 rule, 1 fast (haiku), 2 deep (sonnet), 3 extended
}

// USD per 1,000,000 tokens. Estimates — adjust if Anthropic pricing changes.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5":           { inputPerMillion: 0.8,  outputPerMillion: 4.0,  tier: 1 },
  "claude-haiku-4-5-20251001":  { inputPerMillion: 0.8,  outputPerMillion: 4.0,  tier: 1 },
  "claude-sonnet-4-6":          { inputPerMillion: 3.0,  outputPerMillion: 15.0, tier: 2 },
  "gemini-2.5-flash":           { inputPerMillion: 0.3,  outputPerMillion: 2.5,  tier: 1 },
};

const FALLBACK_PRICING: ModelPricing = { inputPerMillion: 3.0, outputPerMillion: 15.0, tier: 2 };

export function getPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? FALLBACK_PRICING;
}

// ~4 characters per token is a reasonable heuristic for mixed Turkish/English.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = getPricing(model);
  const cost = (inputTokens / 1_000_000) * p.inputPerMillion + (outputTokens / 1_000_000) * p.outputPerMillion;
  return Math.round(cost * 1_000_000) / 1_000_000; // round to 6 decimals
}

export interface UsageRecord {
  customerId?: number | null;
  caseId?: number | null;
  model: string;
  useCase?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  cached?: boolean;
}

export async function logAIUsage(rec: UsageRecord): Promise<void> {
  try {
    const pricing = getPricing(rec.model);
    const costUsd = rec.costUsd ?? computeCost(rec.model, rec.inputTokens, rec.outputTokens);
    await db.insert(aiUsageLogTable).values({
      customerId: rec.customerId ?? null,
      caseId: rec.caseId ?? null,
      model: rec.model,
      tier: pricing.tier,
      useCase: rec.useCase ?? "triage",
      inputTokens: rec.inputTokens,
      outputTokens: rec.outputTokens,
      costUsd,
      cached: rec.cached ?? false,
    });
  } catch (err) {
    logger.warn({ err, model: rec.model }, "Failed to log AI usage");
  }
}
